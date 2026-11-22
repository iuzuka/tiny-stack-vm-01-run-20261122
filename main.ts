// Tiny stack VM for make.fun tiny-stack-vm-01: a faithful interpreter of
// generator/subject/ISA.md, written from the spec. Behaviour matches the
// reference VM (vm.mjs) rule for rule: 32-bit wrap, 256-value stack, 64-deep
// call stack, 256 words of memory, ten traps with their own exit codes, and
// the step (1,000,000) and output (65,536 byte) limits.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const STEP_LIMIT = 1_000_000;
const OUT_MAX = 65_536;

// Opcode table: V valid, I immediate bytes, P pops, U pushes.
const V = new Uint8Array(84), I = new Uint8Array(84), P = new Uint8Array(84), U = new Uint8Array(84);
const set = (o: number, i: number, p: number, u: number): void => { V[o] = 1; I[o] = i; P[o] = p; U[o] = u; };
set(0x01, 1, 0, 1); set(0x02, 4, 0, 1); set(0x52, 0, 0, 1);
set(0x03, 0, 1, 0); set(0x31, 2, 1, 0); set(0x32, 2, 1, 0);
set(0x50, 0, 1, 0); set(0x51, 0, 1, 0); set(0x53, 0, 1, 0);
set(0x04, 0, 1, 2); set(0x05, 0, 2, 2); set(0x06, 0, 2, 3); set(0x07, 0, 3, 3);
set(0x17, 0, 1, 1); set(0x1b, 0, 1, 1);
set(0x00, 0, 0, 0); set(0x30, 2, 0, 0); set(0x33, 2, 0, 0); set(0x34, 0, 0, 0);
set(0x40, 0, 1, 1); set(0x41, 0, 2, 0);
for (let o = 0x10; o <= 0x22; o++) if (o !== 0x17 && o !== 0x1b && o !== 0x1f) set(o, 0, 2, 1);

function run(p: Uint8Array, inp: Uint8Array): { o: Uint8Array; c: number } {
  const n = p.length;
  const D = new Int32Array(256);
  let sp = 0;
  const C = new Int32Array(64);
  let cp = 0;
  const M = new Int32Array(256);
  const out = new Uint8Array(OUT_MAX);
  let ol = 0, ip = 0, pc = 0, steps = 0;
  // Return a view, not a copy: out is freshly allocated per run() call
  // and the harness writes r.o to disk synchronously before the next
  // run(), so no aliasing across instances is possible.
  const end = (c: number): { o: Uint8Array; c: number } => ({ o: out.subarray(0, ol), c });
  for (;;) {
    if (steps === STEP_LIMIT) return end(10);
    if (pc < 0 || pc >= n) return end(9);
    const op = p[pc];
    if (!V[op]) return end(5);
    const imm = I[op], pops = P[op], pushes = U[op];
    if (pc + imm >= n) return end(9);
    steps++;
    const nx = pc + 1 + imm;
    if (sp < pops) return end(2);
    if (sp - pops + pushes > 256) return end(3);
    pc = nx;
    switch (op) {
      case 0x00: return end(0);
      case 0x01: D[sp++] = (p[nx - 1] << 24) >> 24; break;
      case 0x02: D[sp++] = p[nx - 4] | (p[nx - 3] << 8) | (p[nx - 2] << 16) | (p[nx - 1] << 24); break;
      case 0x03: sp--; break;
      case 0x04: D[sp] = D[sp - 1]; sp++; break;
      case 0x05: { const t = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = t; break; }
      case 0x06: D[sp] = D[sp - 2]; sp++; break;
      case 0x07: { const a = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = a; break; }
      case 0x17: D[sp - 1] = (-D[sp - 1]) | 0; break;
      case 0x1b: D[sp - 1] = ~D[sp - 1]; break;
      case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15: case 0x16:
      case 0x18: case 0x19: case 0x1a: case 0x1c: case 0x1d: case 0x1e:
      case 0x20: case 0x21: case 0x22: {
        const b = D[sp - 1], a = D[sp - 2];
        let r: number;
        if (op === 0x10) r = (a + b) | 0;
        else if (op === 0x11) r = (a - b) | 0;
        else if (op === 0x12) r = Math.imul(a, b);
        else if (op === 0x13) { if (b === 0) return end(4); r = a === -2147483648 && b === -1 ? a : (a / b) | 0; }
        else if (op === 0x14) { if (b === 0) return end(4); r = b === -1 ? 0 : (a % b) | 0; }
        else if (op === 0x15) { if (b === 0) return end(4); r = Math.floor((a >>> 0) / (b >>> 0)) | 0; }
        else if (op === 0x16) { if (b === 0) return end(4); r = ((a >>> 0) % (b >>> 0)) | 0; }
        else if (op === 0x18) r = a & b;
        else if (op === 0x19) r = a | b;
        else if (op === 0x1a) r = a ^ b;
        else if (op === 0x1c) r = a << (b & 31);
        else if (op === 0x1d) r = a >> (b & 31);
        else if (op === 0x1e) r = (a >>> (b & 31)) | 0;
        else if (op === 0x20) r = a === b ? 1 : 0;
        else if (op === 0x21) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        sp -= 2; D[sp++] = r;
        break;
      }
      case 0x30: case 0x31: case 0x32: {
        const rel = ((p[nx - 2] | (p[nx - 1] << 8)) << 16) >> 16;
        let take = op === 0x30;
        if (op === 0x31) take = D[--sp] === 0;
        else if (op === 0x32) take = D[--sp] !== 0;
        if (take) pc = nx + rel;
        break;
      }
      case 0x33:
        if (cp === 64) return end(7);
        C[cp++] = nx;
        pc = p[nx - 2] | (p[nx - 1] << 8);
        break;
      case 0x34:
        if (cp === 0) return end(8);
        pc = C[--cp];
        break;
      case 0x40: {
        const a = D[sp - 1];
        if (a < 0 || a >= 256) return end(6);
        D[sp - 1] = M[a];
        break;
      }
      case 0x41: {
        const a = D[sp - 1], v = D[sp - 2];
        if (a < 0 || a >= 256) return end(6);
        sp -= 2; M[a] = v;
        break;
      }
      case 0x50: {
        // Write the decimal digits straight into the output buffer: no
        // TextEncoder allocation and no intermediate string per PRINT.
        // The length is counted first, so the output-limit trap still
        // writes nothing when the value would not fit.
        const v = D[sp - 1];
        const neg = v < 0;
        let mag = neg ? -v : v;
        let digits = 1;
        for (let t = mag; t >= 10; t = (t / 10) | 0) digits++;
        const len = digits + (neg ? 1 : 0);
        if (ol + len > OUT_MAX) return end(11);
        sp--;
        let pos = ol + len;
        if (mag === 0) out[--pos] = 48;
        while (mag > 0) { out[--pos] = 48 + (mag % 10); mag = (mag / 10) | 0; }
        if (neg) out[--pos] = 45;
        ol += len;
        break;
      }
      case 0x51:
        if (ol + 1 > OUT_MAX) return end(11);
        out[ol++] = D[--sp] & 255;
        break;
      case 0x52: D[sp++] = ip < inp.length ? inp[ip++] : -1; break;
      case 0x53: return end(D[--sp] & 255);
    }
  }
}

const IN = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUT = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(IN).sort()) {
  // readFileSync returns a Buffer, which is a Uint8Array: pass it
  // straight to run() instead of copying the program and input.
  const r = run(readFileSync(join(IN, id, 'program.bin')), readFileSync(join(IN, id, 'input.bin')));
  mkdirSync(join(OUT, id), { recursive: true });
  writeFileSync(join(OUT, id, 'stdout.bin'), r.o);
  writeFileSync(join(OUT, id, 'exit.txt'), r.c + '\n');
}

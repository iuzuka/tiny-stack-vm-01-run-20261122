import{mkdirSync,readdirSync,readFileSync,writeFileSync}from'node:fs';
import{join}from'node:path';
const out=new Uint8Array(65536);
let OL=0;
function run(p,inp){
const n=p.length,D=new Int32Array(256),C=new Int32Array(64),M=new Int32Array(256);
let sp=0,cp=0,ip=0,pc=0,st=0;OL=0;
for(;;){
if(st===1e6)return 10;
if(pc<0||pc>=n)return 9;
const op=p[pc],imm=op===1?1:op===2?4:op>47&&op<52?2:0;
if(pc+imm>=n)return 9;
st++;const nx=pc+1+imm;pc=nx;
if(op>15&&op<35&&op!==23&&op!==27&&op!==31){
if(sp<2)return 2;
const b=D[sp-1],a=D[sp-2];let r;
switch(op){
case 16:r=(a+b)|0;break;
case 17:r=(a-b)|0;break;
case 18:r=Math.imul(a,b);break;
case 19:if(!b)return 4;r=a===-2147483648&&b===-1?a:(a/b)|0;break;
case 20:if(!b)return 4;r=b===-1?0:a%b|0;break;
case 21:if(!b)return 4;r=Math.floor((a>>>0)/(b>>>0))|0;break;
case 22:if(!b)return 4;r=(a>>>0)%(b>>>0)|0;break;
case 24:r=a&b;break;
case 25:r=a|b;break;
case 26:r=a^b;break;
case 28:r=a<<(b&31);break;
case 29:r=a>>(b&31);break;
case 30:r=(a>>>(b&31))|0;break;
case 32:r=a===b?1:0;break;
case 33:r=a<b?1:0;break;
default:r=(a>>>0)<(b>>>0)?1:0;
}
sp-=2;D[sp++]=r;continue;
}
switch(op){
case 0:return 0;
case 1:if(sp>255)return 3;D[sp++]=(p[nx-1]<<24)>>24;break;
case 2:if(sp>255)return 3;D[sp++]=p[nx-4]|p[nx-3]<<8|p[nx-2]<<16|p[nx-1]<<24;break;
case 3:if(sp<1)return 2;sp--;break;
case 4:if(sp<1)return 2;if(sp>255)return 3;D[sp]=D[sp-1];sp++;break;
case 5:if(sp<2)return 2;{const t=D[sp-1];D[sp-1]=D[sp-2];D[sp-2]=t;}break;
case 6:if(sp<2)return 2;if(sp>255)return 3;D[sp]=D[sp-2];sp++;break;
case 7:if(sp<3)return 2;{const a=D[sp-3];D[sp-3]=D[sp-2];D[sp-2]=D[sp-1];D[sp-1]=a;}break;
case 23:if(sp<1)return 2;D[sp-1]=-D[sp-1]|0;break;
case 27:if(sp<1)return 2;D[sp-1]=~D[sp-1];break;
case 48:case 49:case 50:{
const rel=(p[nx-2]|p[nx-1]<<8)<<16>>16;
if(op===48){pc=nx+rel;break;}
if(sp<1)return 2;const v=D[--sp];
if((op===49)===(v===0))pc=nx+rel;
break;
}
case 51:if(cp===64)return 7;C[cp++]=nx;pc=p[nx-2]|p[nx-1]<<8;break;
case 52:if(cp===0)return 8;pc=C[--cp];break;
case 64:if(sp<1)return 2;{const a=D[sp-1];if(a<0||a>255)return 6;D[sp-1]=M[a];}break;
case 65:if(sp<2)return 2;{const a=D[sp-1];if(a<0||a>255)return 6;sp-=2;M[a]=D[sp];}break;
case 80:if(sp<1)return 2;{const s=String(D[sp-1]);if(OL+s.length>65536)return 11;sp--;for(let i=0;i<s.length;i++)out[OL++]=s.charCodeAt(i);}break;
case 81:if(sp<1)return 2;if(OL+1>65536)return 11;out[OL++]=D[--sp]&255;break;
case 82:if(sp>255)return 3;D[sp++]=ip<inp.length?inp[ip++]:-1;break;
case 83:if(sp<1)return 2;return D[--sp]&255;
default:return 5;
}
}
}
const I=process.env.MAKEFUN_INPUT_DIR??'/input';
const O=process.env.MAKEFUN_OUTPUT_DIR??'/output';
for(const id of readdirSync(I).sort()){
const code=run(readFileSync(join(I,id,'program.bin')),readFileSync(join(I,id,'input.bin')));
mkdirSync(join(O,id),{recursive:true});
writeFileSync(join(O,id,'stdout.bin'),out.subarray(0,OL));
writeFileSync(join(O,id,'exit.txt'),code+'\n');
}

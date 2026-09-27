// Visual diff: matching pixels are dimmed, differing ones burn red.
// node tools/diffmap.js <a.png> <b.png> <out.png> [threshold]
const {decode,px}=require('./png');
const {write}=require('./pngw');

const [,,fa,fb,out,thrRaw]=process.argv;
const thr=+(thrRaw||24);
const A=decode(fa),B=decode(fb);
const w=Math.min(A.w,B.w),h=Math.min(A.h,B.h);
const buf=Buffer.alloc(w*h*3);
let bad=0;
for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const a=px(A,x,y),b=px(B,x,y);
  const d=(Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2]))/3;
  const o=(y*w+x)*3;
  if(d>thr){
    buf[o]=255;buf[o+1]=40;buf[o+2]=40;bad++;
  }else{
    const g=(0.299*a[0]+0.587*a[1]+0.114*a[2])*0.35|0;
    buf[o]=g;buf[o+1]=g;buf[o+2]=g;
  }
}
write(out,w,h,buf);
console.log('wrote '+out+' — '+(100*bad/(w*h)).toFixed(2)+'% of pixels differ by more than '+thr);

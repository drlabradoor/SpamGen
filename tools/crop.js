const {decode,px}=require('./png');const {write}=require('./pngw');
const [,,out,x0,y0,x1,y1,zoom,...files]=process.argv;
const X0=+x0,Y0=+y0,X1=+x1,Y1=+y1,Z=+zoom;
const w=(X1-X0+1)*Z, hh=(Y1-Y0+1)*Z, gap=6*Z;
const imgs=files.map(f=>decode(f));
const H=hh*imgs.length+gap*(imgs.length-1);
const buf=Buffer.alloc(w*H*3);
imgs.forEach((img,n)=>{const oy=n*(hh+gap);
 for(let y=0;y<hh;y++)for(let x=0;x<w;x++){
  const c=px(img,X0+Math.floor(x/Z),Y0+Math.floor(y/Z));
  const o=((oy+y)*w+x)*3;buf[o]=c[0];buf[o+1]=c[1];buf[o+2]=c[2];}});
write(out,w,H,buf);
console.log('wrote '+out+' '+w+'x'+H);

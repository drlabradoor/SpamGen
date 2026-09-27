// Pull the Display P3 colour-profile chunks out of a genuine iPhone screenshot
// once, so the deploy ships a 400-byte profile instead of a personal photo.
const fs=require('fs'),path=require('path');
const src=process.argv[2]||path.join(__dirname,'..','ref','IMG_6264.PNG');
const out=process.argv[3]||path.join(__dirname,'..','assets','p3-chunks.bin');
const b=fs.readFileSync(src);
const keep=['iCCP','cICP','pHYs'];
const found=[];
let p=8;
while(p<b.length){
  const len=b.readUInt32BE(p), type=b.toString('ascii',p+4,p+8);
  if(keep.includes(type))found.push(b.slice(p,p+len+12));
  if(type==='IEND')break;
  p+=len+12;
}
const buf=Buffer.concat(found);
fs.writeFileSync(out,buf);
console.log('wrote '+out+' — '+buf.length+' bytes, '+found.length+' chunks');

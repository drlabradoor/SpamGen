// Salvage avatar images out of finished renders in out/.
//
// The bank is just files, and a render draws each avatar at exactly 180x180
// device px — so a crop taken back out of a PNG is pixel-for-pixel what the next
// render would draw anyway. Three things have to be filtered out:
//
//   letter avatars   generated from the name, nothing to rescue
//   the online dot   painted over the avatar's bottom-right corner
//   misaligned crops the bottom row of a list is cut by the screen edge
//
//   node tools/recover-avatars.js [outDir]
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {decode,px}=require('./png');
const {write}=require('./pngw');

const ROOT=path.join(__dirname,'..');
const DEST=path.resolve(process.argv[2]||path.join(ROOT,'out','recovered-avatars'));
const AV_X=48, AV_SIZE=180, AV_DY=24, ROW_H=228;
const TOPS=[341,503];                 // list starts here without / with the search field
const R=AV_SIZE/2;

const dark=c=>c[0]<40&&c[1]<40&&c[2]<40;
function crop(img,y0){
  const buf=Buffer.alloc(AV_SIZE*AV_SIZE*3);
  for(let y=0;y<AV_SIZE;y++)for(let x=0;x<AV_SIZE;x++){
    const c=px(img,AV_X+x,y0+y),o=(y*AV_SIZE+x)*3;
    buf[o]=c[0];buf[o+1]=c[1];buf[o+2]=c[2];
  }
  return buf;
}
const at=(buf,x,y)=>{const o=(y*AV_SIZE+x)*3;return [buf[o],buf[o+1],buf[o+2]];};
const ring=(buf,rad,deg)=>at(buf,
  Math.min(AV_SIZE-1,Math.max(0,Math.round(R+rad*Math.cos(deg*Math.PI/180)))),
  Math.min(AV_SIZE-1,Math.max(0,Math.round(R+rad*Math.sin(deg*Math.PI/180)))));

// The avatar circle is inscribed in the crop, so it touches the top and bottom
// edges at one point only: a correct crop has black edges everywhere except a
// narrow band around the centre. A crop that has slipped half a row shows solid
// picture along its top edge, which is what this catches. The bottom-right
// corner is excluded — the online dot lives there and is not background.
function aligned(buf){
  for(const y of [0,1,2,3,AV_SIZE-4,AV_SIZE-3,AV_SIZE-2,AV_SIZE-1])
    for(let x=0;x<AV_SIZE;x+=4){
      if(Math.abs(x-R)<36)continue;               // where the circle meets the edge
      if(x>112&&y>119)continue;                   // online dot
      if(!dark(at(buf,x,y)))return false;
    }
  return !dark(at(buf,R,R));
}

// Every pixel of a letter avatar sits on the straight line between the two
// gradient stops, or is part of the white glyph. A photograph does not.
function isLetter(buf){
  const a=at(buf,R,8), b=at(buf,R,AV_SIZE-9);     // top and bottom of the gradient
  const v=[b[0]-a[0],b[1]-a[1],b[2]-a[2]];
  const len=Math.hypot(...v)||1;
  const u=v.map(x=>x/len);
  let off=0,tot=0;
  for(let d=0;d<360;d+=7)for(const rad of [R*0.45,R*0.7,R*0.9]){
    if(d>15&&d<75)continue;                       // online dot again
    const c=ring(buf,rad,d);
    if(c[0]>200&&c[1]>200&&c[2]>200){tot++;continue;}   // the glyph itself
    const w=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
    const t=w[0]*u[0]+w[1]*u[1]+w[2]*u[2];
    const dist=Math.hypot(w[0]-u[0]*t,w[1]-u[1]*t,w[2]-u[2]*t);
    tot++;if(dist>18)off++;
  }
  return off/tot<0.06;
}

// #38c759 with a row-coloured ring around it, at a fixed spot.
function hasDot(buf){
  const c=at(buf,146,153);
  return Math.abs(c[0]-56)<40&&Math.abs(c[1]-199)<45&&Math.abs(c[2]-89)<45;
}
// Identity is the picture inside the circle only. The corners carry the row
// background — black normally, lighter on a pinned row — and the bottom-right
// may carry the online dot; either would otherwise split one avatar into two.
function key(buf){
  const h=crypto.createHash('sha1');
  for(let y=0;y<AV_SIZE;y++)for(let x=0;x<AV_SIZE;x++){
    if(x>112&&y>119)continue;                     // online dot
    if(Math.hypot(x-R,y-R)>R-4)continue;          // outside the circle
    const o=(y*AV_SIZE+x)*3;
    h.update(buf.slice(o,o+3));
  }
  return h.digest('hex');
}

const files=fs.readdirSync(path.join(ROOT,'out'))
  .filter(f=>/^bot-.*\.png$/.test(f)).map(f=>path.join(ROOT,'out',f));
if(!files.length){console.log('no renders in out/ to salvage from');process.exit(0);}

fs.mkdirSync(DEST,{recursive:true});
const seen=new Map();
let slots=0,letters=0,skew=0;
for(const f of files){
  let img;
  try{img=decode(f);}catch(e){continue;}
  if(img.w!==1170||img.h!==2532)continue;
  for(const top of TOPS){
    for(let i=0;i<11;i++){
      const y0=top+i*ROW_H+AV_DY;
      if(y0+AV_SIZE>img.h){skew++;break;}
      const buf=crop(img,y0);
      if(!aligned(buf))continue;
      slots++;
      if(isLetter(buf)){letters++;continue;}
      const k=key(buf), had=seen.get(k);
      // Prefer a copy without the online dot burned into it.
      if(!had||(had.dot&&!hasDot(buf)))
        seen.set(k,{buf,dot:hasDot(buf),from:path.basename(f)});
    }
  }
}
let n=0,dotted=0;
for(const [k,v] of seen){
  if(v.dot)dotted++;
  const out=path.join(DEST,'rec-'+String(++n).padStart(2,'0')+'-'+k.slice(0,6)+
    (v.dot?'-dot':'')+'.png');
  write(out,AV_SIZE,AV_SIZE,v.buf);
  console.log('  '+path.basename(out)+'   from '+v.from);
}
console.log('\n'+files.length+' renders, '+slots+' aligned avatar slots'+
  ' ('+letters+' letters skipped)');
console.log('recovered '+n+' distinct photos'+(dotted?', '+dotted+' still carry the online dot':'')+
  ' -> '+DEST);
console.log('copy the ones you want into assets/bank/ to put them back in rotation');

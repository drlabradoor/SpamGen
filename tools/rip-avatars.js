// Crop the row avatars (and inline preview thumbnails) out of a reference
// screenshot so a generated replica can be compared against it without the
// avatar pixels being the thing that differs.
const fs=require('fs'),path=require('path');
const {decode,px}=require('./png');
const {write}=require('./pngw');

const src=process.argv[2]||'ref/IMG_6273.PNG';
const dir=process.argv[3]||'assets/ripped';
const firstTop=+(process.argv[4]||503);
const count=+(process.argv[5]||8);

const img=decode(src);
fs.mkdirSync(dir,{recursive:true});

const AV_X=48, AV_SIZE=180, AV_DY=24;
for(let i=0;i<count;i++){
  const y0=firstTop+i*228+AV_DY;
  const buf=Buffer.alloc(AV_SIZE*AV_SIZE*3);
  // The bottom row of a scrolled list is cut by the screen edge, so its avatar is
  // only partly there. Repeat the last real scanline instead of reading past the
  // buffer: the missing part is off-screen in the replica too.
  const avail=img.h-y0;
  for(let y=0;y<AV_SIZE;y++)for(let x=0;x<AV_SIZE;x++){
    const c=px(img,AV_X+x,y0+Math.min(y,avail-1)),o=(y*AV_SIZE+x)*3;
    buf[o]=c[0];buf[o+1]=c[1];buf[o+2]=c[2];
  }
  const p=path.join(dir,'av'+(i+1)+'.png');
  write(p,AV_SIZE,AV_SIZE,buf);
  console.log('av'+(i+1)+' from y'+y0+(avail<AV_SIZE?' ('+avail+' of '+AV_SIZE+' rows on screen)':''));
}

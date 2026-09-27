// Rip inline preview tiles from ref/IMG_6276.PNG.
// Tiles sit on the standard 54px grid with 6px gaps, 88px below the row top.
const fs=require('fs'),path=require('path');
const {decode,px}=require('./png');
const {write}=require('./pngw');

const img=decode('ref/IMG_6276.PNG');
const dir='assets/ripped2';
fs.mkdirSync(dir,{recursive:true});

const SIZE=54, STEP=60, X0=258, DY=88;
const ROWS=[{row:1,top:341,n:2},{row:2,top:569,n:2},{row:5,top:1253,n:2},{row:7,top:1709,n:3}];

for(const r of ROWS){
  for(let i=0;i<r.n;i++){
    const x0=X0+i*STEP, y0=r.top+DY;
    const buf=Buffer.alloc(SIZE*SIZE*3);
    for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
      const c=px(img,x0+x,y0+y),o=(y*SIZE+x)*3;
      buf[o]=c[0];buf[o+1]=c[1];buf[o+2]=c[2];
    }
    write(path.join(dir,'th'+r.row+'-'+(i+1)+'.png'),SIZE,SIZE,buf);
  }
  console.log('row '+r.row+': '+r.n+' tiles from y'+(r.top+DY));
}

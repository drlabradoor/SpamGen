// Crop the inline preview thumbnails out of ref/IMG_6273.PNG.
// Layout measured from the reference: 54x54 tiles, 6px apart.
const fs=require('fs'),path=require('path');
const {decode,px}=require('./png');
const {write}=require('./pngw');

const img=decode('ref/IMG_6273.PNG');
const dir='assets/ripped';
fs.mkdirSync(dir,{recursive:true});

const SIZE=54, GAP=6, X0=258;
const SETS=[
  {row:1, y:591, n:2},
  {row:5, y:1503, n:2},
  {row:7, y:1959, n:3},
];

for(const s of SETS){
  for(let i=0;i<s.n;i++){
    const x0=X0+i*(SIZE+GAP);
    const buf=Buffer.alloc(SIZE*SIZE*3);
    for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
      const c=px(img,x0+x,s.y+y),o=(y*SIZE+x)*3;
      buf[o]=c[0];buf[o+1]=c[1];buf[o+2]=c[2];
    }
    write(path.join(dir,'th'+s.row+'-'+(i+1)+'.png'),SIZE,SIZE,buf);
  }
  console.log('row '+s.row+': '+s.n+' thumbs');
}

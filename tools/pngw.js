const zlib=require('zlib');
function crc32(buf){let c,t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}
 let r=0xFFFFFFFF;for(const b of buf)r=t[(r^b)&0xFF]^(r>>>8);return (r^0xFFFFFFFF)>>>0;}
function chunk(type,data){const b=Buffer.alloc(8+data.length+4);b.writeUInt32BE(data.length,0);b.write(type,4,'ascii');
 data.copy(b,8);b.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type,'ascii'),data])),8+data.length);return b;}
function write(file,w,h,rgb){ // rgb: Buffer w*h*3
  const raw=Buffer.alloc(h*(w*3+1));
  for(let y=0;y<h;y++){raw[y*(w*3+1)]=0;rgb.copy(raw,y*(w*3+1)+1,y*w*3,(y+1)*w*3);}
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;
  require('fs').writeFileSync(file,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
}
module.exports={write,chunkX:chunk};

// RGBA variant
const zlib2=require('zlib');
function writeRGBA(file,w,h,rgba){
  const raw=Buffer.alloc(h*(w*4+1));
  for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;rgba.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4);}
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;
  const {chunkX}=module.exports;
  require('fs').writeFileSync(file,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),
    chunkX('IHDR',ihdr),chunkX('IDAT',zlib2.deflateSync(raw)),chunkX('IEND',Buffer.alloc(0))]));
}
module.exports.writeRGBA=writeRGBA;

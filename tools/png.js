const fs=require('fs'),zlib=require('zlib');
function decode(file){
  const b=fs.readFileSync(file);
  let p=8,idat=[],w,h,depth,ct;
  while(p<b.length){
    const len=b.readUInt32BE(p), type=b.toString('ascii',p+4,p+8), data=b.slice(p+8,p+8+len);
    if(type==='IHDR'){w=data.readUInt32BE(0);h=data.readUInt32BE(4);depth=data[8];ct=data[9];}
    if(type==='IDAT')idat.push(data);
    if(type==='IEND')break;
    p+=len+12;
  }
  const raw=zlib.inflateSync(Buffer.concat(idat));
  const ch=({0:1,2:3,3:1,4:2,6:4})[ct], bpp=ch*(depth/8), stride=w*bpp;
  const out=Buffer.alloc(h*stride);
  let pos=0;
  for(let y=0;y<h;y++){
    const f=raw[pos++]; const line=raw.slice(pos,pos+stride); pos+=stride;
    const cur=out.slice(y*stride,(y+1)*stride), prev=y?out.slice((y-1)*stride,y*stride):Buffer.alloc(stride);
    for(let i=0;i<stride;i++){
      const a=i>=bpp?cur[i-bpp]:0, bb=prev[i], c=i>=bpp?prev[i-bpp]:0, x=line[i];
      let v;
      switch(f){case 0:v=x;break;case 1:v=x+a;break;case 2:v=x+bb;break;case 3:v=x+((a+bb)>>1);break;
        case 4:{const pp=a+bb-c,pa=Math.abs(pp-a),pb=Math.abs(pp-bb),pc=Math.abs(pp-c);v=x+(pa<=pb&&pa<=pc?a:pb<=pc?bb:c);break;}}
      cur[i]=v&0xff;
    }
  }
  return {w,h,depth,ch,bpp,stride,out};
}
function px(img,x,y){ // returns [r,g,b] 8-bit (takes high byte of 16-bit)
  const o=y*img.stride+x*img.bpp, s=img.depth===16?2:1;
  return [img.out[o],img.out[o+s],img.out[o+2*s]];
}
const hex=c=>'#'+c.map(v=>v.toString(16).padStart(2,'0')).join('');
module.exports={decode,px,hex};

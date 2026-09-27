// Inject Display P3 colour profile chunks (copied from a genuine iPhone screenshot)
const fs=require('fs');
function chunks(buf){const o=[];let p=8;
 while(p<buf.length){const l=buf.readUInt32BE(p);const t=buf.toString('ascii',p+4,p+8);
  o.push({type:t,raw:buf.slice(p,p+l+12)});if(t==='IEND')break;p+=l+12;}return o;}
// Same as inject(), but the profile comes from a standalone chunk file
// (assets/p3-chunks.bin) instead of a whole donor screenshot.
function injectRaw(src,chunkBuf,out){
  const want=['iCCP','cICP','pHYs'];
  const parts=[Buffer.from([137,80,78,71,13,10,26,10])];
  for(const c of chunks(fs.readFileSync(src))){
    if(c.type==='IHDR'){parts.push(c.raw,chunkBuf);continue;}
    if(want.includes(c.type))continue;
    parts.push(c.raw);
  }
  fs.writeFileSync(out,Buffer.concat(parts));
}
function inject(src,donor,out){
  const S=chunks(fs.readFileSync(src)),D=chunks(fs.readFileSync(donor));
  const want=['iCCP','cICP','pHYs'];
  const add=D.filter(c=>want.includes(c.type)).map(c=>c.raw);
  const parts=[Buffer.from([137,80,78,71,13,10,26,10])];
  for(const c of S){
    if(c.type==='IHDR'){parts.push(c.raw);parts.push(...add);continue;}
    if(want.includes(c.type))continue;
    parts.push(c.raw);}
  fs.writeFileSync(out,Buffer.concat(parts));
  console.log('injected: '+add.map((_,i)=>D.filter(c=>want.includes(c.type))[i].type).join(','));
}
if(require.main===module)inject(process.argv[2],process.argv[3],process.argv[4]||process.argv[2]);
module.exports={inject,injectRaw};

// End-to-end check: render the demo config and confirm the output is a
// 1170x2532 PNG carrying the Display P3 profile.
const fs=require('fs'),path=require('path');
const {render}=require('../src/render');
const ROOT=path.join(__dirname,'..');

(async()=>{
  const cfg=JSON.parse(fs.readFileSync(path.join(ROOT,'out','demo.json'),'utf8'));
  const out=path.join(ROOT,'out','selftest.png');
  const r=await render(cfg,out);
  const b=fs.readFileSync(r.out);
  const types=[];
  let p=8;
  while(p<b.length){
    const len=b.readUInt32BE(p), t=b.toString('ascii',p+4,p+8);
    if(t!=='IDAT')types.push(t);
    if(t==='IEND')break;
    p+=len+12;
  }
  const size=b.readUInt32BE(16)+'x'+b.readUInt32BE(20);
  console.log('size      : '+size+(size==='1170x2532'?'  OK':'  WRONG'));
  console.log('chunks    : '+types.join(','));
  console.log('profile   : '+(types.includes('iCCP')&&types.includes('cICP')?'Display P3 OK':'MISSING'));
  console.log('emoji miss: '+r.missingEmoji.length);
})();

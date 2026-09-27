// node tools/render-cli.js <config.json> [out.png]
const path=require('path');
const {render}=require('../src/render');
const cfg=require(path.resolve(process.argv[2]));
const out=path.resolve(process.argv[3]||'out/render.png');
render(cfg,out).then(r=>{
  console.log('wrote '+r.out);
  if(r.missingEmoji.length)console.log('emoji not found: '+r.missingEmoji.join(' '));
}).catch(e=>{console.error(e.message);process.exit(1);});

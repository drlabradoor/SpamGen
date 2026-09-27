// src/pins.js against a scripted Pinterest: filtering, paging, the seen file and
// the two ways it gives up. No network, no bot.
const fs=require('fs'),path=require('path'),os=require('os');
process.env.SPAMGEN_PINS_SEEN=path.join(os.tmpdir(),'spamgen-pinsunit-seen.json');
try{fs.unlinkSync(process.env.SPAMGEN_PINS_SEEN);}catch(e){}
const DIR=path.join(os.tmpdir(),'spamgen-pinsunit-dir');
fs.rmSync(DIR,{recursive:true,force:true});
const fake=require('./fakepins');
const pins=require('../src/pins');

let fails=0;
function check(name,cond,detail){
  console.log((cond?'  ok   ':'  FAIL ')+name+(detail!=null&&!cond?'   <'+detail+'>':''));
  if(!cond)fails++;
}
const attempt=async fn=>{try{await fn();return null;}catch(e){return e;}};

(async()=>{
  console.log('--- filter');
  const sq={width:600,height:600};
  check('square pin passes',pins.usable({id:'a',images:{orig:sq}}));
  check('tall pin dropped',!pins.usable({id:'a',images:{orig:{width:600,height:900}}}));
  check('promoted pin dropped',!pins.usable({id:'a',is_promoted:true,images:{orig:sq}}));
  check('pin without images dropped',!pins.usable({id:'a'}));
  check('default list is the twelve from the spec',
    pins.QUERIES.length===12&&pins.QUERIES[0]==='аватарки для тг'&&pins.QUERIES[11]==='аватарки для девушек',
    pins.QUERIES.join(', '));

  console.log('--- paging and seen');
  let log=fake.install({pages:2,perPage:5});
  const got=[];
  for(let i=0;i<6;i++)got.push(await pins.next(['котики'],DIR));
  check('six distinct candidates',new Set(got.map(c=>c.id)).size===6,got.map(c=>c.id).join(' '));
  check('never a tall or promoted one',got.every(c=>!/-(1|3)$/.test(c.id)),got.map(c=>c.id).join(' '));
  check('second page asked with the bookmark',log.search.some(x=>x.bookmark==='bm1'),JSON.stringify(log.search));
  check('files downloaded into dir',got.every(c=>fs.existsSync(c.file)&&c.file.startsWith(DIR)));
  check('took the 474x size',log.images.every(u=>u.includes('/474x/')),log.images.join(' '));
  const saved=JSON.parse(fs.readFileSync(process.env.SPAMGEN_PINS_SEEN,'utf8'));
  check('every shown id is in the seen file',got.every(c=>saved.includes(c.id)),saved.length);
  let err=await attempt(()=>pins.next(['котики'],DIR));
  check('query ran dry -> empty',err&&err.code==='empty',err&&err.message);

  console.log('--- seen survives a restart');
  pins._reset();
  fake.install({pages:2,perPage:5});
  const again=[];
  err=await attempt(async()=>{for(let i=0;i<6;i++)again.push(await pins.next(['котики'],DIR));});
  check('nothing shown before comes back',again.every(c=>!got.some(g=>g.id===c.id)),again.map(c=>c.id).join(' '));
  check('and it says empty instead',err&&err.code==='empty',err&&err.message);

  console.log('--- several queries');
  pins._reset();
  log=fake.install({pages:1,perPage:5});
  for(let i=0;i<6;i++)await pins.next(['a','b'],DIR);
  check('six candidates need both queries',new Set(log.search.map(x=>x.query)).size===2,JSON.stringify(log.search));

  console.log('--- down');
  pins._reset();
  log=fake.install();log.mode='down';
  err=await attempt(()=>pins.next(['x'],DIR));
  check('HTTP error -> down',err&&err.code==='down',err&&err.message);
  log.mode='badjson';
  err=await attempt(()=>pins.next(['x'],DIR));
  check('HTML instead of JSON -> down',err&&err.code==='down',err&&err.message);
  pins._reset();
  log=fake.install({pages:5,perPage:5});log.mode='imgfail';
  err=await attempt(()=>pins.next(['y'],DIR));
  check('five failed downloads -> down',err&&err.code==='down'&&log.images.length===5,log.images.length);

  console.log(fails?'\n'+fails+' FAILED':'\nall green');
  process.exit(fails?1:0);
})();

// Stand-in for Pinterest: search answers from a script, images come back as
// small flat PNGs. It sits over globalThis.fetch, so the code under test still
// builds its real request and parses a real-shaped answer.
const fs=require('fs'),os=require('os'),path=require('path');
const {write}=require('./pngw');
const SEARCH='https://www.pinterest.com/resource/BaseSearchResource/get/';

function png(n){
  const f=path.join(os.tmpdir(),'spamgen-fakepin.png'),w=16,buf=Buffer.alloc(w*w*3);
  const c=[(n*97)%200+40,(n*57)%200+40,(n*151)%200+40];
  for(let i=0;i<w*w;i++){buf[i*3]=c[0];buf[i*3+1]=c[1];buf[i*3+2]=c[2];}
  write(f,w,w,buf);
  return fs.readFileSync(f);
}
const answer=(status,body)=>({ok:status>=200&&status<300,status,
  json:async()=>{if(typeof body==='string')throw new Error('not json');return body;},
  arrayBuffer:async()=>{const b=Buffer.isBuffer(body)?body:Buffer.from(String(body));
    return b.buffer.slice(b.byteOffset,b.byteOffset+b.length);}});

// Per page: index 1 is tall and index 3 is promoted — both must be filtered
// away — so a page carries perPage-2 usable pins.
function install(opts){
  opts=Object.assign({pages:3,perPage:5},opts);
  const log={search:[],images:[],mode:'ok'};
  globalThis.fetch=async url=>{
    url=String(url);
    if(url.startsWith(SEARCH)){
      const o=JSON.parse(new URL(url).searchParams.get('data')).options;
      const bm=(o.bookmarks||[])[0]||null;
      log.search.push({query:o.query,bookmark:bm});
      if(log.mode==='down')return answer(503,'down');
      if(log.mode==='badjson')return answer(200,'<html>');
      const pg=bm?+bm.replace('bm',''):0;
      const tag=Buffer.from(o.query).toString('hex').slice(0,8);
      const results=[];
      for(let i=0;i<opts.perPage;i++){
        const id=tag+'-'+pg+'-'+i,tall=i===1;
        results.push({id,type:'pin',is_promoted:i===3,images:{
          orig:{url:'https://i.pinimg.com/originals/'+id+'.jpg',width:600,height:tall?900:600},
          '474x':{url:'https://i.pinimg.com/474x/'+id+'.jpg',width:474,height:tall?711:474}}});
      }
      const bookmark=pg+1<opts.pages?'bm'+(pg+1):'-end-';
      return answer(200,{resource_response:{data:{results},bookmark}});
    }
    if(url.startsWith('https://i.pinimg.com/')){
      log.images.push(url);
      if(log.mode==='imgfail')return answer(404,'nope');
      return answer(200,png(log.images.length));
    }
    throw new Error('unexpected fetch '+url);
  };
  return log;
}
module.exports={install,SEARCH};

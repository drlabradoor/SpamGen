// Avatar candidates from Pinterest search. The official API has no public
// search — v5 /search/pins only covers the token owner's own pins and
// /search/partner/pins is a partners-only beta — so this calls the endpoint
// pinterest.com itself calls from the browser. It answers without a login or
// cookies (checked 2026-09-13). ru.pinterest.com fails the TLS handshake; only
// www works.
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
// Overridable so a test never marks the user's real history as seen.
const SEEN=process.env.SPAMGEN_PINS_SEEN||path.join(ROOT,'data','pins-seen.json');
const SEARCH='https://www.pinterest.com/resource/BaseSearchResource/get/';
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const PAGE_LIMIT=20;      // search pages one candidate may cost before giving up
const DOWNLOAD_LIMIT=5;   // failed image downloads in a row before calling it down

// People put anything on an avatar — cats, anime, paintings, a back to the
// camera — and a screen where every row is a face reads as a stock-photo fake.
const QUERIES=['аватарки для тг','аватарки аниме','котики аватарки','собаки аватарки',
  'эстетика аватарки','аватарки без лица','мемы аватарки','картины аватарка',
  'пейзаж аватарка','машины аватарка','аватарки для парней','аватарки для девушек'];

const fail=(code,msg)=>Object.assign(new Error(msg),{code});

// A pin shown once is never shown again, approved or not: the same face on two
// screenshots posted side by side gives both away.
let seen=null;
function seenSet(){
  if(!seen){try{seen=new Set(JSON.parse(fs.readFileSync(SEEN,'utf8')));}catch(e){seen=new Set();}}
  return seen;
}
function markSeen(id){
  seenSet().add(id);
  fs.mkdirSync(path.dirname(SEEN),{recursive:true});
  fs.writeFileSync(SEEN,JSON.stringify([...seen]));
}

// Per query: where its results continue, whether they ran out, and what the last
// page left unused. Memory only — after a restart the pages are fetched again
// and the seen file keeps them from repeating.
let Q={};
const qstate=query=>(Q[query]=Q[query]||{bookmark:null,done:false,buf:[]});

// Avatars are square; a tall pin cropped to a circle loses whatever made it
// worth pinning.
function usable(p){
  const o=p&&p.images&&p.images.orig;
  if(!p||!p.id||p.is_promoted||!o||!o.width||!o.height)return false;
  const r=o.height/o.width;
  return r>=0.87&&r<=1.15;
}

async function loadPage(query){
  const q=qstate(query);
  const options={query,scope:'pins',page_size:25};
  if(q.bookmark)options.bookmarks=[q.bookmark];
  const url=SEARCH+'?source_url=%2Fsearch%2Fpins%2F&data='+
    encodeURIComponent(JSON.stringify({options,context:{}}));
  let j;
  try{
    const r=await fetch(url,{headers:{'User-Agent':UA,Accept:'application/json',
      'X-Requested-With':'XMLHttpRequest','X-Pinterest-PWS-Handler':'www/search/[scope].js'}});
    if(!r.ok)throw new Error('HTTP '+r.status);
    j=await r.json();
  }catch(e){throw fail('down','search: '+e.message);}
  const rr=j&&j.resource_response;
  if(!rr||!rr.data||!Array.isArray(rr.data.results))throw fail('down','search: unexpected answer');
  // The last page carries "-end-" instead of a bookmark.
  q.bookmark=rr.bookmark&&rr.bookmark!=='-end-'?rr.bookmark:null;
  if(!q.bookmark)q.done=true;
  const s=seenSet();
  for(const p of rr.data.results)
    if(usable(p)&&!s.has(p.id)&&!q.buf.some(x=>x.id===p.id))
      q.buf.push({id:p.id,url:(p.images['474x']||p.images.orig).url});
}

// The next candidate from a random query of the list, downloaded into `dir` and
// already marked seen. Throws code 'down' when Pinterest does not answer and
// 'empty' when the queries have run dry.
async function next(queries,dir){
  let pages=0,fails=0;
  for(;;){
    const live=queries.filter(x=>{const q=qstate(x);return q.buf.length||!q.done;});
    if(!live.length)throw fail('empty','all queries exhausted');
    const query=live[Math.floor(Math.random()*live.length)];
    const q=qstate(query);
    if(!q.buf.length){
      if(++pages>PAGE_LIMIT)throw fail('empty','too many pages without a new pin');
      await loadPage(query);
      continue;
    }
    const c=q.buf.shift();
    if(seenSet().has(c.id))continue;          // another query showed it meanwhile
    const file=path.join(dir,'pin-'+c.id+'.jpg');
    try{
      const r=await fetch(c.url,{headers:{'User-Agent':UA}});
      if(!r.ok)throw new Error('HTTP '+r.status);
      fs.mkdirSync(dir,{recursive:true});
      fs.writeFileSync(file,Buffer.from(await r.arrayBuffer()));
    }catch(e){
      if(++fails>=DOWNLOAD_LIMIT)throw fail('down','image: '+e.message);
      continue;
    }
    markSeen(c.id);
    return {id:c.id,file};
  }
}

module.exports={next,usable,QUERIES,_reset:()=>{Q={};seen=null;}};

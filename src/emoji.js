const fs=require('fs'),path=require('path');
const DIR=path.join(__dirname,'..','assets','emoji');
const URL='https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/';
// Only sequences that actually render as emoji. Characters with default *text*
// presentation (\u2122 \u00A9 \u00AE and friends) stay text unless VS16 follows them \u2014
// substituting them pulls in Apple's dark glyph and the name turns black.
const BASE='(?:\\p{Emoji_Presentation}|\\p{Extended_Pictographic}\\uFE0F)';
const RE=new RegExp(
  '(?:[\\u{1F1E6}-\\u{1F1FF}]{2}|'+BASE+
  '(?:\\u200D'+BASE+'|[\\u{1F3FB}-\\u{1F3FF}]|\\uFE0F)*)','gu');

const cps=s=>[...s].map(c=>c.codePointAt(0));
function names(seq){
  const c=cps(seq);
  const noVS=c.filter(x=>x!==0xFE0F);
  const hex=a=>a.map(x=>x.toString(16).padStart(4,'0')).join('-');
  return [hex(noVS),hex(c)]; // try without FE0F first, then with
}
function find(seq){
  for(const n of names(seq)) if(fs.existsSync(path.join(DIR,n+'.png'))) return n;
  return null;
}
async function ensure(seq){
  if(find(seq))return find(seq);
  if(!fs.existsSync(DIR))fs.mkdirSync(DIR,{recursive:true});
  for(const n of names(seq)){
    try{
      const r=await fetch(URL+n+'.png');
      if(!r.ok)continue;
      const b=Buffer.from(await r.arrayBuffer());
      if(b.length<200||b[1]!==0x50)continue;
      fs.writeFileSync(path.join(DIR,n+'.png'),b);
      return n;
    }catch(e){}
  }
  return null;
}
// download every emoji used anywhere in cfg, before rendering
async function prefetch(cfg){
  const texts=[];
  const walk=v=>{if(typeof v==='string')texts.push(v);
    else if(Array.isArray(v))v.forEach(walk);
    else if(v&&typeof v==='object')Object.values(v).forEach(walk);};
  walk(cfg);
  const seqs=new Set();
  for(const t of texts) for(const m of t.matchAll(RE)) seqs.add(m[0]);
  const miss=[];
  for(const s of seqs){const n=await ensure(s);if(!n)miss.push(s);}
  return {found:seqs.size-miss.length,missing:miss};
}
// replace emoji runs with <img>, escaping is done by caller on the non-emoji parts
function markup(escaped){
  return escaped.replace(RE,m=>{
    const n=find(m);
    if(!n)return m;
    const BS=String.fromCharCode(92);
    const url=path.join(DIR,n+'.png').split(BS).join('/').replace(/^\/+/,'');
    return `<img class="em" src="file:///${url}">`;
  });
}
module.exports={prefetch,markup,ensure,find,RE};

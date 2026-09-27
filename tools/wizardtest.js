// Drives the per-person wizard (/add) with fake Telegram updates so it can be
// exercised without a live chat. Network calls are stubbed and recorded.
//
// The batch flow lives in flowtest.js; this one only guards the hand-built path.
// Both run against a throwaway state file so a bot that is live in Telegram
// keeps its sessions.
const fs=require('fs'),path=require('path'),os=require('os');
const ROOT=path.join(__dirname,'..');
process.env.SPAMGEN_TOKEN='0:test';
process.env.SPAMGEN_STATE=path.join(os.tmpdir(),'spamgen-wizardtest.json');
try{fs.unlinkSync(process.env.SPAMGEN_STATE);}catch(e){}

const sent=[];
const {TG}=require('../src/tg');
TG.prototype.call=async function(method,p){
  if(method==='getUpdates')return new Promise(()=>{});   // never resolves: poll parks
  sent.push(method+': '+(p.text||'').replace(/<[^>]+>/g,'')+
    (p.reply_markup?' ['+p.reply_markup.inline_keyboard.flat().map(b=>b.text).join(' | ')+']':''));
  return {message_id:sent.length};
};
TG.prototype.upload=async function(m){sent.push(m+' (file)');return {message_id:sent.length};};
TG.prototype.download=async function(id,dest){fs.writeFileSync(dest,Buffer.alloc(8));return dest;};

let handler=null;
TG.prototype.poll=async function(h){handler=h;};

require('../bot.js');

const CHAT=1;
const msg=text=>({message:{chat:{id:CHAT},text}});
const photo=()=>({message:{chat:{id:CHAT},photo:[{file_id:'f1'}]}});
const cb=data=>({callback_query:{id:'c',data,message:{chat:{id:CHAT},message_id:1}}});
const BANKDIR=path.join(ROOT,'assets','bank');

let fails=0;
function check(name,cond,detail){
  console.log((cond?'  ok   ':'  FAIL ')+name+(detail!=null&&!cond?'   <'+detail+'>':''));
  if(!cond)fails++;
}

(async()=>{
  const bankBefore=fs.readdirSync(BANKDIR);
  for(const u of [msg('/add'),msg('Артём'),msg('привет'),msg('14:32')])await handler(u);
  check('wizard reaches the avatar step',/Аватарка|Банк пуст/.test(sent[sent.length-1]),
    sent[sent.length-1]);

  await handler(cb('a:own'));
  check('asks for a photo',/Пришли фото/.test(sent[sent.length-1]),sent[sent.length-1]);

  await handler(photo());
  check('photo accepted',/Фото принято/.test(sent[sent.length-2]),sent[sent.length-2]);
  check('moves on to the flags',/Флаги/.test(sent[sent.length-1]),sent[sent.length-1]);

  await handler(cb('f:premium'));
  await handler(cb('f:done'));
  check('saved',/Готово, всего 1/.test(sent[sent.length-1]),sent[sent.length-1]);

  await handler(cb('x:add'));
  check('"Ещё" starts another one',/Имя\?/.test(sent[sent.length-1]),sent[sent.length-1]);

  const S=JSON.parse(fs.readFileSync(process.env.SPAMGEN_STATE,'utf8'));
  const row=S[CHAT].screen.rows[0];
  check('row stored on the screen',row&&row.name==='Артём',row&&row.name);
  check('time kept',row.time==='14:32',row&&row.time);
  check('own photo kept',!!row.photo,row&&row.photo);
  check('premium kept',row.premium===true,row&&row.premium);

  // The fake photo went into the real avatar bank; take it back out so the next
  // render does not draw an 8-byte JPEG as somebody's face.
  const added=fs.readdirSync(BANKDIR).filter(f=>!bankBefore.includes(f));
  for(const f of added)try{fs.unlinkSync(path.join(BANKDIR,f));}catch(e){}
  check('avatar bank left as it was',
    fs.readdirSync(BANKDIR).length===bankBefore.length,
    fs.readdirSync(BANKDIR).length+' vs '+bankBefore.length);

  console.log(fails?'\n'+fails+' FAILED':'\nall green');
  process.exit(fails?1:0);
})();

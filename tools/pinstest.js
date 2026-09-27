// The Pinterest avatar flow through the bot: the query list in /settings, the
// digit step of /new, approving candidates one by one, "🔎 Найти" in the card
// and a reroll that keeps approved faces. Telegram and Pinterest are stubbed;
// the renders are real.
//
// Own state, album, bank, status bank and seen file, so a bot that is live in
// Telegram keeps everything it has.
const fs=require('fs'),path=require('path'),os=require('os');
process.env.SPAMGEN_TOKEN='0:test';
const T=n=>path.join(os.tmpdir(),'spamgen-pinstest-'+n);
process.env.SPAMGEN_STATE=T('state.json');
process.env.SPAMGEN_ALBUM=T('album');
process.env.SPAMGEN_BANK=T('bank');
process.env.SPAMGEN_STATUS=T('status');
process.env.SPAMGEN_PINS_SEEN=T('seen.json');
process.env.SPAMGEN_ALBUM_MS='100';
for(const f of ['state.json','seen.json'])try{fs.unlinkSync(T(f));}catch(e){}
for(const d of ['album','bank','status']){
  fs.rmSync(T(d),{recursive:true,force:true});
  fs.mkdirSync(T(d),{recursive:true});
}

const fake=require('./fakepins');
const pinlog=fake.install({pages:50,perPage:5});

const sent=[];
let msgId=100;
const {TG}=require('../src/tg');
TG.prototype.call=async function(method,p){
  if(method==='getUpdates')return new Promise(()=>{});   // never resolves: poll parks
  const id=++msgId;
  sent.push({method,id,text:(p.text||'').replace(/<[^>]+>/g,''),
    kb:p.reply_markup?p.reply_markup.inline_keyboard.flat().map(b=>b.text):null});
  return {message_id:id};
};
TG.prototype.upload=async function(method,fields,field,file){
  const id=method==='editMessageMedia'?fields.message_id:++msgId;
  const caption=(fields.media&&fields.media.caption)||fields.caption||'';
  const rm=fields.reply_markup;
  sent.push({method,id,file,text:String(caption).replace(/<[^>]+>/g,''),
    kb:rm?rm.inline_keyboard.flat().map(b=>b.text):null});
  return {message_id:id};
};
const {write}=require('./pngw');
TG.prototype.download=async function(id,dest){
  const w=16;write(dest,w,w,Buffer.alloc(w*w*3,200));return dest;
};
let handler=null;
TG.prototype.poll=async function(h){handler=h;};

require('../bot.js');
const pins=require('../src/pins');

const CHAT=778;
const msg=text=>({message:{chat:{id:CHAT},text}});
const cb=(data,mid)=>({callback_query:{id:'c',data,message:{chat:{id:CHAT},message_id:mid==null?1:mid}}});
const photo=id=>({message:{chat:{id:CHAT},photo:[{file_id:id}]}});
const state=()=>JSON.parse(fs.readFileSync(process.env.SPAMGEN_STATE,'utf8'))[CHAT];
const last=()=>sent[sent.length-1];
const lastPhoto=()=>[...sent].reverse().find(x=>x.method==='sendPhoto'||x.method==='editMessageMedia');
const toMin=t=>{const m=/^(\d{1,2}):(\d{2})$/.exec(String(t||''));return m?+m[1]*60+ +m[2]:null;};
async function newScreen(names,texts,range){
  await handler(msg('/new'));await handler(msg(names));
  await handler(msg(texts));await handler(msg(range));
}

let fails=0;
function check(name,cond,detail){
  console.log((cond?'  ok   ':'  FAIL ')+name+(detail!=null&&!cond?'   <'+detail+'>':''));
  if(!cond)fails++;
}

(async()=>{
  console.log('--- queries in /settings');
  await handler(msg('/settings'));
  check('settings shows the query button',last().kb.some(x=>x==='🔎 Запросы (12)'),last().kb.join(' | '));
  await handler(cb('q:list'));
  check('list names every default query',
    /1\. аватарки для тг/.test(last().text)&&/12\. аватарки для девушек/.test(last().text),last().text);
  check('a delete button per query',last().kb.filter(x=>/^✖️ \d+$/.test(x)).length===12,last().kb.join(' | '));
  await handler(cb('q:0'));
  check('✖️ 1 removed the first',
    state().settings.queries.length===11&&state().settings.queries[0]==='аватарки аниме',
    JSON.stringify(state().settings.queries));
  check('the built-in list was not touched',pins.QUERIES.length===12&&pins.QUERIES[0]==='аватарки для тг');
  await handler(cb('q:add'));
  check('add asks for lines',/по одному в строке/.test(last().text),last().text);
  await handler(msg('ретро аватарки\nкотики аватарки\n\nретро аватарки'));
  const qs=state().settings.queries;
  check('adds only new lines, once each',qs.length===12&&qs.filter(x=>x==='ретро аватарки').length===1,JSON.stringify(qs));
  for(let i=qs.length-1;i>0;i--)await handler(cb('q:'+i));
  check('down to one query',state().settings.queries.length===1,state().settings.queries.length);
  await handler(cb('q:0'));
  check('the last query cannot go',
    state().settings.queries.length===1&&/Нужен хотя бы один запрос/.test(last().text),last().text);
  await handler(cb('q:add'));
  await handler(msg(pins.QUERIES.join('\n')));
  // The one left is «аватарки аниме», already among the defaults: 1 + 11 new.
  check('list restored',state().settings.queries.length===12,state().settings.queries.length);

  console.log('--- /new with a digit');
  await newScreen('Артём\nКирилл\nДарья','привет\nактуально?\nскинь реквизиты','09:00 21:00');
  check('step 4 offers digits 0..10',['0','5','10'].every(d=>last().kb&&last().kb.includes(d)),
    last().kb&&last().kb.join(' | '));
  check('and still takes an album',/альбом/.test(last().text),last().text);
  await handler(cb('n:3'));
  let s=state();
  check('screen built before picking',s.screen&&s.screen.rows.length>=9,s.screen&&s.screen.rows.length);
  check('screen is an auto one',s.src.mode==='auto',s.src.mode);
  check('three rows to pick',s.pick&&s.pick.rows.length===3,JSON.stringify(s.pick));
  check('rows go top to bottom',s.pick.rows.every((v,i,a)=>!i||v>a[i-1]),s.pick.rows.join(' '));
  let lp=lastPhoto();
  check('candidate captioned with the row and a counter',
    lp.text===s.screen.rows[s.pick.rows[0]].name+' · 1/3',lp.text);
  check('✅ ❌ ⏹ under it',['✅','❌','⏹ хватит'].every(b=>lp.kb&&lp.kb.includes(b)),lp.kb&&lp.kb.join(' | '));
  const im=require('./png').decode(lp.file);
  check('preview is the rendered row, 1170x228',im.w===1170&&im.h===228,im.w+'x'+im.h);

  const c1=s.pick.cand.id;
  await handler(cb('p:no',s.pick.msg));
  s=state();
  check('❌ brings another pin for the same row',s.pick.cand.id!==c1&&s.pick.i===0,s.pick.cand.id);
  check('❌ swaps the picture in place',lastPhoto().method==='editMessageMedia'&&lastPhoto().id===s.pick.msg);
  check('rejected file is gone',!fs.existsSync(path.join(T('album'),String(CHAT),'pin-'+c1+'.jpg')));
  await handler(cb('p:ok',s.pick.msg));
  s=state();
  check('✅ put the pin on that row',/pin-/.test(String(s.screen.rows[s.pick.rows[0]].photo)),
    s.screen.rows[s.pick.rows[0]].photo);
  check('on to the second row',s.pick.i===1&&/· 2\/3$/.test(lastPhoto().text),lastPhoto().text);

  console.log('--- stale button');
  await handler(cb('p:ok',99999));
  check('a button off another message does nothing',
    state().pick.i===1&&/Отбор уже закрыт/.test(last().text),last().text);
  await handler(cb('x:reroll'));
  check('reroll waits for the pick',/Сначала закончи отбор/.test(last().text),last().text);

  console.log('--- own photo mid-pick');
  await handler(photo('own-x'));
  s=state();
  check('sent photo lands on the current row',/own-/.test(String(s.screen.rows[s.pick.rows[1]].photo)),
    s.screen.rows[s.pick.rows[1]].photo);
  check('and the pick moves on',s.pick.i===2,s.pick.i);

  console.log('--- stop');
  const pickMsg=s.pick.msg;
  await handler(cb('p:stop',pickMsg));
  s=state();
  check('⏹ closes the pick',!s.pick,JSON.stringify(s.pick));
  check('exactly two rows wear photos',s.screen.rows.filter(r=>r.photo).length===2,
    s.screen.rows.filter(r=>r.photo).length);
  check('the screen replaced the candidate in place',
    s.preview===pickMsg&&lastPhoto().method==='editMessageMedia'&&lastPhoto().id===pickMsg);
  check('screen rendered',!!s.file&&fs.existsSync(s.file));

  console.log('--- full pick ends on its own');
  await newScreen('Артём','привет','10:00 12:00');
  await handler(cb('n:2'));
  for(let i=0;i<2;i++)await handler(cb('p:ok',state().pick.msg));
  s=state();
  check('two ✅ finish the pick',!s.pick&&s.screen.rows.filter(r=>r.photo).length===2,JSON.stringify(s.pick));
  const seenIds=JSON.parse(fs.readFileSync(T('seen.json'),'utf8'));
  check('every shown pin is in the seen file',seenIds.length>=5,seenIds.length);

  console.log('--- zero');
  await newScreen('Артём','привет','10:00 12:00');
  await handler(cb('n:0'));
  s=state();
  check('0 builds straight away, all initials',!s.pick&&!!s.file&&s.screen.rows.every(r=>!r.photo));
  check('0 is not an auto screen',s.src.mode!=='auto',s.src.mode);

  console.log('--- Pinterest down');
  await newScreen('Артём','привет','10:00 12:00');
  // Not 'down': earlier sections left pins buffered, which would be served
  // without asking search at all. Failing images reach 'down' either way.
  pinlog.mode='imgfail';
  await handler(cb('n:1'));
  check('says Pinterest is down',/Пинтерест не отвечает/.test(last().text),last().text);
  check('offers retry and initials',['🔁 ещё раз','🔤 остальным буквы'].every(b=>last().kb&&last().kb.includes(b)),
    last().kb&&last().kb.join(' | '));
  const errMsg=last().id;
  pinlog.mode='ok';
  await handler(cb('p:retry',errMsg));
  check('retry shows a candidate',!!(state().pick&&state().pick.cand),JSON.stringify(state().pick));
  await handler(cb('p:stop',state().pick.msg));
  check('stop builds the screen',!state().pick&&!!state().file);

  console.log('--- 🔎 in the card');
  await handler(cb('x:edit'));
  await handler(cb('l:0'));
  const before=state().screen.rows.map(r=>r.photo||null);
  await handler(cb('e:avatar'));
  check('card avatar offers 🔎 Найти',last().kb&&last().kb.includes('🔎 Найти'),last().kb&&last().kb.join(' | '));
  await handler(cb('a:find'));
  s=state();
  check('find opens a one-row pick for this row',
    s.pick&&s.pick.card===true&&s.pick.rows.length===1&&s.pick.rows[0]===0,JSON.stringify(s.pick));
  check('no counter on a card pick',lastPhoto().text===s.screen.rows[0].name,lastPhoto().text);
  await handler(cb('p:no',s.pick.msg));
  await handler(cb('p:ok',state().pick.msg));
  s=state();
  check('✅ changed that row only',/pin-/.test(String(s.screen.rows[0].photo))&&
    s.screen.rows.slice(1).every((r,i)=>(r.photo||null)===before[i+1]));
  check('back on the card',last().text.indexOf(s.screen.rows[0].name)===0&&last().kb.includes('🖼 аватар'),last().text);
  check('candidate message deleted',sent.some(x=>x.method==='deleteMessage'));
  const kept=s.screen.rows[0].photo;
  await handler(cb('e:avatar'));
  await handler(cb('a:find'));
  await handler(cb('p:stop',state().pick.msg));
  check('⏹ leaves the row as it was',!state().pick&&state().screen.rows[0].photo===kept);

  console.log('--- reroll keeps people and faces');
  await newScreen('Артём\nКирилл\nДарья','привет\nактуально?\nскинь','09:00 21:00');
  await handler(cb('n:4'));
  for(let i=0;i<4;i++)await handler(cb('p:ok',state().pick.msg));
  const A=state().screen;
  check('filler rows are marked',A.rows.filter(r=>r.filler).length===A.rows.length-3,
    A.rows.filter(r=>r.filler).length);
  const people=sc=>sc.rows.map(r=>[r.name,r.text,r.photo||'',!!r.filler].join('|')).sort();
  let moved=false;
  for(let i=1;i<=4;i++){
    await handler(cb('x:reroll'));
    const B=state().screen;
    check('reroll '+i+': same people, same faces',JSON.stringify(people(B))===JSON.stringify(people(A)));
    check('reroll '+i+': search bar frozen',B.chrome.search===A.chrome.search);
    check('reroll '+i+': user rows inside the range',
      B.rows.filter(r=>!r.filler).every(r=>toMin(r.time)>=540&&toMin(r.time)<=1260),
      B.rows.map(r=>r.time).join(' '));
    check('reroll '+i+': top row on the end of the range',B.rows[0].time==='21:00',B.rows[0].time);
    check('reroll '+i+': filler below the range',B.rows.filter(r=>r.filler).every(r=>toMin(r.time)<540));
    if(JSON.stringify(B.rows.map(r=>r.time))!==JSON.stringify(A.rows.map(r=>r.time)))moved=true;
  }
  check('times do reshuffle',moved);

  // ---- sections of later tasks go above this line ----
  console.log(fails?'\n'+fails+' FAILED':'\nall green');
  process.exit(fails?1:0);
})();

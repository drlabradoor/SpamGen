// Drives the batch flow end to end with fake Telegram updates: names, messages,
// time range, then the editor. Network calls are stubbed and recorded, but the
// render is real — the PNG at the end is the actual output.
//
// Runs against its own state file so a bot that is live in Telegram keeps its
// sessions.
const fs=require('fs'),path=require('path'),os=require('os');
const ROOT=path.join(__dirname,'..');
process.env.SPAMGEN_TOKEN='0:test';
process.env.SPAMGEN_STATE=path.join(os.tmpdir(),'spamgen-flowtest.json');
try{fs.unlinkSync(process.env.SPAMGEN_STATE);}catch(e){}
// Album and avatar bank are throwaway too. The bank stays empty on purpose: every
// photo on a /new screen has to come from the album, and an empty bank proves it.
process.env.SPAMGEN_ALBUM=path.join(os.tmpdir(),'spamgen-flowtest-album');
process.env.SPAMGEN_BANK=path.join(os.tmpdir(),'spamgen-flowtest-bank');
process.env.SPAMGEN_ALBUM_MS='100';
for(const d of [process.env.SPAMGEN_ALBUM,process.env.SPAMGEN_BANK]){
  try{fs.rmSync(d,{recursive:true,force:true});}catch(e){}
  fs.mkdirSync(d,{recursive:true});
}
// A throwaway status bank, seeded with two glyphs — one is not enough to tell a
// picker that honours the tap from one that ignores it. The real bank belongs to
// the user and a test has no business adding to it or deleting out of it.
process.env.SPAMGEN_STATUS=path.join(os.tmpdir(),'spamgen-flowtest-status');
try{fs.rmSync(process.env.SPAMGEN_STATUS,{recursive:true,force:true});}catch(e){}
fs.mkdirSync(process.env.SPAMGEN_STATUS,{recursive:true});
for(const hex of ['1f48e','1f525'])
  fs.copyFileSync(path.join(ROOT,'assets','emoji',hex+'.png'),
    path.join(process.env.SPAMGEN_STATUS,'u-'+hex+'.png'));

const sent=[],fetched=[];
let msgId=100;
const {TG}=require('../src/tg');
TG.prototype.call=async function(method,p){
  if(method==='getUpdates')return new Promise(()=>{});   // never resolves: poll parks
  // Stand-in for the sticker side of the API. "anim-*" ids answer as animated,
  // which is the case that has to fall back to the static thumbnail.
  if(method==='getCustomEmojiStickers')
    return p.custom_emoji_ids.map(id=>({custom_emoji_id:id,file_id:'file-'+id,
      type:'custom_emoji',is_animated:/^anim/.test(id),is_video:false,
      thumbnail:{file_id:'thumb-'+id}}));
  if(method==='getFile')return {file_path:'stickers/'+p.file_id+'.webp'};
  sent.push({method,text:(p.text||'').replace(/<[^>]+>/g,''),
    kb:p.reply_markup?p.reply_markup.inline_keyboard.flat().map(b=>b.text):null});
  return {message_id:++msgId};
};
TG.prototype.upload=async function(method,fields){
  sent.push({method,text:'(file)',kb:null});
  return {message_id:++msgId};
};
// A download hands back a real face from the user's avatar bank (read only) so
// the render looks like a real screen, or a flat-colour PNG when the bank is empty.
const {write}=require('./pngw');
const REAL=path.join(ROOT,'assets','bank');
const faces=fs.existsSync(REAL)?fs.readdirSync(REAL).filter(f=>/\.(png|jpe?g)$/i.test(f)):[];
TG.prototype.download=async function(id,dest){
  fetched.push(id);
  const n=fetched.length;
  if(faces.length){fs.copyFileSync(path.join(REAL,faces[n%faces.length]),dest);return dest;}
  const w=32,buf=Buffer.alloc(w*w*3),c=[(n*97)%200+40,(n*57)%200+40,(n*151)%200+40];
  for(let i=0;i<w*w;i++){buf[i*3]=c[0];buf[i*3+1]=c[1];buf[i*3+2]=c[2];}
  write(dest,w,w,buf);
  return dest;
};
let handler=null;
TG.prototype.poll=async function(h){handler=h;};

require('../bot.js');

const CHAT=777;
const msg=text=>({message:{chat:{id:CHAT},text}});
const cb=data=>({callback_query:{id:'c',data,message:{chat:{id:CHAT},message_id:1}}});
const state=()=>JSON.parse(fs.readFileSync(process.env.SPAMGEN_STATE,'utf8'))[CHAT];
const last=()=>sent[sent.length-1];
const photo=(id,group)=>({message:{chat:{id:CHAT},media_group_id:group,
  photo:[{file_id:id+'-thumb'},{file_id:id}]}});
const url=p=>'file:///'+p.split(path.sep).join('/');
const albumURL=url(process.env.SPAMGEN_ALBUM);
// The album closes on a timer, so the screen lands after the last photo's
// handler has already returned.
async function waitFor(cond,ms){
  const t0=Date.now();
  while(!cond()){if(Date.now()-t0>(ms||20000))return false;await new Promise(r=>setTimeout(r,50));}
  return true;
}

let fails=0;
function check(name,cond,detail){
  console.log((cond?'  ok   ':'  FAIL ')+name+(detail!=null&&!cond?'   <'+detail+'>':''));
  if(!cond)fails++;
}
const toMin=t=>{const m=/^(\d{1,2}):(\d{2})$/.exec(String(t||''));return m?+m[1]*60+ +m[2]:null;};

(async()=>{
  console.log('--- batch flow');
  await handler(msg('/new'));
  check('/new asks for names',/Имена/.test(last().text),last().text);

  await handler(msg('Артём\nКирилл\nДарья\nМаксим'));
  check('names accepted, asks for messages',/сообщения/i.test(last().text),last().text);

  await handler(msg('привет!\nактуально ещё?\nскинь реквизиты'));
  check('messages accepted, asks for range',/Диапазон/.test(last().text),last().text);

  await handler(msg('09:00 21:00'));
  check('range accepted, asks for an album',/альбом/.test(last().text),last().text);
  check('album step offers digits',last().kb&&['0','10'].every(d=>last().kb.includes(d)),
    last().kb&&last().kb.join(' | '));

  for(let i=0;i<3;i++)await handler(photo('p'+i,'g1'));
  check('album built the screen',await waitFor(()=>state().file),JSON.stringify(state().input));
  const s=state(), rows=s.screen.rows;
  fs.copyFileSync(s.file,path.join(ROOT,'out','flowtest-album.png'));

  console.log('--- screen');
  check('warned about the short message block',
    sent.some(x=>/добрал 1 из встроенных/.test(x.text)));
  check('four rows came from the user',s.screen.userRows===4,s.screen.userRows);
  check('list runs off the bottom (9 or 10 rows)',rows.length===9||rows.length===10,rows.length);
  check('newest row pinned to the end of the range',rows[0].time==='21:00',rows[0].time);
  check('oldest user row pinned to the start',rows[3].time==='09:00',rows[3].time);

  const mins=rows.map(r=>toMin(r.time));
  check('times never go back up',mins.every((v,i)=>i===0||v<=mins[i-1]),mins.join(' '));
  check('filler is older than the range',mins.slice(4).every(v=>v<540),mins.slice(4).join(' '));

  const userBadges=rows.slice(0,4).map(r=>+r.badge);
  check('every user row is unread, 1..3',
    userBadges.every(b=>b>=1&&b<=3),userBadges.join(' '));
  check('filler is mixed, not all unread',
    rows.slice(4).some(r=>r.check),JSON.stringify(rows.slice(4).map(r=>r.badge||('ck'+r.check))));

  check('status bar clock locked',s.screen.chrome.timeLocked===true);
  check('tab badge baked in',typeof s.screen.tab.chats==='number',s.screen.tab.chats);
  check('a picture was sent',sent.some(x=>x.method==='sendPhoto'));

  console.log('--- album');
  const pics=rows.map(r=>r.photo).filter(Boolean);
  check('three rows wear the three photos',pics.length===3,pics.length);
  check('no photo used twice',new Set(pics).size===3,pics.join(' '));
  check('photos come from the album',pics.every(p=>p.startsWith(albumURL)),pics.join(' '));
  check('took the biggest size of each',
    ['p0','p1','p2'].every(x=>fetched.includes(x))&&!fetched.includes('p0-thumb'),fetched.join(' '));
  check('said how many went to initials',
    sent.some(x=>x.text.includes('Фото 3 на '+rows.length+' строк')),rows.length);

  console.log('--- freeze: a second render must be the same file');
  const file=path.join(ROOT,'out','bot-'+CHAT+'.png');
  const a=fs.readFileSync(file);
  await handler(cb('x:render'));
  const b=fs.readFileSync(file);
  check('render is reproducible',a.equals(b),a.length+' vs '+b.length);
  check('preview edited in place, not resent',
    sent.filter(x=>x.method==='editMessageMedia').length>=1);

  console.log('--- editor');
  await handler(cb('x:edit'));
  check('list shows every row',last().kb.length===state().screen.rows.length+2,
    last().kb&&last().kb.length);
  await handler(cb('l:1'));
  check('card opened on the right person',last().text.indexOf(rows[1].name)===0,last().text);

  await handler(cb('e:mute'));
  check('mute stuck',state().screen.rows[1].mute===true);

  // The status bar clock follows the newest row on every render, including a
  // time typed by hand without the leading zero.
  const {buildHTML}=require('../src/render');
  const clockOf=scr=>{
    const h=buildHTML(require('../src/model').normalize(scr));
    return [/<b>([^<]*)<\/b>/.exec(h)[1],/class="tm">([^<]*)</.exec(h)[1]];
  };
  let [clk,top]=clockOf(state().screen);
  check('clock equals the newest row',clk===top&&clk==='21:00',clk+' vs '+top);
  await handler(cb('e:time'));
  await handler(msg('23:07'));
  check('edited time stored',state().screen.rows[1].time==='23:07',state().screen.rows[1].time);
  [clk,top]=clockOf(state().screen);
  check('clock moved with the edited row',clk==='23:07'&&top==='23:07',clk+' vs '+top);
  await handler(cb('e:time'));
  await handler(msg('9:05'));
  check('hand-typed time padded',state().screen.rows[1].time==='09:05',state().screen.rows[1].time);
  [clk,top]=clockOf(state().screen);
  check('clock back on the top row',clk===top&&clk==='21:00',clk+' vs '+top);
  const wasPrem=!!state().screen.rows[1].premium;
  await handler(cb('e:premium'));
  check('premium toggled and is hand-locked',
    !!state().screen.rows[1].premium===!wasPrem&&state().screen.rows[1].premiumLocked===true,
    wasPrem+' -> '+state().screen.rows[1].premium);
  if(wasPrem)await handler(cb('e:premium'));   // back on, so the status test has something to hang on

  await handler(cb('e:avatar'));
  check('card avatar offers no bank',last().kb&&!last().kb.some(x=>/банк/i.test(x)),
    last().kb&&last().kb.join(' | '));
  await handler(cb('a:own'));
  await handler(photo('own1'));
  const own=state().screen.rows[1].photo;
  check('own photo goes to the album, not the bank',!!own&&own.startsWith(albumURL),own);

  await handler(cb('x:render'));
  const c=fs.readFileSync(file);
  check('edit changed the picture',!a.equals(c),c.length);

  console.log('--- status bank');
  const status=require('../src/status');
  const had=status.count();
  await handler(cb('l:1'));
  await handler(cb('e:status'));
  check('status button opens a picker, not a blind cycle',
    last().kb&&last().kb.some(x=>/убрать/.test(x))&&last().kb.some(x=>/💎/.test(x)),
    last().kb&&last().kb.join(' | '));
  await handler(cb('t:0'));
  const picked=state().screen.rows[1].status;
  check('picked exactly the glyph that was tapped',
    !!picked&&picked.endsWith(status.list()[0]),picked);
  check('card now names the status',last().kb.some(x=>/статус: 💎/.test(x)),
    last().kb.join(' | '));
  await handler(cb('e:status'));
  await handler(cb('t:x'));
  check('"убрать" clears it',!state().screen.rows[1].status,state().screen.rows[1].status);
  await handler(cb('e:status'));
  await handler(cb('t:1'));
  check('second glyph picks the second file',
    String(state().screen.rows[1].status).endsWith(status.list()[1]),state().screen.rows[1].status);
  await handler(cb('e:status'));
  await handler(cb('t:new'));
  check('"новый" asks for an emoji',/Пришли эмодзи/.test(last().text),last().text);
  await handler(msg('❤️‍🔥'));
  check('the sent emoji went straight onto the row',
    /2764/.test(String(state().screen.rows[1].status)),state().screen.rows[1].status);
  check('and landed in the bank too',
    status.list().some(f=>/2764/.test(f)),status.list().join(' '));
  await handler(cb('x:render'));
  check('renders with a status emoji',fs.existsSync(file));

  console.log('--- reroll');
  await handler(cb('x:reroll'));
  const re=state();
  check('reroll reuses the same album',
    JSON.stringify(re.screen.rows.map(r=>r.photo).filter(Boolean).sort())===
    JSON.stringify(re.src.album.map(url).sort()),re.screen.rows.map(r=>r.photo).filter(Boolean).length);

  console.log('--- /addstatus');
  const bankDir=status.dir();
  const before=status.count();
  await handler(msg('/addstatus'));
  check('addstatus waits for emoji',/банке/i.test(last().text),last().text);
  // One unicode emoji and two custom ones — a static and an animated, which is
  // the pair that decides whether the thumbnail fallback works.
  await handler({message:{chat:{id:CHAT},text:'🚀 aa bb',
    entities:[{type:'custom_emoji',offset:3,length:2,custom_emoji_id:'flow1'},
              {type:'custom_emoji',offset:6,length:2,custom_emoji_id:'animflow2'}]}});
  check('all three landed',/Добавил 3/.test(last().text),last().text);
  check('unicode became an Apple png',fs.existsSync(path.join(bankDir,'u-1f680.png')));
  check('static custom saved as webp',fs.existsSync(path.join(bankDir,'c-flow1.webp')));
  check('animated custom saved too',fs.existsSync(path.join(bankDir,'c-animflow2.webp')));
  check('static custom pulled the sticker itself',fetched.includes('file-flow1'),fetched.join(' '));
  check('animated custom fell back to the thumbnail',
    fetched.includes('thumb-animflow2')&&!fetched.includes('file-animflow2'),fetched.join(' '));
  check('bank grew by three',status.count()===before+3,status.count()+' vs '+before);

  console.log('--- settings');
  await handler(msg('/settings'));
  check('settings keyboard shows',last().kb&&last().kb.some(x=>/Премиум/.test(x)),
    last().kb&&last().kb.join(' | '));
  await handler(cb('s:premium'));
  check('premium cycled 20 -> 30',state().settings.premium===30,state().settings.premium);
  await handler(cb('s:search'));
  check('search cycled random -> on',state().settings.search==='on',state().settings.search);

  console.log('--- guards');
  await handler(msg('/new'));
  await handler(msg('Один'));
  await handler(msg('привет'));
  await handler(msg('21:00 09:00'));
  check('backwards range refused',/Конец раньше начала/.test(last().text),last().text);
  await handler(msg('09:00 21:00'));
  await handler(msg('а фото?'));
  check('text at the album step asks for the album again',/альбом/.test(last().text),last().text);
  await handler(cb('n:0'));
  check('single name sits on the end of the range',
    state().screen.rows[0].time==='21:00',state().screen.rows[0].time);
  check('"0" leaves every row on initials',state().screen.rows.every(r=>!r.photo),
    state().screen.rows.filter(r=>r.photo).length);

  console.log('--- full album');
  await handler(msg('/new'));
  await handler(msg('Артём\nКирилл'));
  await handler(msg('привет'));
  await handler(msg('10:00 12:00'));
  for(let i=0;i<11;i++)await handler(photo('q'+i,'g2'));
  check('full album built the screen',await waitFor(()=>state().file));
  const full=state().screen.rows.map(r=>r.photo);
  check('ten photos cover every row',full.every(Boolean),full.filter(Boolean).length+' of '+full.length);
  check('and no face repeats',new Set(full).size===full.length);
  check('eleventh photo refused, and said so',sent.some(x=>/Фото 11, взял первые 10/.test(x.text)));
  check('avatar bank untouched',fs.readdirSync(process.env.SPAMGEN_BANK).length===0,
    fs.readdirSync(process.env.SPAMGEN_BANK).join(' '));

  console.log(fails?'\n'+fails+' FAILED':'\nall green');
  process.exit(fails?1:0);
})();

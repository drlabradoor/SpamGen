const fs=require('fs'),path=require('path');
const {TG}=require('./src/tg');
const {render,renderRow}=require('./src/render');
const {randomRows,spreadTimes,applyPremium,normalize,toHHMM,toMin,fitRows}=require('./src/model');
const status=require('./src/status');
const pins=require('./src/pins');

const ROOT=__dirname;
// Overridable for the same reason as STATE below: a test must never be able to
// reach into the real avatar bank.
const BANK=process.env.SPAMGEN_BANK||path.join(ROOT,'assets','bank');
// Overridable so wizardtest can drive the bot without trampling the sessions of
// a bot that is actually running.
const STATE=process.env.SPAMGEN_STATE||path.join(ROOT,'data','sessions.json');
const OUT=path.join(ROOT,'out');
// Photos for the screen being built, one folder per chat. The bank is out of the
// /new flow: a screen takes its faces from the album sent with it. Overridable
// like BANK, so a test never writes into the real one.
const ALBUM=process.env.SPAMGEN_ALBUM||path.join(ROOT,'data','album');
const albumDir=chat=>path.join(ALBUM,String(chat));
// Telegram delivers an album as one message per photo, and nothing marks the
// last one: the album counts as complete once no photo has come in for this long.
const ALBUM_MS=+process.env.SPAMGEN_ALBUM_MS||2000;
const ALBUM_MAX=10;               // the most one Telegram album can hold
const albumTimers={};

function token(){
  // bothost fills BOT_TOKEN / TELEGRAM_BOT_TOKEN from its panel on its own.
  const env=process.env.SPAMGEN_TOKEN||process.env.TELEGRAM_BOT_TOKEN||process.env.BOT_TOKEN;
  if(env)return env.trim();
  const f=path.join(ROOT,'.env');
  if(fs.existsSync(f)){
    const m=/SPAMGEN_TOKEN\s*=\s*(\S+)/.exec(fs.readFileSync(f,'utf8'));
    if(m)return m[1];
  }
  console.error('No bot token. Put SPAMGEN_TOKEN=... in .env or the environment.');
  process.exit(1);
}
const tg=new TG(token());

let S={};
try{S=JSON.parse(fs.readFileSync(STATE,'utf8'));}catch(e){}
const save=()=>fs.writeFileSync(STATE,JSON.stringify(S));
const st=id=>(S[id]=S[id]||{screen:null,input:null,src:null,draft:null,step:null});

const rand=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const pick=a=>a[Math.floor(Math.random()*a.length)];
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]];}return a;};
const esc=s=>String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

const NAMES=['Артём','Кирилл','Дарья','Максим','Никита','Алина','Егор','Виктория','Роман','Полина'];
// Twelve of them, because a full screen is ten rows and randomRows draws without
// replacement: eight would force a repeat, and a preview line showing up twice on
// one screen is the loudest tell a fake chat list has.
const TEXTS=['привет, актуально ещё?','скинь реквизиты пожалуйста','когда сможешь созвониться?',
 'спасибо, всё получилось','я готов начать','подскажите по условиям','отправил на почту','ок, понял',
 'добрый день, вы на связи?','можно подробнее про условия?','хорошо, жду',
 'сколько по времени займёт?'];

const bankFiles=()=>fs.existsSync(BANK)?fs.readdirSync(BANK).filter(f=>/\.(jpg|jpeg|png)$/i.test(f)):[];
const fileURL=p=>'file:///'+p.split(path.sep).join('/').replace(/^\/+/,'');

// ---------------------------------------------------------------- settings ---
// Every knob the screen randomises, one per row of the keyboard. Percentages
// rather than counts, so the same number works whether the list is nine rows or
// ten.
const DEF={search:'random',premium:20,status:60,badge:'1-3',fill:true,photo:75,queries:pins.QUERIES};
const CYCLE={search:['random','on','off'],premium:[0,10,20,30,50,100],
  status:[0,20,40,60,80,100],badge:['1-3','1-5','1-9'],fill:[true,false],photo:[50,75,100]};
const opts=s=>{
  s.settings=Object.assign({},DEF,s.settings);
  // A chat edits its own copy; the default list is shared by every other chat.
  if(s.settings.queries===DEF.queries)s.settings.queries=DEF.queries.slice();
  return s.settings;
};
const SEARCH_L={random:'🎲 рандом',on:'✅ есть',off:'❌ нет'};
function setKb(o){
  return [[{text:'Поисковая строка: '+SEARCH_L[o.search],callback_data:'s:search'}],
    [{text:'Премиум '+o.premium+'%',callback_data:'s:premium'},
     {text:'Статус из банка '+o.status+'%',callback_data:'s:status'}],
    [{text:'Непрочитанных '+o.badge,callback_data:'s:badge'},
     {text:'Фото в /random '+o.photo+'%',callback_data:'s:photo'}],
    [{text:'Автодобор до низа '+(o.fill?'✅':'❌'),callback_data:'s:fill'}],
    [{text:'🔎 Запросы ('+o.queries.length+')',callback_data:'q:list'}]];
}
function queriesKb(o){
  const kb=[];
  for(let i=0;i<o.queries.length;i+=4)
    kb.push(o.queries.slice(i,i+4).map((_,j)=>({text:'✖️ '+(i+j+1),callback_data:'q:'+(i+j)})));
  kb.push([{text:'➕ добавить',callback_data:'q:add'},{text:'⬅️ назад',callback_data:'q:back'}]);
  return kb;
}
const queriesText=o=>'<b>Запросы для аватарок</b>\n'+o.queries.map((x,i)=>(i+1)+'. '+esc(x)).join('\n');

// ------------------------------------------------------------ screen build ---
function assignAvatars(rows,photoPct){
  const pool=bankFiles().slice();
  for(let i=pool.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[pool[i],pool[j]]=[pool[j],pool[i]];}
  let k=0;
  const take=()=>k<pool.length?fileURL(path.join(BANK,pool[k++])):null;
  for(const r of rows){
    if(r.photo)continue;              // own photo, chosen in the editor
    if(r.letter)continue;             // initials on a gradient, chosen explicitly
    if(r.wantBank){r.photo=take()||undefined;continue;}
    if(Math.random()*100<photoPct)r.photo=take()||undefined;
  }
  return rows;
}

// The /new flow: album photos go to random rows, one per row, filler included.
// Ten cover the whole screen; with fewer, the rows left over draw initials,
// which is what a row without a photo renders anyway.
function assignAlbum(rows,album){
  const pics=shuffle(album.map(fileURL));
  shuffle(rows.slice()).slice(0,pics.length).forEach((r,k)=>{r.photo=pics[k];});
  return rows;
}

// The draw is 75/25, so a filler of five comes out unread all the way down
// about a quarter of the time — and a column of identical blue badges from
// top to bottom is exactly the stamped look the mix exists to break.
function mixFiller(filler){
  if(filler.length>2&&!filler.some(r=>r.check)){
    const v=filler[rand(1,filler.length-1)];
    delete v.badge;v.check=Math.random()<0.6?2:1;
  }
  return filler;
}

// Turn what the user typed into a whole screen, once. Everything random is
// decided here and then frozen into state: rendering the same screen twice has
// to produce the same file, otherwise the editor would be pointless — you would
// fix one person and find nine strangers around them.
function buildScreen(s,warn){
  const o=opts(s), src=s.src;
  const search=o.search==='random'?Math.random()<0.5:o.search==='on';
  const cap=fitRows({chrome:{search}});
  const [lo,hi]=o.badge.split('-').map(Number);

  let names=src.names.slice(), texts=src.texts.slice();
  if(names.length>cap){
    warn.push('Имён '+names.length+', на экран влезает '+cap+' — нижние '+(names.length-cap)+' обрезал.');
    names=names.slice(0,cap);
  }
  if(texts.length>names.length){
    warn.push('Сообщений '+texts.length+' на '+names.length+' имён — лишние отбросил.');
    texts=texts.slice(0,names.length);
  }else if(texts.length<names.length){
    const had=texts.length, need=names.length-had;
    const free=TEXTS.filter(x=>!texts.includes(x));
    for(let i=0;i<need;i++)
      texts.push(free.length?free.splice(Math.floor(Math.random()*free.length),1)[0]:pick(TEXTS));
    warn.push('Сообщений '+had+' на '+names.length+' имён — добрал '+need+' из встроенных.');
  }

  const times=spreadTimes(names.length,src.start,src.end);
  // Every row the user typed is unread — that is the whole point of the screen.
  const rows=names.map((n,i)=>({name:n,text:texts[i],time:toHHMM(times[i]),badge:String(rand(lo,hi))}));

  // A real chat list never ends inside the screen: it runs off the bottom edge,
  // and the row half-swallowed by the tab bar is what says there is more below.
  if(o.fill){
    const need=cap-rows.length;
    if(need>0){
      // The filler must not draw a line the user already typed: the same preview
      // twice on one screen is the loudest tell there is, and it does not care
      // that one copy came from the user and the other from the built-in list.
      const pool=TEXTS.filter(x=>!texts.includes(x));
      const filler=randomRows(need,NAMES,pool.length?pool:TEXTS,src.start,rows.map(r=>r.name),lo,hi);
      mixFiller(filler).forEach(r=>{r.filler=true;});
      rows.push(...filler);
    }
  }
  applyPremium(rows,o.premium,o.status,status.pick);
  const album=src.album||[];
  assignAlbum(rows,album);
  if(album.length&&album.length<rows.length)
    warn.push('Фото '+album.length+' на '+rows.length+' строк — '+(rows.length-album.length)+' буквами.');

  // normalize() decides the status-bar clock and the tab badge from the rows;
  // baking it in now is what makes the screen reproducible.
  const baked=normalize({chrome:{battery:rand(20,89),charging:false,search},rows,tab:{}});
  baked.chrome.timeLocked=true;
  baked.userRows=names.length;
  return baked;
}

// An auto screen's faces were matched to their people by hand, so a reroll
// keeps who is on the screen — name, message, face — and redraws only what the
// same list would show differently an hour later. The search bar stays too:
// with it the screen holds nine rows instead of ten, and an approved row would
// fall off the bottom.
function reshuffle(s){
  const o=opts(s),src=s.src,old=s.screen;
  const [lo,hi]=o.badge.split('-').map(Number);
  const keep=r=>{
    const n={name:r.name,text:r.text};
    if(r.photo)n.photo=r.photo;
    if(r.letter)n.letter=true;
    if(r.filler)n.filler=true;
    if(r.premiumLocked){n.premiumLocked=true;if(r.premium)n.premium=true;if(r.status)n.status=r.status;}
    return n;
  };
  const mine=old.rows.filter(r=>!r.filler).map(keep);
  const extra=old.rows.filter(r=>r.filler).map(keep);
  const times=spreadTimes(mine.length,src.start,src.end);
  mine.forEach((r,i)=>{r.time=toHHMM(times[i]);r.badge=String(rand(lo,hi));});
  const fresh=randomRows(extra.length,NAMES,TEXTS,src.start,[],lo,hi);
  extra.forEach((r,i)=>{for(const f of ['time','badge','check','online'])if(fresh[i][f]!=null)r[f]=fresh[i][f];});
  mixFiller(extra);
  const rows=[...mine,...extra];
  applyPremium(rows,o.premium,o.status,status.pick);
  const baked=normalize({chrome:{battery:rand(20,89),charging:false,search:old.chrome.search},rows,tab:{}});
  baked.chrome.timeLocked=true;
  baked.userRows=old.userRows;
  return baked;
}

// ------------------------------------------------------------- keyboards ----
const mainKb=()=>[[{text:'✏️ Редактировать',callback_data:'x:edit'},{text:'📄 PNG',callback_data:'x:png'}],
  [{text:'🎲 Пересобрать',callback_data:'x:reroll'},{text:'🆕 Новый',callback_data:'x:new'}]];

function listKb(s){
  const kb=s.screen.rows.map((r,i)=>[{callback_data:'l:'+i,
    text:(i<(s.screen.userRows||0)?'':'· ')+(i+1)+'. '+r.name+
      (r.status?' 😀':r.premium?' ⭐':'')+'  '+r.time}]);
  kb.push([{text:'⬅️ Назад',callback_data:'x:back'},{text:'🖼 Собрать',callback_data:'x:render'}]);
  return kb;
}

// What the row is wearing right now, shown on the button itself — cycling
// blindly through the bank and only finding out after a render is not a choice.
function statusName(r){
  if(!r.status)return r.premium?'⭐ звезда':'нет';
  const f=path.basename(String(r.status));
  const l=status.label(f);
  if(l)return l;
  const i=status.list().indexOf(f);
  return 'кастом '+(i<0?'?':i+1);
}

// One button per glyph in the bank. Unicode ones show themselves; a custom emoji
// cannot be drawn on a button (that needs Premium, and bots have none), so it is
// numbered instead.
function statusKb(r){
  const bank=status.list(),kb=[];
  const cur=r.status?path.basename(String(r.status)):null;
  for(let i=0;i<bank.length;i+=4)
    kb.push(bank.slice(i,i+4).map((f,j)=>({
      text:(f===cur?'✅ ':'')+(status.label(f)||('кастом '+(i+j+1))),
      callback_data:'t:'+(i+j)})));
  kb.push([{text:'✖️ убрать',callback_data:'t:x'},{text:'➕ новый',callback_data:'t:new'},
           {text:'⬅️ назад',callback_data:'t:back'}]);
  return kb;
}

function cardKb(r){
  return [
    [{text:(r.premium?'✅ ':'')+'⭐ прем',callback_data:'e:premium'},
     {text:(r.online?'✅ ':'')+'🟢 онлайн',callback_data:'e:online'}],
    [{text:(r.mute?'✅ ':'')+'🔇 мьют',callback_data:'e:mute'},
     {text:(r.pin?'✅ ':'')+'📌 закреп',callback_data:'e:pin'}],
    [{text:'😀 статус: '+statusName(r),callback_data:'e:status'},
     {text:r.badge?'🔵 '+r.badge:'🔵 бейдж',callback_data:'e:badge'},
     {text:r.check===2?'✓✓ прочитано':r.check===1?'✓ отправлено':'✓ галочка',callback_data:'e:check'}],
    [{text:'🖼 аватар',callback_data:'e:avatar'},{text:'✏️ имя',callback_data:'e:name'},
     {text:'💬 текст',callback_data:'e:text'},{text:'🕒 время',callback_data:'e:time'}],
    [{text:'⬅️ к списку',callback_data:'x:edit'},{text:'🖼 Собрать',callback_data:'x:render'}]];
}
const cardText=r=>'<b>'+esc(r.name)+'</b>\n'+esc(r.text||'')+'\n'+esc(r.time||'');

// legacy per-person wizard, kept under /add
const FLAGS=[['premium','⭐ премиум'],['online','🟢 онлайн'],['mute','🔇 мьют'],['pin','📌 закреп']];
function flagKb(d){
  const row=FLAGS.map(([k,l])=>({text:(d[k]?'✅ ':'')+l,callback_data:'f:'+k}));
  return [[row[0],row[1]],[row[2],row[3]],
    [{text:(d.badge?'🔵 '+d.badge:'непрочитанных'),callback_data:'f:badge'},
     {text:(d.check===2?'✓✓ прочитано':d.check===1?'✓ отправлено':'галочка'),callback_data:'f:check'}],
    [{text:'💾 Сохранить',callback_data:'f:done'}]];
}
// The bank is offered only to the legacy /add wizard; a /new screen takes its
// faces from its own album.
function avaKb(withBank){
  const n=withBank?bankFiles().length:0;
  const kb=[];
  if(n)kb.push([{text:'🎲 Из банка ('+n+')',callback_data:'a:bank'}]);
  // Only a row of a built screen can be searched for; /add has no row yet.
  if(!withBank)kb.push([{text:'🔎 Найти',callback_data:'a:find'}]);
  kb.push([{text:'📷 Своё фото',callback_data:'a:own'},{text:'🔤 Буква',callback_data:'a:letter'}]);
  return kb;
}

const HELP=`<b>SpamGen</b>
/new — новый экран: имена → сообщения → диапазон времени → аватарки (цифрой с Пинтереста или альбомом)
/add — добавить одного человека пошагово
/edit — список людей на экране
/render — собрать
/random — экран целиком случайными
/settings — настройки рандома
/addava — банк аватарок для /add и /random (потом просто шли фото)
/addstatus — банк премиум-статусов (шли эмодзи, можно кастомные)
/reset — сбросить`;

async function ask(chat,s){
  if(s.step==='name')return tg.send(chat,'Имя?');
  if(s.step==='text')return tg.send(chat,'Сообщение?');
  if(s.step==='time')return tg.send(chat,'Время? (например 14:32, или «-» чтобы подставить само)');
  if(s.step==='avatar'){
    const n=bankFiles().length;
    return tg.send(chat,(n?'Аватарка для <b>':'Банк пуст. Аватарка для <b>')+esc(s.draft.name)+'</b>:',avaKb(true));
  }
  if(s.step==='flags')return tg.send(chat,'Флаги для <b>'+esc(s.draft.name)+'</b>:',flagKb(s.draft));
}

// ---------------------------------------------------------------- render ----
async function doRender(chat,s,note){
  if(!s.screen||!s.screen.rows.length)return tg.send(chat,'Пусто. /new');
  const file=path.join(OUT,'bot-'+chat+'.png');
  try{
    const r=await render(s.screen,file);
    // One picture per screen: the editor replaces it in place instead of stacking
    // a fresh render into the chat on every tweak.
    let edited=false;
    if(s.preview){
      try{await tg.editMedia(chat,s.preview,r.out,note||'',mainKb());edited=true;}
      catch(e){}
    }
    if(!edited){
      const msg=await tg.photo(chat,r.out,note||'');
      s.preview=msg&&msg.message_id;
      await tg.send(chat,'Готово',mainKb());
    }
    s.file=r.out;save();
    if(r.missingEmoji.length)await tg.send(chat,'Не нашёл эмодзи: '+r.missingEmoji.join(' '));
  }catch(e){await tg.send(chat,'Ошибка рендера: '+e.message);}
}

async function rebuild(chat,s){
  const warn=[];
  s.screen=s.src.mode==='auto'&&s.screen?reshuffle(s):buildScreen(s,warn);
  save();
  if(warn.length)await tg.send(chat,warn.join('\n'));
  return doRender(chat,s);
}

const countKb=()=>[[0,1,2,3,4,5].map(n=>({text:String(n),callback_data:'n:'+n})),
  [6,7,8,9,10].map(n=>({text:String(n),callback_data:'n:'+n}))];
const askAlbum=chat=>tg.send(chat,'Сколько фото-аватарок найти? Остальные будут буквами.\n'+
  '…или пришли свой альбом, до '+ALBUM_MAX+' фото.',countKb());

// Runs once the album has stopped growing, or straight from "Без фото".
async function finishAlbum(chat){
  clearTimeout(albumTimers[chat]);delete albumTimers[chat];
  const s=st(chat),inp=s.input;
  if(!inp||inp.stage!=='album')return;       // /new or /reset got there first
  s.src={names:inp.names,texts:inp.texts,start:inp.start,end:inp.end,album:inp.album};
  s.input=null;s.preview=null;save();
  if(inp.extra)await tg.send(chat,'Фото '+(inp.album.length+inp.extra)+', взял первые '+ALBUM_MAX+'.');
  return rebuild(chat,s);
}

// ------------------------------------------------------------- avatar pick ---
// Candidates are approved one at a time for one row at a time: the user sees
// the name the picture will sit beside, so a girl's photo never lands on Артём
// and no gender tags are needed on the queries.
const pickKb=()=>[[{text:'✅',callback_data:'p:ok'},{text:'❌',callback_data:'p:no'},
  {text:'⏹ хватит',callback_data:'p:stop'}]];

async function showCandidate(chat,s){
  const p=s.pick,r=s.screen.rows[p.rows[p.i]];
  let c;
  try{c=await pins.next(opts(s).queries,albumDir(chat));}
  catch(e){
    if(e.code!=='empty')console.error('pins:',e.message);
    const m=await tg.send(chat,e.code==='empty'?'Выдача кончилась — добавь запросы в /settings.':'Пинтерест не отвечает.',
      [[{text:'🔁 ещё раз',callback_data:'p:retry'},{text:'🔤 остальным буквы',callback_data:'p:stop'}]]);
    p.errMsg=m&&m.message_id;save();
    return;
  }
  p.cand=c;save();
  // The candidate is shown as the row it would become. If that render fails the
  // raw picture still lets the pick go on.
  let img=c.file;
  try{img=(await renderRow({...r,photo:fileURL(c.file)},path.join(OUT,'pick-'+chat+'.png'))).out;}
  catch(e){console.error('row preview:',e.message);}
  const cap=esc(r.name)+(p.card?'':' · '+(p.i+1)+'/'+p.rows.length);
  if(p.msg){
    try{await tg.editMedia(chat,p.msg,img,cap,pickKb());return;}
    catch(e){}
  }
  const m=await tg.photo(chat,img,cap,pickKb());
  p.msg=m&&m.message_id;save();
}

async function acceptPick(chat,s,url){
  const p=s.pick,r=s.screen.rows[p.rows[p.i]];
  r.photo=url;delete r.letter;
  p.cand=null;p.i++;
  if(p.i>=p.rows.length)return finishPick(chat,s);
  save();
  return showCandidate(chat,s);
}

// Rows left unpicked keep their initials. A pick from /new turns its candidate
// message into the screen preview; a pick from the card goes back to the card.
async function finishPick(chat,s){
  const p=s.pick;s.pick=null;
  if(p.card){
    if(p.msg)await tg.call('deleteMessage',{chat_id:chat,message_id:p.msg}).catch(()=>{});
    save();
    const r=s.screen.rows[p.rows[0]];
    return tg.send(chat,cardText(r),cardKb(r));
  }
  s.preview=p.msg||null;save();
  return doRender(chat,s);
}

// ---------------------------------------------------------------- updates ---
tg.poll(async u=>{
  if(u.callback_query){
    const q=u.callback_query,chat=q.message.chat.id,s=st(chat);
    const kind=q.data.slice(0,1),k=q.data.slice(2);

    if(kind==='s'){                       // settings
      const o=opts(s),vals=CYCLE[k];
      if(vals){o[k]=vals[(vals.indexOf(o[k])+1)%vals.length];save();}
      await tg.ack(q.id);
      return tg.edit(chat,q.message.message_id,'<b>Настройки</b>',setKb(o));
    }

    if(kind==='q'){                       // avatar queries, under /settings
      const o=opts(s);
      if(k==='add'){
        s.ask='queries';save();await tg.ack(q.id);
        return tg.send(chat,'Пришли запросы, по одному в строке.');
      }
      if(k==='back'){await tg.ack(q.id);return tg.edit(chat,q.message.message_id,'<b>Настройки</b>',setKb(o));}
      if(k!=='list'){
        if(o.queries.length<=1){await tg.ack(q.id,'Нужен хотя бы один запрос');return;}
        if(o.queries[+k]!=null){o.queries.splice(+k,1);save();}
      }
      await tg.ack(q.id);
      return tg.edit(chat,q.message.message_id,queriesText(o),queriesKb(o));
    }

    if(kind==='x'){
      await tg.ack(q.id);
      if(s.pick&&(k==='reroll'||k==='edit'))return tg.send(chat,'Сначала закончи отбор — ⏹ хватит.');
      if(k==='add'){s.draft={};s.step='name';s.awaitingPhoto=false;save();return ask(chat,s);}
      if(k==='render')return doRender(chat,s);
      if(k==='png'){
        if(!s.file)return tg.send(chat,'Сначала собери экран.');
        return tg.doc(chat,s.file,'Оригинал PNG');
      }
      if(k==='new'){
        S[chat]={screen:null,input:{stage:'names',names:[],texts:[]},settings:s.settings};
        save();
        return tg.send(chat,'Имена, по одному в строке.');
      }
      if(k==='reroll'){
        if(!s.src)return tg.send(chat,'Нечего пересобирать. /new');
        return rebuild(chat,s);
      }
      if(k==='noalbum'){
        if(!s.input||s.input.stage!=='album')return;
        s.input.album=[];s.input.extra=0;
        return finishAlbum(chat);
      }
      if(k==='edit'){
        if(!s.screen)return tg.send(chat,'Пусто. /new');
        s.edit=null;s.ask=null;save();
        return tg.send(chat,'Кого правим? (· — автодобор)',listKb(s));
      }
      if(k==='back'){s.edit=null;s.ask=null;save();return tg.send(chat,'Ок',mainKb());}
      return;
    }

    if(kind==='n'){                       // how many avatars to find, step 4 of /new
      await tg.ack(q.id);
      const inp=s.input;
      if(!inp||inp.stage!=='album'||inp.album.length)return;   // album photos got there first
      clearTimeout(albumTimers[chat]);delete albumTimers[chat];
      const n=+k;
      s.src={names:inp.names,texts:inp.texts,start:inp.start,end:inp.end,album:[],mode:n?'auto':undefined};
      s.input=null;s.preview=null;save();
      if(!n)return rebuild(chat,s);
      const warn=[];
      s.screen=buildScreen(s,warn);
      if(warn.length)await tg.send(chat,warn.join('\n'));
      // Any rows, filler included: photos and initials mixed down the whole list
      // is what a live account looks like.
      const rows=shuffle(s.screen.rows.map((_,i)=>i)).slice(0,n).sort((a,b)=>a-b);
      s.pick={rows,i:0,msg:null,errMsg:null,cand:null,card:false};save();
      return showCandidate(chat,s);
    }

    if(kind==='p'){                       // the avatar pick
      const p=s.pick,mid=q.message.message_id;
      if(!p||!s.screen||(mid!==p.msg&&mid!==p.errMsg)){await tg.ack(q.id,'Отбор уже закрыт');return;}
      await tg.ack(q.id);
      if(k==='retry'){p.errMsg=null;save();return showCandidate(chat,s);}
      if(k==='ok'){if(!p.cand)return;return acceptPick(chat,s,fileURL(p.cand.file));}
      if(p.cand){fs.rmSync(p.cand.file,{force:true});p.cand=null;}
      if(k==='no'){save();return showCandidate(chat,s);}
      if(k==='stop')return finishPick(chat,s);
      return;
    }

    if(kind==='l'){                       // picked a person out of the list
      const i=+k;
      if(!s.screen||!s.screen.rows[i]){await tg.ack(q.id,'Строки нет');return;}
      s.edit=i;s.ask=null;save();
      await tg.ack(q.id);
      return tg.send(chat,cardText(s.screen.rows[i]),cardKb(s.screen.rows[i]));
    }

    if(kind==='e'){                       // the open person card
      const r=s.screen&&s.screen.rows[s.edit];
      if(!r){await tg.ack(q.id,'Карточка закрыта');return;}
      if(k==='status'){
        if(!status.count()){
          await tg.ack(q.id);
          s.ask='status';save();
          return tg.send(chat,'Банк статусов пуст. Пришли эмодзи — поставлю его <b>'+
            esc(r.name)+'</b> и положу в банк.');
        }
        await tg.ack(q.id);
        return tg.edit(chat,q.message.message_id,'Статус для <b>'+esc(r.name)+'</b>:',statusKb(r));
      }
      else if(k==='premium'){
        r.premium=!r.premium;r.premiumLocked=true;
        if(!r.premium)delete r.status;
      }
      else if(k==='badge'){r.badge=String(((+r.badge||0)%9)+1);delete r.check;}
      else if(k==='check'){
        r.check=r.check===2?0:r.check===1?2:1;
        if(r.check)delete r.badge;else delete r.check;
      }
      else if(k==='avatar'){
        s.ask='avatar';save();await tg.ack(q.id);
        return tg.send(chat,'Аватарка для <b>'+esc(r.name)+'</b>:',avaKb(false));
      }
      else if(k==='name'||k==='text'||k==='time'){
        s.ask=k;save();await tg.ack(q.id);
        return tg.send(chat,{name:'Новое имя?',text:'Новое сообщение?',time:'Новое время? (14:32)'}[k]);
      }
      else r[k]=!r[k];
      save();
      await tg.ack(q.id);
      return tg.edit(chat,q.message.message_id,cardText(r),cardKb(r));
    }

    if(kind==='t'){                       // picking a status off the bank
      const r=s.screen&&s.screen.rows[s.edit];
      if(!r){await tg.ack(q.id,'Карточка закрыта');return;}
      if(k==='new'){
        s.ask='status';save();await tg.ack(q.id);
        return tg.send(chat,'Пришли эмодзи для <b>'+esc(r.name)+'</b> — обычный или кастомный. '+
          'Положу его и в банк.');
      }
      if(k==='x'){delete r.status;r.premiumLocked=true;}
      else if(k!=='back'){
        const f=status.list()[+k];
        if(f){r.status=status.urlFor(f);r.premium=true;r.premiumLocked=true;}
      }
      save();
      await tg.ack(q.id);
      return tg.edit(chat,q.message.message_id,cardText(r),cardKb(r));
    }

    if(kind==='a'){                       // avatar choice, from the card or /add
      const fromCard=s.ask==='avatar';
      const target=fromCard?(s.screen&&s.screen.rows[s.edit]):s.draft;
      if(!target){await tg.ack(q.id,'Не к кому применить');return;}
      if(k==='find'){
        await tg.ack(q.id);
        if(!fromCard)return;
        s.ask=null;s.pick={rows:[s.edit],i:0,msg:null,errMsg:null,cand:null,card:true};save();
        return showCandidate(chat,s);
      }
      if(k==='own'){
        s.awaitingPhoto=true;save();
        await tg.ack(q.id);
        return tg.send(chat,'Пришли фото для <b>'+esc(target.name)+'</b>'+
          (fromCard?'.':' — добавлю его и в банк.'));
      }
      if(k==='bank'){delete target.letter;target.wantBank=true;delete target.photo;}
      if(k==='letter'){delete target.photo;delete target.wantBank;target.letter=true;}
      await tg.ack(q.id,k==='bank'?'Из банка':'Буква');
      if(fromCard){
        if(target.wantBank){assignAvatars([target],100);delete target.wantBank;}
        s.ask=null;save();
        return tg.send(chat,cardText(target),cardKb(target));
      }
      s.step='flags';save();
      return ask(chat,s);
    }

    if(kind==='f'){                       // legacy /add wizard flags
      if(!s.draft){await tg.ack(q.id,'Черновик уже сохранён');return;}
      if(k==='done'){
        const r=s.draft;s.draft=null;s.step=null;
        if(!s.screen){
          s.screen=normalize({chrome:{battery:rand(20,89),search:false},rows:[r],tab:{}});
          s.screen.chrome.timeLocked=true;s.screen.userRows=1;
        }else{
          s.screen.rows.push(r);
          s.screen.userRows=(s.screen.userRows||0)+1;
        }
        assignAvatars(s.screen.rows,opts(s).photo);
        save();
        await tg.ack(q.id,'Сохранено');
        return tg.send(chat,'Готово, всего '+s.screen.rows.length+'.',
          [[{text:'➕ Ещё',callback_data:'x:add'},{text:'🖼 Собрать',callback_data:'x:render'}]]);
      }
      if(k==='badge'){s.draft.badge=String(((+s.draft.badge||0)%9)+1);delete s.draft.check;}
      else if(k==='check'){
        s.draft.check=s.draft.check===2?0:s.draft.check===1?2:1;
        if(s.draft.check)delete s.draft.badge;else delete s.draft.check;
      }
      else s.draft[k]=!s.draft[k];
      save();
      await tg.ack(q.id);
      return tg.edit(chat,q.message.message_id,'Флаги для <b>'+esc(s.draft.name)+'</b>:',flagKb(s.draft));
    }
    return;
  }

  const m=u.message;if(!m)return;
  const chat=m.chat.id,s=st(chat),t=(m.text||'').trim();

  // ---- a photo sent during the pick goes to the row being picked ----
  if(m.photo&&s.pick&&s.screen){
    const dir=albumDir(chat);fs.mkdirSync(dir,{recursive:true});
    const dest=path.join(dir,'own-'+Date.now()+'.jpg');
    await tg.download(m.photo[m.photo.length-1].file_id,dest);
    if(s.pick.cand){fs.rmSync(s.pick.cand.file,{force:true});s.pick.cand=null;}
    return acceptPick(chat,s,fileURL(dest));
  }

  // ---- photos: the album for a /new screen ----
  if(m.photo&&s.input&&s.input.stage==='album'){
    clearTimeout(albumTimers[chat]);
    try{
      if(s.input.album.length<ALBUM_MAX){
        const dir=albumDir(chat);fs.mkdirSync(dir,{recursive:true});
        const dest=path.join(dir,'ph-'+Date.now()+'-'+s.input.album.length+'.jpg');
        await tg.download(m.photo[m.photo.length-1].file_id,dest);
        s.input.album.push(dest);
      }else s.input.extra=(s.input.extra||0)+1;
      save();
    }finally{
      // Armed after the download, not before: a slow download must not let the
      // timer close the album while the next photo is still waiting in line.
      albumTimers[chat]=setTimeout(()=>finishAlbum(chat).catch(e=>console.error('album:',e.message)),ALBUM_MS);
    }
    return;
  }

  // ---- photos: the avatar bank, or a picture for one person ----
  if(m.photo&&(s.awaitingPhoto||s.awaitingAva)){
    const best=m.photo[m.photo.length-1];
    // A photo for a row of a built screen stays with that screen's album; only
    // /addava and the legacy /add wizard feed the bank.
    const fromCard=s.awaitingPhoto&&s.ask==='avatar';
    const dir=fromCard?albumDir(chat):BANK;
    fs.mkdirSync(dir,{recursive:true});
    const dest=path.join(dir,'ava-'+Date.now()+'.jpg');
    await tg.download(best.file_id,dest);
    if(s.awaitingPhoto){
      const target=fromCard?(s.screen&&s.screen.rows[s.edit]):s.draft;
      if(target){
        target.photo=fileURL(dest);delete target.letter;delete target.wantBank;
        s.awaitingPhoto=false;
        await tg.send(chat,fromCard?'Фото принято.':'Фото принято, в банке теперь '+bankFiles().length+'.');
        if(fromCard){s.ask=null;save();return tg.send(chat,cardText(target),cardKb(target));}
        s.step='flags';save();
        return ask(chat,s);
      }
    }
    s.awaitingAva=false;save();
    return tg.send(chat,'В банке '+bankFiles().length+' аватарок. Шли ещё или /new');
  }

  // ---- status bank: unicode and custom emoji both land as image files ----
  if(s.awaitingStatus){
    const added=await status.addFrom(tg,m);
    if(!added.length)return tg.send(chat,'Эмодзи не нашёл. Пришли смайлик — обычный или кастомный.');
    s.awaitingStatus=false;save();
    return tg.send(chat,'Добавил '+added.length+'. В банке статусов '+status.count()+'.');
  }

  if(t==='/start'||t==='/help')return tg.send(chat,HELP);
  if(t==='/reset'){
    S[chat]={screen:null,input:null,src:null,settings:s.settings};save();
    return tg.send(chat,'Сброшено');
  }
  if(t==='/settings')return tg.send(chat,'<b>Настройки</b>',setKb(opts(s)));
  if(t==='/addava'){s.awaitingAva=true;save();return tg.send(chat,'Шли фото — добавлю в банк аватарок.');}
  if(t==='/addstatus'){
    s.awaitingStatus=true;save();
    return tg.send(chat,'Шли эмодзи для банка статусов — обычные или кастомные.\n'+
      'Сейчас в банке: '+status.count());
  }
  if(t==='/new'){
    S[chat]={screen:null,input:{stage:'names',names:[],texts:[]},settings:s.settings};
    save();
    return tg.send(chat,'Имена, по одному в строке.');
  }
  if(t==='/edit'){
    if(!s.screen)return tg.send(chat,'Пусто. /new');
    s.edit=null;s.ask=null;save();
    return tg.send(chat,'Кого правим? (· — автодобор)',listKb(s));
  }
  if(t==='/add'){s.draft={};s.step='name';s.awaitingAva=false;s.awaitingPhoto=false;save();return ask(chat,s);}
  if(t==='/render')return doRender(chat,s);
  if(/^\/random/.test(t)){
    const o=opts(s), cap=fitRows({chrome:{search:false}});
    const n=Math.min(cap,Math.max(1,parseInt(t.split(/\s+/)[1],10)||cap));
    const [lo,hi]=o.badge.split('-').map(Number);
    const rows=randomRows(n,NAMES,TEXTS,null,null,lo,hi);
    applyPremium(rows,o.premium,o.status,status.pick);
    assignAvatars(rows,o.photo);
    s.screen=normalize({chrome:{battery:rand(20,89),charging:false,search:false},rows,tab:{}});
    s.screen.chrome.timeLocked=true;s.screen.userRows=0;
    s.src=null;s.input=null;s.draft=null;s.step=null;s.preview=null;save();
    return doRender(chat,s);
  }

  // ---- new avatar queries, one per line ----
  if(s.ask==='queries'&&t){
    const o=opts(s);
    const add=t.split('\n').map(x=>x.trim()).filter(Boolean)
      .filter((x,i,a)=>a.indexOf(x)===i&&!o.queries.includes(x));
    o.queries.push(...add);s.ask=null;save();
    return tg.send(chat,'Добавил '+add.length+'.\n\n'+queriesText(o),queriesKb(o));
  }

  // ---- an emoji sent straight at the open card ----
  if(s.ask==='status'){
    const r=s.screen&&s.screen.rows[s.edit];
    const added=await status.addFrom(tg,m);
    if(!added.length)return tg.send(chat,'Эмодзи не нашёл. Пришли смайлик — обычный или кастомный.');
    if(r){r.status=fileURL(added[0]);r.premium=true;r.premiumLocked=true;}
    s.ask=null;save();
    await tg.send(chat,'В банке статусов '+status.count()+'.');
    return r?tg.send(chat,cardText(r),cardKb(r)):undefined;
  }

  // ---- answering something the editor asked for ----
  if(s.ask&&s.ask!=='avatar'&&t){
    const r=s.screen&&s.screen.rows[s.edit];
    if(r){
      if(s.ask==='time'&&toMin(t)==null)return tg.send(chat,'Время в формате 14:32.');
      r[s.ask]=t;
      s.ask=null;save();
      return tg.send(chat,cardText(r),cardKb(r));
    }
    s.ask=null;save();
  }

  // ---- the batch flow ----
  if(s.input){
    const lines=t.split('\n').map(x=>x.trim()).filter(Boolean);
    if(s.input.stage==='names'){
      if(!lines.length)return tg.send(chat,'Пусто. Имена, по одному в строке.');
      s.input.names=lines;s.input.stage='texts';save();
      return tg.send(chat,'Принял '+lines.length+'. Теперь сообщения — по строке на каждое.');
    }
    if(s.input.stage==='texts'){
      if(!lines.length)return tg.send(chat,'Пусто. Сообщения, по одному в строке.');
      s.input.texts=lines;s.input.stage='range';save();
      return tg.send(chat,'Диапазон времени? например  <code>09:00 21:00</code>');
    }
    if(s.input.stage==='range'){
      const parts=t.match(/\d{1,2}:\d{2}/g)||[];
      if(parts.length<2)return tg.send(chat,'Два времени, например  <code>09:00 21:00</code>');
      const a=toMin(parts[0]),b=toMin(parts[1]);
      if(a==null||b==null)return tg.send(chat,'Не разобрал время. Формат 09:00 21:00');
      // Everything on the screen is today, so a range that wraps past midnight
      // would need yesterday's rows to carry a weekday stamp instead of a clock.
      if(b<a)return tg.send(chat,'Конец раньше начала. Через полночь не умею — на экране всё сегодняшнее.');
      s.input.start=a;s.input.end=b;s.input.stage='album';s.input.album=[];
      // /new already dropped the previous screen; its photos go with it.
      fs.rmSync(albumDir(chat),{recursive:true,force:true});
      save();
      return askAlbum(chat);
    }
    if(s.input.stage==='album')return askAlbum(chat);
  }

  // ---- legacy /add wizard ----
  if(s.step==='name'&&t){s.draft.name=t;s.step='text';save();return ask(chat,s);}
  if(s.step==='text'&&t){s.draft.text=t;s.step='time';save();return ask(chat,s);}
  if(s.step==='time'&&t){
    s.draft.time=(t==='-'||t==='')?toHHMM(9*60+Math.floor(Math.random()*780)):t;
    s.step='avatar';save();return ask(chat,s);
  }
  return tg.send(chat,HELP);
});
console.log('SpamGen bot polling…');

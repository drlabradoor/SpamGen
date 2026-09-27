# Аватарки с Пинтереста — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** на 4-м шаге `/new` бот по цифре 0–10 находит аватарки на Пинтересте, пользователь отбирает их по одной под конкретную строку кнопками ✅/❌; то же из карточки редактора; пересборка авто-экрана не отрывает лица от людей.

**Architecture:** новый модуль `src/pins.js` — поиск через внутренний эндпоинт pinterest.com, фильтр, память показанных. `src/render.js` получает `renderRow` — одна строка списка 1170×228 для превью кандидата. Весь диалог (цифры, цикл отбора, запросы в `/settings`, «🔎 Найти», заморозка при пересборке) — в `bot.js`, в его существующем стиле: состояние в `sessions.json`, колбэки по префиксу `callback_data`.

**Tech Stack:** Node ≥ 20 (глобальный `fetch`), без npm-пакетов, headless Chromium через `execFile`, Telegram Bot API через `src/tg.js`. Тесты — самописные скрипты `node tools/*.js` с `check()` и выходом 0/1.

**Spec:** `docs/superpowers/specs/2026-09-13-pinterest-avatars-design.md`

## Global Constraints

- Ни одного npm-пакета. Только `fs`, `path`, `os`, `child_process`, `zlib` и глобальный `fetch`.
- **Живой бот не трогать**: не останавливать, не перезапускать `node bot.js`, не запускать второй экземпляр — второй `getUpdates` роняет оба с 409. Всё проверяется тестами со стабами Telegram.
- Тесты никогда не пишут в настоящие данные: `data/sessions.json`, `data/album/`, `data/pins-seen.json`, `assets/bank/`, банк статусов. Всё подменяется через `SPAMGEN_STATE`, `SPAMGEN_ALBUM`, `SPAMGEN_BANK`, `SPAMGEN_STATUS`, `SPAMGEN_PINS_SEEN`. Сеть к Пинтересту в тестах — только через подменённый `globalThis.fetch`.
- Git в проекте не инициализирован: шагов «commit» нет, контрольная точка каждой задачи — зелёный прогон её тестов.
- Стиль кода как в `bot.js`: плотный, 2 пробела, `;`, комментарии объясняют «почему», а не «что».
- Эндпоинт — только `https://www.pinterest.com/...` (`ru.pinterest.com` падает на TLS).
- Размер картинки для скачивания — `474x`. Фильтр пропорций `height/width` в `0.87…1.15`. Порог времени превью строки — `1.5 с`.
- Тексты для пользователя — дословно из этого плана (они сверены со спекой).
- Номера строк в `bot.js` сдвигаются от задачи к задаче — искать места по приведённым якорным фрагментам кода, а не по номерам.

## Файлы

| Файл | Что | Задача |
|---|---|---|
| `src/pins.js` | **новый.** Поиск, фильтр, листание, seen-файл, скачивание | 1 |
| `tools/fakepins.js` | **новый.** Подменный Пинтерест для тестов поверх `globalThis.fetch` | 1 |
| `tools/pinsunit.js` | **новый.** Тест `src/pins.js` без бота | 1 |
| `src/template.js` | `listTop` через `??`, чтобы `0` был нулём | 2 |
| `src/render.js` | `renderRow`, общий хвост P3 и очередь | 2 |
| `tools/rowtest.js` | **новый.** Размер, аватар, время превью строки | 2 |
| `bot.js` | запросы в `/settings`, цифры, цикл отбора, «🔎 Найти», заморозка | 3–6 |
| `src/tg.js` | `photo()` принимает клавиатуру | 4 |
| `tools/pinstest.js` | **новый.** Весь поток через бота | 3–6 |
| `tools/flowtest.js` | шаг 4 теперь цифры, а не «Без фото» | 4 |
| `README.md`, `.gitignore` | документация, `data/pins-seen.json` | 7 |

---

### Task 1: `src/pins.js` — источник кандидатов

**Files:**
- Create: `src/pins.js`
- Create: `tools/fakepins.js`
- Test: `tools/pinsunit.js`

**Interfaces:**
- Consumes: ничего.
- Produces:
  - `pins.next(queries: string[], dir: string) → Promise<{id: string, file: string}>` — кандидат уже скачан в `dir` как `pin-<id>.jpg` и уже записан в seen. Бросает `Error` с `.code==='down'` (Пинтерест не отвечает / не тот формат / 5 неудачных скачиваний подряд) или `.code==='empty'` (все запросы исчерпаны или 20 страниц без нового пина).
  - `pins.QUERIES: string[]` — стартовый список из 12 запросов.
  - `pins.usable(pin) → boolean` — фильтр одного пина из выдачи.
  - `pins._reset()` — только для тестов: забыть буферы запросов и кэш seen (имитация перезапуска).
  - `fakepins.install(opts?) → log` — подменяет `globalThis.fetch`. `opts.pages` (страниц на запрос, по умолчанию 3), `opts.perPage` (пинов на странице, 5). На каждой странице пин с индексом 1 — высокий, 3 — `is_promoted`, остальные квадратные, то есть **3 годных на страницу**. `log={search:[{query,bookmark}], images:[url], mode}`; `mode` можно менять на лету: `'ok' | 'down' | 'badjson' | 'imgfail'`. Id пина: `<hex8 запроса>-<страница>-<индекс>`.

- [ ] **Step 1: Написать подменный Пинтерест**

`tools/fakepins.js`:

```js
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
```

- [ ] **Step 2: Написать падающий тест**

`tools/pinsunit.js`:

```js
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
```

- [ ] **Step 3: Убедиться, что тест падает**

Run: `node tools/pinsunit.js`
Expected: падение `Cannot find module '../src/pins'`.

- [ ] **Step 4: Написать `src/pins.js`**

```js
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
```

- [ ] **Step 5: Прогнать тест**

Run: `node tools/pinsunit.js`
Expected: все строки `ok`, в конце `all green`, код выхода 0.

---

### Task 2: `renderRow` — превью одной строки

**Files:**
- Modify: `src/template.js` — функция `html(cfg)`
- Modify: `src/render.js` — `shoot`, `render`, экспорт
- Test: `tools/rowtest.js`

**Interfaces:**
- Consumes: `html(cfg)` из `src/template.js`, `prefetch(cfg)` из `src/emoji.js`.
- Produces: `renderRow(row: object, outPng: string) → Promise<{out: string, missingEmoji: string[]}>` — PNG 1170×228, строка без разделителя, в той же очереди, что и `render`.

- [ ] **Step 1: Написать падающий тест**

`tools/rowtest.js`:

```js
// renderRow: one chat row at its on-screen size, fast enough to show for every
// avatar candidate. The spec's threshold is 1.5 s; the spike measured ~0.6 s.
const path=require('path');
const {renderRow}=require('../src/render');
const {decode,px}=require('./png');
const out=path.join(__dirname,'..','out','rowtest.png');

let fails=0;
function check(name,cond,detail){
  console.log((cond?'  ok   ':'  FAIL ')+name+(detail!=null&&!cond?'   <'+detail+'>':''));
  if(!cond)fails++;
}
(async()=>{
  const t0=Date.now();
  await renderRow({name:'Дарья',text:'скинь реквизиты пожалуйста',time:'14:32',badge:'2'},out);
  const ms=Date.now()-t0;
  const im=decode(out);
  check('1170 wide',im.w===1170,im.w);
  check('228 tall',im.h===228,im.h);
  // Avatar box is 48,24 .. 228,204 in device px; its centre is the gradient
  // (or the white initial), never the black row behind it.
  const c=px(im,138,114);
  check('avatar sits at the top left',c[0]+c[1]+c[2]>150,c.join(','));
  const bg=px(im,5,5);
  check('row background is black',bg[0]+bg[1]+bg[2]<30,bg.join(','));
  check('under 1.5 s',ms<1500,ms+' ms');
  console.log('  '+ms+' ms, '+out);
  console.log(fails?'\n'+fails+' FAILED':'\nall green');
  process.exit(fails?1:0);
})();
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `node tools/rowtest.js`
Expected: `TypeError: renderRow is not a function`.

- [ ] **Step 3: `listTop` в шаблоне**

В `src/template.js` в `function html(cfg)` заменить `cfg.listTop||341` на `cfg.listTop??341`. `render()` всегда кладёт туда `listTopFor(cfg)` ≥ 341, так что на экраны это не влияет, а строка сможет встать в `0`.

- [ ] **Step 4: `render.js` — размер окна, общий хвост, `renderRow`**

Заменить `shoot` на версию с размером окна:

```js
function shoot(htmlPath,pngPath,w,h){
  return new Promise((res,rej)=>{
    execFile(chromePath(),['--headless=old','--disable-gpu','--no-sandbox','--hide-scrollbars',
      '--no-first-run','--disable-extensions','--disable-background-networking',
      '--disable-lcd-text','--font-render-hinting=none',
      '--user-data-dir='+path.join(ROOT,'.chrome'),
      '--force-device-scale-factor=3','--window-size='+(w||390)+','+(h||844),
      '--screenshot='+pngPath,'file:///'+htmlPath.split(path.sep).join('/')],
      {timeout:60000},err=>err?rej(err):res());
  });
}
```

Заменить блок от `// One render at a time` до `module.exports` на:

```js
// Screenshots come out of Chromium as sRGB; the P3 chunks make them look like
// the phone's own. The temp files go either way.
function finish(tmp,raw,outPng){
  if(fs.existsSync(P3))injectRaw(raw,fs.readFileSync(P3),outPng);
  else fs.copyFileSync(raw,outPng);
  try{fs.unlinkSync(tmp);fs.unlinkSync(raw);}catch(e){}
}

// One render at a time: bothost gives 2 GB, a second Chromium would OOM it.
let queue=Promise.resolve();
const enqueue=run=>(queue=queue.then(run,run));

function render(cfgIn,outPng){
  return enqueue(async()=>{
    const cfg=normalize(cfgIn);
    // The account picture belongs to the Settings tab only. It must never leak
    // into the header, where it would render as a story ring that is not there.
    if(cfg.chrome&&cfg.chrome.avatar){
      cfg.tab=cfg.tab||{};
      if(!cfg.tab.avatar)cfg.tab.avatar=cfg.chrome.avatar;
      delete cfg.chrome.avatar;
    }
    // The search field pushes the list down by exactly 162 device px.
    if(cfg.listTop==null)cfg.listTop=listTopFor(cfg);
    const pf=await prefetch(cfg);
    const tmp=path.join(os.tmpdir(),'spamgen-'+Date.now()+'.html');
    fs.writeFileSync(tmp,buildHTML(cfg));
    const raw=outPng+'.raw.png';
    await shoot(tmp,raw);
    finish(tmp,raw,outPng);
    return {out:outPng,missingEmoji:pf.missing};
  });
}

// A single chat row, 1170x228 — exactly the size it has on the screen. The bot
// shows every avatar candidate this way, so a picture is judged at the size it
// will be seen and beside the name it will sit next to.
function renderRow(r,outPng){
  return enqueue(async()=>{
    const cfg={rows:[{...r}],listTop:0};
    const pf=await prefetch(cfg);
    const tmp=path.join(os.tmpdir(),'spamgen-row-'+Date.now()+'.html');
    fs.writeFileSync(tmp,html(cfg));
    const raw=outPng+'.raw.png';
    await shoot(tmp,raw,390,76);
    finish(tmp,raw,outPng);
    return {out:outPng,missingEmoji:pf.missing};
  });
}
module.exports={render,renderRow,buildHTML};
```

- [ ] **Step 5: Прогнать тесты**

Run: `node tools/rowtest.js` → `all green`, время напечатано.
Run: `node tools/selftest.js` → зелёный (рендер экрана не сломался).

Если падает только `under 1.5 s` — **остановиться и сообщить пользователю**: по спеке это переключение превью на исходную картинку, решение за ним.

---

### Task 3: запросы в `/settings`

**Files:**
- Modify: `bot.js` — `DEF`, `opts`, `setKb`, колбэки, ответы на `s.ask`
- Test: `tools/pinstest.js` (создаётся здесь, дальше дополняется)

**Interfaces:**
- Consumes: `pins.QUERIES`.
- Produces: `s.settings.queries: string[]` (своя копия у каждого чата), `queriesKb(o)`, `queriesText(o)`, колбэки `q:list | q:<i> | q:add | q:back`, `s.ask==='queries'`.

- [ ] **Step 1: Создать `tools/pinstest.js` с каркасом и секцией запросов**

```js
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

  // ---- sections of later tasks go above this line ----
  console.log(fails?'\n'+fails+' FAILED':'\nall green');
  process.exit(fails?1:0);
})();
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `node tools/pinstest.js`
Expected: `FAIL settings shows the query button`.

- [ ] **Step 3: Реализовать в `bot.js`**

В начале рядом с остальными `require`:

```js
const pins=require('./src/pins');
```

`DEF` и `opts` (якорь: `const DEF={search:'random'`):

```js
const DEF={search:'random',premium:20,status:60,badge:'1-3',fill:true,photo:75,queries:pins.QUERIES};
```

```js
const opts=s=>{
  s.settings=Object.assign({},DEF,s.settings);
  // A chat edits its own copy; the default list is shared by every other chat.
  if(s.settings.queries===DEF.queries)s.settings.queries=DEF.queries.slice();
  return s.settings;
};
```

В `setKb(o)` последней строкой массива, после `Автодобор до низа`:

```js
    [{text:'Автодобор до низа '+(o.fill?'✅':'❌'),callback_data:'s:fill'}],
    [{text:'🔎 Запросы ('+o.queries.length+')',callback_data:'q:list'}]];
```

После `setKb`:

```js
function queriesKb(o){
  const kb=[];
  for(let i=0;i<o.queries.length;i+=4)
    kb.push(o.queries.slice(i,i+4).map((_,j)=>({text:'✖️ '+(i+j+1),callback_data:'q:'+(i+j)})));
  kb.push([{text:'➕ добавить',callback_data:'q:add'},{text:'⬅️ назад',callback_data:'q:back'}]);
  return kb;
}
const queriesText=o=>'<b>Запросы для аватарок</b>\n'+o.queries.map((x,i)=>(i+1)+'. '+esc(x)).join('\n');
```

В обработчике колбэков сразу после блока `if(kind==='s'){ ... }`:

```js
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
```

В обработке сообщений прямо перед комментарием `// ---- an emoji sent straight at the open card ----`:

```js
  // ---- new avatar queries, one per line ----
  if(s.ask==='queries'&&t){
    const o=opts(s);
    const add=t.split('\n').map(x=>x.trim()).filter(Boolean)
      .filter((x,i,a)=>a.indexOf(x)===i&&!o.queries.includes(x));
    o.queries.push(...add);s.ask=null;save();
    return tg.send(chat,'Добавил '+add.length+'.\n\n'+queriesText(o),queriesKb(o));
  }
```

- [ ] **Step 4: Прогнать тесты**

Run: `node tools/pinstest.js` → `all green`.
Run: `node tools/flowtest.js` → `all green` (настройки не сломались).

---

### Task 4: цифры на шаге 4 и цикл отбора

**Files:**
- Modify: `src/tg.js` — `photo()`
- Modify: `bot.js` — `askAlbum`, колбэки `n:` и `p:`, фото во время отбора, защита `x:reroll`/`x:edit`
- Modify: `tools/flowtest.js:106-107,259-263`
- Test: `tools/pinstest.js`

**Interfaces:**
- Consumes: `pins.next(queries,dir)` (Task 1), `renderRow(row,outPng)` (Task 2), `s.settings.queries` (Task 3).
- Produces:
  - `s.pick={rows:number[], i:number, msg:number|null, errMsg:number|null, cand:{id,file}|null, card:boolean}`
  - `s.src.mode==='auto'` у экранов, собранных цифрой ≥ 1
  - `showCandidate(chat,s)`, `acceptPick(chat,s,photoURL)`, `finishPick(chat,s)` — Task 5 зовёт `showCandidate` с `card:true`
  - `tg.photo(chat,file,caption,kb?)`

- [ ] **Step 1: Дописать секцию в `tools/pinstest.js`** (над строкой `// ---- sections of later tasks go above this line ----`)

```js
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
```

- [ ] **Step 2: Поправить `tools/flowtest.js` под новый шаг 4**

Строки 106–107 заменить на:

```js
  check('range accepted, asks for an album',/альбом/.test(last().text),last().text);
  check('album step offers digits',last().kb&&['0','10'].every(d=>last().kb.includes(d)),
    last().kb&&last().kb.join(' | '));
```

Строки 259–263 заменить на:

```js
  check('text at the album step asks for the album again',/альбом/.test(last().text),last().text);
  await handler(cb('n:0'));
  check('single name sits on the end of the range',
    state().screen.rows[0].time==='21:00',state().screen.rows[0].time);
  check('"0" leaves every row on initials',state().screen.rows.every(r=>!r.photo),
```

(следующая строка с `state().screen.rows.filter(r=>r.photo).length);` остаётся как есть).

- [ ] **Step 3: Убедиться, что тесты падают**

Run: `node tools/pinstest.js` → `FAIL step 4 offers digits 0..10`.
Run: `node tools/flowtest.js` → `FAIL album step offers digits`.

- [ ] **Step 4: `src/tg.js` — клавиатура у фото**

Заменить строку `photo(chat,file,caption){...}` на:

```js
  // A keyboard means an HTML caption too: the pick captions carry an escaped name.
  photo(chat,file,caption,kb){return this.upload('sendPhoto',{chat_id:chat,caption,
    parse_mode:kb?'HTML':undefined,reply_markup:kb?{inline_keyboard:kb}:undefined},'photo',file);}
```

- [ ] **Step 5: `bot.js` — шаг 4 и цикл отбора**

Строку `const {render}=require('./src/render');` заменить на:

```js
const {render,renderRow}=require('./src/render');
```

Заменить `const askAlbum=...` (две строки) на:

```js
const countKb=()=>[[0,1,2,3,4,5].map(n=>({text:String(n),callback_data:'n:'+n})),
  [6,7,8,9,10].map(n=>({text:String(n),callback_data:'n:'+n}))];
const askAlbum=chat=>tg.send(chat,'Сколько фото-аватарок найти? Остальные будут буквами.\n'+
  '…или пришли свой альбом, до '+ALBUM_MAX+' фото.',countKb());
```

Сразу после `finishAlbum` добавить цикл отбора:

```js
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
```

В колбэках, в блоке `if(kind==='x'){` сразу после `await tg.ack(q.id);`:

```js
      if(s.pick&&(k==='reroll'||k==='edit'))return tg.send(chat,'Сначала закончи отбор — ⏹ хватит.');
```

Сразу после всего блока `if(kind==='x'){ ... }`:

```js
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
```

В обработке сообщений первым делом после `const chat=m.chat.id,s=st(chat),t=(m.text||'').trim();`:

```js
  // ---- a photo sent during the pick goes to the row being picked ----
  if(m.photo&&s.pick&&s.screen){
    const dir=albumDir(chat);fs.mkdirSync(dir,{recursive:true});
    const dest=path.join(dir,'own-'+Date.now()+'.jpg');
    await tg.download(m.photo[m.photo.length-1].file_id,dest);
    if(s.pick.cand){fs.rmSync(s.pick.cand.file,{force:true});s.pick.cand=null;}
    return acceptPick(chat,s,fileURL(dest));
  }
```

- [ ] **Step 6: Прогнать тесты**

Run: `node tools/pinstest.js` → `all green`.
Run: `node tools/flowtest.js` → `all green`.

---

### Task 5: «🔎 Найти» в карточке

**Files:**
- Modify: `bot.js` — `avaKb`, колбэк `a:find`
- Test: `tools/pinstest.js`

**Interfaces:**
- Consumes: `showCandidate(chat,s)`, `finishPick` с `card:true` (Task 4).
- Produces: колбэк `a:find`.

- [ ] **Step 1: Дописать секцию в `tools/pinstest.js`** (над маркером; работает на экране, собранном последней секцией Task 4)

```js
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
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `node tools/pinstest.js` → `FAIL card avatar offers 🔎 Найти`.

- [ ] **Step 3: Реализовать в `bot.js`**

В `avaKb(withBank)` перед `kb.push([{text:'📷 Своё фото'...`:

```js
  // Only a row of a built screen can be searched for; /add has no row yet.
  if(!withBank)kb.push([{text:'🔎 Найти',callback_data:'a:find'}]);
```

В блоке `if(kind==='a'){` сразу после строки `if(!target){await tg.ack(q.id,'Не к кому применить');return;}`:

```js
      if(k==='find'){
        await tg.ack(q.id);
        if(!fromCard)return;
        s.ask=null;s.pick={rows:[s.edit],i:0,msg:null,errMsg:null,cand:null,card:true};save();
        return showCandidate(chat,s);
      }
```

- [ ] **Step 4: Прогнать тесты**

Run: `node tools/pinstest.js` → `all green`.
Run: `node tools/flowtest.js` → `all green` (там проверяется, что в карточке нет банка — «🔎 Найти» это не нарушает).

---

### Task 6: пересборка авто-экрана не трогает людей

**Files:**
- Modify: `bot.js` — `buildScreen` (метка `filler`, вынос `mixFiller`), новый `reshuffle`, `rebuild`
- Test: `tools/pinstest.js`

**Interfaces:**
- Consumes: `s.src.mode==='auto'` (Task 4); `randomRows`, `spreadTimes`, `applyPremium`, `normalize`, `toHHMM` из `src/model.js`.
- Produces: `r.filler===true` у строк автодобора в экранах `/new`; `reshuffle(s) → screen`; `mixFiller(rows) → rows`.

- [ ] **Step 1: Дописать секцию в `tools/pinstest.js`** (над маркером)

```js
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
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `node tools/pinstest.js` → `FAIL filler rows are marked`.

- [ ] **Step 3: Реализовать в `bot.js`**

Перед `function buildScreen` добавить:

```js
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
```

В `buildScreen` заменить блок

```js
      // The draw is 75/25, so a filler of five comes out unread all the way down
      // about a quarter of the time — and a column of identical blue badges from
      // top to bottom is exactly the stamped look the mix exists to break.
      if(filler.length>2&&!filler.some(r=>r.check)){
        const v=filler[rand(1,filler.length-1)];
        delete v.badge;v.check=Math.random()<0.6?2:1;
      }
      rows.push(...filler);
```

на

```js
      mixFiller(filler).forEach(r=>{r.filler=true;});
      rows.push(...filler);
```

После `buildScreen` добавить:

```js
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
```

В `rebuild` заменить строку `s.screen=buildScreen(s,warn);` на:

```js
  s.screen=s.src.mode==='auto'&&s.screen?reshuffle(s):buildScreen(s,warn);
```

- [ ] **Step 4: Прогнать тесты**

Run: `node tools/pinstest.js` → `all green`.
Run: `node tools/flowtest.js` → `all green` (пересборка экрана из альбома по-прежнему раздаёт альбом заново).

---

### Task 7: документация и полный прогон

**Files:**
- Modify: `bot.js` — `HELP`
- Modify: `README.md`
- Modify: `.gitignore`

- [ ] **Step 1: `HELP` в `bot.js`**

Строку `/new — новый экран: имена → сообщения → диапазон времени → фото альбомом` заменить на:

```
/new — новый экран: имена → сообщения → диапазон времени → аватарки (цифрой с Пинтереста или альбомом)
```

- [ ] **Step 2: `README.md`**

- В таблице команд строку `/new` — так же, как в `HELP`.
- В «Основной поток» заменить абзац про четвёртый шаг на:

```markdown
и четвёртым шагом — **аватарки**: цифра 0–10 или свой альбом до 10 фото.

Цифра `N` — бот сам ищет картинки на Пинтересте. Экран собирается сразу, из
всех строк (автодобор тоже) случайно выбираются `N`, и по ним сверху вниз
приходит кандидат: готовая строка списка с этой картинкой и подписью
`Дарья · 2/6`. `✅` — ставит, `❌` — следующий кандидат, `⏹ хватит` — остальным
буквы. Можно прислать своё фото — встанет текущей строке. `0` — все буквами.

Поиск идёт через внутренний эндпоинт pinterest.com (официальный API v5
публичного поиска не даёт), без логина. Запросы — в `/settings` → «🔎 Запросы»:
по умолчанию двенадцать, от «аватарки для тг» до «картины аватарка», чтобы на
экране были не одни лица. Показанный пин не показывается больше никогда —
`data/pins-seen.json`. Альбом, присланный фото, работает как раньше:
Telegram не помечает последнее фото альбома, поэтому он считается собранным,
когда 2 секунды не приходит новых.
```

- В «Дальше экран собирается сам…», пункт **аватарки**: дописать в конец «Экран, собранный цифрой, при «🎲 Пересобрать» людей не меняет: имя, текст, аватарка и поисковая строка остаются, перетасовываются времена, бейджи, премиум, батарея».
- В «Редактор»: «Аватарка в карточке — «🔎 Найти», «📷 Своё фото» или «🔤 Буква». «Найти» — тот же отбор ✅/❌ для одной строки».
- В «Тесты» добавить:

```
node tools/pinsunit.js     src/pins.js: фильтр, листание, seen, отказы
node tools/rowtest.js      превью строки: 1170×228 и быстрее 1.5 с
node tools/pinstest.js     отбор с Пинтереста через бота, запросы, «Найти», пересборка
```

  и в перечень подменяемых путей — `SPAMGEN_PINS_SEEN`; Пинтерест в тестах подменяется `tools/fakepins.js`.
- В «Как устроено» строку `src/pins.js        поиск аватарок на Пинтересте, память показанных`.

- [ ] **Step 3: `.gitignore`**

Прочитать `.gitignore`. Если `data/` не игнорируется целиком — добавить строку `data/pins-seen.json`.

- [ ] **Step 4: Полный прогон**

Run по очереди, каждый должен закончиться `all green` / без ошибок:

```
node tools/selftest.js
node tools/pinsunit.js
node tools/rowtest.js
node tools/flowtest.js
node tools/wizardtest.js
node tools/banktest.js
node tools/pinstest.js
```

- [ ] **Step 5: Передать пользователю**

Сообщить: всё зелёное, какие файлы изменены. Показать картинку превью кандидата (`out/pick-*.png` из прогона или `out/rowtest.png`). Сказать, что **в живом боте изменения появятся только после перезапуска `node bot.js`**, и что перезапуск — его решение. Самому бот не трогать. Напомнить про риск деплоя: с серверного IP bothost Пинтерест может отвечать иначе — проверить первым запуском там.

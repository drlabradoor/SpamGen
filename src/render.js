const fs=require('fs'),path=require('path'),os=require('os');
const {execFile}=require('child_process');
const {html}=require('./template');
const {CHROME_CSS,chromeHTML}=require('./chrome');
const {TAB_CSS,tabHTML}=require('./tabbar');
const {prefetch}=require('./emoji');
const {normalize,listTopFor}=require('./model');
const {injectRaw}=require('../tools/p3');
const {chromePath}=require('./chromepath');

const ROOT=path.join(__dirname,'..');
const P3=path.join(ROOT,'assets','p3-chunks.bin');

function buildHTML(cfg){
  let h=html(cfg);
  h=h.replace('</style>',CHROME_CSS+TAB_CSS+'</style>')
     .replace('<div id="list"',chromeHTML(cfg.chrome||{})+'<div id="list"');
  if(h.indexOf('id="status"')<0)throw new Error('chrome injection failed');
  return h+tabHTML(cfg.tab);
}

function shoot(htmlPath,pngPath,w,h){
  return new Promise((res,rej)=>{
    execFile(chromePath(),['--headless=old','--disable-gpu','--no-sandbox','--hide-scrollbars',
      '--no-first-run','--disable-extensions','--disable-background-networking',
      '--disable-lcd-text','--font-render-hinting=none',
      '--user-data-dir='+path.join(ROOT,'.chrome'),
      '--force-device-scale-factor=3','--window-size='+(w||390)+','+(h||844),
      '--screenshot='+pngPath,'file:///'+htmlPath.split(path.sep).join('/').replace(/^\/+/,'')],
      {timeout:60000},err=>err?rej(err):res());
  });
}

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
    // With a pinned chat on top, the header shares the pinned block's grey.
    if(cfg.rows[0]&&cfg.rows[0].pin){cfg.chrome=cfg.chrome||{};cfg.chrome.pinnedTop=cfg.listTop;}
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

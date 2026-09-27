// Re-fit every text style against ref/IMG_premium.PNG (the newest Telegram build).
// Targets are ink widths in device px @3x, measured from that screenshot.
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const ROOT=path.join(__dirname,'..');
const A='file:///'+path.join(ROOT,'assets').split(path.sep).join('/')+'/';

const TARGETS=[
  {id:'name-lat', text:'Dmitriy',                 w:161, faces:['Display-Bold','Text-Bold'],       sizes:[15.6,16,16.2,16.4,16.8]},
  {id:'name-cyr', text:'Камила Айтжанова',        w:450, faces:['Text-Bold','Display-Bold'],       sizes:[15.6,16,16.4,16.8,17.2]},
  {id:'preview',  text:'просто на фото позирует', w:535, faces:['Text-Regular','Display-Regular'], sizes:[15.6,16,16.4,16.8,17.2]},
  {id:'time',     text:'23:38',                   w:109, faces:['Display-Medium','Text-Regular'],  sizes:[14.4,14.8,15.2,15.6,16]},
];

const faces=new Set();
TARGETS.forEach(t=>t.faces.forEach(f=>faces.add(f)));
let css='';
for(const f of faces)
  css+=`@font-face{font-family:F${f.replace(/-/g,'')};src:url('${A}fonts/SF-Pro-${f}.otf') format('opentype')}`;

let body='',map=[],n=0;
for(const t of TARGETS)for(const f of t.faces)for(const s of t.sizes){
  body+=`<p style="top:${n*40}px;font-family:F${f.replace(/-/g,'')};font-size:${s}px">${t.text}</p>`;
  map.push({id:t.id,face:f,size:s,target:t.w}); n++;
}
const H=n*40+40;
fs.writeFileSync(path.join(ROOT,'out','fitall.html'),
  `<!doctype html><meta charset=utf-8><style>${css}
html,body{margin:0;width:600px;height:${H}px;background:#000;color:#fff}
p{margin:0;position:absolute;left:20px;white-space:nowrap;-webkit-font-smoothing:antialiased}</style>${body}`);

execFileSync(require('../src/chromepath').chromePath(),
  ['--headless=old','--disable-gpu','--no-sandbox','--hide-scrollbars','--no-first-run',
   '--disable-extensions','--disable-background-networking','--disable-lcd-text',
   '--font-render-hinting=none','--user-data-dir='+path.join(ROOT,'.chrome'),
   '--force-device-scale-factor=3','--window-size=600,'+H,
   '--screenshot='+path.join(ROOT,'out','fitall.png'),
   'file:///'+path.join(ROOT,'out','fitall.html').split(path.sep).join('/')],{timeout:60000});

const {decode,px}=require('./png');
const img=decode(path.join(ROOT,'out','fitall.png'));
const bg=c=>c[0]<40&&c[1]<40&&c[2]<40;
function width(y0,y1){let a=9999,b=-1,c=-1,d=-1;
  for(let y=y0;y<=y1;y++)for(let x=0;x<1800;x++)if(!bg(px(img,x,y))){
    if(x<a)a=x;if(x>b)b=x;if(c<0)c=y;d=y;}
  return b<0?null:{w:b-a+1,h:d-c+1};}

const best={};
map.forEach((m,i)=>{
  const r=width(i*120,i*120+118);
  if(!r)return;
  const err=Math.abs(r.w-m.target);
  if(!best[m.id]||err<best[m.id].err)best[m.id]={...m,got:r.w,h:r.h,err};
});
for(const id in best){
  const b=best[id];
  console.log(id.padEnd(10)+b.face.padEnd(16)+b.size+'px  -> w'+b.got+' (target '+b.target+', off '+b.err+') h'+b.h);
}

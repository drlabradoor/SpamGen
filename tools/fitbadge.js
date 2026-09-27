// Fit the tab-bar badge type against ref/IMG_premium.PNG.
// Ink targets in device px @3x, measured off the reference:
//   "456" w68 h28   "410" w62 h28   "2" w18 h28
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const ROOT=path.join(__dirname,'..');
const A='file:///'+path.join(ROOT,'assets').split(path.sep).join('/')+'/';

const TEXTS=[{t:'456',w:68},{t:'410',w:62},{t:'2',w:18}];
const FACES=['Display-Regular','Text-Regular','Display-Medium'];
const SIZES=[12.5,12.8,13,13.2,13.4,13.6,14];

let css='';
for(const f of FACES)css+=`@font-face{font-family:F${f.replace(/-/g,'')};src:url('${A}fonts/SF-Pro-${f}.otf') format('opentype')}`;
let body='',map=[],n=0;
for(const f of FACES)for(const s of SIZES)for(const t of TEXTS){
  body+=`<p style="top:${n*40}px;font-family:F${f.replace(/-/g,'')};font-size:${s}px">${t.t}</p>`;
  map.push({face:f,size:s,text:t.t,target:t.w});n++;
}
const H=n*40+40;
fs.writeFileSync(path.join(ROOT,'out','fitbadge.html'),
  `<!doctype html><meta charset=utf-8><style>${css}
html,body{margin:0;width:300px;height:${H}px;background:#000;color:#fff}
p{margin:0;position:absolute;left:20px;white-space:nowrap;-webkit-font-smoothing:antialiased}</style>${body}`);

execFileSync(require('../src/chromepath').chromePath(),
  ['--headless=old','--disable-gpu','--no-sandbox','--hide-scrollbars','--no-first-run',
   '--disable-extensions','--disable-background-networking','--disable-lcd-text',
   '--font-render-hinting=none','--user-data-dir='+path.join(ROOT,'.chrome'),
   '--force-device-scale-factor=3','--window-size=300,'+H,
   '--screenshot='+path.join(ROOT,'out','fitbadge.png'),
   'file:///'+path.join(ROOT,'out','fitbadge.html').split(path.sep).join('/')],{timeout:60000});

const {decode,px}=require('./png');
const img=decode(path.join(ROOT,'out','fitbadge.png'));
const bg=c=>c[0]<40&&c[1]<40&&c[2]<40;
function ink(y0,y1){let a=9999,b=-1,c=-1,d=-1;
  for(let y=y0;y<=y1&&y<img.h;y++)for(let x=0;x<900;x++)if(!bg(px(img,x,y))){
    if(x<a)a=x;if(x>b)b=x;if(c<0)c=y;d=y;}
  return b<0?null:{w:b-a+1,h:d-c+1};}

const acc={};
map.forEach((m,i)=>{
  const r=ink(i*120,i*120+118);if(!r)return;
  const k=m.face+' '+m.size;
  (acc[k]=acc[k]||{err:0,rows:[]});
  acc[k].err+=Math.abs(r.w-m.target);
  acc[k].rows.push(m.text+':w'+r.w+'/'+m.target+' h'+r.h);
});
Object.entries(acc).sort((a,b)=>a[1].err-b[1].err).slice(0,8)
  .forEach(([k,v])=>console.log(k.padEnd(22)+'err'+String(v.err).padStart(3)+'  '+v.rows.join('  ')));

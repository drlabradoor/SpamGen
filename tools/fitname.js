// Fit the name font against ref/IMG_premium.PNG: target is "Dmitriy" at
// string width 161, 'D' width 39, cap height 34 (device px @3x).
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const ROOT=path.join(__dirname,'..');
const A='file:///'+path.join(ROOT,'assets').split(path.sep).join('/')+'/';
const FACES={DB:'Display-Bold',TB:'Text-Bold',DS:'Display-Semibold',TS:'Text-Semibold'};
const SIZES=[15.2,15.6,16,16.4,16.8];

let css='',body='',map=[],n=0;
for(const k in FACES)
  css+=`@font-face{font-family:${k};src:url('${A}fonts/SF-Pro-${FACES[k]}.otf') format('opentype')}`;
for(const k in FACES)for(const s of SIZES){
  body+=`<p style="top:${n*40}px;font-family:${k};font-size:${s}px">Dmitriy</p>`;
  map.push(k+' '+s); n++;
}
fs.writeFileSync(path.join(ROOT,'out','fit.html'),
  `<!doctype html><meta charset=utf-8><style>${css}
html,body{margin:0;width:390px;height:${n*40+40}px;background:#000;color:#fff}
p{margin:0;position:absolute;left:20px;white-space:nowrap;-webkit-font-smoothing:antialiased}</style>${body}`);

execFileSync(require('../src/chromepath').chromePath(),
  ['--headless=old','--disable-gpu','--no-sandbox','--hide-scrollbars','--no-first-run',
   '--disable-extensions','--disable-background-networking','--disable-lcd-text',
   '--font-render-hinting=none','--user-data-dir='+path.join(ROOT,'.chrome'),
   '--force-device-scale-factor=3','--window-size=390,'+(n*40+40),
   '--screenshot='+path.join(ROOT,'out','fit.png'),
   'file:///'+path.join(ROOT,'out','fit.html').split(path.sep).join('/')],{timeout:60000});

const {decode,px}=require('./png');
const img=decode(path.join(ROOT,'out','fit.png'));
const bg=c=>c[0]<40&&c[1]<40&&c[2]<40;
function box(x0,x1,y0,y1){let a=9999,b=-1,c=-1,d=-1;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(!bg(px(img,x,y))){
    if(x<a)a=x;if(x>b)b=x;if(c<0)c=y;d=y;}
  return b<0?null:{w:b-a+1,h:d-c+1,x0:a,y0:c};}

console.log('TARGET  string w161, D w39, cap 34');
map.forEach((m,i)=>{
  const all=box(0,1169,i*120,i*120+118);
  if(!all)return;
  const D=box(all.x0,all.x0+46,i*120,i*120+118);
  console.log(m.padEnd(10)+'str w'+String(all.w).padStart(3)+
    '  D w'+D.w+' cap'+D.h);
});

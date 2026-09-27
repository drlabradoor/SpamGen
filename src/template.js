const path=require('path');
const A='file:///'+path.join(__dirname,'..','assets').split(path.sep).join('/').replace(/^\/+/,'')+'/';
const d=v=>v/3;

const CSS=`
/* Calibrated against ref/IMG_premium.PNG — the newest Telegram build on the
   user's phone. The older references use a ~8% smaller face; do not mix them. */
@font-face{font-family:NAME;src:url('${A}fonts/SF-Pro-Display-Bold.otf') format('opentype');
  ascent-override:100%;descent-override:25%;line-gap-override:0%}
@font-face{font-family:PREV;src:url('${A}fonts/SF-Pro-Display-Regular.otf') format('opentype')}
@font-face{font-family:TIME;src:url('${A}fonts/SF-Pro-Display-Medium.otf') format('opentype')}
@font-face{font-family:BADGE;src:url('${A}fonts/SF-Pro-Display-Semibold.otf') format('opentype')}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:390px;height:844px;background:#000;overflow:hidden;-webkit-font-smoothing:antialiased}
#list{position:absolute;left:0;top:var(--listtop,${d(341)}px);width:390px}
.row{position:relative;height:76px;background:#000}
.row.pinned{background:#1c1c1c}

.av{position:absolute;left:16px;top:8px;width:60px;height:60px;border-radius:50%;
  background:linear-gradient(180deg,var(--c1),var(--c2));overflow:hidden}
.av img{width:100%;height:100%;object-fit:cover}
/* unseen story: gradient rim with a black gap, same construction as the header */
.av.ring{background:linear-gradient(150deg,#63d68a,#3aa0f0);padding:${d(7)}px}
.av.ring>.in{width:100%;height:100%;border-radius:50%;background:#000;
  padding:${d(9)}px;box-sizing:border-box;overflow:hidden}
.av.ring>.in img{border-radius:50%}
.av.ring>.in span{border-radius:50%}
.av span{display:block;width:100%;height:100%;line-height:60px;text-align:center;
  font-family:NAME;font-size:26px;color:#fff}
/* Emoji in place of the letter. Same 1.14 glyph-to-font ratio as the name emoji
   (.em2: 56 device px on a 16.4px face), applied to the 26px letter face. */
.av span.e{display:flex;align-items:center;justify-content:center}
.av span.e img.aem{width:30px;height:30px;object-fit:contain}
.dot{position:absolute;left:${d(170)}px;top:${d(153)}px;width:${d(48)}px;height:${d(48)}px;
  border-radius:50%;background:#38c759;border:${d(9)}px solid var(--rowbg)}

.nmwrap{position:absolute;left:${d(259)}px;top:${d(21)}px;display:flex;align-items:center;
  gap:${d(21)}px;max-width:${d(970-259)}px;height:${d(60)}px}
.nm{font-family:NAME;font-size:16.4px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nmwrap img{flex:none;display:block}
.em2{flex:none;width:${d(56)}px;height:${d(56)}px;display:block}
/* Layout box stays one em so the 20px line pitch survives; scale() gives the
   real 56px look. The horizontal margin gives back the space the scale eats. */
.em{width:1em;height:1em;vertical-align:-0.14em;display:inline-block;
  transform:scale(1.25);margin:0 ${d(6)}px}
.sym{font-size:0.8em;color:#7c7c7c}
.i-mute{width:${d(34)}px;height:${d(34)}px}
.star{flex:none;width:${d(46)}px;height:${d(44)}px}
/* A Premium status emoji replaces the star rather than joining it. Measured off
   ref/IMG_premium.PNG: the star inks 46x44, the status emoji next to Карина
   Мартиросян inks 58x54 — a 60px box (20pt at @3x) with the usual glyph
   padding. Same flex gap after the name for both. */
.st{flex:none;width:${d(60)}px;height:${d(60)}px;margin-left:${d(-9)}px}

/* Media in the last message shows as 54px tiles ahead of the text */
.th{display:inline-block;width:${d(54)}px;height:${d(54)}px;border-radius:${d(10)}px;
  object-fit:cover;vertical-align:${d(-12)}px;margin-right:${d(6)}px}
.th.last{margin-right:${d(20)}px}
/* Right edge 982. Telegram's real edge is wider — it sits a fixed gap left of the
   unread badge, and ref/IMG_6276.PNG puts truncated preview lines out to x986-998
   — but our SF Pro runs about 1.5% wide against iOS's, so a box set to the true
   edge fits a word iOS dropped. 982 absorbs that difference and reproduces the
   reference's line breaks; widening it made them worse, not better. */
.pv{position:absolute;left:${d(259)}px;top:${d(84)}px;font-family:PREV;font-size:16.25px;
  color:#8d8e92;line-height:20px;width:${d(982-259)}px;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}

.right{position:absolute;right:${d(52)}px;top:${d(31)}px;display:flex;align-items:center;gap:${d(14)}px}
.tm{font-family:TIME;font-size:14px;color:#8c8d92}
.right img{display:block}
.i-ck2{width:${d(48)}px;height:${d(29)}px}
.i-ck1{width:${d(36)}px;height:${d(29)}px}

.bd{position:absolute;right:${d(48)}px;top:${d(118)}px;height:${d(60)}px;min-width:${d(60)}px;
  border-radius:${d(30)}px;background:#5286ef;color:#fff;font-family:BADGE;font-size:12px;
  line-height:${d(60)}px;text-align:center;padding:0 6px}
.bd.mute{background:#666666}
.i-pin{position:absolute;right:${d(58)}px;top:${d(131)}px;width:${d(43)}px;height:${d(38)}px}
.sep{position:absolute;left:${d(258)}px;right:${d(48)}px;top:0;height:${d(1)}px;background:#2e2e30}
.pinned .sep{background:#3b3b3d}
`;

const {markup,RE}=require('./emoji');
const esc=s=>String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
// Telegram falls back to another face for ™ © ®: they come out smaller and much
// dimmer than the surrounding text.
const syms=s=>s.replace(/[™©®]/g,c=>`<span class="sym">${c}</span>`);
// Telegram keeps the message's own line breaks in the preview — ref/IMG_6276.PNG
// breaks "*Deriv-Server MT5 Account*" off its own line well short of the right
// edge. HTML would swallow the newline, so it becomes a <br>.
const brk=s=>s.split(String.fromCharCode(10)).join('<br>');
// Real Premium star, alpha-keyed from a reference screenshot — solid blue,
// not the gradient one often drawn from memory.
const STAR=`<img class="star" src="${A}icons/premium.png">`;

// Telegram's 7 avatar gradients, picked by name hash like the real client
const PALETTE=[['#ff845e','#d45246'],['#fdb44a','#f68136'],['#b694f9','#8f5fe8'],
 ['#a0de7e','#54cb68'],['#53edd6','#28c9b7'],['#72d5fd','#2a9ef1'],['#e0a2f3','#d669ed']];
function hue(s){let h=0;for(const ch of String(s))h=(h*31+ch.codePointAt(0))>>>0;return PALETTE[h%7];}

// The letter is the first grapheme of the name, not its first UTF-16 unit —
// [0] split 🔥 in half and drew a broken glyph. Telegram puts a leading emoji on
// the gradient as-is, so it comes out as Apple's picture, not as text.
const SEG=new Intl.Segmenter();
function initial(name){
  const s=String(name==null?'':name).trim();
  const g=s?SEG.segment(s)[Symbol.iterator]().next().value.segment:'?';
  const m=g.match(RE);
  if(m&&m[0]===g){
    const img=markup(g);
    if(img!==g)return `<span class="e">${img.replace('class="em"','class="aem"')}</span>`;
  }
  return `<span>${esc(g)}</span>`;
}

function row(r,first){
  const bg=r.pin?'#1c1c1c':'#000';
  const g=r.c1?[r.c1,r.c2||r.c1]:hue(r.name);
  const inner=r.photo?`<img src="${r.photo}">`:initial(r.name);
  const av=r.ring?`<div class="in">${inner}</div>`:inner;
  const thumbs=(r.thumbs||[]).map((t,i,a)=>
    `<img class="th${i===a.length-1?' last':''}" src="${t}">`).join('');
  // Emoji in a name are flex siblings of the text, not inline with it: Telegram
  // ellipsises the words but never clips the emoji. Order is preserved, so a
  // leading "📊 Signals2Trade" stays leading.
  const raw=String(r.name==null?'':r.name);
  let nameHTML='',cursor=0;
  for(const m of raw.matchAll(RE)){
    const before=raw.slice(cursor,m.index).trim();
    if(before)nameHTML+=`<div class="nm">${syms(esc(before))}</div>`;
    nameHTML+=markup(m[0]).replace('class="em"','class="em2"');
    cursor=m.index+m[0].length;
  }
  const tail=raw.slice(cursor).trim();
  if(tail)nameHTML+=`<div class="nm">${syms(esc(tail))}</div>`;
  if(!nameHTML)nameHTML=`<div class="nm">${syms(esc(raw))}</div>`;
  const ck=r.check===2?`<img class="i-ck2" src="${A}icons/check2.png">`
          :r.check===1?`<img class="i-ck1" src="${A}icons/check1.png">`:'';
  return `<div class="row${r.pin?' pinned':''}" style="--c1:${g[0]};--c2:${g[1]};--rowbg:${bg}">
    <div class="av${r.ring?' ring':''}">${av}</div>${r.online?'<div class="dot"></div>':''}
    <div class="nmwrap">${nameHTML}${r.status?`<img class="st" src="${r.status}">`:r.premium?STAR:''}${r.mute?`<img class="i-mute" src="${A}icons/mute.png">`:''}</div>
    <div class="pv">${thumbs}${brk(syms(markup(esc(r.text))))}</div>
    <div class="right">${ck}<div class="tm">${esc(r.time)}</div></div>
    ${r.badge?`<div class="bd${r.mute?' mute':''}">${esc(r.badge)}</div>`
      :r.pin?`<img class="i-pin" src="${A}icons/pin.png">`:''}
    ${first?'':'<div class="sep"></div>'}
  </div>`;
}
function html(cfg){
  return `<!doctype html><meta charset="utf-8"><style>${CSS}</style><div id="list" style="--listtop:${d(cfg.listTop??341)}px">`
    +cfg.rows.map((r,i)=>row(r,i===0)).join('')+`</div>`;
}
module.exports={html,CSS};

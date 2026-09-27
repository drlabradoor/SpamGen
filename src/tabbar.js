const path=require('path');
const A='file:///'+path.join(__dirname,'..','assets').split(path.sep).join('/').replace(/^\/+/,'')+'/';
const d=v=>v/3;
const TAB_CSS=`
#tab{position:absolute;left:0;top:0;width:390px;height:844px;pointer-events:none}
.tb-pill{position:absolute;left:${d(57)}px;top:${d(2280)}px;width:${d(840)}px;height:${d(192)}px;
  border-radius:${d(96)}px;background:rgba(255,255,255,.09);backdrop-filter:blur(${d(60)}px) saturate(1.6);
  -webkit-backdrop-filter:blur(${d(60)}px) saturate(1.6);
  box-shadow:inset 0 ${d(2)}px 0 rgba(255,255,255,.13)}
.tb-circ{position:absolute;left:${d(918)}px;top:${d(2280)}px;width:${d(204)}px;height:${d(192)}px;
  border-radius:${d(96)}px;background:rgba(255,255,255,.09);backdrop-filter:blur(${d(60)}px) saturate(1.6);
  -webkit-backdrop-filter:blur(${d(60)}px) saturate(1.6);
  box-shadow:inset 0 ${d(2)}px 0 rgba(255,255,255,.13)}
/* The selected tab's plate wraps the icon AND its label — it is a tall squircle,
   not a pill around the glyph. */
.tb-hl{position:absolute;left:${d(476)}px;top:${d(2291)}px;width:${d(204)}px;height:${d(165)}px;
  border-radius:${d(72)}px;background:rgba(255,255,255,.10)}
#tab img{position:absolute}
.i-con{left:${d(136)}px;top:${d(2317)}px;width:${d(70)}px;height:${d(70)}px}
.i-cal{left:${d(340)}px;top:${d(2319)}px;width:${d(66)}px;height:${d(66)}px}
.i-cha{left:${d(534)}px;top:${d(2307)}px;width:${d(113)}px;height:${d(81)}px}
.i-set{position:absolute;left:${d(741)}px;top:${d(2307)}px;width:${d(78)}px;height:${d(78)}px;
  border-radius:50%;overflow:hidden;background:#4a4a4e}
.i-set img{width:100%;height:100%;object-fit:cover}
.i-sea{left:${d(981)}px;top:${d(2344)}px;width:${d(63)}px;height:${d(64)}px}
.tb-lb{position:absolute;font-family:HDR;font-size:${d(33)}px;color:#fff;white-space:nowrap}
.tb-lb.on{color:#3478f5}
/* Measured off ref/IMG_premium.PNG: the capsule is 51 device px tall, the red is
   a muted coral in P3 and the digits are Regular, not Semibold. Telegram anchors
   the badge BY ITS RIGHT EDGE and grows it leftwards over the icon as the count
   gains digits — left-anchored, a three-digit count walks off the tab. Digits are
   proportional (the reference's "410" is 6px narrower than its "456", so no
   tabular figures); this padding and tracking hit all three reference widths:
   "2" 54, "410" 99, "456" 105 device px. */
.tb-bd{position:absolute;top:${d(2307)}px;height:${d(51)}px;min-width:${d(54)}px;
  border-radius:${d(25.5)}px;background:#da5f4d;color:#fff;font-family:HDRR;
  font-size:${d(39)}px;line-height:${d(51)}px;letter-spacing:${d(2.16)}px;
  text-align:center;padding:0 ${d(14.25)}px}
.tb-bd.on-chats{right:${d(1170-647)}px}
.tb-bd.on-sett{right:${d(1170-849)}px}
`;
function tabHTML(t){
  t=t||{};
  // Defaults are "nothing": a clean account has no Settings badge, and the
  // Chats count is derived from the list by model.normalize().
  const chats=t.chats||0, sett=t.settings||0;
  return `<div id="tab">
   <div class="tb-pill"></div><div class="tb-circ"></div>
   <div class="tb-hl"></div>
   <img class="i-con" src="${A}icons/tb_contacts.png">
   <img class="i-cal" src="${A}icons/tb_calls.png">
   <img class="i-cha" src="${A}icons/tb_chats.png">
   <div class="i-set">${t.avatar?`<img src="${t.avatar}">`:''}</div>
   <img class="i-sea" src="${A}icons/tb_search.png">
   <div class="tb-lb" style="left:${d(104)}px;top:${d(2402)}px">Contacts</div>
   <div class="tb-lb" style="left:${d(339)}px;top:${d(2402)}px">Calls</div>
   <div class="tb-lb on" style="left:${d(531)}px;top:${d(2402)}px">Chats</div>
   <div class="tb-lb" style="left:${d(716)}px;top:${d(2402)}px">Settings</div>
   ${chats?`<div class="tb-bd on-chats">${chats}</div>`:''}
   ${sett?`<div class="tb-bd on-sett">${sett}</div>`:''}
  </div>`;
}
module.exports={TAB_CSS,tabHTML};

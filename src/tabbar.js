const path=require('path');
const A='file:///'+path.join(__dirname,'..','assets').split(path.sep).join('/').replace(/^\/+/,'')+'/';
const d=v=>v/3;
const TAB_CSS=`
#tab{position:absolute;left:0;top:0;width:390px;height:844px;pointer-events:none}
.tb-pill{position:absolute;left:${d(174)}px;top:${d(2283)}px;width:${d(822)}px;height:${d(188)}px;
  border-radius:${d(94)}px;background:rgba(255,255,255,.15);backdrop-filter:blur(${d(60)}px) saturate(1.6);
  -webkit-backdrop-filter:blur(${d(60)}px) saturate(1.6);
  box-shadow:inset 0 ${d(3)}px ${d(2)}px rgba(255,255,255,.22)}
/* 2026-11 update (ref/IMG_new.png): three tabs — Calls, Chats, Settings — in
   one centred bar, no Contacts and no search disc. The selected tab sits on a
   DARK capsule now, not a light one. */
.tb-hl{position:absolute;left:${d(449)}px;top:${d(2295)}px;width:${d(272)}px;height:${d(164)}px;
  border-radius:${d(82)}px;background:rgba(0,0,0,.62)}
#tab img{position:absolute}
.i-cal{left:${d(294)}px;top:${d(2322)}px;width:${d(66)}px;height:${d(66)}px}
.i-cha{left:${d(544)}px;top:${d(2310)}px;width:${d(113)}px;height:${d(81)}px}
.i-set{position:absolute;left:${d(802)}px;top:${d(2316)}px;width:${d(77)}px;height:${d(77)}px;
  border-radius:50%;overflow:hidden;background:#4a4a4e}
.i-set img{width:100%;height:100%;object-fit:cover}
.tb-lb{position:absolute;font-family:HDR;font-size:${d(33)}px;color:#fff;white-space:nowrap}
.tb-lb.on{color:#3478f5}
/* Measured off ref/IMG_premium.PNG: the capsule is 51 device px tall, the red is
   a muted coral in P3 and the digits are Regular, not Semibold. Telegram anchors
   the badge BY ITS RIGHT EDGE and grows it leftwards over the icon as the count
   gains digits — left-anchored, a three-digit count walks off the tab. Digits are
   proportional (the reference's "410" is 6px narrower than its "456", so no
   tabular figures); this padding and tracking hit all three reference widths:
   "2" 54, "410" 99, "456" 105 device px. */
.tb-bd{position:absolute;top:${d(2310)}px;height:${d(51)}px;min-width:${d(54)}px;
  border-radius:${d(25.5)}px;background:#da5f4d;color:#fff;font-family:HDRR;
  font-size:${d(39)}px;line-height:${d(51)}px;letter-spacing:${d(2.16)}px;
  text-align:center;padding:0 ${d(14.25)}px}
.tb-bd.on-chats{right:${d(1170-657)}px}
.tb-bd.on-sett{right:${d(1170-911)}px}
`;
function tabHTML(t){
  t=t||{};
  // Defaults are "nothing": a clean account has no Settings badge, and the
  // Chats count is derived from the list by model.normalize().
  const chats=t.chats||0, sett=t.settings||0;
  return `<div id="tab">
   <div class="tb-pill"></div>
   <div class="tb-hl"></div>
   <img class="i-cal" src="${A}icons/tb_calls.png">
   <img class="i-cha" src="${A}icons/tb_chats.png">
   <div class="i-set">${t.avatar?`<img src="${t.avatar}">`:''}</div>
   <div class="tb-lb" style="left:${d(289)}px;top:${d(2402)}px">Calls</div>
   <div class="tb-lb on" style="left:${d(540)}px;top:${d(2402)}px">Chats</div>
   <div class="tb-lb" style="left:${d(781)}px;top:${d(2402)}px">Settings</div>
   ${chats?`<div class="tb-bd on-chats">${chats}</div>`:''}
   ${sett?`<div class="tb-bd on-sett">${sett}</div>`:''}
  </div>`;
}
module.exports={TAB_CSS,tabHTML};

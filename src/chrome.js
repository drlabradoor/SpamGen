const path=require('path');
const A='file:///'+path.join(__dirname,'..','assets').split(path.sep).join('/').replace(/^\/+/,'')+'/';
const d=v=>v/3;

// Two list offsets, both measured: with the search field visible (scrolled to
// the very top) and without it.
const LIST_TOP_SEARCH=503;
const LIST_TOP_PLAIN=341;

const CHROME_CSS=`
@font-face{font-family:HDR;src:url('${A}fonts/SF-Pro-Display-Semibold.otf') format('opentype')}
@font-face{font-family:HDRR;src:url('${A}fonts/SF-Pro-Display-Regular.otf') format('opentype')}
#status{position:absolute;left:0;top:0;width:390px;height:${d(120)}px}
#status img{position:absolute}
/* iOS centres the left status group in its "ear", so the clock shifts when the
   location arrow appears next to it. */
.st-left{position:absolute;left:0;top:${d(48)}px;width:${d(380)}px;height:${d(50)}px;
  display:flex;align-items:center;justify-content:center;gap:${d(17)}px}
.st-left b{font-family:HDR;font-size:17px;color:#fff;font-weight:400;line-height:1}
.st-left img{position:static;width:${d(39)}px;height:${d(39)}px}
.st-isl{left:${d(446)}px;top:${d(15)}px;width:${d(277)}px;height:${d(66)}px}
.st-sig{left:${d(856)}px;top:${d(59)}px;width:${d(58)}px;height:${d(37)}px}
.st-net{left:${d(934)}px;top:${d(63)}px;width:${d(54)}px;height:${d(32)}px}
.st-wifi{left:${d(936)}px;top:${d(59)}px;width:${d(51)}px;height:${d(37)}px}
.bat{position:absolute;left:${d(1008)}px;top:${d(57)}px;width:${d(78)}px;height:${d(41)}px;
  border-radius:${d(13)}px;background:#7f7f7f;overflow:hidden}
.bat i{position:absolute;left:0;top:0;bottom:0;display:block}
.bat u{position:absolute;left:0;right:0;top:0;bottom:0;font-family:HDR;font-size:${d(34)}px;
  font-weight:700;display:flex;align-items:center;justify-content:center;gap:${d(2)}px;
  color:#000;line-height:1;text-decoration:none;font-style:normal}
.bat u svg{width:${d(20)}px;height:${d(30)}px;fill:#000;display:block}
.batnub{position:absolute;left:${d(1088)}px;top:${d(70)}px;width:${d(6)}px;height:${d(16)}px;
  background:#7f7f7f;border-radius:0 ${d(3)}px ${d(3)}px 0}

#hdr{position:absolute;left:0;top:0;width:390px}
.pill{position:absolute;top:${d(171)}px;height:${d(132)}px;border-radius:${d(66)}px;background:#181818}
.pill-l{left:${d(48)}px;width:${d(165)}px}
.pill-r{left:${d(858)}px;width:${d(264)}px}
.pill span{display:block;text-align:center;font-family:HDR;font-size:17.5px;color:#fff;line-height:${d(132)}px}
.hdr-av{position:absolute;left:${d(456)}px;top:${d(191)}px;width:${d(93)}px;height:${d(93)}px;
  border-radius:50%;background:linear-gradient(150deg,#63d68a,#3aa0f0);padding:${d(5)}px;box-sizing:border-box}
.hdr-av>div{width:100%;height:100%;border-radius:50%;background:#000;padding:${d(3)}px;box-sizing:border-box;overflow:hidden}
.hdr-av img{width:100%;height:100%;object-fit:cover;border-radius:50%}
.hdr-ti{position:absolute;top:${d(206)}px;font-family:HDR;font-size:17.5px;color:#fff}
.hdr-ti.with-av{left:${d(563)}px}
.hdr-ti.solo{left:${d(526)}px}
.h-plus{position:absolute;left:${d(870)}px;top:${d(180)}px;width:${d(83)}px;height:${d(86)}px}
.h-comp{position:absolute;left:${d(1030)}px;top:${d(204)}px;width:${d(81)}px;height:${d(92)}px}

#search{position:absolute;left:${d(48)}px;top:${d(333)}px;width:${d(1074)}px;height:${d(128)}px;
  border-radius:${d(64)}px;background:#191919;display:flex;align-items:center;
  justify-content:center;gap:${d(27)}px}
#search img{width:${d(48)}px;height:${d(48)}px;display:block}
#search span{font-family:HDRR;font-size:17.5px;color:#8f8f8f;line-height:1}
`;

function chromeHTML(c){
  c=c||{};
  const pct=c.battery==null?9:c.battery;
  const charging=c.charging!==false;
  // Low Power Mode paints the battery yellow at any level. Both references have it
  // on — that is why a 45% battery is yellow on ref/IMG_6276.PNG — so the old
  // "yellow below 20" rule was really "yellow because low power". Keep it as the
  // default guess, let a config say so outright.
  const low=c.lowpower==null?pct<=20:!!c.lowpower;
  const net=c.net==='wifi'
    ? `<img class="st-wifi" src="${A}icons/wifi.png">`
    : `<img class="st-net" src="${A}icons/net4g.png">`;
  const geo=c.geo?`<img src="${A}icons/geo.png">`:'';
  const bolt='<svg viewBox="0 0 10 16"><path d="M6.6 0 0.7 8.6h3.3L3.2 16 9.3 7.1H5.9L6.6 0z"/></svg>';
  // No story avatar in the header: the title is always centred on its own.
  // The account picture lives on the Settings tab, and nowhere else.
  return `<div id="status">
    <div class="st-left"><b>${c.time||'19:15'}</b>${geo}</div>
    ${c.island===false?'':`<img class="st-isl" src="${A}icons/island.png">`}
    <img class="st-sig" src="${A}icons/signal.png">
    ${net}
    <div class="bat"><i style="width:${pct}%;background:${low?'#f8d748':'#fff'}"></i><u>${pct}${charging?bolt:''}</u></div>
    <div class="batnub"></div>
  </div>
  <div id="hdr">
    <div class="pill pill-l"><span>Edit</span></div>
    <div class="hdr-ti solo">Chats</div>
    <div class="pill pill-r"></div>
    <img class="h-plus" src="${A}icons/hplus.png">
    <img class="h-comp" src="${A}icons/hcompose.png">
  </div>
  ${c.search===false?'':`<div id="search"><img src="${A}icons/search.png"><span>Search</span></div>`}`;
}
module.exports={CHROME_CSS,chromeHTML,LIST_TOP_SEARCH,LIST_TOP_PLAIN};

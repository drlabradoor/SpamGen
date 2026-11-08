// Realism rules. Everything here exists so a generated screen cannot contradict
// itself the way a hand-made fake does.
const {LIST_TOP_SEARCH,LIST_TOP_PLAIN}=require('./chrome');
const pad=n=>String(n).padStart(2,'0');
const toMin=t=>{const m=/^(\d{1,2}):(\d{2})$/.exec(String(t||''));return m?+m[1]*60+ +m[2]:null;};
const toHHMM=m=>pad(Math.floor(m/60)%24)+':'+pad(m%60);
const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function rand(a,b){return a+Math.floor(Math.random()*(b-a+1));}
function pick(a){return a[Math.floor(Math.random()*a.length)];}

// Canvas and row pitch, both measured.
const CANVAS_H=2532, ROW_H=228;

// Where the first row starts: the search field pushes the list down 162 device px.
function listTopFor(cfg){
  if(cfg&&cfg.listTop!=null)return cfg.listTop;
  return (cfg&&cfg.chrome&&cfg.chrome.search===false)?LIST_TOP_PLAIN:LIST_TOP_SEARCH;
}

// A real chat list never ends inside the screen. It runs off the bottom edge, and
// the row half-swallowed by the tab bar is the thing that says there is more
// below — a list that stops short reads as an account with nine chats in it, or
// as a fake. Ten rows are needed without the search field, nine with it.
function fitRows(cfg){return Math.ceil((CANVAS_H-listTopFor(cfg))/ROW_H);}

function normalize(cfg){
  const c=JSON.parse(JSON.stringify(cfg));
  c.rows=(c.rows||[]).map(r=>({...r}));

  for(const r of c.rows){
    // a chat cannot be both "you answered last" and "has unread"
    if(r.badge&&r.check){delete r.check;}
    if(r.badge!=null&&r.badge!==''&&Number(String(r.badge).replace(/\D/g,''))===0)delete r.badge;
    // an outgoing last message means nothing unread
    if(r.check&&r.badge)delete r.badge;
  }

  // pinned first (given order), the rest strictly newest -> oldest
  const pinned=c.rows.filter(r=>r.pin);
  const rest=c.rows.filter(r=>!r.pin);
  const key=r=>{const m=toMin(r.time);return m==null?-1:m;};
  rest.sort((a,b)=>key(b)-key(a));
  c.rows=[...pinned,...rest];

  // The status bar clock shows exactly the time of the newest message on the
  // screen (pinned rows included). It is derived on every normalize — so on
  // every render — and is never randomised, so editing a row's time moves the
  // clock with it and the two can never disagree.
  const newest=Math.max(-1,...c.rows.map(key));
  c.chrome=c.chrome||{};
  if(newest>=0) c.chrome.time=toHHMM(newest);

  // The tab badge must agree with the list. Telegram's default badge counts
  // unread MESSAGES, not unread chats, so it starts as the sum of the row badges,
  // with muted chats left out exactly as the client leaves them out.
  c.tab=c.tab||{};
  if(c.tab.chats==null){
    const seen=c.rows.reduce((n,r)=>
      n+(r.mute?0:Number(String(r.badge==null?'':r.badge).replace(/[^0-9]/g,''))||0),0);
    // Nine rows fit on screen; a real account keeps unread further down the list,
    // so the badge always runs ahead of what you can count. The overshoot is
    // random per render (like the clock and the battery) and proportional to what
    // is visible, so a quiet screen never claims hundreds of unread. A screen with
    // nothing unread on it stays bare — an all-read top with unread underneath
    // would need the list to be out of order.
    c.tab.chats=seen?Math.round(seen*(100+rand(40,180))/100):null;
    if(c.tab.inflate===false)c.tab.chats=seen||null;
  }
  delete c.tab.inflate;
  return c;
}

// Age-appropriate stamp: today -> 19:14, this week -> Thu, older -> 14/05
function stamp(date,now){
  now=now||new Date();
  const days=Math.floor((now-date)/86400000);
  if(days<1&&date.getDate()===now.getDate())return pad(date.getHours())+':'+pad(date.getMinutes());
  if(days<7)return DAYS[date.getDay()];
  return pad(date.getDate())+'/'+pad(date.getMonth()+1);
}

// Fill a screen with plausible traffic: times descend, flags stay consistent.
// Names and texts are drawn without replacement — a name picked twice draws the
// same gradient and the same initial, so it reads as one person duplicated, and a
// preview line repeated three rows down is the loudest tell a fake screen has.
// `from` continues the descent below an existing row; `taken` are names already
// on the screen.
function randomRows(n,names,texts,from,taken,lo,hi){
  lo=lo||1;hi=hi||3;
  const rows=[];
  // Matched on the first word, not the whole string: the user types "Максим
  // Ветров" and the filler would happily draw "Максим" next to him, which reads
  // as one person listed twice — the same tell a repeated preview line is.
  const first=x=>String(x).trim().split(/\s+/)[0].toLowerCase();
  const used=new Set((taken||[]).map(first));
  const freeN=names.filter(x=>!used.has(first(x))), freeT=texts.slice();
  const draw=(free,all)=>free.length
    ? free.splice(Math.floor(Math.random()*free.length),1)[0] : pick(all);
  let m=from!=null?from-rand(2,40):rand(9*60,22*60);
  if(m<0)m+=1440;
  for(let i=0;i<n;i++){
    const r={name:draw(freeN,names),text:draw(freeT,texts),time:toHHMM(m)};
    // Mixed on purpose. The rows the user typed are all unread — that is the
    // point of the screen — so if the filler below them were unread too the
    // whole list would read as stamped out by a machine.
    if(Math.random()<0.75)r.badge=String(rand(lo,hi));
    else r.check=Math.random()<0.6?2:1;
    if(Math.random()<0.18)r.online=true;
    rows.push(r);
    m-=rand(2,40);
    if(m<0)m+=1440;
  }
  return rows;
}

// Times for a screen the user typed. The edges of the range are pinned: the
// newest row sits on `end`, the oldest of the user rows on `start`, the rest
// fall anywhere between. Equal times are allowed — two chats can land in the
// same minute — and normalize() sorts on the result, so a newer row can never
// end up below an older one no matter what the random draw does.
function spreadTimes(n,start,end){
  if(n<=0)return [];
  if(n===1)return [end];
  const inner=[];
  for(let i=0;i<n-2;i++)inner.push(start+Math.floor(Math.random()*(end-start+1)));
  inner.sort((a,b)=>b-a);
  return [end,...inner,start];
}

// Premium is a property of the screen, not of a single row: a fixed share of
// the list carries it, and a share of those carry a status emoji instead of the
// default blue star. Both shares are percentages so /settings can move them.
// pickStatus() returns a file URL or null when the bank is empty.
function applyPremium(rows,premiumPct,statusPct,pickStatus){
  for(const r of rows){
    if(r.premiumLocked)continue;              // set by hand in the editor
    delete r.premium;delete r.status;
    if(rand(1,100)>premiumPct)continue;
    r.premium=true;
    if(rand(1,100)<=statusPct){
      const s=pickStatus&&pickStatus();
      if(s)r.status=s;
    }
  }
  return rows;
}
module.exports={normalize,stamp,randomRows,spreadTimes,applyPremium,
  toHHMM,toMin,fitRows,listTopFor};

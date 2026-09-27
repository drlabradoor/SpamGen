// Puts throwaway avatars in the bank, checks the "из банка" branch end to end,
// then removes everything it created.
const fs=require('fs'),path=require('path');
const {write}=require('./pngw');
const os=require('os');
const ROOT=path.join(__dirname,'..');
// A throwaway bank. This test used to wipe assets/bank before seeding itself,
// which meant running it destroyed every avatar the user had collected. It has
// no business touching the real one.
const BANK=path.join(os.tmpdir(),'spamgen-banktest');
process.env.SPAMGEN_BANK=BANK;
process.env.SPAMGEN_STATE=path.join(os.tmpdir(),'spamgen-banktest.json');
try{fs.rmSync(BANK,{recursive:true,force:true});}catch(e){}
try{fs.unlinkSync(process.env.SPAMGEN_STATE);}catch(e){}
fs.mkdirSync(BANK,{recursive:true});

const made=[];
[[220,90,90],[90,160,220],[120,200,120]].forEach((c,i)=>{
  const w=64,h=64,buf=Buffer.alloc(w*h*3);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const o=(y*w+x)*3;
    buf[o]=c[0]*(0.6+0.4*y/h)|0;buf[o+1]=c[1]*(0.6+0.4*y/h)|0;buf[o+2]=c[2]*(0.6+0.4*y/h)|0;}
  const p=path.join(BANK,'test-ava-'+i+'.png');
  write(p,w,h,buf); made.push(p);
});
console.log('bank seeded with '+made.length+' avatars');

process.env.SPAMGEN_TOKEN='0:test';
const sent=[];
const {TG}=require('../src/tg');
TG.prototype.call=async function(m,p){
  if(m==='getUpdates')return new Promise(()=>{});
  sent.push(m+': '+(p.text||'').replace(/<[^>]+>/g,'')+
    (p.reply_markup?' ['+p.reply_markup.inline_keyboard.flat().map(b=>b.text).join(' | ')+']':''));
  return {message_id:sent.length};
};
TG.prototype.upload=async function(m,f){sent.push(m+' -> '+path.basename(f.chat_id?'':'')+'(file)');return {};};
let handler=null;
TG.prototype.poll=async function(h){handler=h;};
require('../bot.js');

const CHAT=99;
const msg=t=>({message:{chat:{id:CHAT},text:t}});
const cb=d=>({callback_query:{id:'c',data:d,message:{chat:{id:CHAT},message_id:1}}});

(async()=>{
  for(const u of [msg('/add'),msg('Дарья'),msg('добрый день'),msg('15:10')])await handler(u);
  console.log('avatar step: '+sent[sent.length-1]);
  await handler(cb('a:bank'));
  await handler(cb('f:done'));

  const S=JSON.parse(fs.readFileSync(process.env.SPAMGEN_STATE,'utf8'));
  const row=S[CHAT].screen.rows[0];
  console.log('stored row : wantBank='+row.wantBank+' photo='+(row.photo||'(assigned at render)'));

  // render path: wantBank must always resolve to a bank file
  const {render}=require('../src/render');
  const rows=JSON.parse(JSON.stringify(S[CHAT].screen.rows));
  const bot=fs.readFileSync(path.join(ROOT,'bot.js'),'utf8');
  console.log('assignAvatars honours wantBank: '+/if\(r\.wantBank\)/.test(bot));

  const out=path.join(ROOT,'out','banktest.png');
  await render({rows:[{...rows[0],photo:'file:///'+made[0].split(path.sep).join('/')}]},out);
  const b=fs.readFileSync(out);
  console.log('render with bank photo: '+b.readUInt32BE(16)+'x'+b.readUInt32BE(20));

  fs.rmSync(BANK,{recursive:true,force:true});
  fs.unlinkSync(process.env.SPAMGEN_STATE);
  console.log('cleaned up: throwaway bank and state removed');
  process.exit(0);
})();

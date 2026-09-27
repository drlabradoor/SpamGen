// Bank of Premium status emoji — the same idea as the avatar bank, but for the
// glyph that sits after the name. Two kinds go in and both come out as a plain
// image file, because that is all the template needs:
//
//   unicode emoji  -> Apple's PNG, through the emoji cache we already keep
//   custom emoji   -> the sticker behind it, via getCustomEmojiStickers
//
// A custom emoji reaches us as a message *entity*, not as text: the character in
// the message is only a placeholder and `custom_emoji_id` is the real payload.
// Reading those needs no Premium on the bot's side — only the human pasting one
// has to have it.
const fs=require('fs'),path=require('path');
const {ensure,RE}=require('./emoji');

// Overridable so flowtest can fill a throwaway bank instead of the real one.
const DIR=process.env.SPAMGEN_STATUS||path.join(__dirname,'..','assets','status');
const EMOJI=path.join(__dirname,'..','assets','emoji');
const fileURL=p=>'file:///'+p.split(path.sep).join('/').replace(/^\/+/,'');

function dir(){if(!fs.existsSync(DIR))fs.mkdirSync(DIR,{recursive:true});return DIR;}
function list(){
  try{return fs.readdirSync(dir()).filter(f=>/\.(png|webp|jpg|jpeg)$/i.test(f));}
  catch(e){return [];}
}
const count=()=>list().length;
// Repeats inside one screen are fine and deliberate: real chat lists are full of
// people wearing whatever status is trending that week.
function pick(){
  const f=list();
  return f.length?fileURL(path.join(dir(),f[Math.floor(Math.random()*f.length)])):null;
}

// Every unicode emoji in a message, as the sequences emoji.js recognises.
const unicodeIn=text=>[...String(text||'').matchAll(RE)].map(m=>m[0]);
// Every custom emoji id in a message, from either entity list.
function customIn(msg){
  const ent=[...(msg.entities||[]),...(msg.caption_entities||[])];
  return [...new Set(ent.filter(e=>e.type==='custom_emoji'&&e.custom_emoji_id)
    .map(e=>e.custom_emoji_id))];
}

// "u-1f525.png" -> 🔥, so a picker can show the glyph itself. A custom emoji has
// no unicode to fall back on: only a Premium account can render one, and a bot
// cannot put it on a button at all.
function label(file){
  const m=/^u-([0-9a-f-]+)./i.exec(file);
  if(!m)return null;
  try{return m[1].split('-').map(h=>String.fromCodePoint(parseInt(h,16))).join('');}
  catch(e){return null;}
}
const urlFor=file=>fileURL(path.join(dir(),file));

async function addUnicode(seq){
  const name=await ensure(seq);                 // downloads into assets/emoji
  if(!name)return null;
  const dest=path.join(dir(),'u-'+name+'.png');
  if(!fs.existsSync(dest))fs.copyFileSync(path.join(EMOJI,name+'.png'),dest);
  return dest;
}

// Bot API takes at most 200 ids per call and may hand them back in any order,
// so the sticker is matched on its own custom_emoji_id rather than on position.
async function addCustom(tg,ids){
  const out=[];
  for(let i=0;i<ids.length;i+=200){
    const chunk=ids.slice(i,i+200);
    let stickers=[];
    try{stickers=await tg.call('getCustomEmojiStickers',{custom_emoji_ids:chunk});}
    catch(e){continue;}
    for(const st of stickers){
      const id=st.custom_emoji_id||chunk[0];
      // A .tgs or .webm cannot be screenshotted, but Telegram ships a static
      // thumbnail for exactly this case. Static stickers are .webp, which
      // Chromium renders natively — no conversion step anywhere.
      const src=(st.is_animated||st.is_video)?(st.thumbnail&&st.thumbnail.file_id):st.file_id;
      if(!src)continue;
      const already=list().find(f=>f.startsWith('c-'+id+'.'));
      if(already){out.push(path.join(dir(),already));continue;}
      try{
        const f=await tg.call('getFile',{file_id:src});
        const ext=(String(f.file_path||'').match(/\.([a-z0-9]+)$/i)||[0,'webp'])[1];
        const dest=path.join(dir(),'c-'+id+'.'+ext.toLowerCase());
        await tg.download(src,dest);
        out.push(dest);
      }catch(e){}
    }
  }
  return out;
}

// Everything addable in one message, in one call. Returns what landed.
async function addFrom(tg,msg){
  const added=[];
  for(const p of await addCustom(tg,customIn(msg))) added.push(p);
  for(const seq of unicodeIn(msg.text||msg.caption||'')){
    const p=await addUnicode(seq);
    if(p)added.push(p);
  }
  return added;
}
module.exports={dir,list,count,pick,label,urlFor,addFrom,addUnicode,addCustom,
  unicodeIn,customIn,fileURL};

// node tools/send.js <chat_id> <file.png> [caption]
// Sends a rendered screen to a Telegram chat: photo for a quick look plus the
// untouched PNG as a document, because Telegram re-encodes photos to JPEG.
const fs=require('fs'),path=require('path');
const {TG}=require('../src/tg');

function token(){
  if(process.env.SPAMGEN_TOKEN)return process.env.SPAMGEN_TOKEN.trim();
  const f=path.join(__dirname,'..','.env');
  const m=/SPAMGEN_TOKEN\s*=\s*(\S+)/.exec(fs.readFileSync(f,'utf8'));
  return m[1];
}
const [,,chat,file,...rest]=process.argv;
const caption=rest.join(' ')||undefined;
const tg=new TG(token());

(async()=>{
  await tg.photo(chat,path.resolve(file),caption);
  await tg.doc(chat,path.resolve(file),'Оригинал PNG (без пережатия)');
  console.log('sent '+path.basename(file)+' to '+chat);
})().catch(e=>{console.error(e.message);process.exit(1);});

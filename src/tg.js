// Minimal Telegram Bot API client. No dependencies on purpose: bothost only
// has to run `node bot.js`, and npm install is not part of the deploy.
const fs=require('fs'),path=require('path');
const CRLF='\r\n';

class TG{
  constructor(token){this.token=token;this.base='https://api.telegram.org/bot'+token+'/';}
  async call(method,params){
    const r=await fetch(this.base+method,{method:'POST',
      headers:{'Content-Type':'application/json'},body:JSON.stringify(params||{})});
    const j=await r.json();
    if(!j.ok)throw new Error(method+': '+j.description);
    return j.result;
  }
  async upload(method,fields,fileField,filePath){
    const b='----spamgen'+Date.now();
    const parts=[];
    for(const k in fields){
      if(fields[k]==null)continue;
      const v=typeof fields[k]==='object'?JSON.stringify(fields[k]):String(fields[k]);
      parts.push(Buffer.from('--'+b+CRLF+'Content-Disposition: form-data; name="'+k+'"'+CRLF+CRLF+v+CRLF));
    }
    const data=fs.readFileSync(filePath);
    parts.push(Buffer.from('--'+b+CRLF+'Content-Disposition: form-data; name="'+fileField+
      '"; filename="'+path.basename(filePath)+'"'+CRLF+'Content-Type: image/png'+CRLF+CRLF));
    parts.push(data,Buffer.from(CRLF+'--'+b+'--'+CRLF));
    const body=Buffer.concat(parts);
    const r=await fetch(this.base+method,{method:'POST',
      headers:{'Content-Type':'multipart/form-data; boundary='+b,'Content-Length':body.length},body});
    const j=await r.json();
    if(!j.ok)throw new Error(method+': '+j.description);
    return j.result;
  }
  send(chat,text,kb){return this.call('sendMessage',
    {chat_id:chat,text,parse_mode:'HTML',reply_markup:kb?{inline_keyboard:kb}:undefined});}
  edit(chat,msg,text,kb){return this.call('editMessageText',
    {chat_id:chat,message_id:msg,text,parse_mode:'HTML',reply_markup:kb?{inline_keyboard:kb}:undefined});}
  // A keyboard means an HTML caption too: the pick captions carry an escaped name.
  photo(chat,file,caption,kb){return this.upload('sendPhoto',{chat_id:chat,caption,
    parse_mode:kb?'HTML':undefined,reply_markup:kb?{inline_keyboard:kb}:undefined},'photo',file);}
  doc(chat,file,caption){return this.upload('sendDocument',{chat_id:chat,caption},'document',file);}
  // Swap the picture inside a message that is already in the chat. The editor
  // leans on this: ten tweaks to one screen would otherwise leave ten renders
  // stacked in the dialog. The file rides along as multipart and the media
  // object points at it by name.
  editMedia(chat,msg,file,caption,kb){
    return this.upload('editMessageMedia',{chat_id:chat,message_id:msg,
      media:{type:'photo',media:'attach://photo',caption,parse_mode:'HTML'},
      reply_markup:kb?{inline_keyboard:kb}:undefined},'photo',file);
  }
  ack(id,text){return this.call('answerCallbackQuery',{callback_query_id:id,text}).catch(()=>{});}
  async download(fileId,dest){
    const f=await this.call('getFile',{file_id:fileId});
    const r=await fetch('https://api.telegram.org/file/bot'+this.token+'/'+f.file_path);
    fs.writeFileSync(dest,Buffer.from(await r.arrayBuffer()));
    return dest;
  }
  async poll(handler){
    let offset=0;
    for(;;){
      let ups=[];
      try{ups=await this.call('getUpdates',{offset,timeout:30});}
      catch(e){await new Promise(r=>setTimeout(r,3000));continue;}
      for(const u of ups){
        offset=u.update_id+1;
        try{await handler(u);}catch(e){console.error('handler:',e.message);}
      }
    }
  }
}
module.exports={TG};

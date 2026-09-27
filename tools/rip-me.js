// The Settings tab shows the account's own avatar. Rip it from ref/IMG_6280.PNG:
// it is the only reference with the Settings badge cleared, so the avatar comes
// out whole instead of half-covered by a burnt-in red capsule.
const fs=require('fs'),path=require('path');
const {decode,px}=require('./png');
const {write}=require('./pngw');
const img=decode('ref/IMG_6280.PNG');
const X=741,Y=2307,S=78;
const buf=Buffer.alloc(S*S*3);
for(let y=0;y<S;y++)for(let x=0;x<S;x++){
  const c=px(img,X+x,Y+y),o=(y*S+x)*3;
  buf[o]=c[0];buf[o+1]=c[1];buf[o+2]=c[2];
}
fs.mkdirSync('assets/ripped2',{recursive:true});
write('assets/ripped2/me.png',S,S,buf);
console.log('wrote assets/ripped2/me.png '+S+'x'+S);

// ref/IMG_6280.PNG is the only reference whose Chats tab carries NO badge, so it
// is the one sprite source that does not need a hole punched in it. tools/key.js
// used to rip tb_chats from IMG_6264 and mask the badge away, which ate the top
// right of the front bubble and the whole back bubble — that notch showed up in
// every render as soon as a badge was drawn a pixel off.
//
// The glyph is a single flat colour (#5186ef) sitting on the flat tab plate
// (#393939), so alpha comes straight out of the blue-minus-red difference and the
// colour is restored as the constant — no backdrop estimation, no halo.
const {decode,px}=require('./png');
const {writeRGBA}=require('./pngw');
const img=decode('ref/IMG_6280.PNG');
const K=[0x51,0x86,0xef];        // measured glyph colour
const SPAN=K[2]-K[0];            // 158

// Box kept identical to the old sprite (534,2307 113x81) so tabbar.js geometry
// does not move: the extra width to the right is transparent padding.
const X0=534,Y0=2307,W=113,H=81;
const out=Buffer.alloc(W*H*4);
let kept=0;
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const c=px(img,X0+x,Y0+y),o=(y*W+x)*4;
  const a=Math.max(0,Math.min(1,(c[2]-c[0])/SPAN));
  if(a<0.04)continue;
  out[o]=K[0];out[o+1]=K[1];out[o+2]=K[2];out[o+3]=Math.round(a*255);kept++;
}
writeRGBA('assets/icons/tb_chats.png',W,H,out);
console.log('tb_chats '+W+'x'+H+' kept='+kept);

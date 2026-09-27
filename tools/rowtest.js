// renderRow: one chat row at its on-screen size, fast enough to show for every
// avatar candidate. The spec's threshold is 1.5 s; the spike measured ~0.6 s.
const path=require('path');
const {renderRow}=require('../src/render');
const {decode,px}=require('./png');
const out=path.join(__dirname,'..','out','rowtest.png');

let fails=0;
function check(name,cond,detail){
  console.log((cond?'  ok   ':'  FAIL ')+name+(detail!=null&&!cond?'   <'+detail+'>':''));
  if(!cond)fails++;
}
(async()=>{
  const t0=Date.now();
  await renderRow({name:'Дарья',text:'скинь реквизиты пожалуйста',time:'14:32',badge:'2'},out);
  const ms=Date.now()-t0;
  const im=decode(out);
  check('1170 wide',im.w===1170,im.w);
  check('228 tall',im.h===228,im.h);
  // Avatar box is 48,24 .. 228,204 in device px; its centre is the gradient
  // (or the white initial), never the black row behind it.
  const c=px(im,138,114);
  check('avatar sits at the top left',c[0]+c[1]+c[2]>150,c.join(','));
  const bg=px(im,5,5);
  check('row background is black',bg[0]+bg[1]+bg[2]<30,bg.join(','));
  check('under 1.5 s',ms<1500,ms+' ms');
  console.log('  '+ms+' ms, '+out);
  console.log(fails?'\n'+fails+' FAILED':'\nall green');
  process.exit(fails?1:0);
})();

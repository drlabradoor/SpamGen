const {decode,px}=require('./png');const {writeRGBA}=require('./pngw');
const img=decode('ref/IMG_6264.PNG');
// tb_chats is NOT ripped here: IMG_6264 wears a badge over it and the mask below
// punches a notch out of the bubbles. It comes from tools/key6280.js instead.
const Y=c=>0.299*c[0]+0.587*c[1]+0.114*c[2];
const isRed=c=>c[0]>100&&c[0]>c[1]*1.4&&c[0]>c[2]*1.4;
function key(name,x0,y0,x1,y1){
  const w=x1-x0+1,h=y1-y0+1;
  // 1. locate red badge, dilate its box
  let rx0=1e9,ry0=1e9,rx1=-1,ry1=-1;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(isRed(px(img,x,y))){
    if(x<rx0)rx0=x;if(x>rx1)rx1=x;if(y<ry0)ry0=y;if(y>ry1)ry1=y;}
  const pad=5;
  if(rx1>=0){rx0-=pad;ry0-=pad;rx1+=pad;ry1+=pad;}
  const masked=(x,y)=>rx1>=0&&x>=rx0&&x<=rx1&&y>=ry0&&y<=ry1;
  // 2. backdrop from border ring
  const ring=[];
  for(let x=x0;x<=x1;x++){if(!masked(x,y0-3))ring.push(px(img,x,y0-3));if(!masked(x,y1+3))ring.push(px(img,x,y1+3));}
  for(let y=y0;y<=y1;y++){if(!masked(x0-3,y))ring.push(px(img,x0-3,y));if(!masked(x1+3,y))ring.push(px(img,x1+3,y));}
  if(!ring.length){for(let x=x0;x<=x1;x++){ring.push(px(img,x,y0-3),px(img,x,y1+3));}}
  ring.sort((a,b)=>Y(a)-Y(b));
  const b=ring[Math.floor(ring.length*0.35)],Yb=Y(b);
  // 3. peak among unmasked
  let peak=[0,0,0];
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){if(masked(x,y))continue;
    const c=px(img,x,y);if(Y(c)>Y(peak))peak=c;}
  const Yc=Y(peak);
  const out=Buffer.alloc(w*h*4);let kept=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const X=x0+x,Yy=y0+y,c=px(img,X,Yy),o=(y*w+x)*4;
    if(masked(X,Yy)){out[o+3]=0;continue;}
    let a=Math.max(0,Math.min(1,(Y(c)-Yb)/(Yc-Yb)));
    if(a<0.05){out[o+3]=0;continue;}
    for(let k=0;k<3;k++)out[o+k]=Math.max(0,Math.min(255,Math.round((c[k]-(1-a)*b[k])/a)));
    out[o+3]=Math.round(a*255);kept++;}
  writeRGBA('assets/icons/'+name+'.png',w,h,out);
  console.log(name+' '+w+'x'+h+' badge='+(rx1>=0?'x'+rx0+'-'+rx1:'none')+' Yb='+Yb.toFixed(0)+' Yc='+Yc.toFixed(0)+' kept='+kept);
}
key('tb_contacts',136,2317,205,2386);
key('tb_calls',340,2319,405,2384);
key('tb_search',981,2344,1043,2407);

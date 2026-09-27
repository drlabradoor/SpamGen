// Alpha-key the Telegram Premium star out of ref/IMG_premium.PNG.
// It sits on the plain black row background, so the backdrop estimate is trivial.
const {decode,px}=require('./png');
const {writeRGBA}=require('./pngw');
const img=decode('ref/IMG_premium.PNG');
const Y=c=>0.299*c[0]+0.587*c[1]+0.114*c[2];

function key(name,x0,y0,x1,y1){
  const w=x1-x0+1,h=y1-y0+1;
  const ring=[];
  for(let x=x0;x<=x1;x++){ring.push(px(img,x,y0-3),px(img,x,y1+3));}
  for(let y=y0;y<=y1;y++){ring.push(px(img,x0-3,y),px(img,x1+3,y));}
  ring.sort((a,b)=>Y(a)-Y(b));
  const b=ring[Math.floor(ring.length*0.3)],Yb=Y(b);
  let peak=[0,0,0];
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const c=px(img,x,y);if(Y(c)>Y(peak))peak=c;}
  const Yc=Y(peak);
  const out=Buffer.alloc(w*h*4);
  let kept=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const c=px(img,x0+x,y0+y),o=(y*w+x)*4;
    let a=Math.max(0,Math.min(1,(Y(c)-Yb)/(Yc-Yb)));
    if(a<0.05){out[o+3]=0;continue;}
    for(let k=0;k<3;k++)out[o+k]=Math.max(0,Math.min(255,Math.round((c[k]-(1-a)*b[k])/a)));
    out[o+3]=Math.round(a*255);
    kept++;
  }
  writeRGBA('assets/icons/'+name+'.png',w,h,out);
  console.log(name+' '+w+'x'+h+' peak=['+peak.join(',')+'] kept='+kept);
}

key('premium',442,1157,487,1200);

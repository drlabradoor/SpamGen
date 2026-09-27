const {decode,px}=require('./png');const {write}=require('./pngw');
const img=decode('ref/IMG_6264.PNG');
const S={island:[446,15,722,80],geo:[239,59,277,97],signal:[856,59,913,95],
 net4g:[934,63,987,94],hplus:[870,180,952,265],hcompose:[1030,204,1110,295]};
for(const k in S){const [x0,y0,x1,y1]=S[k];const w=x1-x0+1,h=y1-y0+1;
 const b=Buffer.alloc(w*h*3);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const c=px(img,x0+x,y0+y);const o=(y*w+x)*3;
  b[o]=c[0];b[o+1]=c[1];b[o+2]=c[2];}
 write('assets/icons/'+k+'.png',w,h,b);console.log(k+' '+w+'x'+h);}

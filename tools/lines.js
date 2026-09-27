const {decode,px,hex}=require('./png');
const img=decode(process.argv[2]);
const P=(x,y)=>px(img,x,y);
const bg=c=>c[0]<8&&c[1]<8&&c[2]<8;
function bands(x0,x1,y0,y1,minGap){
  const out=[];let s=-1,gap=0;
  for(let y=y0;y<=y1;y++){let n=0;for(let x=x0;x<=x1;x++)if(!bg(P(x,y)))n++;
    if(n>0){if(s<0)s=y;gap=0;}else if(s>=0){gap++;if(gap>=minGap){out.push([s,y-gap]);s=-1;gap=0;}}}
  if(s>=0)out.push([s,y1]);return out;
}
const R=(l,x0,x1,y0,y1,g)=>console.log(l+': '+bands(x0,x1,y0,y1,g).map(b=>'y'+b[0]+'-'+b[1]+'(h'+(b[1]-b[0]+1)+')').join(' '));
R('row1 text ',258,991,341,568,4);
R('row1 right',1019,1121,341,568,4);
R('row2 text ',258,991,569,796,4);

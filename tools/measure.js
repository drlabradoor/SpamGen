const {decode,px,hex}=require('./png');
const img=decode(process.argv[2]);
const P=(x,y)=>px(img,x,y);
const bg=c=>c[0]<8&&c[1]<8&&c[2]<8;
function segs(y0,y1,x0,x1,minGap){
  const col=[];
  for(let x=x0;x<x1;x++){let n=0;for(let y=y0;y<y1;y++)if(!bg(P(x,y)))n++;col.push(n);}
  const out=[];let s=-1,gap=0;
  for(let i=0;i<col.length;i++){
    if(col[i]>0){ if(s<0)s=i; gap=0; }
    else if(s>=0){ gap++; if(gap>=minGap){out.push([x0+s,x0+i-gap]);s=-1;gap=0;} }
  }
  if(s>=0)out.push([x0+s,x0+col.length-1]);
  return out;
}
function vb(x0,x1,y0,y1){let a=-1,b=-1;
  for(let y=y0;y<y1;y++){let n=0;for(let x=x0;x<=x1;x++)if(!bg(P(x,y)))n++;
    if(n>0){if(a<0)a=y;b=y;}}
  return [a,b];
}
function dom(x0,x1,y0,y1){const m={};
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const c=P(x,y);if(bg(c))continue;const h=hex(c);m[h]=(m[h]||0)+1;}
  return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,2).map(e=>e[0]+'×'+e[1]).join(' ');
}
function region(name,y0,y1,x0,x1,gap){
  console.log('## '+name+' ('+y0+'-'+y1+')');
  for(const [a,b] of segs(y0,y1,x0,x1,gap)){
    const [c,d]=vb(a,b,y0,y1);
    console.log('  x'+a+'-'+b+' (w'+(b-a+1)+')  y'+c+'-'+d+' (h'+(d-c+1)+')  '+dom(a,b,c,d));
  }
}
region('STATUSBAR',0,120,0,1170,20);
region('HEADER',130,310,0,1170,20);
region('ROW1',341,568,0,1170,24);

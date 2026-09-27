const {decode,px}=require('./png');
function cmp(fa,fb,x0,y0,x1,y1){
  const A=decode(fa),B=decode(fb);let sum=0,n=0,bad=0;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const a=px(A,x,y),b=px(B,x,y);
    const d=(Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2]))/3;
    sum+=d;n++;if(d>24)bad++;}
  return {mean:(sum/n).toFixed(2),bad:(100*bad/n).toFixed(2)};
}
module.exports={cmp};
if(require.main===module){const a=process.argv;console.log(JSON.stringify(cmp(a[2],a[3],+a[4],+a[5],+a[6],+a[7])));}

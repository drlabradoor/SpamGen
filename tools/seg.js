const {decode,px}=require('./png');
const img=decode(process.argv[2]);
const P=(x,y)=>px(img,x,y);
const [,,,X0,Y0,X1,Y1,GAP,THR]=process.argv.map(Number);
const t=THR||8;
const bg=c=>c[0]<t&&c[1]<t&&c[2]<t;
const col=[];
for(let x=X0;x<=X1;x++){let n=0;for(let y=Y0;y<=Y1;y++)if(!bg(P(x,y)))n++;col.push(n);}
let s=-1,g=0,out=[];
for(let i=0;i<col.length;i++){
 if(col[i]>0){if(s<0)s=i;g=0;}else if(s>=0){g++;if(g>=GAP){out.push([X0+s,X0+i-g]);s=-1;g=0;}}}
if(s>=0)out.push([X0+s,X1]);
out.forEach(([a,b])=>{let c=-1,d=-1;
 for(let y=Y0;y<=Y1;y++){let n=0;for(let x=a;x<=b;x++)if(!bg(P(x,y)))n++;if(n){if(c<0)c=y;d=y;}}
 console.log('  '+a+','+c+' '+b+','+d+'  ('+(b-a+1)+'x'+(d-c+1)+')');});

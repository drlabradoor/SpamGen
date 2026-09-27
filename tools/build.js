const fs=require('fs');
const {html}=require('../src/template');const {CHROME_CSS,chromeHTML}=require('../src/chrome');const {TAB_CSS,tabHTML}=require('../src/tabbar');
const {prefetch}=require('../src/emoji');
const cfg=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
(async()=>{
const pf=await prefetch(cfg);
if(pf.missing.length)console.error('emoji missing: '+pf.missing.join(' '));
let h=html(cfg);
h=h.replace('</style>',CHROME_CSS+TAB_CSS+'</style>').replace('<div id="list"',chromeHTML(cfg.chrome||{})+'<div id="list"');
if(h.indexOf('id="status"')<0)throw new Error('chrome injection failed');
h=h+tabHTML(cfg.tab);
fs.writeFileSync(process.argv[3],h);
})();

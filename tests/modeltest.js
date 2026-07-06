const fs=require('fs');const {createCanvas}=require('@napi-rs/canvas');
function mk(){const c=createCanvas(900,500);c.addEventListener=()=>{};c.getBoundingClientRect=()=>({left:0,top:0,width:900,height:500});c.style={};Object.defineProperty(c,'clientWidth',{get:()=>900});Object.defineProperty(c,'clientHeight',{get:()=>420});c.parentElement={clientWidth:900,clientHeight:420};return c;}
const cv={};function el(id){if(id&&/canvas|sch/.test(id)){if(!cv[id])cv[id]=mk();return cv[id];}const e={style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},addEventListener(){},appendChild(){},removeChild(){},querySelectorAll:()=>[],focus(){},remove(){},clientWidth:900,clientHeight:420,value:'',textContent:'',getBoundingClientRect:()=>({left:0,top:0,width:900,height:420}),getContext:()=>mk().getContext('2d')};e.lastChild={remove(){}};e.parentElement={clientWidth:900,clientHeight:420};Object.defineProperty(e,'innerHTML',{get(){return'';},set(){}});return e;}
global.document={getElementById:el,createElement:()=>el(''),querySelectorAll:()=>[],addEventListener(){},body:el('')};
global.window={addEventListener(){},location:{href:''}};global.localStorage={getItem:()=>null,setItem(){}};global.fetch=async()=>({json:async()=>({})});global.alert=()=>{};
let js=fs.readFileSync('app_extract.js','utf8');js+='\n;global.__parse=parseSpice;global.__C=Circuit;global.__cabs=cabs;';
(0,eval)(js);let pass=0,fail=0;const chk=(c,m,d)=>{console.log((c?'PASS':'FAIL')+'  '+m+(d?' — '+d:''));c?pass++:fail++;};
// parse a BJT model with caps + VAF (like the user's op-amp netlist), check params captured
const spec=global.__parse('Q1 c b 0 QN\n.model QN NPN(BF=200 IS=1E-15 VAF=100 CJE=2P CJC=1P TF=0.35N)');
const m=spec.parts[0].model;
chk(m.VAF===100&&Math.abs(m.CJC-1e-12)<1e-15&&Math.abs(m.TF-0.35e-9)<1e-13,'BJT model parses VAF/CJE/CJC/TF',JSON.stringify(m));
// app engine: CE amp with those caps → finite bandwidth
function ce(cjc){const c=new global.__C();
  c.add({type:'V',nodes:['in','0'],value:0,ac:1});c.add({type:'C',nodes:['in','b'],value:1e-6});
  c.add({type:'V',nodes:['vcc','0'],value:10});c.add({type:'R',nodes:['vcc','b'],value:430e3});c.add({type:'R',nodes:['vcc','col'],value:2000});
  c.add({type:'Q',nodes:['col','b','0'],model:{type:'npn',Is:1e-15,BF:100,VAF:100,CJC:cjc,CJE:2e-12,TF:0.3e-9}});
  const r=c.ac(1e2,1e9,400);const g0=20*Math.log10(global.__cabs(r.out.col[0]));let f3=null;for(let i=0;i<r.freqs.length;i++)if(20*Math.log10(global.__cabs(r.out.col[i]))<=g0-3){f3=r.freqs[i];break;}return{g0,f3};}
const a=ce(0),b=ce(5e-12);
chk(!a.f3&&b.f3>1e6,'app engine: Miller cap gives finite bandwidth',`ideal ${a.f3?'finite':'flat'}, Cµ=5pF ${b.f3?(b.f3/1e6).toFixed(0)+'MHz':'flat'}`);
console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);

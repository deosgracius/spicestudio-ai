const fs=require('fs');const {createCanvas}=require('@napi-rs/canvas');
function mk(){const c=createCanvas(1000,700);c.addEventListener=()=>{};c.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:700});c.style={};Object.defineProperty(c,'clientWidth',{get:()=>1000});Object.defineProperty(c,'clientHeight',{get:()=>500});c.parentElement={clientWidth:1000,clientHeight:500};return c;}
const cv={};function el(id){if(id&&/canvas|sch/.test(id)){if(!cv[id])cv[id]=mk();return cv[id];}const e={style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},addEventListener(){},appendChild(){},removeChild(){},querySelectorAll:()=>[],focus(){},remove(){},clientWidth:1000,clientHeight:500,value:'',textContent:'',getBoundingClientRect:()=>({left:0,top:0,width:1000,height:500}),getContext:()=>mk().getContext('2d')};e.lastChild={remove(){}};e.parentElement={clientWidth:1000,clientHeight:500};Object.defineProperty(e,'innerHTML',{get(){return'';},set(){}});return e;}
global.document={getElementById:el,createElement:()=>el(''),querySelectorAll:()=>[],addEventListener(){},body:el('')};
global.window={addEventListener(){},location:{href:''}};global.localStorage={getItem:()=>null,setItem(){}};global.fetch=async()=>({json:async()=>({})});global.alert=()=>{};
let js=fs.readFileSync('app_extract.js','utf8');js+='\n;global.__S=S;global.__try=tryConstructIntent;global.__beyond=beyondLocal;';
(0,eval)(js);const S=global.__S;let pass=0,fail=0;const chk=(c,m,d)=>{console.log((c?'PASS':'FAIL')+'  '+m+(d?' — '+d:''));c?pass++:fail++;};
// H-bridge builds
chk(global.__try('Design a pure H-Bridge Power Transistor Switching Grid for motor control with 4 NMOS'),'H-bridge prompt handled by a builder');
const nmos=S.comps.filter(c=>c.type==='NMOS').length,r=S.comps.filter(c=>c.type==='R').length,v=S.comps.filter(c=>c.type==='V').length;
chk(nmos===4&&r===1&&v===1,'H-bridge = 4 NMOS + R_load + 24V supply',nmos+' NMOS, '+r+' R, '+v+' V');
// square layout check: 4 NMOS at 4 corners (2 distinct x, 2 distinct y)
const xs=[...new Set(S.comps.filter(c=>c.type==='NMOS').map(c=>c.x))],ys=[...new Set(S.comps.filter(c=>c.type==='NMOS').map(c=>c.y))];
chk(xs.length===2&&ys.length===2,'NMOS placed in a 2x2 square grid (not a linear chain)','x:'+xs+' y:'+ys);
// simulates: ML high, MR low (forward drive)
const V=S.sim&&S.sim.dc;
if(V){console.log('   V(ML)='+(V.ML||0).toFixed(2)+' V(MR)='+(V.MR||0).toFixed(2)+' V(+24V)='+(V['+24V']||0).toFixed(1));
  chk(V.ML>V.MR+1,'DC: current flows ML→MR through R_load (bridge conducts)');}else chk(false,'H-bridge simulated');
// PLL is correctly rejected (not a false Sallen-Key)
chk(global.__beyond('Analog Phase-Locked Loop PLL with Gilbert Cell, VCO, phase detector, Stage 1... Stage 2... Stage 3')===true,'PLL detected as beyond-local (no false template)');
chk(global.__beyond('design a sallen-key 1kHz butterworth low-pass filter')===false,'genuine Sallen-Key still allowed');
chk(global.__beyond('h-bridge motor driver')===false,'h-bridge not blocked (has a builder)');
console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);

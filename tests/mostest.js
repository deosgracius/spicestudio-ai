const fs=require('fs');const {createCanvas}=require('@napi-rs/canvas');
function mk(){const c=createCanvas(1000,600);c.addEventListener=()=>{};c.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:600});c.style={};Object.defineProperty(c,'clientWidth',{get:()=>1000});Object.defineProperty(c,'clientHeight',{get:()=>420});c.parentElement={clientWidth:1000,clientHeight:420};return c;}
const cv={};function el(id){if(id&&/canvas|sch/.test(id)){if(!cv[id])cv[id]=mk();return cv[id];}const e={style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},addEventListener(){},appendChild(){},removeChild(){},querySelectorAll:()=>[],focus(){},remove(){},clientWidth:1000,clientHeight:420,value:'',textContent:'',getBoundingClientRect:()=>({left:0,top:0,width:1000,height:420}),getContext:()=>mk().getContext('2d')};e.lastChild={remove(){}};e.parentElement={clientWidth:1000,clientHeight:420};Object.defineProperty(e,'innerHTML',{get(){return'';},set(){}});return e;}
global.document={getElementById:el,createElement:()=>el(''),querySelectorAll:()=>[],addEventListener(){},body:el('')};
global.window={addEventListener(){},location:{href:''}};global.localStorage={getItem:()=>null,setItem(){}};global.fetch=async()=>({json:async()=>({})});global.alert=()=>{};
let js=fs.readFileSync('app_extract.js','utf8');js+='\n;global.__S=S;global.__looks=looksLikeSpice;global.__parse=parseSpice;global.__import=importSpice;global.__conn=getConnectivity;';
(0,eval)(js);const S=global.__S;
let pass=0,fail=0;const chk=(c,m,d)=>{console.log((c?'PASS':'FAIL')+'  '+m+(d?' — '+d:''));c?pass++:fail++;};
const netlist=`* MOSFET Operational Amplifier Simulation
M1 Col1 InMinus Tail Tail NMOS_Type W=10u L=1u
M2 Col2 InPlus  Tail Tail NMOS_Type W=10u L=1u
M3 Out  Col1    VCC  VCC  PMOS_Type W=20u L=1u
M4 Col1 Col1    VCC  VCC  PMOS_Type W=20u L=1u
I1 Tail VEE     1mA
VCC VCC 0  5V
VEE VEE 0 -5V
VInPlus  InPlus  0 AC 1 0
VInMinus InMinus 0 0
.model NMOS_Type NMOS(Vto=0.7 Kp=100u)
.model PMOS_Type PMOS(Vto=-0.7 Kp=40u)
.ac dec 20 1 100meg
.end`;
chk(global.__looks(netlist),'detected as a SPICE netlist');
const spec=global.__parse(netlist);
chk(spec.parts.length===9,'parsed 9 devices',spec.parts.map(p=>p.ref+':'+p.type).join(' '));
const m1=spec.parts.find(p=>p.ref==='M1'),m3=spec.parts.find(p=>p.ref==='M3');
chk(m1&&m1.type==='NMOS'&&Math.abs(m1.model.Kp-100e-6)<1e-9&&Math.abs(m1.model.W-10e-6)<1e-9,'M1 = NMOS, Kp=100u, W=10u',JSON.stringify(m1&&m1.model));
chk(m3&&m3.type==='PMOS'&&Math.abs(m3.model.Vto+0.7)<1e-9,'M3 = PMOS, Vto=-0.7',JSON.stringify(m3&&m3.model));
try{ global.__import(netlist);
  chk(S.comps.length>=8,'built the circuit on the canvas',S.comps.length+' parts');
  chk(S.ac&&Object.keys(S.ac.out).length>0,'.ac ran and produced output nodes',S.ac?Object.keys(S.ac.out).join(','):'none');
}catch(e){chk(false,'import threw: '+e.message);console.log(e.stack.split('\n').slice(0,5).join('\n'));}
console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);

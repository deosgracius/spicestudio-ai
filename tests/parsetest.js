const fs=require('fs');const {createCanvas}=require('@napi-rs/canvas');
function mk(){const c=createCanvas(1000,600);c.addEventListener=()=>{};c.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:600});c.style={};Object.defineProperty(c,'clientWidth',{get:()=>1000});Object.defineProperty(c,'clientHeight',{get:()=>500});c.parentElement={clientWidth:1000,clientHeight:500};return c;}
const cv={};function el(id){if(id&&/canvas|sch/.test(id)){if(!cv[id])cv[id]=mk();return cv[id];}const e={style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},addEventListener(){},appendChild(){},removeChild(){},querySelectorAll:()=>[],focus(){},remove(){},clientWidth:1000,clientHeight:500,value:'',textContent:'',getBoundingClientRect:()=>({left:0,top:0,width:1000,height:500}),getContext:()=>mk().getContext('2d')};e.lastChild={remove(){}};e.parentElement={clientWidth:1000,clientHeight:500};Object.defineProperty(e,'innerHTML',{get(){return'';},set(){}});return e;}
global.document={getElementById:el,createElement:()=>el(''),querySelectorAll:()=>[],addEventListener(){},body:el('')};
global.window={addEventListener(){},location:{href:''}};global.localStorage={getItem:()=>null,setItem(){}};global.fetch=async()=>({json:async()=>({})});global.alert=()=>{};
let js=fs.readFileSync('app_extract.js','utf8');js+='\n;global.__S=S;global.__spice=looksLikeSpice;global.__struct=looksStructured;global.__ps=parseStructured;global.__spec=buildFromSpec;global.__beyond=beyondLocal;global.__try=tryConstructIntent;';
(0,eval)(js);const S=global.__S;let pass=0,fail=0;const chk=(c,m,d)=>{console.log((c?'PASS':'FAIL')+'  '+m+(d?' — '+d:''));c?pass++:fail++;};
const prose=`Design a 3-Phase BLDC motor inverter bridge for a brushless DC motor.
Construct 3 parallel half-bridge legs from six power transistors.
Ensure all six gate terminals connect to the controller.`;
chk(global.__spice(prose)===false,'PROSE no longer mistaken for a SPICE netlist (the bug)');
chk(global.__beyond(prose)===true,'PROSE 3-phase routed to honest "needs key" message');
const realSpice=`M1 Col1 InMinus Tail Tail NMOS_Type W=10u L=1u
M2 Col2 InPlus Tail Tail NMOS_Type W=10u L=1u
VCC VCC 0 5V
.model NMOS_Type NMOS(Vto=0.7 Kp=100u)`;
chk(global.__spice(realSpice)===true,'REAL SPICE netlist still detected');
const block=`COMPONENTS:
M1 = NMOS, M2 = NMOS, M3 = NMOS, M4 = NMOS, M5 = NMOS, M6 = NMOS
R1 = 5, R2 = 5, R3 = 5
V1 = 48V, Ground = 0V

NETS:
V1 -> M1.Drain, M3.Drain, M5.Drain
Ground -> M2.Source, M4.Source, M6.Source
M1.Source -> M2.Drain -> Node_A
M3.Source -> M4.Drain -> Node_B
M5.Source -> M6.Drain -> Node_C
Node_A -> R1.Pin1
Node_B -> R2.Pin1
Node_C -> R3.Pin1
R1.Pin2 -> R2.Pin2 -> R3.Pin2 -> Node_Neutral`;
chk(global.__struct(block)===true,'clean COMPONENTS/NETS block detected');
const sp=global.__ps(block);
const nm=sp.parts.filter(p=>p.type==='NMOS').length,r=sp.parts.filter(p=>p.type==='R').length,v=sp.parts.filter(p=>p.type==='V').length;
chk(nm===6&&r===3&&v===1,'parsed 6 NMOS + 3 R + 1 V (the 3-phase inverter)',nm+' NMOS, '+r+' R, '+v+' V');
global.__spec(sp);
chk(S.comps.length===10,'built 10 parts on the canvas',S.comps.map(c=>c.type).join(','));
console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);

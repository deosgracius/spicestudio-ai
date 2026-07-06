const fs=require('fs');const {createCanvas}=require('@napi-rs/canvas');
function mk(){const c=createCanvas(1000,600);c.addEventListener=()=>{};c.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:600});c.style={};Object.defineProperty(c,'clientWidth',{get:()=>1000});Object.defineProperty(c,'clientHeight',{get:()=>420});c.parentElement={clientWidth:1000,clientHeight:420};return c;}
const cv={};function el(id){if(id&&/canvas|sch/.test(id)){if(!cv[id])cv[id]=mk();return cv[id];}const e={style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},addEventListener(){},appendChild(){},removeChild(){},querySelectorAll:()=>[],focus(){},remove(){},clientWidth:1000,clientHeight:420,value:'',textContent:'',getBoundingClientRect:()=>({left:0,top:0,width:1000,height:420}),getContext:()=>mk().getContext('2d')};e.lastChild={remove(){}};e.parentElement={clientWidth:1000,clientHeight:420};Object.defineProperty(e,'innerHTML',{get(){return'';},set(){}});return e;}
global.document={getElementById:el,createElement:()=>el(''),querySelectorAll:()=>[],addEventListener(){},body:el('')};
global.window={addEventListener(){},location:{href:''}};global.localStorage={getItem:()=>null,setItem(){}};global.fetch=async()=>({json:async()=>({})});global.alert=()=>{};
let js=fs.readFileSync('app_extract.js','utf8');js+='\n;global.__S=S;global.__parse=parseSpice;global.__import=importSpice;global.__looks=looksLikeSpice;';
(0,eval)(js);const S=global.__S;let pass=0,fail=0;const chk=(c,m,d)=>{console.log((c?'PASS':'FAIL')+'  '+m+(d?' — '+d:''));c?pass++:fail++;};
// simple NPN common-emitter (known good): should show gain
const ce=`Vcc vcc 0 10
Rb vcc b 430k
Rc vcc c 2k
Q1 c b 0 QN
Vin in 0 AC 1
Cin in b 1u
.model QN NPN(BF=100 IS=1e-15)
.ac dec 10 100 1meg
.end`;
chk(global.__looks(ce),'CE amp detected as SPICE');
global.__import(ce);
chk(S.comps.length>=5,'CE amp built',S.comps.length+' parts');
const gCE=S.ac?Math.max(...S.ac.out['c'].map(z=>Math.hypot(z.re,z.im))):0;
chk(gCE>50&&gCE<300,'CE amp AC gain ~150 (BJT works in app)',gCE.toFixed(0));
// the discrete BJT op-amp netlist (from last turn)
const opamp=`.model QN NPN(BF=200 IS=1E-15)
.model QP PNP(BF=100 IS=1E-15)
VCC VCC 0 15
VEE VEE 0 -15
Itail TAIL VEE 200u
Q1 C1 INP TAIL QN
Q2 C2 INN TAIL QN
Q3 C1 C1 VCC QP
Q4 C2 C1 VCC QP
Cc C2 OUT 22p
Q5 OUT C2 VCC QP
RC OUT VEE 15k
Q6 VCC OUT OUTF QN
Rout OUTF VEE 8k
VIN INP 0 DC 0 AC 1
Lfb OUTF INN 1G
Cfb INN 0 1G
.ac dec 30 1 100meg
.end`;
try{ global.__import(opamp);
  chk(S.comps.length===15,'BJT op-amp: 15 devices built',S.comps.length+' parts');
  chk(S.ac&&S.ac.out['OUTF'],'BJT op-amp .ac ran, OUTF node present',S.ac?Object.keys(S.ac.out).length+' nodes':'none');
}catch(e){chk(false,'op-amp import threw: '+e.message);console.log(e.stack.split('\n').slice(0,4).join('\n'));}
console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);

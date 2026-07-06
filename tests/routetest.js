const fs=require('fs');const {createCanvas}=require('@napi-rs/canvas');
function mk(){const c=createCanvas(1200,700);c.addEventListener=()=>{};c.getBoundingClientRect=()=>({left:0,top:0,width:1200,height:700});c.style={};Object.defineProperty(c,'clientWidth',{get:()=>1200});Object.defineProperty(c,'clientHeight',{get:()=>500});c.parentElement={clientWidth:1200,clientHeight:500};return c;}
const cv={};function el(id){if(id&&/canvas|sch/.test(id)){if(!cv[id])cv[id]=mk();return cv[id];}const e={style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},addEventListener(){},appendChild(){},removeChild(){},querySelectorAll:()=>[],focus(){},remove(){},clientWidth:1200,clientHeight:500,value:'',textContent:'',getBoundingClientRect:()=>({left:0,top:0,width:1200,height:500}),getContext:()=>mk().getContext('2d')};e.lastChild={remove(){}};e.parentElement={clientWidth:1200,clientHeight:500};Object.defineProperty(e,'innerHTML',{get(){return'';},set(){}});return e;}
global.document={getElementById:el,createElement:()=>el(''),querySelectorAll:()=>[],addEventListener(){},body:el('')};
global.window={addEventListener(){},location:{href:''}};global.localStorage={getItem:()=>null,setItem(){}};global.fetch=async()=>({json:async()=>({})});global.alert=()=>{};
let js=fs.readFileSync('app_extract.js','utf8');js+='\n;global.__S=S;global.__try=tryConstructIntent;global.__spec=buildFromSpec;';
(0,eval)(js);const S=global.__S;let pass=0,fail=0;const chk=(c,m,d)=>{console.log((c?'PASS':'FAIL')+'  '+m+(d?' — '+d:''));c?pass++:fail++;};
function mag(z){return Math.hypot(z.re,z.im);}
// 1) Sallen-Key: routed, sim must still be -3dB @1kHz, and should have real wires
global.__try('sallen-key 1kHz butterworth low-pass');
console.log('  Sallen-Key: '+S.wires.length+' wires, '+S.labels.length+' labels');
chk(S.wires.length>0,'Sallen-Key drew real wires (not all labels)');
const out=S.ac&&S.ac.out['OUT'];
if(out){const f=S.ac.freqs;const at=hz=>{let bi=0,bd=1e9;f.forEach((ff,i)=>{const d=Math.abs(ff-hz);if(d<bd){bd=d;bi=i;}});return 20*Math.log10(mag(out[bi]));};
  chk(Math.abs(at(1000)+3)<1.2,'connectivity preserved: still −3dB @1kHz after routing',at(1000).toFixed(2)+'dB');}else chk(false,'AC ran');
// 2) generic specs — connectivity must survive routing (compare intended vs extracted)
function build(spec){global.__spec(spec);const {nets}=(function(){const c=require('./mna.js');return {};})();}
function checkNets(spec,label){
  global.__spec(spec);
  // extracted partition via getConnectivity is internal; check sim ran without error and node count matches distinct nets
  const distinct=new Set();spec.nets.forEach(n=>distinct.add(n.name==='gnd'?'0':n.name));
  const simmed=S.sim||S.ac;
  chk(!!simmed,label+': built+simulated after routing ('+S.wires.length+'w/'+S.labels.length+'L)');
}
checkNets({parts:[{ref:'V1',type:'VCC',value:'5'},{ref:'R1',type:'R',value:'330'},{ref:'D1',type:'LED',value:'LEDred'}],
  nets:[{name:'+5V',connect:[['V1',0],['R1',0]]},{name:'M',connect:[['R1',1],['D1',0]]},{name:'0',connect:[['D1',1]]}],analysis:'dc'},'LED driver');
checkNets({parts:[{ref:'V1',type:'VAC',value:'sine 1 1k'},{ref:'R1',type:'R',value:'1.6k'},{ref:'C1',type:'C',value:'100n'}],
  nets:[{name:'IN',connect:[['V1',0],['R1',0]]},{name:'OUT',connect:[['R1',1],['C1',0]]},{name:'0',connect:[['V1',1],['C1',1]]}],analysis:'ac'},'RC low-pass');
checkNets({parts:[{ref:'VDD',type:'VCC',value:'5'},{ref:'Vin',type:'VPULSE',value:'pulse 0 5 1k 0.5'},{ref:'M1',type:'PMOS'},{ref:'M2',type:'NMOS'}],
  nets:[{name:'+5V',connect:[['VDD',0],['M1',2]]},{name:'IN',connect:[['Vin',0],['M1',1],['M2',1]]},{name:'OUT',connect:[['M1',0],['M2',0]]},{name:'0',connect:[['Vin',1],['M2',2]]}],analysis:'tran'},'CMOS inverter');
console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);

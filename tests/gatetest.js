// Logic gates: the "and gate" intent must be recognized (not fall through to the canned
// fallback), and the built gates must obey their truth tables when solved by the engine.
const fs=require('fs');const {createCanvas}=require('@napi-rs/canvas');
function mk(){const c=createCanvas(1000,600);c.addEventListener=()=>{};c.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:600});c.style={};Object.defineProperty(c,'clientWidth',{get:()=>1000});Object.defineProperty(c,'clientHeight',{get:()=>500});c.parentElement={clientWidth:1000,clientHeight:500};return c;}
const cv={};function el(id){if(id&&/canvas|sch/.test(id)){if(!cv[id])cv[id]=mk();return cv[id];}const e={style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},addEventListener(){},appendChild(){},removeChild(){},querySelectorAll:()=>[],focus(){},remove(){},clientWidth:1000,clientHeight:500,value:'',textContent:'',getBoundingClientRect:()=>({left:0,top:0,width:1000,height:500}),getContext:()=>mk().getContext('2d')};e.lastChild={remove(){}};e.parentElement={clientWidth:1000,clientHeight:500};Object.defineProperty(e,'innerHTML',{get(){return'';},set(){}});return e;}
global.document={getElementById:el,createElement:()=>el(''),querySelectorAll:()=>[],addEventListener(){},body:el('')};
global.window={addEventListener(){},location:{href:''}};global.localStorage={getItem:()=>null,setItem(){}};global.fetch=async()=>({json:async()=>({})});global.alert=()=>{};
let js=fs.readFileSync('app_extract.js','utf8');js+='\n;global.__S=S;global.__try=tryConstructIntent;global.__spec=buildFromSpec;';
(0,eval)(js);const S=global.__S;let pass=0,fail=0;const chk=(c,m,d)=>{console.log((c?'PASS':'FAIL')+'  '+m+(d?' — '+d:''));c?pass++:fail++;};

// 1) the intent that used to give the canned fallback now builds a gate
chk(global.__try('design the and gate logic')===true,'"design the and gate logic" is recognized (was the canned-fallback bug)');
chk(S.comps.length===6,'AND gate built its 6 parts',S.comps.map(c=>c.ref).join(','));
chk(global.__try('make an OR gate')===true,'"OR gate" recognized');
chk(global.__try('CMOS NAND gate')===true,'"NAND gate" recognized');
chk(global.__try('inverter')===true,'"inverter" recognized as NOT');
chk(global.__try('and the results together')===false,'prose "and" (no gate/logic word) is NOT hijacked');

// helper: solve a gate spec with DC inputs and read the OUT node via R/M drain pin
function solveOut(spec,outRef,outPin){global.__spec(spec);const c=S.comps.find(x=>x.ref===outRef);const nm=S.nets.pinNet.get(c.uid+':'+outPin);return S.sim.dc[nm]??0;}
const andSpec=(a,b)=>({parts:[{ref:'VCC',type:'VCC',value:'5'},{ref:'R1',type:'R',value:'10k'},{ref:'A',type:'V',value:''+a},{ref:'B',type:'V',value:''+b},{ref:'D1',type:'D',value:'1N4148'},{ref:'D2',type:'D',value:'1N4148'}],
  nets:[{name:'+5V',connect:[['VCC',0],['R1',0]]},{name:'OUT',connect:[['R1',1],['D1',0],['D2',0]]},{name:'A',connect:[['A',0],['D1',1]]},{name:'B',connect:[['B',0],['D2',1]]},{name:'0',connect:[['A',1],['B',1]]}],analysis:'dc'});
const AND=(a,b)=>solveOut(andSpec(a,b),'R1',1);
chk(AND(5,5)>4,'AND(1,1) = HIGH',AND(5,5).toFixed(2)+'V');
chk(AND(0,5)<1.2,'AND(0,1) = LOW',AND(0,5).toFixed(2)+'V');
chk(AND(5,0)<1.2,'AND(1,0) = LOW',AND(5,0).toFixed(2)+'V');
chk(AND(0,0)<1.2,'AND(0,0) = LOW',AND(0,0).toFixed(2)+'V');

// CMOS NAND truth table (validates the transistor build inverts)
const nandSpec=(a,b)=>({parts:[{ref:'VDD',type:'VCC',value:'5'},{ref:'A',type:'V',value:''+a},{ref:'B',type:'V',value:''+b},{ref:'M1',type:'PMOS'},{ref:'M2',type:'PMOS'},{ref:'M3',type:'NMOS'},{ref:'M4',type:'NMOS'}],
  nets:[{name:'+5V',connect:[['VDD',0],['M1',2],['M2',2]]},{name:'A',connect:[['A',0],['M1',1],['M3',1]]},{name:'B',connect:[['B',0],['M2',1],['M4',1]]},{name:'OUT',connect:[['M1',0],['M2',0],['M3',0]]},{name:'MID',connect:[['M3',2],['M4',0]]},{name:'0',connect:[['A',1],['B',1],['M4',2]]}],analysis:'dc'});
const NAND=(a,b)=>solveOut(nandSpec(a,b),'M3',0);
chk(NAND(5,5)<1.5,'NAND(1,1) = LOW',NAND(5,5).toFixed(2)+'V');
chk(NAND(0,5)>3.3,'NAND(0,1) = HIGH',NAND(0,5).toFixed(2)+'V');

console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);

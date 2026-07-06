const fs=require('fs');const {createCanvas}=require('@napi-rs/canvas');
function mk(){const c=createCanvas(1000,600);c.addEventListener=()=>{};c.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:600});c.style={};Object.defineProperty(c,'clientWidth',{get:()=>1000});Object.defineProperty(c,'clientHeight',{get:()=>420});c.parentElement={clientWidth:1000,clientHeight:420};return c;}
const cv={};function el(id){if(id&&/canvas|sch/.test(id)){if(!cv[id])cv[id]=mk();return cv[id];}const e={style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},addEventListener(){},appendChild(){},removeChild(){},querySelectorAll:()=>[],focus(){},remove(){},clientWidth:1000,clientHeight:420,value:'',textContent:'',getBoundingClientRect:()=>({left:0,top:0,width:1000,height:420}),getContext:()=>mk().getContext('2d')};e.lastChild={remove(){}};e.parentElement={clientWidth:1000,clientHeight:420};Object.defineProperty(e,'innerHTML',{get(){return'';},set(){}});return e;}
global.document={getElementById:el,createElement:()=>el(''),querySelectorAll:()=>[],addEventListener(){},body:el('')};
global.window={addEventListener(){},location:{href:''}};global.localStorage={getItem:()=>null,setItem(){}};global.fetch=async()=>({json:async()=>({})});global.alert=()=>{};
let js=fs.readFileSync('app_extract.js','utf8');js+='\n;global.__S=S;global.__spec=buildFromSpec;';
(0,eval)(js);const S=global.__S;let pass=0,fail=0;const chk=(c,m,d)=>{console.log((c?'PASS':'FAIL')+'  '+m+(d?' — '+d:''));c?pass++:fail++;};
// CMOS inverter spec (the LLM prompt example) — logic gate atom
const spec={parts:[{ref:'VDD',type:'VCC',value:'5'},{ref:'Vin',type:'VPULSE',value:'pulse 0 5 1k 0.5'},{ref:'M1',type:'PMOS'},{ref:'M2',type:'NMOS'}],
 nets:[{name:'+5V',connect:[['VDD',0],['M1',2]]},{name:'IN',connect:[['Vin',0],['M1',1],['M2',1]]},{name:'OUT',connect:[['M1',0],['M2',0]]},{name:'0',connect:[['Vin',1],['M2',2]]}],analysis:'tran'};
global.__spec(spec);
chk(S.comps.length===4,'CMOS inverter built (4 parts)',S.comps.map(c=>c.type).join(','));
const t=S.sim&&S.sim.trace;
if(t&&t.OUT&&t.IN){const n=t.OUT.length;
  // find samples where IN is clearly high vs low, check OUT is opposite
  let hiIN=0,loIN=0,ok=true;
  for(let i=Math.floor(n*0.3);i<n;i++){if(t.IN[i]>4){hiIN++;if(t.OUT[i]>1)ok=false;}else if(t.IN[i]<1){loIN++;if(t.OUT[i]<4)ok=false;}}
  console.log('   OUT range: '+Math.min(...t.OUT.slice(50)).toFixed(2)+' to '+Math.max(...t.OUT.slice(50)).toFixed(2)+'V');
  chk(hiIN>0&&loIN>0&&ok,'inverter: OUT is the logical inverse of IN (0V/5V swing)');
}else chk(false,'transient produced IN/OUT traces');
console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);

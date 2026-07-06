const fs=require('fs');const {createCanvas}=require('@napi-rs/canvas');
function mk(){const c=createCanvas(900,600);c.addEventListener=()=>{};c.getBoundingClientRect=()=>({left:0,top:0,width:900,height:600});c.style={};Object.defineProperty(c,'clientWidth',{get:()=>900});Object.defineProperty(c,'clientHeight',{get:()=>420});c.parentElement={clientWidth:900,clientHeight:420};return c;}
const cv={};
function el(id){if(id&&/canvas|sch/.test(id)){if(!cv[id])cv[id]=mk();return cv[id];}const e={style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},addEventListener(){},appendChild(){},removeChild(){},querySelectorAll:()=>[],focus(){},remove(){},clientWidth:900,clientHeight:420,value:'',textContent:'',getBoundingClientRect:()=>({left:0,top:0,width:900,height:420}),getContext:()=>mk().getContext('2d')};e.lastChild={remove(){}};e.parentElement={clientWidth:900,clientHeight:420};Object.defineProperty(e,'innerHTML',{get(){return'';},set(){}});return e;}
global.document={getElementById:el,createElement:()=>el(''),querySelectorAll:()=>[],addEventListener(){},body:el('')};
global.window={addEventListener(){},location:{href:''}};global.localStorage={getItem:()=>null,setItem(){}};global.fetch=async()=>({json:async()=>({})});global.alert=()=>{};
let js=fs.readFileSync('app_extract.js','utf8');js+='\n;global.__S=S;global.__spec=buildFromSpec;global.__conn=getConnectivity;';
(0,eval)(js);const S=global.__S;
let pass=0,fail=0;const chk=(c,m,d)=>{console.log((c?'PASS':'FAIL')+'  '+m+(d?' — '+d:''));c?pass++:fail++;};
// An arbitrary circuit the LLM might emit: RC low-pass with a DC-blocking series cap + load — 5 parts
const spec={title:'test',parts:[
  {ref:'V1',type:'VAC',value:'sine 1 1k'},{ref:'C1',type:'C',value:'100n'},
  {ref:'R1',type:'R',value:'1.6k'},{ref:'C2',type:'C',value:'100n'}],
 nets:[{name:'IN',connect:[['V1',0],['C1',0]]},{name:'MID',connect:[['C1',1],['R1',0]]},
       {name:'OUT',connect:[['R1',1],['C2',0]]},{name:'0',connect:[['V1',1],['C2',1]]}],
 analysis:'ac'};
const ok=global.__spec(spec);
chk(ok===true,'buildFromSpec built an arbitrary 4-part circuit');
chk(S.comps.length===4,'placed all parts',S.comps.map(c=>c.ref+':'+c.type).join(','));
const conn=global.__conn();const names=conn.nets.map(n=>n.name).sort().join(',');
chk(['0','IN','MID','OUT'].every(n=>names.includes(n)),'net labels wired 4 nodes from the spec',names);
chk(S.ac&&Object.keys(S.ac.out).length>=3,'AC analysis ran on the AI-built circuit',S.ac?Object.keys(S.ac.out).join(','):'none');
console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);

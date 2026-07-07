// Live current-flow reconstruction: computeFlows() must recover branch currents from the
// op-point and give a consistent series current (same magnitude around a series loop).
const fs=require('fs');const {createCanvas}=require('@napi-rs/canvas');
function mk(){const c=createCanvas(1000,600);c.addEventListener=()=>{};c.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:600});c.style={};Object.defineProperty(c,'clientWidth',{get:()=>1000});Object.defineProperty(c,'clientHeight',{get:()=>500});c.parentElement={clientWidth:1000,clientHeight:500};return c;}
const cv={};function el(id){if(id&&/canvas|sch/.test(id)){if(!cv[id])cv[id]=mk();return cv[id];}const e={style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},addEventListener(){},appendChild(){},removeChild(){},querySelectorAll:()=>[],focus(){},remove(){},clientWidth:1000,clientHeight:500,value:'',textContent:'',getBoundingClientRect:()=>({left:0,top:0,width:1000,height:500}),getContext:()=>mk().getContext('2d')};e.lastChild={remove(){}};e.parentElement={clientWidth:1000,clientHeight:500};Object.defineProperty(e,'innerHTML',{get(){return'';},set(){}});return e;}
global.document={getElementById:el,createElement:()=>el(''),querySelectorAll:()=>[],addEventListener(){},body:el('')};
global.window={addEventListener(){},location:{href:''}};global.localStorage={getItem:()=>null,setItem(){}};global.fetch=async()=>({json:async()=>({})});global.alert=()=>{};
let js=fs.readFileSync('app_extract.js','utf8');js+='\n;global.__S=S;global.__flows=computeFlows;global.__load=loadDemo;global.__run=runSim;';
(0,eval)(js);const S=global.__S;let pass=0,fail=0;const chk=(c,m,d)=>{console.log((c?'PASS':'FAIL')+'  '+m+(d?' — '+d:''));c?pass++:fail++;};

// LED driver: +5V → 330Ω → LED → GND  (series loop, I ≈ (5-1.8)/330 ≈ 9.7mA)
global.__load('led');global.__run('dc');
const F=global.__flows();
chk(!!F,'computeFlows returned data for the LED loop');
const nonNull=F.flows.filter(f=>f);
chk(nonNull.length>0,'current assigned to the wires',nonNull.length+' of '+F.flows.length+' wires');
chk(F.max>0.005&&F.max<0.015,'peak current ≈ 10 mA (matches (5−1.8)/330)',(F.max*1000).toFixed(1)+' mA');
// series loop → every current-carrying wire should read essentially the same magnitude
const spread=nonNull.length?Math.max(...nonNull.map(f=>f.mag))-Math.min(...nonNull.map(f=>f.mag)):1;
chk(spread<F.max*0.05,'series current is consistent around the loop',(spread*1000).toFixed(3)+' mA spread');
chk(nonNull.every(f=>f.dir===1||f.dir===-1),'every flow has a direction');

// after clearing, no stale flow data leaks
global.__S.flowOn=false;S.sim=null;S.nets=null;
chk(global.__flows()===null,'no flow when there is no simulation');

console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);

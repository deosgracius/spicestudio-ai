// Copper autorouter: the ratsnest must become real tracks - every net electrically
// continuous through copper (union-find over pads/tracks/vias), zero DRC shorts,
// and no grid cell shared by two different nets on the same layer.
const fs=require('fs');const {createCanvas}=require('@napi-rs/canvas');
function mk(){const c=createCanvas(1000,600);c.addEventListener=()=>{};c.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:600});c.style={};Object.defineProperty(c,'clientWidth',{get:()=>1000});Object.defineProperty(c,'clientHeight',{get:()=>500});c.parentElement={clientWidth:1000,clientHeight:500};return c;}
const cv={};function el(id){if(id&&/canvas|sch/.test(id)){if(!cv[id])cv[id]=mk();return cv[id];}const e={style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},addEventListener(){},appendChild(){},removeChild(){},querySelectorAll:()=>[],focus(){},remove(){},clientWidth:1000,clientHeight:500,value:'',textContent:'',getBoundingClientRect:()=>({left:0,top:0,width:1000,height:500}),getContext:()=>mk().getContext('2d')};e.lastChild={remove(){}};e.parentElement={clientWidth:1000,clientHeight:500};Object.defineProperty(e,'innerHTML',{get(){return'';},set(){}});return e;}
global.document={getElementById:el,createElement:()=>el(''),querySelectorAll:()=>[],addEventListener(){},body:el('')};
global.window={addEventListener(){},location:{href:''}};global.localStorage={getItem:()=>null,setItem(){}};global.fetch=async()=>({json:async()=>({})});global.alert=()=>{};
let js=fs.readFileSync('app_extract.js','utf8');js+='\n;global.__PCB=PCB;global.__demo=loadDemo;global.__gate=buildLogicGate;global.__place2=pcbAutoPlace;global.__ar=pcbAutoroute;global.__rn=ratsnest;global.__uf=pcbUF;global.__drc=runDRC;';
(0,eval)(js);const PCB=global.__PCB;let pass=0,fail=0;const chk=(c,m,d)=>{console.log((c?'PASS':'FAIL')+'  '+m+(d?' - '+d:''));c?pass++:fail++;};

function netsContinuous(){const{find,key}=global.__uf();let bad=null;
  const roots={};PCB.fps.forEach(f=>f.pads.forEach(pd=>{if(!pd.net)return;const r=find(key('F.Cu',f.x+pd.dx,f.y+pd.dy));
    if(roots[pd.net]===undefined)roots[pd.net]=r;else if(roots[pd.net]!==r)bad=pd.net;}));return bad;}
function cellConflicts(){const occ={};let conflicts=0;
  const stamp=(L,x,y,net)=>{const k=L+':'+x+','+y;if(occ[k]&&occ[k]!==net)conflicts++;occ[k]=net;};
  PCB.tracks.forEach(t=>{const L=t.layer;for(let i=0;i<t.pts.length-1;i++){const[x1,y1]=t.pts[i],[x2,y2]=t.pts[i+1];
    const n=Math.max(Math.abs(x2-x1),Math.abs(y2-y1))||1;
    for(let k=0;k<=n;k++)stamp(L,Math.round(x1+(x2-x1)*k/n),Math.round(y1+(y2-y1)*k/n),t.net);}});
  PCB.fps.forEach(f=>f.pads.forEach(pd=>{if(pd.net){stamp('F.Cu',f.x+pd.dx,f.y+pd.dy,pd.net);stamp('B.Cu',f.x+pd.dx,f.y+pd.dy,pd.net);}}));
  return conflicts;}

// ---- board 1: half-wave rectifier ----
global.__demo('rect');global.__place2();
const before=global.__rn().length;
const r1=global.__ar();
chk(before>0,'rectifier starts with airwires',before+' airwires');
chk(r1.left===0,'rectifier fully routed (0 airwires left)',r1.routed+' connections routed');
chk(PCB.tracks.length>0,'real copper tracks created',PCB.tracks.length+' tracks');
chk(netsContinuous()===null,'every net electrically continuous through copper');
chk(global.__drc().shorts===0,'DRC reports zero shorts');
chk(cellConflicts()===0,'no grid cell shared by two nets on one layer');

// ---- board 2: CMOS NAND (denser, 7 parts, crossing nets) ----
global.__gate('nand');global.__place2();
const r2=global.__ar();
chk(r2.left===0,'NAND board fully routed',r2.routed+' connections routed');
chk(netsContinuous()===null,'NAND nets continuous through copper');
chk(global.__drc().shorts===0,'NAND DRC zero shorts');
chk(cellConflicts()===0,'NAND: no copper cell conflicts');
const viaCount=PCB.vias.length;
console.log('  (info) NAND used '+viaCount+' via(s), '+PCB.tracks.length+' tracks');

console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);

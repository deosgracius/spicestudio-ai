// Persistence + undo/redo: a design must serialize/restore losslessly, and undo/redo
// must step the schematic backward/forward through committed states.
const fs=require('fs');const {createCanvas}=require('@napi-rs/canvas');
function mk(){const c=createCanvas(1000,600);c.addEventListener=()=>{};c.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:600});c.style={};Object.defineProperty(c,'clientWidth',{get:()=>1000});Object.defineProperty(c,'clientHeight',{get:()=>500});c.parentElement={clientWidth:1000,clientHeight:500};return c;}
const cv={};function el(id){if(id&&/canvas|sch/.test(id)){if(!cv[id])cv[id]=mk();return cv[id];}const e={style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},addEventListener(){},appendChild(){},removeChild(){},querySelectorAll:()=>[],focus(){},remove(){},clientWidth:1000,clientHeight:500,value:'',textContent:'',getBoundingClientRect:()=>({left:0,top:0,width:1000,height:500}),getContext:()=>mk().getContext('2d')};e.lastChild={remove(){}};e.parentElement={clientWidth:1000,clientHeight:500};Object.defineProperty(e,'innerHTML',{get(){return'';},set(){}});return e;}
global.document={getElementById:el,createElement:()=>el(''),querySelectorAll:()=>[],addEventListener(){},body:el('')};
const store={};global.window={addEventListener(){},location:{href:''}};global.localStorage={getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v;}};global.fetch=async()=>({json:async()=>({})});global.alert=()=>{};
let js=fs.readFileSync('app_extract.js','utf8');js+='\n;global.__S=S;global.__ser=serializeDesign;global.__load=loadDesign;global.__commit=commitState;global.__undo=undo;global.__redo=redo;global.__initH=initHistory;global.__add=addComp;global.__demo=loadDemo;global.__new=newSheet;';
(0,eval)(js);const S=global.__S;let pass=0,fail=0;const chk=(c,m,d)=>{console.log((c?'PASS':'FAIL')+'  '+m+(d?' — '+d:''));c?pass++:fail++;};

// ---- serialize / restore roundtrip ----
global.__demo('rect');
const n0=S.comps.length, w0=S.wires.length;
const rVal=S.comps.find(c=>c.type==='R').value;
const s0=global.__ser();
chk(n0>0&&s0.length>10,'serialized a non-empty design',n0+' parts');
global.__new();
chk(S.comps.length===0,'New sheet cleared the design');
chk(global.__load(s0)===true,'loadDesign accepted the saved JSON');
chk(S.comps.length===n0&&S.wires.length===w0,'part + wire counts restored',S.comps.length+' parts / '+S.wires.length+' wires');
chk(S.comps.find(c=>c.type==='R').value===rVal,'component values survived the roundtrip',rVal);
chk(global.__load('{"garbage":true}')===false,'malformed file is rejected, not crashed');

// ---- undo / redo ----
global.__load(s0);                 // known state (n0 parts)
global.__initH();                  // baseline snapshot
global.__add('R',12,12);           // edit: add a resistor (no autosave — commit manually)
global.__commit();                 // settle → pushes baseline onto undo stack
chk(S.comps.length===n0+1,'edit added a part',S.comps.length+' parts');
global.__undo();
chk(S.comps.length===n0,'undo reverted the add',S.comps.length+' parts');
global.__redo();
chk(S.comps.length===n0+1,'redo re-applied the add',S.comps.length+' parts');
global.__undo();
chk(S.comps.length===n0,'undo again is stable',S.comps.length+' parts');

console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);

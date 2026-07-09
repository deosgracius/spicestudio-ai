// Component catalog: manufacturer part numbers (2N3904, IRF540N, 1N4001…) must reach the
// engine as real model cards, from the props picker, structured blocks, and SPICE netlists.
const fs=require('fs');const {createCanvas}=require('@napi-rs/canvas');
function mk(){const c=createCanvas(1000,600);c.addEventListener=()=>{};c.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:600});c.style={};Object.defineProperty(c,'clientWidth',{get:()=>1000});Object.defineProperty(c,'clientHeight',{get:()=>500});c.parentElement={clientWidth:1000,clientHeight:500};return c;}
const cv={};function el(id){if(id&&/canvas|sch/.test(id)){if(!cv[id])cv[id]=mk();return cv[id];}const e={style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},addEventListener(){},appendChild(){},removeChild(){},querySelectorAll:()=>[],focus(){},remove(){},clientWidth:1000,clientHeight:500,value:'',textContent:'',getBoundingClientRect:()=>({left:0,top:0,width:1000,height:500}),getContext:()=>mk().getContext('2d')};e.lastChild={remove(){}};e.parentElement={clientWidth:1000,clientHeight:500};Object.defineProperty(e,'innerHTML',{get(){return'';},set(){}});return e;}
global.document={getElementById:el,createElement:()=>el(''),querySelectorAll:()=>[],addEventListener(){},body:el('')};
global.window={addEventListener(){},location:{href:''}};global.localStorage={getItem:()=>null,setItem(){}};global.fetch=async()=>({json:async()=>({})});global.alert=()=>{};
let js=fs.readFileSync('app_extract.js','utf8');js+='\n;global.__S=S;global.__new=newSheet;global.__place=place;global.__bc=buildCircuit;global.__ps=parseStructured;global.__spice=parseSpice;global.__bands=resBands;global.__cat=BJT_CATALOG;';
(0,eval)(js);const S=global.__S;let pass=0,fail=0;const chk=(c,m,d)=>{console.log((c?'PASS':'FAIL')+'  '+m+(d?' - '+d:''));c?pass++:fail++;};

// (1) part number on the component drives the engine model
global.__new();
const q=global.__place('NPN',5,5,'2N3904');global.__place('GND',5,9);
const{ckt}=global.__bc(false);
const qe=ckt.elements.find(e=>e.type==='Q');
chk(qe&&qe.model.BF===416.4,'NPN valued "2N3904" simulates with the 2N3904 card (BF=416.4)',qe&&qe.model.BF);
q.value='2N2222';const r2=global.__bc(false);
chk(r2.ckt.elements.find(e=>e.type==='Q').model.BF===255.9,'switching to 2N2222 switches the card (BF=255.9)');
q.value='NPN';const r3=global.__bc(false);
chk(r3.ckt.elements.find(e=>e.type==='Q').model.BF===200,'generic NPN falls back to the default card');

global.__new();global.__place('NMOS',5,5,'IRF540N');
const me=global.__bc(false).ckt.elements.find(e=>e.type==='M');
chk(me&&me.model.Vto===3.8&&me.model.Kp===30,'NMOS valued "IRF540N" gets the Level-1 power-FET fit',me&&('Vto='+me.model.Vto));

// (2) structured block accepts raw part numbers
const sp=global.__ps('COMPONENTS:\nQ1 = 2N3904, M1 = IRF540N, D1 = 1N4001\nV1 = 5V, Ground = 0V\nNETS:\nV1 -> Q1.Collector\nGround -> Q1.Emitter');
const p=r=>sp.parts.find(x=>x.ref===r);
chk(p('Q1').type==='NPN'&&p('Q1').value==='2N3904','structured "Q1 = 2N3904" → NPN with catalog value');
chk(p('M1').type==='NMOS'&&p('M1').value==='IRF540N','structured "M1 = IRF540N" → NMOS with catalog value');
chk(p('D1').type==='D'&&p('D1').value==='1N4001','structured "D1 = 1N4001" → diode with catalog value');

// (3) SPICE netlist without .model cards resolves via the catalog
const sn=global.__spice('Q1 out in 0 2N3904\nM1 d g 0 0 IRF540N\nD1 a k 1N4007\nV1 in 0 5');
const sq=sn.parts.find(x=>x.ref==='Q1'),sm=sn.parts.find(x=>x.ref==='M1'),sd=sn.parts.find(x=>x.ref==='D1');
chk(sq&&sq.type==='NPN'&&sq.value==='2N3904','SPICE "Q1 … 2N3904" (no .model) → catalog part');
chk(sm&&sm.type==='NMOS'&&sm.value==='IRF540N','SPICE "M1 … IRF540N" (no .model) → catalog part');
chk(sd&&sd.value==='1N4007','SPICE "D1 a k 1N4007" → named diode card');

// (4) resistor colour-code bands from real values
const b47k=global.__bands('4.7k');
chk(b47k[0]==='#e1c542'&&b47k[1]==='#7d3fbf'&&b47k[2]==='#c0392b','4.7k → yellow-violet-red',b47k.join(','));
const b330=global.__bands('330');
chk(b330[0]==='#e67e22'&&b330[1]==='#e67e22'&&b330[2]==='#6b3f22','330 → orange-orange-brown',b330.join(','));

console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);

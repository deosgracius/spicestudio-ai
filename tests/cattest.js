// Component catalog: manufacturer part numbers (2N3904, IRF540N, 1N4001…) must reach the
// engine as real model cards, from the props picker, structured blocks, and SPICE netlists.
const fs=require('fs');const {createCanvas}=require('@napi-rs/canvas');
function mk(){const c=createCanvas(1000,600);c.addEventListener=()=>{};c.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:600});c.style={};Object.defineProperty(c,'clientWidth',{get:()=>1000});Object.defineProperty(c,'clientHeight',{get:()=>500});c.parentElement={clientWidth:1000,clientHeight:500};return c;}
const cv={};function el(id){if(id&&/canvas|sch/.test(id)){if(!cv[id])cv[id]=mk();return cv[id];}const e={style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},addEventListener(){},appendChild(){},removeChild(){},querySelectorAll:()=>[],focus(){},remove(){},clientWidth:1000,clientHeight:500,value:'',textContent:'',getBoundingClientRect:()=>({left:0,top:0,width:1000,height:500}),getContext:()=>mk().getContext('2d')};e.lastChild={remove(){}};e.parentElement={clientWidth:1000,clientHeight:500};Object.defineProperty(e,'innerHTML',{get(){return'';},set(){}});return e;}
global.document={getElementById:el,createElement:()=>el(''),querySelectorAll:()=>[],addEventListener(){},body:el('')};
global.window={addEventListener(){},location:{href:''}};global.localStorage={getItem:()=>null,setItem(){}};global.fetch=async()=>({json:async()=>({})});global.alert=()=>{};
let js=fs.readFileSync('app_extract.js','utf8');js+='\n;global.__S=S;global.__new=newSheet;global.__place=place;global.__bc=buildCircuit;global.__ps=parseStructured;global.__spice=parseSpice;global.__bands=resBands;global.__cat=BJT_CATALOG;global.__LB=LIB_BJT;global.__LD=LIB_DIO;global.__LM=LIB_MOS;global.__LJ=LIB_JFT;global.__look=catLookup;global.__spec=buildFromSpec;global.__cls=libClassOf;global.__filt=filterPalette;';
(0,eval)(js);const S=global.__S;let pass=0,fail=0;const chk=(c,m,d)=>{console.log((c?'PASS':'FAIL')+'  '+m+(d?' - '+d:''));c?pass++:fail++;};

// (1) part number on the component drives the engine model (values = LTspice standard.bjt cards)
global.__new();
const q=global.__place('NPN',5,5,'2N3904');global.__place('GND',5,9);
const{ckt}=global.__bc(false);
const qe=ckt.elements.find(e=>e.type==='Q');
chk(qe&&qe.model.BF===300,'NPN valued "2N3904" simulates with the library card (BF=300)',qe&&qe.model.BF);
q.value='2N2222';const r2=global.__bc(false);
chk(r2.ckt.elements.find(e=>e.type==='Q').model.BF===255.9,'"2N2222" aliases the 2N2222A card (BF=255.9)');
q.value='BD139';const r2b=global.__bc(false);
chk(r2b.ckt.elements.find(e=>e.type==='Q').model.BF===244.9,'new library part BD139 resolves (BF=244.9)');
q.value='NPN';const r3=global.__bc(false);
chk(r3.ckt.elements.find(e=>e.type==='Q').model.BF===200,'generic NPN falls back to the default card');

global.__new();global.__place('NMOS',5,5,'IRF540N');
const me=global.__bc(false).ckt.elements.find(e=>e.type==='M');
chk(me&&me.model.Vto===3.708&&me.model.Kp===60,'IRF540N uses the VDMOS Vto with Kp clamped to 60',me&&('Vto='+me.model.Vto+' Kp='+me.model.Kp));

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

// (5) FULL library integration: all usable LTspice standard cards are importable
chk(Object.keys(global.__LB).length>=1500,'full BJT library embedded',Object.keys(global.__LB).length+' parts');
chk(Object.keys(global.__LD).length>=2300,'full diode library embedded',Object.keys(global.__LD).length+' parts');
chk(Object.keys(global.__LM).length>=1400,'full MOSFET library embedded',Object.keys(global.__LM).length+' parts');
global.__new();global.__place('NPN',5,5,'BC846B');
const lq=global.__bc(false).ckt.elements.find(e=>e.type==='Q');
chk(lq&&lq.model.BF===324.4,'SMD part BC846B (full lib) reaches the engine (BF=324.4)',lq&&lq.model.BF);
global.__new();global.__place('PMOS',5,5,'IRLML6402');
const lm=global.__bc(false).ckt.elements.find(e=>e.type==='M');
chk(lm&&lm.model.Vto===-0.55&&lm.model.type==='pmos','SMD P-FET IRLML6402 (full lib) resolves (Vto=-0.55)',lm&&lm.model.Vto);
chk(global.__look('1N4148').model.Is===2.52e-9,'curated card still wins over the lib duplicate for 1N4148');
const sp3=global.__ps('COMPONENTS:\nQ1 = MMBT3904\nV1 = 5V, Ground = 0V\nNETS:\nV1 -> Q1.Collector\nGround -> Q1.Emitter');
chk(sp3.parts.find(x=>x.ref==='Q1').value==='MMBT3904','structured block accepts any full-lib part number');

// (6) ALL of it: JFET library + zener breakdown actually working
const runSp=t=>{global.__spec(global.__spice(t));return n=>S.sim&&S.sim.dc?S.sim.dc[n]:undefined;};
chk(Object.keys(global.__LJ).length>=1000,'full JFET library embedded',Object.keys(global.__LJ).length+' parts');
chk(Object.keys(global.__LD).length>=2500,'ALL diode cards embedded (none skipped)',Object.keys(global.__LD).length+' parts');
const j=global.__look('2N5457');
chk(j&&j.kind==='j'&&j.model.Vto===-1.372&&Math.abs(j.model.Kp-2.25e-3)<1e-5,'2N5457 JFET resolves (Vto=-1.372, Kp=2·Beta)',j&&('Vto='+j.model.Vto));
const vJ=runSp('V1 vin 0 10\nRD vin d 1k\nJ1 d 0 0 2N5457\n.op');
chk(vJ('d')>6&&vJ('d')<9.5,'JFET conducts at Vgs=0 (depletion mode) - drain pulled down',vJ('d')&&vJ('d').toFixed(2)+'V');
const vZ=runSp('V1 in 0 10\nR1 in k 1k\nD1 0 k BZX84C5V1\n.op');
chk(vZ('k')>4.7&&vZ('k')<5.6,'ZENER BREAKDOWN: BZX84C5V1 reverse-clamps near 5.1V',vZ('k')&&vZ('k').toFixed(2)+'V');
const vF=runSp('V1 in 0 5\nR1 in a 1k\nD1 a 0 BZX84C5V1\n.op');
chk(vF('a')>0.5&&vF('a')<1.1,'same zener still conducts normally forward',vF('a')&&vF('a').toFixed(2)+'V');

// (7) library discoverability: part numbers map to the right placeable device class
chk(global.__cls('2N3904')==='NPN'&&global.__cls('2N3906')==='PNP','libClassOf routes BJTs to NPN/PNP');
chk(global.__cls('BZX84C5V1')==='D'&&global.__cls('IRF9540')==='PMOS'&&global.__cls('2N5457')==='NJF','libClassOf routes diode/PMOS/JFET classes');
let filtOK=true;try{global.__filt('2N39');global.__filt('');}catch(e){filtOK=false;}
chk(filtOK,'palette library search runs without error (headless)');

console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);

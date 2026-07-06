// Run the REAL app JS headlessly with a DOM stub, then verify the demos actually simulate.
const fs = require('fs');
const ctxProxy = new Proxy({}, { get: (t, k) => {
  if (k === 'measureText') return () => ({ width: 10 });
  if (k === 'createLinearGradient') return () => ({ addColorStop(){} });
  return (typeof k === 'string') ? (()=>{}) : undefined;
}, set: () => true });
function fakeEl() {
  const el = {
    style: {}, dataset: {}, _html: '', width: 800, height: 600,
    classList: { add(){}, remove(){}, toggle(){}, contains(){return false;} },
    addEventListener(){}, removeEventListener(){}, appendChild(){}, removeChild(){},
    getContext: () => ctxProxy, getBoundingClientRect: () => ({left:0,top:0,width:800,height:600}),
    querySelectorAll: () => [], querySelector: () => null, focus(){}, remove(){},
    scrollTop: 0, scrollHeight: 0, value: '', textContent: '',
    clientWidth: 800, clientHeight: 240,
  };
  el.lastChild = { remove(){} };
  el.parentElement = { clientWidth: 800, clientHeight: 240 };
  Object.defineProperty(el, 'innerHTML', { get(){return el._html;}, set(v){el._html=v;} });
  return el;
}
global.document = {
  getElementById: () => fakeEl(), createElement: () => fakeEl(),
  querySelectorAll: () => [], addEventListener(){}, body: fakeEl(),
};
global.window = { addEventListener(){}, location:{href:''} };
global.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
global.fetch = async () => ({ json: async () => ({}) });
global.alert = () => {};
global.requestAnimationFrame = (f)=>f&&f();

let js = fs.readFileSync('app_extract.js', 'utf8');
js += '\n;globalThis.__S=S;globalThis.__loadDemo=loadDemo;globalThis.__runSim=runSim;globalThis.__designLowpass=designLowpass;globalThis.__distinctNets=distinctNets;globalThis.__buildCircuit=buildCircuit;globalThis.__getConnectivity=getConnectivity;globalThis.__buildPCB=buildPCB;globalThis.__ratsnest=ratsnest;globalThis.__PCB=PCB;globalThis.__pinCoords=pinCoords;globalThis.__addComp=addComp;globalThis.__PARTS=PARTS;globalThis.__gerberFiles=gerberFiles;globalThis.__runDRC=runDRC;';
// run in global scope
(0, eval)(js);

const S = globalThis.__S;
let pass=0, fail=0;
const chk=(cond,msg,detail)=>{console.log(`${cond?'PASS':'FAIL'}  ${msg}${detail?' — '+detail:''}`);cond?pass++:fail++;};

// boot already ran loadDemo('led'). Check it.
globalThis.__loadDemo('led'); globalThis.__runSim('dc');
{
  const V=S.sim&&S.sim.dc;
  const nets=globalThis.__distinctNets();
  const led=S.comps.find(c=>c.type==='LED');
  const anode=S.nets.pinNet.get(led.uid+':0');
  const iLed=V?((V['+5V']-V[anode])/330):0;
  chk(V&&Math.abs(V['+5V']-5)<1e-6,'LED demo: VCC rail = 5V', V?V['+5V'].toFixed(3)+'V':'no sim');
  chk(iLed>0.007&&iLed<0.013,'LED demo: LED conducts ~10mA (REAL app code)', (iLed*1000).toFixed(2)+'mA');
}
// RC low-pass via AI generator
globalThis.__designLowpass('design a 1khz low-pass filter');
{
  const hasAC = S.ac && Object.keys(S.ac.out).length>=2;
  // true output node = the capacitor's top pin net (R-C junction)
  const cap=S.comps.find(c=>c.type==='C');
  const outNet=S.nets.pinNet.get(cap.uid+':0');
  let dbFc=null;
  if(hasAC&&S.ac.out[outNet]){const fs2=S.ac.freqs;let bi=0,bd=1e9;fs2.forEach((f,i)=>{const d=Math.abs(f-1000);if(d<bd){bd=d;bi=i;}});
    const c=S.ac.out[outNet][bi];dbFc=20*Math.log10(Math.hypot(c.re,c.im)+1e-12);}
  chk(hasAC,'RC generator: produced AC sweep', Object.keys(S.ac.out).join(','));
  chk(dbFc!==null&&dbFc<-1.5&&dbFc>-4.5,'RC generator: ~-3dB at 1kHz on out-net '+outNet+' (REAL app code)', dbFc!==null?dbFc.toFixed(2)+'dB':'n/a');
}
// ---- Phase 0: named pins + connectivity + ratsnest ----
globalThis.__loadDemo('led');
{
  const conn=globalThis.__getConnectivity();
  chk(conn.nets.length===3,'Connectivity: LED demo has 3 nets (+5V, mid, 0)', conn.nets.map(n=>n.name+':'+n.pins.length).join(' '));
  globalThis.__buildPCB();
  const rn=globalThis.__ratsnest();
  chk(rn.length===3,'PCB ratsnest: 3 airwires from the netlist (KiCad-style)', rn.length+' airwires');
  chk(globalThis.__PCB.fps.length===4,'PCB: 4 footprints auto-placed (VCC,R,LED,GND)', globalThis.__PCB.fps.map(f=>f.ref).join(','));
}
// ---- named-pin IC proves the foundation ----
{
  const S=globalThis.__S; S.comps=[]; S.wires=[]; S.refCount={};
  const op=globalThis.__addComp('LM358',5,5);
  const pins=globalThis.__pinCoords(op);
  chk(pins.length===8 && pins[0].name==='OUT1' && pins.some(p=>p.name==='VCC'),'Named pins: LM358 exposes 8 named pins (OUT1…VCC)', pins.map(p=>p.name).join(','));
}
// ---- Phase 1: route the LED demo, ratsnest -> 0, DRC clean, Gerber well-formed ----
{
  const PCB=globalThis.__PCB;
  globalThis.__loadDemo('led'); globalThis.__buildPCB();
  const before=globalThis.__ratsnest().length;
  // route every net: connect its pads with a track on F.Cu
  const byNet={};
  PCB.fps.forEach(f=>f.pads.forEach(pd=>{if(!pd.net)return;const x=f.x+pd.dx,y=f.y+pd.dy;(byNet[pd.net]=byNet[pd.net]||[]).push([x,y]);}));
  Object.entries(byNet).forEach(([net,pts])=>{for(let i=0;i<pts.length-1;i++)PCB.tracks.push({net,layer:'F.Cu',pts:[pts[i],pts[i+1]]});});
  const after=globalThis.__ratsnest().length;
  chk(before===3 && after===0,'Routing: 3 airwires → 0 after routing every net', `before ${before}, after ${after}`);
  const drc=globalThis.__runDRC();
  chk(drc.unrouted===0 && drc.shorts===0,'DRC: clean after routing (0 unrouted, 0 shorts)', JSON.stringify(drc));

  const g=globalThis.__gerberFiles();
  const F=g['board-F_Cu.gbr'];
  const okHdr=F.includes('%FSLAX34Y34*%')&&F.includes('%MOMM*%')&&F.trim().endsWith('M02*');
  const flashes=(F.match(/D03\*/g)||[]).length;      // pad+via flashes
  const draws=(F.match(/D01\*/g)||[]).length;         // track segments
  const totalPads=PCB.fps.reduce((s,f)=>s+f.pads.length,0);
  chk(okHdr,'Gerber: valid RS-274X header/units/end', 'FS+MO+M02 present');
  chk(flashes===totalPads,'Gerber: pad flashes == pad count', `${flashes} flashes / ${totalPads} pads`);
  chk(draws>=3,'Gerber: routed tracks emitted as draws', `${draws} D01 draws`);
  const drl=g['board.drl'];
  chk(drl.startsWith('M48')&&drl.trim().endsWith('M30'),'Excellon drill: valid header/end', 'M48…M30');
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);

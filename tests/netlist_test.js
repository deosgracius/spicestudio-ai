// Verify the full pipeline: data-model schematic -> net extraction -> netlist -> engine.
// Replicates the exact algorithms from spicestudio-ai.html (PARTS, pinCoords, extractNets, buildCircuit).
const { Circuit } = require('./mna.js');

const MODELS = { '1N4148':{Is:2.52e-9,N:1.752}, '1N4007':{Is:7.02e-9,N:1.8}, 'LEDred':{Is:1e-16,N:1.9} };
const PARTS = {
  R:{pins:2,net:(c,net,ckt)=>ckt.add({type:'R',nodes:[net(0),net(1)],value:parseVal(c.value)})},
  C:{pins:2,net:(c,net,ckt)=>ckt.add({type:'C',nodes:[net(0),net(1)],value:parseVal(c.value)})},
  LED:{pins:2,net:(c,net,ckt)=>ckt.add({type:'D',nodes:[net(0),net(1)],model:MODELS[c.value]||MODELS['LEDred']})},
  D:{pins:2,net:(c,net,ckt)=>ckt.add({type:'D',nodes:[net(0),net(1)],model:MODELS[c.value]||MODELS['1N4148']})},
  VCC:{pins:1,rail:true}, GND:{pins:1,ground:true},
};
function parseVal(s){if(typeof s==='number')return s;s=(''+s).trim();const m=s.match(/^(-?[\d.]+)\s*([a-zµμ]*)/i);if(!m)return parseFloat(s)||0;
  let v=parseFloat(m[1]);const u=m[2].toLowerCase();const mul={p:1e-12,n:1e-9,u:1e-6,'µ':1e-6,m:1e-3,k:1e3,meg:1e6,g:1e9}[u];return v*(mul!==undefined?mul:1);}
function rot(dx,dy,r){const a=r*Math.PI/180,cs=Math.round(Math.cos(a)),sn=Math.round(Math.sin(a));return[dx*cs-dy*sn,dx*sn+dy*cs];}
function pinCoords(c){const P=PARTS[c.type];const pins=P.pins===1?[[0,0]]:[[-1,0],[1,0]];return pins.map(([dx,dy])=>{const[rx,ry]=rot(dx,dy,c.rot||0);return{x:c.x+rx,y:c.y+ry};});}
function onSeg(px,py,w){if(w.x1===w.x2)return px===w.x1&&py>=Math.min(w.y1,w.y2)&&py<=Math.max(w.y1,w.y2);if(w.y1===w.y2)return py===w.y1&&px>=Math.min(w.x1,w.x2)&&px<=Math.max(w.x1,w.x2);return false;}
function railLabel(c){return{VCC:'+5V'}[c.type]||'+V';}

function extractNets(S){const parent={};const key=(x,y)=>x+','+y;
  const find=k=>{if(parent[k]===undefined)parent[k]=k;while(parent[k]!==k){parent[k]=parent[parent[k]];k=parent[k];}return k;};
  const uni=(a,b)=>{parent[find(a)]=find(b);};
  const pinPts=[];S.comps.forEach(c=>pinCoords(c).forEach((p,idx)=>{const k=key(p.x,p.y);find(k);pinPts.push({c,idx,x:p.x,y:p.y,k});}));
  S.wires.forEach(w=>{const ka=key(w.x1,w.y1),kb=key(w.x2,w.y2);find(ka);find(kb);uni(ka,kb);pinPts.forEach(pp=>{if(onSeg(pp.x,pp.y,w))uni(pp.k,ka);});});
  S.wires.forEach(w=>{S.wires.forEach(w2=>{if(w===w2)return;[[w2.x1,w2.y1],[w2.x2,w2.y2]].forEach(([px,py])=>{if(onSeg(px,py,w))uni(key(px,py),key(w.x1,w.y1));});});});
  const rootName={};let auto=0;
  S.comps.forEach(c=>{const P=PARTS[c.type];if(!P.ground&&!P.rail)return;const p=pinCoords(c)[0];const r=find(key(p.x,p.y));if(P.ground)rootName[r]='0';else if(P.rail)rootName[r]=railLabel(c);});
  const pinNet=new Map();pinPts.forEach(pp=>{const r=find(pp.k);let nm=rootName[r];if(nm===undefined){nm=rootName[r]='N'+(++auto);}pinNet.set(pp.c.uid+':'+pp.idx,nm);});
  return{find,key,pinNet,rootName};
}
function buildCircuit(S){const nets=extractNets(S);const ckt=new Circuit();const netOf=(c,idx)=>nets.pinNet.get(c.uid+':'+idx)||'0';
  const railDone=new Set();
  S.comps.forEach(c=>{const P=PARTS[c.type];if(P.rail){const nm=railLabel(c);if(!railDone.has(nm)){railDone.add(nm);ckt.add({type:'V',nodes:[nm,'0'],value:parseVal(c.value),ac:0});}return;}if(P.ground)return;if(!P.net)return;P.net(c,i=>netOf(c,i),ckt);});
  return{ckt,nets};}
function distinctNets(nets){const s=new Set();nets.pinNet.forEach(v=>{if(v!=='0')s.add(v);});return[...s];}

let uid=0;const C=(type,x,y,value,r)=>({uid:++uid,type,x,y,value:value??'',rot:r||0});
let pass=0,fail=0;
const near=(a,b,tol,msg)=>{const ok=Math.abs(a-b)<=tol;console.log(`${ok?'PASS':'FAIL'}  ${msg}: got ${(+a).toPrecision(4)}, want ~${b}`);ok?pass++:fail++;};

// --- TEST A: LED driver  +5V -> R330 -> LED -> GND  (the default demo) ---
{
  uid=0;
  const v=C('VCC',3,3,'5'), r=C('R',6,3,'330'), led=C('LED',9,3,'LEDred'), g=C('GND',9,5);
  const S={comps:[v,r,led,g],wires:[
    {x1:3,y1:3,x2:5,y2:3}, // VCC pin(3,3) -> R left pin(5,3)
    {x1:7,y1:3,x2:8,y2:3}, // R right pin(7,3) -> LED left pin(8,3)
    {x1:9,y1:4,x2:9,y2:5}, // LED right pin(10,3)? -> gnd... check pins
  ]};
  // LED pins: center (9,3) -> (8,3),(10,3). GND pin (9,5). Need LED(10,3)->GND(9,5). Fix wires:
  S.wires=[{x1:3,y1:3,x2:5,y2:3},{x1:7,y1:3,x2:8,y2:3},{x1:10,y1:3,x2:9,y2:3},{x1:9,y1:3,x2:9,y2:5}];
  const {ckt,nets}=buildCircuit(S);
  console.log('  LED-driver nets:',distinctNets(nets).join(','),'| elements:',ckt.elements.map(e=>e.type).join(','));
  const op=ckt.dcOP();
  console.log('  node V:',Object.fromEntries(Object.entries(op.V).map(([k,val])=>[k,+val.toFixed(3)])));
  // find LED anode net (R-LED junction)
  const anode=nets.pinNet.get(led.uid+':0');
  const vf=op.V['+5V']!==undefined?(op.V[anode]-0):0; // LED cathode = gnd(0)
  const iLed=(op.V['+5V']-op.V[anode])/330;
  near(op.V['+5V'],5,1e-6,'A: VCC rail = 5V');
  near(iLed*1000,9,3,'A: LED current ~9mA (proves editing R changes I)');
  near(op.V[anode],1.9,0.4,'A: LED forward Vf ~1.9V');
}

// --- TEST B: change R 330 -> 1k, current must drop (edit changes sim) ---
{
  uid=0;
  const v=C('VCC',3,3,'5'), r=C('R',6,3,'1k'), led=C('LED',9,3,'LEDred'), g=C('GND',9,5);
  const S={comps:[v,r,led,g],wires:[{x1:3,y1:3,x2:5,y2:3},{x1:7,y1:3,x2:8,y2:3},{x1:10,y1:3,x2:9,y2:3},{x1:9,y1:3,x2:9,y2:5}]};
  const {ckt,nets}=buildCircuit(S);const op=ckt.dcOP();
  const anode=nets.pinNet.get(led.uid+':0');const iLed=(5-op.V[anode])/1000;
  console.log('  R=1k LED current:',(iLed*1000).toFixed(2),'mA');
  near(iLed*1000,3,1.5,'B: R=1k -> ~3mA (was 9mA at 330Ω) — sim tracks the edit');
}

// --- TEST C: divider 10k/10k from +5V, midpoint = 2.5V ---
{
  uid=0;
  const v=C('VCC',3,3,'5'), r1=C('R',6,3,'10k'), r2=C('R',9,3,'10k'), g=C('GND',11,3);
  const S={comps:[v,r1,r2,g],wires:[{x1:3,y1:3,x2:5,y2:3},{x1:7,y1:3,x2:8,y2:3},{x1:10,y1:3,x2:11,y2:3}]};
  const {ckt,nets}=buildCircuit(S);const op=ckt.dcOP();
  const mid=nets.pinNet.get(r1.uid+':1');
  near(op.V[mid],2.5,1e-3,'C: divider midpoint = 2.5V');
}

// --- TEST D: RC low-pass AC, -3dB near fc ---
{
  uid=0;
  const s=C('VAC',2,3,''), r=C('R',5,3,'1.6k'), cap=C('C',8,3,'100n'), g1=C('GND',2,5), g2=C('GND',8,5);
  // model VAC as V source with ac=1 for the test
  PARTS.VAC={pins:2,net:(c,net,ckt)=>ckt.add({type:'V',nodes:[net(0),net(1)],value:0,ac:1})};
  const S={comps:[s,r,cap,g1,g2],wires:[
    {x1:1,y1:3,x2:4,y2:3}, // Vac left(1,3)->R left(4,3)
    {x1:6,y1:3,x2:7,y2:3}, // R right(6,3)->C left(7,3)
    {x1:3,y1:3,x2:2,y2:5}, // Vac right(3,3)-> ... need Vac- to gnd and C right to gnd
  ]};
  // Vac pins (1,3),(3,3); R (4,3),(6,3); C (7,3),(9,3); g1(2,5); g2(8,5)
  // Route Vac+ UP and over so it doesn't cross the Vac- pin at (3,3)
  S.wires=[{x1:1,y1:3,x2:1,y2:1},{x1:1,y1:1,x2:4,y2:1},{x1:4,y1:1,x2:4,y2:3},
           {x1:6,y1:3,x2:7,y2:3},{x1:3,y1:3,x2:3,y2:5},{x1:3,y1:5,x2:2,y2:5},
           {x1:9,y1:3,x2:9,y2:5},{x1:9,y1:5,x2:8,y2:5}];
  const {ckt,nets}=buildCircuit(S);
  const out=nets.pinNet.get(cap.uid+':0');
  console.log('  D nets:',distinctNets(nets).join(','),'| out-net:',out,'| elements:',ckt.elements.map(e=>e.type+'['+e.nodes.join(',')+(e.ac!==undefined?' ac='+e.ac:'')+']').join(' '));
  const r2=ckt.ac(10,1e5,400);const fc=1/(2*Math.PI*1600*1e-7);
  console.log('  D out@10Hz mag:',require('./mna.js').cabs(r2.out[out][0]).toFixed(3),'| keys:',Object.keys(r2.out).join(','));
  let bi=0,bd=1e9;r2.freqs.forEach((f,i)=>{const d=Math.abs(f-fc);if(d<bd){bd=d;bi=i;}});
  const {cabs}=require('./mna.js');const db=20*Math.log10(cabs(r2.out[out][bi]));
  near(db,-3.0,0.6,`D: RC low-pass -3dB @ fc=${fc.toFixed(0)}Hz`);
}

// --- TEST E: canonical LED demo layout (to be ported verbatim into the app) ---
{
  uid=0;
  const v=C('VCC',3,3,'5'), r=C('R',6,3,'330'), led=C('LED',9,3,'LEDred'), g=C('GND',10,6);
  const S={comps:[v,r,led,g],wires:[
    {x1:3,y1:3,x2:5,y2:3},   // VCC(3,3) -> R.left(5,3)
    {x1:7,y1:3,x2:8,y2:3},   // R.right(7,3) -> LED.anode(8,3)
    {x1:10,y1:3,x2:10,y2:6}, // LED.cathode(10,3) -> GND(10,6)
  ]};
  const {ckt,nets}=buildCircuit(S);const op=ckt.dcOP();
  const anode=nets.pinNet.get(led.uid+':0');const iLed=(5-op.V[anode])/330;
  console.log('  E LED-demo nets:',distinctNets(nets).join(','));
  near(iLed*1000,10,3,'E: canonical LED demo conducts ~10mA (ready to port)');
}
// --- TEST F: canonical RC low-pass (VAC rot180 so + faces R, no pin crossing) ---
{
  uid=0;
  PARTS.VAC={pins:2,net:(c,net,ckt)=>ckt.add({type:'V',nodes:[net(0),net(1)],value:0,ac:1})};
  const s=C('VAC',2,3,'',180), r=C('R',6,3,'1.6k'), cap=C('C',9,4,'100n',90), g1=C('GND',1,6), g2=C('GND',9,7);
  const S={comps:[s,r,cap,g1,g2],wires:[
    {x1:3,y1:3,x2:5,y2:3},   // VAC+ (rot180 -> pin0 at (3,3)) -> R.left(5,3)
    {x1:7,y1:3,x2:9,y2:3},   // R.right(7,3) -> C.top(9,3)
    {x1:1,y1:3,x2:1,y2:6},   // VAC- (pin1 at (1,3)) -> GND(1,6)
    {x1:9,y1:5,x2:9,y2:7},   // C.bottom(9,5) -> GND(9,7)
  ]};
  const {ckt,nets}=buildCircuit(S);const out=nets.pinNet.get(cap.uid+':0');
  console.log('  F RC nets:',distinctNets(nets).join(','),'| src:',ckt.elements.find(e=>e.type==='V').nodes.join(','),'| out:',out);
  const r2=ckt.ac(10,1e5,400);const fc=1/(2*Math.PI*1600*1e-7);
  let bi=0,bd=1e9;r2.freqs.forEach((f,i)=>{const d=Math.abs(f-fc);if(d<bd){bd=d;bi=i;}});
  const db=20*Math.log10(require('./mna.js').cabs(r2.out[out][bi]));
  near(db,-3.0,0.6,'F: canonical RC low-pass -3dB (ready to port)');
}

// --- TEST G: canonical half-wave rectifier (transient + diode + smoothing cap) ---
{
  uid=0;
  PARTS.VAC={pins:2,net:(c,net,ckt)=>{const amp=5,freq=60;ckt.add({type:'V',nodes:[net(0),net(1)],value:t=>amp*Math.sin(2*Math.PI*freq*t),ac:amp});}};
  const s=C('VAC',2,3,'',180), d=C('D',6,3,'1N4007'), cap=C('C',9,4,'47u',90), r=C('R',11,4,'1k',90), g1=C('GND',1,6), g2=C('GND',9,7), g3=C('GND',11,7);
  const S={comps:[s,d,cap,r,g1,g2,g3],wires:[
    {x1:3,y1:3,x2:5,y2:3},   // VAC+ -> D.anode
    {x1:7,y1:3,x2:9,y2:3},   // D.cathode -> C.top (out)
    {x1:9,y1:3,x2:11,y2:3},  // C.top -> R.top
    {x1:1,y1:3,x2:1,y2:6},   // VAC- -> GND
    {x1:9,y1:5,x2:9,y2:7},   // C.bottom -> GND
    {x1:11,y1:5,x2:11,y2:7}, // R.bottom -> GND
  ]};
  const {ckt,nets}=buildCircuit(S);const out=nets.pinNet.get(cap.uid+':0');
  const r2=ckt.transient(0.1,1e-4,{uic:true});const vo=r2.trace[out];
  const last=vo.slice(vo.length-200);const vmax=Math.max(...last),vmin=Math.min(...last);
  console.log('  G rectifier out: max='+vmax.toFixed(2)+'V min='+vmin.toFixed(2)+'V (peak-ish DC with ripple)');
  near(vmax>2&&vmax<5?3.5:0,3.5,0.1,'G: rectified output between 2–5V (diode+cap transient works)');
  near(vmin>0.3?1:0,1,0.1,'G: cap holds charge between peaks (ripple, not zero)');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);

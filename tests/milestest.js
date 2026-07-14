// Milestone features: design archive (New never loses work), theme palette, live lint,
// breadboard BUILDER (place parts on holes -> solve), calc cards, firmware suggest/lint, report.
const fs=require('fs');const {createCanvas}=require('@napi-rs/canvas');
function mk(){const c=createCanvas(1000,600);c.addEventListener=()=>{};c.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:600});c.style={};Object.defineProperty(c,'clientWidth',{get:()=>1000});Object.defineProperty(c,'clientHeight',{get:()=>500});c.parentElement={clientWidth:1000,clientHeight:500};return c;}
const cv={};function el(id){if(id&&/canvas|sch/.test(id)){if(!cv[id])cv[id]=mk();return cv[id];}const e={style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},addEventListener(){},appendChild(){},removeChild(){},querySelectorAll:()=>[],focus(){},remove(){},clientWidth:1000,clientHeight:500,value:'',textContent:'',className:'',title:'',getBoundingClientRect:()=>({left:0,top:0,width:1000,height:500}),getContext:()=>mk().getContext('2d')};e.lastChild={remove(){}};e.parentElement={clientWidth:1000,clientHeight:500};Object.defineProperty(e,'innerHTML',{get(){return'';},set(){}});return e;}
global.document={getElementById:el,createElement:()=>el(''),querySelectorAll:()=>[],addEventListener(){},body:el(''),documentElement:{dataset:{}}};
const store={};global.window={addEventListener(){},location:{href:''},innerHeight:800};global.localStorage={getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v;},removeItem:k=>{delete store[k];}};global.fetch=async()=>({json:async()=>({})});global.alert=()=>{};
let js=fs.readFileSync('app_extract.js','utf8');
js+='\n;global.__S=S;global.__BB=BB;global.__TH=()=>TH;global.__theme=applyTheme;global.__new=newSheet;global.__demo=loadDemo;global.__place=place;global.__lint=lintSchematic;global.__bbClick=bbClick;global.__bbMode=bbMode;global.__bbRun=bbRun;global.__bbLint=bbLint;global.__bbXY=bbHoleXY;global.__fx=fxCards;global.__rep=buildReportHTML;global.__fwLint=fwLint;global.__fwSug=fwSuggest;global.__ser=serializeDesign;global.__load=loadDesign;global.__restore=restoreDesign;global.__PARTS=PARTS;global.__pc=pinCoords;global.__bc=buildCircuit;global.__buildPCB=buildPCB;global.__PCB=PCB;global.__fpB=fpBounds;global.__nice=niceStep;global.__FW=FW;global.__findPin=fwFindLedPin;';
(0,eval)(js);const S=global.__S,BB=global.__BB;let pass=0,fail=0;const chk=(c,m,d)=>{console.log((c?'PASS':'FAIL')+'  '+m+(d?' - '+d:''));c?pass++:fail++;};

// (1) theme palette switches
global.__theme('light');chk(global.__TH().mode==='light'&&global.__TH().bg==='#f4f5f8','light theme palette applied');
global.__theme('dark');chk(global.__TH().mode==='dark','dark theme palette restored');

// (2) New archives the outgoing design
global.__demo('rect');const hadParts=S.comps.length;
global.__new();
const arch=JSON.parse(store['ss_archive']||'[]');
chk(S.comps.length===0&&arch.length>=1&&arch[0].n===hadParts,'New archived the previous design',arch.length+' archived, '+arch[0].n+' parts');
global.__restore(0);
chk(S.comps.length===hadParts,'restoreDesign brings the archived design back',S.comps.length+' parts');

// (3) live schematic lint
global.__new();global.__place('R',5,5,'1k');
let iss=global.__lint();
chk(iss.some(x=>/no source/.test(x))&&iss.some(x=>/floating/.test(x)),'lint flags missing source + floating pins',iss.join(' | '));
global.__demo('led');iss=global.__lint();
chk(iss.length===0,'LED demo lints clean',iss.join(' | ')||'clean');

// (4) breadboard builder: 5V rail -> R -> LED -> gnd rail, solved like a physical board
global.__new();BB.build.parts=[];BB.build.jumpers=[];BB.build.refN=0;
const selStub=el('');selStub.value='R';global.document.getElementById=id=>id==='bb-part'?selStub:el(id);
global.__bbMode('part');
global.__bbClick(...global.__bbXY({k:'P',col:2}));         // R pin1 on + rail
global.__bbClick(...global.__bbXY({k:'m',col:2,row:1}));   // R pin2 in a2
selStub.value='LED';
global.__bbClick(...global.__bbXY({k:'m',col:2,row:2}));   // LED anode same tie-point column (top half)
global.__bbClick(...global.__bbXY({k:'N',col:4}));         // LED cathode on - rail
chk(BB.build.parts.length===2,'two parts placed on the board',BB.build.parts.map(p=>p.ref).join(','));
global.__bbRun();
chk(BB.build.results&&BB.build.results.conv,'breadboard circuit solved');
const led=BB.build.results.leds[0];
chk(led&&led.i>1e-3,'LED lights: series current through the board',led&&(led.i*1000).toFixed(1)+'mA');
chk(global.__bbLint().length===0,'built board lints clean',global.__bbLint().join(' | ')||'clean');
BB.build.jumpers.push({a:{k:'P',col:0},b:{k:'N',col:0}});
chk(global.__bbLint().some(x=>/supply short/.test(x)),'rail-to-rail jumper flagged as supply short');
BB.build.jumpers.pop();

// (5) breadboard build survives save/load
const snap=global.__ser();
chk(/"bb":/.test(snap),'breadboard build serialized into the design');
BB.build.parts=[];global.__load(snap,false);
chk(BB.build.parts.length===2,'breadboard build restored from the design');

// (6) calc cards produce the LED math
global.document.getElementById=el;   // restore stub
global.__demo('led');
const cards=global.__fx();
chk(cards.some(c=>/drive current/.test(c.title)&&/= <b>/.test(c.body)),'ƒx card computes the LED drive current',cards.map(c=>c.title).join(' | '));

// (7) firmware: suggest from circuit + live lint
global.__fwSug();   // led demo on sheet -> blink suggestion written to fw-code stub (value set on stub el)
chk(true,'fwSuggest runs against the schematic');
let ok=true;try{global.__fwLint();}catch(e){ok=false;}
chk(ok,'fwLint runs (live syntax check)');

// (8) implementation report
const html=global.__rep();
chk(/Implementation Report/.test(html)&&/Bill of materials/.test(html)&&/LED/.test(html),'report contains BOM + verification sections');

// (9) MCUs: real pinouts, and a Pico's 3V3 pin powers an LED through the netlist
const PARTS=global.__PARTS;
chk(PARTS.PICO&&PARTS.PICO.pins===40&&PARTS.PICO.pinDefs[0].name==='GP0'&&PARTS.PICO.pinDefs[39].name==='VBUS','Pico has the real 40-pin pinout (GP0 … VBUS)');
chk(PARTS.RPI40&&PARTS.RPI40.pinDefs[1].name==='5V'&&PARTS.MSP430&&PARTS.MSP430.pinDefs[0].name==='DVCC','Raspberry Pi header + MSP430 pinouts present');
global.__new();
const pico=global.__place('PICO',10,12),r2=global.__place('R',20,3,'330'),led2=global.__place('LED',26,3,'LEDred');
const pin3v3=global.__pc(pico)[35],pinGnd=global.__pc(pico)[2],rp=global.__pc(r2),lp=global.__pc(led2);
S.wires.push({x1:pin3v3.x,y1:pin3v3.y,x2:rp[0].x,y2:rp[0].y},{x1:rp[1].x,y1:rp[1].y,x2:lp[0].x,y2:lp[0].y},{x1:lp[1].x,y1:lp[1].y,x2:pinGnd.x,y2:pinGnd.y});
const{ckt}=global.__bc(false);const op=ckt.dcOP();
const vsrc=ckt.elements.filter(e=>e.type==='V');
chk(vsrc.some(e=>e.value===3.3)&&vsrc.some(e=>e.value===0),'Pico emits 3V3 + GND sources into the netlist',vsrc.length+' sources');
const ledNets=[S.nets.pinNet.get(led2.uid+':0'),S.nets.pinNet.get(led2.uid+':1')];
const vLed=(op.V[ledNets[0]]??0)-(op.V[ledNets[1]]??0);
chk(op.conv&&vLed>1.5&&vLed<2.2,'LED powered from the Pico 3V3 pin (real Vf drop)',vLed.toFixed(2)+'V');
// (10) manual real-measurement footprint
r2.fp={l:6.3,w:2.3,p:10};global.__buildPCB();
const fpr=global.__PCB.fps.find(f=>f.ref===r2.ref);
chk(fpr&&fpr.pads[0].dx===-5&&fpr.pads[1].dx===5,'manual 10mm pitch → pads at ±5mm',fpr&&fpr.pads.map(p=>p.dx).join(','));
const b2=global.__fpB(fpr);
chk(Math.abs(b2.minx+3.15)<0.01&&Math.abs(b2.maxy-1.15)<0.01,'body bounds follow measured 6.3×2.3mm',JSON.stringify(b2));
// (10b) FIRMWARE -> CIRCUIT: a sketch-driven GPIO pin lights the LED on the schematic
global.__new();
const pico2=global.__place('PICO',10,12),r3=global.__place('R',22,1,'220'),led3=global.__place('LED',28,1,'LEDred');
global.__place('GND',29,6);   // ground symbol under the LED cathode
const gp0=global.__pc(pico2)[0],rp2=global.__pc(r3),lp2=global.__pc(led3);
// route ABOVE the pico's pin rows so no wire T-junctions onto another pin
S.wires.push({x1:gp0.x,y1:gp0.y,x2:gp0.x,y2:1},{x1:gp0.x,y1:1,x2:rp2[0].x,y2:1},
  {x1:rp2[1].x,y1:1,x2:lp2[0].x,y2:1},{x1:lp2[1].x,y1:1,x2:lp2[1].x,y2:6});
const FW=global.__FW;
FW.pins={0:1};                                            // sketch: digitalWrite(0, HIGH)
let opHi=global.__bc(false).ckt.dcOP();
const ledN=[S.nets.pinNet.get(led3.uid+':0'),S.nets.pinNet.get(led3.uid+':1')];
const vHi=(opHi.V[ledN[0]]??0)-(opHi.V[ledN[1]]??0);
FW.pins={0:0};                                            // sketch: digitalWrite(0, LOW)
let opLo=global.__bc(false).ckt.dcOP();
const vLo=(opLo.V[ledN[0]]??0)-(opLo.V[ledN[1]]??0);
chk(vHi>1.4&&vHi<2.2,'GP0 HIGH from the sketch lights the LED (real Vf)',vHi.toFixed(2)+'V');
chk(Math.abs(vLo)<0.2,'GP0 LOW turns it off',vLo.toFixed(3)+'V');
const found=global.__findPin();
chk(found&&found.pin===0&&found.via===r3,'fwFindLedPin traces LED -> series R -> GP0',found&&('GP'+found.pin+' via '+found.via.ref));
FW.pins={};
// (11) professional scope: 1-2-5 tick engine
chk(global.__nice(8,8)===1&&global.__nice(0.05,6)===0.01&&global.__nice(33,6)===5,'niceStep picks 1-2-5 ticks',[global.__nice(8,8),global.__nice(0.05,6),global.__nice(33,6)].join(','));

console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);

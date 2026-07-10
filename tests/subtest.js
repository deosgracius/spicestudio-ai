// .subckt support: G (VCCS) engine element, X-instance expansion with node scoping,
// and the built-in op-amp macromodels (LM358/TL072) behaving like the real parts.
const fs=require('fs');const {createCanvas}=require('@napi-rs/canvas');
function mk(){const c=createCanvas(1000,600);c.addEventListener=()=>{};c.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:600});c.style={};Object.defineProperty(c,'clientWidth',{get:()=>1000});Object.defineProperty(c,'clientHeight',{get:()=>500});c.parentElement={clientWidth:1000,clientHeight:500};return c;}
const cv={};function el(id){if(id&&/canvas|sch/.test(id)){if(!cv[id])cv[id]=mk();return cv[id];}const e={style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},addEventListener(){},appendChild(){},removeChild(){},querySelectorAll:()=>[],focus(){},remove(){},clientWidth:1000,clientHeight:500,value:'',textContent:'',getBoundingClientRect:()=>({left:0,top:0,width:1000,height:500}),getContext:()=>mk().getContext('2d')};e.lastChild={remove(){}};e.parentElement={clientWidth:1000,clientHeight:500};Object.defineProperty(e,'innerHTML',{get(){return'';},set(){}});return e;}
global.document={getElementById:el,createElement:()=>el(''),querySelectorAll:()=>[],addEventListener(){},body:el('')};
global.window={addEventListener(){},location:{href:''}};global.localStorage={getItem:()=>null,setItem(){}};global.fetch=async()=>({json:async()=>({})});global.alert=()=>{};
let js=fs.readFileSync('app_extract.js','utf8');js+='\n;global.__S=S;global.__spice=parseSpice;global.__spec=buildFromSpec;global.__bc=buildCircuit;global.__cabs=cabs;global.__look=looksLikeSpice;';
(0,eval)(js);const S=global.__S;let pass=0,fail=0;const chk=(c,m,d)=>{console.log((c?'PASS':'FAIL')+'  '+m+(d?' - '+d:''));c?pass++:fail++;};
const run=text=>{const sp=global.__spice(text);global.__spec(sp);return sp;};
const V=n=>S.sim&&S.sim.dc?S.sim.dc[n]:undefined;

// (1) G element: VCCS into 1k gives g*Rl*Vin
run('V1 in 0 1\nG1 0 out in 0 1m\nRL out 0 1k\n.op');
chk(Math.abs(V('out')-1)<1e-6,'VCCS: G=1mS into 1k from 1V reads 1.000V',V('out'));

// (2) .subckt expansion: two instances of a divider, scoped internals
const sp2=run('.subckt DIV a b m\nR1 a m 1k\nR2 m b 1k\n.ends\nV1 in 0 10\nX1 in 0 mid1 DIV\nX2 in 0 mid2 DIV\n.op');
chk(sp2.parts.length===5,'divider expanded twice: V1 + 2x2 resistors',sp2.parts.map(p=>p.ref).join(','));
chk(sp2.parts.some(p=>p.ref==='X1.R1')&&sp2.parts.some(p=>p.ref==='X2.R1'),'instance-scoped refs (X1.R1 / X2.R1)');
chk(Math.abs(V('mid1')-5)<1e-6&&Math.abs(V('mid2')-5)<1e-6,'both instances solve to 5V',V('mid1')+' / '+V('mid2'));

// (3) LM358 macromodel: unity buffer follows the input
run('V1 in 0 1\nX1 in out 0 0 out LM358\n.op');
chk(Math.abs(V('out')-1)<0.01,'LM358 unity buffer: out ≈ 1.000V',V('out'));

// (4) TL072 macromodel: inverting amp, gain -Rf/Ri = -10
run('V1 in 0 0.1\nRi in inn 1k\nRf inn out 10k\nX1 0 inn 0 0 out TL072\n.op');
chk(Math.abs(V('out')+1)<0.02,'TL072 inverting x(-10): 0.1V in → -1.00V out',V('out'));

// (5) the macromodel has REAL bandwidth: LM358 buffer rolls off near its 1MHz GBW
run('V1 in 0 0 AC 1\nX1 in out 0 0 out LM358\n.op');
const{ckt}=global.__bc(true);const r=ckt.ac(1e3,1e7,41);
const mag=f=>{let bi=0;r.freqs.forEach((fq,i)=>{if(Math.abs(fq-f)<Math.abs(r.freqs[bi]-f))bi=i;});return global.__cabs(r.out['out'][bi]);};
chk(mag(1e4)>0.98,'buffer flat at 10kHz',mag(1e4).toFixed(3));
chk(mag(1e7)<0.25,'buffer rolled off past GBW (10MHz)',mag(1e7).toFixed(3));
const m1M=mag(1e6);
chk(m1M>0.4&&m1M<0.95,'-3dB corner in the neighbourhood of 1MHz GBW',m1M.toFixed(3));

// (6) detection: an X-line netlist is recognized as SPICE
chk(global.__look('V1 in 0 1\nX1 in out 0 0 out LM358')===true,'netlist with X instance detected as SPICE');

console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);

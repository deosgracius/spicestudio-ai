// Layout directives + FUSE/TVS device support: parseStructured must capture explicit
// vertical-column directives and place the forced set as a real vertical stack (not a row).
const fs=require('fs');const {createCanvas}=require('@napi-rs/canvas');
function mk(){const c=createCanvas(1000,600);c.addEventListener=()=>{};c.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:600});c.style={};Object.defineProperty(c,'clientWidth',{get:()=>1000});Object.defineProperty(c,'clientHeight',{get:()=>500});c.parentElement={clientWidth:1000,clientHeight:500};return c;}
const cv={};function el(id){if(id&&/canvas|sch/.test(id)){if(!cv[id])cv[id]=mk();return cv[id];}const e={style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},addEventListener(){},appendChild(){},removeChild(){},querySelectorAll:()=>[],focus(){},remove(){},clientWidth:1000,clientHeight:500,value:'',textContent:'',getBoundingClientRect:()=>({left:0,top:0,width:1000,height:500}),getContext:()=>mk().getContext('2d')};e.lastChild={remove(){}};e.parentElement={clientWidth:1000,clientHeight:500};Object.defineProperty(e,'innerHTML',{get(){return'';},set(){}});return e;}
global.document={getElementById:el,createElement:()=>el(''),querySelectorAll:()=>[],addEventListener(){},body:el('')};
global.window={addEventListener(){},location:{href:''}};global.localStorage={getItem:()=>null,setItem(){}};global.fetch=async()=>({json:async()=>({})});global.alert=()=>{};
let js=fs.readFileSync('app_extract.js','utf8');js+='\n;global.__S=S;global.__struct=looksStructured;global.__ps=parseStructured;global.__spec=buildFromSpec;';
(0,eval)(js);const S=global.__S;let pass=0,fail=0;const chk=(c,m,d)=>{console.log((c?'PASS':'FAIL')+'  '+m+(d?' — '+d:''));c?pass++:fail++;};

const block=`COMPONENTS:
  D1 = TVS_DIODE, D2 = TVS_DIODE
  F1 = FUSE
  R_load = 100
  V_surge = 24V, Ground = 0V

LAYOUT:
  FORCE_COMPONENTS = D1, D2, Ground
  ALIGNMENT = VERTICAL_COLUMN
  COLUMN_X_COORDINATE = 400

NETS:
  V_surge -> F1.Pin1
  F1.Pin2 -> Node_Prot
  Node_Prot -> D1.Anode, R_load.Pin1
  D1.Cathode -> Ground
  Node_Prot -> D2.Anode
  D2.Cathode -> Ground
  R_load.Pin2 -> Ground`;

chk(global.__struct(block)===true,'TVS block detected as structured');
const sp=global.__ps(block);

// (1) directives captured, not misread as phantom parts
chk(sp.layout&&/vert/i.test(sp.layout.align||''),'ALIGNMENT=VERTICAL_COLUMN captured',sp.layout&&sp.layout.align);
chk(sp.layout.colX===400,'COLUMN_X_COORDINATE=400 captured',''+sp.layout.colX);
chk(Array.isArray(sp.layout.forced)&&sp.layout.forced.length===2&&/d1/i.test(sp.layout.forced[0]),'FORCE_COMPONENTS captured (Ground stripped)',sp.layout.forced.join(','));

// (2) FUSE -> R(near-zero), TVS_DIODE -> D — and no phantom ALIGNMENT/FORCE_COMPONENTS parts
const d=sp.parts.filter(p=>p.type==='D').length,r=sp.parts.filter(p=>p.type==='R'),v=sp.parts.filter(p=>p.type==='V').length;
chk(d===2,'2 TVS diodes mapped to D',''+d);
chk(r.length===2,'FUSE + R_load both mapped to R',''+r.length);
chk(r.some(p=>parseFloat(p.value)<1),'FUSE modelled as a near-zero-ohm link',r.map(p=>p.value).join(','));
chk(v===1,'1 supply',''+v);
chk(!sp.parts.some(p=>/align|force|column|layout/i.test(p.ref||'')),'no phantom directive parts',sp.parts.map(p=>p.ref).join(','));

// (3) build it, then confirm the forced set is a VERTICAL column (shared x, increasing y) — not a row
global.__spec(sp);
const col=S.comps.filter(c=>/^(d1|d2)$/i.test(c.ref));
chk(col.length===2,'D1,D2 present after build',col.map(c=>c.ref).join(','));
const sameX=col.every(c=>c.x===col[0].x), gx=Math.round(400/20);
chk(sameX&&col[0].x===gx,'D1,D2 share the directed column x (=400/GRID=20)',col.map(c=>c.ref+'@x'+c.x).join(','));
chk(col[0].y!==col[1].y,'D1,D2 stacked at different y (vertical, not a row)',col.map(c=>c.ref+'@y'+c.y).join(','));

console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);

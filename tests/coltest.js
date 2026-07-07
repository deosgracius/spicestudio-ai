// Guided 2D: author "* --- COLUMN n ---" comment sections become side-by-side vertical stacks,
// so multi-column netlists stop collapsing into a single horizontal row.
const fs=require('fs');const {createCanvas}=require('@napi-rs/canvas');
function mk(){const c=createCanvas(1000,600);c.addEventListener=()=>{};c.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:600});c.style={};Object.defineProperty(c,'clientWidth',{get:()=>1000});Object.defineProperty(c,'clientHeight',{get:()=>500});c.parentElement={clientWidth:1000,clientHeight:500};return c;}
const cv={};function el(id){if(id&&/canvas|sch/.test(id)){if(!cv[id])cv[id]=mk();return cv[id];}const e={style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},addEventListener(){},appendChild(){},removeChild(){},querySelectorAll:()=>[],focus(){},remove(){},clientWidth:1000,clientHeight:500,value:'',textContent:'',getBoundingClientRect:()=>({left:0,top:0,width:1000,height:500}),getContext:()=>mk().getContext('2d')};e.lastChild={remove(){}};e.parentElement={clientWidth:1000,clientHeight:500};Object.defineProperty(e,'innerHTML',{get(){return'';},set(){}});return e;}
global.document={getElementById:el,createElement:()=>el(''),querySelectorAll:()=>[],addEventListener(){},body:el('')};
global.window={addEventListener(){},location:{href:''}};global.localStorage={getItem:()=>null,setItem(){}};global.fetch=async()=>({json:async()=>({})});global.alert=()=>{};
let js=fs.readFileSync('app_extract.js','utf8');js+='\n;global.__S=S;global.__ps=parseStructured;global.__spec=buildFromSpec;global.__ext=extractNets;global.__pc=pinCoords;';
(0,eval)(js);const S=global.__S;let pass=0,fail=0;const chk=(c,m,d)=>{console.log((c?'PASS':'FAIL')+'  '+m+(d?' — '+d:''));c?pass++:fail++;};
const get=r=>S.comps.find(c=>String(c.ref).toLowerCase()===r.toLowerCase());

// ---- Block A: debounced switch, two column sections, NO explicit x coords ----
const debounce=`COMPONENTS:
R_pullup = 10k, R_series = 1k
C_debounce = 100nF
SW1 = SWITCH
V_cc = 5V, Ground = 0V

NETS:
* --- COLUMN 1: THE POWER PULL-UP STACK ---
V_cc -> R_pullup.Pin1
R_pullup.Pin2 -> Node_Switch_Raw -> SW1.Pin1
SW1.Pin2 -> Ground

* --- COLUMN 2: THE PASSIVE FILTER STACK ---
Node_Switch_Raw -> R_series.Pin1
R_series.Pin2 -> Node_Clean_Output -> C_debounce.Pin1
C_debounce.Pin2 -> Ground`;
const spA=global.__ps(debounce);
chk(spA.layout.columns.length===2,'debounce parsed into 2 author columns',spA.layout.columns.map(a=>a.join('/')).join(' | '));
chk(spA.layout.columns[0].includes('R_pullup')&&spA.layout.columns[1].includes('C_debounce'),'right parts in each column');
global.__spec(spA);
const c1=[get('R_pullup'),get('V_cc')].filter(Boolean),c2=[get('R_series'),get('C_debounce')].filter(Boolean);
chk(c1.every(c=>c.x===c1[0].x),'column 1 shares one x',c1.map(c=>c.ref+'@'+c.x).join(','));
chk(c2.every(c=>c.x===c2[0].x),'column 2 shares one x',c2.map(c=>c.ref+'@'+c.x).join(','));
chk(c1[0].x!==c2[0].x,'the two columns sit at DIFFERENT x (not a flat row)',c1[0].x+' vs '+c2[0].x);
chk(get('R_pullup').y!==get('R_series').y||get('R_pullup').x!==get('R_series').x,'parts are not all on one row');

// ---- Block B: dual-rail TVS with explicit COLUMN_n_X override + TVS model label ----
const dual=`COMPONENTS:
D1_pos = TVS_DIODE, D2_pos = TVS_DIODE
D1_neg = TVS_DIODE, D2_neg = TVS_DIODE
V_rail_plus = 15V, V_rail_minus = -15V, Ground = 0V

NETS:
* --- COLUMN 1: POSITIVE RAIL CLAMP STACK ---
V_rail_plus -> D1_pos.Cathode
D1_pos.Anode -> D2_pos.Cathode
D2_pos.Anode -> Ground

* --- COLUMN 2: NEGATIVE RAIL CLAMP STACK ---
Ground -> D1_neg.Cathode
D1_neg.Anode -> D2_neg.Cathode
D2_neg.Anode -> V_rail_minus

* --- LAYOUT COORDINATE OVERRIDE ---
GRID_MODE = BI_COLUMN_MATRIX
COLUMN_1_X = 200
COLUMN_2_X = 600`;
const spB=global.__ps(dual);
chk(spB.layout.colXs[0]===200&&spB.layout.colXs[1]===600,'COLUMN_1_X / COLUMN_2_X captured',JSON.stringify(spB.layout.colXs));
chk(spB.layout.columns.length===2,'dual-rail parsed into 2 columns',spB.layout.columns.map(a=>a.join('/')).join(' | '));
chk(spB.parts.filter(p=>p.type==='D').length===4,'4 TVS diodes',''+spB.parts.filter(p=>p.type==='D').length);
chk(spB.parts.every(p=>p.type!=='D'||/tvs/i.test(p.value||'')),'TVS model string kept as label (not defaulted to 1N4148)',spB.parts.filter(p=>p.type==='D').map(p=>p.value).join(','));
global.__spec(spB);
const pos=[get('D1_pos'),get('D2_pos')],neg=[get('D1_neg'),get('D2_neg')];
chk(pos.every(c=>c.x===Math.round(200/20)),'positive stack at COLUMN_1_X/GRID=10',pos.map(c=>c.ref+'@'+c.x).join(','));
chk(neg.every(c=>c.x===Math.round(600/20)),'negative stack at COLUMN_2_X/GRID=30',neg.map(c=>c.ref+'@'+c.x).join(','));
chk(pos[0].y!==pos[1].y,'positive diodes stacked vertically',pos.map(c=>'y'+c.y).join(','));
chk(get('D1_pos').value!=='1N4148','TVS diode no longer mislabelled 1N4148',get('D1_pos').value);

// (3) columns are joined by REAL vertical wires now, not just fallback labels
chk(S.wires.length>=3,'continuous vertical wires drawn inside the columns',S.wires.length+' wire segments');
const vertical=S.wires.filter(w=>w.x1===w.x2&&w.y1!==w.y2).length;
chk(vertical>=3,'those traces are vertical (share x, span y)',vertical+' vertical segments');
// connectivity intact: D1_pos and D2_pos meet at one node via the wire (no label needed between them)
const ex=global.__ext();const pn=ex.pinNet;
const key=(ref,idx)=>{const c=get(ref);return c.uid+':'+idx;};
chk(pn.get(key('D1_pos',0))===pn.get(key('D2_pos',1)),'D1_pos.Anode wired to D2_pos.Cathode (same node)',pn.get(key('D1_pos',0))+' = '+pn.get(key('D2_pos',1)));
chk(pn.get(key('D1_pos',0))!==pn.get(key('D1_neg',0)),'positive and negative stacks stay electrically separate');

console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);

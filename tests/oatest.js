const fs=require('fs');const {createCanvas}=require('@napi-rs/canvas');
function mk(){const c=createCanvas(1000,600);c.addEventListener=()=>{};c.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:600});c.style={};Object.defineProperty(c,'clientWidth',{get:()=>1000});Object.defineProperty(c,'clientHeight',{get:()=>420});c.parentElement={clientWidth:1000,clientHeight:420};return c;}
const cv={};function el(id){if(id&&/canvas|sch/.test(id)){if(!cv[id])cv[id]=mk();return cv[id];}const e={style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},addEventListener(){},appendChild(){},removeChild(){},querySelectorAll:()=>[],focus(){},remove(){},clientWidth:1000,clientHeight:420,value:'',textContent:'',getBoundingClientRect:()=>({left:0,top:0,width:1000,height:420}),getContext:()=>mk().getContext('2d')};e.lastChild={remove(){}};e.parentElement={clientWidth:1000,clientHeight:420};Object.defineProperty(e,'innerHTML',{get(){return'';},set(){}});return e;}
global.document={getElementById:el,createElement:()=>el(''),querySelectorAll:()=>[],addEventListener(){},body:el('')};
global.window={addEventListener(){},location:{href:''}};global.localStorage={getItem:()=>null,setItem(){}};global.fetch=async()=>({json:async()=>({})});global.alert=()=>{};
let js=fs.readFileSync('app_extract.js','utf8');js+='\n;global.__S=S;global.__try=tryConstructIntent;';
(0,eval)(js);const S=global.__S;let pass=0,fail=0;const chk=(c,m,d)=>{console.log((c?'PASS':'FAIL')+'  '+m+(d?' — '+d:''));c?pass++:fail++;};
const {cabs}=global; // not exported; compute inline
function mag(z){return Math.hypot(z.re,z.im);}
chk(global.__try('design a sallen-key 1kHz butterworth low-pass filter'),'copilot handled Sallen-Key request');
chk(S.comps.some(c=>c.type==='OPAMP'),'op-amp placed',S.comps.map(c=>c.type).join(','));
const out=S.ac&&S.ac.out['OUT'];
if(out){const f=S.ac.freqs;const at=hz=>{let bi=0,bd=1e9;f.forEach((ff,i)=>{const d=Math.abs(ff-hz);if(d<bd){bd=d;bi=i;}});return 20*Math.log10(mag(out[bi]));};
  console.log('   Bode: 10Hz='+at(10).toFixed(2)+'dB  1kHz='+at(1000).toFixed(2)+'dB  10kHz='+at(10000).toFixed(2)+'dB');
  chk(Math.abs(at(10))<0.5,'passband ~0dB');
  chk(Math.abs(at(1000)+3)<1,'−3dB at 1kHz (Butterworth cutoff)');
  chk(at(10000)<-30,'−40dB/dec 2nd-order rolloff');
}else chk(false,'AC produced OUT node');
console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);

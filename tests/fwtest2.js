const fs=require('fs');
const blink=`void setup(){ pinMode(13,OUTPUT); Serial.begin(9600); }
void loop(){ digitalWrite(13,HIGH); Serial.println("LED on"); delay(500); digitalWrite(13,LOW); Serial.println("LED off"); delay(500); }`;
const store={};
function el(id){if(!store[id])store[id]={value:id==='fw-code'?blink:'',textContent:'',innerHTML:'',classList:{add(){},remove(){},toggle(){}},scrollTop:0,scrollHeight:0,addEventListener(){},getContext:()=>new Proxy({},{get:()=>()=>{},set:()=>true}),parentElement:{clientWidth:800,clientHeight:400},clientWidth:800,clientHeight:400,getBoundingClientRect:()=>({left:0,top:0,width:800,height:400}),style:{},appendChild(){},querySelectorAll:()=>[],focus(){},remove(){},lastChild:{remove(){}}};return store[id];}
function newEl(){return {value:'',textContent:'',innerHTML:'',className:'',draggable:false,dataset:{},classList:{add(){},remove(){},toggle(){}},style:{},addEventListener(){},appendChild(){},querySelectorAll:()=>[]};}
global.document={getElementById:el,createElement:()=>newEl(),querySelectorAll:()=>[],addEventListener(){},body:el('body')};
global.window={addEventListener(){},location:{href:''}};global.localStorage={getItem:()=>null,setItem(){}};global.fetch=async()=>({json:async()=>({})});global.alert=()=>{};
let js=fs.readFileSync('app_extract.js','utf8');js+='\n;global.__FW=FW;global.__start=fwStart;global.__stop=fwStop;global.__trans=fwTranspile;';
(0,eval)(js);
let pass=0,fail=0;const chk=(c,m,d)=>{console.log((c?'PASS':'FAIL')+'  '+m+(d?' — '+d:''));c?pass++:fail++;};
// 1) transpile produces valid JS
try{const out=global.__trans(blink);new Function('return (async()=>{'+out+'})');chk(true,'blink sketch transpiles to valid JS');}catch(e){chk(false,'transpile: '+e.message);}
// 2) run it fast, watch pin 13 toggle + serial
global.__FW.speed=2000; // delay(500)->0.25ms real
let toggles=0,last=null;
const iv=setInterval(()=>{const v=global.__FW.pins[13];if(v!==last&&last!==null)toggles++;last=v;},1);
global.__start();
setTimeout(()=>{
  clearInterval(iv);global.__stop();
  const ser=document.getElementById("fw-serial").textContent;console.log("DEBUG serial:",JSON.stringify(ser));console.log("DEBUG pins:",JSON.stringify(global.__FW.pins),"running:",global.__FW.running,"virtT:",global.__FW.virtT);
  chk(toggles>=2,'pin 13 toggled while firmware ran',toggles+' edges');
  chk(/LED on/.test(ser)&&/LED off/.test(ser),'Serial.println output captured');
  console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);
},400);

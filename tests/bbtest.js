const fs=require('fs');
const ctx=new Proxy({},{get:(t,k)=>k==='measureText'?()=>({width:10}):()=>{},set:()=>true});
function el(){const e={style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},addEventListener(){},appendChild(){},removeChild(){},getContext:()=>ctx,getBoundingClientRect:()=>({left:0,top:0,width:800,height:600}),querySelectorAll:()=>[],focus(){},remove(){},clientWidth:800,clientHeight:240,value:'',textContent:''};e.lastChild={remove(){}};e.parentElement={clientWidth:800,clientHeight:240};Object.defineProperty(e,'innerHTML',{get(){return'';},set(){}});return e;}
global.document={getElementById:()=>el(),createElement:()=>el(),querySelectorAll:()=>[],addEventListener(){},body:el()};
global.window={addEventListener(){},location:{href:''}};global.localStorage={getItem:()=>null,setItem(){}};global.fetch=async()=>({json:async()=>({})});global.alert=()=>{};
let js=fs.readFileSync('app_extract.js','utf8');
js+='\n;global.__S=S;global.__loadDemo=loadDemo;global.__buildBB=buildBB;global.__bbNodeMap=bbNodeMap;global.__BB=BB;global.__try=tryConstructIntent;';
(0,eval)(js);
let pass=0,fail=0;const chk=(c,m,d)=>{console.log((c?'PASS':'FAIL')+'  '+m+(d?' — '+d:''));c?pass++:fail++;};
function partitionsMatch(){
  const BB=global.__BB;const {node}=global.__bbNodeMap();
  const pins=[];BB.place.forEach(pl=>pl.pins.forEach(p=>pins.push({key:pl.ref+':'+p.net,sch:p.net,bb:node(p.hole)})));
  let ok=true;
  for(let i=0;i<pins.length;i++)for(let j=i+1;j<pins.length;j++){
    const sameSch=pins[i].sch===pins[j].sch, sameBB=pins[i].bb===pins[j].bb;
    if(sameSch!==sameBB){ok=false;}
  }
  return {ok,count:pins.length};
}
// LED demo
global.__loadDemo('led');global.__buildBB();
let r=partitionsMatch();
chk(r.ok,'Breadboard ≡ schematic netlist (LED demo)', r.count+' pins checked, '+global.__BB.place.length+' parts, '+global.__BB.jumpers.length+' rail jumpers');
// full-wave bridge (net labels + rails)
global.__try('make a full-wave rectifier');global.__buildBB();
r=partitionsMatch();
chk(r.ok,'Breadboard ≡ schematic netlist (full-wave bridge)', r.count+' pins checked, '+global.__BB.place.length+' parts');
chk(global.__BB.jumpers.some(j=>j.rail==='-'),'GND net bound to the − rail', global.__BB.jumpers.map(j=>j.rail+j.net).join(','));
console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);

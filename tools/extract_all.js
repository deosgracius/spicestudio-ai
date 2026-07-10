// Extract ALL usable cards from the LTspice standard libraries into compact JS,
// with sanity filters for what a Level-1/Gummel-Poon engine can honestly run.
const fs=require('fs'),path=require('path');
const DIR=__dirname;
const su={f:1e-15,p:1e-12,n:1e-9,u:1e-6,'µ':1e-6,m:1e-3,k:1e3,meg:1e6,g:1e9,t:1e12};
const pv=s=>{if(s==null)return undefined;s=String(s).trim();const m=s.match(/^([-+]?[\d.]+(?:e[-+]?\d+)?)(meg|[fpnuµmkgt])?/i);
  if(!m)return undefined;let v=parseFloat(m[1]);const sfx=(m[2]||'').toLowerCase();if(sfx&&su[sfx]!==undefined)v*=su[sfx];return v;};
function loadCards(file){
  const raw=fs.readFileSync(path.join(DIR,file),'latin1').split(/\r?\n/);
  const lines=[];raw.forEach(l=>{if(/^\s*\+/.test(l)&&lines.length)lines[lines.length-1]+=' '+l.replace(/^\s*\+/,'');else lines.push(l);});
  const cards={};
  lines.forEach(l=>{const m=l.match(/^\s*\.model\s+(\S+)\s+(\w+)\s*\(?([^)]*)/i);if(!m)return;
    const params={};(m[3]||'').split(/[\s,]+/).forEach(kv=>{const p=kv.split('=');if(p[0]&&p[1]!==undefined)params[p[0].toLowerCase()]=p[1];});
    if(/\bpchan\b/i.test(m[3]||''))params.pchan='1';
    cards[m[1]]={type:m[2].toUpperCase(),params};});
  return cards;
}
const fmt=v=>{if(v===undefined||v===null||!isFinite(v))return null;if(v===0)return'0';
  const a=Math.abs(v);if(a>=0.01&&a<1e5)return String(+v.toPrecision(4));
  return(+v.toPrecision(4)).toExponential().replace(/e([+-])(\d)$/,'e$1$2');};
const clean=n=>/^[\w.+-]+$/.test(n)&&n.length<=16;   // sane part-number names only

// BJTs: NPN/PNP Gummel-Poon cards with at least Is+BF
const bjt=loadCards('standard.bjt');let outB={},nB=0,skB=0;
for(const[n,c]of Object.entries(bjt)){if(!clean(n)||(c.type!=='NPN'&&c.type!=='PNP')){skB++;continue;}
  const g=k=>pv(c.params[k]);const Is=g('is'),BF=g('bf');
  if(!Is||!BF||BF<1||BF>20000){skB++;continue;}
  const e={t:c.type==='PNP'?1:0,Is:fmt(Is),BF:fmt(BF)};
  const br=g('br'),vaf=g('vaf'),tf=g('tf'),cje=g('cje'),cjc=g('cjc');
  if(br)e.BR=fmt(br);if(vaf)e.VAF=fmt(vaf);if(tf)e.TF=fmt(tf);if(cje)e.CJE=fmt(cje);if(cjc)e.CJC=fmt(cjc);
  outB[n]=e;nB++;}
// Diodes: D cards with Is; skip pure zeners is impossible to detect reliably - keep, engine runs them forward-only
const dio=loadCards('standard.dio');let outD={},nD=0,skD=0;
for(const[n,c]of Object.entries(dio)){if(!clean(n)||c.type!=='D'){skD++;continue;}
  const g=k=>pv(c.params[k]);const Is=g('is');if(!Is||Is<=0){skD++;continue;}
  const e={Is:fmt(Is),N:fmt(g('n')??1)};
  const cjo=g('cjo'),tt=g('tt');if(cjo)e.CJO=fmt(cjo);if(tt)e.TT=fmt(tt);
  outD[n]=e;nD++;}
// MOSFETs: VDMOS/NMOS/PMOS with Vto+Kp; Kp clamped (Level-1 has no Rs/Rd)
const mos=loadCards('standard.mos');let outM={},nM=0,skM=0;
for(const[n,c]of Object.entries(mos)){if(!clean(n)||!/^(VDMOS|NMOS|PMOS)$/.test(c.type)){skM++;continue;}
  const g=k=>pv(c.params[k]);const Vto=g('vto'),Kp=g('kp');
  if(Vto===undefined||!Kp||Kp<=0){skM++;continue;}
  const pch=c.type==='PMOS'||c.params.pchan!==undefined||Vto<0;
  const e={t:pch?1:0,Vto:fmt(pch?-Math.abs(Vto):Math.abs(Vto)),Kp:fmt(Math.min(Kp,60))};
  const cgs=g('cgs'),cgd=g('cgdmax')??g('cgdo');if(cgs)e.CGS=fmt(cgs);if(cgd)e.CGD=fmt(cgd);
  outM[n]=e;nM++;}

const emit=(o)=>'{'+Object.entries(o).map(([n,e])=>`'${n}':{${Object.entries(e).map(([k,v])=>k+':'+v).join(',')}}`).join(',\n')+'}';
const js=`// FULL LTspice standard-library import (github.com/HenniePeters/LTSpice), generated - do not hand-edit
const LIB_BJT=${emit(outB)};
const LIB_DIO=${emit(outD)};
const LIB_MOS=${emit(outM)};
`;
fs.writeFileSync(path.join(DIR,'lib_full.js'),js);
console.log(`BJT: ${nB} kept / ${skB} skipped · DIO: ${nD} kept / ${skD} skipped · MOS: ${nM} kept / ${skM} skipped`);
console.log('generated lib_full.js:',(fs.statSync(path.join(DIR,'lib_full.js')).size/1024).toFixed(0)+' KB');

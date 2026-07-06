// ============================================================================
// SpiceStudio MNA Engine — standalone, testable core
// Modified Nodal Analysis: DC op-point, transient (Backward Euler / trapezoidal),
// AC (complex MNA). Newton-Raphson for nonlinear devices (diode, MOSFET L1).
// ============================================================================

// ---- dense real linear solve: Gaussian elimination w/ partial pivot ----
function solveLinear(A, b) {
  const n = b.length;
  // augmented copy
  const M = A.map((row, i) => row.slice());
  const x = b.slice();
  for (let col = 0; col < n; col++) {
    // pivot
    let piv = col, best = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(M[r][col]);
      if (v > best) { best = v; piv = r; }
    }
    if (best < 1e-18) continue; // singular-ish; leave 0
    if (piv !== col) { [M[col], M[piv]] = [M[piv], M[col]]; [x[col], x[piv]] = [x[piv], x[col]]; }
    const d = M[col][col];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / d;
      if (f === 0) continue;
      for (let c = col; c < n; c++) M[r][c] -= f * M[col][c];
      x[r] -= f * x[col];
    }
  }
  for (let i = 0; i < n; i++) { const d = M[i][i]; x[i] = Math.abs(d) < 1e-18 ? 0 : x[i] / d; }
  return x;
}

// ---- complex linear solve (for AC) ----
// complex numbers as {re, im}
const cadd = (a, b) => ({ re: a.re + b.re, im: a.im + b.im });
const csub = (a, b) => ({ re: a.re - b.re, im: a.im - b.im });
const cmul = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const cdiv = (a, b) => { const d = b.re * b.re + b.im * b.im; return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d }; };
const cabs = (a) => Math.hypot(a.re, a.im);

function solveComplex(A, b) {
  const n = b.length;
  const M = A.map(row => row.map(c => ({ re: c.re, im: c.im })));
  const x = b.map(c => ({ re: c.re, im: c.im }));
  for (let col = 0; col < n; col++) {
    let piv = col, best = cabs(M[col][col]);
    for (let r = col + 1; r < n; r++) { const v = cabs(M[r][col]); if (v > best) { best = v; piv = r; } }
    if (best < 1e-18) continue;
    if (piv !== col) { [M[col], M[piv]] = [M[piv], M[col]]; [x[col], x[piv]] = [x[piv], x[col]]; }
    const d = M[col][col];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = cdiv(M[r][col], d);
      if (f.re === 0 && f.im === 0) continue;
      for (let c = col; c < n; c++) M[r][c] = csub(M[r][c], cmul(f, M[col][c]));
      x[r] = csub(x[r], cmul(f, x[col]));
    }
  }
  for (let i = 0; i < n; i++) x[i] = cdiv(x[i], M[i][i]);
  return x;
}

const VT = 0.025852; // thermal voltage @ ~300K

// MOSFET Level-1 (Shichman-Hodges). Returns {id (D->S, signed), gm, gds}. Handles nmos & pmos.
function mosfet(type, vgs, vds, p) {
  const Kp = p.Kp ?? 2e-5, WL = (p.W ?? 1e-5) / (p.L ?? 1e-6), lam = p.lambda ?? 0, beta = Kp * WL;
  const pmos = (type === 'pmos');
  const s = pmos ? -1 : 1;
  const vg = s * vgs, vd = s * vds;                 // fold pmos onto nmos equations
  const vto = pmos ? -(p.Vto ?? -0.7) : (p.Vto ?? 0.7);
  const vov = vg - vto;
  let id, gm, gds;
  if (vov <= 0) { id = 0; gm = 0; gds = 0; }                       // cutoff
  else if (vd < vov) {                                            // triode
    id = beta * (vov * vd - 0.5 * vd * vd) * (1 + lam * vd);
    gm = beta * vd * (1 + lam * vd);
    gds = beta * ((vov - vd) * (1 + lam * vd) + (vov * vd - 0.5 * vd * vd) * lam);
  } else {                                                        // saturation
    id = 0.5 * beta * vov * vov * (1 + lam * vd);
    gm = beta * vov * (1 + lam * vd);
    gds = 0.5 * beta * vov * vov * lam;
  }
  return { id: s * id, gm, gds: gds + 1e-12 };       // gmin on gds for conditioning
}

// BJT Ebers-Moll (transport form). Takes EFFECTIVE (npn-domain, pre-limited) junction voltages.
function bjt(vbeEff, vbcEff, p) {
  const Is = p.Is ?? 1e-15, BF = p.BF ?? 100, BR = p.BR ?? 1, Vt = VT;
  const f1 = Math.exp(vbeEff / Vt), f2 = Math.exp(vbcEff / Vt);
  const ic = Is * ((f1 - f2) - (f2 - 1) / BR);
  const ib = Is * ((f1 - 1) / BF + (f2 - 1) / BR);
  return { ic, ib, gcf: Is * f1 / Vt, gcr: -(Is * f2 / Vt) * (1 + 1 / BR), gpi: Is * f1 / (BF * Vt) + 1e-12, gmu: Is * f2 / (BR * Vt) + 1e-12 };
}

// SPICE junction-voltage limiting — keeps Newton stable AND lets high-Vf parts (LEDs) turn on
function pnjlim(vnew, vold, vt, vcrit) {
  if (vnew > vcrit && Math.abs(vnew - vold) > 2 * vt) {
    if (vold > 0) {
      const arg = 1 + (vnew - vold) / vt;
      vnew = arg > 0 ? vold + vt * Math.log(arg) : vcrit;
    } else {
      vnew = vnew > 0 ? vt * Math.log(vnew / vt) : vnew;
    }
  }
  return vnew;
}

// ============================================================================
// Circuit: nodes are strings; '0' or 'GND' is ground.
// elements: {type, nodes:[...], value, model}
//   R, C, L, V, I, D  (+ M mosfet later)
// ============================================================================
class Circuit {
  constructor() { this.elements = []; this.models = {}; }
  add(el) { this.elements.push(el); return el; }

  _nodeMap() {
    const map = new Map(); map.set('0', 0); map.set('GND', 0); map.set('gnd', 0);
    let idx = 1;
    for (const e of this.elements) for (const nd of e.nodes) {
      if (!map.has(nd)) map.set(nd, idx++);
    }
    return { map, n: idx - 1 };
  }

  // branch unknowns: V sources and L (need current). returns list of elements needing branch
  _branchList() { return this.elements.filter(e => e.type === 'V' || e.type === 'L' || e.type === 'E'); }

  // Build & solve one operating point (optionally transient companion) with Newton for nonlinear.
  // opts: {dt, prev} where prev = previous node-voltage map + branch currents for companion models
  _solveOP(nodeInfo, branches, opts = {}) {
    const { map, n } = nodeInfo;
    const m = branches.length;
    const size = n + m;
    const branchIdx = new Map(); branches.forEach((e, i) => branchIdx.set(e, n + i));
    const dt = opts.dt || 0;               // 0 => DC
    const prevV = opts.prevV || {};        // node name -> voltage
    const prevI = opts.prevI || new Map(); // element -> branch current (L)
    const capState = opts.capState || new Map(); // element -> prev Vcap

    // Newton iteration on nonlinear devices
    let x = new Array(size).fill(0);
    let guessV = {};
    for (const [name, i] of map) guessV[name] = (i === 0) ? 0 : (prevV[name] || 0);
    const vdState = new Map(); // per-diode limited voltage across Newton iterations
    const bjtState = new Map(); // per-BJT limited junction voltages
    const nl = this.elements.some(e => e.type === 'D' || e.type === 'M' || e.type === 'Q'); // needs damped Newton

    const NI = (i) => i === 0 ? -1 : i - 1; // ground -> -1 (skip), else 0-based row

    let converged = false;
    for (let iter = 0; iter < 100; iter++) {
      let limitedThisIter = false;
      const A = Array.from({ length: size }, () => new Array(size).fill(0));
      const z = new Array(size).fill(0);
      const stampG = (a, b, g) => {
        const ia = NI(a), ib = NI(b);
        if (ia >= 0) A[ia][ia] += g;
        if (ib >= 0) A[ib][ib] += g;
        if (ia >= 0 && ib >= 0) { A[ia][ib] -= g; A[ib][ia] -= g; }
      };
      const stampI = (a, b, cur) => { // current cur flows a->b (source injects into a? convention: leaves a)
        const ia = NI(a), ib = NI(b);
        if (ia >= 0) z[ia] -= cur;
        if (ib >= 0) z[ib] += cur;
      };
      for (const e of this.elements) {
        const a = map.get(e.nodes[0]), b = map.get(e.nodes[1]);
        if (e.type === 'R') { stampG(a, b, 1 / e.value); }
        else if (e.type === 'I') { stampI(a, b, e.value); }
        else if (e.type === 'C') {
          if (dt > 0) {
            const Geq = e.value / dt;
            const vPrev = capState.get(e) ?? 0;
            const Ieq = Geq * vPrev;
            stampG(a, b, Geq);
            // companion current source Ieq from b->a (injects into a)
            const ia = NI(a), ib = NI(b);
            if (ia >= 0) z[ia] += Ieq;
            if (ib >= 0) z[ib] -= Ieq;
          } // DC: open, no stamp
        }
        else if (e.type === 'D') {
          const va = a === 0 ? 0 : guessV[e.nodes[0]];
          const vb = b === 0 ? 0 : guessV[e.nodes[1]];
          const Is = (e.model?.Is) ?? 1e-14;
          const nEm = (e.model?.N) ?? 1;
          const nVt = nEm * VT;
          const vcrit = nVt * Math.log(nVt / (Math.SQRT2 * Is));
          const vold = vdState.has(e) ? vdState.get(e) : 0;
          let vd = pnjlim(va - vb, vold, nVt, vcrit);
          if (Math.abs(vd - (va - vb)) > 1e-9) limitedThisIter = true;
          vdState.set(e, vd);
          const ex = Math.exp(vd / nVt);
          const id = Is * (ex - 1);
          const Geq = (Is / nVt) * ex;
          const Ieq = id - Geq * vd;
          stampG(a, b, Geq);
          const ia = NI(a), ib = NI(b);
          if (ia >= 0) z[ia] -= Ieq;
          if (ib >= 0) z[ib] += Ieq;
        }
        else if (e.type === 'V') {
          const k = branchIdx.get(e);
          const ia = NI(a), ib = NI(b);
          if (ia >= 0) { A[ia][k] += 1; A[k][ia] += 1; }
          if (ib >= 0) { A[ib][k] -= 1; A[k][ib] -= 1; }
          z[k] += (typeof e.value === 'function') ? e.value(opts.t || 0) : e.value;
        }
        else if (e.type === 'L') {
          const k = branchIdx.get(e);
          const ia = NI(a), ib = NI(b);
          if (ia >= 0) { A[ia][k] += 1; A[k][ia] += 1; }
          if (ib >= 0) { A[ib][k] -= 1; A[k][ib] -= 1; }
          if (dt > 0) {
            const Req = e.value / dt;
            A[k][k] -= Req;
            z[k] += -Req * (prevI.get(e) ?? 0);
          } // DC: short (0V), A[k][k]=0
        }
        else if (e.type === 'M') {                     // MOSFET: nodes = [D, G, S]
          const D = NI(map.get(e.nodes[0])), G = NI(map.get(e.nodes[1])), Sn = NI(map.get(e.nodes[2]));
          const vd = e.nodes[0] === '0' ? 0 : (guessV[e.nodes[0]] || 0);
          const vg = e.nodes[1] === '0' ? 0 : (guessV[e.nodes[1]] || 0);
          const vs = e.nodes[2] === '0' ? 0 : (guessV[e.nodes[2]] || 0);
          const vgs = vg - vs, vds = vd - vs;
          const { id, gm, gds } = mosfet(e.model?.type || 'nmos', vgs, vds, e.model || {});
          // gds between D and S
          if (D >= 0) A[D][D] += gds; if (Sn >= 0) A[Sn][Sn] += gds;
          if (D >= 0 && Sn >= 0) { A[D][Sn] -= gds; A[Sn][D] -= gds; }
          // gm VCCS: current D->S = gm*(vg - vs)
          if (D >= 0) { if (G >= 0) A[D][G] += gm; if (Sn >= 0) A[D][Sn] -= gm; }
          if (Sn >= 0) { if (G >= 0) A[Sn][G] -= gm; A[Sn][Sn] += gm; }
          const Ieq = id - gm * vgs - gds * vds;       // current D->S
          if (D >= 0) z[D] -= Ieq; if (Sn >= 0) z[Sn] += Ieq;
        }
        else if (e.type === 'Q') {                     // BJT: nodes = [C, B, E]
          const C = NI(map.get(e.nodes[0])), B = NI(map.get(e.nodes[1])), E = NI(map.get(e.nodes[2]));
          const vc = e.nodes[0] === '0' ? 0 : (guessV[e.nodes[0]] || 0);
          const vb = e.nodes[1] === '0' ? 0 : (guessV[e.nodes[1]] || 0);
          const ve = e.nodes[2] === '0' ? 0 : (guessV[e.nodes[2]] || 0);
          const md = e.model || {}, s = (md.type === 'pnp') ? -1 : 1, Is = md.Is ?? 1e-15;
          const vcrit = VT * Math.log(VT / (Math.SQRT2 * Is));
          const st = bjtState.get(e) || { be: 0, bc: 0 };
          const beEff = pnjlim(s * (vb - ve), st.be, VT, vcrit), bcEff = pnjlim(s * (vb - vc), st.bc, VT, vcrit);
          if (Math.abs(beEff - s * (vb - ve)) > 1e-9 || Math.abs(bcEff - s * (vb - vc)) > 1e-9) limitedThisIter = true;
          bjtState.set(e, { be: beEff, bc: bcEff });
          const { ic, ib, gcf, gcr, gpi, gmu } = bjt(beEff, bcEff, md);
          const icR = s * ic, ibR = s * ib, vbeL = s * beEff, vbcL = s * bcEff;
          const add = (r, c, g) => { if (r >= 0 && c >= 0) A[r][c] += g; };
          add(B, B, gpi + gmu); add(B, E, -gpi); add(B, C, -gmu);
          add(C, B, gcf + gcr); add(C, E, -gcf); add(C, C, -gcr);
          add(E, B, -(gpi + gmu + gcf + gcr)); add(E, E, gpi + gcf); add(E, C, gmu + gcr);
          const IeqB = ibR - gpi * vbeL - gmu * vbcL;
          const IeqC = icR - gcf * vbeL - gcr * vbcL;
          if (B >= 0) z[B] -= IeqB; if (C >= 0) z[C] -= IeqC; if (E >= 0) z[E] += (IeqB + IeqC);
        }
        else if (e.type === 'E') {          // VCVS: V(op)-V(on) = gain*(V(cp)-V(cn))  [op-amp core]
          const k = branchIdx.get(e), g = e.value;
          const op1 = NI(map.get(e.nodes[0])), on = NI(map.get(e.nodes[1])), cp = NI(map.get(e.nodes[2])), cn = NI(map.get(e.nodes[3]));
          if (op1 >= 0) { A[op1][k] += 1; A[k][op1] += 1; }
          if (on >= 0) { A[on][k] -= 1; A[k][on] -= 1; }
          if (cp >= 0) A[k][cp] -= g;
          if (cn >= 0) A[k][cn] += g;
        }
      }
      x = solveLinear(A, z);
      // update guess
      const newV = {};
      for (const [name, i] of map) {
        let v = i === 0 ? 0 : x[i - 1];
        if (nl) { const old = guessV[name] || 0, dv = v - old, MX = 2; if (dv > MX) v = old + MX; else if (dv < -MX) v = old - MX; } // damped Newton
        newV[name] = v;
      }
      // convergence
      let maxd = 0;
      for (const name in newV) maxd = Math.max(maxd, Math.abs(newV[name] - (guessV[name] || 0)));
      guessV = newV;
      if (!nl) { converged = true; break; }
      if (maxd < 1e-7 && !limitedThisIter) { converged = true; break; }
    }
    // extract (use the last accepted iterate so a non-converged solve never returns raw overshoot)
    const V = {};
    for (const [name, i] of map) V[name] = guessV[name] || 0;
    const I = new Map();
    for (const e of branches) I.set(e, x[branchIdx.get(e)]);
    return { V, I, converged };
  }

  dcOP() {
    const ni = this._nodeMap();
    const br = this._branchList();
    return this._solveOP(ni, br, { dt: 0 });
  }

  transient(tStop, dt, opts = {}) {
    const uic = opts.uic || false; // use initial conditions (start caps/L from ic, not DC op)
    const ni = this._nodeMap();
    const br = this._branchList();
    const steps = Math.round(tStop / dt);
    const times = [];
    const nodeNames = [...ni.map.keys()].filter(nm => ni.map.get(nm) !== 0);
    const trace = {}; nodeNames.forEach(nm => trace[nm] = []);
    let capState = new Map(), prevI = new Map(), prevV = {};
    if (uic) {
      for (const e of this.elements) if (e.type === 'C') capState.set(e, e.ic ?? 0);
      for (const e of br) if (e.type === 'L') prevI.set(e, e.ic ?? 0);
      nodeNames.forEach(nm => prevV[nm] = 0);
    } else {
      // start from DC operating point (real SPICE default)
      const op0 = this._solveOP(ni, br, { dt: 0 });
      prevV = op0.V;
      for (const e of this.elements) if (e.type === 'C') capState.set(e, (op0.V[e.nodes[0]] || 0) - (op0.V[e.nodes[1]] || 0));
      for (const e of br) if (e.type === 'L') prevI.set(e, op0.I.get(e) || 0);
    }

    for (let s = 0; s <= steps; s++) {
      const t = s * dt;
      const r = this._solveOP(ni, br, { dt, t, prevV, capState, prevI });
      times.push(t);
      nodeNames.forEach(nm => trace[nm].push(r.V[nm]));
      // update companion state
      for (const e of this.elements) if (e.type === 'C') capState.set(e, (r.V[e.nodes[0]] || 0) - (r.V[e.nodes[1]] || 0));
      for (const e of br) if (e.type === 'L') prevI.set(e, r.I.get(e));
      prevV = r.V;
    }
    return { times, trace };
  }

  // AC small-signal: linear, admittance stamps, complex solve. sources use e.ac (magnitude).
  ac(fStart, fStop, points) {
    const ni = this._nodeMap(); const { map, n } = ni;
    const br = this._branchList();
    const branchIdx = new Map(); br.forEach((e, i) => branchIdx.set(e, n + i));
    const size = n + br.length;
    const NI = (i) => i === 0 ? -1 : i - 1;
    const freqs = [], out = {};
    const nodeNames = [...map.keys()].filter(nm => map.get(nm) !== 0);
    nodeNames.forEach(nm => out[nm] = []);
    // linearize nonlinear devices around the DC operating point (SPICE .op before .ac)
    const op = this._solveOP(ni, br, { dt: 0 }).V;
    const gV = nm => (nm === '0' || nm === 'GND') ? 0 : (op[nm] || 0);
    const lf0 = Math.log10(fStart), lf1 = Math.log10(fStop);
    for (let p = 0; p < points; p++) {
      const f = Math.pow(10, lf0 + (lf1 - lf0) * p / (points - 1));
      const w = 2 * Math.PI * f;
      const A = Array.from({ length: size }, () => new Array(size).fill(0).map(() => ({ re: 0, im: 0 })));
      const z = new Array(size).fill(0).map(() => ({ re: 0, im: 0 }));
      const sy = (a, b, y) => { // complex admittance
        const ia = NI(a), ib = NI(b);
        if (ia >= 0) A[ia][ia] = cadd(A[ia][ia], y);
        if (ib >= 0) A[ib][ib] = cadd(A[ib][ib], y);
        if (ia >= 0 && ib >= 0) { A[ia][ib] = csub(A[ia][ib], y); A[ib][ia] = csub(A[ib][ia], y); }
      };
      for (const e of this.elements) {
        const a = map.get(e.nodes[0]), b = map.get(e.nodes[1]);
        if (e.type === 'R') sy(a, b, { re: 1 / e.value, im: 0 });
        else if (e.type === 'C') sy(a, b, { re: 0, im: w * e.value });
        else if (e.type === 'L') sy(a, b, cdiv({ re: 1, im: 0 }, { re: 0, im: w * e.value }));
        else if (e.type === 'D') { // small-signal conductance at the operating point
          const Is = e.model?.Is ?? 1e-14, nVt = (e.model?.N ?? 1) * VT;
          const vd = gV(e.nodes[0]) - gV(e.nodes[1]);
          const Geq = (Is / nVt) * Math.exp(Math.min(vd, 0.9) / nVt) + 1e-12;
          sy(a, b, { re: Geq, im: 0 });
        }
        else if (e.type === 'M') { // small-signal gm/gds at the operating point
          const D = NI(map.get(e.nodes[0])), G = NI(map.get(e.nodes[1])), Sn = NI(map.get(e.nodes[2]));
          const vgs = gV(e.nodes[1]) - gV(e.nodes[2]), vds = gV(e.nodes[0]) - gV(e.nodes[2]);
          const { gm, gds } = mosfet(e.model?.type || 'nmos', vgs, vds, e.model || {});
          if (D >= 0) A[D][D] = cadd(A[D][D], { re: gds, im: 0 }); if (Sn >= 0) A[Sn][Sn] = cadd(A[Sn][Sn], { re: gds, im: 0 });
          if (D >= 0 && Sn >= 0) { A[D][Sn] = csub(A[D][Sn], { re: gds, im: 0 }); A[Sn][D] = csub(A[Sn][D], { re: gds, im: 0 }); }
          if (D >= 0) { if (G >= 0) A[D][G] = cadd(A[D][G], { re: gm, im: 0 }); if (Sn >= 0) A[D][Sn] = csub(A[D][Sn], { re: gm, im: 0 }); }
          if (Sn >= 0) { if (G >= 0) A[Sn][G] = csub(A[Sn][G], { re: gm, im: 0 }); A[Sn][Sn] = cadd(A[Sn][Sn], { re: gm, im: 0 }); }
        }
        else if (e.type === 'Q') { // BJT small-signal at the operating point
          const C = NI(map.get(e.nodes[0])), B = NI(map.get(e.nodes[1])), E = NI(map.get(e.nodes[2]));
          const sQ = (e.model?.type === 'pnp') ? -1 : 1;
          const { gcf, gcr, gpi, gmu } = bjt(sQ * (gV(e.nodes[1]) - gV(e.nodes[2])), sQ * (gV(e.nodes[1]) - gV(e.nodes[0])), e.model || {});
          const ad = (r, c, g) => { if (r >= 0 && c >= 0) A[r][c] = cadd(A[r][c], { re: g, im: 0 }); };
          ad(B, B, gpi + gmu); ad(B, E, -gpi); ad(B, C, -gmu);
          ad(C, B, gcf + gcr); ad(C, E, -gcf); ad(C, C, -gcr);
          ad(E, B, -(gpi + gmu + gcf + gcr)); ad(E, E, gpi + gcf); ad(E, C, gmu + gcr);
        }
        else if (e.type === 'V') {
          const k = branchIdx.get(e); const ia = NI(a), ib = NI(b);
          if (ia >= 0) { A[ia][k] = cadd(A[ia][k], { re: 1, im: 0 }); A[k][ia] = cadd(A[k][ia], { re: 1, im: 0 }); }
          if (ib >= 0) { A[ib][k] = csub(A[ib][k], { re: 1, im: 0 }); A[k][ib] = csub(A[k][ib], { re: 1, im: 0 }); }
          z[k] = { re: (e.ac ?? 0), im: 0 };
        }
        else if (e.type === 'E') {
          const k = branchIdx.get(e), g = e.value;
          const op1 = NI(map.get(e.nodes[0])), on = NI(map.get(e.nodes[1])), cp = NI(map.get(e.nodes[2])), cn = NI(map.get(e.nodes[3]));
          if (op1 >= 0) { A[op1][k] = cadd(A[op1][k], { re: 1, im: 0 }); A[k][op1] = cadd(A[k][op1], { re: 1, im: 0 }); }
          if (on >= 0) { A[on][k] = csub(A[on][k], { re: 1, im: 0 }); A[k][on] = csub(A[k][on], { re: 1, im: 0 }); }
          if (cp >= 0) A[k][cp] = csub(A[k][cp], { re: g, im: 0 });
          if (cn >= 0) A[k][cn] = cadd(A[k][cn], { re: g, im: 0 });
        }
      }
      const x = solveComplex(A, z);
      freqs.push(f);
      nodeNames.forEach(nm => { const i = map.get(nm); out[nm].push(x[i - 1]); });
    }
    return { freqs, out };
  }
}

module.exports = { Circuit, solveLinear, solveComplex, cabs };

// ============================================================================
// SELF TESTS
// ============================================================================
if (require.main === module) {
  let pass = 0, fail = 0;
  const near = (a, b, tol, msg) => {
    const ok = Math.abs(a - b) <= tol;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}: got ${a.toPrecision(5)}, want ${b} (±${tol})`);
    ok ? pass++ : fail++;
  };

  // Test 1: resistive divider 10V, 1k/1k -> 5V
  {
    const c = new Circuit();
    c.add({ type: 'V', nodes: ['in', '0'], value: 10 });
    c.add({ type: 'R', nodes: ['in', 'mid'], value: 1000 });
    c.add({ type: 'R', nodes: ['mid', '0'], value: 1000 });
    const op = c.dcOP();
    near(op.V.mid, 5.0, 1e-6, 'Divider mid node');
  }

  // Test 2: RC step, tau=1ms, at t=1ms => 5*(1-e^-1)=3.1606
  {
    const c = new Circuit();
    c.add({ type: 'V', nodes: ['in', '0'], value: 5 });
    c.add({ type: 'R', nodes: ['in', 'out'], value: 1000 });
    c.add({ type: 'C', nodes: ['out', '0'], value: 1e-6 });
    const r = c.transient(5e-3, 1e-6, { uic: true });
    const idx = r.times.findIndex(t => t >= 1e-3 - 1e-9);
    near(r.trace.out[idx], 5 * (1 - Math.exp(-1)), 0.02, 'RC v(out) @ 1 tau');
    near(r.trace.out[r.trace.out.length - 1], 5 * (1 - Math.exp(-5)), 0.02, 'RC v(out) @ 5 tau');
  }

  // Test M1: NMOS common-source DC. Vg=2, Vto=0.7, Kp=100u, W/L=10 => Id=0.5*1e-3*1.3^2=0.845mA, Vd=5-Id*2k=3.31
  {
    const c = new Circuit();
    c.add({ type: 'V', nodes: ['vdd', '0'], value: 5 });
    c.add({ type: 'V', nodes: ['g', '0'], value: 2 });
    c.add({ type: 'R', nodes: ['vdd', 'd'], value: 2000 });
    c.add({ type: 'M', nodes: ['d', 'g', '0'], model: { type: 'nmos', Vto: 0.7, Kp: 100e-6, W: 10e-6, L: 1e-6 } });
    const op = c.dcOP();
    const id = (5 - op.V.d) / 2000;
    console.log(`      NMOS: Vd=${op.V.d.toPrecision(4)}V, Id=${(id*1e3).toPrecision(3)}mA`);
    near(op.V.d, 3.31, 0.15, 'M1 NMOS common-source Vd');
    near(id * 1e3, 0.845, 0.08, 'M1 NMOS drain current');
  }

  // Test M2: NMOS common-source AC gain ≈ -gm*Rd, gm=Kp*(W/L)*Vov=1e-3*1.3=1.3mS, gain=-1.3m*2k=-2.6
  {
    const c = new Circuit();
    c.add({ type: 'V', nodes: ['vdd', '0'], value: 5 });
    c.add({ type: 'V', nodes: ['g', '0'], value: 2, ac: 1 });
    c.add({ type: 'R', nodes: ['vdd', 'd'], value: 2000 });
    c.add({ type: 'M', nodes: ['d', 'g', '0'], model: { type: 'nmos', Vto: 0.7, Kp: 100e-6, W: 10e-6, L: 1e-6 } });
    const r = c.ac(1, 1e3, 5);
    const gain = cabs(r.out.d[0]);
    console.log(`      NMOS AC |gain|=${gain.toPrecision(3)} (expect ~2.6)`);
    near(gain, 2.6, 0.4, 'M2 NMOS common-source AC gain');
  }

  // Test Q1: NPN common-emitter DC. Rb=430k bias, Rc=2k. Ib=(10-0.7)/430k=21.6uA, Ic=BF*Ib=2.16mA, Vc=10-Ic*2k≈5.7
  {
    const c = new Circuit();
    c.add({ type: 'V', nodes: ['vcc', '0'], value: 10 });
    c.add({ type: 'R', nodes: ['vcc', 'b'], value: 430e3 });
    c.add({ type: 'R', nodes: ['vcc', 'col'], value: 2000 });
    c.add({ type: 'Q', nodes: ['col', 'b', '0'], model: { type: 'npn', Is: 1e-15, BF: 100 } });
    const op = c.dcOP();
    const ic = (10 - op.V.col) / 2000;
    console.log(`      NPN: Vc=${op.V.col.toPrecision(3)}V, Vbe=${op.V.b.toPrecision(3)}V, Ic=${(ic*1e3).toPrecision(3)}mA`);
    near(op.V.b, 0.68, 0.06, 'Q1 NPN Vbe');
    near(ic * 1e3, 2.16, 0.5, 'Q1 NPN collector current');
  }

  // Test Q2: NPN common-emitter AC gain ≈ -gm*Rc, gm=Ic/Vt=2.16m/0.02585≈83.5mS, gain=-83.5m*2k≈-167
  {
    const c = new Circuit();
    c.add({ type: 'V', nodes: ['vcc', '0'], value: 10 });
    c.add({ type: 'R', nodes: ['vcc', 'b'], value: 430e3 });
    c.add({ type: 'R', nodes: ['vcc', 'col'], value: 2000 });
    c.add({ type: 'Q', nodes: ['col', 'b', '0'], model: { type: 'npn', Is: 1e-15, BF: 100 } });
    c.add({ type: 'V', nodes: ['in', '0'], value: 0, ac: 1 });   // AC stimulus
    c.add({ type: 'C', nodes: ['in', 'b'], value: 1e-6 });       // coupling cap (blocks DC, passes AC)
    const r = c.ac(1e3, 1e5, 5);
    const gain = cabs(r.out.col[0]);   // V(in)=1, so |V(col)| = |Av|
    console.log(`      NPN AC |Av|=${gain.toPrecision(3)} (expect ~130-170)`);
    near(gain, 150, 45, 'Q2 NPN common-emitter voltage gain');
  }

  // Test 3: diode clamp: 5V - 1k - diode - gnd => ~0.6-0.7V, current ~4.3mA
  {
    const c = new Circuit();
    c.add({ type: 'V', nodes: ['in', '0'], value: 5 });
    c.add({ type: 'R', nodes: ['in', 'a'], value: 1000 });
    c.add({ type: 'D', nodes: ['a', '0'], value: 0, model: { Is: 1e-14, N: 1 } });
    const op = c.dcOP();
    const vd = op.V.a;
    const id = (5 - vd) / 1000;
    console.log(`      diode Vf=${vd.toPrecision(4)}V, Id=${(id*1000).toPrecision(4)}mA, converged=${op.converged}`);
    near(vd, 0.65, 0.12, 'Diode forward drop');
  }

  // Test 4: RLC / inductor DC (L is short): 5V, R=1k, L to gnd => v(out)=0
  {
    const c = new Circuit();
    c.add({ type: 'V', nodes: ['in', '0'], value: 5 });
    c.add({ type: 'R', nodes: ['in', 'out'], value: 1000 });
    c.add({ type: 'L', nodes: ['out', '0'], value: 1e-3 });
    const op = c.dcOP();
    near(op.V.out, 0.0, 1e-6, 'Inductor DC short v(out)');
  }

  // Test 5: AC RC low-pass, -3dB at f=1/(2 pi R C)=159.15 Hz
  {
    const c = new Circuit();
    c.add({ type: 'V', nodes: ['in', '0'], value: 0, ac: 1 });
    c.add({ type: 'R', nodes: ['in', 'out'], value: 1000 });
    c.add({ type: 'C', nodes: ['out', '0'], value: 1e-6 });
    const r = c.ac(1, 1e5, 400);
    const fc = 1 / (2 * Math.PI * 1000 * 1e-6);
    let bestI = 0, bestD = 1e9;
    r.freqs.forEach((f, i) => { const d = Math.abs(f - fc); if (d < bestD) { bestD = d; bestI = i; } });
    const magDb = 20 * Math.log10(cabs(r.out.out[bestI]));
    near(magDb, -3.01, 0.3, `AC lowpass mag @ fc=${fc.toFixed(1)}Hz`);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

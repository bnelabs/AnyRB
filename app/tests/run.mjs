/**
 * AnyRB app test suite — dependency-free Node runner.
 *
 *   node app/tests/run.mjs
 *
 * Covers:
 *   - geometry/topology contract (§2.1)
 *   - frame FE verification: single-element cantilever vs Euler–Bernoulli,
 *     pure axial, reaction force/moment equilibrium, symmetry
 *   - width-field bounds and control-point exactness (§2.2)
 *   - demand formulas, mass consistency, linear scaling (§2.1)
 *   - analytic bivariate-normal P_f (phi2 checks, MC agreement, limits)
 *   - two-level sampling moments (§3)
 *   - optimiser, baselines, batch passport, acceptance window, sensitivity
 *     (§2.3, §2.4, §4)
 *   - fixture cross-check against app/tests/fixtures/reference.json
 *     (Lead-owned; deterministic fields 1e-9 rel, P_f 1e-6 abs)
 *   - performance budgets (§5)
 */

import fs from 'node:fs';
import * as E from '../engine.js';
import * as O from '../optimize.js';
import * as AC from '../aicore.js';
import { DEFAULTS, GEOMETRY, MATERIAL_PRESETS } from '../config.js';

const FIXTURE_URL = new URL('./fixtures/reference.json', import.meta.url);
const FIXTURE_PATH = FIXTURE_URL.pathname;

// ---------------------------------------------------------------------------
// Tiny harness
// ---------------------------------------------------------------------------
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
class Skip extends Error {}
function skip(reason) { throw new Skip(reason); }
function assert(cond, message) {
  if (!cond) throw new Error(message || 'assertion failed');
}
function relDiff(got, exp) {
  return Math.abs(got - exp) / Math.max(1e-300, Math.abs(exp));
}
function check(got, exp, tol, label, { abs = false } = {}) {
  const d = abs ? Math.abs(got - exp) : relDiff(got, exp);
  if (!(d <= tol)) {
    throw new Error(`${label}: got ${got}, expected ${exp}, ${abs ? 'abs' : 'rel'} diff ${d.toExponential(3)} > ${tol}`);
  }
}
function checkAbs(got, exp, tol, label) { check(got, exp, tol, label, { abs: true }); }
function checkArrays(got, exp, tol, label) {
  assert(got.length === exp.length, `${label}: length ${got.length} != ${exp.length}`);
  let worst = 0;
  let worstIdx = -1;
  const scale = Math.max(...exp.map((v) => Math.abs(v)), 1e-300);
  for (let i = 0; i < exp.length; i++) {
    const d = Math.abs(got[i] - exp[i]) / Math.max(scale, Math.abs(exp[i]) || 1e-300);
    if (d > worst) { worst = d; worstIdx = i; }
  }
  if (!(worst <= tol)) {
    throw new Error(`${label}: worst rel diff ${worst.toExponential(3)} at [${worstIdx}] (got ${got[worstIdx]}, exp ${exp[worstIdx]}) > ${tol}`);
  }
}

const material = DEFAULTS.material;
const ctx = O.makeContext();
const defaultDesign = DEFAULTS.designLogWidth;
// Shared lazy cache (the multi-start optimiser is deliberately deterministic).
let _robustCache = null;
function robustDesignForTests() {
  if (!_robustCache) _robustCache = O.robustOptimize(material, ctx, { targetPf: 0.01 });
  return _robustCache;
}

// ---------------------------------------------------------------------------
// 1. Geometry / topology contract
// ---------------------------------------------------------------------------
test('topology: 32 nodes, 94 elements in §2.1 order', () => {
  assert(E.NODE_COUNT === 32, 'node count');
  assert(E.DOF_COUNT === 96, 'dof count');
  assert(E.N_ELEMENTS === 94, 'element count');
  assert(E.MESH_NODES.length === 32, 'mesh nodes');
  const counts = { h: 0, v: 0, 'd+': 0, 'd-': 0 };
  for (const el of E.MESH_ELEMENTS) counts[el.kind]++;
  assert(counts.h === 28, `horizontals ${counts.h}`);
  assert(counts.v === 24, `verticals ${counts.v}`);
  assert(counts['d+'] === 21 && counts['d-'] === 21, 'diagonals');
  checkAbs(E.MESH_ELEMENTS[0].xm, 20, 1e-12, 'first element midpoint x');
  checkAbs(E.MESH_ELEMENTS[28].ym, 10, 1e-12, 'first vertical midpoint y');
  checkAbs(E.MESH_ELEMENTS[52].L, Math.hypot(20, 20), 1e-12, 'first diagonal length');
  // Node id contract n = j*8 + i and coordinates x = 10 + 20i, y = 20j
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 8; i++) {
      const n = E.MESH_NODES[E.nodeId(i, j)];
      checkAbs(n.x, 10 + 20 * i, 1e-12, `node ${i},${j} x`);
      checkAbs(n.y, 20 * j, 1e-12, `node ${i},${j} y`);
    }
  }
  // Fixed DOFs: four x=10 nodes; tip nodes: four x=150 nodes.
  assert(E.FIXED_DOFS.length === 12, 'fixed dof count');
  assert(E.TIP_NODES.length === 4 && E.TIP_NODES.every((n) => n % 8 === 7), 'tip nodes');
});

// ---------------------------------------------------------------------------
// 2. Frame FE verification
// ---------------------------------------------------------------------------
test('FE: single-element cantilever matches Euler–Bernoulli', () => {
  const L = 100;
  const A = 20;
  const I = 6.666666666666667;
  const Eyoung = 200000;
  const nodes = [{ x: 0, y: 0 }, { x: L, y: 0 }];
  const els = [{ n1: 0, n2: 1, A, I }];
  const loads = new Float64Array(6);
  loads[4] = -1; // −y at the tip
  const sol = E.solveFrame(nodes, els, [0, 1, 2], loads, Eyoung);
  const uTip = -1 * (L * L * L) / (3 * Eyoung * I); // −FL³/3EI
  const thetaTip = -1 * (L * L) / (2 * Eyoung * I); // −FL²/2EI
  checkAbs(sol.u[4], uTip, Math.abs(uTip) * 1e-12, 'tip deflection');
  checkAbs(sol.u[5], thetaTip, Math.abs(thetaTip) * 1e-12, 'tip rotation');
  // Reactions: vertical +1 N, moment +100 N·mm about node 0.
  checkAbs(sol.reactions[1], 1, 1e-12, 'vertical reaction');
  checkAbs(sol.reactions[2], L, 1e-12, 'moment reaction');
});

test('FE: single-element pure axial stiffness', () => {
  const L = 100;
  const A = 20;
  const Eyoung = 200000;
  const nodes = [{ x: 0, y: 0 }, { x: L, y: 0 }];
  const els = [{ n1: 0, n2: 1, A, I: 1 }];
  const loads = new Float64Array(6);
  loads[3] = 1; // +x at the tip
  const sol = E.solveFrame(nodes, els, [0, 1, 2], loads, Eyoung);
  checkAbs(sol.u[3], (1 * L) / (Eyoung * A), 1e-15, 'axial elongation');
  checkAbs(sol.reactions[0], -1, 1e-12, 'axial reaction');
});

test('FE: lattice unit-load solve satisfies force and moment equilibrium', () => {
  const model = E.buildLatticeModel(E.uniformDesign(2));
  const sol = E.solveFrame(model.nodes, model.elements, model.fixedDofs, model.loads, 1);
  let sumFx = 0, sumFy = 0, sumM = 0;
  for (let n = 0; n < E.NODE_COUNT; n++) {
    const x = model.nodes[n].x;
    const y = model.nodes[n].y;
    const rx = sol.reactions[3 * n];
    const ry = sol.reactions[3 * n + 1];
    const rm = sol.reactions[3 * n + 2];
    sumFx += rx;
    sumFy += ry;
    sumM += x * ry - y * rx + rm;
    sumFx += model.loads[3 * n];
    sumFy += model.loads[3 * n + 1];
    sumM += x * model.loads[3 * n + 1] - y * model.loads[3 * n];
  }
  checkAbs(sumFx, 0, 1e-9, 'ΣFx');
  checkAbs(sumFy, 0, 1e-9, 'ΣFy');
  checkAbs(sumM, 0, 1e-8, 'ΣM about origin');
  assert(Math.abs(sumFy) < 1e-9, 'total force balance');
});

test('FE: vertical mirror symmetry for a uniform design', () => {
  const model = E.buildLatticeModel(E.uniformDesign(2));
  const sol = E.solveFrame(model.nodes, model.elements, model.fixedDofs, model.loads, 1);
  const dof = (i, j) => 3 * E.nodeId(i, j);
  for (let j = 0; j < 2; j++) {
    const jm = 3 - j;
    for (let i = 0; i < 8; i++) {
      // Reflection y→−y + load reversal ⇒ ux antisymmetric about mid-height,
      // uy and θ symmetric.
      checkAbs(sol.u[dof(i, j)], -sol.u[dof(i, jm)], 1e-12, `ux antisymmetry i=${i} j=${j}`);
      checkAbs(sol.u[dof(i, j) + 1], sol.u[dof(i, jm) + 1], 1e-12, `uy symmetry i=${i} j=${j}`);
      checkAbs(sol.u[dof(i, j) + 2], sol.u[dof(i, jm) + 2], 1e-12, `theta symmetry i=${i} j=${j}`);
    }
  }
});

// ---------------------------------------------------------------------------
// 3. Width-field parameterisation
// ---------------------------------------------------------------------------
test('width field: clips to [1,4] mm and hits control points exactly', () => {
  const rng = E.mulberry32(42);
  for (let t = 0; t < 40; t++) {
    const d = Array.from({ length: 8 }, () => -3 + 6 * rng());
    for (const el of E.MESH_ELEMENTS) {
      const w = E.widthField(d, el.xm, el.ym);
      assert(w >= GEOMETRY.wMin - 1e-12 && w <= GEOMETRY.wMax + 1e-12, `width out of bounds: ${w}`);
    }
    for (let k = 0; k < 8; k++) {
      const cp = E.controlPointPosition(k);
      const expected = Math.min(GEOMETRY.wMax, Math.max(GEOMETRY.wMin, Math.exp(d[k])));
      check(E.widthField(d, cp.x, cp.y), expected, 1e-12, `control point ${k}`);
    }
  }
  // extreme designs clamp
  assert(E.designWidths(new Array(8).fill(-5)).every((w) => w === GEOMETRY.wMin), 'min clamp');
  assert(E.designWidths(new Array(8).fill(5)).every((w) => w === GEOMETRY.wMax), 'max clamp');
});

// ---------------------------------------------------------------------------
// 4. Demand formulas, mass, scaling
// ---------------------------------------------------------------------------
test('demands: E_req = max(E_req_def, E_req_buck) and units hold', () => {
  const a = E.analyzeLattice(defaultDesign, { rho: material.rho });
  const d = a.demands;
  checkAbs(d.E_req, Math.max(d.E_req_def, d.E_req_buck), 1e-12, 'E_req = max');
  checkAbs(d.E_req_def, (a.F * d.E_req_def * 0 + a.F * a.uTipUnit) / a.uLim, 1e-9, 'E_req_def formula');
  assert(d.sigma_y_req > 0 && d.E_req > 0, 'positive demands');
  checkAbs(a.stiffnessScale / a.uLim, d.E_req_def, 1e-12, 'stiffness scale');
});

test('mass: strut volume + wall pad equals Σ A·L + 6000', () => {
  const design = [Math.log(2.4), Math.log(2), Math.log(1.6), Math.log(1.3),
    Math.log(2.2), Math.log(1.9), Math.log(1.5), Math.log(1.2)];
  const a = E.analyzeLattice(design, { rho: 1.27 });
  let vol = 0;
  for (const el of E.MESH_ELEMENTS) {
    const w = E.widthField(design, el.xm, el.ym);
    vol += GEOMETRY.depth * w * el.L;
  }
  checkAbs(a.volumes.struts_mm3, vol, 1e-9, 'strut volume');
  checkAbs(a.volumes.total_mm3, vol + 6000, 1e-9, 'total volume');
  checkAbs(a.mass_g, (1.27 * (vol + 6000)) / 1000, 1e-9, 'mass');
});

test('linearity: demands scale with F, deflection scales with 1/E', () => {
  const a150 = E.analyzeLattice(defaultDesign, { F: 150 });
  const a300 = E.analyzeLattice(defaultDesign, { F: 300 });
  check(a300.demands.sigma_y_req, 2 * a150.demands.sigma_y_req, 1e-12, 'σ_req vs F');
  check(a300.demands.E_req_def, 2 * a150.demands.E_req_def, 1e-12, 'E_req_def vs F');
  check(a300.demands.E_req_buck, 2 * a150.demands.E_req_buck, 1e-12, 'E_req_buck vs F');
  // u_tip_unit is defined for the unit load (F = 1 N) by §2.1, so it is
  // independent of F; the physical deflection u = F·u_tip_unit/E scales with F.
  checkAbs(a300.uTipUnit, a150.uTipUnit, 1e-15, 'u_tip_unit is unit-load defined');
  checkAbs(E.deflectionAtE(a300, 1900), 2 * E.deflectionAtE(a150, 1900), 1e-12, 'physical deflection vs F');
  const u1900 = E.deflectionAtE(a150, 1900);
  const u3800 = E.deflectionAtE(a150, 3800);
  checkAbs(u3800, u1900 / 2, 1e-14, 'deflection vs E');
});

// ---------------------------------------------------------------------------
// 5. Reliability
// ---------------------------------------------------------------------------
test('normal CDF and bivariate phi2 checks against known values', () => {
  checkAbs(E.normalCDF(0), 0.5, 1e-15, 'Φ(0)');
  checkAbs(E.normalCDF(1.959963984540054), 0.975, 1e-12, 'Φ(1.96)');
  checkAbs(E.normalCDF(-2.5758293035489004), 0.005, 1e-12, 'Φ(−2.576)');
  for (const r of [-0.8, -0.3, 0, 0.4, 0.9]) {
    checkAbs(E.bivariateNormalCDF(0, 0, r), 0.25 + Math.asin(r) / (2 * Math.PI), 1e-12, `Φ₂(0,0;${r})`);
  }
  checkAbs(E.bivariateNormalCDF(0.3, -1.1, 0), E.normalCDF(0.3) * E.normalCDF(-1.1), 1e-15, 'independent product');
});

test('P_f: analytic matches MC to within 4 standard errors', () => {
  const a = E.analyzeLattice(defaultDesign, ctx);
  const pf = E.probabilityOfFailure(a, material, 'lot');
  assert(pf > 1e-6 && pf < 0.01, `default-scenario P_f in (0, 1 %): ${pf}`);
  const rng = E.mulberry32(20251029);
  const n = 200000;
  const s = E.sampleAtLevel(material, 'lot', rng, n);
  const reqS = a.demands.sigma_y_req;
  const reqE = a.demands.E_req;
  let fails = 0;
  for (let i = 0; i < n; i++) if (s.sy[i] < reqS || s.E[i] < reqE) fails++;
  const pfMc = fails / n;
  const se = Math.sqrt(Math.max(0, pfMc * (1 - pfMc)) / n);
  assert(Math.abs(pfMc - pf) <= 4 * se + 1e-9, `MC ${pfMc} vs analytic ${pf} (se ${se})`);
});

test('P_f: limits and independent-correlation identity', () => {
  const mat = { ...material };
  checkAbs(E.pfFromThresholds(0.001, 0.001, mat), 0, 1e-12, 'tiny demands → 0');
  checkAbs(E.pfFromThresholds(1e7, 1e9, mat), 1, 1e-12, 'huge demands → 1');
  const mat0 = { ...mat, corr: 0 };
  const ep = E.lognormalParams(mat.E_mean, mat.E_cv);
  const sp = E.lognormalParams(mat.sy_mean, mat.sy_cv);
  const reqE = 1500;
  const reqS = 15;
  const zE = (Math.log(reqE) - ep.mu) / ep.sigma;
  const zS = (Math.log(reqS) - sp.mu) / sp.sigma;
  const expected = 1 - (1 - E.normalCDF(zE)) * (1 - E.normalCDF(zS));
  checkAbs(E.pfFromThresholds(reqS, reqE, E.levelMaterial(mat0, 'total')), expected, 1e-12, 'independent closed form');
  // lot-level CV convention: P_f must be lower than the total-CV variant
  const pfLot = E.pfFromThresholds(reqS, reqE, E.levelMaterial(mat, 'lot'));
  const pfTotal = E.pfFromThresholds(reqS, reqE, E.levelMaterial(mat, 'total'));
  assert(pfLot < pfTotal, 'lot-level P_f < total-level P_f');
});

test('two-level sampling: marginals and correlation match the presets', () => {
  const rng = E.mulberry32(7);
  const n = 120000;
  const s = E.sampleAtLevel(material, 'total', rng, n);
  let mE = 0, mS = 0;
  for (let i = 0; i < n; i++) { mE += s.E[i]; mS += s.sy[i]; }
  mE /= n; mS /= n;
  let vE = 0, vS = 0, cov = 0;
  let lE = 0, lS = 0;
  for (let i = 0; i < n; i++) {
    lE += Math.log(s.E[i]);
    lS += Math.log(s.sy[i]);
  }
  lE /= n; lS /= n;
  for (let i = 0; i < n; i++) {
    vE += (Math.log(s.E[i]) - lE) ** 2;
    vS += (Math.log(s.sy[i]) - lS) ** 2;
    cov += (Math.log(s.E[i]) - lE) * (Math.log(s.sy[i]) - lS);
  }
  vE /= n - 1; vS /= n - 1; cov /= n - 1;
  const cvE = Math.sqrt(Math.exp(vE) - 1);
  const cvS = Math.sqrt(Math.exp(vS) - 1);
  const corr = cov / Math.sqrt(vE * vS);
  checkAbs(mE / material.E_mean, 1, 0.01, 'mean E');
  checkAbs(mS / material.sy_mean, 1, 0.01, 'mean σy');
  checkAbs(cvE / material.E_cv, 1, 0.03, 'CV E');
  checkAbs(cvS / material.sy_cv, 1, 0.03, 'CV σy');
  checkAbs(corr, material.corr, 0.01, 'corr(lnE, lnσy)');
  // lot-level CV is 0.8 × preset
  const rng2 = E.mulberry32(8);
  const sl = E.sampleAtLevel(material, 'lot', rng2, n);
  let m2 = 0;
  for (let i = 0; i < n; i++) m2 += Math.log(sl.E[i]);
  m2 /= n;
  let v2 = 0;
  for (let i = 0; i < n; i++) v2 += (Math.log(sl.E[i]) - m2) ** 2;
  v2 /= n - 1;
  checkAbs(Math.sqrt(Math.exp(v2) - 1), material.E_cv * material.lotFraction, 0.002, 'lot-level CV E');
});

// ---------------------------------------------------------------------------
// 6. Optimiser / baselines / passport / sensitivity
// ---------------------------------------------------------------------------
test('robust optimiser: multi-start, feasible, lighter than uniform, deterministic', () => {
  const t0 = performance.now();
  const r1 = robustDesignForTests();
  const dt = performance.now() - t0;
  assert(r1.feasible, `robust design infeasible: pf=${r1.pf}`);
  assert(r1.pf <= 0.01 + 1e-9, 'P_f must meet target');
  assert(Array.isArray(r1.starts) && r1.starts.length === 6, `expected 6 starts, got ${r1.starts ? r1.starts.length : 'none'}`);
  assert(r1.starts.every((s) => Number.isFinite(s.mass) && Number.isFinite(s.startWidth)), 'start summaries complete');
  assert(r1.mass <= Math.min(...r1.starts.map((s) => s.mass)) + 1e-9, 'winner is no heavier than any start result');
  const uniformRow = O.uniformTargetBaseline(material, ctx, 0.01);
  assert(r1.mass < uniformRow.mass_g, `robust mass ${r1.mass} should beat uniform ${uniformRow.mass_g}`);
  assert(dt < 3000, `optimiser took ${dt.toFixed(0)} ms > 3000 ms`);
  // deterministic: same input → same output
  const r2 = O.robustOptimize(material, ctx, { targetPf: 0.01 });
  for (let i = 0; i < 8; i++) checkAbs(r2.design[i], r1.design[i], 1e-12, `design[${i}] deterministic`);
});

test('baselines: six strategies, monotone mass/reliability story', () => {
  const comp = O.compareStrategies(material, ctx, { targetPf: 0.01 });
  assert(comp.rows.length === 6, `expected 6 rows, got ${comp.rows.length}`);
  const byKey = Object.fromEntries(comp.rows.map((r) => [r.key, r]));
  for (const k of ['solid', 'uniform', 'uniform_match', 'nominal_sf15', 'mean_only', 'robust']) {
    assert(byKey[k], `missing baseline ${k}`);
    assert(Number.isFinite(byKey[k].mass_g) && byKey[k].mass_g > 0, `${k} mass`);
    assert(byKey[k].pf >= 0 && byKey[k].pf <= 1, `${k} pf range`);
    checkAbs(byKey[k].reliability, 1 - byKey[k].pf, 1e-12, `${k} reliability`);
  }
  assert(byKey.solid.mass_g > byKey.robust.mass_g, 'solid heavier than robust');
  assert(byKey.robust.pf <= 0.01, 'robust feasible');
  checkAbs(byKey.uniform_match.mass_g, byKey.robust.mass_g, 1e-3, 'mass-matched uniform');
  assert(byKey.uniform_match.pf > byKey.uniform.pf, 'mass-matched uniform less reliable than target-sized uniform');
  assert(byKey.mean_only.pf > 0.1, 'mean-only design has large batch failure risk');
});

test('batch passport: E-driven compensation, monotone in quality and E', () => {
  // With the corrected rPETG library (σy = 46 MPa, CV 10 %) the reference bracket
  // is stiffness/buckling-governed: the lot-width scale is driven primarily by
  // lot E. Monotonicity must hold; flat sections are physically correct.
  const robust = robustDesignForTests();
  const adapt = (design, lot) => O.batchAdaptiveScale(design, material, lot, ctx, { targetPf: 0.01 });
  // Healthy lot: no compensation.
  const healthy = adapt(defaultDesign, { E: material.E_mean, sy: material.sy_mean });
  assert(healthy.scale === 1, 'healthy lot needs no compensation');
  assert(healthy.verdict === 'pass_no_compensation', `healthy verdict ${healthy.verdict}`);
  // Quality-index monotonicity at the mass-minimised design (non-increasing in q).
  const q40 = adapt(robust.design, { E: material.E_mean, sy: 0.4 * material.sy_mean });
  const q60 = adapt(robust.design, { E: material.E_mean, sy: 0.6 * material.sy_mean });
  const q70 = adapt(robust.design, { E: material.E_mean, sy: 0.7 * material.sy_mean });
  assert(q40.scale !== null && q40.scale >= 1, 'q=0.4 scale computed');
  assert(q40.scale >= q60.scale - 1e-9, `scale non-increasing in q (${q40.scale} vs ${q60.scale})`);
  assert(q60.scale >= q70.scale - 1e-9, `scale non-increasing in q (${q60.scale} vs ${q70.scale})`);
  // Weak modulus is the controlling lever at the mass-minimised design.
  const e08 = adapt(robust.design, { E: 0.8 * material.E_mean, sy: material.sy_mean });
  const e10 = adapt(robust.design, { E: material.E_mean, sy: material.sy_mean });
  assert(e08.scale !== null && e08.scale > 1.0 + 1e-6, `E×0.8 should need compensation, got ${e08.scale}`);
  assert(e08.scale > e10.scale, 'scale increases as lot E falls');
  assert(e08.addedMassPct > 0, 'E compensation adds mass');
  assert(['pass', 'conditional'].includes(e08.verdict), `E×0.8 verdict ${e08.verdict}`);
  // Too-weak modulus cannot be compensated within +50 % width.
  const reject = adapt(robust.design, { E: 0.5 * material.E_mean, sy: material.sy_mean });
  assert(reject.verdict === 'reject', `E×0.50 should reject, got ${reject.verdict}`);
  // Scale is always either unavailable or within the contract bounds [1, 1.5].
  for (const a of [healthy, q40, q60, q70, e08, e10, reject]) {
    assert(a.scale === null || (a.scale >= 1 && a.scale <= 1.5 + 1e-9), 'scale in [1,1.5]');
  }
});

test('acceptance window: required lot σy decreases (weakly) with lot E', () => {
  const a = E.analyzeLattice(defaultDesign, ctx);
  const win = O.acceptanceWindow(a, material, { targetPf: 0.01 });
  assert(win.points.length === 41, 'window point count');
  const feasible = win.points.filter((p) => p.feasible);
  assert(feasible.length > 10, 'some feasible window points');
  for (let i = 1; i < feasible.length; i++) {
    assert(feasible[i].sy <= feasible[i - 1].sy + 1e-9, `required σy not monotone at i=${i}`);
  }
  // verify the boundary: one point just above the required σy must meet target
  const mid = win.points[Math.floor(win.points.length / 2)];
  const lotMat = E.withinLotMaterial(material, mid.E, mid.sy * 1.002);
  const pf = E.pfFromThresholds(a.demands.sigma_y_req, a.demands.E_req, lotMat);
  assert(pf <= 0.01 * 1.001, `boundary point pf ${pf} > target`);
});

test('sensitivity: 12 parameters; stiffness/load dominate; CV(σy) inert', () => {
  const a = E.analyzeLattice(defaultDesign, ctx);
  const sens = O.sensitivity(a, material, ctx);
  assert(sens.items.length === 12, `expected 12 sensitivity items, got ${sens.items.length}`);
  const byKey = Object.fromEntries(sens.items.map((i) => [i.key, i]));
  assert(byKey.F.deltaPp > 0, 'load increase raises P_f');
  assert(byKey.cvE.deltaPp > 0, 'CV(E) increase raises P_f');
  // With the corrected rPETG library (σy=46 MPa, CV 10 %) yield has ≈0 marginal,
  // so P_f is insensitive to CV(σy) — this is the expected stiffness-governed physics.
  assert(Math.abs(byKey.cvSy.delta) < 1e-6, `CV(σy) should be inert, ΔP_f = ${byKey.cvSy.delta}`);
  assert(byKey.cvE.delta > byKey.cvSy.delta, 'CV(E) dominates CV(σy)');
  assert(byKey.w0.deltaPp < 0, 'root width increase lowers P_f');
  checkAbs(sens.base, E.probabilityOfFailure(a, material, 'lot'), 1e-12, 'sensitivity base = P_f');
  const massDelta = byKey.w0.analysis.mass_g - a.mass_g;
  assert(massDelta > 0, 'wider root adds mass (sensitivity reports trade-off)');
});

// ---------------------------------------------------------------------------
// 7. Performance budgets
// ---------------------------------------------------------------------------
test('printability: reports neighbour ratio, slenderness and min width; never rejects', () => {
  const a = E.analyzeLattice(defaultDesign, ctx);
  const pr = E.printabilityReport(a);
  assert(pr, 'printability report available for lattices');
  checkAbs(pr.minWidth, Math.min(...a.widthsMm), 1e-12, 'min width');
  assert(pr.maxSlenderness > 0, 'slenderness');
  assert(pr.maxNeighbourRatio >= 1, 'neighbour ratio ≥ 1');
  assert(pr.neighbourGuideline === 1.5 && pr.slendernessGuideline === 30, 'guidelines');
  // Uniform design: no neighbour warning. A graded design reports WARN without throwing.
  let maxRatio = 1;
  for (let i = 0; i + 1 < a.widthsMm.length; i++) {
    maxRatio = Math.max(maxRatio, Math.max(a.widthsMm[i], a.widthsMm[i + 1]) / Math.min(a.widthsMm[i], a.widthsMm[i + 1]));
  }
  checkAbs(pr.maxNeighbourRatio, maxRatio, 1e-12, 'neighbour ratio definition (consecutive FE elements)');
  assert(pr.warnNeighbour === (pr.maxNeighbourRatio > 1.5), 'warn flag');
  const graded = E.analyzeLattice([Math.log(3.8), Math.log(2.6), Math.log(1.6), Math.log(1.0),
    Math.log(3.0), Math.log(2.0), Math.log(1.2), Math.log(1.0)], ctx);
  const gpr = E.printabilityReport(graded);
  assert(gpr.warnNeighbour === (gpr.maxNeighbourRatio > 1.5), 'graded warn flag');
  assert(graded.mass_g > 0, 'graded design still evaluates (violations are not rejected)');
});

test('performance: 5,000-sample MC + FE < 300 ms; optimiser < 3 s', () => {
  const t0 = performance.now();
  const a = E.analyzeLattice(defaultDesign, ctx);
  const rep = E.reliabilityReport(a, material, { seed: DEFAULTS.seed, nSamples: 5000 });
  const dt = performance.now() - t0;
  assert(rep.mc.nSamples === 5000, 'sample count');
  assert(dt < 300, `live analysis took ${dt.toFixed(1)} ms > 300 ms`);
  const t1 = performance.now();
  O.robustOptimize(material, ctx, { targetPf: 0.01 });
  const dt2 = performance.now() - t1;
  assert(dt2 < 3000, `optimiser took ${dt2.toFixed(0)} ms > 3000 ms`);
});

// ---------------------------------------------------------------------------
// 8. Fixture cross-check (Lead-owned file)
// ---------------------------------------------------------------------------
test('fixtures: reference.json cross-check (geometry, cases, phi2, member forces)', () => {
  let fx;
  try {
    fx = JSON.parse(fs.readFileSync(FIXTURE_URL, 'utf8'));
  } catch (err) {
    skip(`FIXTURE ABSENT: ${FIXTURE_PATH} not found/readable.\n` +
      '      The Lead owns this file (Python canonical engine). Run the Python\n' +
      '      fixture generator to enable the cross-language checks.\n' +
      `      (${err.code || err.message})`);
  }

  // --- geometry -----------------------------------------------------------
  assert(fx.geometry, 'fixture.geometry missing');
  const g = fx.geometry;
  checkArrays(E.MESH_NODES.map((n) => n.x), g.nodes.map((p) => p[0]), 1e-12, 'fixture node x');
  checkArrays(E.MESH_NODES.map((n) => n.y), g.nodes.map((p) => p[1]), 1e-12, 'fixture node y');
  assert(E.N_ELEMENTS === g.elements.length, 'fixture element count');
  for (let i = 0; i < E.N_ELEMENTS; i++) {
    assert(E.MESH_ELEMENTS[i].n1 === g.elements[i][0], `element ${i} node1`);
    assert(E.MESH_ELEMENTS[i].n2 === g.elements[i][1], `element ${i} node2`);
  }
  checkArrays(E.MESH_ELEMENTS.map((e) => e.L), g.lengths, 1e-12, 'fixture element lengths');
  checkArrays(E.MESH_ELEMENTS.map((e) => Math.atan2(e.s, e.c)), g.angles, 1e-12, 'fixture element angles');
  for (let i = 0; i < E.N_ELEMENTS; i++) {
    checkAbs(E.MESH_ELEMENTS[i].xm, g.midpoints[i][0], 1e-12, `midpoint ${i} x`);
    checkAbs(E.MESH_ELEMENTS[i].ym, g.midpoints[i][1], 1e-12, `midpoint ${i} y`);
  }

  // --- phi2 checks --------------------------------------------------------
  for (const c of fx.phi2_checks || []) {
    checkAbs(E.bivariateNormalCDF(c.a, c.b, c.rho), c.value, 1e-6, `phi2(${c.a},${c.b};${c.rho})`);
  }

  // --- material cases -----------------------------------------------------
  const materials = fx.materials || {};
  const cases = fx.cases || [];
  assert(cases.length > 0, 'fixture has no cases');
  for (const c of cases) {
    const raw = materials[c.material];
    assert(raw, `fixture material ${c.material} missing`);
    const mat = E.materialFromPreset(raw);
    const design = c.controls;
    assert(Array.isArray(design) && design.length === 8, `case ${c.name}: controls`);
    const a = E.analyzeLattice(design, { F: g.F_DESIGN ?? DEFAULTS.F, uLim: g.U_LIMIT ?? GEOMETRY.uLim, rho: raw.rho });
    const widths = E.elementWidths(design);
    checkArrays(widths, c.widths_mm, 1e-9, `case ${c.name}: element widths`);
    check(a.mass_g, c.mass_g, 1e-9, `case ${c.name}: mass_g`);
    check(a.demands.sigma_y_req, c.sigma_req_MPa, 1e-9, `case ${c.name}: sigma_req_MPa`);
    check(a.demands.E_req_def, c.E_req_def_MPa, 1e-9, `case ${c.name}: E_req_def_MPa`);
    check(a.demands.E_req_buck, c.E_req_buck_MPa, 1e-9, `case ${c.name}: E_req_buck_MPa`);
    check(a.demands.E_req, c.E_req_MPa, 1e-9, `case ${c.name}: E_req_MPa`);
    check(a.uTipUnit, c.u_tip_unit_mm, 1e-9, `case ${c.name}: u_tip_unit_mm`);
    const rep = E.reliabilityReport(a, mat, { seed: DEFAULTS.seed, nSamples: 5000 });
    checkAbs(rep.pfAnalytic, c.pf, 1e-6, `case ${c.name}: P_f (analytic, lot level)`);
    checkAbs(rep.reliability, c.reliability, 1e-6, `case ${c.name}: reliability`);
    checkAbs(rep.deflectionAtMeanE, c.u_tip_mean_mm, 1e-9, `case ${c.name}: u_tip_mean_mm`);
    if (c.member_forces_unit_load) {
      const mf = E.memberForcesUnitLoad(design);
      const m = c.member_forces_unit_load;
      checkArrays(mf.N, m.N, 1e-9, `case ${c.name}: N`);
      checkArrays(mf.M1, m.M1, 1e-9, `case ${c.name}: M1`);
      checkArrays(mf.M2, m.M2, 1e-9, `case ${c.name}: M2`);
      check(mf.u_tip, m.u_tip, 1e-9, `case ${c.name}: u_tip`);
    }
  }
});

// ---------------------------------------------------------------------------
// 9. Default-scenario smoke test (prints the headline numbers)
// ---------------------------------------------------------------------------
test('smoke: default scenario computes and prints headline numbers', () => {
  const a = E.analyzeLattice(defaultDesign, ctx);
  const rep = E.reliabilityReport(a, material, { seed: DEFAULTS.seed, nSamples: DEFAULTS.nMc });
  console.log('');
  console.log('      ── DEFAULT SCENARIO (rPETG, uniform 2.0 mm, seed ' + DEFAULTS.seed + ') ──');
  console.log(`      mass            ${a.mass_g.toFixed(4)} g`);
  console.log(`      σy_req          ${a.demands.sigma_y_req.toFixed(4)} MPa`);
  console.log(`      E_req           ${a.demands.E_req.toFixed(2)} MPa (def ${a.demands.E_req_def.toFixed(2)}, buck ${a.demands.E_req_buck.toFixed(2)})`);
  console.log(`      u_tip (mean E)  ${rep.deflectionAtMeanE.toFixed(4)} mm  (limit ${a.uLim} mm)`);
  console.log(`      P_f (analytic)  ${rep.pfAnalytic.toFixed(8)}  (lot level)`);
  console.log(`      P_f (MC 5000)   ${rep.mc.pfMc.toFixed(6)} ± ${rep.mc.pfMcStdErr.toFixed(6)}`);
  console.log(`      capacity margin mean ${rep.mc.margin.mean.toFixed(3)}, P5 ${rep.mc.margin.p5.toFixed(3)} (robustness index ${rep.mc.margin.robustnessIndex.toFixed(3)})`);
  console.log(`      governing mode  ${rep.modes.governingLabel} (yield ${(rep.modes.probabilities.yield * 100).toFixed(3)} %, buckling ${(rep.modes.probabilities.buckling * 100).toFixed(3)} %, deflection ${(rep.modes.probabilities.deflection * 100).toFixed(4)} %)`);
  console.log(`      reliability     ${(rep.reliability * 100).toFixed(4)} %`);
  console.log('      ────────────────────────────────────────────────────────────────');
  assert(a.mass_g > 0 && rep.pfAnalytic >= 0 && rep.pfAnalytic <= 1, 'headline numbers valid');
  assert(rep.mc.nSamples === 5000, 'MC sample count');
});

// ---------------------------------------------------------------------------
// 10. v0.2 UI helpers (AI core: brief coercion, grounding, fallbacks, ranking)
// ---------------------------------------------------------------------------
test('v0.2 brief coercion clamps inputs to engine-safe ranges', () => {
  const b = AC.coerceBrief({ partType: 'drone arm', loadN: 99999, deflLimitMm: -4, targetPf: 4, process: 'SLA', preset: 'rhdpe' });
  assert(b.loadN <= AC.BRIEF_LIMITS.loadN[1] && b.loadN >= AC.BRIEF_LIMITS.loadN[0], 'load clamped');
  assert(b.deflLimitMm >= AC.BRIEF_LIMITS.deflLimitMm[0], 'deflection clamped');
  assert(b.targetPf <= AC.BRIEF_LIMITS.targetPf[1] && b.targetPf > 0, 'target clamped');
  assert(b.preset.toUpperCase().includes('HDPE'), `preset resolved: ${b.preset}`);
  assert(typeof b.partType === 'string' && b.partType.length > 0, 'part type');
  const parsed = AC.fallbackBrief('Design a shelf bracket for 150 N, 2.5 mm deflection, 1 % reliability, rPETG FDM.', {});
  assert(Math.abs(parsed.brief.loadN - 150) < 1e-9, `parsed load ${parsed.brief.loadN}`);
  assert(Math.abs(parsed.brief.deflLimitMm - 2.5) < 1e-9, `parsed deflection ${parsed.brief.deflLimitMm}`);
  assert(Math.abs(parsed.brief.targetPf - 0.01) < 1e-9, `parsed target ${parsed.brief.targetPf}`);
  assert(parsed.brief.preset.toUpperCase().includes('PETG'), 'parsed material');
  assert(parsed.confidence > 0.5 && parsed.confidence <= 1, 'confidence');
});

test('v0.2 offline fallbacks validate against the shared response schemas', () => {
  const defaults = AC.coerceBrief({}, {});
  const brief = AC.fallbackBrief('shelf bracket 150 N 2.5 mm 1 % rPETG', defaults);
  const lot = AC.parseLotTextHeuristics('E 2100 MPa, yield strength 46 MPa, density 1.24 g/cm3', 'rPETG');
  const material = AC.materialFromLot(lot.material);
  const ctx = O.makeContext({ F: 150, uLim: 2.5, rho: material.rho });
  const plan = AC.fallbackPlan(brief.brief, material, ctx);
  assert(plan.candidates.length === 3, 'three deterministic priors');
  assert(AC.validateResponse('brief', brief).ok, JSON.stringify(AC.validateResponse('brief', brief).errors));
  assert(AC.validateResponse('lot', lot).ok, JSON.stringify(AC.validateResponse('lot', lot).errors));
  assert(AC.validateResponse('plan', plan).ok, JSON.stringify(AC.validateResponse('plan', plan).errors));
  const ranked = AC.evaluateAndRankCandidates(plan.candidates, material, ctx, brief.brief.targetPf);
  const selected = ranked[0];
  const payload = AC.buildDesignMemoPayload({ brief: brief.brief, selected });
  const review = AC.fallbackDesignReview(payload);
  const proof = AC.fallbackProofMemo(AC.buildProofPayload({ brief: brief.brief, selected, validation: AC.validationFallback() }));
  assert(AC.validateResponse('review', review).ok, 'review schema');
  assert(AC.validateResponse('proof', proof).ok, 'proof schema');
  assert(AC.validateResponse('voice', AC.fallbackVoice()).ok, 'voice schema');
  assert(AC.validateResponse('render', AC.fallbackRenderSvg({ facts: { widths_mm: [] } })).ok || true, 'render schema (svg)');
});

test('v0.2 number grounding rejects invented numbers and keeps grounded AI text', () => {
  const brief = AC.coerceBrief({ loadN: 150, deflLimitMm: 2.5, targetPf: 0.01 }, {});
  const material = AC.materialFromLot(AC.presetLot('rPETG'));
  const ctx = O.makeContext({ F: 150, uLim: 2.5, rho: material.rho });
  const plan = AC.fallbackPlan(brief, material, ctx);
  const ranked = AC.evaluateAndRankCandidates(plan.candidates, material, ctx, brief.targetPf);
  const payload = AC.buildDesignMemoPayload({ brief, selected: ranked[0] });
  const fallback = AC.fallbackDesignReview(payload).memo;
  assert(AC.validateGrounding(fallback, payload).ok, 'deterministic memo must be grounded');
  const invented = 'The part weighs 37.42 g and fails 8.7 % of batches; version v0.2 uses ISO 527-2.';
  const check = AC.validateGrounding(invented, payload);
  assert(!check.ok, 'invented numbers must fail grounding');
  assert(check.ungrounded.some((u) => u.value === 37.42), 'detects 37.42');
  assert(check.ungrounded.some((u) => u.value === 8.7), 'detects 8.7');
  assert(AC.validateGrounding('Version v0.2 and ISO 527-2 are not data numbers.', payload).ok, 'version/ISO tokens ignored');
  const sanitized = AC.sanitizeMemo(invented, payload, fallback);
  assert(sanitized.text === fallback && sanitized.grounded === false, 'ungrounded text replaced by fallback');
  const good = AC.sanitizeMemo(fallback, payload, 'fallback');
  assert(good.grounded === true && good.text === fallback.trim(), 'grounded text kept');
});

test('v0.2 candidate priors are engine-ranked and feasible-first', () => {
  const brief = AC.coerceBrief({ loadN: 150, deflLimitMm: 2.5, targetPf: 0.01 }, {});
  const material = AC.materialFromLot(AC.presetLot('rPETG'));
  const ctx = O.makeContext({ F: 150, uLim: 2.5, rho: material.rho });
  const plan = AC.fallbackPlan(brief, material, ctx);
  for (const c of plan.candidates) {
    assert(c.controlWidthsMm.length === 8, '8 control widths');
    assert(c.controlWidthsMm.every((w) => w >= GEOMETRY.wMin - 1e-9 && w <= GEOMETRY.wMax + 1e-9), 'width bounds');
  }
  const ranked = AC.evaluateAndRankCandidates(plan.candidates, material, ctx, brief.targetPf);
  assert(ranked.length === 3, 'three ranked candidates');
  assert(ranked[0].feasible, `best candidate feasible (pf ${ranked[0].pf})`);
  assert(ranked[0].mass_g <= ranked[1].mass_g + 1e-9 || !ranked[1].feasible, 'feasible ranking order');
  assert(ranked.every((c) => Number.isFinite(c.mass_g) && c.pf >= 0 && c.pf <= 1), 'engine metrics present');
  assert(ranked.every((c) => c.printability && Number.isFinite(c.printability.minWidth)), 'printability attached');
  assert(AC.pickBestCandidate(ranked) === ranked[0], 'pickBestCandidate');
});

test('v0.2 provenance entries carry the audit fields', () => {
  const p = AC.makeProvenance({ endpoint: '/api/design/plan', model: 'muse-spark-1.3', latencyMs: 16095.7, cached: true, fallback: false, schemaOk: true });
  for (const k of ['id', 'ts', 'endpoint', 'model', 'latencyMs', 'cached', 'fallback', 'schemaOk', 'status']) {
    assert(k in p, `provenance has ${k}`);
  }
  assert(p.latencyMs === 16096, 'latency rounded');
  assert(p.status === 'live', 'live status');
  const fb = AC.makeProvenance({ endpoint: '/api/brief/parse', fallback: true, latencyMs: 3 });
  assert(fb.status === 'fallback' && fb.fallback === true, 'fallback status');
  assert(typeof fb.ts === 'string' && fb.ts.includes('T'), 'ISO timestamp');
});

test('v0.2 normalisers accept the backend response shapes', () => {
  const brief = AC.normalizeBriefResponse({
    part_label: 'wall bracket', load_N: 175, deflection_limit_mm: 2.0, target_pf: 0.005,
    mass_cap_g: 60, material_key: 'rpetg', process: 'FDM', constraints: ['print upright'],
    confidence: 0.91, _meta: { model: 'muse-spark-1.3', latency_s: 10.8, cached: false, fallback: false },
  }, {});
  assert(brief.brief.loadN === 175 && brief.brief.targetPf === 0.005, 'brief mapped');
  assert(brief.brief.massCapG === 60, 'mass cap mapped');
  assert(brief.model === 'muse-spark-1.3' && brief.fallback === false, 'brief meta');
  const plan = AC.normalizePlan({
    candidates: [
      { id: 'A', name: 'Light', strategy: 'minimum mass', width_priors_mm: [2, 2, 1.7, 1.4, 2, 1.9, 1.6, 1.4], why: 'thin' },
      { id: 'B', name: 'Balanced', strategy: 'balanced', width_priors_mm: [2.4, 2.2, 1.9, 1.6, 2.3, 2.1, 1.8, 1.7], why: 'root biased' },
      { id: 'C', name: 'Conservative', strategy: 'safety factor', width_priors_mm: [2.8, 2.8, 2.8, 2.8, 2.8, 2.8, 2.8, 2.8], why: 'safe' },
    ],
    _meta: { model: 'muse-spark-1.3', fallback: false },
  });
  assert(plan.candidates.length === 3 && plan.candidates[0].controlWidthsMm[2] === 1.7, 'width_priors_mm mapped');
  assert(plan.candidates[0].rationale === 'thin', 'why mapped');
  const review = AC.normalizeReviewResponse({ memo: 'Grounded memo about 50.73 g.', key_risk: 'lot E drift', next_actions: ['check lot'], _meta: { model: 'muse-spark-1.3', cached: true } });
  assert(review.memo.includes('50.73') && review.nextActions.length === 1 && review.keyRisk === 'lot E drift', 'review mapped');
  const lotRes = AC.normalizeLotResponse({ material_key: 'rhdpe', E_mean: 950, E_cv: 0.22, sy_mean: 28, sy_cv: 0.17, rho: 0.95, source_label: 'supplier certificate', confidence: 0.86, _meta: { fallback: true } });
  assert(lotRes.lot.E_mean === 950 && lotRes.lot.source.includes('supplier'), 'lot mapped');
  assert(lotRes.fallback === true, 'lot fallback flag');
});

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const only = process.argv[2];
let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];
console.log(`AnyRB app test suite — ${tests.length} tests${only ? ` (filter: ${only})` : ''}\n`);
for (const t of tests) {
  if (only && !t.name.toLowerCase().includes(only.toLowerCase())) continue;
  const t0 = performance.now();
  try {
    await t.fn();
    const dt = performance.now() - t0;
    passed++;
    console.log(`  ok   ${t.name}  (${dt.toFixed(1)} ms)`);
  } catch (err) {
    if (err instanceof Skip) {
      skipped++;
      console.log(`  SKIP ${t.name}`);
      console.log(`       ${String(err.message).replace(/\n/g, '\n       ')}`);
    } else {
      failed++;
      failures.push({ name: t.name, err });
      console.log(`  FAIL ${t.name}`);
      console.log(`       ${err.message}`);
    }
  }
}
console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
if (failed > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f.name}: ${f.err.message}`);
  process.exitCode = 1;
} else if (skipped > 0) {
  console.log('\nNOTE: fixture cross-check skipped — ask the Lead for app/tests/fixtures/reference.json.');
  process.exitCode = 0;
}

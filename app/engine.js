/**
 * AnyRB — canonical browser/Node engine for the interactive demo.
 *
 * Dependency-free ES module. No DOM, no network, runs in Node (tests, build
 * checks) and in the browser (bundled into the standalone app).
 *
 * IMPLEMENTS THE FIXED CONTRACT OF PRODUCT_SPEC.md §2.1:
 *   - 2D plane-frame cantilever bracket: 32 nodes (8 × 4), 94 elements
 *     (28 horizontal + 24 vertical + 42 X-braces), fixed at x = 10 mm,
 *     unit total load (1 N) split over the 4 tip nodes at x = 150 mm.
 *   - Element properties from the midpoint of the width field W(x,y):
 *     w = clip(W, 1, 4) mm, A = t·w, I = t·w³/12, W_section = t·w²/6.
 *   - Local stiffness exactly as listed in §2.1, Tᵀ k T transformation.
 *   - N = ½(f[3]−f[0]); M1 = f[2]; M2 = f[5]; end forces from k_local·T·u.
 *   - Demands (§2.1): σ_req, E_req = max(E_req_def, E_req_buck), mass.
 *   - Two-level feedstock model (§3). Reliability P_f is evaluated at LOT
 *     level (CV_lot = lotFraction·CV_preset) unless a measured lot is supplied,
 *     in which case the within-lot level is used.
 *   - Analytic P_f: closed-form bivariate-normal orthant (Drezner quadrature),
 *     plus deterministic seeded Monte-Carlo for distributions/verification.
 *
 * Element/node ordering matches app/tests/fixtures/reference.json exactly.
 * Python canonical engine: engine/anyrb/. Fixture tolerance: deterministic
 * fields 1e-9 relative, reliability 1e-6 absolute.
 */

import { GEOMETRY, DEFAULTS, MATERIAL_PRESETS } from './config.js';

const PI = Math.PI;
const TWO_PI = 2 * PI;
const E_REF = 1; // unit-solve reference modulus (MPa), spec §2.1

// ---------------------------------------------------------------------------
// Small numeric helpers
// ---------------------------------------------------------------------------
export function clamp(x, lo, hi) {
  return x < lo ? lo : x > hi ? hi : x;
}

/** Standard lognormal parameters for a distribution with given mean and CV. */
export function lognormalParams(mean, cv) {
  const c = Math.max(1e-9, cv);
  const s2 = Math.log(1 + c * c);
  return { mu: Math.log(Math.max(1e-12, mean)) - 0.5 * s2, sigma: Math.sqrt(s2), s2 };
}

/** Build an engine material from a preset-like object (config or fixture). */
export function materialFromPreset(p = {}) {
  return normalizeMaterial({
    preset: p.key ?? p.id ?? p.preset,
    E_mean: p.E_mean,
    E_cv: p.E_cv,
    sy_mean: p.sy_mean,
    sy_cv: p.sy_cv,
    rho: p.rho,
    corr: p.corr,
    lotFraction: p.lotFraction ?? p.lot_fraction,
    withinFraction: p.withinFraction ?? p.within_fraction,
  });
}

/** Fill/clamp a partially specified material object. */
export function normalizeMaterial(material = {}) {
  const out = { ...DEFAULTS.material, ...material };
  out.E_mean = Math.max(1, out.E_mean);
  out.sy_mean = Math.max(0.1, out.sy_mean);
  out.E_cv = clamp(out.E_cv, 1e-4, 0.9);
  out.sy_cv = clamp(out.sy_cv, 1e-4, 0.9);
  out.rho = Math.max(0.1, out.rho);
  out.corr = clamp(out.corr, -0.95, 0.95);
  // Lot share of the PRESET CV (0.92195 per research/01). The within-lot share is the
  // complementary variance: CV_within² ≈ CV_total² − CV_lot² ⇒ √(1−f²) = 0.38730.
  const lotF = out.lotFraction ?? out.lot_fraction;
  const withinF = out.withinFraction ?? out.within_fraction;
  out.lotFraction = clamp(lotF ?? DEFAULTS.material.lotFraction ?? 0.8, 0, 0.999);
  out.withinFraction = clamp(
    withinF ?? Math.sqrt(Math.max(0, 1 - out.lotFraction * out.lotFraction)),
    0, 2,
  );
  out.level = out.level || null;
  // v0.4 printed-process + elongation/brittle screen fields
  out.process = out.process || out.print_process || 'FDM/FFF';
  out.printProcessOk = out.printProcessOk ?? out.print_process_ok
    ?? /FDM|FFF/i.test(String(out.process));
  const elongMean = out.elongationMean ?? out.elongation_mean ?? (out.preset === 'rPETG' ? 4.0 : NaN);
  out.elongationMean = Number.isFinite(elongMean) && elongMean > 0 ? elongMean : NaN;
  out.elongationCv = clamp(out.elongationCv ?? out.elongation_cv ?? 0, 0, 2);
  out.elongationLotVarianceFraction = clamp(out.elongationLotVarianceFraction ?? out.elongation_lot_variance_fraction ?? 0.5, 0, 1);
  out.corrEElong = out.corrEElong ?? out.corr_E_elong ?? -0.25;
  return out;
}

// ---------------------------------------------------------------------------
// Standard normal CDF — positive erf series (no cancellation), ~1e-15 accurate.
// ---------------------------------------------------------------------------
/**
 * Upper-tail normal probability 1−Φ(x) for x ≥ 6 (asymptotic series truncated
 * at its smallest term; absolute error ≪1e-17 there).
 */
function normalTail(x) {
  const x2 = x * x;
  let term = 1;
  let sum = 1;
  let prev = Infinity;
  for (let n = 1; n < 80; n++) {
    term *= -(2 * n - 1) / x2;
    if (Math.abs(term) > Math.abs(prev)) break;
    sum += term;
    prev = term;
  }
  return (Math.exp(-0.5 * x2) / Math.sqrt(TWO_PI) / x) * sum;
}

/** Standard normal CDF, accurate over the full range (~1e-15). */
export function normalCDF(x) {
  if (x >= 6) return 1 - normalTail(x);
  if (x <= -6) return normalTail(-x);
  const ax = Math.abs(x) / Math.SQRT2; // erf argument
  const ax2 = ax * ax;
  let term = ax;
  let sum = ax;
  for (let n = 1; n <= 400; n++) {
    term *= (2 * ax2) / (2 * n + 1);
    sum += term;
    if (term < sum * 1e-17) break;
  }
  const erf = (2 / Math.sqrt(PI)) * Math.exp(-ax2) * sum;
  return 0.5 * (1 + (x >= 0 ? erf : -erf));
}

// --- Gauss–Legendre quadrature nodes/weights (cached) ----------------------
const GL_CACHE = new Map();
function gaussLegendre(n) {
  const cached = GL_CACHE.get(n);
  if (cached) return cached;
  const nodes = new Float64Array(n);
  const weights = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let z = Math.cos((PI * (i + 0.75)) / (n + 0.5));
    for (let it = 0; it < 100; it++) {
      let p1 = 1;
      let p2 = 0;
      for (let j = 0; j < n; j++) {
        const p3 = p2;
        p2 = p1;
        p1 = ((2 * j + 1) * z * p2 - j * p3) / (j + 1);
      }
      const pp = (n * (z * p1 - p2)) / (z * z - 1);
      const z1 = z;
      z = z1 - p1 / pp;
      if (Math.abs(z - z1) < 1e-15) break;
    }
    let p1 = 1;
    let p2 = 0;
    for (let j = 0; j < n; j++) {
      const p3 = p2;
      p2 = p1;
      p1 = ((2 * j + 1) * z * p2 - j * p3) / (j + 1);
    }
    const pp = (n * (z * p1 - p2)) / (z * z - 1);
    nodes[i] = z;
    weights[i] = 2 / ((1 - z * z) * pp * pp);
  }
  const gl = { nodes, weights, n };
  GL_CACHE.set(n, gl);
  return gl;
}

/**
 * Drezner's 1-D integral for the standard bivariate normal CDF (r ≥ 0):
 *   Φ₂(a,b;r) = Φ(a)Φ(b) + 1/(2π) ∫₀^{asin r} exp(−(a²+b²−2ab sin t)/(2 cos² t)) dt
 * Quadrature order doubles until the value is stable at ≈3e-14.
 */
function bvnIntegral(a, b, theta, n) {
  const { nodes, weights } = gaussLegendre(n);
  let sum = 0;
  const half = theta * 0.5;
  for (let i = 0; i < n; i++) {
    const t = half * (nodes[i] + 1);
    const ct = Math.cos(t);
    const st = Math.sin(t);
    const expo = -(a * a + b * b - 2 * a * b * st) / (2 * ct * ct);
    sum += weights[i] * Math.exp(expo);
  }
  return (half * sum) / TWO_PI;
}

/** P(Z1 ≤ a, Z2 ≤ b) for a standard bivariate normal with correlation r. */
export function bivariateNormalCDF(a, b, r) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  const rr = clamp(r, -0.999, 0.999);
  if (a <= -12 || b <= -12) return 0; // < 1e-33
  if (a >= 12 && b >= 12) return 1;
  if (a >= 12) return normalCDF(b);
  if (b >= 12) return normalCDF(a);
  if (Math.abs(rr) < 1e-12) return normalCDF(a) * normalCDF(b);
  if (rr < 0) {
    // Φ₂(a,b;r) = Φ(a) − Φ₂(a,−b;−r)
    return clamp(normalCDF(a) - bivariateNormalCDF(a, -b, -rr), 0, 1);
  }
  const theta = Math.asin(rr);
  const base = normalCDF(a) * normalCDF(b);
  let prev = base + bvnIntegral(a, b, theta, 16);
  let n = 16;
  while (n < 512) {
    n *= 2;
    const cur = base + bvnIntegral(a, b, theta, n);
    if (Math.abs(cur - prev) < 3e-14) return clamp(cur, 0, 1);
    prev = cur;
  }
  return clamp(prev, 0, 1);
}

// ---------------------------------------------------------------------------
// 1. Lattice topology (§2.1) — ordering matches the Python fixture exactly:
//    horizontals row-major, verticals row-major, diagonals row-major
//    (ascending diagonal then descending diagonal per cell).
// ---------------------------------------------------------------------------
const NCOLS = GEOMETRY.nx + 1; // 8 node columns
const NROWS = GEOMETRY.ny + 1; // 4 node rows
export const NODE_COUNT = NCOLS * NROWS; // 32
export const DOF_COUNT = 3 * NODE_COUNT; // 96

export function nodeId(i, j) {
  return j * NCOLS + i; // spec: n = j*8 + i
}

export function nodePosition(i, j) {
  return { x: GEOMETRY.padWidth + i * GEOMETRY.cell, y: j * GEOMETRY.cell };
}

function buildTopology() {
  const nodes = [];
  for (let j = 0; j < NROWS; j++) {
    for (let i = 0; i < NCOLS; i++) {
      const p = nodePosition(i, j);
      nodes.push({ n: nodeId(i, j), i, j, x: p.x, y: p.y });
    }
  }
  const elements = [];
  const add = (i1, j1, i2, j2, kind) => {
    const p1 = nodePosition(i1, j1);
    const p2 = nodePosition(i2, j2);
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const L = Math.hypot(dx, dy);
    elements.push({
      id: elements.length,
      i1, j1, i2, j2, kind,
      n1: nodeId(i1, j1),
      n2: nodeId(i2, j2),
      L,
      c: dx / L,
      s: dy / L,
      xm: (p1.x + p2.x) / 2,
      ym: (p1.y + p2.y) / 2,
    });
  };
  for (let j = 0; j < NROWS; j++) {
    for (let i = 0; i < GEOMETRY.nx; i++) add(i, j, i + 1, j, 'h'); // 28
  }
  for (let j = 0; j < GEOMETRY.ny; j++) {
    for (let i = 0; i < NCOLS; i++) add(i, j, i, j + 1, 'v'); // 24
  }
  for (let j = 0; j < GEOMETRY.ny; j++) {
    for (let i = 0; i < GEOMETRY.nx; i++) {
      add(i, j, i + 1, j + 1, 'd+'); // ascending diagonal
      add(i + 1, j, i, j + 1, 'd-'); // descending diagonal
    }
  }
  return { nodes, elements };
}

const TOPOLOGY = buildTopology();
export const MESH_NODES = TOPOLOGY.nodes; // 32 nodes, index = node id
export const MESH_ELEMENTS = TOPOLOGY.elements; // 94 elements
export const N_ELEMENTS = MESH_ELEMENTS.length;

// Fixed DOFs: every DOF of the 4 nodes on x = 10 mm (i = 0).
export const FIXED_DOFS = (() => {
  const dofs = [];
  for (let j = 0; j < NROWS; j++) {
    const n = nodeId(0, j);
    dofs.push(3 * n, 3 * n + 1, 3 * n + 2);
  }
  return dofs;
})();

/** The 4 loaded tip nodes on x = 150 mm (i = nx). */
export const TIP_NODES = (() => {
  const out = [];
  for (let j = 0; j < NROWS; j++) out.push(nodeId(GEOMETRY.nx, j));
  return out;
})();

// ---------------------------------------------------------------------------
// 2. Width-field parameterisation (§2.2)
//   8 control points: x_norm ∈ {0, 1/3, 2/3, 1} × y_norm ∈ {0, 1}
//   values log-width, bilinear to (x,y), clipped to [1,4] mm.
//   Index k = yRow*4 + xIdx, yRow 0 = bottom edge.
// ---------------------------------------------------------------------------
export const CONTROL_X = [0, 1 / 3, 2 / 3, 1];
export const CONTROL_Y = [0, 1];

export function controlPointPosition(k) {
  const yRow = Math.floor(k / 4);
  const xIdx = k % 4;
  return {
    k,
    xNorm: CONTROL_X[xIdx],
    yNorm: CONTROL_Y[yRow],
    x: GEOMETRY.padWidth + CONTROL_X[xIdx] * GEOMETRY.nx * GEOMETRY.cell,
    y: CONTROL_Y[yRow] * GEOMETRY.Ly,
    label: `${(CONTROL_X[xIdx] * GEOMETRY.nx * GEOMETRY.cell).toFixed(1)} mm · ${yRow === 0 ? 'bottom' : 'top'}`,
  };
}

/** Unclipped log-width at a point, then exp + clip (spec §2.2). */
export function widthField(logWidth, x, y) {
  const xn = clamp((x - GEOMETRY.padWidth) / (GEOMETRY.nx * GEOMETRY.cell), 0, 1) * 3;
  const xn0 = Math.min(2, Math.floor(xn));
  const fx = xn - xn0;
  const yn = clamp(y / GEOMETRY.Ly, 0, 1);
  const b = logWidth[xn0] * (1 - fx) + logWidth[xn0 + 1] * fx;
  const t = logWidth[4 + xn0] * (1 - fx) + logWidth[4 + xn0 + 1] * fx;
  const lw = b * (1 - yn) + t * yn;
  return clamp(Math.exp(lw), GEOMETRY.wMin, GEOMETRY.wMax);
}

/** All eight widths in mm (clipped, as the FE sees them). */
export function designWidths(logWidth) {
  return logWidth.map((lw) => clamp(Math.exp(lw), GEOMETRY.wMin, GEOMETRY.wMax));
}

/** Fresh uniform design in log-width space. */
export function uniformDesign(w = 2) {
  const lw = Math.log(clamp(w, GEOMETRY.wMin, GEOMETRY.wMax));
  return new Array(8).fill(lw);
}

/** The 8 element midpoint widths actually used by the FE (fixture `widths_mm`). */
export function elementWidths(logWidth) {
  return MESH_ELEMENTS.map((e) => widthField(logWidth, e.xm, e.ym));
}

/** Uniform width scale for the batch-adaptive recipe (§2.4). */
export function scaleDesign(logWidth, s) {
  return logWidth.map((lw) => lw + Math.log(s));
}

// ---------------------------------------------------------------------------
// 3. Generic 2D plane-frame solver (also used directly by the unit tests)
// ---------------------------------------------------------------------------
/** Local 6×6 stiffness from the four scalars of spec §2.1. */
export function frameLocalStiffness(EA_L, a, b, c, d) {
  const k = new Float64Array(36);
  const set = (i, j, v) => { k[i * 6 + j] = v; };
  set(0, 0, EA_L); set(0, 3, -EA_L);
  set(1, 1, a); set(1, 2, b); set(1, 4, -a); set(1, 5, b);
  set(2, 1, b); set(2, 2, c); set(2, 4, -b); set(2, 5, d);
  set(3, 0, -EA_L); set(3, 3, EA_L);
  set(4, 1, -a); set(4, 2, -b); set(4, 4, a); set(4, 5, -b);
  set(5, 1, b); set(5, 2, d); set(5, 4, -b); set(5, 5, c);
  return k;
}

/** 6×6 transformation T mapping global DOF to local DOF (spec §2.1). */
export function frameTransform(c, s) {
  const T = new Float64Array(36);
  const set = (i, j, v) => { T[i * 6 + j] = v; };
  set(0, 0, c); set(0, 1, s);
  set(1, 0, -s); set(1, 1, c);
  set(2, 2, 1);
  set(3, 3, c); set(3, 4, s);
  set(4, 3, -s); set(4, 4, c);
  set(5, 5, 1);
  return T;
}

function mat6Mul(A, B) {
  const C = new Float64Array(36);
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      let sum = 0;
      for (let k = 0; k < 6; k++) sum += A[i * 6 + k] * B[k * 6 + j];
      C[i * 6 + j] = sum;
    }
  }
  return C;
}

/** Dense Cholesky solve for A x = b (A row-major n×n, SPD); A is destroyed. */
function choleskySolveInPlace(A, b, n) {
  for (let j = 0; j < n; j++) {
    let d = A[j * n + j];
    for (let k = 0; k < j; k++) d -= A[j * n + k] * A[j * n + k];
    if (!(d > 0)) throw new Error('Frame stiffness matrix is not positive definite');
    const Ljj = Math.sqrt(d);
    A[j * n + j] = Ljj;
    for (let i = j + 1; i < n; i++) {
      let sum = A[i * n + j];
      for (let k = 0; k < j; k++) sum -= A[i * n + k] * A[j * n + k];
      A[i * n + j] = sum / Ljj;
    }
  }
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let sum = b[i];
    for (let k = 0; k < i; k++) sum -= A[i * n + k] * y[k];
    y[i] = sum / A[i * n + i];
  }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = y[i];
    for (let k = i + 1; k < n; k++) sum -= A[k * n + i] * x[k];
    x[i] = sum / A[i * n + i];
  }
  return x;
}

/**
 * Solve a 2D plane frame.
 * nodes: [{x,y}]; elements: [{n1,n2,A,I}]; fixedDofs: int[];
 * loads: Float64Array length 3·nodes.length; Eref in MPa.
 * Units: N, mm, MPa. Returns {u, reactions, elementForces}.
 */
export function solveFrame(nodes, elements, fixedDofs, loads, Eref = 1) {
  const nn = nodes.length;
  const ndof = 3 * nn;
  const K = new Float64Array(ndof * ndof);

  for (const el of elements) {
    const p1 = nodes[el.n1];
    const p2 = nodes[el.n2];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const L = Math.hypot(dx, dy);
    const c = dx / L;
    const s = dy / L;
    const EA_L = (Eref * el.A) / L;
    const a = (12 * Eref * el.I) / (L * L * L);
    const b = (6 * Eref * el.I) / (L * L);
    const c4 = (4 * Eref * el.I) / L;
    const d2 = (2 * Eref * el.I) / L;
    const kLocal = frameLocalStiffness(EA_L, a, b, c4, d2);
    const T = frameTransform(c, s);
    const kT = mat6Mul(kLocal, T);
    const kG = new Float64Array(36);
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        let sum = 0;
        for (let m = 0; m < 6; m++) sum += T[m * 6 + i] * kT[m * 6 + j];
        kG[i * 6 + j] = sum;
      }
    }
    el._kLocal = kLocal;
    el._T = T;
    const dofs = [3 * el.n1, 3 * el.n1 + 1, 3 * el.n1 + 2, 3 * el.n2, 3 * el.n2 + 1, 3 * el.n2 + 2];
    for (let i = 0; i < 6; i++) {
      const gi = dofs[i];
      for (let j = 0; j < 6; j++) K[gi * ndof + dofs[j]] += kG[i * 6 + j];
    }
  }

  // Boundary conditions: elimination (exact, no penalty stiffness).
  const fixed = new Uint8Array(ndof);
  for (const d of fixedDofs) fixed[d] = 1;
  const freeMap = new Int32Array(ndof).fill(-1);
  let nf = 0;
  for (let d = 0; d < ndof; d++) if (!fixed[d]) freeMap[d] = nf++;
  const Kf = new Float64Array(nf * nf);
  const ff = new Float64Array(nf);
  for (let i = 0; i < ndof; i++) {
    if (fixed[i]) continue;
    const fi = freeMap[i];
    ff[fi] = loads[i];
    for (let j = 0; j < ndof; j++) {
      if (fixed[j]) continue;
      Kf[fi * nf + freeMap[j]] = K[i * ndof + j];
    }
  }
  const uf = choleskySolveInPlace(Kf, ff, nf);
  const u = new Float64Array(ndof);
  for (let d = 0; d < ndof; d++) if (!fixed[d]) u[d] = uf[freeMap[d]];

  // Reactions: R = K·u − f_ext (residual; non-zero only at fixed DOFs).
  const reactions = new Float64Array(ndof);
  for (let i = 0; i < ndof; i++) {
    let sum = 0;
    const row = i * ndof;
    for (let j = 0; j < ndof; j++) sum += K[row + j] * u[j];
    reactions[i] = sum - loads[i];
  }

  // Element end forces: f_local = k_local · T · u_element.
  const elementForces = elements.map((el) => {
    const dofs = [3 * el.n1, 3 * el.n1 + 1, 3 * el.n1 + 2, 3 * el.n2, 3 * el.n2 + 1, 3 * el.n2 + 2];
    const ue = new Float64Array(6);
    for (let i = 0; i < 6; i++) ue[i] = u[dofs[i]];
    const ul = new Float64Array(6);
    for (let i = 0; i < 6; i++) {
      let sum = 0;
      for (let j = 0; j < 6; j++) sum += el._T[i * 6 + j] * ue[j];
      ul[i] = sum;
    }
    const fl = new Float64Array(6);
    for (let i = 0; i < 6; i++) {
      let sum = 0;
      for (let j = 0; j < 6; j++) sum += el._kLocal[i * 6 + j] * ul[j];
      fl[i] = sum;
    }
    return fl;
  });

  return { u, reactions, elementForces, ndof };
}

// ---------------------------------------------------------------------------
// 4. Lattice model + unit-load analysis (§2.1)
// ---------------------------------------------------------------------------
/** Build the lattice FE model for a design (unit total load 1 N). */
export function buildLatticeModel(logWidth) {
  const elements = MESH_ELEMENTS.map((e) => {
    const w = widthField(logWidth, e.xm, e.ym);
    const A = GEOMETRY.depth * w;
    const I = (GEOMETRY.depth * w * w * w) / 12;
    const Wsec = (GEOMETRY.depth * w * w) / 6;
    return { ...e, w, A, I, Wsec };
  });
  const loads = new Float64Array(DOF_COUNT);
  const perNode = -1 / TIP_NODES.length; // unit total load, −y
  for (const n of TIP_NODES) loads[3 * n + 1] = perNode;
  const nodes = MESH_NODES.map((n) => ({ x: n.x, y: n.y }));
  return { nodes, elements, loads, fixedDofs: FIXED_DOFS.slice() };
}

/**
 * Unit-load solve: total F = 1 N, E = E_REF = 1 MPa.
 * Returns tip deflection, per-element end forces and the unit response fields
 * used by the demand formulas of §2.1.
 */
export function unitLoadSolve(logWidth) {
  const model = buildLatticeModel(logWidth);
  const solution = solveFrame(model.nodes, model.elements, model.fixedDofs, model.loads, E_REF);
  let uTipUnit = 0;
  for (const n of TIP_NODES) uTipUnit = Math.max(uTipUnit, Math.abs(solution.u[3 * n + 1]));
  const responses = model.elements.map((el, idx) => {
    const fl = solution.elementForces[idx];
    const nUnit = 0.5 * (fl[3] - fl[0]);
    const m1Unit = fl[2];
    const m2Unit = fl[5];
    const sigmaCoeff = Math.abs(nUnit) / el.A + Math.max(Math.abs(m1Unit), Math.abs(m2Unit)) / el.Wsec;
    const buckCoeff = nUnit < 0 ? (Math.abs(nUnit) * el.L * el.L) / (PI * PI * el.I) : 0;
    return { ...el, nUnit, m1Unit, m2Unit, sigmaCoeff, buckCoeff };
  });
  let maxSigmaCoeff = 0;
  let maxBuckCoeff = 0;
  let maxSigmaElement = -1;
  let maxBuckElement = -1;
  for (let i = 0; i < responses.length; i++) {
    if (responses[i].sigmaCoeff > maxSigmaCoeff) {
      maxSigmaCoeff = responses[i].sigmaCoeff;
      maxSigmaElement = i;
    }
    if (responses[i].buckCoeff > maxBuckCoeff) {
      maxBuckCoeff = responses[i].buckCoeff;
      maxBuckElement = i;
    }
  }
  return { model, solution, responses, uTipUnit, maxSigmaCoeff, maxBuckCoeff, maxSigmaElement, maxBuckElement };
}

/** Member forces under the unit load, in fixture array form. */
export function memberForcesUnitLoad(logWidth) {
  const unit = unitLoadSolve(logWidth);
  return {
    N: unit.responses.map((e) => e.nUnit),
    M1: unit.responses.map((e) => e.m1Unit),
    M2: unit.responses.map((e) => e.m2Unit),
    u_tip: unit.uTipUnit,
    u: unit.solution.u,
  };
}

/**
 * Full analysis of a lattice design: FE + demand formulas + mass.
 * opts: {F, uLim, rho}
 */
export function analyzeLattice(logWidth, opts = {}) {
  const F = opts.F ?? DEFAULTS.F;
  const uLim = opts.uLim ?? GEOMETRY.uLim;
  const rho = opts.rho ?? DEFAULTS.material.rho;
  const computePrinted = opts.printed !== false;
  const unit = unitLoadSolve(logWidth);

  const sigma_y_req = F * unit.maxSigmaCoeff; // MPa
  const E_req_def = (F * unit.uTipUnit * E_REF) / uLim; // MPa
  const E_req_buck = F * unit.maxBuckCoeff; // MPa
  const E_req = Math.max(E_req_def, E_req_buck);

  let strutVolume = 0;
  for (const el of unit.responses) strutVolume += el.A * el.L;
  const totalVolume = strutVolume + GEOMETRY.padVolume;
  const mass_g = (rho * totalVolume) / 1000; // analytic upper bound, g
  const printedVolume = computePrinted ? printedVolumeMm3(logWidth) : null;
  const printed_mass_g = computePrinted ? (rho * printedVolume) / 1000 : null;

  const widthsMm = unit.responses.map((e) => e.w);
  const sigmaElem = unit.responses.map((e) => F * e.sigmaCoeff);
  return {
    kind: 'lattice',
    designLogWidth: logWidth.slice(),
    elements: unit.responses,
    nodes: unit.model.nodes,
    uUnit: unit.solution.u,
    uTipUnit: unit.uTipUnit,
    widthsMm,
    sigmaElem,
    F,
    uLim,
    rho,
    demands: {
      sigma_y_req,
      E_req,
      E_req_def,
      E_req_buck,
      sigma_coeff: unit.maxSigmaCoeff,
      buck_coeff: unit.maxBuckCoeff,
    },
    maxSigmaElement: unit.maxSigmaElement,
    maxBuckElement: unit.maxBuckElement,
    volumes: { struts_mm3: strutVolume, pad_mm3: GEOMETRY.padVolume, total_mm3: totalVolume },
    mass_g,
    mass_analytic_g: mass_g,
    printed_mass_g,
    printed_volume_mm3: printedVolume,
    widthStats: {
      min: Math.min(...widthsMm),
      max: Math.max(...widthsMm),
      mean: widthsMm.reduce((a, b) => a + b, 0) / widthsMm.length,
    },
    deflectionScale: F * unit.uTipUnit, // mm·MPa: u = deflectionScale / E
    stiffnessScale: F * unit.uTipUnit * E_REF, // MPa·mm: E_req_def = stiffnessScale / u_lim
  };
}

// ---------------------------------------------------------------------------
// 4b. Solid-plate baseline (§2.3 baseline 1)
//     Analytical Euler–Bernoulli cantilever: L = 140 mm, I = t·Ly³/12.
//     No slender lattice members → no Euler buckling demand (E_req_buck = 0);
//     out-of-plane plate buckling is not modelled in v0.1 (stated in README).
// ---------------------------------------------------------------------------
export const SOLID_BASELINE = {
  note: 'Analytical Euler–Bernoulli cantilever plate (no lattice); Euler buckling not applicable (E_req_buck = 0); out-of-plane buckling not modelled in v0.1.',
  source: 'Beam theory: u = FL³/(3EI), σ = Mc/I, I = t·Ly³/12, c = Ly/2',
};

export function analyzeSolid(opts = {}) {
  const F = opts.F ?? DEFAULTS.F;
  const uLim = opts.uLim ?? GEOMETRY.uLim;
  const rho = opts.rho ?? DEFAULTS.material.rho;
  const L = GEOMETRY.Lx - GEOMETRY.padWidth; // 140 mm cantilever span
  const I = (GEOMETRY.depth * Math.pow(GEOMETRY.Ly, 3)) / 12; // 180,000 mm⁴
  const c = GEOMETRY.Ly / 2;
  const uTipUnit = (L * L * L) / (3 * I); // mm at 1 N, 1 MPa
  const sigmaCoeff = (L * c) / I; // MPa at 1 N
  const sigma_y_req = F * sigmaCoeff;
  const E_req_def = (F * uTipUnit) / uLim;
  const E_req_buck = 0;
  const E_req = Math.max(E_req_def, E_req_buck);
  const volume = GEOMETRY.Lx * GEOMETRY.Ly * GEOMETRY.depth; // 90,000 mm³
  return {
    kind: 'solid',
    designLogWidth: null,
    elements: [],
    nodes: null,
    uTipUnit,
    F,
    uLim,
    rho,
    demands: { sigma_y_req, E_req, E_req_def, E_req_buck, sigma_coeff: sigmaCoeff, buck_coeff: 0 },
    volumes: { struts_mm3: volume - GEOMETRY.padVolume, pad_mm3: GEOMETRY.padVolume, total_mm3: volume },
    mass_g: (rho * volume) / 1000,
    mass_analytic_g: (rho * volume) / 1000,
    printed_mass_g: (rho * volume) / 1000,
    printed_volume_mm3: volume,
    printability: { pass: true, max_neighbour_width_ratio: 1, max_slenderness: 0, warnNeighbour: false, warnSlenderness: false },
    widthStats: { min: GEOMETRY.Ly, max: GEOMETRY.Ly, mean: GEOMETRY.Ly },
    widthsMm: [],
    sigmaElem: [],
    maxSigmaElement: -1,
    maxBuckElement: -1,
    deflectionScale: F * uTipUnit,
    stiffnessScale: F * uTipUnit * E_REF,
    solidInfo: SOLID_BASELINE,
  };
}

// ---------------------------------------------------------------------------
// 5. Reliability
//    Distribution levels (§3):
//      'lot'    — CV_lot = lotFraction·CV_preset      (default for P_f)
//      'within' — CV_within = withinFraction·CV_preset (measured lot supplied)
//      'total'  — CV_preset                            (full part-to-part view)
// ---------------------------------------------------------------------------
export const LEVELS = { LOT: 'lot', WITHIN: 'within', TOTAL: 'total' };

/**
 * Material distribution at a given statistical level (mean preserved).
 *   'lot'    — CV_lot = lotFraction · CV_total (linear in CV; canonical
 *              Python-engine convention, reproduces the fixture P_f exactly).
 *   'within' — complementary VARIANCE: s_within² = (1 − f²)·s_total², exposed
 *              as a CV via √(expm1(s_within²)); with f = 0.92195 ≈0.387·CV.
 *   'total'  — the preset CV itself (full part-to-part view).
 */
export function levelMaterial(materialIn, level = 'lot') {
  const m = normalizeMaterial(materialIn);
  if (level === 'total') return { ...m, level };
  if (level === 'within') {
    const ep = lognormalParams(m.E_mean, m.E_cv);
    const sp = lognormalParams(m.sy_mean, m.sy_cv);
    const comp = Math.max(0, 1 - m.lotFraction * m.lotFraction);
    return {
      ...m,
      E_cv: Math.sqrt(Math.expm1(comp * ep.s2)),
      sy_cv: Math.sqrt(Math.expm1(comp * sp.s2)),
      level,
    };
  }
  return { ...m, E_cv: m.E_cv * m.lotFraction, sy_cv: m.sy_cv * m.lotFraction, level };
}

/** Material for a specific measured lot: mean shifted, within-lot scatter. */
export function withinLotMaterial(materialIn, lotMeanE, lotMeanSy) {
  const m = normalizeMaterial(materialIn);
  const within = levelMaterial(m, 'within');
  return { ...within, E_mean: lotMeanE, sy_mean: lotMeanSy };
}

/** CV decomposition reported in the feedstock panel. */
export function twoLevelCVs(materialIn) {
  const m = normalizeMaterial(materialIn);
  const lot = levelMaterial(m, 'lot');
  const within = levelMaterial(m, 'within');
  return {
    lotFraction: m.lotFraction,
    withinFraction: m.withinFraction,
    E: { total: m.E_cv, lot: lot.E_cv, within: within.E_cv },
    sy: { total: m.sy_cv, lot: lot.sy_cv, within: within.sy_cv },
    approxTotalE: Math.hypot(lot.E_cv, within.E_cv),
    approxTotalSy: Math.hypot(lot.sy_cv, within.sy_cv),
  };
}

/**
 * Closed-form P_f for a material distribution given demand thresholds.
 * Failure event: σy_batch < σy_req OR E_batch < E_req.
 * With zE = (ln E_req − μ_E)/s_E and zS = (ln σy_req − μ_σ)/s_σ:
 *   P_f = Φ(zE) + Φ(zS) − Φ₂(zE, zS; ρ)       (inclusion–exclusion)
 * Exactly equivalent to 1 − Φ₂(−zE, −zS; ρ); the explicit form is used here
 * to match the canonical Python engine's closed form.
 */
export function pfFromThresholds(sigma_y_req, E_req, materialIn) {
  let material = normalizeMaterial(materialIn);
  // Canonical convention: a bare material object (no `level`) is evaluated at
  // LOT level (CV_lot = lotFraction·CV_preset). Pass a levelMaterial(...) result
  // to evaluate a specific level exactly as given.
  if (!material.level) material = levelMaterial(material, 'lot');
  const reqS = Math.max(0, sigma_y_req);
  const reqE = Math.max(0, E_req);
  const ep = lognormalParams(material.E_mean, material.E_cv);
  const sp = lognormalParams(material.sy_mean, material.sy_cv);
  const r = material.corr;

  if (reqS <= 0 && reqE <= 0) return 0;
  if (reqS <= 0) {
    const zE = (Math.log(reqE) - ep.mu) / ep.sigma;
    return clamp(1 - normalCDF(-zE), 0, 1);
  }
  if (reqE <= 0) {
    const zS = (Math.log(reqS) - sp.mu) / sp.sigma;
    return clamp(1 - normalCDF(-zS), 0, 1);
  }
  const zE = (Math.log(reqE) - ep.mu) / ep.sigma;
  const zS = (Math.log(reqS) - sp.mu) / sp.sigma;
  return clamp(normalCDF(zE) + normalCDF(zS) - bivariateNormalCDF(zE, zS, r), 0, 1);
}

/** P_f for an analysed design against a material distribution at `level`. */
export function probabilityOfFailure(analysis, material, level = 'lot') {
  return pfFromThresholds(analysis.demands.sigma_y_req, analysis.demands.E_req, levelMaterial(material, level));
}

/**
 * Per-mode marginal failure probabilities and demand/mean ratios.
 * `governing` = mode with the largest marginal probability (ties within 1.2×
 * are reported as 'mixed').
 */
export function failureModes(analysis, material, level = 'lot') {
  const m = levelMaterial(material, level);
  const ep = lognormalParams(m.E_mean, m.E_cv);
  const sp = lognormalParams(m.sy_mean, m.sy_cv);
  const { sigma_y_req, E_req_def, E_req_buck } = analysis.demands;
  const zS = (Math.log(sigma_y_req) - sp.mu) / sp.sigma;
  const zEdef = (Math.log(Math.max(1e-12, E_req_def)) - ep.mu) / ep.sigma;
  const zEbuck = E_req_buck > 0 ? (Math.log(E_req_buck) - ep.mu) / ep.sigma : Infinity;
  const pYield = normalCDF(zS);
  const pDeflection = normalCDF(zEdef);
  const pBuckling = E_req_buck > 0 ? normalCDF(zEbuck) : 0;
  const ratios = {
    yield: sigma_y_req / m.sy_mean,
    buckling: E_req_buck / m.E_mean,
    deflection: E_req_def / m.E_mean,
  };
  const probs = { yield: pYield, buckling: pBuckling, deflection: pDeflection };
  const entries = Object.entries(probs).sort((a, b) => b[1] - a[1]);
  const [topName, topP] = entries[0];
  const secondName = entries[1][0];
  const tied = entries[1][1] * 1.2 > topP;
  const label = (name) => (name === 'buckling' ? 'Euler buckling' : name === 'deflection' ? 'deflection limit' : 'yield');
  const isStiffness = (name) => name === 'buckling' || name === 'deflection';
  const stiffnessPair = isStiffness(topName) && isStiffness(secondName);
  return {
    probabilities: probs,
    ratios,
    governing: tied ? (stiffnessPair ? 'stiffness' : 'mixed') : topName,
    governingLabel: tied
      ? (stiffnessPair
        ? `stiffness (${label(topName)} + ${label(secondName)})`
        : `mixed (${label(topName)} + ${label(secondName)})`)
      : label(topName),
    level,
  };
}

/** Deflection at the tip for a batch modulus E (mm). */
export function deflectionAtE(analysis, E) {
  return analysis.deflectionScale / Math.max(1e-9, E);
}

/** Actual nodal displacements for a batch modulus E (mm, rad). */
export function nodeDisplacements(analysis, E) {
  const scale = analysis.F / Math.max(1e-9, E); // u_actual = F·u_unit / E
  const out = new Float64Array(analysis.uUnit.length);
  for (let i = 0; i < out.length; i++) out[i] = analysis.uUnit[i] * scale;
  return out;
}

/**
 * Printability checks of spec §2.2 — REPORTED, never enforced:
 *   - maximum width ratio between struts that share a node (guideline ≤ 1.5)
 *   - maximum slenderness L_e/w_e (guideline ≤ 30)
 *   - minimum strut width used by the FE.
 */
// ---------------------------------------------------------------------------
// v0.3: deterministic printed/union mass (voxel union) — mirrors Python
// `engine/anyrb/lattice.py::printed_volume_mm3`.
// Grid: res 0.25 mm, margin 4 mm; pad [0,10]x[0,60]x[-5,5]; every strut is a
// box along its full length with width w_e and depth t. All struts span the full
// depth, so the union is a 2-D occupancy raster x depth.
// ---------------------------------------------------------------------------
export const PRINTED_MASS = {
  samples: 60000,      // Halton quasi-Monte-Carlo samples (deterministic)
  margin: 4.0,         // bbox margin around the part, mm
  note: 'Deterministic Halton quasi-Monte-Carlo union (60,000 samples, bases 2/3/5) of the strut boxes plus the wall pad. The analytic mass is a conservative upper bound.',
};

// Halton sequence in [0,1) — cached per (n, base); identical to the Python engine.
const HALTON_CACHE = new Map();
export function halton(n, base) {
  const key = n + ':' + base;
  const cached = HALTON_CACHE.get(key);
  if (cached) return cached;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let f = 1.0;
    let r = 0.0;
    let k = i + 1;
    while (k > 0) {
      f /= base;
      r += f * (k % base);
      k = Math.floor(k / base);
    }
    out[i] = r;
  }
  HALTON_CACHE.set(key, out);
  return out;
}

/**
 * Deterministic printed/union volume (mm^3): Halton QMC over the bbox
 * [-4,154] x [-4,64] x [-5,5]; a sample is inside if it falls in any strut box
 * (0 <= along <= L, |perp| <= w/2, full depth) or in the wall pad.
 * Mirrors Python `lattice.py::printed_volume_mm3` exactly (same sequence).
 */
export function printedVolumeMm3(logWidth, opts = {}) {
  const n = opts.n ?? PRINTED_MASS.samples;
  const margin = opts.margin ?? PRINTED_MASS.margin;
  const hx = halton(n, 2);
  const hy = halton(n, 3);
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  const inside = new Uint8Array(n);
  const spanX = GEOMETRY.Lx + 2 * margin;
  const spanY = GEOMETRY.Ly + 2 * margin;
  for (let i = 0; i < n; i++) {
    xs[i] = -margin + hx[i] * spanX;
    ys[i] = -margin + hy[i] * spanY;
  }
  // wall pad [0,10] x [0,60], full depth
  for (let i = 0; i < n; i++) {
    if (xs[i] >= 0 && xs[i] <= GEOMETRY.padWidth && ys[i] >= 0 && ys[i] <= GEOMETRY.Ly) inside[i] = 1;
  }
  for (const el of MESH_ELEMENTS) {
    const w = widthField(logWidth, el.xm, el.ym);
    const n1 = MESH_NODES[el.n1];
    const n2 = MESH_NODES[el.n2];
    const c1x = n1.x;
    const c1y = n1.y;
    const dx = n2.x - n1.x;
    const dy = n2.y - n1.y;
    const L = Math.hypot(dx, dy);
    if (L <= 1e-12) continue;
    const ux = dx / L;
    const uy = dy / L;
    const px = -uy;
    const py = ux;
    const hw = w / 2;
    // bbox quick reject per sample (keeps the 5.6M-sample-element loop cheap)
    const xmin = Math.min(c1x, c1x + dx) - hw - 1;
    const xmax = Math.max(c1x, c1x + dx) + hw + 1;
    const ymin = Math.min(c1y, c1y + dy) - hw - 1;
    const ymax = Math.max(c1y, c1y + dy) + hw + 1;
    for (let i = 0; i < n; i++) {
      const X = xs[i];
      const Y = ys[i];
      if (X < xmin || X > xmax || Y < ymin || Y > ymax) continue;
      const rx = X - c1x;
      const ry = Y - c1y;
      const along = rx * ux + ry * uy;
      if (along < 0 || along > L) continue;
      const perp = rx * px + ry * py;
      if (Math.abs(perp) <= hw) inside[i] = 1;
    }
  }
  let count = 0;
  for (let i = 0; i < n; i++) count += inside[i];
  const bboxVolume = spanX * spanY * GEOMETRY.depth;
  return (count / n) * bboxVolume;
}

export function printedMassG(logWidth, rho, opts = {}) {
  return (rho * printedVolumeMm3(logWidth, opts)) / 1000;
}

export function printabilityReport(analysis) {
  if (!analysis || analysis.kind !== 'lattice' || !analysis.designLogWidth) return null;
  const elements = analysis.elements;
  let minWidth = Infinity;
  let maxSlenderness = 0;
  for (const el of elements) {
    if (el.w < minWidth) minWidth = el.w;
    const sl = el.L / Math.max(1e-9, el.w);
    if (sl > maxSlenderness) maxSlenderness = sl;
  }
  // Max width ratio across consecutive FE elements INCLUDING the wrap between
  // the last and first element (Python: np.roll(widths, 1)).
  let maxNeighbourRatio = 1;
  const nW = elements.length;
  for (let i = 0; i < nW; i++) {
    const a = elements[i].w;
    const b = elements[(i + 1) % nW].w;
    const r = Math.max(a, b) / Math.max(1e-9, Math.min(a, b));
    if (r > maxNeighbourRatio) maxNeighbourRatio = r;
  }
  const neighbourGuideline = 1.5;
  const slendernessGuideline = 30;
  const warnNeighbour = maxNeighbourRatio > neighbourGuideline;
  const warnSlenderness = maxSlenderness > slendernessGuideline;
  const maxWidth = elements.reduce((mx, el) => Math.max(mx, el.w), -Infinity);
  return {
    min_width_mm: minWidth,
    max_width_mm: maxWidth,
    max_slenderness: maxSlenderness,
    max_neighbour_width_ratio: maxNeighbourRatio,
    out_of_bounds: minWidth < GEOMETRY.wMin - 1e-9 || maxWidth > GEOMETRY.wMax + 1e-9,
    minWidth,
    maxWidth,
    maxSlenderness,
    maxNeighbourRatio,
    neighbourGuideline,
    slendernessGuideline,
    warnNeighbour,
    warnSlenderness,
    pass: !warnNeighbour && !warnSlenderness,
  };
}

/**
 * Known lot with measurement uncertainty retained (mirrors Python
 * `Material.lot_from_measurement`): within-lot CV and measurement CV combine in
 * quadrature; the lot-to-lot fraction is set to zero.
 */
export function lotFromMeasurement(materialIn, E_measured, sy_measured, measurementCv = 0.12) {
  const m = normalizeMaterial(materialIn);
  const eWithin = m.E_cv * m.withinFraction;
  const sWithin = m.sy_cv * m.withinFraction;
  const elongWithin = m.elongationCv * Math.sqrt(Math.max(1 - m.elongationLotVarianceFraction, 0));
  const eCv = Math.sqrt(Math.max(eWithin * eWithin + measurementCv * measurementCv, 1e-12));
  const sCv = Math.sqrt(Math.max(sWithin * sWithin + measurementCv * measurementCv, 1e-12));
  return {
    ...m,
    id: (m.preset || 'material') + '-measured',
    E_mean: Number.isFinite(E_measured) ? E_measured : m.E_mean,
    E_cv: eCv,
    sy_mean: Number.isFinite(sy_measured) ? sy_measured : m.sy_mean,
    sy_cv: sCv,
    elongationCv: Number.isFinite(m.elongationMean)
      ? Math.sqrt(Math.max(elongWithin * elongWithin + measurementCv * measurementCv, 1e-12))
      : m.elongationCv,
    lotFraction: 0,
    withinFraction: 1,
    measurementCv,
    level: 'within',
  };
}

/**
 * Marginal brittle-lot screen: P(elongation-at-break < strain demand), exactly
 * mirroring Python `reliability.failure_probability_elongation`.
 * Reported SEPARATELY from the headline two-property P_f (corr assumed -0.25).
 */
export function failureProbabilityElongation(materialIn, strainDemand, level = 'lot') {
  const m = normalizeMaterial(materialIn);
  if (!Number.isFinite(m.elongationMean) || m.elongationMean <= 0) return NaN;
  let f;
  if (level === 'total') f = 1.0;
  else if (m.lotFraction <= 1e-12) f = 1.0; // measured lot: elongationCv already within+measurement
  else if (level === 'within') f = Math.sqrt(Math.max(1 - m.elongationLotVarianceFraction, 0));
  else f = Math.sqrt(Math.max(m.elongationLotVarianceFraction, 0));
  const cv = m.elongationCv * f;
  const mean = m.elongationMean / 100;
  const demand = Math.max(strainDemand, 1e-12);
  if (cv <= 0) return demand >= mean ? 1 : 0;
  const p = lognormalParams(mean, cv);
  return clamp(normalCDF((Math.log(demand) - p.mu) / p.sigma), 0, 1);
}

/**
 * Assumption sensitivity (mirrors Python `reliability.assumption_bounds`):
 * corr(lnE, lnσy) 0.30/0.70 and lot-vs-within split 75/95 %.
 */
export function assumptionBounds(materialIn, sigmaReq, Ereq, level = 'lot') {
  const m = normalizeMaterial(materialIn);
  const corrRange = [0.30, 0.70].map((corr) => ({
    corr,
    pf: pfFromThresholds(sigmaReq, Ereq, levelMaterial({ ...m, corr }, level)),
  }));
  const splitRange = [0.75, 0.95].map((lotFraction) => ({
    lotFraction,
    pf: pfFromThresholds(sigmaReq, Ereq, levelMaterial({
      ...m,
      lotFraction,
      withinFraction: Math.sqrt(Math.max(1 - lotFraction * lotFraction, 0)),
    }, level)),
  }));
  const vals = corrRange.concat(splitRange).map((x) => x.pf);
  return {
    corr_range: corrRange,
    split_range: splitRange,
    pf_min: Math.min(...vals),
    pf_max: Math.max(...vals),
    note: 'Unmeasured assumptions (correlation and lot/within split) — assumption sensitivity, not validation.',
  };
}

/** Brittle-lot fields attached to an analysed design (Python `evaluate` fields). */
export function brittleScreen(analysis, materialIn, level = 'lot') {
  const m = normalizeMaterial(materialIn);
  const pf = probabilityOfFailure(analysis, m, level);
  const strainReq = analysis.demands.sigma_y_req / Math.max(m.E_mean, 1e-9);
  const pfBrittle = failureProbabilityElongation(m, strainReq, level);
  return {
    strain_req: strainReq,
    strain_req_pct: strainReq * 100,
    elongation_mean_pct: m.elongationMean,
    elongation_cv: m.elongationCv,
    corr_E_elong_assumed: m.corrEElong,
    pf_brittle: pfBrittle,
    pf_brittle_bound: Number.isFinite(pfBrittle) ? pf + pfBrittle : pf,
    brittle_ok: Number.isFinite(pfBrittle) ? pfBrittle <= 0.01 : null,
    brittle_threshold: 0.01,
    brittle_included_in_headline: false,
    note: 'Marginal brittle-lot screen at mean-E strain; add-on ESTIMATE, not a formal upper bound; not included in the headline two-property P_f because the E–elongation correlation is assumed (-0.25). Screen threshold fixed at 1 %.',
  };
}

/** Family feasibility gate: widest printable uniform lattice vs target. */
export function familyFeasibility(materialIn, opts = {}) {
  const material = normalizeMaterial(materialIn);
  const targetPf = opts.targetPf ?? DEFAULTS.targetPf;
  if (!material.printProcessOk) {
    return {
      feasible: false,
      process_ok: false,
      reason: 'process_mismatch',
      detail: `material data is for '${material.process}', not FDM/FFF; a printed lattice cannot use moulded-property data`,
      min_achievable_pf: null,
      max_width_mm: GEOMETRY.wMax,
      target_pf: targetPf,
      material,
    };
  }
  const analysis = analyzeLattice(uniformDesign(GEOMETRY.wMax), {
    F: opts.F ?? DEFAULTS.F,
    uLim: opts.uLim ?? GEOMETRY.uLim,
    rho: material.rho,
    printed: false,
  });
  const pf = probabilityOfFailure(analysis, material, 'lot');
  return {
    feasible: pf <= targetPf,
    min_achievable_pf: pf,
    sigma_req_MPa: analysis.demands.sigma_y_req,
    E_req_MPa: analysis.demands.E_req,
    max_width_mm: GEOMETRY.wMax,
    target_pf: targetPf,
    process_ok: true,
    analysis,
  };
}

/** Advisory sustained-load / creep bound (not the design allowables). */
export function sustainedBound(analysis, materialIn, opts = {}) {
  const material = normalizeMaterial(materialIn);
  const creepFactor = opts.creepFactor ?? 2.0;
  const compressionFactor = opts.compressionFactor ?? 0.8;
  const E_req_bound_MPa = analysis.demands.E_req * creepFactor;
  const sigma_req_bound_MPa = analysis.demands.sigma_y_req / Math.max(compressionFactor, 1e-6);
  const pf_bound = pfFromThresholds(sigma_req_bound_MPa, E_req_bound_MPa, levelMaterial(material, 'lot'));
  const deflection_bound_mm = (analysis.deflectionScale / Math.max(material.E_mean, 1e-9)) * creepFactor;
  return {
    pf_bound,
    E_req_bound_MPa,
    sigma_req_bound_MPa,
    deflection_bound_mm,
    creep_factor: creepFactor,
    compression_factor: compressionFactor,
    note: 'Advisory bound: sustained load (creep x2.0) plus compression knock-down (x0.8) — not the static design allowables; not qualified for sustained load if the bound fails.',
  };
}

/** Utilisation σ_e/σy_ref per element (for canvas colouring). */
export function elementUtilisation(analysis, syRef) {
  const s = Math.max(1e-9, syRef);
  return analysis.sigmaElem.map((sigma) => sigma / s);
}

// ---------------------------------------------------------------------------
// 6. Seeded RNG + two-level batch sampling (§3)
// ---------------------------------------------------------------------------
/** mulberry32 — small, fast, deterministic 32-bit PRNG. */
export function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic correlated standard-normal pair (Box–Muller + Cholesky). */
export function correlatedNormalPair(rng, r = 0) {
  let u1 = rng();
  if (u1 < 1e-12) u1 = 1e-12;
  const u2 = rng();
  const rad = Math.sqrt(-2 * Math.log(u1));
  const z1 = rad * Math.cos(TWO_PI * u2);
  const z2 = rad * Math.sin(TWO_PI * u2);
  const rr = clamp(r, -0.999, 0.999);
  return [z1, rr * z1 + Math.sqrt(1 - rr * rr) * z2];
}

/**
 * Draw n samples from the lognormal bivariate batch distribution at a given
 * level (default 'lot'). Marginals carry mean (μ_E, μ_σy), CVs at that level,
 * and correlation corr(ln E, ln σy).
 */
export function sampleAtLevel(materialIn, level, rng, nSamples) {
  const m = levelMaterial(materialIn, level);
  const ep = lognormalParams(m.E_mean, m.E_cv);
  const sp = lognormalParams(m.sy_mean, m.sy_cv);
  const E = new Float64Array(nSamples);
  const sy = new Float64Array(nSamples);
  for (let i = 0; i < nSamples; i++) {
    const [z1, z2] = correlatedNormalPair(rng, m.corr);
    E[i] = Math.exp(ep.mu + ep.sigma * z1);
    sy[i] = Math.exp(sp.mu + sp.sigma * z2);
  }
  return { E, sy, level, nSamples, material: m };
}

/**
 * Two-level synthetic batch for the feedstock preview (§3):
 *   lot means from the LOT-level distribution, specimens within each lot from
 *   the within-lot distribution. Used to visualise the decomposition; the
 *   reliability gauge itself is lot-level (spec §3).
 */
export function sampleTwoLevel(materialIn, rng, nLots = DEFAULTS.nLots, nWithin = DEFAULTS.nWithin) {
  const m = normalizeMaterial(materialIn);
  const lotMat = levelMaterial(m, 'lot');
  const withinMat = levelMaterial(m, 'within');
  const epL = lognormalParams(lotMat.E_mean, lotMat.E_cv);
  const spL = lognormalParams(lotMat.sy_mean, lotMat.sy_cv);
  const epW = lognormalParams(withinMat.E_mean, withinMat.E_cv);
  const spW = lognormalParams(withinMat.sy_mean, withinMat.sy_cv);
  const lotE = new Float64Array(nLots);
  const lotSy = new Float64Array(nLots);
  const specimenE = new Float64Array(nLots * nWithin);
  const specimenSy = new Float64Array(nLots * nWithin);
  const lotOf = new Uint16Array(nLots * nWithin);
  let k = 0;
  for (let l = 0; l < nLots; l++) {
    const [z1, z2] = correlatedNormalPair(rng, m.corr);
    const meanE = Math.exp(epL.mu + epL.sigma * z1);
    const meanS = Math.exp(spL.mu + spL.sigma * z2);
    lotE[l] = meanE;
    lotSy[l] = meanS;
    for (let i = 0; i < nWithin; i++) {
      const [w1, w2] = correlatedNormalPair(rng, m.corr);
      specimenE[k] = meanE * Math.exp(-0.5 * epW.s2 + epW.sigma * w1);
      specimenSy[k] = meanS * Math.exp(-0.5 * spW.s2 + spW.sigma * w2);
      lotOf[k] = l;
      k++;
    }
  }
  return { lotE, lotSy, specimenE, specimenSy, lotOf, nLots, nWithin };
}

// ---------------------------------------------------------------------------
// 7. Batch metrics (§4) — Monte-Carlo over the LOT-level distribution
// ---------------------------------------------------------------------------
function percentileSorted(sorted, q) {
  if (sorted.length === 0) return NaN;
  const pos = clamp(q, 0, 1) * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const w = pos - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

/** Monte-Carlo metrics of a design over the lot-level batch distribution. */
export function batchMetrics(analysis, materialIn, opts = {}) {
  const material = normalizeMaterial(materialIn);
  const seed = (opts.seed ?? DEFAULTS.seed) >>> 0;
  const nSamples = opts.nSamples ?? DEFAULTS.nMc;
  const rng = mulberry32(seed);
  const batch = sampleAtLevel(material, 'lot', rng, nSamples);
  const reqS = analysis.demands.sigma_y_req;
  const reqE = analysis.demands.E_req;
  const reqBuck = analysis.demands.E_req_buck;
  const margin = new Float64Array(nSamples);
  const defl = new Float64Array(nSamples);
  const fail = new Uint8Array(nSamples);
  let nFail = 0;
  let nFailYield = 0;
  let nFailBuck = 0;
  let nFailDef = 0;
  let marginSum = 0;
  let deflSum = 0;
  let deflMax = -Infinity;
  for (let i = 0; i < nSamples; i++) {
    const e = batch.E[i];
    const s = batch.sy[i];
    const m = Math.min(s / reqS, e / reqE); // capacity margin (§4)
    const u = analysis.deflectionScale / e;
    margin[i] = m;
    defl[i] = u;
    marginSum += m;
    deflSum += u;
    if (u > deflMax) deflMax = u;
    const failY = s < reqS;
    const failB = reqBuck > 0 && e < reqBuck;
    const failD = e < analysis.demands.E_req_def;
    if (failY) nFailYield++;
    if (failB) nFailBuck++;
    if (failD) nFailDef++;
    if (failY || failB || failD) {
      fail[i] = 1;
      nFail++;
    }
  }
  const pfMc = nFail / nSamples;
  const pfMcStdErr = Math.sqrt(Math.max(0, pfMc * (1 - pfMc)) / nSamples);

  const sortedMargin = Float64Array.from(margin).sort();
  const sortedDefl = Float64Array.from(defl).sort();
  const marginMean = marginSum / nSamples;
  const marginP5 = percentileSorted(sortedMargin, 0.05);

  // Monte-Carlo convergence check (§7): P_f from the first 1,000 samples.
  const nCheck = Math.min(nSamples, 1000);
  let nFailCheck = 0;
  for (let i = 0; i < nCheck; i++) if (fail[i]) nFailCheck++;
  const pfMcCheck = nFailCheck / nCheck;
  const pfMcCheckStdErr = Math.sqrt(Math.max(0, pfMcCheck * (1 - pfMcCheck)) / nCheck);

  // Worst-case batch: 1st percentile of capacity margin (§4).
  const order = Array.from({ length: nSamples }, (_, i) => i).sort((a, b) => margin[a] - margin[b]);
  const worstIdx = order[Math.max(0, Math.floor(0.01 * (nSamples - 1)))];

  return {
    seed,
    nSamples,
    level: 'lot',
    pfMc,
    pfMcStdErr,
    pfMcCheck,
    pfMcCheckStdErr,
    nCheck,
    failureCounts: { yield: nFailYield, buckling: nFailBuck, deflection: nFailDef, union: nFail },
    margin: {
      mean: marginMean,
      p5: marginP5,
      p50: percentileSorted(sortedMargin, 0.5),
      robustnessIndex: marginMean > 0 ? marginP5 / marginMean : NaN,
      min: sortedMargin[0],
    },
    deflection: { mean: deflSum / nSamples, p95: percentileSorted(sortedDefl, 0.95), max: deflMax },
    worstCase: {
      E: batch.E[worstIdx],
      sy: batch.sy[worstIdx],
      margin: margin[worstIdx],
      percentile: 0.01,
      deflection: defl[worstIdx],
    },
    samples: { E: batch.E, sy: batch.sy, margin, deflection: defl, fail },
  };
}

/**
 * Full metrics report for one design + material (§4): analytic P_f (primary),
 * seeded Monte-Carlo distributions, failure-mode split, and conversion checks.
 */
export function reliabilityReport(analysis, materialIn, opts = {}) {
  const material = normalizeMaterial(materialIn);
  const pfAnalytic = probabilityOfFailure(analysis, material, 'lot');
  const mc = batchMetrics(analysis, material, opts);
  const modes = failureModes(analysis, material, 'lot');
  return {
    pfAnalytic,
    reliability: 1 - pfAnalytic,
    pfTotalLevel: probabilityOfFailure(analysis, material, 'total'),
    mc,
    modes,
    material,
    level: 'lot',
    seed: mc.seed,
    nSamples: mc.nSamples,
    deflectionAtMeanE: deflectionAtE(analysis, material.E_mean),
    withinLotCVs: twoLevelCVs(material),
    targetPf: opts.targetPf ?? DEFAULTS.targetPf,
  };
}

// Preset catalogue re-export for convenience in the UI/build.
export { MATERIAL_PRESETS, GEOMETRY, DEFAULTS };

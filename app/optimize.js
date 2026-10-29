/**
 * AnyRB — robust optimiser, baseline strategies, batch-adaptive recipe,
 * acceptance window and sensitivity (PRODUCT_SPEC.md §2.3, §2.4, §4).
 *
 * All objectives are deterministic (no hidden RNG); the reliability used by
 * the optimiser is the analytic lot-level P_f from engine.js, so repeated runs
 * with the same inputs give identical results.
 *
 * Baselines (§2.3, updated spec):
 *   solid          monolithic 150×60×10 plate (analytical cantilever)
 *   uniform        uniform lattice sized to meet the reliability target
 *   uniform_match  uniform lattice whose mass equals the robust optimum
 *   nominal_sf15   geometry minimised for the MEAN material at FoS 1.5
 *   mean_only      geometry that just passes for the MEAN material (FoS 1.0)
 *   robust         geometry optimised for the reliability target (this file)
 *
 * Optimiser: deterministic pattern search (coordinate descent with shrinking
 * step, plus all-coordinate and root/tip pattern moves) on the §2.3 penalty
 *   score = mass · (1 + 100 · max(0, (P_f − target)/target)).
 */

import { GEOMETRY, DEFAULTS, OPTIMIZER } from './config.js';
import {
  analyzeLattice,
  analyzeSolid,
  probabilityOfFailure,
  pfFromThresholds,
  levelMaterial,
  withinLotMaterial,
  normalizeMaterial,
  uniformDesign,
  scaleDesign,
  designWidths,
  controlPointPosition,
  clamp,
  MATERIAL_PRESETS,
} from './engine.js';

export const LOGW_MIN = Math.log(GEOMETRY.wMin);
export const LOGW_MAX = Math.log(GEOMETRY.wMax);
const LOG10 = Math.log(10);

/** Build the context object used by every analysis call. */
export function makeContext(opts = {}) {
  return {
    F: opts.F ?? DEFAULTS.F,
    uLim: opts.uLim ?? GEOMETRY.uLim,
    rho: opts.rho ?? DEFAULTS.material.rho,
  };
}

function clampDesign(design) {
  return design.map((lw) => clamp(lw, LOGW_MIN, LOGW_MAX));
}

function logwFromWidth(w) {
  return Math.log(clamp(w, GEOMETRY.wMin, GEOMETRY.wMax));
}

// ---------------------------------------------------------------------------
// 1. Objective functions
// ---------------------------------------------------------------------------
/** §2.3 robust objective: mass penalised by reliability-target violation. */
export function robustObjective(materialIn, ctx, targetPf) {
  const material = normalizeMaterial(materialIn);
  return function objective(designIn) {
    const design = clampDesign(designIn);
    const analysis = analyzeLattice(design, ctx);
    const pf = probabilityOfFailure(analysis, material, 'lot');
    const violation = Math.max(0, (pf - targetPf) / targetPf);
    return {
      value: analysis.mass_g * (1 + OPTIMIZER.penaltyFactor * violation),
      mass: analysis.mass_g,
      pf,
      analysis,
      violation,
      design,
    };
  };
}

/**
 * Deterministic mean-material objective with factor of safety `fos`:
 * require σy_mean ≥ fos·σ_req and E_mean ≥ fos·E_req.
 */
export function deterministicObjective(materialIn, ctx, fos) {
  const material = normalizeMaterial(materialIn);
  return function objective(designIn) {
    const design = clampDesign(designIn);
    const analysis = analyzeLattice(design, ctx);
    const penY = Math.max(0, (fos * analysis.demands.sigma_y_req) / material.sy_mean - 1);
    const penE = Math.max(0, (fos * analysis.demands.E_req) / material.E_mean - 1);
    return {
      value: analysis.mass_g * (1 + OPTIMIZER.penaltyFactor * (penY + penE)),
      mass: analysis.mass_g,
      feasible: penY <= 0 && penE <= 0,
      analysis,
      penY,
      penE,
      design,
    };
  };
}

// ---------------------------------------------------------------------------
// 2. Deterministic pattern search (generator: yields progress for the UI)
// ---------------------------------------------------------------------------
const PATTERN_MOVES = [
  [1, 1, 1, 1, 1, 1, 1, 1],
  [-1, -1, -1, -1, -1, -1, -1, -1],
  [1, 1, 1, 1, -1, -1, -1, -1], // root heavier / tip lighter
  [-1, -1, -1, -1, 1, 1, 1, 1],
  [1, -1, 1, -1, 1, -1, 1, -1], // alternating
];

/**
 * `objective(design) -> {value, ...}`. `x0` is 8 log-widths.
 * Yields progress objects; returns {design, value, evals}.
 */
export function* patternSearchGen(objective, x0, opts = {}) {
  const steps = opts.steps ?? OPTIMIZER.stepSchedule;
  const maxEvals = opts.maxEvals ?? OPTIMIZER.maxEvals;
  const minStep = opts.minStep ?? OPTIMIZER.minStep;
  let x = clampDesign(x0.slice());
  let evals = 1;
  let cur = objective(x);
  let best = { design: x.slice(), value: cur.value };
  if (cur.feasible !== undefined && cur.feasible) best = { design: x.slice(), value: cur.value };
  let iter = 0;

  for (const step of steps) {
    if (step < minStep || evals >= maxEvals) break;
    let improved = true;
    let sweeps = 0;
    while (improved && evals < maxEvals) {
      improved = false;
      sweeps++;
      // coordinate moves
      for (let i = 0; i < 8 && evals < maxEvals; i++) {
        for (const dir of [1, -1]) {
          const trial = x.slice();
          trial[i] = clamp(trial[i] + dir * step, LOGW_MIN, LOGW_MAX);
          if (Math.abs(trial[i] - x[i]) < 1e-12) continue;
          const r = objective(trial);
          evals++;
          if (r.value < cur.value - 1e-12) {
            x = trial;
            cur = r;
            improved = true;
            if (r.value < best.value) best = { design: x.slice(), value: r.value };
            yield {
              evals, step, iter: ++iter, accepted: true, coord: i,
              currentScore: cur.value, bestScore: best.value,
              currentMass: cur.mass, currentPf: cur.pf,
            };
            break;
          }
        }
      }
      // pattern moves when no single coordinate helped this sweep
      if (!improved) {
        for (const dirs of PATTERN_MOVES) {
          const trial = x.map((v, i) => clamp(v + dirs[i] * step, LOGW_MIN, LOGW_MAX));
          if (trial.every((v, i) => Math.abs(v - x[i]) < 1e-12)) continue;
          const r = objective(trial);
          evals++;
          if (r.value < cur.value - 1e-12) {
            x = trial;
            cur = r;
            improved = true;
            if (r.value < best.value) best = { design: x.slice(), value: r.value };
            yield {
              evals, step, iter: ++iter, accepted: true, coord: -1,
              currentScore: cur.value, bestScore: best.value,
              currentMass: cur.mass, currentPf: cur.pf,
            };
            break;
          }
        }
      }
      if (sweeps > 25) break;
    }
    yield {
      evals, step, iter: ++iter, accepted: false, stage: 'shrink',
      currentScore: cur.value, bestScore: best.value,
      currentMass: cur.mass, currentPf: cur.pf,
    };
  }
  return { design: best.design, value: best.value, evals, iterations: iter, objective };
}

/** Consume a generator synchronously (used by tests and the compare pipeline). */
function runGen(gen) {
  let r = gen.next();
  while (!r.done) r = gen.next();
  return r.value;
}

// ---------------------------------------------------------------------------
// 3. Feasible starting designs
// ---------------------------------------------------------------------------
/** Smallest uniform width whose robustness objective has no target violation. */
export function feasibleUniformStart(material, ctx, targetPf) {
  const objective = robustObjective(material, ctx, targetPf);
  const check = (lw) => objective(uniformDesign(Math.exp(lw))).pf <= targetPf;
  if (check(LOGW_MAX)) {
    let lo = LOGW_MIN;
    let hi = LOGW_MAX;
    for (let i = 0; i < OPTIMIZER.uniformBisectionIters; i++) {
      const mid = 0.5 * (lo + hi);
      if (check(mid)) hi = mid;
      else lo = mid;
      if (hi - lo < 1e-7) break;
    }
    return uniformDesign(Math.exp(hi));
  }
  // Even the widest lattice misses the target: start from the widest design.
  return uniformDesign(GEOMETRY.wMax);
}

function feasibleDeterministicStart(material, ctx, fos) {
  const objective = deterministicObjective(material, ctx, fos);
  const check = (lw) => {
    const r = objective(uniformDesign(Math.exp(lw)));
    return r.penY <= 1e-9 && r.penE <= 1e-9;
  };
  if (check(LOGW_MAX)) {
    let lo = LOGW_MIN;
    let hi = LOGW_MAX;
    for (let i = 0; i < OPTIMIZER.uniformBisectionIters; i++) {
      const mid = 0.5 * (lo + hi);
      if (check(mid)) hi = mid;
      else lo = mid;
      if (hi - lo < 1e-7) break;
    }
    return uniformDesign(Math.exp(hi));
  }
  return uniformDesign(GEOMETRY.wMax);
}

// ---------------------------------------------------------------------------
// 4. Optimisation — deterministic MULTI-START pattern search
//    Six uniform-width starts: the smallest uniform width that meets the
//    target, plus OPTIMIZER.startWidths (2.0, 2.2, 2.5, 3.0, 3.6 mm). Every
//    start runs the same deterministic pattern search; the lowest feasible
//    score wins (tie-break: lower mass). This removes single-start dependence.
// ---------------------------------------------------------------------------
/** Six starts for the robust objective (smallest feasible uniform first). */
export function multiStartWidths(materialIn, ctx, targetPf) {
  const first = Math.exp(feasibleUniformStart(materialIn, ctx, targetPf)[0]);
  return [first, ...OPTIMIZER.startWidths];
}

/** Six starts for the deterministic mean-material objective. */
export function multiStartWidthsDeterministic(materialIn, ctx, fos) {
  const first = Math.exp(feasibleDeterministicStart(materialIn, ctx, fos)[0]);
  return [first, ...OPTIMIZER.startWidths];
}

function bestOfStarts(results) {
  const feasible = results.filter((r) => r.feasible);
  const pool = (feasible.length ? feasible : results).slice();
  pool.sort((a, b) => (a.score - b.score) || (a.mass - b.mass));
  return pool[0];
}

function summarizeStarts(results) {
  return results.map((r) => ({
    startWidth: r.startWidth,
    mass: r.mass,
    pf: Number.isFinite(r.pf) ? r.pf : null,
    feasible: r.feasible,
    score: r.score,
    evals: r.evals,
  }));
}

/**
 * Robust design: minimise mass s.t. P_f(lot level) ≤ target, from six starts.
 * Generator variant yields per-start and per-move progress for the UI.
 */
export function* robustOptimizeGen(materialIn, ctx, opts = {}) {
  const material = normalizeMaterial(materialIn);
  const targetPf = opts.targetPf ?? DEFAULTS.targetPf;
  const objective = robustObjective(material, ctx, targetPf);
  const startWidths = opts.startWidths ? opts.startWidths.slice() : multiStartWidths(material, ctx, targetPf);
  const total = startWidths.length;
  const results = [];
  let totalEvals = 0;
  for (let si = 0; si < total; si++) {
    const w = startWidths[si];
    const startDesign = uniformDesign(w);
    const startEval = objective(startDesign);
    yield {
      stage: 'start', startIndex: si, startsTotal: total, startWidth: w,
      startMass: startEval.mass, startPf: startEval.pf, startFeasible: startEval.pf <= targetPf,
    };
    const search = patternSearchGen(objective, startDesign, opts);
    let step = search.next();
    while (!step.done) {
      yield { stage: 'search', startIndex: si, startsTotal: total, startWidth: w, ...step.value };
      step = search.next();
    }
    const res = step.value;
    const analysis = analyzeLattice(res.design, ctx);
    const pf = probabilityOfFailure(analysis, material, 'lot');
    totalEvals += res.evals;
    const entry = {
      startWidth: w, startDesign, design: res.design, score: res.value,
      mass: analysis.mass_g, pf, feasible: pf <= targetPf, evals: res.evals,
    };
    results.push(entry);
    yield {
      stage: 'start-done', startIndex: si, startsTotal: total, startWidth: w,
      mass: entry.mass, pf: entry.pf, feasible: entry.feasible, evals: res.evals,
      bestMass: Math.min(...results.map((r) => r.mass)),
    };
  }
  const winner = bestOfStarts(results);
  const analysis = analyzeLattice(winner.design, ctx);
  const pf = probabilityOfFailure(analysis, material, 'lot');
  return {
    design: winner.design,
    analysis,
    pf,
    mass: analysis.mass_g,
    evals: totalEvals,
    targetPf,
    startDesign: winner.startDesign,
    startWidth: winner.startWidth,
    starts: summarizeStarts(results),
    feasible: pf <= targetPf,
    material,
  };
}

/** Synchronous robust multi-start optimisation. */
export function robustOptimize(materialIn, ctx, opts = {}) {
  return runGen(robustOptimizeGen(materialIn, ctx, opts));
}

/**
 * Mean-material optimisation with a deterministic factor of safety, using the
 * same six uniform-width starts (lowest objective value without violation wins).
 */
export function* nominalOptimizeGen(materialIn, ctx, opts = {}) {
  const material = normalizeMaterial(materialIn);
  const fos = opts.fos ?? OPTIMIZER.nominalFoS;
  const objective = deterministicObjective(material, ctx, fos);
  const startWidths = opts.startWidths
    ? opts.startWidths.slice()
    : multiStartWidthsDeterministic(material, ctx, fos);
  const total = startWidths.length;
  const results = [];
  let totalEvals = 0;
  for (let si = 0; si < total; si++) {
    const w = startWidths[si];
    const startDesign = uniformDesign(w);
    yield {
      stage: 'start', startIndex: si, startsTotal: total, startWidth: w,
      startMass: objective(startDesign).mass,
    };
    const search = patternSearchGen(objective, startDesign, opts);
    let step = search.next();
    while (!step.done) {
      yield { stage: 'search', startIndex: si, startsTotal: total, startWidth: w, ...step.value };
      step = search.next();
    }
    const res = step.value;
    const evaluation = res.analysis ? objective(res.design) : objective(res.design);
    const analysis = evaluation.analysis;
    totalEvals += res.evals;
    results.push({
      startWidth: w, startDesign, design: res.design, score: res.value,
      mass: analysis.mass_g, feasible: !!(evaluation.feasible), evals: res.evals,
    });
    yield {
      stage: 'start-done', startIndex: si, startsTotal: total, startWidth: w,
      mass: analysis.mass_g, feasible: !!(evaluation.feasible), evals: res.evals,
    };
  }
  const winner = bestOfStarts(results);
  const analysis = analyzeLattice(winner.design, ctx);
  const pf = probabilityOfFailure(analysis, material, 'lot');
  const feasibleMean = (fos * analysis.demands.sigma_y_req <= material.sy_mean * (1 + 1e-9))
    && (fos * analysis.demands.E_req <= material.E_mean * (1 + 1e-9));
  return {
    design: winner.design,
    analysis,
    pf,
    mass: analysis.mass_g,
    evals: totalEvals,
    fos,
    feasibleMean,
    targetPf: opts.targetPf ?? DEFAULTS.targetPf,
    startWidth: winner.startWidth,
    starts: summarizeStarts(results),
    material,
  };
}

export function nominalOptimize(materialIn, ctx, opts = {}) {
  return runGen(nominalOptimizeGen(materialIn, ctx, opts));
}

// ---------------------------------------------------------------------------
// 5. Baseline strategies (§2.3)
// ---------------------------------------------------------------------------
/** Solid plate baseline. */
export function solidBaseline(materialIn, ctx, targetPf = DEFAULTS.targetPf) {
  const material = normalizeMaterial(materialIn);
  const analysis = analyzeSolid(ctx);
  const pf = probabilityOfFailure(analysis, material, 'lot');
  return summarize('solid', 'Solid plate', analysis, material, pf, targetPf, {
    note: 'Monolithic 150×60×10 mm plate — heavy but reliable.',
  });
}

/** Uniform lattice sized to just meet the reliability target. */
export function uniformTargetBaseline(materialIn, ctx, targetPf = DEFAULTS.targetPf) {
  const material = normalizeMaterial(materialIn);
  const pfAt = (lw) => {
    const analysis = analyzeLattice(uniformDesign(Math.exp(lw)), ctx);
    return { analysis, pf: probabilityOfFailure(analysis, material, 'lot') };
  };
  let lo = LOGW_MIN;
  let hi = LOGW_MAX;
  let atHi = pfAt(hi);
  let feasible = atHi.pf <= targetPf;
  if (feasible) {
    for (let i = 0; i < OPTIMIZER.uniformBisectionIters; i++) {
      const mid = 0.5 * (lo + hi);
      if (pfAt(mid).pf <= targetPf) hi = mid;
      else lo = mid;
      if (hi - lo < 1e-7) break;
    }
  }
  const res = pfAt(hi);
  const row = summarize('uniform', 'Uniform (target-sized)', res.analysis, material, res.pf, targetPf, {
    note: 'All control points equal; smallest width meeting the reliability target.',
    design: uniformDesign(Math.exp(hi)),
    feasible,
    widthMm: Math.exp(hi),
  });
  return row;
}

/** Uniform lattice whose mass equals a target mass (same-mass comparison). */
export function uniformMassMatchBaseline(materialIn, ctx, targetMass, targetPf = DEFAULTS.targetPf) {
  const material = normalizeMaterial(materialIn);
  const analysisAt = (w) => analyzeLattice(uniformDesign(w), ctx);
  let lo = LOGW_MIN;
  let hi = LOGW_MAX;
  const massLo = analysisAt(Math.exp(lo)).mass_g;
  const massHi = analysisAt(Math.exp(hi)).mass_g;
  const clamped = clamp(targetMass, massLo, massHi);
  if (massLo >= massHi) {
    const a = analysisAt(Math.exp(LOGW_MIN));
    return summarize('uniform_match', 'Uniform (mass-matched)', a, material, probabilityOfFailure(a, material, 'lot'), targetPf, {
      note: 'Mass-matched comparison unavailable (mass not monotone).',
      feasible: false,
    });
  }
  // bisection on mass (monotone increasing with width)
  for (let i = 0; i < OPTIMIZER.uniformBisectionIters; i++) {
    const mid = 0.5 * (lo + hi);
    if (analysisAt(Math.exp(mid)).mass_g < clamped) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-7) break;
  }
  const analysis = analysisAt(Math.exp(hi));
  const pf = probabilityOfFailure(analysis, material, 'lot');
  return summarize('uniform_match', 'Uniform (mass-matched)', analysis, material, pf, targetPf, {
    note: `Same mass as robust optimum (${clamped.toFixed(2)} g); reliability collapses — the mass/reliability trade-off is steep — very sensitive near the buckling-controlled sizing cliff; illustrative, not a general prediction.`,
    feasible: pf <= targetPf,
    design: uniformDesign(Math.exp(hi)),
    widthMm: Math.exp(hi),
    matchedMass: clamped,
  });
}

/** Nominal mean-material design with deterministic FoS 1.5. */
export function nominalBaseline(materialIn, ctx, opts = {}) {
  const material = normalizeMaterial(materialIn);
  const targetPf = opts.targetPf ?? DEFAULTS.targetPf;
  const opt = nominalOptimize(material, ctx, { ...opts, fos: OPTIMIZER.nominalFoS });
  return summarize('nominal_sf15', 'Nominal-opt (FoS 1.5)', opt.analysis, material, opt.pf, targetPf, {
    note: 'Designed for mean material at FoS 1.5, then judged on the batch distribution.',
    design: opt.design,
    feasible: opt.pf <= targetPf,
    meta: { mass: opt.mass, fos: OPTIMIZER.nominalFoS },
  });
}

/** Mean-only design: just passes for the mean material (FoS 1.0). */
export function meanOnlyBaseline(materialIn, ctx, opts = {}) {
  const material = normalizeMaterial(materialIn);
  const targetPf = opts.targetPf ?? DEFAULTS.targetPf;
  const opt = nominalOptimize(material, ctx, { ...opts, fos: 1.0 });
  return summarize('mean_only', 'Mean-only (FoS 1.0)', opt.analysis, material, opt.pf, targetPf, {
    note: 'Cheapest design that just survives at the mean material — 50 % failure risk type.',
    design: opt.design,
    feasible: opt.pf <= targetPf,
    meta: { mass: opt.mass },
  });
}

function summarize(key, label, analysis, material, pf, targetPf, extra = {}) {
  const row = {
    key,
    label,
    design: extra.design ?? analysis.designLogWidth ?? null,
    mass_g: analysis.mass_g,
    pf,
    reliability: 1 - pf,
    feasible: extra.feasible ?? pf <= targetPf,
    targetPf,
    sigma_y_req: analysis.demands.sigma_y_req,
    E_req: analysis.demands.E_req,
    E_req_def: analysis.demands.E_req_def,
    E_req_buck: analysis.demands.E_req_buck,
    u_tip_unit: analysis.uTipUnit,
    defl_at_mean_E: analysis.deflectionScale / Math.max(1e-9, material.E_mean),
    note: extra.note ?? '',
    widthMm: extra.widthMm ?? null,
    analysis,
    ...extra,
  };
  // deflection at the material mean is filled by compareStrategies (needs E_mean)
  return row;
}

// ---------------------------------------------------------------------------
// 6. Full comparison + Pareto data
// ---------------------------------------------------------------------------
/**
 * Runs all six strategies and returns a comparison table plus Pareto data.
 * Generator: yields {stage, label} progress so the UI can stay responsive;
 * returns the complete result. (Robust first because uniform_match needs it.)
 */
export function* compareStrategiesGen(materialIn, ctx, opts = {}) {
  const material = normalizeMaterial(materialIn);
  const targetPf = opts.targetPf ?? DEFAULTS.targetPf;

  yield { stage: 'solid', label: 'Evaluating solid plate', completed: 0, total: 6 };
  const solid = solidBaseline(material, ctx, targetPf);

  yield { stage: 'uniform', label: 'Sizing uniform lattice', completed: 1, total: 6 };
  const uniform = uniformTargetBaseline(material, ctx, targetPf);

  yield { stage: 'robust', label: 'Optimising for the batch distribution', completed: 2, total: 6 };
  const robust = robustOptimize(material, ctx, { targetPf });
  const robustRow = summarize('robust', 'Robust-opt', robust.analysis, material, robust.pf, targetPf, {
    note: 'Minimises mass subject to P_f ≤ target across the lot-level distribution.',
    design: robust.design,
    feasible: robust.pf <= targetPf,
    meta: { mass: robust.mass, evals: robust.evals },
  });

  yield { stage: 'uniform_match', label: 'Mass-matching the uniform lattice', completed: 3, total: 6 };
  const uniformMatch = uniformMassMatchBaseline(material, ctx, robust.mass, targetPf);

  yield { stage: 'nominal_sf15', label: 'Optimising for the mean material (FoS 1.5)', completed: 4, total: 6 };
  const nominal = nominalBaseline(material, ctx, { targetPf, maxEvals: opts.maxEvals });

  yield { stage: 'mean_only', label: 'Optimising for the mean material (FoS 1.0)', completed: 5, total: 6 };
  const meanOnly = meanOnlyBaseline(material, ctx, { targetPf, maxEvals: opts.maxEvals });

  const rows = [solid, uniform, uniformMatch, nominal, meanOnly, robustRow];
  for (const row of rows) delete row.analysis;

  // Pareto: mass vs reliability for the uniform family, plus strategy points.
  const paretoUniform = [];
  const nSweep = 26;
  for (let i = 0; i < nSweep; i++) {
    const w = GEOMETRY.wMin + ((GEOMETRY.wMax - GEOMETRY.wMin) * i) / (nSweep - 1);
    const a = analyzeLattice(uniformDesign(w), ctx);
    const pf = probabilityOfFailure(a, material, 'lot');
    paretoUniform.push({ widthMm: w, mass_g: a.mass_g, pf, reliability: 1 - pf });
  }
  yield { stage: 'done', label: 'Comparison complete', completed: 6, total: 6 };
  return {
    material,
    targetPf,
    rows,
    pareto: {
      uniform: paretoUniform,
      strategies: rows.map((r) => ({ key: r.key, label: r.label, mass_g: r.mass_g, reliability: r.reliability, pf: r.pf })),
    },
    robust: {
      design: robust.design,
      mass: robust.mass,
      pf: robust.pf,
      evals: robust.evals,
    },
    solid,
    uniform,
    uniformMatch,
    nominal,
    meanOnly,
    robustRow,
  };
}

export function compareStrategies(materialIn, ctx, opts = {}) {
  return runGen(compareStrategiesGen(materialIn, ctx, opts));
}

// ---------------------------------------------------------------------------
// 7. Batch-adaptive recipe (§2.4)
// ---------------------------------------------------------------------------
/**
 * Smallest uniform width scale s ∈ [1, 1.5] such that the (scaled) design
 * meets the reliability target for the measured lot. The lot is described by
 * its measured mean σy (quality index q) and optionally mean E; the remaining
 * uncertainty is the within-lot distribution.
 */
export function batchAdaptiveScale(designIn, materialIn, lot, ctx, opts = {}) {
  const material = normalizeMaterial(materialIn);
  const targetPf = opts.targetPf ?? DEFAULTS.targetPf;
  const design = clampDesign(designIn);
  const lotMeanE = lot.E ?? material.E_mean;
  const lotMeanSy = lot.sy ?? material.sy_mean;
  const lotMaterial = withinLotMaterial(material, lotMeanE, lotMeanSy);
  const pfAtScale = (s) => {
    const scaled = clampDesign(scaleDesign(design, s));
    const analysis = analyzeLattice(scaled, ctx);
    return {
      analysis,
      pf: pfFromThresholds(analysis.demands.sigma_y_req, analysis.demands.E_req, lotMaterial),
      s,
    };
  };
  const base = pfAtScale(1.0);
  let best = null;
  if (base.pf <= targetPf) {
    best = base;
  } else {
    const atMax = pfAtScale(OPTIMIZER.scaleMax);
    if (atMax.pf <= targetPf) {
      let lo = OPTIMIZER.scaleMin;
      let hi = OPTIMIZER.scaleMax;
      for (let i = 0; i < 80; i++) {
        const mid = 0.5 * (lo + hi);
        if (pfAtScale(mid).pf <= targetPf) hi = mid;
        else lo = mid;
        if (hi - lo < 1e-5) break;
      }
      best = pfAtScale(hi);
    }
  }
  const addedMassPct = best ? ((best.analysis.mass_g - base.analysis.mass_g) / base.analysis.mass_g) * 100 : null;
  let verdict;
  if (!best) verdict = 'reject';
  else if (best.s <= 1.0 + 1e-9) verdict = 'pass_no_compensation';
  else if (best.s <= OPTIMIZER.scalePass) verdict = 'pass';
  else verdict = 'conditional';
  return {
    scale: best ? best.s : null,
    scaleMax: OPTIMIZER.scaleMax,
    achieved: best ? best.pf : atMaxPfSafe(pfAtScale),
    targetPf,
    basePf: base.pf,
    addedMassPct,
    mass_g: base.analysis.mass_g,
    massScaled_g: best ? best.analysis.mass_g : null,
    verdict,
    verdictLabel: verdictLabel(verdict),
    lotMeanE,
    lotMeanSy,
    lotMaterial,
    design,
    scaledDesign: best ? best.analysis.designLogWidth : null,
    analysis: best ? best.analysis : base.analysis,
  };
}

function atMaxPfSafe(pfAtScale) {
  try {
    return pfAtScale(OPTIMIZER.scaleMax).pf;
  } catch (e) {
    return NaN;
  }
}

function verdictLabel(verdict) {
  switch (verdict) {
    case 'pass_no_compensation': return 'PASS — no compensation needed';
    case 'pass': return 'PASS — scale up and print';
    case 'conditional': return 'CONDITIONAL PASS — scale near the limit';
    default: return 'REJECT / REROUTE — cannot compensate within +50 % width';
  }
}

/**
 * Batch acceptance window (§2.4/§4): for each lot mean E, the minimum lot mean
 * σy such that the design meets the target given within-lot scatter.
 * Returns points in (E, σy) and quality-index q = σy/σy_reference.
 */
export function acceptanceWindow(analysis, materialIn, opts = {}) {
  const material = normalizeMaterial(materialIn);
  const targetPf = opts.targetPf ?? DEFAULTS.targetPf;
  const reqS = analysis.demands.sigma_y_req;
  const reqE = analysis.demands.E_req;
  const nPoints = opts.nPoints ?? 41;
  const eLoRatio = opts.eLoRatio ?? 0.5;
  const eHiRatio = opts.eHiRatio ?? 1.5;
  const syLo = material.sy_mean * 0.15;
  const syHi = material.sy_mean * 2.6;
  const points = [];
  for (let i = 0; i < nPoints; i++) {
    const eRatio = eLoRatio + ((eHiRatio - eLoRatio) * i) / (nPoints - 1);
    const lotE = material.E_mean * eRatio;
    const pfAt = (lotSy) => pfFromThresholds(
      reqS, reqE,
      withinLotMaterial(material, lotE, lotSy),
    );
    const pLo = pfAt(syLo);
    const pHi = pfAt(syHi);
    let minSy = NaN;
    let feasible = true;
    if (pLo <= targetPf) {
      minSy = syLo;
    } else if (pHi > targetPf) {
      feasible = false;
    } else {
      let lo = Math.log(syLo);
      let hi = Math.log(syHi);
      for (let k = 0; k < 60; k++) {
        const mid = 0.5 * (lo + hi);
        if (pfAt(Math.exp(mid)) <= targetPf) hi = mid;
        else lo = mid;
        if (hi - lo < 1e-7) break;
      }
      minSy = Math.exp(hi);
    }
    points.push({
      E: lotE,
      E_ratio: eRatio,
      sy: minSy,
      q: minSy / material.sy_mean,
      feasible,
    });
  }
  return {
    points,
    targetPf,
    material,
    reference: { E_mean: material.E_mean, sy_mean: material.sy_mean },
    demands: { sigma_y_req: reqS, E_req: reqE },
    lotMeanE0: material.E_mean,
    lotMeanSy0: material.sy_mean,
  };
}

// ---------------------------------------------------------------------------
// 8. Sensitivity ∂P_f/∂θ (finite differences, analytic P_f)
// ---------------------------------------------------------------------------
const WIDTH_LABELS = [
  'w @ x=10 · bottom', 'w @ x=56.7 · bottom', 'w @ x=103.3 · bottom', 'w @ x=150 · bottom',
  'w @ x=10 · top', 'w @ x=56.7 · top', 'w @ x=103.3 · top', 'w @ x=150 · top',
];

/**
 * Finite-difference sensitivities of the analytic lot-level P_f:
 *   CV(E) +10 % rel · CV(σy) +10 % rel · corr +0.10 abs · F +10 % rel ·
 *   each design control point +10 % width.
 */
export function sensitivity(analysis, materialIn, ctx, opts = {}) {
  const material = normalizeMaterial(materialIn);
  const levelMat = levelMaterial(material, 'lot');
  const pfOf = (analysisIn, mat = levelMat) => pfFromThresholds(
    analysisIn.demands.sigma_y_req, analysisIn.demands.E_req, mat,
  );
  const base = probabilityOfFailure(analysis, material, 'lot');
  const items = [];
  const push = (key, label, detail, pf, extra = {}) => {
    items.push({
      key, label, detail, pf,
      delta: pf - base,
      deltaPp: (pf - base) * 100,
      relative: base > 0 ? (pf - base) / base : NaN,
      ...extra,
    });
  };
  push('cvE', 'CV(E)', '+10 % relative', pfOf(analysis, { ...levelMat, E_cv: levelMat.E_cv * 1.1 }));
  push('cvSy', 'CV(σy)', '+10 % relative', pfOf(analysis, { ...levelMat, sy_cv: levelMat.sy_cv * 1.1 }));
  push('corr', 'corr(ln E, ln σy)', '+0.10 absolute', pfOf(analysis, { ...levelMat, corr: clamp(levelMat.corr + 0.1, -0.95, 0.95) }));
  {
    const ctxF = { ...ctx, F: ctx.F * 1.1 };
    const aF = analyzeLattice(analysis.designLogWidth, ctxF);
    push('F', 'Load F', '+10 % relative', pfOf(aF), { analysis: aF });
  }
  for (let i = 0; i < 8; i++) {
    const d = analysis.designLogWidth.slice();
    d[i] += Math.log(1.1); // +10 % width at that control point (before clipping)
    const aD = analyzeLattice(d, ctx);
    push(`w${i}`, WIDTH_LABELS[i], '+10 % width', pfOf(aD), { designIndex: i, analysis: aD });
  }
  items.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return { base, items, level: 'lot', material: levelMat, targetPf: opts.targetPf ?? DEFAULTS.targetPf };
}

// ---------------------------------------------------------------------------
// 9. Small presentation helpers used by the UI
// ---------------------------------------------------------------------------
/** Plain-language explanation of how the robust design differs from a start. */
export function describeGeometryChange(startDesign, endDesign) {
  const s = designWidths(startDesign);
  const e = designWidths(endDesign);
  const rootStart = (s[0] + s[4]) / 2;
  const rootEnd = (e[0] + e[4]) / 2;
  const tipStart = (s[3] + s[7]) / 2;
  const tipEnd = (e[3] + e[7]) / 2;
  const midStart = (s[1] + s[2] + s[5] + s[6]) / 4;
  const midEnd = (e[1] + e[2] + e[5] + e[6]) / 4;
  const pct = (a, b) => (a > 0 ? ((b - a) / a) * 100 : 0);
  return {
    root_mm: { start: rootStart, end: rootEnd, changePct: pct(rootStart, rootEnd) },
    mid_mm: { start: midStart, end: midEnd, changePct: pct(midStart, midEnd) },
    tip_mm: { start: tipStart, end: tipEnd, changePct: pct(tipStart, tipEnd) },
    mass_g: { start: null, end: null },
    summary: `root ${rootEnd.toFixed(2)} mm (${pct(rootStart, rootEnd) >= 0 ? '+' : ''}${pct(rootStart, rootEnd).toFixed(1)} %), mid ${midEnd.toFixed(2)} mm (${pct(midStart, midEnd) >= 0 ? '+' : ''}${pct(midStart, midEnd).toFixed(1)} %), tip ${tipEnd.toFixed(2)} mm (${pct(tipStart, tipEnd) >= 0 ? '+' : ''}${pct(tipStart, tipEnd).toFixed(1)} %)`,
  };
}

export { MATERIAL_PRESETS };

/**
 * AnyRB v0.2 — AI core (pure, DOM-free, Node-testable).
 *
 * Everything in this module is deterministic and side-effect free:
 *   - the OFFLINE assistant (identical JSON schemas to the Meta backend),
 *   - response normalisers (live backend shape → internal shape),
 *   - brief/lot coercion into verified-engine inputs,
 *   - three candidate design priors + evaluation/ranking with the real engine,
 *   - number-grounding validation for AI-written memos,
 *   - provenance entry builders,
 *   - validation-summary fallback list.
 *
 * The browser client (ai.js) adds fetch/health/MediaRecorder; the UI (ui.js)
 * adds DOM. Physics stays in engine.js / optimize.js and is NOT modified here.
 */

import { GEOMETRY, DEFAULTS, MATERIAL_PRESETS, numericMaterial, UI_RANGES } from './config.js';
import * as E from './engine.js';
import * as O from './optimize.js';

export const OFFLINE_MODEL = 'built-in assistant';
export const OFFLINE_NOTE = 'Offline — built-in assistant';

// ---------------------------------------------------------------------------
// Example briefs (chips in the Brief step)
// ---------------------------------------------------------------------------
export const EXAMPLE_BRIEFS = [
  {
    id: 'bracket',
    label: 'Shelf bracket',
    text: 'Design a shelf bracket for a 150 N downward load with a 2.5 mm tip deflection limit and 1 % reliability target. Print it in rPETG; the last lot ran soft.',
    icon: 'bracket',
  },
  {
    id: 'drone',
    label: 'Drone arm',
    text: 'I need a stiff drone arm printed in recycled PETG: 120 N tip load, maximum 1.5 mm deflection, 0.5 % failure probability across batches. Keep it printable on an FDM printer.',
    icon: 'drone',
  },
  {
    id: 'fixture',
    label: 'Test fixture',
    text: 'A jig for a production line — 200 N load, 3 mm deflection limit, 2 % reliability target, rPET filament, lots vary a lot. Don’t overbuild it.',
    icon: 'fixture',
  },
];

// ---------------------------------------------------------------------------
// Lot passport presets → engine material
// ---------------------------------------------------------------------------
export function materialFromLot(lot, fallbackKey = DEFAULTS.preset) {
  const base = numericMaterial(fallbackKey);
  const l = lot || {};
  return E.normalizeMaterial({
    ...base,
    E_mean: l.E_mean ?? base.E_mean,
    E_cv: l.E_cv ?? base.E_cv,
    sy_mean: l.sy_mean ?? base.sy_mean,
    sy_cv: l.sy_cv ?? base.sy_cv,
    rho: l.rho ?? base.rho,
    corr: l.corr ?? base.corr,
    lotFraction: l.lotFraction ?? base.lotFraction,
    withinFraction: l.withinFraction ?? base.withinFraction,
    process: l.process ?? base.process,
    printProcessOk: l.printProcessOk ?? base.printProcessOk,
    elongationMean: l.elongationMean ?? base.elongationMean,
    elongationCv: l.elongationCv ?? base.elongationCv,
    corrEElong: l.corrEElong ?? base.corrEElong,
  });
}

export function presetLot(key) {
  const p = MATERIAL_PRESETS[key] || MATERIAL_PRESETS[DEFAULTS.preset];
  return {
    id: p.key,
    name: p.label,
    source: p.source,
    sourceDetails: p.sourceDetails || '',
    confidence: 1,
    E_mean: p.E_mean,
    E_cv: p.E_cv,
    sy_mean: p.sy_mean,
    sy_cv: p.sy_cv,
    rho: p.rho,
    corr: p.corr,
    lotFraction: p.lotFraction,
    withinFraction: p.withinFraction,
    process: p.process,
    printProcessOk: p.printProcessOk,
    processNote: p.processNote,
    elongationMean: p.elongationMean,
    elongationCv: p.elongationCv,
    corrEElong: p.corrEElong ?? -0.25,
    note: p.note,
  };
}

// ---------------------------------------------------------------------------
// Brief coercion — every AI/heuristic brief becomes validated engine inputs
// ---------------------------------------------------------------------------
export const BRIEF_LIMITS = {
  loadN: [10, 2000],
  deflLimitMm: [0.2, 20],
  targetPf: [0.0001, 0.2],
  massCapG: [1, 5000],
};

export function coerceBrief(raw, defaults = {}) {
  const base = {
    partType: defaults.partType || 'shelf bracket',
    loadN: defaults.loadN ?? DEFAULTS.F,
    deflLimitMm: defaults.deflLimitMm ?? GEOMETRY.uLim,
    targetPf: defaults.targetPf ?? DEFAULTS.targetPf,
    process: defaults.process || 'FDM/FFF',
    preset: defaults.preset || DEFAULTS.preset,
    notes: defaults.notes || '',
    constraints: Array.isArray(defaults.constraints) ? defaults.constraints : [],
    massCapG: defaults.massCapG ?? null,
  };
  const r = raw || {};
  const num = (v, lo, hi, fb) => {
    const n = typeof v === 'string' ? Number(String(v).replace(/[^0-9.+-]/g, '')) : Number(v);
    return Number.isFinite(n) ? E.clamp(n, lo, hi) : fb;
  };
  const presetKey = Object.keys(MATERIAL_PRESETS).find(
    (k) => k.toLowerCase() === String(r.preset || '').toLowerCase() || (MATERIAL_PRESETS[k].label || '').toLowerCase().includes(String(r.preset || '').toLowerCase()),
  ) || base.preset;
  const constraints = Array.isArray(r.constraints) ? r.constraints.filter((c) => typeof c === 'string').slice(0, 6) : base.constraints;
  return {
    partType: String(r.partType || base.partType).slice(0, 80),
    loadN: num(r.loadN, BRIEF_LIMITS.loadN[0], BRIEF_LIMITS.loadN[1], base.loadN),
    deflLimitMm: num(r.deflLimitMm, BRIEF_LIMITS.deflLimitMm[0], BRIEF_LIMITS.deflLimitMm[1], base.deflLimitMm),
    targetPf: num(r.targetPf, BRIEF_LIMITS.targetPf[0], BRIEF_LIMITS.targetPf[1], base.targetPf),
    process: String(r.process || base.process).slice(0, 40),
    preset: presetKey,
    notes: String(r.notes || base.notes).slice(0, 400),
    constraints,
    massCapG: (() => {
      const v = r.massCapG ?? r.mass_cap_g;
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? E.clamp(n, BRIEF_LIMITS.massCapG[0], BRIEF_LIMITS.massCapG[1]) : null;
    })(),
  };
}

// ---------------------------------------------------------------------------
// Offline brief parsing — deterministic keyword/number heuristics
// ---------------------------------------------------------------------------
/** Brief in the backend's snake_case schema (for /api/design/plan, review…). */
export function serverBrief(brief) {
  return {
    part_label: brief.partType,
    load_N: brief.loadN,
    deflection_limit_mm: brief.deflLimitMm,
    target_pf: brief.targetPf,
    mass_cap_g: brief.massCapG ?? null,
    material_key: String(brief.preset || '').toLowerCase(),
    process: brief.process,
    constraints: brief.constraints || [],
  };
}

export function parseBriefTextHeuristics(text) {
  const t = String(text || '');
  const lower = t.toLowerCase();
  const find = (re) => {
    const m = t.match(re);
    return m ? Number(m[1]) : null;
  };
  const loadN = find(/(\d{1,4}(?:[.,]\d+)?)\s*(?:n\b|newtons?)/i);
  const deflLimitMm = find(/(\d{1,3}(?:[.,]\d+)?)\s*mm\b(?!\s*(?:wall|thick|depth|strut|nozzle))/i);
  const targetPct = find(/(\d{1,3}(?:[.,]\d+)?)\s*%\s*(?:reliability|failure|target|risk)?/i);
  const material = Object.values(MATERIAL_PRESETS).find((p) => lower.includes(p.key.toLowerCase()))
    || (/(recycled\s+petg|rpetg)/i.test(t) ? MATERIAL_PRESETS.rPETG : null)
    || (/(recycled\s+hdpe|rhdpe)/i.test(t) ? MATERIAL_PRESETS.rHDPE : null)
    || (/(recycled\s+pp|rpp)/i.test(t) ? MATERIAL_PRESETS.rPP : null)
    || (/(recycled\s+pet\b|rpet\b)/i.test(t) ? MATERIAL_PRESETS.rPET : null);
  const process = /(sla|resin)/i.test(t) ? 'SLA'
    : /(injection|im\b)/i.test(t) ? 'IM'
      : /(fdm|fff|filament|print)/i.test(t) ? 'FDM/FFF' : null;
  const partType = /(bracket|shelf)/i.test(t) ? 'shelf bracket'
    : /(drone|arm)/i.test(t) ? 'drone arm'
      : /(fixture|jig)/i.test(t) ? 'test fixture'
        : /(mount|holder)/i.test(t) ? 'mounting bracket' : null;
  return {
    partType,
    loadN,
    deflLimitMm,
    targetPf: targetPct !== null ? targetPct / 100 : null,
    process,
    preset: material ? material.key : null,
    notes: t.trim().slice(0, 240),
  };
}

export function fallbackBrief(text, defaults) {
  const h = parseBriefTextHeuristics(text);
  const brief = coerceBrief({
    partType: h.partType || undefined,
    loadN: h.loadN ?? undefined,
    deflLimitMm: h.deflLimitMm ?? undefined,
    targetPf: h.targetPf ?? undefined,
    process: h.process || undefined,
    preset: h.preset || undefined,
    notes: h.notes || undefined,
  }, defaults);
  const matched = [h.partType, h.loadN, h.deflLimitMm, h.targetPf, h.process, h.preset].filter((v) => v !== null && v !== undefined).length;
  return {
    brief,
    confidence: Math.min(0.94, 0.55 + matched * 0.07),
    model: OFFLINE_MODEL,
    fallback: true,
    extracted: { loadN: h.loadN, deflLimitMm: h.deflLimitMm, targetPf: h.targetPf, process: h.process, preset: h.preset },
  };
}

// ---------------------------------------------------------------------------
// Offline lot parsing — numbers from a pasted datasheet / supplier text
// ---------------------------------------------------------------------------
export function parseLotTextHeuristics(text, presetKey = DEFAULTS.preset) {
  const t = String(text || '');
  const find = (re) => {
    const m = t.match(re);
    return m ? Number(String(m[1]).replace(',', '.')) : null;
  };
  const E_mean = find(/E(?:[\s-]?modulus)?[^0-9]{0,24}(\d{2,5}(?:[.,]\d+)?)\s*MPa/i)
    ?? find(/(\d{2,5}(?:[.,]\d+)?)\s*MPa[^.\n]{0,24}(?:modulus|stiffness)/i);
  const sy_mean = find(/(?:strength|yield|σy|sigma)[^0-9]{0,26}(\d{1,3}(?:[.,]\d+)?)\s*MPa/i);
  const rho = find(/(?:density|ρ|rho)[^0-9]{0,20}(\d(?:[.,]\d{1,3})?)\s*(?:g\/cm3|g\/cm³|g\/ml)/i);
  const cvE = find(/(?:CV|variation)\s*(?:of\s*)?E?[^0-9]{0,8}(\d{1,2}(?:[.,]\d+)?)\s*%/i);
  const cvSy = find(/(?:CV|variation)\s*(?:of\s*)?(?:strength|σy|sigma)[^0-9]{0,8}(\d{1,2}(?:[.,]\d+)?)\s*%/i);
  const base = numericMaterial(presetKey);
  const material = E.normalizeMaterial({
    ...base,
    E_mean: E_mean ?? base.E_mean,
    E_cv: cvE !== null ? cvE / 100 : base.E_cv,
    sy_mean: sy_mean ?? base.sy_mean,
    sy_cv: cvSy !== null ? cvSy / 100 : base.sy_cv,
    rho: rho ?? base.rho,
  });
  const extractedCount = [E_mean, sy_mean, rho, cvE, cvSy].filter((v) => v !== null).length;
  return {
    material,
    confidence: Math.min(0.92, 0.45 + extractedCount * 0.11),
    source: extractedCount > 0 ? 'Text you pasted (read by the built-in reader)' : 'Selected material preset',
    extracted: extractedCount > 0,
    fallback: true,
    model: OFFLINE_MODEL,
    note: extractedCount > 0
      ? 'Numbers extracted from the pasted text; confirm before design.'
      : 'No material numbers recognised — the selected preset was used. Edit the fields to correct.',
  };
}

// ---------------------------------------------------------------------------
// Candidate design priors + engine evaluation/ranking
// ---------------------------------------------------------------------------
export const CANDIDATE_META = {
  light: { name: 'Light', tagline: 'Lowest mass', rationale: 'Thin struts that should just reach the reliability target. Efficient, but the least forgiving if a batch comes in weak.' },
  balanced: { name: 'Balanced', tagline: 'Balanced', rationale: 'Puts more material where the bracket bends most, near the wall, and keeps the tip light. Usually the best trade-off.' },
  conservative: { name: 'Extra-safe', tagline: 'More margin', rationale: 'Thicker than needed for the target, with a lower failure chance. Useful when the incoming batches vary a lot.' },
};

function clampWidth(w) {
  return E.clamp(Number(w), GEOMETRY.wMin, GEOMETRY.wMax);
}

/** Build the three deterministic design priors from a first-pass feasibility width. */
export function fallbackPlan(brief, material, ctx) {
  const targetPf = brief.targetPf ?? DEFAULTS.targetPf;
  // Deterministic engine-backed priors for the offline assistant: the verified
  // multi-start optimum gives the balanced direction; light/conservative scale
  // it to expose the mass-vs-reliability trade-off. Every candidate is still
  // evaluated and ranked by the engine (printed mass + printability gate).
  const opt = O.robustOptimize(material, ctx, { targetPf });
  const widths = E.designWidths(opt.design);
  const scaled = (s) => widths.map((w) => clampWidth(w * s));
  const candidates = [
    { id: 'light', ...CANDIDATE_META.light, controlWidthsMm: scaled(0.94) },
    { id: 'balanced', ...CANDIDATE_META.balanced, controlWidthsMm: widths.map((w) => clampWidth(w)) },
    { id: 'conservative', ...CANDIDATE_META.conservative, controlWidthsMm: scaled(1.14) },
  ];
  return {
    candidates,
    model: OFFLINE_MODEL,
    fallback: true,
    targetPf,
    firstPassWidthMm: Math.exp(O.feasibleUniformStart(material, ctx, targetPf)[0]),
    basePrintedMassG: opt.printed_mass_g,
    note: 'Starting points built from the best design the calculator found (with a little more or less material).',
  };
}

function coerceControlWidths(raw) {
  const arr = raw.controls ?? raw.controlWidthsMm ?? raw.control_widths_mm
    ?? raw.width_priors_mm ?? raw.widthPriorsMm ?? raw.widths_mm ?? raw.widths ?? raw;
  if (!Array.isArray(arr) || arr.length !== 8) return null;
  const nums = arr.map(Number).filter((v) => Number.isFinite(v));
  if (nums.length !== 8) return null;
  const max = Math.max(...nums);
  // Server may return log-width controls (≈0–1.39) or mm widths (1–4): detect.
  const asMm = max <= 1.45 ? nums.map((v) => Math.exp(v)) : nums;
  return asMm.map((w) => clampWidth(w));
}

/** Normalise any backend/offline plan into candidate objects with mm widths. */
export function normalizePlan(raw) {
  const r = raw || {};
  const list = Array.isArray(r.candidates) ? r.candidates : Array.isArray(r.plan) ? r.plan : Array.isArray(r.designs) ? r.designs : [];
  const candidates = [];
  for (let i = 0; i < list.length && candidates.length < 3; i++) {
    const c = list[i] || {};
    const widths = coerceControlWidths({
      width_priors_mm: c.width_priors_mm,
      controlWidthsMm: c.controlWidthsMm,
      widths_mm: c.widths_mm,
      controls: c.controls,
    });
    if (!widths) continue;
    const id = String(c.id || c.name || `cand_${i}`).toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const meta = CANDIDATE_META[id] || CANDIDATE_META[String(c.strategy || '').toLowerCase()] || null;
    candidates.push({
      id,
      name: String(c.name || (meta ? meta.name : `Candidate ${i + 1}`)).slice(0, 60),
      tagline: String(c.strategy || c.tagline || (meta ? meta.tagline : 'AI-proposed')).slice(0, 40),
      rationale: String(c.why || c.rationale || (meta ? meta.rationale : 'AI-proposed direction.')).slice(0, 320),
      risk: String(c.risk || '').slice(0, 200),
      controlWidthsMm: widths,
      source: c.source || 'ai-plan',
    });
  }
  return {
    candidates,
    model: r.model || null,
    fallback: !!r.fallback,
    targetPf: Number.isFinite(r.targetPf) ? r.targetPf : null,
    note: r.note || '',
  };
}

/** Evaluate one prior with the verified engine. */
export function evaluateCandidate(candidate, material, ctx, targetPf) {
  const logWidth = candidate.controlWidthsMm.map((w) => Math.log(clampWidth(w)));
  const analysis = E.analyzeLattice(logWidth, ctx); // computes printed/union mass
  const pf = E.probabilityOfFailure(analysis, material, 'lot');
  const modes = E.failureModes(analysis, material, 'lot');
  const printability = E.printabilityReport(analysis);
  const printedMass = analysis.printed_mass_g ?? analysis.mass_g;
  const printabilityPass = !!(printability && printability.pass);
  // v0.3: candidate ranking uses PRINTED mass and requires printability pass.
  const feasible = pf <= targetPf + 1e-12 && printabilityPass;
  const violation = Math.max(0, (pf - targetPf) / targetPf);
  const printPenalty = printability
    ? 80 * (Math.max(0, printability.max_neighbour_width_ratio - 1.5) / 0.5
      + Math.max(0, printability.max_slenderness - 30) / 30)
    : 0;
  const score = feasible ? printedMass : printedMass * (1 + 100 * violation + printPenalty);
  const brittle = E.brittleScreen(analysis, material, 'lot');
  return {
    ...candidate,
    logWidth,
    analysis,
    mass_g: printedMass,
    mass_analytic_g: analysis.mass_analytic_g ?? analysis.mass_g,
    printed_mass_g: printedMass,
    strain_req: brittle.strain_req,
    strain_req_pct: brittle.strain_req_pct,
    elongation_mean_pct: brittle.elongation_mean_pct,
    elongation_cv: brittle.elongation_cv,
    pf_brittle: brittle.pf_brittle,
    pf_brittle_bound: brittle.pf_brittle_bound,
    brittle_ok: brittle.brittle_ok,
    brittle_included_in_headline: brittle.brittle_included_in_headline,
    brittle_note: brittle.note,
    pf,
    reliability: 1 - pf,
    feasible,
    printabilityPass,
    score,
    governing: modes.governingLabel,
    printability,
    sigma_y_req: analysis.demands.sigma_y_req,
    E_req: analysis.demands.E_req,
    deflection_mm: analysis.deflectionScale / material.E_mean,
  };
}
/**
 * Optimise each AI prior with the verified engine, then rank.
 * The AI proposes starting points; the physics returns the final mass/P_f.
 */
export function optimizeAndRankCandidates(candidates, material, ctx, targetPf) {
  const objective = O.robustObjective(material, ctx, targetPf);
  const optimised = candidates.map((candidate) => {
    const start = evaluateCandidate(candidate, material, ctx, targetPf);
    let logWidth = start.logWidth;
    try {
      const search = O.patternSearchGen(objective, logWidth, {});
      let step = search.next();
      while (!step.done) step = search.next();
      if (step.value && step.value.design) logWidth = step.value.design;
    } catch (err) { /* keep the prior */ }
    // v0.3: re-evaluate through the printed-mass/printability path so candidate
    // cards show printed mass, analytic upper bound and the printability gate.
    const widths = E.designWidths(logWidth).map((w) => clampWidth(w));
    const evaluated = evaluateCandidate({ ...candidate, controlWidthsMm: widths }, material, ctx, targetPf);
    return { ...evaluated, logWidth, optimisedFromPrior: true, priorId: candidate.id };
  });
  optimised.sort((a, b) => {
    if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
    if (Math.abs(a.score - b.score) > 1e-9) return a.score - b.score;
    return a.printed_mass_g - b.printed_mass_g;
  });
  return optimised.map((c, i) => ({ ...c, rank: i + 1 }));
}

/**
 * v0.3 hero design: the final engine-optimised result (multi-start pattern search),
 * chosen by printed mass with the printability gate. Kept SEPARATE from the three
 * AI priors so the Design screen shows defensible trade-offs instead of copies.
 */
export function recommendedDesign(materialIn, ctx, targetPf) {
  const material = materialIn;
  const opt = O.robustOptimize(material, ctx, { targetPf });
  const analysis = opt.analysis;
  const printability = E.printabilityReport(analysis);
  const printed = analysis.printed_mass_g ?? analysis.mass_g;
  const feasible = opt.pf <= targetPf * 1.02 && !!(printability && printability.pass);
  const brittle = E.brittleScreen(analysis, material, 'lot');
  const assumptions = E.assumptionBounds(material, analysis.demands.sigma_y_req, analysis.demands.E_req, 'lot');
  return {
    id: 'optimised',
    name: 'Best of this family',
    strategy: 'multi-start robust pattern search',
    rationale: `The best design the calculator found: ${printed.toFixed(2)} g estimated printed mass, chosen by mass with the print settings checked.`,
    tagline: 'Recommended',
    logWidth: opt.design,
    controlWidthsMm: E.designWidths(opt.design).map((w) => clampWidth(w)),
    analysis,
    printed_mass_g: printed,
    mass_g: printed,
    mass_analytic_g: analysis.mass_analytic_g ?? analysis.mass_g,
    pf: opt.pf,
    reliability: 1 - opt.pf,
    feasible,
    printabilityPass: !!(printability && printability.pass),
    score: printed,
    governing: E.failureModes(analysis, material, 'lot').governingLabel,
    printability,
    strain_req: brittle.strain_req,
    strain_req_pct: brittle.strain_req_pct,
    elongation_mean_pct: brittle.elongation_mean_pct,
    elongation_cv: brittle.elongation_cv,
    pf_brittle: brittle.pf_brittle,
    pf_brittle_bound: brittle.pf_brittle_bound,
    brittle_ok: brittle.brittle_ok,
    brittle_included_in_headline: brittle.brittle_included_in_headline,
    brittle_note: brittle.note,
    assumptions,
    union_polished: !!opt.union_polished,
    union_evals: opt.union_evals || 0,
    union_before_printed_g: opt.union_before_printed_g,
    union_after_printed_g: opt.union_after_printed_g,
    sigma_y_req: analysis.demands.sigma_y_req,
    E_req: analysis.demands.E_req,
    deflection_mm: analysis.deflectionScale / material.E_mean,
    starts: opt.starts || [],
    isOptimised: true,
  };
}

/** Engine-rank candidates: feasible first by mass, then by penalty score. */
export function evaluateAndRankCandidates(candidates, material, ctx, targetPf) {
  const evaluated = candidates.map((c) => evaluateCandidate(c, material, ctx, targetPf));
  evaluated.sort((a, b) => {
    if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
    if (Math.abs(a.score - b.score) > 1e-9) return a.score - b.score;
    return a.mass_g - b.mass_g;
  });
  return evaluated.map((c, i) => ({ ...c, rank: i + 1 }));
}

export function pickBestCandidate(evaluated) {
  if (!evaluated || evaluated.length === 0) return null;
  return evaluated[0];
}

// ---------------------------------------------------------------------------
// AI memo fallbacks — grounded in the payload numbers we pass in
// ---------------------------------------------------------------------------
const pct = (v, d = 3) => {
  if (!Number.isFinite(v)) return '—';
  if (v > 0 && v < 5e-6) return 'below 0.001 %';
  return `${(v * 100).toFixed(d)} %`;
};
const num = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '—');

export function fallbackDesignReview(payload) {
  const f = payload && payload.facts ? payload.facts : payload || {};
  const memo = [
    `This design comes out at ${num(f.mass_g, 2)} g, with an estimated ${pct(f.pf, 3)} chance of failing across batches against your ${pct(f.target_pf, 2)} target. That puts it ${f.feasible ? 'inside' : 'outside'} the target.`,
    `The weak point is ${f.governing_mode || 'not computed'} — the wall end and lower edge carry most of the bending.`,
    `The part needs about ${num(f.sigma_y_req_mpa, 2)} MPa of material strength and ${num(f.E_req_mpa, 0)} MPa of stiffness. Stiffness is what decides the batch outcome here, not raw strength.`,
    `Print checks are ${f.printability_warn ? 'flagged' : 'clear'}: thinnest strut ${num(f.min_width_mm, 2)} mm, longest thin strut ${num(f.max_slenderness, 1)}, and the biggest width change between neighbours ${num(f.neighbour_ratio, 2)}.`,
    `Next I would keep this shape and check the stiffness of the batch you actually received — that is what moves the failure chance most here.`,
  ].join(' ');
  return { memo, nextActions: ['Verify the measured lot E before printing', 'Open Prove to compute the batch passport'], model: OFFLINE_MODEL, fallback: true };
}

export function fallbackProofMemo(payload) {
  const f = payload && payload.facts ? payload.facts : payload || {};
  const memo = [
    `The selected design is ${num(f.mass_g, 2)} g estimated printed mass (the cautious high-side figure is ${num(f.mass_analytic_upper_bound_g, 2)} g). It comes out at an estimated ${pct(f.pf, 3)} chance of failing across batches against your ${pct(f.target_pf, 2)} target, so it ${f.feasible ? 'meets' : 'misses'} the target.`,
    `The weak point is ${f.governing_mode || 'not computed'}; the part needs about ${num(f.sigma_y_req_mpa, 2)} MPa of strength and ${num(f.E_req_mpa, 0)} MPa of stiffness.`,
    `The batch window shows which measured batch averages still meet the target. The batch-specific recipe adjusts all ${(() => (Array.isArray(f.widths_mm) ? f.widths_mm.length : 8))()} width zones for the batch you measured and keeps the measurement uncertainty (${num(f.measurement_cv, 2)} CV) in the calculation.`,
    `The main uncertainty is the material data: it comes from published studies, so replace it with your supplier's own batch data before production.`,
    `Next test: measure stiffness and strength on printed specimens from the incoming batch, then rerun this page.`,
  ].join(' ');
  return { memo, nextTest: 'Printed ISO 527-2 tensile specimens from the incoming lot', model: OFFLINE_MODEL, fallback: true };
}

// ---------------------------------------------------------------------------
// Offline illustrative render — deterministic SVG from the design payload
// ---------------------------------------------------------------------------
export function fallbackRenderSvg(payload) {
  const f = payload && payload.facts ? payload.facts : payload || {};
  const widths = Array.isArray(f.widths_mm) ? f.widths_mm : [2, 2, 1.6, 1.3, 2, 1.8, 1.5, 1.4];
  const accent = '#FF5A36';
  const ink = '#15171A';
  const paper = '#F7F5F0';
  const line = '#D8D0C0';
  const w = (i) => Math.max(1.1, Math.min(4, widths[i] || 2));
  // Simple isometric-ish lattice illustration (illustrative only).
  const cells = [];
  const x0 = 90;
  const y0 = 150;
  const cw = 46;
  const ch = 34;
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 7; i++) {
      const x = x0 + i * cw;
      const y = y0 - j * ch;
      cells.push(`<line x1="${x}" y1="${y}" x2="${x + cw}" y2="${y}" stroke="${ink}" stroke-width="${1.1 + w(0) * 0.5}" stroke-linecap="round"/>`);
      cells.push(`<line x1="${x}" y1="${y}" x2="${x}" y2="${y - ch}" stroke="${ink}" stroke-width="${1.1 + w(1) * 0.5}" stroke-linecap="round"/>`);
      cells.push(`<line x1="${x}" y1="${y}" x2="${x + cw}" y2="${y - ch}" stroke="${accent}" stroke-width="${1 + w(2) * 0.45}" stroke-linecap="round" opacity="0.85"/>`);
      cells.push(`<line x1="${x + cw}" y1="${y}" x2="${x}" y2="${y - ch}" stroke="${ink}" stroke-width="${1 + w(3) * 0.45}" stroke-linecap="round" opacity="0.75"/>`);
    }
  }
  // wall pad + load arrow
  const pad = `<rect x="${x0 - 26}" y="${y0 - 3 * ch}" width="24" height="${3 * ch}" fill="${paper}" stroke="${ink}" stroke-width="1.4"/>`
    + `<path d="M ${x0 - 14} ${y0 - 3 * ch} l 0 ${3 * ch}" stroke="${line}" stroke-width="1"/>`;
  const load = `<line x1="${x0 + 7 * cw + 40}" y1="${y0 - 3 * ch - 34}" x2="${x0 + 7 * cw + 40}" y2="${y0 - 3 * ch - 6}" stroke="${accent}" stroke-width="3" marker-end="url(#arrow)"/>`;
  const measure = `<line x1="${x0}" y1="${y0 + 34}" x2="${x0 + 7 * cw}" y2="${y0 + 34}" stroke="${line}" stroke-width="1"/>`
    + `<text x="${x0 + 3.5 * cw}" y="${y0 + 52}" text-anchor="middle" font-family="Georgia, serif" font-size="12" fill="${ink}">150 mm reference envelope</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 380" width="620" height="380">
  <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="6" orient="auto"><path d="M0,0 L8,6 L0,12 z" fill="${accent}"/></marker></defs>
  <rect width="620" height="380" rx="18" fill="${paper}"/>
  <text x="40" y="52" font-family="Georgia, serif" font-size="22" fill="${ink}">${escapeXml(f.part_type || 'Lattice bracket')}</text>
  <text x="40" y="76" font-family="-apple-system, Segoe UI, sans-serif" font-size="12" fill="#6B7280">Illustrative concept — offline illustration, not the CAD model</text>
  ${cells.join('\n  ')}
  ${pad}
  ${load}
  ${measure}
  <text x="40" y="344" font-family="-apple-system, Segoe UI, sans-serif" font-size="11" fill="#6B7280">AI illustration · generated locally in offline mode</text>
</svg>`;
  return { svg, label: 'AI illustration — offline fallback (not the CAD model)', model: OFFLINE_MODEL, fallback: true };
}

function escapeXml(s) {
  return String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------------------------------------------------------------------
// Voice fallback (schema-identical; only used when the Meta backend is absent)
// ---------------------------------------------------------------------------
export function fallbackVoice() {
  return {
    transcript: 'Design a shelf bracket for 150 N with a 2.5 mm deflection limit and a 1 % reliability target, printed in rPETG.',
    model: OFFLINE_MODEL,
    fallback: true,
    note: 'Offline demo transcript — live mode uses Muse Voice Transcribe.',
  };
}

// ---------------------------------------------------------------------------
// Number grounding — an AI memo may only mention numbers passed to it
// ---------------------------------------------------------------------------
const VERSION_RE = /\bv\d+(?:\.\d+)+\b/gi;
const MODEL_RE = /\bmuse\s+[a-z]+\s*\d*(?:\.\d+)?\b/gi;
const ISO_RE = /\bISO\s*\d+(?:-\d+)?\b/gi;

export function extractNumbers(text) {
  const cleaned = String(text || '')
    .replace(VERSION_RE, ' ')
    .replace(MODEL_RE, ' ')
    .replace(ISO_RE, ' ');
  const out = [];
  const re = /-?\d+(?:,\d{3})*(?:\.\d+)?/g;
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    const raw = m[0];
    const n = Number(raw.replace(/,/g, ''));
    if (Number.isFinite(n)) out.push({ raw, value: n, decimals: (raw.split('.')[1] || '').length });
  }
  return out;
}

export function flattenNumbers(value, out = []) {
  if (typeof value === 'number' && Number.isFinite(value)) out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => flattenNumbers(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => flattenNumbers(v, out));
  return out;
}

/** True when `n` (as displayed) is consistent with a number in the payload. */
export function numberIsGrounded(n, decimals, payloadNumbers) {
  const tol = Math.max(Math.abs(n) * 0.012, Number((0.5 * 10 ** -decimals).toFixed(6)));
  for (const p of payloadNumbers) {
    if (!Number.isFinite(p)) continue;
    if (Math.abs(p - n) <= tol + 1e-12) return true;
    // also accept the value rounded at the displayed precision
    const rounded = Number(p.toFixed(Math.min(6, decimals)));
    if (Math.abs(rounded - n) <= 1e-9) return true;
  }
  return false;
}

/**
 * Validate that every number in an AI-written text exists in the structured
 * payload. Returns {ok, ungrounded:[{raw,value}], text}.
 */
export function validateGrounding(text, payload) {
  const payloadNumbers = flattenNumbers(payload);
  const numbers = extractNumbers(text);
  const ungrounded = numbers.filter((t) => !numberIsGrounded(t.value, t.decimals, payloadNumbers));
  return { ok: ungrounded.length === 0, ungrounded, count: numbers.length };
}

/** Use AI text only if grounded; otherwise return the deterministic fallback. */
export function sanitizeMemo(text, payload, fallbackText) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return { text: fallbackText, grounded: false, fallback: true, ungrounded: [] };
  }
  const check = validateGrounding(text, payload);
  if (check.ok) return { text: text.trim(), grounded: true, fallback: false, ungrounded: [] };
  return { text: fallbackText, grounded: false, fallback: true, ungrounded: check.ungrounded };
}

// ---------------------------------------------------------------------------
// Response normalisers (accept tolerant server shapes; identical internal schema)
// ---------------------------------------------------------------------------
export function normalizeBriefResponse(raw, defaults) {
  const r = raw || {};
  const meta = r._meta || {};
  const source = r.brief || r.result || r.data || r;
  const coerced = coerceBrief({
    partType: source.part_label ?? source.partType ?? source.part,
    loadN: source.load_N ?? source.loadN,
    deflLimitMm: source.deflection_limit_mm ?? source.deflLimitMm,
    targetPf: source.target_pf ?? source.targetPf,
    process: source.process,
    preset: source.material_key ?? source.preset,
    notes: source.rationale ?? source.notes,
    constraints: source.constraints,
    massCapG: source.mass_cap_g ?? source.massCapG,
  }, defaults);
  const conf = Number(source.confidence ?? r.confidence ?? 0.7);
  return {
    brief: coerced,
    confidence: Number.isFinite(conf) ? E.clamp(conf, 0, 1) : 0.7,
    model: meta.model || source.model || r.model || null,
    fallback: !!(meta.fallback ?? r.fallback ?? source.fallback),
    extracted: source.fields_found || source.extracted || null,
    missing: source.missing || [],
    rationale: source.rationale || '',
  };
}

export function normalizeLotResponse(raw, defaults) {
  const r = raw || {};
  const meta = r._meta || {};
  const source = r.lot || r.material || r.result || r.data || r;
  const m = source.material || source;
  const presetKey = String(source.material_key || (source.preset || '')).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const matchedPreset = Object.keys(MATERIAL_PRESETS).find((k) => k.toUpperCase() === presetKey);
  const base = numericMaterial(defaults && defaults.preset ? defaults.preset : DEFAULTS.preset);
  const material = E.normalizeMaterial({
    ...base,
    E_mean: m.E_mean ?? m.E ?? base.E_mean,
    E_cv: m.E_cv ?? m.cv_E ?? base.E_cv,
    sy_mean: m.sy_mean ?? m.sy ?? m.sigma_y ?? base.sy_mean,
    sy_cv: m.sy_cv ?? m.cv_sy ?? base.sy_cv,
    rho: m.rho ?? m.density ?? base.rho,
    corr: m.corr ?? base.corr,
    lotFraction: m.lotFraction ?? m.lot_fraction ?? base.lotFraction,
    withinFraction: m.withinFraction ?? m.within_fraction ?? base.withinFraction,
  });
  const conf = Number(source.confidence ?? r.confidence ?? 0.75);
  return {
    lot: {
      name: source.name || source.id || 'Parsed lot',
      source: source.source_label || source.source || 'Supplier text (AI extraction)',
      confidence: Number.isFinite(conf) ? E.clamp(conf, 0, 1) : 0.75,
      note: (source.assumptions || source.note || []).join ? (source.assumptions || []).join(' · ') : (source.note || ''),
      preset: matchedPreset || null,
      ...material,
    },
    confidence: Number.isFinite(conf) ? E.clamp(conf, 0, 1) : 0.75,
    model: meta.model || r.model || source.model || null,
    fallback: !!(meta.fallback ?? r.fallback ?? source.fallback),
    extracted: !!(source.fields_found ?? source.extracted ?? true),
    fieldsFound: source.fields_found || [],
  };
}

export function normalizeReviewResponse(raw) {
  const r = raw || {};
  const meta = r._meta || {};
  const source = r.review || r.result || r.data || r;
  const memo = typeof source.memo === 'string' ? source.memo : typeof source.text === 'string' ? source.text : '';
  const nextActions = Array.isArray(source.nextActions) ? source.nextActions : Array.isArray(source.next_actions) ? source.next_actions : [];
  return {
    memo,
    nextActions: nextActions.filter((x) => typeof x === 'string').slice(0, 3),
    keyRisk: source.key_risk || '',
    caveats: source.caveats || [],
    model: meta.model || r.model || source.model || null,
    fallback: !!(meta.fallback ?? r.fallback ?? source.fallback),
  };
}

export function normalizeProofResponse(raw) {
  const r = raw || {};
  const meta = r._meta || {};
  const source = (r.proof && typeof r.proof === 'object') ? r.proof
    : (r.result && typeof r.result === 'object') ? r.result
      : (r.data && typeof r.data === 'object') ? r.data : r;
  const memo = typeof r.memo === 'string' ? r.memo
    : typeof source.memo === 'string' ? source.memo
      : typeof source.text === 'string' ? source.text : '';
  const tests = source.recommended_tests || source.recommendedTests || [];
  return {
    memo,
    nextTest: source.nextTest || source.next_test || (Array.isArray(tests) ? tests[0] : '') || '',
    whatWouldChange: source.what_would_change_answer || [],
    recommendedTests: Array.isArray(tests) ? tests : [],
    claimLevel: source.claim_level || '',
    model: meta.model || r.model || source.model || null,
    fallback: !!(meta.fallback ?? r.fallback ?? source.fallback),
  };
}

export function normalizeVoiceResponse(raw) {
  const r = raw || {};
  const t = r.transcript || r.text || (r.result && (r.result.transcript || r.result.text)) || '';
  return { transcript: String(t || ''), model: r.model || null, fallback: !!(r.fallback), confidence: Number(r.confidence ?? 0.8) };
}

export function normalizeRenderResponse(raw) {
  const r = raw || {};
  const meta = r._meta || {};
  const src = r.render || r.result || r.data || r;
  const imageUrl = src.image_url || src.url || src.image || src.image_data_url || null;
  const imageBase64 = src.image_base64 || src.base64 || null;
  const svg = src.svg || null;
  return {
    imageUrl,
    imageBase64,
    svg,
    illustrative: src.illustrative !== false,
    label: src.label || 'AI illustration — not the CAD model',
    model: meta.model || r.model || src.model || null,
    fallback: !!(meta.fallback ?? r.fallback ?? src.fallback),
  };
}

export function validateResponse(kind, data) {
  const errors = [];
  if (!data || typeof data !== 'object') return { ok: false, errors: ['response is not an object'] };
  const num = (v) => typeof v === 'number' && Number.isFinite(v);
  if (kind === 'brief') {
    const b = data.brief || data;
    if (!b || typeof b !== 'object') errors.push('brief missing');
    else {
      if (!num(b.loadN) || b.loadN <= 0) errors.push('brief.loadN invalid');
      if (!num(b.deflLimitMm) || b.deflLimitMm <= 0) errors.push('brief.deflLimitMm invalid');
      if (!num(b.targetPf) || b.targetPf <= 0 || b.targetPf >= 1) errors.push('brief.targetPf invalid');
      if (typeof b.partType !== 'string' || !b.partType) errors.push('brief.partType missing');
    }
  } else if (kind === 'lot') {
    const l = data.lot || data.material || data;
    if (!l || typeof l !== 'object') errors.push('lot missing');
    else {
      for (const k of ['E_mean', 'E_cv', 'sy_mean', 'sy_cv', 'rho']) {
        if (!num(l[k]) || l[k] <= 0) errors.push(`lot.${k} invalid`);
      }
    }
  } else if (kind === 'plan') {
    const p = normalizePlan(data);
    if (p.candidates.length < 3) errors.push(`plan needs 3 candidates, got ${p.candidates.length}`);
    for (const c of p.candidates) {
      if (!Array.isArray(c.controlWidthsMm) || c.controlWidthsMm.length !== 8) errors.push(`candidate ${c.id} widths invalid`);
    }
  } else if (kind === 'review' || kind === 'proof') {
    const n = kind === 'review' ? normalizeReviewResponse(data) : normalizeProofResponse(data);
    if (!n.memo) errors.push(`${kind}.memo missing`);
  } else if (kind === 'voice') {
    const v = normalizeVoiceResponse(data);
    if (!v.transcript) errors.push('voice.transcript missing');
  } else if (kind === 'render') {
    const r = normalizeRenderResponse(data);
    if (!r.imageUrl && !r.imageBase64 && !r.svg) errors.push('render has no image/svg');
  } else {
    errors.push(`unknown response kind: ${kind}`);
  }
  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Provenance entries
// ---------------------------------------------------------------------------
let _provSeq = 0;
export function makeProvenance(entry = {}) {
  _provSeq += 1;
  const fallback = !!entry.fallback;
  return {
    id: `p${String(_provSeq).padStart(3, '0')}`,
    ts: entry.ts || new Date().toISOString(),
    endpoint: entry.endpoint || 'unknown',
    model: entry.model || (fallback ? OFFLINE_MODEL : 'unknown'),
    latencyMs: Math.max(0, Math.round(Number(entry.latencyMs) || 0)),
    cached: !!entry.cached,
    fallback,
    schemaOk: entry.schemaOk !== false,
    grounding: entry.grounding || null,
    error: entry.error || null,
    demo: !!entry.demo,
    status: entry.demo ? 'mock' : fallback ? 'fallback' : 'live',
  };
}

// ---------------------------------------------------------------------------
// Mass disclosure (validator finding F4): analytic mass double-counts strut
// overlap at joints. Corrected v0.3 union audit: printed union 46.40 g vs analytic
// 50.81 g for the robust design (+9.5 % conservative upper bound).
// We report printed mass everywhere; the analytic bound is labelled below.
// ---------------------------------------------------------------------------
// v0.3 mass basis: analytic mass is a conservative UPPER BOUND; the displayed
// design mass is the deterministic printed/union (Halton QMC) mass.
export const MASS_UNION = {
  analyticMassG: 50.81,
  unionMassG: 46.40,
  unionRatio: 46.40 / 50.81,
  note: 'Estimated printed mass from a simulated print volume; within 0.5% of a much larger reference calculation.',
  validatorNote: 'Validator F4 (fixed v0.3): analytic mass double-counts strut overlap; at the shipped robust design analytic 50.81 g vs printed union ≈46.40 g (+9.5 % upper bound). The app reports printed mass; analytic is shown as the upper bound only.',
};
export function massDisclosure(printedMassG) {
  const printed = Number.isFinite(printedMassG) ? printedMassG : MASS_UNION.unionMassG;
  const upper = printed / MASS_UNION.unionRatio;
  const pct = (upper / printed - 1) * 100;
  return {
    printed_g: round2(printed, 2),
    analytic_upper_bound_g: round2(upper, 2),
    upper_bound_pct: round2(pct, 1),
    note: `The headline mass is our estimate of the printed part (simulated print volume). A cautious high-side figure is ${round2(upper, 2)} g, about ${round2(pct, 1)} % higher because strut overlap is counted twice. Comparison bars use the estimated printed mass.`,
    sample_union_g: MASS_UNION.unionMassG,
  };
}

// ---------------------------------------------------------------------------
// Validation checklist fallback (Prove step) — replaced by validation/results.json
// ---------------------------------------------------------------------------
export function validationFallback() {
  return {
    source: 'embedded fallback (validation/results.json not available)',
    generated: null,
    counts: { PASS: 56, WARN: 2, FAIL: 0 },
    total: 58,
    runtime_s: null,
    checks: [
      { id: 'A', title: 'FE element benchmarks', detail: 'A1–A7: axial, cantilever, rigid body, independent assembly, equilibrium, symmetry, linearity — 8/8 pass', status: 'pass' },
      { id: 'B', title: 'Independent solver', detail: 'Energy-minimisation cross-check of the assembled system — 2/2 pass', status: 'pass' },
      { id: 'C', title: 'Failure-chance maths', detail: 'The closed-form failure chance matches numerical integration and simulation. 10/10.', status: 'pass' },
      { id: 'D', title: 'Optimiser robustness', detail: 'Brute-force grid + independent random search find no better feasible design — 5/5 pass', status: 'pass' },
      { id: 'E', title: 'Lattice stiffness', detail: 'The lattice stiffness matches a simple truss estimate. 6/6.', status: 'pass' },
      { id: 'F', title: 'Printed mass estimate', detail: 'The estimated printed mass is checked against a much larger simulation. Two small, quantified warnings remain (high-side mass and minimum-strut tolerance).', status: 'warn' },
      { id: 'G', title: 'Material-model audit', detail: 'Lognormal moments, correlation, two-level variance decomposition — 4/4 pass', status: 'pass' },
      { id: 'H', title: 'Cross-implementation', detail: 'Python ↔ JS fixture agreement — 4/4 pass', status: 'pass' },
      { id: 'I', title: 'Claim scope', detail: 'Number-grounding and claims-ladder audit — 2/2 pass', status: 'pass' },
    ],
    claimLadder: [
      { id: 'L0', level: 'Code verified', status: 'achieved', text: 'FE element benchmarks, equilibrium, symmetry, independent assembly, linearity (A1–A7, B8–B9).' },
      { id: 'L1', level: 'Solution verified', status: 'achieved', text: 'Energy cross-check, reliability quadrature/MC convergence, optimiser vs brute force, periodic cell, counts/determinism.' },
      { id: 'L2', level: 'Literature-calibrated + UQ', status: 'partial', text: 'rPETG preset moments/correlation verified internally; literature provenance not independently re-derived here.' },
      { id: 'L3', level: 'Literature reproduced', status: 'planned', text: 'Planned in research/05 §4.3.' },
      { id: 'L4–L6', level: 'Component / system / certified', status: 'absent', text: 'No coupon or full-bracket experiments, no certification. Decision support only.' },
    ],
    modelFormLimitations: {
      massOvercount: 'Analytic mass double-counts strut overlap by definition and is reported only as an upper bound (corrected F4). The Halton 60k printed-mass estimate is within 0.5 % of a 600k-sample MC (F5 WARN: deterministic QMC noise, quantified).',
      buckling: 'Euler buckling with pinned–pinned effective length; no combined axial–bending interaction.',
      joints: 'Printed node/joint compliance and local stress concentrations are not modelled; rigid joints assumed.',
      noExperiments: 'No physical specimens were tested; nothing here is experimental validation.',
    },
  };
}

// ---------------------------------------------------------------------------
// Payload builders — the only numbers an AI memo is allowed to mention
// ---------------------------------------------------------------------------
export function buildDesignMemoPayload({ brief, selected, comparison }) {
  const a = selected.analysis;
  const print = selected.printability || {};
  const printed = selected.printed_mass_g ?? selected.mass_g ?? a.printed_mass_g ?? a.mass_g;
  const analytic = selected.mass_analytic_g ?? a.mass_analytic_g ?? a.mass_g;
  const facts = {
    mass_g: round2(printed, 2),
    printed_mass_g: round2(printed, 2),
    mass_analytic_upper_bound_g: round2(analytic, 2),
    analytic_upper_bound_pct: round2((analytic / printed - 1) * 100, 1),
    pf: selected.pf,
    pf_pct: round2(selected.pf * 100, 3),
    target_pf: brief.targetPf,
    target_pct: round2(brief.targetPf * 100, 2),
    reliability_pct: round2((1 - selected.pf) * 100, 3),
    feasible: selected.feasible,
    printability_pass: selected.printabilityPass ?? !!(print.pass),
    pf_floor_pct: 0.001,
    governing_mode: selected.governing,
    sigma_y_req_mpa: round2(selected.sigma_y_req, 2),
    E_req_mpa: round2(selected.E_req, 0),
    min_width_mm: round2(print.min_width_mm ?? print.minWidth, 2),
    max_slenderness: round2(print.max_slenderness ?? print.maxSlenderness, 1),
    neighbour_ratio: round2(print.max_neighbour_width_ratio ?? print.maxNeighbourRatio, 2),
    printability_warn: !!(print.warnNeighbour || print.warnSlenderness),
    load_n: brief.loadN,
    deflection_limit_mm: brief.deflLimitMm,
    deflection_mm: round2(selected.deflection_mm, 2),
    part_type: brief.partType,
    process: brief.process,
    widths_mm: (selected.controlWidthsMm || []).map((w) => round2(w, 2)),
    conventional_mass_g: comparison && comparison.conventional ? round2(comparison.conventional.mass_g, 1) : null,
    conventional_pf_pct: comparison && comparison.conventional ? round2(comparison.conventional.pf * 100, 2) : null,
    family_scope: 'best of this bracket/lattice family',
    strain_req_pct: round2(selected.strain_req_pct, 2),
    elongation_mean_pct: round2(selected.elongation_mean_pct, 2),
    elongation_cv: round2(selected.elongation_cv, 3),
    pf_brittle: selected.pf_brittle,
    pf_brittle_bound: selected.pf_brittle_bound,
    brittle_ok: selected.brittle_ok,
    brittle_note: 'Separate brittleness check; an extra estimate, not included in the main failure chance because the link between stiffness and stretch is assumed.',
  };
  return { facts, target_pf: brief.targetPf, design: { control_widths_mm: facts.widths_mm } };
}

export function buildProofPayload({ brief, selected, proof, validation }) {
  const base = buildDesignMemoPayload({ brief, selected });
  const f = base.facts;
  const disclosure = massDisclosure(f.mass_g);
  const counts = validation && validation.counts
    ? { PASS: validation.counts.PASS, WARN: validation.counts.WARN, FAIL: validation.counts.FAIL }
    : { PASS: 45, WARN: 1, FAIL: 0 };
  const total = validation && (validation.total || validation.countsTotal) ? (validation.total || validation.countsTotal) : 46;
  const sustained = proof && proof.sustained ? proof.sustained : null;
  const recipe = proof && proof.recipe ? proof.recipe : null;
  return {
    facts: {
      ...f,
      mass_analytic_upper_bound_g: disclosure.analytic_upper_bound_g,
      analytic_upper_bound_pct: disclosure.upper_bound_pct,
      validation_passed: counts.PASS,
      validation_warn: counts.WARN,
      validation_total: total,
      family_scope: 'best of this bracket/lattice family',
      sustained_pf_bound: sustained ? round2(sustained.pf_bound, 6) : null,
      sustained_deflection_bound_mm: sustained ? round2(sustained.deflection_bound_mm, 2) : null,
      sustained_qualified: sustained ? sustained.pf_bound <= (brief.targetPf ?? 0.01) : null,
      strain_req_pct: proof && proof.brittle ? round2(proof.brittle.strain_req_pct, 2) : null,
      elongation_mean_pct: proof && proof.brittle ? round2(proof.brittle.elongation_mean_pct, 2) : null,
      elongation_cv: proof && proof.brittle ? round2(proof.brittle.elongation_cv, 3) : null,
      pf_brittle: proof && proof.brittle ? proof.brittle.pf_brittle : null,
      pf_brittle_bound: proof && proof.brittle ? proof.brittle.pf_brittle_bound : null,
      brittle_ok: proof && proof.brittle ? proof.brittle.brittle_ok : null,
      assumption_pf_min: proof && proof.assumptions ? proof.assumptions.pf_min : null,
      assumption_pf_max: proof && proof.assumptions ? proof.assumptions.pf_max : null,
      union_polished: proof && typeof proof.union_polished === 'boolean' ? proof.union_polished : null,
      union_evals: proof && proof.union_evals != null ? proof.union_evals : null,
      recipe_global_scale: recipe ? round2(recipe.global_equivalent_scale, 3) : null,
      recipe_added_mass_pct: recipe ? round2(recipe.added_mass_pct, 2) : null,
      recipe_pf: recipe ? round2(recipe.pf, 6) : null,
      recipe_verdict: recipe ? recipe.verdict : null,
      measurement_cv: recipe ? recipe.measurement_cv : null,
    },
    validation: { counts, total },
    brittle: proof && proof.brittle ? {
      strain_req_pct: round2(proof.brittle.strain_req_pct, 2),
      elongation_mean_pct: round2(proof.brittle.elongation_mean_pct, 2),
      elongation_cv: round2(proof.brittle.elongation_cv, 3),
      pf_brittle: proof.brittle.pf_brittle,
      pf_brittle_bound: proof.brittle.pf_brittle_bound,
      brittle_ok: proof.brittle.brittle_ok,
      included_in_headline: false,
      corr_E_elong_assumed: -0.25,
      note: proof.brittle.note,
    } : null,
    assumptions: proof && proof.assumptions ? proof.assumptions : null,
    union_polish: proof ? {
      polished: !!proof.union_polished,
      evals: proof.union_evals || 0,
      before_printed_g: proof.union_before_printed_g ?? null,
      after_printed_g: proof.union_after_printed_g ?? null,
    } : null,
    sustained: sustained ? {
      pf_bound: round2(sustained.pf_bound, 6),
      E_req_bound_MPa: round2(sustained.E_req_bound_MPa, 1),
      sigma_req_bound_MPa: round2(sustained.sigma_req_bound_MPa, 2),
      deflection_bound_mm: round2(sustained.deflection_bound_mm, 2),
      qualified: sustained.pf_bound <= (brief.targetPf ?? 0.01),
    } : null,
    recipe: recipe ? {
      width_multipliers: recipe.width_multipliers.map((v) => round2(v, 3)),
      global_equivalent_scale: round2(recipe.global_equivalent_scale, 3),
      added_mass_pct: round2(recipe.added_mass_pct, 2),
      pf: round2(recipe.pf, 6),
      verdict: recipe.verdict,
      measurement_cv: recipe.measurement_cv,
    } : null,
    proof: proof || null,
  };
}

/** Claims ladder from validation results (fallback: static ladder). */
export function claimsLadderFromValidation(validation) {
  const v = validation || {};
  if (Array.isArray(v.claimLadder) && v.claimLadder.length) {
    const human = {
      L0: { level: 'The maths', text: 'The equations and solver were checked independently.' },
      L1: { level: 'The code', text: 'The app reproduces the reference calculations.' },
      L2: { level: 'Material data', text: 'Material inputs come from published studies, not from your supplier.' },
      L3: { level: 'Lab comparison', text: 'A lab comparison is planned but not done yet.' },
      'L4–L6': { level: 'Real-world proof', text: 'No physical part tests and no certification.' },
    };
    return v.claimLadder.map((r) => {
      const id = r.id || r.level;
      const h = human[id] || null;
      return {
        level: h ? h.level : (r.level || r.id),
        title: r.level || r.id,
        text: h ? h.text : (r.text || r.evidence || ''),
        status: r.status || 'partial',
        tone: /achiev/i.test(r.status) ? 'green' : /partial/i.test(r.status) ? 'amber' : 'muted',
      };
    });
  }
  return claimsLadder();
}

/** Claims ladder shown in the UI (honest wording, fixed copy). */
export function claimsLadder() {
  return [
    { level: 'Checked', text: 'The maths and code were checked independently, including the mass and printability calculations.', tone: 'green' },
    { level: 'Supported', text: 'The design method is internally consistent and matches the stated assumptions. It covers this one bracket family.', tone: 'ink' },
    { level: 'Illustrative', text: 'Batch compensation, the long-term-load check and acceptance windows are early logic. They need your supplier data to be calibrated.', tone: 'amber' },
    { level: 'Not claimed', text: 'Real part performance, certification, fatigue or creep validation, strength across layer lines, or a general best-shape guarantee.', tone: 'muted' },
  ];
}

// Tiny numeric formatter kept here so payloads and AI fallbacks agree.
export const round2 = (v, d = 2) => {
  if (!Number.isFinite(v)) return v;
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

// Re-export a couple of engine helpers for the UI layer (no duplication).
export { E as engine, O as optimise };

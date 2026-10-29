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

export const OFFLINE_MODEL = 'offline-assistant';
export const OFFLINE_NOTE = 'Offline assistant (no Meta API)';

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
  });
}

export function presetLot(key) {
  const p = MATERIAL_PRESETS[key] || MATERIAL_PRESETS[DEFAULTS.preset];
  return {
    id: p.key,
    name: p.label,
    source: p.source,
    confidence: 1,
    E_mean: p.E_mean,
    E_cv: p.E_cv,
    sy_mean: p.sy_mean,
    sy_cv: p.sy_cv,
    rho: p.rho,
    corr: p.corr,
    lotFraction: p.lotFraction,
    withinFraction: p.withinFraction,
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
    source: extractedCount > 0 ? 'Pasted supplier text (offline heuristic)' : 'Preset fallback (no usable numbers found in text)',
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
  light: { name: 'Light profile', tagline: 'Lowest mass', rationale: 'Uniformly thin struts that should just clear the reliability target in the first pass — efficient, but the least forgiving when a lot runs weak.' },
  balanced: { name: 'Root-biased', tagline: 'Balanced', rationale: 'Moves material to the root and bottom chord where the cantilever moment peaks, keeping the tip light. The usual best trade-off for a bracket.' },
  conservative: { name: 'Conservative', tagline: 'Extra margin', rationale: 'Uniformly wider than the first-pass feasibility boundary — more mass and a lower failure probability, useful with highly variable feedstock.' },
};

function clampWidth(w) {
  return E.clamp(Number(w), GEOMETRY.wMin, GEOMETRY.wMax);
}

/** Build the three deterministic design priors from a first-pass feasibility width. */
export function fallbackPlan(brief, material, ctx) {
  const targetPf = brief.targetPf ?? DEFAULTS.targetPf;
  const feasible = O.feasibleUniformStart(material, ctx, targetPf);
  const w0 = Math.exp(feasible[0]);
  const d = 0.34;
  const candidates = [
    {
      id: 'light', ...CANDIDATE_META.light,
      controlWidthsMm: Array.from({ length: 8 }, () => clampWidth(w0 - 0.06)),
    },
    {
      id: 'balanced', ...CANDIDATE_META.balanced,
      controlWidthsMm: [
        clampWidth(w0 + d), clampWidth(w0 + d * 0.45), clampWidth(w0 + 0.04), clampWidth(w0 - d * 0.4),
        clampWidth(w0 + d * 0.8), clampWidth(w0 + d * 0.3), clampWidth(w0), clampWidth(w0 - d * 0.55),
      ],
    },
    {
      id: 'conservative', ...CANDIDATE_META.conservative,
      controlWidthsMm: Array.from({ length: 8 }, () => clampWidth(w0 + d * 1.15)),
    },
  ];
  return { candidates, model: OFFLINE_MODEL, fallback: true, targetPf, firstPassWidthMm: w0, note: 'Deterministic priors from a first-pass feasibility solve.' };
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
  const analysis = E.analyzeLattice(logWidth, ctx);
  const pf = E.probabilityOfFailure(analysis, material, 'lot');
  const modes = E.failureModes(analysis, material, 'lot');
  const printability = E.printabilityReport(analysis);
  const feasible = pf <= targetPf + 1e-12;
  const violation = Math.max(0, (pf - targetPf) / targetPf);
  const score = feasible ? analysis.mass_g : analysis.mass_g * (1 + 100 * violation);
  return {
    ...candidate,
    logWidth,
    analysis,
    mass_g: analysis.mass_g,
    pf,
    reliability: 1 - pf,
    feasible,
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
    const analysis = E.analyzeLattice(logWidth, ctx);
    const pf = E.probabilityOfFailure(analysis, material, 'lot');
    const modes = E.failureModes(analysis, material, 'lot');
    const printability = E.printabilityReport(analysis);
    const feasible = pf <= targetPf + 1e-12;
    const violation = Math.max(0, (pf - targetPf) / targetPf);
    const score = feasible ? analysis.mass_g : analysis.mass_g * (1 + 100 * violation);
    return {
      ...candidate,
      logWidth,
      analysis,
      mass_g: analysis.mass_g,
      pf,
      reliability: 1 - pf,
      feasible,
      score,
      governing: modes.governingLabel,
      printability,
      sigma_y_req: analysis.demands.sigma_y_req,
      E_req: analysis.demands.E_req,
      deflection_mm: analysis.deflectionScale / material.E_mean,
      optimisedFromPrior: true,
    };
  });
  optimised.sort((a, b) => {
    if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
    if (Math.abs(a.score - b.score) > 1e-9) return a.score - b.score;
    return a.mass_g - b.mass_g;
  });
  return optimised.map((c, i) => ({ ...c, rank: i + 1 }));
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
    `This direction lands at ${num(f.mass_g, 2)} g with a batch failure probability of ${pct(f.pf, 3)} against a ${pct(f.target_pf, 2)} target, so it is ${f.feasible ? 'inside' : 'outside'} the reliability requirement.`,
    `The binding failure mode is ${f.governing_mode || 'not computed'} — the root and lower chord carry most of the cantilever moment.`,
    `The required material demand is ${num(f.sigma_y_req_mpa, 2)} MPa strength and ${num(f.E_req_mpa, 0)} MPa stiffness, which is what drives the batch decision rather than the raw strength of the polymer.`,
    `Printability is ${f.printability_warn ? 'flagged' : 'within guidelines'}: minimum strut width ${num(f.min_width_mm, 2)} mm, maximum slenderness ${num(f.max_slenderness, 1)} and neighbour ratio ${num(f.neighbour_ratio, 2)}.`,
    `Next, I would keep this geometry and check the measured lot's modulus — that is the quantity that moves the failure probability most in the stiffness-governed regime.`,
  ].join(' ');
  return { memo, nextActions: ['Verify the measured lot E before printing', 'Open Prove to compute the batch passport'], model: OFFLINE_MODEL, fallback: true };
}

export function fallbackProofMemo(payload) {
  const f = payload && payload.facts ? payload.facts : payload || {};
  const memo = [
    `Qualification narrative: the selected design (${num(f.mass_g, 2)} g) meets a ${pct(f.target_pf, 2)} batch reliability target with a closed-form P_f of ${pct(f.pf, 3)} (${f.feasible ? 'pass' : 'fail'}).`,
    `The governing mode is ${f.governing_mode || 'not computed'}; the material demand is ${num(f.sigma_y_req_mpa, 2)} MPa at yield and ${num(f.E_req_mpa, 0)} MPa stiffness.`,
    `The batch acceptance window shows the lot-mean envelope in which the design stays inside the target; the passport translates a measured lot into a uniform width scale.`,
    `Key risk: feedstock distribution assumptions from literature-derived presets — replace them with the supplier's own lot data before production.`,
    `Recommended next test: measure lot E and σy on printed ISO 527-2 specimens from the incoming batch and re-run the passport.`,
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
// overlap at joints. Ratio from the validator's voxel-union estimate for the
// robust design: 32,692 mm³ union vs 40,921 mm³ analytic (≈ 20 % lower printed).
// We report the CONSERVATIVE analytic figure everywhere; this footnote keeps it honest.
// ---------------------------------------------------------------------------
export const MASS_UNION = {
  analyticMassG: 50.73,
  unionMassG: 40.54,
  analyticVolumeMm3: 40921,
  unionVolumeMm3: 32692,
  unionRatio: 32692 / 40921,
  validatorNote: 'Validator F4: analytic mass counts strut volumes before unioning at joints; voxel-union estimate is ~20 % lower.',
};
export function massDisclosure(analyticMassG) {
  const mass = Number.isFinite(analyticMassG) ? analyticMassG : MASS_UNION.analyticMassG;
  const union = mass * MASS_UNION.unionRatio;
  const pct = (1 - MASS_UNION.unionRatio) * 100;
  return {
    analytic_g: round2(mass, 2),
    union_estimate_g: round2(union, 1),
    difference_pct: round2(pct, 0),
    note: `Analytic mass counts strut volumes before unioning at joints; the union/printed estimate is ≈${round2(union, 1)} g (about ${round2(pct, 0)} % lower). We report the conservative figure. Comparison bars use the same analytic basis.`,
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
    counts: { PASS: 45, WARN: 1, FAIL: 0 },
    total: 46,
    runtime_s: 12.6,
    checks: [
      { id: 'A', title: 'FE element benchmarks', detail: 'A1–A7: axial, cantilever, rigid body, independent assembly, equilibrium, symmetry, linearity — 8/8 pass', status: 'pass' },
      { id: 'B', title: 'Independent solver', detail: 'Energy-minimisation cross-check of the assembled system — 2/2 pass', status: 'pass' },
      { id: 'C', title: 'Reliability closed form', detail: 'Closed-form bivariate P_f vs SciPy, high-precision quadrature and Monte-Carlo — 10/10 pass', status: 'pass' },
      { id: 'D', title: 'Optimiser robustness', detail: 'Brute-force grid + independent random search find no better feasible design — 5/5 pass', status: 'pass' },
      { id: 'E', title: 'Homogenisation check', detail: 'Periodic unit-cell energy/stress vs analytical truss scaling — 6/6 pass', status: 'pass' },
      { id: 'F', title: 'Mass & STL audit', detail: 'Joint-overlap mass over-count (known, conservative): analytic 40,921 mm³ vs 32,692 mm³ union (+25.2 % at the robust design)', status: 'warn' },
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
      massOvercount: 'Reported mass double-counts strut overlap (F4): +20.2 % at w=1, +28.7 % at w=2, +46.6 % at w=4; shipped robust design +25.2 % (union 32,692 mm³ vs analytic 40,921 mm³).',
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
  const facts = {
    mass_g: round2(a.mass_g),
    pf: selected.pf,
    pf_pct: round2(selected.pf * 100, 3),
    target_pf: brief.targetPf,
    target_pct: round2(brief.targetPf * 100, 2),
    reliability_pct: round2((1 - selected.pf) * 100, 3),
    feasible: selected.feasible,
    pf_floor_pct: 0.001,
    governing_mode: selected.governing,
    sigma_y_req_mpa: round2(selected.sigma_y_req, 2),
    E_req_mpa: round2(selected.E_req, 0),
    min_width_mm: round2(print.minWidth, 2),
    max_slenderness: round2(print.maxSlenderness, 1),
    neighbour_ratio: round2(print.maxNeighbourRatio, 2),
    printability_warn: !!(print.warnNeighbour || print.warnSlenderness),
    load_n: brief.loadN,
    deflection_limit_mm: brief.deflLimitMm,
    deflection_mm: round2(selected.deflection_mm, 2),
    part_type: brief.partType,
    process: brief.process,
    mass_union_g: massDisclosure(round2(a.mass_g, 2)).union_estimate_g,
    mass_union_diff_pct: massDisclosure(round2(a.mass_g, 2)).difference_pct,
    widths_mm: (selected.controlWidthsMm || []).map((w) => round2(w, 2)),
    conventional_mass_g: comparison && comparison.conventional ? round2(comparison.conventional.mass_g, 1) : null,
    conventional_pf_pct: comparison && comparison.conventional ? round2(comparison.conventional.pf * 100, 2) : null,
  };
  return { facts, target_pf: brief.targetPf, design: { control_widths_mm: facts.widths_mm } };
}

export function buildProofPayload({ brief, selected, proof, validation }) {
  const base = buildDesignMemoPayload({ brief, selected });
  const f = base.facts;
  const mass = massDisclosure(f.mass_g);
  const counts = validation && validation.counts
    ? { PASS: validation.counts.PASS, WARN: validation.counts.WARN, FAIL: validation.counts.FAIL }
    : { PASS: 45, WARN: 1, FAIL: 0 };
  const total = validation && (validation.total || validation.countsTotal) ? (validation.total || validation.countsTotal) : 46;
  return {
    facts: {
      ...f,
      mass_union_g: mass.union_estimate_g,
      mass_union_diff_pct: mass.difference_pct,
      accepted_lot_scale: proof && proof.passport && proof.passport.scale ? round2(proof.passport.scale, 3) : null,
      acceptance_window_slope: null,
      validation_passed: counts.PASS,
      validation_warn: counts.WARN,
      validation_total: total,
    },
    validation: { counts, total },
    proof: proof || null,
  };
}

/** Claims ladder from validation results (fallback: static ladder). */
export function claimsLadderFromValidation(validation) {
  const v = validation || {};
  if (Array.isArray(v.claimLadder) && v.claimLadder.length) {
    return v.claimLadder.map((r) => ({
      level: r.id || r.level,
      title: r.level || r.id,
      text: r.text || r.evidence || '',
      status: r.status || 'partial',
      tone: /achiev/i.test(r.status) ? 'green' : /partial/i.test(r.status) ? 'amber' : 'muted',
    }));
  }
  return claimsLadder();
}

/** Claims ladder shown in the UI (honest wording, fixed copy). */
export function claimsLadder() {
  return [
    { level: 'Verified', text: 'FE element benchmarks, closed-form reliability vs SciPy/quadrature/Monte-Carlo, mass and STL audits', tone: 'green' },
    { level: 'Supported', text: 'Batch-distribution reliability and robust design *under the stated model assumptions*', tone: 'ink' },
    { level: 'Illustrative', text: 'Batch passport compensation and acceptance windows (v0.1 logic, needs supplier calibration)', tone: 'amber' },
    { level: 'Not claimed', text: 'Physical part performance, certification, fatigue, creep, out-of-plane or layer-normal strength', tone: 'muted' },
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

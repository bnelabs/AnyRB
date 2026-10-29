/**
 * AnyRB demo — single source of truth for defaults.
 *
 * EVERY provisional / calibrated number lives in this file so the Lead can
 * recalibrate the demo with one edit. The UI and engine read only from here.
 * Contract: PRODUCT_SPEC.md §2 (geometry, loads, FE), §3 (feedstock presets),
 * §4 (metrics), §5 (app requirements), §10 (honesty).
 *
 * Calibration status: CALIBRATED against the canonical Python engine
 * (engine/make_fixtures.py → app/tests/fixtures/reference.json).
 */

// ---------------------------------------------------------------------------
// 1. Reference product geometry & loads (PRODUCT_SPEC.md §2)
// ---------------------------------------------------------------------------
export const GEOMETRY = {
  padWidth: 10,      // mm — solid wall pad, x = 0..10 (all DOF at x=10 fixed)
  cell: 20,          // mm — square lattice cell edge
  nx: 7,             // cells along x  => 8 node columns
  ny: 3,             // cells along y  => 4 node rows
  depth: 10,         // mm — out-of-plane extrusion depth t
  padVolume: 6000,   // mm³ — 10 × 60 × 10, solid (spec §2)
  uLim: 2.5,         // mm — max |v| at tip nodes
  wMin: 1.0,         // mm — strut in-plane width clip (§2)
  wMax: 4.0,         // mm
};

// Derived full envelope (kept here so the UI never hardcodes geometry).
GEOMETRY.Lx = GEOMETRY.padWidth + GEOMETRY.nx * GEOMETRY.cell; // 150 mm
GEOMETRY.Ly = GEOMETRY.ny * GEOMETRY.cell;                    // 60 mm

export const LOAD = {
  F: 150,            // N — total downward force, split equally over the 4 tip nodes
  direction: -1,     // −y (down)
};

// ---------------------------------------------------------------------------
// 2. Feedstock presets (PRODUCT_SPEC.md §3, calibrated v0.1)
//    E, sigma_y in MPa; rho in g/cm³; corr = corr(ln E, ln sigma_y).
//    lotFraction / withinFraction scale the PRESET CV for the two-level model
//    (research/01: ≈85 % of the variance is between lots, ≈15 % within lots):
//      CV_lot = 0.92195·CV_preset, CV_within = 0.38730·CV_preset,
//      with 0.92195² + 0.38730² = 1 so CV_lot² + CV_within² = CV_preset².
//    Reliability (P_f) is evaluated at LOT level (spec §3), i.e. with CV_lot.
// ---------------------------------------------------------------------------
export const MATERIAL_PRESETS = {
  rPETG: {
    key: 'rPETG',
    label: 'rPETG · printed',
    name: 'rPETG printed (in-plane strength)',
    process: 'FDM/FFF',
    E_mean: 2100, E_cv: 0.10,
    sy_mean: 46.0, sy_cv: 0.10,
    rho: 1.24, corr: 0.55,
    elongationMean: 4.0, elongationCv: 0.20, corrEElong: -0.25,
    printProcessOk: true,
    processNote: 'printed in-plane data — valid for a printed lattice',
    lotFraction: 0.92195,
    withinFraction: 0.38730,
    source: 'R07: printed rPETG, ISO 527-2 in-plane strength 46.5 MPa (library); E 2100 MPa; doi:10.3221/igf-esis.70.18.',
    note: 'σy is the printed in-plane strength (ISO 527-2, R07). Out-of-plane / layer-normal loading is not modelled in v0.1.',
  },
  rPET: {
    key: 'rPET',
    label: 'rPET · bottle (IM)',
    name: 'rPET (bottle-grade recyclate, injection moulding)',
    process: 'IM',
    E_mean: 2500, E_cv: 0.12,
    sy_mean: 45.0, sy_cv: 0.15,
    rho: 1.34, corr: 0.60,
    elongationMean: 3.5, elongationCv: 0.25, corrEElong: -0.25,
    printProcessOk: false,
    processNote: 'injection-moulding data — contrast only, not valid for a printed lattice',
    lotFraction: 0.92195,
    withinFraction: 0.38730,
    source: 'rPET studies; spec §3 (provisional).',
    note: 'Provisional v0.1: literature-derived, not a supplier datasheet. Replace with your lot data.',
  },
  rHDPE: {
    key: 'rHDPE',
    label: 'rHDPE · PCR',
    name: 'rHDPE (post-consumer recyclate)',
    process: 'IM/compression',
    E_mean: 950, E_cv: 0.22,
    sy_mean: 28.0, sy_cv: 0.17,
    rho: 0.95, corr: 0.55,
    elongationMean: 14.0, elongationCv: 0.30, corrEElong: -0.25,
    printProcessOk: false,
    processNote: 'injection/compression data — contrast only, not valid for a printed lattice',
    lotFraction: 0.92195,
    withinFraction: 0.38730,
    source: 'Cecon 2023 (modulus range); Eriksen 2019; PNAS 2025 — as cited in spec §1.',
    note: 'Headline recyclate: wide lot-to-lot variation is the reason this product exists.',
  },
  rPP: {
    key: 'rPP',
    label: 'rPP · PCR',
    name: 'rPP (post-consumer recyclate)',
    process: 'IM',
    E_mean: 1100, E_cv: 0.18,
    sy_mean: 27.0, sy_cv: 0.13,
    rho: 0.94, corr: 0.50,
    elongationMean: 25.0, elongationCv: 0.45, corrEElong: -0.25,
    printProcessOk: false,
    processNote: 'injection data — contrast only, not valid for a printed lattice',
    lotFraction: 0.92195,
    withinFraction: 0.38730,
    source: 'PCR-PP lot-drift literature; spec §3 (provisional).',
    note: 'Provisional v0.1: literature-derived, not a supplier datasheet. Replace with your lot data.',
  },
};
// Numeric material fields only (what the engine consumes).
export function numericMaterial(presetKey) {
  const p = MATERIAL_PRESETS[presetKey];
  if (!p) throw new Error('Unknown material preset: ' + presetKey);
  return {
    preset: p.key,
    E_mean: p.E_mean, E_cv: p.E_cv,
    sy_mean: p.sy_mean, sy_cv: p.sy_cv,
    rho: p.rho, corr: p.corr,
    process: p.process,
    printProcessOk: p.printProcessOk,
    elongationMean: p.elongationMean,
    elongationCv: p.elongationCv,
    corrEElong: p.corrEElong,
    lotFraction: p.lotFraction,
    withinFraction: p.withinFraction,
  };
}

// ---------------------------------------------------------------------------
// 3. Defaults for the app (calibrated against the canonical Python engine)
// ---------------------------------------------------------------------------
export const DEFAULTS = {
  preset: 'rPETG',
  material: numericMaterial('rPETG'),

  // 8 log-width control points: x_norm ∈ {0,1/3,2/3,1} × y_norm ∈ {0,1}.
  // Index k = yRow*4 + xIdx (yRow 0 = bottom edge, 1 = top edge).
  // Reference design: uniform 2.0 mm lattice (fixture case uniform_w2.0).
  designLogWidth: Array.from({ length: 8 }, () => Math.log(2.0)),
  designLabel: 'uniform 2.0 mm',

  F: LOAD.F,           // N
  uLim: GEOMETRY.uLim, // mm
  targetPf: 0.01,      // reliability target (spec §2.3)

  // Deterministic Monte-Carlo configuration (seed shown in the UI).
  // Reliability is evaluated at LOT level (spec §3): every MC draw is a
  // possible lot/batch mean. `nLots` controls the two-level demonstration only.
  seed: 20251029,
  nMc: 5000,           // spec §5: live Monte-Carlo < 300 ms at 5,000 samples
  nLots: 25,           // lots shown in the two-level feedstock preview
  nWithin: 8,          // specimens per lot drawn in that preview
  lotQ: 0.66,          // default measured-lot quality index (shows a compensation recipe)
  lotERatio: 1.0,      // default measured lot mean E / reference mean E
};

// ---------------------------------------------------------------------------
// 4. Optimiser / sensitivity settings
// ---------------------------------------------------------------------------
export const OPTIMIZER = {
  stepSchedule: [0.35, 0.175, 0.0875, 0.04375, 0.021875, 0.0109375, 0.00546875, 0.002734375],
  minStep: 0.002,
  // Deterministic multi-start: smallest feasible uniform width + these widths (mm).
  startWidths: [2.0, 2.2, 2.5, 3.0, 3.6],
  maxEvals: 2400,            // hard budget; typical run ≈ 300–800 evals
  penaltyFactor: 100,        // spec §2.3: score = m·(1 + 100·max(0,(Pf−target)/target))
  nominalFoS: 1.5,           // spec §2.3 baseline: deterministic factor of safety
  uniformBisectionIters: 70, // width sweep resolution for uniform baselines
  scaleMin: 1.0,             // spec §2.4 batch-adaptive scale s ∈ [1, 1.5]
  scaleMax: 1.5,
  scalePass: 1.15,           // verdict: pass ≤ 1.15, conditional ≤ 1.5
  statusLabel: 'provisional v0.1',
};

// ---------------------------------------------------------------------------
// 5. UI slider ranges
// ---------------------------------------------------------------------------
export const UI_RANGES = {
  E_mean: [300, 3500],      // MPa
  E_cv: [0.02, 0.45],
  sy_mean: [5, 80],         // MPa
  sy_cv: [0.02, 0.45],
  corr: [-0.6, 0.9],
  targetPf: [0.001, 0.05],
  F: [50, 300],             // N
  uLim: [0.5, 5.0],         // mm
  width: [1.0, 4.0],        // mm (design control points)
  nLots: [3, 60],
  lotQ: [0.60, 1.20],       // batch quality index q = mean σy / reference mean σy
  lotE: [0.60, 1.40],       // lot mean E / reference mean E
};

// ---------------------------------------------------------------------------
// 6. Copy, honesty & citations (spec §5 sections 1 and 8, §10)
// ---------------------------------------------------------------------------
export const APP_META = {
  title: 'AnyRB',
  subtitle: 'Any Recycled Batch — AI reliability studio for recycled-polymer parts',
  thesis:
    'Design the internal geometry for the batch distribution — then adapt the print recipe to the lot you actually received. No physical testing required to use it; the physics, statistics and material data are virtual.',
  version: 'v0.3 · review-response',
  calibration:
    'Calibrated v0.1 demo. Physics cross-checked against the canonical Python engine (fixture: app/tests/fixtures/reference.json).',
  strengthNote:
    'rPETG σy is the printed in-plane strength measured on printed ISO 527-2 specimens (R07: 46 MPa, CV 10 %) — not a layer-normal or out-of-plane strength. Out-of-plane loading is not modelled in v0.1.',
  disclaimer:
    'In-silico only. Not a certification tool. Material distributions are literature-derived, the model is a linear-elastic plane-frame idealisation, and nothing here has been physically tested. Results are the best of this bracket/lattice family — not a general topology optimiser. Validate with your own lot data and physical tests before production.',
};

export const CITATIONS = [
  {
    id: 'PNAS 2025',
    text: 'Georgiou, Sun, Liu & Athanasiou, PNAS 122(33):e2502613122 (2025) — nacre-inspired recycled-HDPE architecture: measured modulus CV 18 % → 4 %. The widely quoted “up to 93 %” reduction is relative to their modelled 26 % baseline, not the measured starting CV.',
    doi: '10.1073/pnas.2502613122',
    url: 'https://doi.org/10.1073/pnas.2502613122',
  },
  {
    id: 'Cecon 2023',
    text: 'Cecon et al., Waste Management (2023) — recycled-HDPE modulus across US MRFs, ~380–1,250 MPa.',
    doi: '10.1016/j.wasman.2023.09.002',
    url: 'https://doi.org/10.1016/j.wasman.2023.09.002',
  },
  {
    id: 'Eriksen 2019',
    text: 'Eriksen et al., Waste Management (2019) — rHDPE tensile strength 22–50 MPa, elongation 11–18 %.',
    doi: '10.1016/j.wasman.2019.07.005',
    url: 'https://doi.org/10.1016/j.wasman.2019.07.005',
  },
  {
    id: 'ACS 2025',
    text: '“A Nearly Zero-Cost Lot-by-Lot Inspection of Recycled Plastics”, ACS Sustain. Resour. Manage. (2025) — per-lot proxy basis for batch passports.',
    doi: '10.1021/acssusresmgt.5c00040',
    url: 'https://doi.org/10.1021/acssusresmgt.5c00040',
  },
  {
    id: 'R07 · rPETG',
    text: 'R07 (research/01 printability dossier) — printed rPETG, ISO 527-2 in-plane strength 46.5 MPa; the preset uses 46.0 MPa with CV 10 %.',
    doi: '10.3221/igf-esis.70.18',
    url: 'https://doi.org/10.3221/igf-esis.70.18',
  },
];

// Calibration marker surfaced in the UI + exported files.
export const CALIBRATION = {
  status: 'calibrated',
  values: 'verified feedstock library + spec v0.1 calibrated defaults',
  note: 'Geometry, material presets, two-level split and reference numbers are cross-checked against app/tests/fixtures/reference.json.',
};


// ---------------------------------------------------------------------------
// v0.3 review-response contract (JS mirrors the Python reference)
// ---------------------------------------------------------------------------
export const V03 = {
  branding: { name: 'AnyRB', full: 'Any Recycled Batch', tagline: 'AI reliability studio for recycled-polymer parts' },
  printedMass: { res: 0.25, margin: 4.0, note: 'Deterministic voxel union of strut boxes + wall pad; analytic mass is a conservative upper bound.' },
  printability: { maxNeighbourWidthRatio: 1.5, maxSlenderness: 30.0, enforcement: 'Final selected design must pass both (advisory manufacturing caps enforced in the optimiser).' },
  measurementCvDefault: 0.12,
  creepFactor: 2.0,
  compressionFactor: 0.8,
  sustainedNote: 'Advisory sustained-load / creep bound: stiffness demand x2.0 and compression strength /0.8. NOT the static design allowable; if the bound fails the part is not qualified for sustained load.',
  familyScope: 'best of this bracket/lattice family',
  qcDefaults: { lotId: '', supplier: '', recycledContentPct: null },
  qcNote: 'Recycled-content % is a paperwork claim (not simulated or verified).',
  reference: {
    robust_analytic_mass_g: 50.81,
    robust_printed_mass_g: 46.34,
    python_robust_printed_mass_g: 46.40,
    uniform2_printed_mass_g: 53.97,
    uniform2_analytic_mass_g: 60.32,
  },
};


// ---------------------------------------------------------------------------
// v0.4 remaining-gaps contract
// ---------------------------------------------------------------------------
export const V04 = {
  printedProcesses: ['FDM/FFF'],
  processGateNote: 'Material data is for an injection/compression process — not valid for a printed lattice. Pick rPETG (printed, FDM/FFF) or treat this preset as contrast only.',
  brittleNote: 'Brittle-lot screen is a marginal lognormal P(elongation < strain demand). It is a conservative ADD-ON, NOT included in the headline two-property P_f because the E–elongation correlation is assumed (-0.25).',
  brittleCaveat: 'Elongation-vs-E correlation assumed -0.25 (unmeasured).',
  assumptionNote: 'Varies two unmeasured assumptions — corr(lnE, lnσy) 0.30/0.70 and lot-vs-within split 75/95% — and shows the P_f range. This is assumption sensitivity, NOT validation.',
  unionPolish: { nHalton: 10000, maxEvals: 90, acceptFactor: 0.999 },
  qcNotUsedNote: 'Recorded for traceability only — NOT used in the simulation (no calibrated proxy).',
};

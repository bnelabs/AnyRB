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
// When the standalone HTML is opened from file://, relative /api URLs would
// resolve to the filesystem. Point them at the local backend explicitly; the
// server enables CORS for this local-only workflow. Served from 8787, relative
// URLs remain same-origin.
const _loc = typeof location !== 'undefined' ? location : null;
const _file = !!_loc && _loc.protocol === 'file:';
const _localServedElsewhere = !!_loc && /^(127\.0\.0\.1|localhost)$/.test(_loc.hostname) && _loc.port !== '8787';
export const API = { base: (_file || _localServedElsewhere) ? 'http://127.0.0.1:8787' : '' };
export const apiUrl = (path) => `${API.base}${path}`;

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
    label: 'rPETG · 3D-printed',
    name: 'Recycled PETG (printed test parts)',
    process: 'FDM/FFF',
    E_mean: 2100, E_cv: 0.10,
    sy_mean: 46.0, sy_cv: 0.10,
    rho: 1.24, corr: 0.55,
    elongationMean: 4.0, elongationCv: 0.20, corrEElong: -0.25, elongationLotVarianceFraction: 0.50,
    printProcessOk: true,
    processNote: 'printed test data — valid for this model',
    lotFraction: 0.92195,
    withinFraction: 0.38730,
    source: 'Published tests of 3D-printed recycled PETG',
    sourceDetails: 'Printed rPETG tensile tests (ISO 527-2). Study DOI 10.3221/igf-esis.70.18. The preset uses E 2,100 MPa and strength 46 MPa, CV 10%.',
    note: 'Strength comes from printed test parts pulled in the print direction. Loading across layer lines is not covered by this model.',
  },
  rPET: {
    key: 'rPET',
    label: 'rPET · moulded (comparison only)',
    name: 'Recycled PET (moulded — comparison only)',
    process: 'IM',
    E_mean: 2500, E_cv: 0.12,
    sy_mean: 45.0, sy_cv: 0.15,
    rho: 1.34, corr: 0.60,
    elongationMean: 3.5, elongationCv: 0.25, corrEElong: -0.25, elongationLotVarianceFraction: 0.60,
    printProcessOk: false,
    processNote: 'moulded-part data — comparison only, not valid for a printed design',
    lotFraction: 0.92195,
    withinFraction: 0.38730,
    source: 'Published studies of moulded recycled PET',
    sourceDetails: 'Literature ranges used as an early comparison set; not supplier data.',
    note: 'A good example of why batch data matters: stretch at break varies widely between batches.',
  },
  rHDPE: {
    key: 'rHDPE',
    label: 'rHDPE · comparison only',
    name: 'Recycled HDPE (moulded — comparison only)',
    process: 'IM/compression',
    E_mean: 950, E_cv: 0.22,
    sy_mean: 28.0, sy_cv: 0.17,
    rho: 0.95, corr: 0.55,
    elongationMean: 14.0, elongationCv: 0.30, corrEElong: -0.25, elongationLotVarianceFraction: 0.55,
    printProcessOk: false,
    processNote: 'moulded-part data — comparison only, not valid for a printed design',
    lotFraction: 0.92195,
    withinFraction: 0.38730,
    source: 'Published studies of recycled HDPE',
    sourceDetails: 'Modulus and strength ranges compiled from Cecon 2023, Eriksen 2019 and the PNAS 2025 study.',
    note: 'A good example of why this tool exists: batch-to-batch spread is the main problem.',
  },
  rPP: {
    key: 'rPP',
    label: 'rPP · comparison only',
    name: 'Recycled PP (moulded — comparison only)',
    process: 'IM',
    E_mean: 1100, E_cv: 0.18,
    sy_mean: 27.0, sy_cv: 0.13,
    rho: 0.94, corr: 0.50,
    elongationMean: 25.0, elongationCv: 0.45, corrEElong: -0.25, elongationLotVarianceFraction: 0.60,
    printProcessOk: false,
    processNote: 'moulded-part data — comparison only, not valid for a printed design',
    lotFraction: 0.92195,
    withinFraction: 0.38730,
    source: 'Published studies of recycled PP over 15 months',
    sourceDetails: 'Ten recycled-PP batches; stretch at break ranged from 10% to 100%. Literature ranges are an early estimate, not supplier data.',
    note: 'A good example of why batch data matters: stretch at break varies widely between batches.',
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
    elongationLotVarianceFraction: p.elongationLotVarianceFraction ?? 0.5,
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
  statusLabel: 'early estimate',
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
  subtitle: 'Any Recycled Batch — design software for recycled-plastic parts',
  thesis:
    'Two workspaces: an open consistency record that shows a result only when a measurement links this product and this result, and a 2-D bracket studio that simulates one printed bracket. Product names, presets and the bracket model are not measurements.',
  version: 'v0.5 · consistency record',
  calibration:
    'Demo version. The calculations were cross-checked against a separate reference implementation.',
  strengthNote:
    'The PETG strength number comes from printed test parts pulled in the print direction. It does not describe strength across layer lines, and this model does not cover that loading direction.',
  disclaimer:
    'Use this to compare designs and batches before you print. The numbers come from a model, so confirm the final choice with a physical test before production.',
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
  processGateNote: 'This preset comes from moulded parts, not printed ones. Pick rPETG (3D-printed) or use this preset only for comparison.',
  brittleNote: 'A separate brittleness check: how likely the printed material is to crack before the part stretches as far as the model needs. It is an extra estimate, not a formal upper limit, and it is not included in the main failure chance because the link between stiffness and stretch is assumed (-0.25). The warning threshold is fixed at 1%.',
  brittleCaveat: 'Assumes a typical link between stiffness and stretch (not measured).',
  assumptionNote: 'Shows how the failure chance moves if two unmeasured inputs are different: the stiffness–strength link (0.30/0.70) and the split between batch-to-batch and within-batch variation (75/95%). This is a sensitivity check, not validation.',
  unionPolish: { nHalton: 10000, maxEvals: 90, acceptFactor: 0.999 },
  qcNotUsedNote: 'Kept for the record only — not used in the model (no calibration yet).',
};


// ---------------------------------------------------------------------------
// v0.5 open consistency record
// ---------------------------------------------------------------------------
export const V05 = {
  storageKey: 'anyrb.consistency.v1',
  recordSchema: 'anyrb.consistency/v1',
  outcomeModes: ['link', 'batch', 'missing'],
  note: 'A product name, a material preset, an assumed CV and the bracket model are not measured links. A result is shown only from a measurement of this product and this result, with a named source and what varied. One batch stays one batch. No measurement means the result stays blank with the test still needed.',
  threeDNote: 'No generic 3-D simulator is added. A 3-D model is applicable only when the result depends on shape and the required measured density (mass) or measured modulus and strength (strength/stiffness) is present. Sound insulation is not a structural 3-D result. The bracket studio remains a labelled 2-D simulation for the bracket only.',
};

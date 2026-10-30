/**
 * AnyRB v0.6 — evidence map and the one allowed evidence-backed calculation.
 *
 * The evidence map is the gate. A citation, a literature mean, an assumed CV,
 * a coupon result, a model, or the historical bracket solver is not a measured
 * link for the open record. Only the PNAS 2025 {8,5} platelet-matrix case is
 * encoded as a calculation, and it stays a simulation.
 *
 * Data is deliberately small and explicit; the human-readable source is
 * research/06-evidence-map.md and research/evidence_map.json.
 */

import { blankCalculation } from './consistency.js';

export const EVIDENCE_VERSION = 'v0.6-evidence-map';
export const EVIDENCE_MAP_MD = 'research/06-evidence-map.md';
export const EVIDENCE_MAP_JSON = 'research/evidence_map.json';

export const GRADE_LABELS = {
  measured_on_product_class: 'Measured on that product class',
  model_only: 'Model only',
  absent: 'Absent',
};

export const PNAS_DOI = '10.1073/pnas.2502613122';
export const PNAS_PMID = '40794839';
export const PNAS_PMC = 'PMC12377729';

export const EVIDENCE_ROWS = [
  {
    id: 'pnas-2025-8x5-modulus',
    productClass: 'Nacre-inspired rHDPE-platelet / PDMS-matrix composite',
    detail: 'Fabricated {8,5} tensile specimen, 195 × 53 mm; platelet volume fraction 70.7 %',
    result: 'Effective tensile modulus (E_eff)',
    inputVaried: 'rHDPE platelet modulus: 50 specimens from 10 plates; mean 1,350 MPa, SD 239 MPa, CV 17.7 %',
    measured: 'Uniaxial tension of 5 fabricated {8,5} composite specimens; feedstock modulus by ASTM D638-I; PDMS/rHDPE interface by ASTM D3163 lap shear',
    sampleSize: 'Composite n = 5; feedstock n = 50 / 10 plates',
    moved: 'Measured composite E_eff CV 4 % versus 18 % in the feedstock. The model predicted 3 % for this case. Measured strength 0.22 MPa, CV 13 %. The measured absolute E_eff mean is not reported.',
    type: 'experiment',
    notCovered: 'Structural products, sheets, acoustics, counterweights, other polymers, delivered batch variation, 3-D/large-strain/creep/fatigue, a user’s product',
    grade: 'measured_on_product_class',
    source: 'Georgiou, Sun, Liu & Athanasiou, PNAS 122(33):e2502613122 (2025)',
    doi: PNAS_DOI,
    pmid: PNAS_PMID,
    pmcid: PNAS_PMC,
    locator: 'Model–Experiment Comparison; Fig. 5; SI Tables S2–S5',
    calcEligible: true,
  },
  {
    id: 'pnas-2025-8x7-stretch-film-model',
    productClass: 'Industrial HDPE stretch film, modelled {8,7} architecture',
    detail: 'No film was fabricated or tested',
    result: 'Effective modulus and maximum permissible strain',
    inputVaried: 'Modelled constituent distributions; total introduced variability ≈ 26 % (RSS); Vpl/Vtotal 82.4 %',
    measured: 'Nothing on a stretch film. Input rHDPE distribution came from the measured feedstock; interfaces were tuned assumptions; 200 simulations',
    sampleSize: '200 simulations; 0 film specimens',
    moved: 'Model E_eff 554 ± 10 MPa, CV 2 %; ε_W 0.10 ± 0.01; 93 % reduction relative to a modelled 26 % total introduced variability; ≥68 % ε_W reduction. Model only.',
    type: 'model',
    notCovered: 'No tested film, no product measurement, no user product, no acoustic, structural or counterweight result',
    grade: 'model_only',
    source: 'Georgiou et al., PNAS 2025, Case Study',
    doi: PNAS_DOI,
    pmid: PNAS_PMID,
    pmcid: PNAS_PMC,
    locator: 'Case Study; Fig. 6; SI Table S4',
    calcEligible: false,
  },
  {
    id: 'wpc-profile-formulation-2024',
    productClass: 'Extruded wood-plastic composite profile (rHDPE + sawdust)',
    detail: 'Formulation link, not a batch link',
    result: 'Tensile strength, modulus, density, impact, water absorption',
    inputVaried: 'Sawdust 55–70 wt %, rHDPE 25–40 wt %, coupling agent 1–3 %; one recyclate source',
    measured: 'ASTM D638 Type IV tensile specimens machined from the finished profile; D570, D1822, D2240, helium pycnometry',
    sampleSize: 'n = 5 per formulation; 13 design runs + initial formulation',
    moved: 'Tensile strength 19.37 ± 1.68 → 12.53 ± 1.88 MPa; E 1,427.5 ± 127.2 → 2,206.7 ± 304.6 → 1,782.1 ± 119.3 MPa; density 1.20–1.34 g/cm³; impact 4.30 ± 0.68 → 8.18 ± 2.25 kJ/m²; water absorption 1.83–2.41 %',
    type: 'experiment',
    notCovered: 'Full-size profile/deck span test; no recyclate batch variation; one source; no sound insulation; no counterweight',
    grade: 'measured_on_product_class',
    source: 'Oliveros-Gaviria et al., Polymers 2024, 16(22):3136',
    doi: '10.3390/polym16223136',
    locator: '§3.1, Tables 9–13',
    calcEligible: false,
  },
  {
    id: 'wpc-board-formulation-2022',
    productClass: 'WPC boards for decking-timber / outdoor-parquet use, 4 × 180 × 220 mm',
    detail: 'Formulation link, not a batch link',
    result: 'Flexural strength/modulus, tensile strength/modulus, elongation, density, Shore D',
    inputVaried: 'Tetra Pak box vs pine wood flour at 0/10/20/30/40 % in recycled PE; 6 groups',
    measured: 'ASTM D790 3-point bending on specimens from actual boards; ASTM D638-I tensile; ASTM D2240',
    sampleSize: '4 boards/group, 4 specimens/board/test = 16 specimens per test; 24 boards',
    moved: 'Density 942–1,017 kg/m³; flexural strength 13.5–19.8 MPa; flexural modulus up to 999 MPa; tensile strength and elongation decrease with wood flour; Shore D 51.3–57.4',
    type: 'experiment',
    notCovered: 'Full-size deck-board span/load test; one recycled-PE source; no batch variation; no acoustics; no counterweight',
    grade: 'measured_on_product_class',
    source: 'Bal, BioResources 2022, 17(4):6569–6577',
    doi: '10.15376/biores.17.4.6569-6577',
    locator: 'Experimental; Tables 2–4',
    calcEligible: false,
  },
  {
    id: 'recycled-hdpe-lumber-product-2020',
    productClass: 'Full-size commercial recycled-HDPE plastic lumber, 140 × 38 mm',
    detail: 'Product test; input varied is product type, not recyclate',
    result: 'Flexural modulus/strength, 180-day flexural creep',
    inputVaried: 'Recycled-HDPE lumber vs WPC lumber; not a recyclate batch or mix',
    measured: 'ASTM D6109 4-point bending; 180-day creep at 7.5/15/30 % Fb; ASTM D6815 fractional-deflection criterion',
    sampleSize: 'n = 5 per group; 30 specimens total; 5 per creep group',
    moved: 'HDPE lumber E 0.93 ± 0.03 GPa, Fb 14.1 ± 0.70 MPa; WPC lumber E 4.34 ± 0.26 GPa, Fb 41.2 ± 4.53 MPa; 180-day fractional deflection 2.71/3.88/5.11 (HDPE) vs 1.22/1.33/1.28 (WPC)',
    type: 'experiment',
    notCovered: 'No recyclate source/batch variation; one commercial product; no acoustics; no counterweight',
    grade: 'measured_on_product_class',
    source: 'Alrubaie, Lopez-Anido & Gardner, Polymers 2020, 12(2):262',
    doi: '10.3390/polym12020262',
    locator: 'Table 1; Tables 2–3; §3.3',
    calcEligible: false,
  },
  {
    id: 'pipe-compound-coupons-2021',
    productClass: 'Double-wall corrugated pipe compound — injection-moulded coupons only',
    detail: 'Not a pipe test',
    result: 'Tensile, flexural and impact coupon properties',
    inputVaried: 'Recycled vs non-recycled HDPE/PPR blends 5–55 wt %',
    measured: 'ASTM D638/D790/Izod coupons',
    sampleSize: '≥5 specimens per composition; 13 formulations with/without compatibiliser',
    moved: 'FS 19.05 ± 4.11 → 24.42 ± 3.72 MPa; FM 554 ± 11 → 1,342 ± 22 MPa; TS 16.08 ± 4.52 → 24.44 ± 6.95 MPa',
    type: 'coupon',
    notCovered: 'No finished pipe; no ISO 9969 ring stiffness; no pipe impact; no product-class result',
    grade: 'absent',
    source: 'Wang et al., ACS Omega 2021, 6(30):19705–19716',
    doi: '10.1021/acsomega.1c02354',
    locator: 'Tables 1, 4–5',
    calcEligible: false,
  },
  {
    id: 'counterweight-mass',
    productClass: 'Counterweight / ballast product',
    detail: 'No measured product link found',
    result: 'Mass',
    inputVaried: 'Recycled plastic type, batch, mix, contamination',
    measured: 'No qualifying primary product test found',
    sampleSize: '—',
    moved: 'None. A library density is not a measured density of the stream.',
    type: 'absent',
    notCovered: 'Measured stream density, measured volume, finished counterweight mass',
    grade: 'absent',
    source: 'No qualifying source',
    calcEligible: false,
    blockedTest: 'Measure the density of the recycled stream and the volume of the actual counterweight, then weigh the product. A library density is not a substitute.',
  },
  {
    id: 'sound-insulation-sheet',
    productClass: 'Sound-insulation sheet / panel',
    detail: 'No verified acoustic product link found',
    result: 'Sound insulation (absorption / transmission loss)',
    inputVaried: 'Recycled plastic type, batch, mix, filler',
    measured: 'No verified primary sheet test with reported numbers. One acoustic-panel paper was abstract-only.',
    sampleSize: 'Not verified',
    moved: 'None verified',
    type: 'absent',
    notCovered: 'Acoustic measurement, thickness-to-insulation test, transmission loss, a sheet product',
    grade: 'absent',
    source: 'Candidate DOI 10.2478/sjce-2021-0003 (abstract only); no transmission-loss source found',
    calcEligible: false,
    blockedTest: 'Measure sound insulation on the same sheet build with a named acoustic method (e.g. impedance tube or transmission-loss suite). A structural or 3-D model cannot substitute.',
  },
  {
    id: 'other-plastic-mix-contamination-product',
    productClass: 'Another plastic, a mix, or a contaminated stream — any finished product',
    detail: 'Coupon-level evidence only; not a product-class link',
    result: 'Modulus, strength, elongation, mass, thickness, sound insulation',
    inputVaried: 'Polymer type, mix, minor contamination',
    measured: 'Material coupons: e.g. 10 % PET in PP gave +41.2 % tensile modulus and −46.8 % elongation; 10 % ABS/PS with a weld line gave −17.5 % strength and >80 % elongation loss; even 3 % contamination lowered strength',
    sampleSize: 'Coupon study, not a product',
    moved: 'Coupon-level numbers only; no finished-product result',
    type: 'coupon',
    notCovered: 'Finished product, product class, batch link',
    grade: 'absent',
    source: 'Polymers 2024, DOI 10.3390/polym16162301',
    doi: '10.3390/polym16162301',
    calcEligible: false,
    blockedTest: 'Measure the chosen result on the actual product built from the stream. Coupon or library data cannot fill this record.',
  },
  {
    id: 'recyclate-batch-any-product',
    productClass: 'Any finished product vs a varying recyclate lot / batch',
    detail: 'The headline gap of the primary search',
    result: 'Any product result',
    inputVaried: 'Delivered recyclate lot / batch',
    measured: 'No primary study found',
    sampleSize: '—',
    moved: 'None',
    type: 'absent',
    notCovered: 'A measured product-class result against batch variation',
    grade: 'absent',
    source: 'No qualifying source; see 06b-primary-links.md',
    calcEligible: false,
  },
];

export const CALC_CASE = {
  id: 'pnas-2025-8x5-modulus',
  label: 'PNAS 2025 · {8,5} platelet–matrix composite (modulus)',
  shortLabel: 'PNAS {8,5} platelet–matrix modulus',
  doi: PNAS_DOI,
  pmcid: PNAS_PMC,
  architecture: {
    N: 8,
    M: 5,
    plateletLengthMm: 20,
    plateletHeightMm: 8,
    plateletWidthMm: 4.75,
    cohesiveThicknessMm: 3,
    specimenMm: '195 × 53',
    plateletVolumeFraction: 0.707,
    ct: 'σmax,CT W(7.00, 0.15) MPa; δe 0.80 mm; δcr N(1.20, 0.18²) mm',
    cs: 'τmax,CS W(7.00, 0.20) MPa; δe 0.40 mm; δcr N(0.80, 0.12²) mm',
  },
  paperDistribution: {
    label: 'Paper’s measured rHDPE platelets',
    meanMPa: 1350,
    cvPct: 17.7,
    n: 50,
    source: 'PNAS 2025: 50 ASTM D638-I specimens from 10 rHDPE plates',
  },
  measuredCvRatio: 0.04 / 0.18,
  sourceNote: 'Measured rHDPE-platelet / PDMS-matrix {8,5} composite: n = 5, E_eff scatter reduced from 18 % to 4 % on those specimens; the paper does not report an absolute measured E_eff mean. The 93 % stretch-film model result is not used.',
  minimumSamples: 3,
  z90: 1.6448536269514722,
};

const CASE_BY_ID = { [CALC_CASE.id]: CALC_CASE };

export function getCalcCase(id) {
  return CASE_BY_ID[id] || null;
}

export function evidenceRowForCalc(id) {
  return EVIDENCE_ROWS.find((row) => row.id === id) || null;
}

export function defaultCalculationState() {
  return blankCalculation();
}

function finitePositive(value) {
  return Number.isFinite(value) && value > 0;
}
function finiteNonNegative(value) {
  return Number.isFinite(value) && value >= 0;
}

/**
 * Check only the inputs required by the PNAS case. The caller passes the
 * selected result metadata (kind, unit, target) so this module stays free of
 * the record engine.
 */
export function calcAvailability(calc, resultMeta) {
  const c = calc || blankCalculation();
  const caseDef = getCalcCase(c.caseId);
  const missing = [];
  let testNeeded = '';

  if (!caseDef) {
    missing.push('Select the PNAS {8,5} platelet–matrix case.');
    testNeeded = 'Select the evidence case and confirm the product class.';
    return { ok: false, missing, testNeeded, caseDef: null };
  }
  if (!resultMeta || resultMeta.kind !== 'stiffness') {
    missing.push('The matching result must be a modulus / stiffness result.');
    testNeeded = 'Add a modulus or stiffness result with a target range in MPa.';
    return { ok: false, missing, testNeeded, caseDef };
  }
  if (String(resultMeta.unit || '').trim().toLowerCase() !== 'mpa') {
    missing.push('The result unit must be MPa for this case.');
    testNeeded = 'Set the matching result unit to MPa.';
    return { ok: false, missing, testNeeded, caseDef };
  }
  if (!resultMeta.target || !resultMeta.target.valid) {
    missing.push('The matching result needs a valid target range.');
    testNeeded = 'Set both target bounds on the matching result.';
    return { ok: false, missing, testNeeded, caseDef };
  }
  if (c.productConfirmed !== true) {
    missing.push('Confirm that the product is the platelet–matrix composite kind, not just a typed name.');
    testNeeded = 'Confirm the product class. This case does not apply to arbitrary products.';
    return { ok: false, missing, testNeeded, caseDef };
  }

  let selected = null;
  let distributionMissing = false;
  if (c.distributionMode === 'paper') {
    selected = { ...caseDef.paperDistribution, mode: 'paper' };
  } else {
    const m = c.measured || {};
    const before = missing.length;
    if (!finitePositive(m.meanMPa)) missing.push('Enter a measured recyclate stiffness mean.');
    if (!finitePositive(m.cvPct)) missing.push('Enter a measured recyclate stiffness CV.');
    if (!(Number.isFinite(m.n) && m.n >= caseDef.minimumSamples)) missing.push('Enter at least 3 measured specimens/lots for the recyclate distribution.');
    if (!String(m.source || '').trim()) missing.push('Name the source of the measured recyclate distribution.');
    distributionMissing = missing.length > before;
    if (!distributionMissing) {
      selected = { meanMPa: m.meanMPa, cvPct: m.cvPct, n: m.n, source: m.source, mode: 'measured' };
    }
  }

  let baselineMissing = false;
  const b = c.baseline || {};
  if (!finitePositive(b.inputMeanMPa)) { missing.push('Enter the recyclate mean at which the composite baseline was measured.'); baselineMissing = true; }
  if (!finitePositive(b.outputMeanMPa)) { missing.push('Enter the measured baseline effective modulus of the composite.'); baselineMissing = true; }
  if (!(Number.isFinite(b.n) && b.n >= caseDef.minimumSamples)) { missing.push('Enter at least 3 measured baseline specimens.'); baselineMissing = true; }
  if (!String(b.source || '').trim()) { missing.push('Name the source of the measured composite baseline.'); baselineMissing = true; }

  if (missing.length) {
    if (distributionMissing && baselineMissing) {
      testNeeded = 'Measure the recyclate stiffness distribution (mean, CV, n ≥ 3, named source) and the composite’s effective modulus at a known recyclate mean (n ≥ 3, named source). The paper reports the 18 %→4 % CV ratio but no absolute measured mean, so an absolute MPa range needs both.';
    } else if (distributionMissing) {
      testNeeded = 'Measure the recyclate stiffness mean and CV on at least 3 specimens/lots with a named source, then enter them here.';
    } else {
      testNeeded = 'Measure the composite’s effective modulus at a known recyclate mean (n ≥ 3, named source). The paper reports the 18 %→4 % CV ratio but no absolute measured mean, so an absolute MPa range needs your own baseline.';
    }
    return { ok: false, missing, testNeeded, caseDef, selected };
  }
  return { ok: true, missing: [], testNeeded: '', caseDef, selected, baseline: b };
}

/**
 * Baseline-anchored, case-scaled simulation. Returns null if incomplete.
 * This is NOT the paper's full UATSC model and is never a physical result.
 */
export function calculatePnasCase(calc, resultMeta) {
  const availability = calcAvailability(calc, resultMeta);
  if (!availability.ok) return { ok: false, availability, result: null };
  const c = calc;
  const caseDef = availability.caseDef;
  const selected = availability.selected;
  const b = c.baseline;

  const meanOut = b.outputMeanMPa * (selected.meanMPa / b.inputMeanMPa);
  const cvOut = (selected.cvPct / 100) * caseDef.measuredCvRatio;
  const sdOut = meanOut * cvOut;
  const p5 = meanOut - caseDef.z90 * sdOut;
  const p95 = meanOut + caseDef.z90 * sdOut;
  const target = resultMeta.target;
  const inside = p5 >= target.min && p95 <= target.max;

  return {
    ok: true,
    availability,
    result: {
      simulation: true,
      caseId: caseDef.id,
      caseLabel: caseDef.label,
      meanMPa: meanOut,
      cvPct: cvOut * 100,
      sdMPa: sdOut,
      p5MPa: p5,
      p95MPa: p95,
      rangeLabel: 'P5–P95',
      inside,
      target,
      selectedDistribution: selected,
      baseline: { inputMeanMPa: b.inputMeanMPa, outputMeanMPa: b.outputMeanMPa, n: b.n, source: b.source },
      measuredCvRatio: caseDef.measuredCvRatio,
      measuredCvReductionPct: (1 - caseDef.measuredCvRatio) * 100,
      sourceNote: caseDef.sourceNote,
      methodNote: 'Baseline-anchored case scaling: the selected recyclate mean scales the measured baseline mean; the selected CV is multiplied by the measured 18 %→4 % CV ratio. P5/P95 assume a normal output distribution. This is a simulation.',
      notYourProduct: 'This is the PNAS {8,5} platelet–matrix case, not a physical test of your product. Every number is a simulation until a physical test of the same product exists.',
    },
  };
}

export function evidenceSummary() {
  const counts = { measured_on_product_class: 0, model_only: 0, absent: 0 };
  for (const row of EVIDENCE_ROWS) counts[row.grade] = (counts[row.grade] || 0) + 1;
  return { counts, total: EVIDENCE_ROWS.length };
}

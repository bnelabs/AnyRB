/**
 * AnyRB — shop mechanics and build selection.
 *
 * Pure functions: no DOM, no network, no storage. Every property is calculated
 * from the user's plastic swing and the part section. A proposal is shown only
 * when its calculated property range sits inside the target range across the
 * swing. The winner is the passing build with the least added material.
 */

export const G = 9.80665;
export const MODES = [
  { key: 'cantilever', label: 'Held at one end' },
  { key: 'simple', label: 'Held at both ends' },
  { key: 'compression', label: 'Stood upright, pushed down' },
];
export const CASE_PRESETS = {
  bracket: {
    product: 'shelf bracket', mode: 'cantilever', spanMm: 180, widthMm: 40, thicknessMm: 10,
    target: { property: 'strength', min: 11.5, max: 16.5 },
    extraTargets: [{ property: 'weight', min: 90, max: 110 }],
  },
  slat: {
    product: 'deck slat', mode: 'simple', spanMm: 900, widthMm: 60, thicknessMm: 12,
    target: { property: 'stiffness', min: 0.3, max: 0.5 },
    extraTargets: [{ property: 'weight', min: 550, max: 650 }],
  },
  crate: {
    product: 'crate side', mode: 'simple', spanMm: 400, widthMm: 60, thicknessMm: 15,
    target: { property: 'strength', min: 95, max: 115 },
    extraTargets: [{ property: 'weight', min: 320, max: 360 }],
    plastic: {
      type: 'published measured rHDPE', batch: 'single-supplier stretch-film lot (n=50)',
      mix: '', dirt: '', dirtLevel: 'none',
      eMin: 1111, eMax: 1589, sMin: 41.6, sMax: 48.4, density: 0.94,
    },
    steady: { available: false, type: '', eMpa: 0, sMpa: 0 },
  },
  planter: {
    // A thin wall panel carried at both ends. (An earlier version treated
    // this panel as a compression post and overstated what it carries;
    // a 4 mm panel buckles long before it crushes.)
    product: 'planter wall', mode: 'simple', spanMm: 300, widthMm: 180, thicknessMm: 4,
    target: { property: 'strength', min: 9, max: 12 },
    extraTargets: [{ property: 'weight', min: 180, max: 230 }],
  },
  pallet: {
    product: 'pallet block', mode: 'compression', spanMm: 150, widthMm: 150, thicknessMm: 80,
    target: { property: 'strength', min: 15000, max: 20000 },
    extraTargets: [{ property: 'weight', min: 1500, max: 1800 }],
  },
};

/**
 * Starting ranges for a delivery when the shop has no measurements of its own.
 * These are published bands, not measurements of any delivery: the first from
 * data/CASE_STUDY.md (R01/R04), the rest from data/feedstock_library.json
 * (published mean ± published variation per polymer). The page says where a
 * range came from whenever one is applied.
 */
export const PUBLISHED_BATCHES = [
  {
    key: 'rhdpe-measured-lot',
    label: 'Recycled HDPE — one supplier, published measured lot',
    plastic: { type: 'published measured rHDPE', eMin: 1111, eMax: 1589, sMin: 41.6, sMax: 48.4, density: 0.94 },
    note: 'Published lot: stiffness from one supplier’s measured plates (1,350 ± 239 MPa, n=50), strength from a published rHDPE table. Not a measurement of your delivery.',
  },
  {
    key: 'rhdpe',
    label: 'Recycled HDPE — typical published range',
    plastic: { type: 'recycled HDPE', eMin: 741, eMax: 1159, sMin: 23, sMax: 33, density: 0.95 },
    note: 'Typical published band for recycled HDPE. Not a measurement of your delivery — replace it with your supplier’s numbers when you have them.',
  },
  {
    key: 'rpp',
    label: 'Recycled polypropylene — typical published range',
    plastic: { type: 'recycled polypropylene', eMin: 902, eMax: 1298, sMin: 23, sMax: 31, density: 0.94 },
    note: 'Typical published band for recycled polypropylene. Not a measurement of your delivery — replace it with your supplier’s numbers when you have them.',
  },
  {
    key: 'mixed-polyolefins',
    label: 'Mixed plastics — typical published range (wide)',
    plastic: { type: 'mixed plastics', eMin: 560, eMax: 1040, sMin: 14, sMax: 22, density: 0.93 },
    thinEvidence: true,
    note: 'Typical published band measured on mixed polyolefins (kinds of plastic mixed together). The published evidence here is thin — the source library grades it D and says not to use it for load-bearing claims — so the band is wide. Not a measurement of your delivery.',
  },
  {
    key: 'rpet',
    label: 'Recycled PET — typical published range',
    plastic: { type: 'recycled PET', eMin: 2200, eMax: 2800, sMin: 38, sMax: 52, density: 1.34 },
    note: 'Typical published band for recycled PET. Not a measurement of your delivery — replace it with your supplier’s numbers when you have them.',
  },
  {
    key: 'rpetg',
    label: 'Recycled PETG — typical published range',
    plastic: { type: 'recycled PETG', eMin: 1890, eMax: 2310, sMin: 41, sMax: 51, density: 1.24 },
    note: 'Typical published band for recycled PETG. Not a measurement of your delivery — replace it with your supplier’s numbers when you have them.',
  },
  {
    key: 'rldpe',
    label: 'Recycled LDPE — typical published range',
    plastic: { type: 'recycled LDPE', eMin: 188, eMax: 312, sMin: 8, sMax: 12, density: 0.92 },
    thinEvidence: true,
    note: 'Typical published band for recycled LDPE. The published evidence here is thin — the source library grades it D and says not to use it for load-bearing claims. Not a measurement of your delivery — replace it with your supplier’s numbers when you have them.',
  },
];

export function publishedBatchByKey(key) {
  return PUBLISHED_BATCHES.find((batch) => batch.key === key) || null;
}

export function publishedBatchFor(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return null;
  if (/mixed polyolefin|mixed plastics?/.test(t)) return PUBLISHED_BATCHES.find((b) => b.key === 'mixed-polyolefins');
  // A delivery naming two or more kinds of plastic is a mixed delivery:
  // it uses the wide published mixed range, labelled as exactly that,
  // rather than asking the user to repeat what they already said.
  const kinds = [
    /ldpe/.test(t), /hdpe/.test(t), /petg/.test(t),
    /\bpet\b|polyethylene terephthalate/.test(t),
    /polypropylene|\bpp\b/.test(t), /\babs\b/.test(t), /\bpvc\b/.test(t),
  ].filter(Boolean).length;
  if (kinds >= 2) return PUBLISHED_BATCHES.find((b) => b.key === 'mixed-polyolefins');
  if (/ldpe/.test(t)) return PUBLISHED_BATCHES.find((b) => b.key === 'rldpe');
  if (/petg/.test(t)) return PUBLISHED_BATCHES.find((b) => b.key === 'rpetg');
  if (/\bpet\b|polyethylene terephthalate/.test(t)) return PUBLISHED_BATCHES.find((b) => b.key === 'rpet');
  if (/hdpe/.test(t)) {
    return /single|one supplier|measured lot/.test(t)
      ? PUBLISHED_BATCHES.find((b) => b.key === 'rhdpe-measured-lot')
      : PUBLISHED_BATCHES.find((b) => b.key === 'rhdpe');
  }
  if (/polypropylene|\bpp\b/.test(t)) return PUBLISHED_BATCHES.find((b) => b.key === 'rpp');
  return null;
}

/**
 * The single mix-in values a blend actually uses. Entered numbers are used
 * as entered; a published range is used at its weak end (eMin/sMin), never
 * at its strong end and never as an average — the conservative end is the
 * one a blend can be checked against.
 */
function effectiveSteadyValues(steady) {
  if (steady && steady.source === 'published') {
    const batch = publishedBatchByKey(steady.publishedKey);
    if (batch) return { eMpa: batch.plastic.eMin, sMpa: batch.plastic.sMin };
  }
  return {
    eMpa: steady && Number.isFinite(Number(steady.eMpa)) ? Number(steady.eMpa) : 0,
    sMpa: steady && Number.isFinite(Number(steady.sMpa)) ? Number(steady.sMpa) : 0,
  };
}

export function steadyValues(stateInput) {
  const state = normalizeState(stateInput);
  return effectiveSteadyValues(state.steady);
}

function validTreatedRanges(treated) {
  return Boolean(treated)
    && treated.eMin > 0 && treated.eMax >= treated.eMin
    && treated.sMin > 0 && treated.sMax >= treated.sMin;
}

/**
 * Whether sorting/washing builds exist at all: the shop must declare the
 * treatment available, and its outcome must be specified either by valid
 * entered ranges ('numbers') or by a resolvable published range
 * ('published'). A published key alone does not invent entered ranges, and
 * entered ranges alone are not a published outcome.
 */
function isTreatedAvailable(state) {
  if (!state || !state.treated || state.treated.available !== true) return false;
  if (state.treated.source === 'published') return Boolean(publishedBatchByKey(state.treated.publishedKey));
  return validTreatedRanges(state.treated);
}

function treatedRoutePhrase(state) {
  if (state.treated && state.treated.source === 'published') {
    const batch = publishedBatchByKey(state.treated.publishedKey);
    if (batch) return `the published range for ${batch.plastic.type} you picked`;
  }
  return 'the ranges you entered';
}

export const PROPERTIES = [
  { key: 'strength', label: 'Strength', unit: 'kg', verb: 'carries', noun: 'strength' },
  { key: 'stiffness', label: 'Stiffness', unit: 'N/mm', verb: 'holds', noun: 'stiffness' },
  { key: 'weight', label: 'Weight', unit: 'g', verb: 'weighs', noun: 'weight' },
  { key: 'none', label: 'No load to check', unit: 'g', verb: 'weighs', noun: 'weight' },
];
export const MOVES = ['current', 'thickness', 'section', 'span', 'other', 'blend', 'treated'];
export const PROPERTY_DEFAULTS = {
  strength: { min: 11.5, max: 16.5 },
  stiffness: { min: 3.5, max: 5.5 },
  weight: { min: 90, max: 110 },
};
const MODE_KEYS = new Set(MODES.map((m) => m.key));
const PROPERTY_KEYS = new Set(PROPERTIES.map((p) => p.key));

export const DEFAULT_STATE = {
  product: '',
  mode: 'cantilever',
  spanMm: 0,
  widthMm: 0,
  thicknessMm: 0,
  target: { property: '', min: '', max: '' },
  extraTargets: [],
  plastic: {
    type: 'recycled polypropylene',
    batch: 'April delivery',
    mix: '20% HDPE',
    dirt: 'paper labels',
    dirtLevel: 'light',
    eMin: 700,
    eMax: 850,
    sMin: 14,
    sMax: 18,
    density: 0.94,
  },
  steady: { available: true, type: 'stiffer bottle stream', source: 'numbers', publishedKey: '', eMpa: 2000, sMpa: 40 },
  other: {
    product: 'heavier part',
    mode: 'cantilever',
    spanMm: 260,
    widthMm: 50,
    thicknessMm: 16.5,
    targetProperty: '',
    targetMin: '',
    targetMax: '',
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clean(value, max = 160) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function num(value, fallback) {
  if (value === '' || value == null) return fallback;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

function round(value, digits = 1) {
  const step = 10 ** digits;
  return Math.round(value * step) / step;
}

export function inferMode(name) {
  const text = clean(name).toLowerCase();
  if (/(pallet|block|post|column|leg|pillar|spacer|stand)/.test(text)) return 'compression';
  if (/(bracket|arm|cantilever)/.test(text)) return 'cantilever';
  return 'simple';
}

function normalizePart(raw, fallback, blank = false) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const base = fallback || DEFAULT_STATE;
  const product = clean(source.product, 120) || clean(source.name, 120) || (blank ? '' : base.product);
  const mode = MODE_KEYS.has(source.mode)
    ? source.mode
    : (blank ? '' : (fallback ? inferMode(product) : base.mode));
  const span = num(source.spanMm ?? source.span_mm, 0);
  const width = num(source.widthMm ?? source.width_mm, 0);
  const thickness = num(source.thicknessMm ?? source.thickness_mm, 0);
  return {
    product,
    mode,
    spanMm: span > 0 ? clamp(span, 20, 6000) : 0,
    widthMm: width > 0 ? clamp(width, 2, 800) : 0,
    thicknessMm: thickness > 0 ? clamp(thickness, 1, 400) : 0,
    targetProperty: PROPERTY_KEYS.has(source.targetProperty) ? source.targetProperty : '',
    targetMin: source.targetMin === '' || source.targetMin == null ? '' : num(source.targetMin, 0),
    targetMax: source.targetMax === '' || source.targetMax == null ? '' : num(source.targetMax, 0),
  };
}

export function blankState() {
  return clone(DEFAULT_STATE);
}

function normalizeTarget(raw, fallback) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const fallbackProperty = fallback && PROPERTY_KEYS.has(fallback.property) ? fallback.property : '';
  const property = PROPERTY_KEYS.has(source.property) ? source.property : fallbackProperty;
  if (property === 'none') return { property: 'none', min: '', max: '' };
  const rawMin = num(source.min, null);
  const rawMax = num(source.max, null);
  const min = rawMin == null ? '' : rawMin;
  const max = rawMax == null ? '' : rawMax;
  return {
    property,
    min: min === '' || max === '' ? min : Math.min(min, max),
    max: min === '' || max === '' ? max : Math.max(min, max),
  };
}

export function normalizeState(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const target = source.target && typeof source.target === 'object' ? source.target : {};
  const rawExtraTargets = Array.isArray(source.extraTargets) ? source.extraTargets : [];
  const plastic = source.plastic && typeof source.plastic === 'object' ? source.plastic : {};
  const other = source.other && typeof source.other === 'object' ? source.other : {};
  const blank = source.blank === true;
  const rangeSource = source.rangeSource === 'numbers' ? 'numbers' : (source.rangeSource === 'published' ? 'published' : '');
  const targetFallback = blank ? { property: '', min: '', max: '' } : DEFAULT_STATE.target;
  const primaryTarget = normalizeTarget(target, targetFallback);
  const extraTargets = rawExtraTargets
    .filter((item) => item && typeof item === 'object' && PROPERTY_KEYS.has(item.property) && item.property !== 'none')
    .slice(0, 5)
    .map((item) => normalizeTarget(item, targetFallback));
  const eMin = blank
    ? Math.max(0, num(plastic.eMin ?? plastic.stiffness_min_mpa, 0))
    : clamp(num(plastic.eMin ?? plastic.stiffness_min_mpa, DEFAULT_STATE.plastic.eMin), 1, 200000);
  const eMax = blank
    ? Math.max(eMin, num(plastic.eMax ?? plastic.stiffness_max_mpa, 0))
    : clamp(num(plastic.eMax ?? plastic.stiffness_max_mpa, DEFAULT_STATE.plastic.eMax), eMin, 200000);
  const sMin = blank
    ? Math.max(0, num(plastic.sMin ?? plastic.strength_min_mpa, 0))
    : clamp(num(plastic.sMin ?? plastic.strength_min_mpa, DEFAULT_STATE.plastic.sMin), 0.1, 5000);
  const sMax = blank
    ? Math.max(sMin, num(plastic.sMax ?? plastic.strength_max_mpa, 0))
    : clamp(num(plastic.sMax ?? plastic.strength_max_mpa, DEFAULT_STATE.plastic.sMax), sMin, 5000);
  const product = clean(source.product, 120);
  const span = num(source.spanMm, 0);
  const width = num(source.widthMm, 0);
  const thickness = num(source.thicknessMm, 0);
  return {
    // The blank marker must survive re-normalisation: without it, a state
    // that started blank quietly refills the default plastic ranges the
    // moment a product exists, and the app calculates against a delivery
    // nobody entered.
    blank,
    rangeSource,
    product,
    mode: MODE_KEYS.has(source.mode) ? source.mode : (blank ? '' : (product ? inferMode(product) : DEFAULT_STATE.mode)),
    spanMm: span > 0 ? clamp(span, 20, 6000) : 0,
    widthMm: width > 0 ? clamp(width, 2, 800) : 0,
    thicknessMm: thickness > 0 ? clamp(thickness, 1, 400) : 0,
    target: primaryTarget,
    extraTargets,
    plastic: {
      type: blank ? clean(plastic.type, 160) : (clean(plastic.type, 160) || DEFAULT_STATE.plastic.type),
      batch: blank ? clean(plastic.batch, 120) : (clean(plastic.batch, 120) || DEFAULT_STATE.plastic.batch),
      mix: clean(plastic.mix, 160),
      dirt: clean(plastic.dirt, 160),
      dirtLevel: ['none', 'light', 'moderate', 'heavy'].includes(plastic.dirtLevel)
        ? plastic.dirtLevel
        : (blank ? 'none' : 'light'),
      eMin,
      eMax,
      sMin,
      sMax,
      density: blank ? Math.max(0, num(plastic.density, 0)) : clamp(num(plastic.density, DEFAULT_STATE.plastic.density), 0.05, 5),
    },
    treated: {
      available: source.treated?.available === true,
      source: source.treated?.source === 'published' ? 'published' : 'numbers',
      publishedKey: publishedBatchByKey(source.treated?.publishedKey) ? source.treated.publishedKey : '',
      eMin: Math.max(0, num(source.treated?.eMin, 0)),
      eMax: Math.max(0, num(source.treated?.eMax, 0)),
      sMin: Math.max(0, num(source.treated?.sMin, 0)),
      sMax: Math.max(0, num(source.treated?.sMax, 0)),
    },
    steady: {
      available: source.steady?.available === true,
      type: clean(source.steady?.type, 100),
      source: source.steady?.source === 'published' ? 'published' : 'numbers',
      publishedKey: publishedBatchByKey(source.steady?.publishedKey) ? source.steady.publishedKey : '',
      eMpa: clamp(num(source.steady?.eMpa, 0), 0, 200000),
      sMpa: clamp(num(source.steady?.sMpa, 0), 0, 5000),
    },
    other: normalizePart(other, blank ? { product: '', mode: 'cantilever', spanMm: 0, widthMm: 0, thicknessMm: 0 } : {
      ...DEFAULT_STATE.other,
      product: clean(other.product, 120) || DEFAULT_STATE.other.product,
      mode: MODE_KEYS.has(other.mode) ? other.mode : inferMode(other.product || DEFAULT_STATE.other.product),
    }, blank),
  };
}

export function isReady(stateInput) {
  const state = normalizeState(stateInput);
  if (!state.product) return false;
  // How the part is held only matters if something structural is being
  // checked. A weight-only or no-load part may lie flat with no load path.
  const needsMode = [state.target, ...state.extraTargets]
    .some((t) => t && (t.property === 'strength' || t.property === 'stiffness'));
  if (needsMode && !MODE_KEYS.has(state.mode)) return false;
  if (!(state.spanMm > 0 && state.widthMm > 0 && state.thicknessMm > 0)) return false;
  const targets = [state.target, ...state.extraTargets];
  if (!targets.length) return false;
  for (const target of targets) {
    if (target.property === 'none') continue;
    if (!PROPERTY_KEYS.has(target.property)) return false;
    if (!Number.isFinite(target.min) || !Number.isFinite(target.max)) return false;
    if (target.min > target.max) return false;
    if (!(target.max > 0)) return false;
  }
  if (targets.length === 1 && targets[0].property === 'none') {
    return state.plastic.density > 0;
  }
  if (!(state.plastic.eMin > 0 && state.plastic.eMax >= state.plastic.eMin)) return false;
  if (!(state.plastic.sMin > 0 && state.plastic.sMax >= state.plastic.sMin)) return false;
  if (!(state.plastic.density > 0)) return false;
  return true;
}

export function allTargets(stateInput) {
  const state = normalizeState(stateInput);
  return [state.target, ...state.extraTargets];
}

export function propertyMeta(property) {
  return PROPERTIES.find((p) => p.key === property) || PROPERTIES[0];
}

export function currentPart(state) {
  return {
    product: state.product,
    mode: state.mode,
    spanMm: state.spanMm,
    widthMm: state.widthMm,
    thicknessMm: state.thicknessMm,
  };
}

export function otherPart(state) {
  return {
    product: state.other.product,
    mode: state.other.mode,
    spanMm: state.other.spanMm,
    widthMm: state.other.widthMm,
    thicknessMm: state.other.thicknessMm,
  };
}

function area(part) {
  return part.widthMm * part.thicknessMm;
}

function inertia(part) {
  return (part.widthMm * part.thicknessMm ** 3) / 12;
}

function weakInertia(part) {
  // Weak axis: long side times the short side cubed. A part in compression
  // buckles about this axis first.
  const a = part.widthMm;
  const b = part.thicknessMm;
  return (Math.max(a, b) * Math.min(a, b) ** 3) / 12;
}

/** Load capacity in newtons for a given modulus/strength pair. */
export function capacityN(part, eMpa, sMpa) {
  if (part.mode === 'compression') {
    const squash = sMpa * area(part);
    const euler = (Math.PI ** 2 * eMpa * weakInertia(part)) / part.spanMm ** 2;
    return Math.min(squash, euler);
  }
  if (part.mode === 'cantilever') {
    return (sMpa * part.widthMm * part.thicknessMm ** 2) / (6 * part.spanMm);
  }
  return (2 * sMpa * part.widthMm * part.thicknessMm ** 2) / (3 * part.spanMm);
}

/** Spring rate in N/mm for a modulus. */
export function stiffness(part, eMpa) {
  if (part.mode === 'compression') return (eMpa * area(part)) / part.spanMm;
  if (part.mode === 'cantilever') return (3 * eMpa * inertia(part)) / part.spanMm ** 3;
  return (48 * eMpa * inertia(part)) / part.spanMm ** 3;
}

/** Mass in grams at a density in g/cm3. */
export function massG(part, density) {
  return (density * part.widthMm * part.thicknessMm * part.spanMm) / 1000;
}

/** Stiffness asked in shop terms: a weight pressing on the part and how far
 * it may bend under it. Returns the stiffness window in N/mm, or null. */
export function stiffnessRangeFromLoadBend(loadKg, bendMm, bendMinMm = 0) {
  if (!(loadKg > 0) || !(bendMm > 0) || bendMinMm < 0 || (bendMinMm > 0 && bendMinMm > bendMm)) return null;
  const low = (loadKg * 9.80665) / bendMm;
  const high = bendMinMm > 0 ? (loadKg * 9.80665) / bendMinMm : low * 10;
  return { min: low, max: Math.max(high, low) };
}

/** Material for one part after the shop's own waste/reject allowance. */
export function effectiveMassG(massGValue, wastePct = 0) {
  const waste = Math.min(Math.max(Number(wastePct) || 0, 0), 95);
  return massGValue * (1 + waste / 100);
}

/** Order and stock totals for a build, with waste counted per part. */
export function productionTotals({ massG: partMassG, runSize = 0, haveKg = 0, wastePct = 0 }) {
  const perPartG = effectiveMassG(partMassG, wastePct);
  const needKg = runSize > 0 ? (perPartG * runSize) / 1000 : 0;
  const canMake = haveKg > 0 && perPartG > 0 ? Math.floor((haveKg * 1000) / perPartG) : 0;
  const covers = runSize > 0 && haveKg > 0 ? haveKg >= needKg : null;
  return {
    perPartG,
    needKg,
    baseNeedKg: runSize > 0 ? (partMassG * runSize) / 1000 : 0,
    canMake,
    covers,
    shortKg: covers === false ? needKg - haveKg : 0,
    leftKg: covers ? haveKg - needKg : 0,
    moreParts: covers && perPartG > 0 ? Math.floor(((haveKg - needKg) * 1000) / perPartG) : 0,
  };
}

/** Plastic cost of one part of a build, or null when a needed price is missing.
 * `treatLossPct` is the share of the delivery lost in sorting/washing: the
 * treated plastic in one part took more raw delivery than the part weighs. */
export function buildCostPerPart(build, { batchPricePerKg = 0, steadyPricePerKg = 0, treatPricePerKg = 0, treatLossPct = 0, wastePct = 0 } = {}) {
  if (!(build && build.massG > 0) || !(batchPricePerKg > 0)) return null;
  // Money and material must agree: a part that needs waste making it
  // costs for the waste too, exactly as the order total counts it.
  const massKg = effectiveMassG(build.massG, wastePct) / 1000;
  if (build.move === 'blend' && build.fraction) {
    if (!(steadyPricePerKg > 0)) return null;
    return massKg * ((1 - build.fraction) * batchPricePerKg + build.fraction * steadyPricePerKg);
  }
  if (build.move === 'treated') {
    if (!(treatPricePerKg > 0)) return null;
    const loss = Math.min(Math.max(Number(treatLossPct) || 0, 0), 95);
    const rawKg = massKg / (1 - loss / 100);
    return rawKg * batchPricePerKg + massKg * treatPricePerKg;
  }
  return massKg * batchPricePerKg;
}

/** Stock allocation when the first order goes first. Returns parts made. */
export function allocatePriority(stockKg, first, second) {
  const stockG = Math.max(0, stockKg) * 1000;
  const firstMade = first.usageG > 0 ? Math.min(first.qty, Math.floor(stockG / first.usageG)) : 0;
  const remainingG = stockG - firstMade * (first.usageG || 0);
  const secondMade = second.usageG > 0 ? Math.min(second.qty, Math.floor(remainingG / second.usageG)) : 0;
  return { firstMade, secondMade, leftG: remainingG - secondMade * (second.usageG || 0) };
}

function blendPlastic(plastic, fraction, steady) {
  const f = clamp(fraction, 0.05, 0.9);
  const values = effectiveSteadyValues(steady);
  const e = values.eMpa;
  const st = values.sMpa;
  return {
    ...plastic,
    eMin: (1 - f) * plastic.eMin + f * e,
    eMax: (1 - f) * plastic.eMax + f * e,
    sMin: (1 - f) * plastic.sMin + f * st,
    sMax: (1 - f) * plastic.sMax + f * st,
  };
}

export function propertyRange(part, plastic, property) {
  if (property === 'weight' || property === 'none') {
    const m = massG(part, plastic.density);
    return { min: m, max: m, unit: 'g' };
  }
  if (property === 'stiffness') {
    const a = stiffness(part, plastic.eMin);
    const b = stiffness(part, plastic.eMax);
    return { min: Math.min(a, b), max: Math.max(a, b), unit: 'N/mm' };
  }
  const a = capacityN(part, plastic.eMin, plastic.sMin) / G;
  const b = capacityN(part, plastic.eMax, plastic.sMax) / G;
  return { min: Math.min(a, b), max: Math.max(a, b), unit: 'kg' };
}

export function inRange(range, target) {
  return Number.isFinite(target.min) && Number.isFinite(target.max)
    && range.min >= target.min - 1e-9 && range.max <= target.max + 1e-9;
}

// ---------------------------------------------------------------------------
// Display units. Everything inside the checker is metric (mm, kg, g, N/mm,
// MPa, g/cm3). The page can display imperial; conversion happens only in the
// formatting helpers below, never in the mechanics.
// ---------------------------------------------------------------------------
let unitSystem = 'metric';
const IMPERIAL = {
  kg: { factor: 2.2046226, unit: 'lb' },
  g: { factor: 0.03527396, unit: 'oz' },
  'N/mm': { factor: 5.710147, unit: 'lbf/in' },
  MPa: { factor: 145.0377, unit: 'psi' },
  'g/cm³': { factor: 62.42796, unit: 'lb/ft³' },
  mm: { factor: 1 / 25.4, unit: 'in' },
};

export function setUnitSystem(system) {
  unitSystem = system === 'imperial' ? 'imperial' : 'metric';
}
export function getUnitSystem() {
  return unitSystem;
}
export function displayUnit(unit) {
  if (unitSystem !== 'imperial') return unit;
  return (IMPERIAL[unit] || {}).unit || unit;
}
export function convertForDisplay(value, unit) {
  if (unitSystem !== 'imperial' || !Number.isFinite(value)) return value;
  const entry = IMPERIAL[unit];
  return entry ? value * entry.factor : value;
}
export function convertFromDisplay(value, unit) {
  if (unitSystem !== 'imperial' || !Number.isFinite(value)) return value;
  const entry = IMPERIAL[unit];
  return entry ? value / entry.factor : value;
}

export function formatNumber(value) {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const digits = abs >= 100 ? (Number.isInteger(value) ? 0 : 1) : abs >= 10 ? 1 : abs >= 1 ? 2 : 3;
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: digits });
}

export function formatRange(range, unit = '') {
  const sourceUnit = unit || range.unit || '';
  const suffix = sourceUnit ? ` ${displayUnit(sourceUnit)}` : '';
  const lo = convertForDisplay(range.min, sourceUnit);
  const hi = convertForDisplay(range.max, sourceUnit);
  if (Math.abs(range.max - range.min) < 1e-9) return `${formatNumber(lo)}${suffix}`;
  return `${formatNumber(lo)}–${formatNumber(hi)}${suffix}`;
}

export function formatTarget(target) {
  const meta = propertyMeta(target.property);
  return `${formatNumber(convertForDisplay(target.min, meta.unit))}–${formatNumber(convertForDisplay(target.max, meta.unit))} ${displayUnit(meta.unit)}`;
}

function candidatePart(state, candidate) {
  if (candidate.move === 'other') return otherPart(state);
  const base = currentPart(state);
  if (candidate.move === 'treated' && candidate.thicknessMm) return { ...base, thicknessMm: candidate.thicknessMm };
  if (candidate.move === 'thickness') return { ...base, thicknessMm: candidate.thicknessMm };
  if (candidate.move === 'section') return {
    ...base,
    widthMm: candidate.widthMm ?? base.widthMm,
    thicknessMm: candidate.thicknessMm ?? base.thicknessMm,
  };
  if (candidate.move === 'span') return {
    ...base,
    spanMm: candidate.spanMm ?? base.spanMm,
    mode: candidate.mode || base.mode,
  };
  return base;
}

function plasticFor(state, candidate) {
  if (candidate.move === 'blend') return blendPlastic(state.plastic, candidate.fraction, state.steady);
  if (candidate.move === 'treated' && isTreatedAvailable(state)) {
    if (state.treated.source === 'published') {
      const batch = publishedBatchByKey(state.treated.publishedKey);
      if (batch) {
        // Sorted/washed to a published outcome: that batch's plastic range,
        // on this delivery's density. No entered range is mixed into it.
        return {
          ...state.plastic,
          eMin: batch.plastic.eMin,
          eMax: batch.plastic.eMax,
          sMin: batch.plastic.sMin,
          sMax: batch.plastic.sMax,
        };
      }
    }
    return {
      ...state.plastic,
      eMin: state.treated.eMin || state.plastic.eMin,
      eMax: state.treated.eMax || state.plastic.eMax,
      sMin: state.treated.sMin || state.plastic.sMin,
      sMax: state.treated.sMax || state.plastic.sMax,
    };
  }
  return state.plastic;
}

function samePart(a, b) {
  return a.mode === b.mode
    && Math.abs(a.spanMm - b.spanMm) < 1e-6
    && Math.abs(a.widthMm - b.widthMm) < 1e-6
    && Math.abs(a.thicknessMm - b.thicknessMm) < 1e-6;
}

function validCandidate(state, candidate) {
  if (!candidate || !MOVES.includes(candidate.move)) return false;
  if (candidate.move === 'current') return true;
  if (candidate.move === 'other') {
    if (!state.other.product) return false;
    const other = otherPart(state);
    if (!(other.spanMm > 0 && other.widthMm > 0 && other.thicknessMm > 0)) return false;
    return !samePart(other, currentPart(state));
  }
  if (candidate.move === 'blend') {
    const values = effectiveSteadyValues(state.steady);
    return state.steady.available && values.eMpa > 0 && values.sMpa > 0 && Number.isFinite(candidate.fraction) && candidate.fraction > 0;
  }
  if (candidate.move === 'treated') {
    return isTreatedAvailable(state);
  }
  if (candidate.move === 'section') {
    // Width is the part's own size (a 600 mm panel is a 600 mm panel).
    // A section move may widen it to carry more; it may not shrink the
    // product into a different product to hit a range.
    const width = candidate.widthMm == null ? state.widthMm : candidate.widthMm;
    if (width < state.widthMm - 1e-9) return false;
  }
  if (candidate.move === 'span') {
    // Span is the part's length, also its own size: a span move may
    // lengthen it or change how it is held, but may not shorten the
    // product into a different product to hit a range — and may not
    // "save" material by quietly making a smaller part.
    const span = candidate.spanMm == null ? state.spanMm : candidate.spanMm;
    if (span < state.spanMm - 1e-9) return false;
  }
  const part = candidatePart(state, candidate);
  return !samePart(part, currentPart(state));
}

function normalizeCandidate(state, raw) {
  if (!raw || typeof raw !== 'object') return null;
  const move = raw.move === 'other_product' ? 'other' : raw.move;
  if (!MOVES.includes(move) || move === 'current') return null;
  if (move === 'thickness') {
    const thickness = clamp(num(raw.thicknessMm ?? raw.thickness_mm, NaN), 1, 400);
    if (!Number.isFinite(thickness)) return null;
    return { move: 'thickness', thicknessMm: round(thickness, 2) };
  }
  if (move === 'section') {
    const width = clamp(num(raw.widthMm ?? raw.width_mm, NaN), 2, 800);
    const thickness = num(raw.thicknessMm ?? raw.thickness_mm, null);
    if (!Number.isFinite(width) && !Number.isFinite(thickness)) return null;
    return {
      move: 'section',
      widthMm: Number.isFinite(width) ? round(width, 2) : undefined,
      thicknessMm: Number.isFinite(thickness) ? round(clamp(thickness, 1, 400), 2) : undefined,
    };
  }
  if (move === 'span') {
    const span = clamp(num(raw.spanMm ?? raw.span_mm, NaN), 30, 6000);
    if (!Number.isFinite(span)) return null;
    const mode = MODE_KEYS.has(raw.mode) ? raw.mode : undefined;
    return { move: 'span', spanMm: round(span, 2), mode };
  }
  if (move === 'other') return { move: 'other' };
  if (move === 'blend') {
    const fraction = clamp(num(raw.fraction, NaN), 0.05, 0.9);
    const values = effectiveSteadyValues(state.steady);
    if (!Number.isFinite(fraction) || !state.steady.available || !values.eMpa || !values.sMpa) return null;
    return { move: 'blend', fraction: round(fraction, 3) };
  }
  return null;
}

function keyFor(state, candidate) {
  const part = candidatePart(state, candidate);
  const blend = candidate.move === 'blend' ? candidate.fraction : '';
  return [
    part.mode,
    round(part.spanMm, 2),
    round(part.widthMm, 2),
    round(part.thicknessMm, 2),
    blend,
  ].join('|');
}



/** The material range a part needs to hit the target range. */
export function requiredMaterial(part, property, target) {
  if (property === 'strength') {
    let coefficient;
    if (part.mode === 'compression') coefficient = area(part);
    else if (part.mode === 'cantilever') coefficient = (part.widthMm * part.thicknessMm ** 2) / (6 * part.spanMm);
    else coefficient = (2 * part.widthMm * part.thicknessMm ** 2) / (3 * part.spanMm);
    return { min: (target.min * G) / coefficient, max: (target.max * G) / coefficient, unit: 'MPa' };
  }
  if (property === 'stiffness') {
    const perMpa = stiffness(part, 1);
    return { min: target.min / perMpa, max: target.max / perMpa, unit: 'MPa' };
  }
  const volume = part.widthMm * part.thicknessMm * part.spanMm;
  return {
    min: (target.min * 1000) / volume,
    max: (target.max * 1000) / volume,
    unit: 'g/cm³',
  };
}

function materialRange(plastic, property) {
  if (property === 'strength') return { min: plastic.sMin, max: plastic.sMax, unit: 'MPa' };
  if (property === 'stiffness') return { min: plastic.eMin, max: plastic.eMax, unit: 'MPa' };
  return { min: plastic.density, max: plastic.density, unit: 'g/cm³' };
}

/** Compare what the delivery provides with what a part needs. */
export function materialGap(stateInput, part, targetInput = null) {
  const state = normalizeState(stateInput);
  const target = normalizeTarget(targetInput, state.target);
  if (target.property === 'none') {
    // 'No load' is not a numeric window: there is no density window to miss.
    // Treating its empty min/max as 0–0 invented an over-high gap of the
    // whole density (combinations matrix, none + an extra numeric target).
    const batch = materialRange(state.plastic, target.property);
    return {
      required: { ...batch }, batch, shortLow: 0, overHigh: 0, steadyValue: 0, steadyShort: null,
      rangeTooWide: false, buckling: null,
      action: 'No load requirement was set for this build, so there is no material gap to close.',
      unit: batch.unit, property: target.property,
    };
  }
  const required = requiredMaterial(part, target.property, target);
  const batch = materialRange(state.plastic, target.property);
  const shortLow = Math.max(0, required.min - batch.min);
  const overHigh = Math.max(0, batch.max - required.max);
  const mixIn = effectiveSteadyValues(state.steady);
  const steadyValue = target.property === 'strength'
    ? (state.steady.available ? mixIn.sMpa : 0)
    : target.property === 'stiffness'
      ? (state.steady.available ? mixIn.eMpa : 0)
      : 0;
  const steadyShort = steadyValue > 0 ? Math.max(0, required.min - steadyValue) : null;
  // In compression a slender part can buckle before the material crushes.
  // That limit is set by stiffness, not strength, so name it separately
  // instead of asking for a stronger plastic that would not help.
  let buckling = null;
  if (part.mode === 'compression' && target.property === 'strength') {
    const eulerKg = (Math.PI ** 2 * state.plastic.eMin * weakInertia(part)) / part.spanMm ** 2 / G;
    buckling = { governs: eulerKg < target.min, capacityKgAtLowStiffness: eulerKg };
  }
  const targetRatio = (target.max - target.min) / target.min;
  const batchRatio = batch.min > 0 ? (batch.max - batch.min) / batch.min : Infinity;
  const rangeTooWide = target.property !== 'weight' && batchRatio > targetRatio + 1e-9;
  let action;
  if (buckling && buckling.governs) {
    action = `This part buckles before it crushes: at the delivery's low stiffness it carries about ${formatNumber(buckling.capacityKgAtLowStiffness)} kg. Make it thicker or shorter, or bring in a stiffer stream — a stronger plastic alone does not lift this.`;
  } else if (shortLow > required.min * 0.5 && target.property !== 'weight') {
    action = 'This delivery is far below what this part needs — mixing or sorting this delivery will not close a gap that wide. Put this delivery on a part that asks less of it, or bring in a stronger delivery for this one.';
  } else if (rangeTooWide) {
    action = 'This delivery varies too much for the range you need. A thicker or wider part raises both ends together, so it cannot fix this. Mix in another plastic that measures nearly the same every time, or sort the weakest pieces out first.';
    if (steadyShort > 0) action += ` The other plastic you named gives ${formatNumber(steadyValue)} ${required.unit}; this build needs at least ${formatNumber(required.min)} ${required.unit}.`;
  } else if (steadyShort > 0) {
    action = `The other plastic you named gives ${formatNumber(steadyValue)} ${required.unit}; this part needs at least ${formatNumber(required.min)} ${required.unit}. Use a stronger mix-in plastic, or change the part size.`;
  } else if (shortLow > 0 && overHigh > 0) {
    action = 'Raise the weak end and bring the strong end down.';
  } else if (shortLow > 0) {
    action = target.property === 'weight'
      ? 'Use a denser fraction, or change the section.'
      : 'Mix in the other plastic you named, or bring in one that reaches the weak end.';
  } else if (overHigh > 0) {
    action = target.property === 'weight'
      ? 'Use less of the dense fraction, or change the section.'
      : 'Use less of the strong fraction, or use a thinner build.';
  } else {
    action = 'This delivery already sits inside the window for this build.';
  }
  return { required, batch, shortLow, overHigh, steadyValue, steadyShort, rangeTooWide, buckling, action, unit: required.unit, property: target.property };
}

/** The least-material thickness that makes the current build with this delivery. */
export function minimumThicknessCandidate(stateInput) {
  const state = normalizeState(stateInput);
  const base = currentPart(state);
  let best = null;
  for (let t = 1; t <= 400; t += 0.5) {
    const part = { ...base, thicknessMm: t };
    if (passesAllTargets(state, part, state.plastic)) {
      const mass = massG(part, state.plastic.density);
      if (!best || mass < best.mass) best = { t, mass };
    }
  }
  if (!best) return null;
  const part = { ...base, thicknessMm: best.t };
  if (samePart(part, base)) return null;
  return { move: 'thickness', thicknessMm: best.t, calculated: true };
}

/**
 * The same part held a different way, if that plainly saves material.
 * For every other load path, the least-material passing thickness is found
 * with minimumThicknessCandidate on a mode-switched state — so the entered
 * part is the comparison build and a same-thickness pass is not a saving.
 * Returns the best { mode, modeLabel, thicknessMm, massG, savingPct } only
 * when it passes and uses at least 10% less material than the current
 * winner (or than the entered build when there is no winner); else null.
 * A part with no strength/stiffness target has no load path to compare.
 */
export function loadPathComparison(stateInput, result) {
  const state = normalizeState(stateInput);
  if (!result || !result.ready) return null;
  const targets = [state.target, ...state.extraTargets];
  if (!targets.some((target) => target.property === 'strength' || target.property === 'stiffness')) return null;
  if (!MODES.some((mode) => mode.key === state.mode)) return null;
  const baselineMass = result.winner && Number.isFinite(result.winner.massG)
    ? result.winner.massG
    : result.current && Number.isFinite(result.current.massG)
      ? result.current.massG
      : massG(currentPart(state), state.plastic.density);
  if (!(baselineMass > 0)) return null;
  let best = null;
  for (const mode of MODES) {
    if (mode.key === state.mode) continue;
    const switched = normalizeState({ ...state, mode: mode.key });
    const candidate = minimumThicknessCandidate(switched);
    if (!candidate) continue;
    const part = { ...currentPart(switched), thicknessMm: candidate.thicknessMm };
    const mass = massG(part, state.plastic.density);
    if (!(mass > 0)) continue;
    const savingPct = ((baselineMass - mass) / baselineMass) * 100;
    if (savingPct < 10 - 1e-9) continue;
    const alternative = {
      mode: mode.key, modeLabel: mode.label, thicknessMm: candidate.thicknessMm, massG: mass, savingPct,
    };
    if (!best || alternative.massG < best.massG) best = alternative;
  }
  return best;
}

/**
 * How many parts cut from one sheet, parts laid in a grid. Both part
 * orientations are tried and the better one's layout is returned as
 * { perSheet, along, across } (along the sheet span, across its width).
 * Pure arithmetic: 0 when the part fits in neither orientation or any
 * size is missing — no yield, waste, or kerf effect is invented.
 */
export function sheetYield({ sheetSpanMm, sheetWidthMm, partSpanMm, partWidthMm } = {}) {
  const sheetSpan = Number(sheetSpanMm);
  const sheetWidth = Number(sheetWidthMm);
  const partSpan = Number(partSpanMm);
  const partWidth = Number(partWidthMm);
  if (![sheetSpan, sheetWidth, partSpan, partWidth].every((value) => Number.isFinite(value) && value > 0)) {
    return { perSheet: 0, along: 0, across: 0 };
  }
  const layout = (alongSize, acrossSize) => {
    const along = Math.floor(sheetSpan / alongSize);
    const across = Math.floor(sheetWidth / acrossSize);
    return { perSheet: along * across, along, across };
  };
  const straight = layout(partSpan, partWidth);
  const rotated = layout(partWidth, partSpan);
  const better = rotated.perSheet > straight.perSheet ? rotated : straight;
  if (better.perSheet <= 0) return { perSheet: 0, along: 0, across: 0 };
  return better;
}

/** A blend with the declared steadier stream, if the current build can pass. */
export function blendCandidate(stateInput) {
  const state = normalizeState(stateInput);
  const values = effectiveSteadyValues(state.steady);
  if (!state.steady.available || !values.eMpa || !values.sMpa) return null;
  const part = currentPart(state);
  for (let f = 0.05; f <= 0.9001; f += 0.02) {
    const plastic = blendPlastic(state.plastic, f, state.steady);
    if (passesAllTargets(state, part, plastic)) {
      return { move: 'blend', fraction: +f.toFixed(2) };
    }
  }
  return null;
}

function passesAllTargets(state, part, plastic) {
  const targets = [state.target, ...state.extraTargets];
  const numeric = targets.filter((target) => target.property !== 'none');
  // With no numeric target there is nothing for a searched build to pass:
  // the entered build is the answer, not the thinnest build the loop finds.
  if (!numeric.length) return false;
  return numeric.every((target) => inRange(propertyRange(part, plastic, target.property), target));
}

function addFound(state, found, seen, candidate) {
  if (!validCandidate(state, candidate)) return;
  const key = keyFor(state, candidate);
  if (seen.has(key)) return;
  seen.add(key);
  found.push(candidate);
}

/**
 * The model proposes the move; the mechanics finds the least-material passing
 * size in that move's direction. No move exists without a model proposal.
 */
function searchModelMoves(state, proposals) {
  const found = [];
  const seen = new Set();
  const normalized = normalizeModelProposals(state, proposals);
  const plastic = state.plastic;
  const current = currentPart(state);

  for (const proposal of normalized) {
    if (proposal.move === 'other') {
      addFound(state, found, seen, { move: 'other' });
      continue;
    }
    if (proposal.move === 'blend') {
      let best = null;
      const values = effectiveSteadyValues(state.steady);
      if (state.steady.available && values.eMpa > 0 && values.sMpa > 0) {
        for (let f = 0.05; f <= 0.9001; f += 0.02) {
          const candidate = { move: 'blend', fraction: +f.toFixed(2) };
          if (passesAllTargets(state, current, blendPlastic(plastic, candidate.fraction, state.steady))) {
            best = candidate;
            break;
          }
        }
      }
      if (best) addFound(state, found, seen, best);
      continue;
    }
    if (proposal.move === 'thickness') {
      const suggested = num(proposal.thicknessMm, state.thicknessMm);
      const direction = suggested >= state.thicknessMm ? 1 : -1;
      let start = direction > 0 ? state.thicknessMm + 0.5 : state.thicknessMm - 0.5;
      for (let n = 0; n < 400; n++) {
        const t = direction > 0 ? start + n * 0.5 : start - n * 0.5;
        if (t < 1 || t > 400) break;
        const candidate = { move: 'thickness', thicknessMm: +t.toFixed(2) };
        const part = candidatePart(state, candidate);
        if (passesAllTargets(state, part, plastic)) {
          addFound(state, found, seen, candidate);
          break;
        }
      }
      continue;
    }
    if (proposal.move === 'section') {
      const suggested = num(proposal.widthMm, state.widthMm);
      const directions = suggested >= state.widthMm ? [1] : [-1];
      if (Math.abs(suggested - state.widthMm) < 1e-9) directions.splice(0, 1, 1, -1);
      for (const direction of directions) {
        for (let w = 5; w <= 500; w += 1) {
          if (direction > 0 && w <= state.widthMm) continue;
          if (direction < 0 && w >= state.widthMm) break;
          const candidate = { move: 'section', widthMm: w };
          const part = candidatePart(state, candidate);
          if (passesAllTargets(state, part, plastic)) {
            addFound(state, found, seen, candidate);
            break;
          }
        }
      }
      continue;
    }
    if (proposal.move === 'span') {
      const modes = [];
      if (proposal.mode) modes.push(proposal.mode);
      if (!modes.includes(current.mode)) modes.push(current.mode);
      for (const mode of modes) {
        const sameSpan = { move: 'span', spanMm: current.spanMm, mode };
        if (mode === current.mode && passesAllTargets(state, currentPart(state), plastic)) {
          // no need to duplicate the current build
        } else if (passesAllTargets(state, candidatePart(state, sameSpan), plastic)) {
          addFound(state, found, seen, sameSpan);
          continue;
        }
        const suggested = num(proposal.spanMm, state.spanMm);
        const direction = suggested >= state.spanMm ? 1 : -1;
        const lo = Math.max(30, state.spanMm * 0.8);
        const hi = Math.min(6000, state.spanMm * 1.2);
        if (direction > 0) {
          for (let span = Math.ceil(state.spanMm); span <= hi; span += 1) {
            const candidate = { move: 'span', spanMm: span, mode };
            if (passesAllTargets(state, candidatePart(state, candidate), plastic)) {
              addFound(state, found, seen, candidate);
              break;
            }
          }
        } else {
          for (let span = Math.floor(state.spanMm); span >= lo; span -= 1) {
            const candidate = { move: 'span', spanMm: span, mode };
            if (passesAllTargets(state, candidatePart(state, candidate), plastic)) {
              addFound(state, found, seen, candidate);
              break;
            }
          }
        }
      }
    }
  }
  return found;
}

export function normalizeModelProposals(state, proposals) {
  if (!Array.isArray(proposals)) return [];
  const out = [];
  for (const raw of proposals) {
    if (!raw || typeof raw !== 'object') continue;
    const candidate = normalizeCandidate(state, raw);
    if (!candidate) continue;
    if (candidate.move === 'span') {
      candidate.spanMm = clamp(candidate.spanMm, state.spanMm * 0.8, state.spanMm * 1.2);
    }
    if (validCandidate(state, candidate)) out.push(candidate);
  }
  return out;
}

function addCandidate(state, list, seen, candidate) {
  if (!validCandidate(state, candidate)) return;
  const key = keyFor(state, candidate);
  if (seen.has(key)) return;
  seen.add(key);
  list.push(candidate);
}

function traceModelProposals(state, proposals) {
  const normalized = normalizeModelProposals(state, proposals);
  const targets = [state.target, ...state.extraTargets];
  const trace = [];
  for (const candidate of normalized) {
    if (!validCandidate(state, candidate)) continue;
    const part = candidatePart(state, candidate);
    const plastic = plasticFor(state, candidate);
    const ranges = targets.map((target) => propertyRange(part, plastic, target.property));
    const pass = ranges.every((range, i) => targets[i].property === 'none' || inRange(range, targets[i]));
    trace.push({ ...candidate, part, ranges, pass, source: 'meta' });
  }
  return trace;
}

export function evaluateBuilds(stateInput, modelProposals = []) {
  const state = normalizeState(stateInput);
  if (!isReady(state)) {
    return {
      state,
      ready: false,
      current: null,
      winner: null,
      passingBest: [],
      gap: null,
      gaps: [],
      allCount: 0,
      passingCount: 0,
      triedCount: 0,
      triedMoves: [],
      failedMoves: [],
      targetValid: true,
      targets: [state.target, ...state.extraTargets],
      modelTrace: [],
    };
  }
  const targets = [state.target, ...state.extraTargets];
  const targetValid = targets.every((target) => target.property === 'none' || target.min <= target.max);
  const current = { move: 'current', part: currentPart(state) };
  const currentPlastic = state.plastic;
  const currentMass = massG(current.part, currentPlastic.density);
  const currentRanges = targets.map((target) => propertyRange(current.part, currentPlastic, target.property));
  const currentPass = targetValid && currentRanges.every((range, i) => targets[i].property === 'none' || inRange(range, targets[i]));
  const currentEval = {
    ...current,
    massG: currentMass,
    addedG: 0,
    range: currentRanges[0],
    ranges: currentRanges,
    pass: currentPass,
    part: current.part,
  };

  const modelTrace = targetValid ? traceModelProposals(state, modelProposals) : [];
  const candidates = [];
  const seen = new Set();
  const searched = targetValid ? searchModelMoves(state, modelProposals) : [];
  if (targetValid && targets.some((target) => target.property !== 'none')) {
    for (const exact of modelTrace) if (exact.pass) addCandidate(state, candidates, seen, exact);
    const minimum = minimumThicknessCandidate(state);
    if (minimum) addCandidate(state, candidates, seen, minimum);
    const blend = blendCandidate(state);
    if (blend) addCandidate(state, candidates, seen, blend);
    if (isTreatedAvailable(state)) {
      addCandidate(state, candidates, seen, { move: 'treated' });
      const treatedState = { ...state, plastic: plasticFor(state, { move: 'treated' }) };
      const treatedMin = minimumThicknessCandidate(treatedState);
      if (treatedMin) addCandidate(state, candidates, seen, { ...treatedMin, move: 'treated' });
    }
    for (const candidate of searched) addCandidate(state, candidates, seen, candidate);
  }
  const evaluated = candidates.map((candidate) => {
    const part = candidatePart(state, candidate);
    const plastic = plasticFor(state, candidate);
    const ranges = targets.map((target) => propertyRange(part, plastic, target.property));
    const mass = massG(part, plastic.density);
    // A blend is not free: it uses the mix-in plastic in every part.
    // Charge it that stream, in grams a part, so it is ranked on the same
    // axis as added section material.
    const addedG = candidate.move === 'blend'
      ? candidate.fraction * massG(part, plastic.density)
      : mass - currentMass;
    const origin = modelTrace.includes(candidate)
      ? 'meta'
      : searched.includes(candidate)
        ? 'meta-direction'
        : 'local';
    return {
      ...candidate,
      part,
      range: ranges[0],
      ranges,
      massG: mass,
      addedG,
      origin,
      pass: targetValid && ranges.every((range, i) => targets[i].property === 'none' || inRange(range, targets[i])),
    };
  });

  const all = [currentEval, ...evaluated];
  const passing = all.filter((item) => item.pass);
  const bestByMove = new Map();
  for (const item of passing) {
    const existing = bestByMove.get(item.move);
    if (!existing || item.addedG < existing.addedG) bestByMove.set(item.move, item);
  }
  const passingBest = [...bestByMove.values()].sort((a, b) => {
    if (a.addedG !== b.addedG) return a.addedG - b.addedG;
    if (a.move === 'current') return -1;
    if (b.move === 'current') return 1;
    return a.move.localeCompare(b.move);
  });
  const winner = passingBest[0] || null;
  const triedMoves = new Set([current.move, ...evaluated.map((e) => e.move)]);
  const failedMoves = [...new Set(evaluated.filter((e) => !e.pass).map((e) => e.move))];

  const gaps = targetValid && !winner
    ? targets
      .filter((target) => target.property !== 'none')
      .map((target) => materialGap(state, current.part, target))
    : [];
  const gap = gaps[0] || null;
  return {
    state,
    ready: true,
    current: currentEval,
    winner,
    passingBest,
    gap,
    gaps,
    allCount: all.length,
    passingCount: passing.length,
    triedCount: evaluated.length,
    triedMoves: [...triedMoves],
    failedMoves,
    evaluated,
    targetValid,
    targets,
    modelTrace,
  };
}

function moveLabel(state, candidate) {
  if (candidate.move === 'current') return 'Current build';
  if (candidate.move === 'other') return 'Other product';
  if (candidate.move === 'blend') return 'Blended plastic';
  if (candidate.move === 'treated') return 'Sorted or washed first';
  if (candidate.move === 'thickness') {
    return candidate.part.thicknessMm >= state.thicknessMm ? 'Thicker section' : 'Slimmer section';
  }
  if (candidate.move === 'section') {
    if (candidate.part.widthMm > state.widthMm) return 'Wider section';
    if (candidate.part.widthMm < state.widthMm) return 'Narrower section';
    return 'Changed section';
  }
  if (candidate.move === 'span') {
    if (candidate.part.mode !== state.mode) return 'Changed how it is held';
    return candidate.part.spanMm < state.spanMm ? 'Shorter span' : 'Longer span';
  }
  return 'Build';
}

export function buildSizeText(part) {
  const unit = displayUnit('mm');
  return `${formatNumber(convertForDisplay(part.spanMm, 'mm'))} ${unit} ${part.product}, ${formatNumber(convertForDisplay(part.widthMm, 'mm'))} × ${formatNumber(convertForDisplay(part.thicknessMm, 'mm'))} ${unit}`;
}

export function addedMaterialText(addedG) {
  if (Math.abs(addedG) < 0.5) return 'no added material';
  const sign = addedG > 0 ? '+' : '−';
  return `${sign}${formatNumber(convertForDisplay(Math.abs(addedG), 'g'))} ${displayUnit('g')}`;
}

const THIN_EVIDENCE_TYPE = /recycled ldpe|mixed plastics|mixed polyolefins/i;
function thinEvidenceDelivery(state) {
  return state.rangeSource !== 'numbers' && THIN_EVIDENCE_TYPE.test(state.plastic.type || '');
}
function largeLoadDecision(state, targets) {
  return targets.some((target) => target.property === 'strength' && Number(target.min) >= 1000);
}

export function decisionFor(stateInput, result) {
  const state = normalizeState(stateInput);
  if (!result.ready) {
    if (state.product) {
      return {
        headline: 'What does it have to do?',
        support: `The ${state.product} is in the form. Say how much it has to carry, how stiff it has to be, or how much it may weigh — and set this delivery. The result appears as soon as those are in.`, 
        button: null,
        copy: '',
      };
    }
    return {
      headline: 'What do you want to make?',
      support: 'Name the part, say what it has to do, and describe this delivery.',
      button: null,
      copy: '',
    };
  }
  const targets = [state.target, ...state.extraTargets];
  // A primary 'none' target has no numeric window. If numeric extra targets
  // sit beside it, only those are ranged/gapped/stated; formatting the
  // 'none' target produced "No load to check —–— g" and a duplicate weight.
  const numericTargets = targets
    .map((target, i) => ({ target, i }))
    .filter(({ target }) => target.property !== 'none');
  const rangeText = (item) => numericTargets
    .map(({ target, i }) => {
      const meta = propertyMeta(target.property);
      return `${meta.verb} ${formatRange(item.ranges ? item.ranges[i] : item.range, meta.unit)}`;
    })
    .join(' and ');
  const targetText = numericTargets
    .map(({ target }) => `${propertyMeta(target.property).label} ${formatTarget(target)}`)
    .join('; ');
  if (!result.winner) {
    const suppliedGaps = result.gaps && result.gaps.length ? result.gaps : [materialGap(state, currentPart(state))];
    const filteredGaps = suppliedGaps.filter((gap) => gap.property !== 'none');
    const gaps = filteredGaps.length ? filteredGaps : suppliedGaps;
    const primary = gaps.find((gap) => gap.rangeTooWide || gap.shortLow > 0 || gap.overHigh > 0) || gaps[0];
    const meta = propertyMeta(primary.property);
    const unit = primary.unit;
    let headline;
    if (primary.buckling && primary.buckling.governs) headline = 'Thicken or shorten this part.';
    else if (primary.rangeTooWide && !(primary.shortLow > primary.required.min * 0.5)) headline = `This delivery varies too much in ${meta.noun}.`;
    else if (primary.shortLow > 0) {
      headline = primary.property === 'strength'
        ? 'Not strong enough with this delivery.'
        : primary.property === 'stiffness'
          ? 'Not stiff enough with this delivery.'
          : 'The plastic is not dense enough for that weight.';
    } else if (primary.overHigh > 0) {
      headline = primary.property === 'strength'
        ? 'It would carry more than you asked for.'
        : primary.property === 'stiffness'
          ? 'It would be stiffer than you asked for.'
          : 'It would weigh more than you asked for.';
    } else headline = 'This part needs a different size.';
    const statements = gaps
      .filter((gap) => gap.shortLow > 0 || gap.overHigh > 0)
      .map((gap) => {
        const gapMeta = propertyMeta(gap.property);
        return `${gapMeta.noun} needs ${formatRange(gap.required, gap.unit)}; the delivery gives ${formatRange(gap.batch, gap.unit)}.`;
      });
    const asStands = result.current
      ? `as it stands, this build ${rangeText(result.current)} — you need ${targetText}. `
      : '';
    const supplierSentence = state.rangeSource === 'published'
      ? ''
      : `In supplier numbers: ${statements.join(' ')} `;
    const secondary = gaps
      .filter((gap) => gap.property !== primary.property && (gap.shortLow > 0 || gap.overHigh > 0))
      .map((gap) => `Also holding it back: ${propertyMeta(gap.property).noun} — ${gap.action.charAt(0).toLowerCase()}${gap.action.slice(1)}`)
      .join(' ');
    let nearMiss = '';
    const treatedMiss = (result.evaluated || []).find((item) => item.move === 'treated' && !item.pass);
    if (treatedMiss) {
      const idx = targets.findIndex((target) => target.property === primary.property);
      if (idx >= 0 && treatedMiss.ranges && treatedMiss.ranges[idx]) {
        const meta = propertyMeta(primary.property);
        nearMiss = ` After sorting or washing to ${treatedRoutePhrase(state)}, this build gives ${formatRange(treatedMiss.ranges[idx], meta.unit)} — still outside your ${meta.label} ${formatTarget(targets[idx])}.`;
      }
    }
    const support = `At ${buildSizeText(currentPart(state))}, ${asStands}${supplierSentence}${primary.action}${secondary ? ` ${secondary}` : ''}${nearMiss} Ranges are checked as entered — no safety margin is added to any of these numbers.`;
    const copy = [
      'AnyRB plan',
      headline,
      `Current build: ${buildSizeText(currentPart(state))}`,
      asStands ? `As it stands: ${rangeText(result.current)}; you need ${targetText}` : '',
      ...(state.rangeSource === 'published' ? [] : gaps.filter((gap) => gap.shortLow > 0 || gap.overHigh > 0).map((gap) => {
        const gapMeta = propertyMeta(gap.property);
        return `${gapMeta.label}: needs ${formatRange(gap.required, gap.unit)}, delivery ${formatRange(gap.batch, gap.unit)}`;
      })),
      `Action: ${primary.action}`,
      'Checked as entered — no safety margin is added to any of these numbers.',
    ].filter(Boolean).join('\n');
    return { headline, support, button: 'Ask about this delivery', copy };
  }
  const winner = result.winner;
  if (targets.length && targets.every((target) => target.property === 'none')) {
    const weight = winner.ranges ? winner.ranges[0] : winner.range;
    return {
      headline: 'No load to check on this one.',
      support: `It carries no load in use, so there is no strength or stiffness answer to give. One ${state.product} at this size weighs ${formatRange(weight, 'g')} from this delivery's density.`,
      button: 'Copy build',
      copy: [
        'AnyRB build',
        `Make the ${buildSizeText(winner.part)}.`,
        `Plastic: ${state.plastic.type}${state.plastic.batch ? `, ${state.plastic.batch}` : ''}`,
        `No load requirement. One part weighs ${formatRange(weight, 'g')}.`,
        `Move: ${moveLabel(state, winner)}`,
      ].filter(Boolean).join('\n'),
    };
  }
  const isBlend = winner.move === 'blend';
  const steadyBatch = state.steady.source === 'published' ? publishedBatchByKey(state.steady.publishedKey) : null;
  const steadyName = state.steady.type || (steadyBatch ? steadyBatch.plastic.type : 'the mix-in plastic');
  const blendPct = isBlend ? Math.round(winner.fraction * 100) : 0;
  // A winner far from the entered thickness must be named as such, in
  // plain terms — the headline size alone can read as a small adjustment.
  // (An 'other' winner is a different product, not this part resized.)
  const extremeThickness = winner.move !== 'other'
    && state.thicknessMm > 0 && winner.part.thicknessMm > 0
    && (winner.part.thicknessMm < state.thicknessMm * 0.5 || winner.part.thicknessMm > state.thicknessMm * 2);
  const extremeThicknessText = extremeThickness
    ? `at a very different thickness (${formatNumber(convertForDisplay(winner.part.thicknessMm, 'mm'))} ${displayUnit('mm')}, not ${formatNumber(convertForDisplay(state.thicknessMm, 'mm'))} ${displayUnit('mm')})`
    : '';
  const headline = winner.move === 'treated'
    ? `Sort or wash this delivery, then make the ${buildSizeText(winner.part)}.`
    : isBlend
    ? `Blend ${blendPct}% of ${steadyName}, then make the ${buildSizeText(winner.part)}.`
    : `Make the ${buildSizeText(winner.part)}.`;
  let support;
  if (winner.move === 'treated') {
    support = `As entered, it misses. After sorting or washing — to ${treatedRoutePhrase(state)} — this build ${rangeText(winner)} — inside your ${targetText}.`;
  } else if (isBlend) {
    support = steadyBatch
      ? `The delivery alone misses. With ${blendPct}% of ${steadyName} — the published range for ${steadyBatch.label} was used at its weak end — this build ${rangeText(winner)} — inside your ${targetText}.`
      : `The delivery alone misses. With ${blendPct}% of ${steadyName}, this build ${rangeText(winner)} — inside your ${targetText}.`;
  } else if (winner.move === 'other') {
    // An 'other' winner is ranked by added material, so it can win while
    // the entered build also passes (it then uses less material). Only
    // claim the entered part has no passing build when that is true.
    support = result.current && result.current.pass
      ? `As entered, the ${state.product} also works. This delivery also makes the ${state.other.product} with less material: ${rangeText(winner)} — inside your ${targetText}.`
      : `The ${state.product} has no passing build. This delivery makes the ${state.other.product}: ${rangeText(winner)} — inside your ${targetText}.`;
  } else if (result.current.pass) {
    support = `This build ${rangeText(winner)} from this delivery — inside your ${targetText}.`;
  } else if (Math.abs(winner.part.thicknessMm - state.thicknessMm) > 1e-9) {
    support = `The ${formatNumber(convertForDisplay(state.thicknessMm, 'mm'))} ${displayUnit('mm')} version misses. This build ${rangeText(winner)} — inside your ${targetText}.`;
  } else {
    support = `As entered, this part misses. This build ${rangeText(winner)} — inside your ${targetText}.`;
  }
  const isLargeLoad = largeLoadDecision(state, targets);
  const isThinEvidence = thinEvidenceDelivery(state)
    && numericTargets.some(({ target }) => target.property === 'strength' || target.property === 'stiffness');
  const spares = numericTargets.map(({ target, i }) => {
    const range = winner.ranges ? winner.ranges[i] : winner.range;
    const scale = Math.max(Math.abs(target.min), Math.abs(target.max), 1e-9);
    return Math.min(range.min - target.min, target.max - range.max) / scale;
  });
  const thinMargin = spares.length && Math.min(...spares) < 0.05;
  if (extremeThicknessText) support += ` That is ${extremeThicknessText}.`;
  support += ' Ranges are checked as entered — no safety margin added.';
  if (isLargeLoad) support += ' At this load this is a calculated estimate only — do not build on it without proper load testing by someone equipped for loads like this.';
  else if (thinMargin) support += ' The closest margin is thin — make one and check it before a run.';
  if (isThinEvidence) support += ' This delivery range rests on thin published evidence, so treat this answer as a rough guide, not a build instruction.';
  const copy = [
    'AnyRB build',
    headline,
    'Checked as entered — no safety margin added.' + (isLargeLoad ? ' At this load this is a calculated estimate only, not a build instruction.' : (thinMargin ? ' The closest margin is thin: make one and check it before a run.' : '')) + (isThinEvidence ? ' This delivery range rests on thin published evidence: treat it as a rough guide.' : ''),
    `Plastic: ${state.plastic.type}${state.plastic.batch ? `, ${state.plastic.batch}` : ''}`,
    `Mix: ${state.plastic.mix || 'none stated'}; dirt: ${state.plastic.dirt || 'none stated'}`,
    extremeThicknessText ? `Thickness note: ${extremeThicknessText}` : '',
    winner.move === 'treated'
      ? (state.treated && state.treated.source === 'published'
        ? `First: sort or wash this delivery, to ${treatedRoutePhrase(state)}`
        : 'First: sort or wash this delivery, to the ranges entered under This delivery')
      : isBlend
        ? (steadyBatch
          ? `Blend: ${blendPct}% ${steadyName} — the published range for ${steadyBatch.label} was used at its weak end`
          : `Blend: ${blendPct}% ${steadyName}`)
        : '',
    ...numericTargets.map(({ target, i }) => {
      const meta = propertyMeta(target.property);
      return `Requirement: ${meta.label} ${formatRange(winner.ranges ? winner.ranges[i] : winner.range, meta.unit)} — inside ${formatTarget(target)}`;
    }),
    isBlend ? `Added material: ${blendPct}% ${steadyName}` : `Added material: ${addedMaterialText(winner.addedG)}`,
    `Move: ${moveLabel(state, winner)}`,
  ].filter(Boolean).join('\n');
  return { headline, support, button: 'Copy build', copy };
}

export function proposalRow(stateInput, item) {
  const state = normalizeState(stateInput);
  const targets = [state.target, ...state.extraTargets];
  const size = item.move === 'other'
    ? `${item.part.product} · ${formatNumber(convertForDisplay(item.part.spanMm, 'mm'))} ${displayUnit('mm')} · ${formatNumber(convertForDisplay(item.part.widthMm, 'mm'))} × ${formatNumber(convertForDisplay(item.part.thicknessMm, 'mm'))} ${displayUnit('mm')}`
    : `${formatNumber(convertForDisplay(item.part.spanMm, 'mm'))} ${displayUnit('mm')} · ${formatNumber(convertForDisplay(item.part.widthMm, 'mm'))} × ${formatNumber(convertForDisplay(item.part.thicknessMm, 'mm'))} ${displayUnit('mm')}`;
  const blendPercent = item.move === 'blend' ? Math.round(item.fraction * 100) : null;
  const originLabel = item.move === 'current'
    ? 'your build as entered'
    : item.origin === 'meta'
      ? 'proposed by the model'
      : item.origin === 'meta-direction'
        ? 'direction from the model, size calculated here'
        : 'calculated here';
  return {
    move: moveLabel(state, item),
    originLabel,
    size,
    property: targets
      .map((target, i) => ({ target, i }))
      .filter(({ target }) => target.property !== 'none')
      .map(({ target, i }) => {
        const meta = propertyMeta(target.property);
        return `${meta.verb} ${formatRange(item.ranges ? item.ranges[i] : item.range, meta.unit)}`;
      }).join(' · '),
    added: blendPercent
      ? `${blendPercent}% mix-in plastic · ${formatNumber(convertForDisplay((blendPercent / 100) * massG(item.part, state.plastic.density), 'g'))} ${displayUnit('g')} a part`
      : addedMaterialText(item.addedG),
    winner: false,
    blend: blendPercent,
    steadyType: item.move === 'blend'
      ? (state.steady.type || (state.steady.source === 'published' ? (publishedBatchByKey(state.steady.publishedKey) || {}).plastic?.type || '' : ''))
      : '',
  };
}


export function toApiPayload(stateInput) {
  const state = normalizeState(stateInput);
  return {
    product: {
      name: state.product,
      mode: state.mode,
      span_mm: state.spanMm,
      load_kg: 0,
      width_mm: state.widthMm,
      thickness_mm: state.thicknessMm,
    },
    target: {
      property: state.target.property,
      min: state.target.min,
      max: state.target.max,
    },
    targets: [state.target, ...state.extraTargets].map((target) => ({
      property: target.property,
      min: target.min,
      max: target.max,
    })),
    plastic: {
      type: state.plastic.type,
      batch: state.plastic.batch,
      mix: state.plastic.mix,
      dirt: state.plastic.dirt,
      dirt_level: state.plastic.dirtLevel,
      stiffness_min_mpa: state.plastic.eMin,
      stiffness_max_mpa: state.plastic.eMax,
      strength_min_mpa: state.plastic.sMin,
      strength_max_mpa: state.plastic.sMax,
      density_g_cm3: state.plastic.density,
    },
    other_product: {
      name: state.other.product,
      mode: state.other.mode,
      span_mm: state.other.spanMm,
      load_kg: 0,
      width_mm: state.other.widthMm,
      thickness_mm: state.other.thicknessMm,
    },
    steady_available: state.steady.available,
  };
}

export function advicePayload(stateInput, result, question) {
  const state = normalizeState(stateInput);
  const meta = propertyMeta(state.target.property);
  const decision = decisionFor(state, result);
  const range = (rangeValue) => ({ min: rangeValue.min, max: rangeValue.max, unit: rangeValue.unit });
  const size = (part) => buildSizeText(part);
  return {
    question: clean(question, 800) || 'What can I do with this batch?',
    product: {
      name: state.product,
      mode: state.mode,
      span_mm: state.spanMm,
      width_mm: state.widthMm,
      thickness_mm: state.thicknessMm,
    },
    target: { property: state.target.property, min: state.target.min, max: state.target.max },
    targets: [state.target, ...state.extraTargets].map((target) => ({
      property: target.property,
      min: target.min,
      max: target.max,
    })),
    plastic: {
      type: state.plastic.type,
      batch: state.plastic.batch,
      mix: state.plastic.mix,
      dirt: state.plastic.dirt,
      dirt_level: state.plastic.dirtLevel,
      stiffness_min_mpa: state.plastic.eMin,
      stiffness_max_mpa: state.plastic.eMax,
      strength_min_mpa: state.plastic.sMin,
      strength_max_mpa: state.plastic.sMax,
      density_g_cm3: state.plastic.density,
    },
    steady: {
      available: state.steady.available,
      type: state.steady.type,
      source: state.steady.source,
      published_key: state.steady.publishedKey || null,
      stiffness_mpa: effectiveSteadyValues(state.steady).eMpa || null,
      strength_mpa: effectiveSteadyValues(state.steady).sMpa || null,
    },
    other_product: {
      name: state.other.product,
      mode: state.other.mode,
      span_mm: state.other.spanMm,
      width_mm: state.other.widthMm,
      thickness_mm: state.other.thicknessMm,
    },
    plan: {
      headline: decision.headline,
      support: decision.support,
      current: {
        property_range: range(result.current.range),
        property_ranges: result.current.ranges.map(range),
        pass: result.current.pass,
      },
      winner: result.winner ? {
        product: result.winner.part.product,
        size: size(result.winner.part),
        property_range: range(result.winner.range),
        property_ranges: result.winner.ranges.map(range),
        added_material: result.winner.addedG,
        move: moveLabel(state, result.winner),
        blend_percent: result.winner.move === 'blend' ? Math.round(result.winner.fraction * 100) : null,
      } : null,
      gap: result.gap ? {
        property: result.gap.property,
        unit: result.gap.unit,
        needed_min: result.gap.required.min,
        needed_max: result.gap.required.max,
        batch_min: result.gap.batch.min,
        batch_max: result.gap.batch.max,
        short_low: result.gap.shortLow,
        over_high: result.gap.overHigh,
        steady_value: result.gap.steadyValue,
        steady_short: result.gap.steadyShort,
        range_too_wide: result.gap.rangeTooWide,
        required_action: result.gap.action,
      } : null,
      gaps: (result.gaps || []).map((gap) => ({
        property: gap.property,
        unit: gap.unit,
        needed_min: gap.required.min,
        needed_max: gap.required.max,
        batch_min: gap.batch.min,
        batch_max: gap.batch.max,
        short_low: gap.shortLow,
        over_high: gap.overHigh,
        range_too_wide: gap.rangeTooWide,
        required_action: gap.action,
      })),
      builds: result.passingBest.slice(0, 6).map((item) => ({
        move: moveLabel(state, item),
        size: size(item.part),
        property_range: range(item.range),
        property_ranges: item.ranges.map(range),
        added_material: item.addedG,
      })),
      blend: {
        available: Boolean(state.steady.available && effectiveSteadyValues(state.steady).eMpa && effectiveSteadyValues(state.steady).sMpa),
        type: state.steady.type,
        fraction: result.winner && result.winner.move === 'blend' ? result.winner.fraction : null,
      },
    },
  };
}

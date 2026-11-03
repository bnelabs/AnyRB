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
  { key: 'cantilever', label: 'Fixed at one end' },
  { key: 'simple', label: 'Supported at both ends' },
  { key: 'compression', label: 'Stands in compression' },
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
    label: 'Mixed polyolefins — typical published range (wide)',
    plastic: { type: 'mixed polyolefins', eMin: 560, eMax: 1040, sMin: 14, sMax: 22, density: 0.93 },
    note: 'Typical published band for mixed polyolefins; the published evidence here is thinner, so the band is wide. Not a measurement of your delivery.',
  },
  {
    key: 'rpet',
    label: 'Recycled PET — typical published range',
    plastic: { type: 'recycled PET', eMin: 2200, eMax: 2800, sMin: 38, sMax: 52, density: 1.34 },
    note: 'Typical published band for recycled PET. Not a measurement of your delivery — replace it with your supplier’s numbers when you have them.',
  },
  {
    key: 'rldpe',
    label: 'Recycled LDPE — typical published range',
    plastic: { type: 'recycled LDPE', eMin: 188, eMax: 312, sMin: 8, sMax: 12, density: 0.92 },
    note: 'Typical published band for recycled LDPE. Not a measurement of your delivery — replace it with your supplier’s numbers when you have them.',
  },
];

export function publishedBatchFor(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return null;
  if (/mixed polyolefin/.test(t)) return PUBLISHED_BATCHES.find((b) => b.key === 'mixed-polyolefins');
  // A delivery naming two or more kinds of plastic gets no automatic range:
  // no single published band describes it, and picking one would be a guess.
  const kinds = [
    /ldpe/.test(t), /hdpe/.test(t), /petg/.test(t),
    /\bpet\b|polyethylene terephthalate/.test(t),
    /polypropylene|\bpp\b/.test(t), /\babs\b/.test(t), /\bpvc\b/.test(t),
  ].filter(Boolean).length;
  if (kinds >= 2) return null;
  if (/ldpe/.test(t)) return PUBLISHED_BATCHES.find((b) => b.key === 'rldpe');
  if (/petg/.test(t)) return null;
  if (/\bpet\b|polyethylene terephthalate/.test(t)) return PUBLISHED_BATCHES.find((b) => b.key === 'rpet');
  if (/hdpe/.test(t)) {
    return /single|one supplier|measured lot/.test(t)
      ? PUBLISHED_BATCHES.find((b) => b.key === 'rhdpe-measured-lot')
      : PUBLISHED_BATCHES.find((b) => b.key === 'rhdpe');
  }
  if (/polypropylene|\bpp\b/.test(t)) return PUBLISHED_BATCHES.find((b) => b.key === 'rpp');
  return null;
}

export const PROPERTIES = [
  { key: 'strength', label: 'Strength', unit: 'kg', verb: 'carries', noun: 'strength' },
  { key: 'stiffness', label: 'Stiffness', unit: 'N/mm', verb: 'holds', noun: 'stiffness' },
  { key: 'weight', label: 'Weight', unit: 'g', verb: 'weighs', noun: 'weight' },
];
export const MOVES = ['current', 'thickness', 'section', 'span', 'other', 'blend'];
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
  steady: { available: true, type: 'stiffer bottle stream', eMpa: 2000, sMpa: 40 },
  other: {
    product: 'heavier part',
    mode: 'cantilever',
    spanMm: 260,
    widthMm: 50,
    thicknessMm: 16.5,
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
  };
}

export function blankState() {
  return clone(DEFAULT_STATE);
}

function normalizeTarget(raw, fallback) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const fallbackProperty = fallback && PROPERTY_KEYS.has(fallback.property) ? fallback.property : '';
  const property = PROPERTY_KEYS.has(source.property) ? source.property : fallbackProperty;
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
  const targetFallback = blank ? { property: '', min: '', max: '' } : DEFAULT_STATE.target;
  const primaryTarget = normalizeTarget(target, targetFallback);
  const extraTargets = rawExtraTargets
    .filter((item) => item && typeof item === 'object' && PROPERTY_KEYS.has(item.property))
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
    steady: {
      available: source.steady?.available === true,
      type: clean(source.steady?.type, 100),
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
  if (!MODE_KEYS.has(state.mode)) return false;
  if (!(state.spanMm > 0 && state.widthMm > 0 && state.thicknessMm > 0)) return false;
  const targets = [state.target, ...state.extraTargets];
  if (!targets.length) return false;
  for (const target of targets) {
    if (!PROPERTY_KEYS.has(target.property)) return false;
    if (!Number.isFinite(target.min) || !Number.isFinite(target.max)) return false;
    if (target.min > target.max) return false;
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

function blendPlastic(plastic, fraction, steady) {
  const f = clamp(fraction, 0.05, 0.9);
  const e = num(steady && steady.eMpa, 0);
  const st = num(steady && steady.sMpa, 0);
  return {
    ...plastic,
    eMin: (1 - f) * plastic.eMin + f * e,
    eMax: (1 - f) * plastic.eMax + f * e,
    sMin: (1 - f) * plastic.sMin + f * st,
    sMax: (1 - f) * plastic.sMax + f * st,
  };
}

export function propertyRange(part, plastic, property) {
  if (property === 'weight') {
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
  return candidate.move === 'blend'
    ? blendPlastic(state.plastic, candidate.fraction, state.steady)
    : state.plastic;
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
    return state.steady.available && state.steady.eMpa > 0 && state.steady.sMpa > 0 && Number.isFinite(candidate.fraction) && candidate.fraction > 0;
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
    if (!Number.isFinite(fraction) || !state.steady.available || !state.steady.eMpa || !state.steady.sMpa) return null;
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
  const required = requiredMaterial(part, target.property, target);
  const batch = materialRange(state.plastic, target.property);
  const shortLow = Math.max(0, required.min - batch.min);
  const overHigh = Math.max(0, batch.max - required.max);
  const steadyValue = target.property === 'strength'
    ? (state.steady.available ? state.steady.sMpa : 0)
    : target.property === 'stiffness'
      ? (state.steady.available ? state.steady.eMpa : 0)
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
  } else if (rangeTooWide) {
    action = 'This delivery varies too much for the range you need. A thicker or wider part raises both ends together, so it cannot fix this. Mix in a steadier plastic, or sort the weakest pieces out first.';
    if (steadyShort > 0) action += ` Your declared steadier stream gives ${formatNumber(steadyValue)} ${required.unit}; this build needs at least ${formatNumber(required.min)} ${required.unit}.`;
  } else if (steadyShort > 0) {
    action = `Your steadier plastic gives ${formatNumber(steadyValue)} ${required.unit}; this part needs at least ${formatNumber(required.min)} ${required.unit}. Use a stronger steadier plastic, or change the part size.`;
  } else if (shortLow > 0 && overHigh > 0) {
    action = 'Raise the weak end and bring the strong end down.';
  } else if (shortLow > 0) {
    action = target.property === 'weight'
      ? 'Use a denser fraction, or change the section.'
      : 'Blend with the declared steadier stream, or add a stream that reaches the low end.';
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

/** A blend with the declared steadier stream, if the current build can pass. */
export function blendCandidate(stateInput) {
  const state = normalizeState(stateInput);
  if (!state.steady.available || !state.steady.eMpa || !state.steady.sMpa) return null;
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
  return targets.every((target) => inRange(propertyRange(part, plastic, target.property), target));
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
      if (state.steady.eMpa > 0 && state.steady.sMpa > 0) {
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
  const current = currentPart(state);
  const currentMass = massG(current, state.plastic.density);
  const supportFor = (candidate) => candidate.move === 'span' ? currentMass * 0.2 : 0;
  const trace = [];
  for (const candidate of normalized) {
    if (!validCandidate(state, candidate)) continue;
    const part = candidatePart(state, candidate);
    const plastic = plasticFor(state, candidate);
    const support = supportFor(candidate);
    const ranges = targets.map((target) => {
      let range = propertyRange(part, plastic, target.property);
      if (target.property === 'weight') range = { ...range, min: range.min + support, max: range.max + support };
      return range;
    });
    const pass = ranges.every((range, i) => inRange(range, targets[i]));
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
  const targetValid = targets.every((target) => target.min <= target.max);
  const current = { move: 'current', part: currentPart(state) };
  const currentPlastic = state.plastic;
  const currentMass = massG(current.part, currentPlastic.density);
  const currentRanges = targets.map((target) => propertyRange(current.part, currentPlastic, target.property));
  const currentPass = targetValid && currentRanges.every((range, i) => inRange(range, targets[i]));
  const currentEval = {
    ...current,
    massG: currentMass,
    addedG: 0,
    range: currentRanges[0],
    ranges: currentRanges,
    pass: currentPass,
    part: current.part,
  };

  const supportG = (candidate, mass) => candidate.move === 'span' ? mass * 0.2 : 0;
  const modelTrace = targetValid ? traceModelProposals(state, modelProposals) : [];
  const candidates = [];
  const seen = new Set();
  const searched = targetValid ? searchModelMoves(state, modelProposals) : [];
  if (targetValid) {
    for (const exact of modelTrace) if (exact.pass) addCandidate(state, candidates, seen, exact);
    const minimum = minimumThicknessCandidate(state);
    if (minimum) addCandidate(state, candidates, seen, minimum);
    const blend = blendCandidate(state);
    if (blend) addCandidate(state, candidates, seen, blend);
    for (const candidate of searched) addCandidate(state, candidates, seen, candidate);
  }
  const evaluated = candidates.map((candidate) => {
    const part = candidatePart(state, candidate);
    const plastic = plasticFor(state, candidate);
    const support = supportG(candidate, currentMass);
    const ranges = targets.map((target) => {
      let range = propertyRange(part, plastic, target.property);
      if (target.property === 'weight') range = { ...range, min: range.min + support, max: range.max + support };
      return range;
    });
    const mass = massG(part, plastic.density) + support;
    // A blend is not free: it uses the steadier stream in every part.
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
      pass: targetValid && ranges.every((range, i) => inRange(range, targets[i])),
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
    ? targets.map((target) => materialGap(state, current.part, target))
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
    targetValid,
    targets,
    modelTrace,
  };
}

function moveLabel(state, candidate) {
  if (candidate.move === 'current') return 'Current build';
  if (candidate.move === 'other') return 'Other product';
  if (candidate.move === 'blend') return 'Blended plastic';
  if (candidate.move === 'thickness') {
    return candidate.part.thicknessMm >= state.thicknessMm ? 'Thicker section' : 'Slimmer section';
  }
  if (candidate.move === 'section') {
    if (candidate.part.widthMm > state.widthMm) return 'Wider section';
    if (candidate.part.widthMm < state.widthMm) return 'Narrower section';
    return 'Changed section';
  }
  if (candidate.move === 'span') {
    if (candidate.part.mode !== state.mode) return 'Changed load path + support';
    return `${candidate.part.spanMm < state.spanMm ? 'Shorter span' : 'Longer span'} + support`;
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
  const rangeText = (item) => targets
    .map((target, i) => {
      const meta = propertyMeta(target.property);
      return `${meta.verb} ${formatRange(item.ranges ? item.ranges[i] : item.range, meta.unit)}`;
    })
    .join(' and ');
  const targetText = targets
    .map((target) => `${propertyMeta(target.property).label} ${formatTarget(target)}`)
    .join('; ');
  if (!result.winner) {
    const gaps = result.gaps && result.gaps.length ? result.gaps : [materialGap(state, currentPart(state))];
    const primary = gaps.find((gap) => gap.rangeTooWide || gap.shortLow > 0 || gap.overHigh > 0) || gaps[0];
    const meta = propertyMeta(primary.property);
    const unit = primary.unit;
    let headline;
    if (primary.buckling && primary.buckling.governs) headline = 'Thicken or shorten this part.';
    else if (primary.rangeTooWide) headline = `This delivery varies too much in ${meta.noun}.`;
    else if (primary.shortLow > 0) headline = `The weak end of the ${meta.noun} must rise by ${formatNumber(primary.shortLow)} ${unit}.`;
    else if (primary.overHigh > 0) headline = `The strong end of the ${meta.noun} must come down by ${formatNumber(primary.overHigh)} ${unit}.`;
    else headline = 'This build needs a different section.';
    const statements = gaps.map((gap) => {
      const gapMeta = propertyMeta(gap.property);
      return `${gapMeta.noun} needs ${formatRange(gap.required, gap.unit)}; the delivery gives ${formatRange(gap.batch, gap.unit)}.`;
    });
    const asStands = result.current
      ? `as it stands, this build ${rangeText(result.current)} — you need ${targetText}. `
      : '';
    const support = `At ${buildSizeText(currentPart(state))}, ${asStands}${statements.join(' ')} ${primary.action}`;
    const copy = [
      'AnyRB plan',
      headline,
      `Current build: ${buildSizeText(currentPart(state))}`,
      asStands ? `As it stands: ${rangeText(result.current)}; you need ${targetText}` : '',
      ...gaps.map((gap) => {
        const gapMeta = propertyMeta(gap.property);
        return `${gapMeta.label}: needs ${formatRange(gap.required, gap.unit)}, delivery ${formatRange(gap.batch, gap.unit)}`;
      }),
      `Action: ${primary.action}`,
    ].filter(Boolean).join('\n');
    return { headline, support, button: 'Ask about this delivery', copy };
  }
  const winner = result.winner;
  const isBlend = winner.move === 'blend';
  const steadyName = state.steady.type || 'a steadier plastic';
  const blendPct = isBlend ? Math.round(winner.fraction * 100) : 0;
  const headline = isBlend
    ? `Blend ${blendPct}% of ${steadyName}, then make the ${buildSizeText(winner.part)}.`
    : `Make the ${buildSizeText(winner.part)}.`;
  let support;
  if (isBlend) {
    support = `The delivery alone misses. With ${blendPct}% of ${steadyName}, this build ${rangeText(winner)} — inside your ${targetText}.`;
  } else if (winner.move === 'other') {
    support = `The ${state.product} has no passing build. This delivery makes the ${state.other.product}: ${rangeText(winner)} — inside your ${targetText}.`;
  } else if (result.current.pass) {
    support = `This build ${rangeText(winner)} from this delivery — inside your ${targetText}.`;
  } else {
    support = `The ${formatNumber(convertForDisplay(state.thicknessMm, 'mm'))} ${displayUnit('mm')} version misses. This build ${rangeText(winner)} — inside your ${targetText}.`;
  }
  const copy = [
    'AnyRB build',
    headline,
    `Plastic: ${state.plastic.type}${state.plastic.batch ? `, ${state.plastic.batch}` : ''}`,
    `Mix: ${state.plastic.mix || 'none stated'}; dirt: ${state.plastic.dirt || 'none stated'}`,
    isBlend ? `Blend: ${blendPct}% ${steadyName}` : '',
    ...targets.map((target, i) => {
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
    property: targets.map((target, i) => {
      const meta = propertyMeta(target.property);
      return `${meta.verb} ${formatRange(item.ranges ? item.ranges[i] : item.range, meta.unit)}`;
    }).join(' · '),
    added: blendPercent
      ? `${blendPercent}% steadier plastic · ${formatNumber(convertForDisplay((blendPercent / 100) * massG(item.part, state.plastic.density), 'g'))} ${displayUnit('g')} a part`
      : addedMaterialText(item.addedG),
    winner: false,
    blend: blendPercent,
    steadyType: item.move === 'blend' ? state.steady.type : '',
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
      stiffness_mpa: state.steady.eMpa || null,
      strength_mpa: state.steady.sMpa || null,
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
        available: Boolean(state.steady.available && state.steady.eMpa && state.steady.sMpa),
        type: state.steady.type,
        fraction: result.winner && result.winner.move === 'blend' ? result.winner.fraction : null,
      },
    },
  };
}

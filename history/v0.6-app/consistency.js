/**
 * AnyRB v0.5 — open consistency-record logic.
 *
 * Pure functions only: no DOM, no storage, no AI, no material presets and no
 * solver. A record describes a user-named product, the results that must stay
 * inside a target range, the recycled input that can vary, and the measured
 * points that link them. This module decides which of the three honest outcomes
 * a result gets, and whether any 3D model could apply.
 *
 * The three outcomes are deliberately exclusive per result:
 *   link    — a measured link exists for this product + result
 *   batch   — only one batch/input level was measured
 *   missing — no usable measured link; the result stays blank
 *
 * A product name, a material preset/library density, an assumed CV, or the
 * bracket model is never a link. This module never invents a result.
 */

export const STORE_KEY = 'anyrb.consistency.v1';
export const STORE_SCHEMA = 'anyrb.consistency-store/v1';
export const RECORD_SCHEMA = 'anyrb.consistency/v1';
export const EXPORT_FORMAT = 'anyrb-consistency-record/v1';
export const DEFAULT_CHOICE = 'As measured';

export const RESULT_KINDS = [
  { key: 'mass', label: 'Mass' },
  { key: 'strength', label: 'Strength' },
  { key: 'stiffness', label: 'Stiffness' },
  { key: 'sound', label: 'Sound insulation' },
  { key: 'thickness', label: 'Thickness' },
  { key: 'other', label: 'Other' },
];

const KIND_KEYS = new Set(RESULT_KINDS.map((k) => k.key));
const MAX_RESULTS = 12;
const MAX_POINTS = 48;

let idSeq = 0;
function newId(prefix) {
  idSeq = (idSeq + 1) % 1_000_000;
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}-${Date.now().toString(36)}-${idSeq.toString(36)}-${rand}`;
}

const nowIso = () => new Date().toISOString();

function clean(value, max = 200) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}
function cleanBlock(value, max = 1200) {
  return String(value == null ? '' : value).replace(/\r\n/g, '\n').trim().slice(0, max);
}
function numOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function unique(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = String(item).trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(String(item).trim());
  }
  return out;
}
function minMax(values) {
  return { min: Math.min(...values), max: Math.max(...values) };
}

// ---------------------------------------------------------------------------
// Blank / normalised records
// ---------------------------------------------------------------------------
export function blankResult(kind = 'other') {
  return {
    id: newId('res'),
    name: '',
    kind: KIND_KEYS.has(kind) ? kind : 'other',
    unit: '',
    min: null,
    max: null,
    testNeeded: '',
    link: { varied: '', points: [] },
  };
}

export function blankPoint() {
  return { id: newId('m'), choice: '', input: '', value: null, source: '' };
}

export function blankCalculation() {
  return {
    caseId: '',
    resultId: '',
    productConfirmed: false,
    distributionMode: 'paper',
    measured: { meanMPa: null, cvPct: null, n: null, source: '' },
    baseline: { inputMeanMPa: null, outputMeanMPa: null, n: null, source: '' },
  };
}

export function normalizeCalculation(raw = {}) {
  const base = blankCalculation();
  if (!raw || typeof raw !== 'object') return base;
  const measured = raw.measured && typeof raw.measured === 'object' ? raw.measured : {};
  const baseline = raw.baseline && typeof raw.baseline === 'object' ? raw.baseline : {};
  return {
    caseId: clean(raw.caseId, 80),
    resultId: clean(raw.resultId, 80),
    productConfirmed: raw.productConfirmed === true,
    distributionMode: raw.distributionMode === 'measured' ? 'measured' : 'paper',
    measured: {
      meanMPa: numOrNull(measured.meanMPa),
      cvPct: numOrNull(measured.cvPct),
      n: numOrNull(measured.n),
      source: clean(measured.source, 220),
    },
    baseline: {
      inputMeanMPa: numOrNull(baseline.inputMeanMPa),
      outputMeanMPa: numOrNull(baseline.outputMeanMPa),
      n: numOrNull(baseline.n),
      source: clean(baseline.source, 220),
    },
  };
}

export function blankRecord() {
  const stamp = nowIso();
  return {
    schema: RECORD_SCHEMA,
    id: newId('rec'),
    createdAt: stamp,
    updatedAt: stamp,
    product: '',
    input: { plasticType: '', batch: '', mix: '', contamination: '' },
    results: [blankResult()],
    calculation: blankCalculation(),
  };
}

export function normalizePoint(raw = {}) {
  const point = {
    id: clean(raw.id, 80) || newId('m'),
    choice: clean(raw.choice, 100),
    input: clean(raw.input, 120),
    value: numOrNull(raw.value),
    source: clean(raw.source, 220),
  };
  if (!point.choice && !point.input && point.value == null && !point.source) return null;
  return point;
}

export function normalizeResult(raw = {}) {
  const link = raw.link && typeof raw.link === 'object' ? raw.link : {};
  const points = Array.isArray(link.points) ? link.points.map(normalizePoint).filter(Boolean).slice(0, MAX_POINTS) : [];
  const min = numOrNull(raw.min);
  const max = numOrNull(raw.max);
  return {
    id: clean(raw.id, 80) || newId('res'),
    name: clean(raw.name, 90),
    kind: KIND_KEYS.has(raw.kind) ? raw.kind : 'other',
    unit: clean(raw.unit, 24),
    min,
    max,
    testNeeded: cleanBlock(raw.testNeeded, 1200),
    link: { varied: clean(link.varied, 360), points },
  };
}

export function normalizeRecord(raw = {}) {
  const source = raw && raw.record && typeof raw.record === 'object' ? raw.record : raw;
  const input = source.input && typeof source.input === 'object' ? source.input : {};
  const stamp = nowIso();
  const results = Array.isArray(source.results) ? source.results.map(normalizeResult).slice(0, MAX_RESULTS) : [];
  return {
    schema: RECORD_SCHEMA,
    id: clean(source.id, 80) || newId('rec'),
    createdAt: clean(source.createdAt, 40) || stamp,
    updatedAt: clean(source.updatedAt, 40) || stamp,
    product: clean(source.product, 140),
    input: {
      plasticType: clean(input.plasticType, 180),
      batch: clean(input.batch, 180),
      mix: clean(input.mix, 180),
      contamination: clean(input.contamination, 180),
    },
    results: results.length ? results : [blankResult()],
    calculation: normalizeCalculation(source.calculation),
  };
}

export function recordTitle(record) {
  return clean(record && record.product, 140) || 'Untitled record';
}

export function newRecord() {
  return blankRecord();
}

export function cloneRecord(record) {
  const copy = normalizeRecord(JSON.parse(JSON.stringify(record)));
  copy.id = newId('rec');
  copy.createdAt = nowIso();
  copy.updatedAt = copy.createdAt;
  return copy;
}

// ---------------------------------------------------------------------------
// Result kind / target helpers
// ---------------------------------------------------------------------------
export function classifyResultKind(name, unit = '') {
  const text = `${name || ''} ${unit || ''}`.toLowerCase();
  if (/(sound|acoustic|noise|insulat|transmission loss|stc|r'?w|db)/.test(text)) return 'sound';
  if (/(mass|weight|weigh|gram|kg|kilogram)/.test(text)) return 'mass';
  if (/(stiff|modul|young|elastic|gpa)/.test(text)) return 'stiffness';
  if (/(strength|stress|yield|tensile|flexural|break|mpa)/.test(text)) return 'strength';
  if (/(thick|depth|dimension|width|height|size)/.test(text)) return 'thickness';
  return 'other';
}

/** Explicit kind wins; "other" gets a best-effort classification from the typed name/unit. */
export function effectiveKind(result) {
  const explicit = result && result.kind;
  if (KIND_KEYS.has(explicit) && explicit !== 'other') return explicit;
  return classifyResultKind(result && result.name, result && result.unit);
}

export function kindLabel(kind) {
  const hit = RESULT_KINDS.find((k) => k.key === kind);
  return hit ? hit.label : 'Other result';
}

export function targetState(result) {
  const min = numOrNull(result && result.min);
  const max = numOrNull(result && result.max);
  const hasMin = min != null;
  const hasMax = max != null;
  const valid = hasMin && hasMax && min <= max;
  let error = '';
  if (hasMin && hasMax && min > max) error = 'min-above-max';
  else if (!hasMin || !hasMax) error = 'incomplete';
  return { min, max, hasMin, hasMax, valid, error };
}

export function targetLabel(target, unit = '') {
  if (!target) return 'Target not set';
  if (target.error === 'min-above-max') return 'Target range invalid: min is above max';
  if (!target.valid) return 'Target not set';
  const u = unit ? ` ${unit}` : '';
  return `Target ${formatNumber(target.min)}–${formatNumber(target.max)}${u}`;
}

export function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const d = abs >= 1000 ? 0 : abs >= 100 ? 1 : abs >= 1 ? digits : Math.min(4, digits + 2);
  return Number(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: d });
}

export function formatValue(value, unit = '') {
  if (!Number.isFinite(value)) return '—';
  const u = unit ? ` ${unit}` : '';
  return `${formatNumber(value)}${u}`;
}

export function formatRange(range, unit = '') {
  if (!range) return '—';
  return `${formatNumber(range.min)}–${formatValue(range.max, unit)}`;
}

// ---------------------------------------------------------------------------
// What test would create the link
// ---------------------------------------------------------------------------
export function defaultTestNeeded(record, result) {
  const product = clean(record && record.product, 140) || 'this product';
  const name = clean(result && result.name, 90) || 'this result';
  const kind = effectiveKind(result);
  if (kind === 'sound') {
    return `Measure sound insulation on the same ${product} build at each recycled-input level, using the same acoustic method. Record the source and what varied. A structural 3D model cannot stand in for this acoustic test.`;
  }
  if (kind === 'mass') {
    return `Weigh the same ${product} build on at least two batches that span the input change you expect. Record the source and what varied. A library density is not a measurement of this stream.`;
  }
  if (kind === 'strength') {
    return `Test strength on the same ${product} build at each recycled-input level, with the same test method and process. Record the source and what varied.`;
  }
  if (kind === 'stiffness') {
    return `Measure stiffness or deflection on the same ${product} build at each recycled-input level. Record the source and what varied.`;
  }
  if (kind === 'thickness') {
    return `Measure ${name} on the same ${product} build at each recycled-input level. Record the source and what varied.`;
  }
  return `Measure ${name} on the same ${product} build at each recycled-input level. Record the source and what varied.`;
}

// ---------------------------------------------------------------------------
// 3D applicability gate
// ---------------------------------------------------------------------------
export function threeDStatus(record, result, outcome) {
  const kind = effectiveKind(result);
  const measured = outcome && (outcome.mode === 'link' || outcome.mode === 'batch');
  const base = {
    shapeDependent: null,
    applicable: false,
    status: 'not_applicable',
    label: 'No 3D result',
    simulation: false,
    reason: '',
    required: [],
  };
  if (kind === 'mass') {
    base.shapeDependent = true;
    base.required = ['a measured density of this recycled stream', 'a measured or 3D product volume'];
    if (measured) {
      return {
        ...base,
        status: 'not_needed',
        label: 'Not used',
        reason: 'A measured product result is already available. No 3D model is stored or run for this record.',
      };
    }
    return {
      ...base,
      status: 'blocked',
      label: 'No 3D result',
      reason: 'Mass depends on shape, but a 3D mass needs both measured density and a measured or modelled product volume. Neither is stored here. A library density is not a substitute for the stream measurement.',
    };
  }
  if (kind === 'strength' || kind === 'stiffness') {
    base.shapeDependent = true;
    base.required = ['measured modulus for this material and process', 'measured strength for this material and process', 'a structural 3D model for this product'];
    if (measured) {
      return {
        ...base,
        status: 'not_needed',
        label: 'Not used',
        reason: 'A measured product result is already available. No structural 3D model is stored or run for this record.',
      };
    }
    return {
      ...base,
      status: 'blocked',
      label: 'No 3D result',
      reason: 'Strength and stiffness depend on shape, but a structural 3D model needs measured modulus and strength for this material and process, and no structural 3D model exists for this product. The bracket studio’s 2-D frame is bracket-only and is not used here.',
    };
  }
  if (kind === 'sound') {
    return {
      ...base,
      shapeDependent: false,
      status: 'not_applicable',
      label: 'Not applicable',
      reason: measured
        ? 'The measured link above is acoustic. A structural 3D model cannot compute sound insulation, so no 3D result is shown.'
        : 'Sound insulation is an acoustic result. A structural 3D model cannot compute it; an acoustic measurement or test is required.',
    };
  }
  if (kind === 'thickness') {
    return {
      ...base,
      shapeDependent: false,
      status: 'not_applicable',
      label: 'Not applicable',
      reason: 'Thickness is a dimension, not a shape-dependent simulation result. No 3D model is used.',
    };
  }
  return {
    ...base,
    shapeDependent: null,
    status: 'not_applicable',
    label: 'Not applicable',
    reason: 'No 3D model is defined for this result. This record uses measurements only.',
  };
}

// ---------------------------------------------------------------------------
// The one outcome per result
// ---------------------------------------------------------------------------
function groupedByChoice(points, target, unit) {
  const groups = new Map();
  for (const point of points) {
    const choice = clean(point.choice, 100) || DEFAULT_CHOICE;
    if (!groups.has(choice)) groups.set(choice, []);
    groups.get(choice).push(point);
  }
  return [...groups.entries()].map(([choice, pts]) => {
    const range = minMax(pts.map((p) => p.value));
    const inside = target.valid ? range.min >= target.min && range.max <= target.max : null;
    return { choice, range, inside, count: pts.length, unit };
  });
}

function sourceRows(points) {
  return points.map((p) => ({
    choice: clean(p.choice, 100) || DEFAULT_CHOICE,
    input: clean(p.input, 120),
    value: p.value,
    source: clean(p.source, 220),
  }));
}

function partialRows(points) {
  return points
    .filter((p) => !Number.isFinite(p.value) && (clean(p.choice) || clean(p.input) || clean(p.source)))
    .map((p) => ({
      choice: clean(p.choice, 100) || DEFAULT_CHOICE,
      input: clean(p.input, 120),
      value: null,
      source: clean(p.source, 220),
    }));
}

export function outcomeFor(record, result) {
  const normalized = normalizeResult(result);
  const target = targetState(normalized);
  const points = normalized.link.points;
  const completed = points.filter((p) => Number.isFinite(p.value));
  const partial = partialRows(points);
  const testNeeded = normalized.testNeeded || defaultTestNeeded(record, normalized);
  const name = normalized.name || 'Untitled result';
  const unit = normalized.unit || '';
  const kind = effectiveKind(normalized);

  const finish = (outcome) => {
    const full = {
      resultId: normalized.id,
      name,
      unit,
      kind,
      target,
      testNeeded,
      varied: normalized.link.varied,
      sourceRows: sourceRows(completed),
      partialRows: partial,
      ...outcome,
    };
    full.threeD = threeDStatus(record, normalized, full);
    return full;
  };

  if (!completed.length) {
    return finish({
      mode: 'missing',
      reason: partial.length ? 'incomplete-measurement' : 'no-measurement',
      value: null,
      range: null,
      inside: null,
      inputLabels: [],
      choices: [],
    });
  }

  const withoutSource = completed.filter((p) => !clean(p.source));
  if (withoutSource.length) {
    return finish({
      mode: 'missing',
      reason: 'source-missing',
      value: null,
      range: null,
      inside: null,
      inputLabels: [],
      choices: [],
    });
  }

  const withoutInput = completed.filter((p) => !clean(p.input));
  if (withoutInput.length) {
    return finish({
      mode: 'missing',
      reason: 'input-missing',
      value: null,
      range: null,
      inside: null,
      inputLabels: [],
      choices: [],
    });
  }

  const inputLabels = unique(completed.map((p) => p.input));
  const varied = normalized.link.varied.trim();

  if (inputLabels.length < 2) {
    return finish({
      mode: 'batch',
      reason: 'one-batch',
      value: completed[0].value,
      values: completed.map((p) => ({ value: p.value, choice: clean(p.choice) || DEFAULT_CHOICE })),
      range: null,
      inside: target.valid ? completed.every((p) => p.value >= target.min && p.value <= target.max) : null,
      inputLabels,
      choices: groupedByChoice(completed, target, unit),
    });
  }

  if (!varied) {
    return finish({
      mode: 'missing',
      reason: 'varied-missing',
      value: null,
      range: null,
      inside: null,
      inputLabels,
      choices: [],
    });
  }

  const range = minMax(completed.map((p) => p.value));
  const choices = groupedByChoice(completed, target, unit);
  const insideChoices = target.valid ? choices.filter((c) => c.inside === true) : [];
  return finish({
    mode: 'link',
    reason: 'measured-link',
    value: null,
    range,
    inside: target.valid ? range.min >= target.min && range.max <= target.max : null,
    inputLabels,
    choices,
    insideChoices,
    outsideChoices: target.valid ? choices.filter((c) => c.inside !== true) : [],
  });
}

export function evaluateRecord(record) {
  const normalized = normalizeRecord(record);
  const outcomes = normalized.results.map((result) => outcomeFor(normalized, result));
  return {
    schema: RECORD_SCHEMA,
    record: normalized,
    product: normalized.product,
    results: outcomes,
    counts: {
      total: outcomes.length,
      measuredLink: outcomes.filter((r) => r.mode === 'link').length,
      oneBatch: outcomes.filter((r) => r.mode === 'batch').length,
      missing: outcomes.filter((r) => r.mode === 'missing').length,
    },
  };
}

export function exportRecord(record) {
  const evaluated = evaluateRecord(record);
  return {
    format: EXPORT_FORMAT,
    exported_at: nowIso(),
    note: 'Open consistency record. Results are shown only where a measured link exists. No result is filled from a material preset or the bracket model.',
    record: evaluated.record,
    outcomes: evaluated.results.map((r) => ({
      result_id: r.resultId,
      name: r.name,
      unit: r.unit,
      target: r.target,
      mode: r.mode,
      reason: r.reason,
      measured_range: r.range,
      inside_target: r.inside,
      product_choices: r.choices,
      test_needed: r.testNeeded,
      three_d: r.threeD,
      measurements: r.sourceRows,
    })),
  };
}

/** Parse an exported JSON or a raw record. Throws on unusable input. */
export function importRecord(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Record file is not a JSON object.');
  const raw = payload.record && typeof payload.record === 'object' ? payload.record : payload;
  if (!Array.isArray(raw.results)) throw new Error('Record file has no results list.');
  return normalizeRecord(raw);
}

export const MISSING_REASON_TEXT = {
  'no-measurement': 'No measurement is stored for this product and result.',
  'incomplete-measurement': 'A measurement row is started but has no value yet.',
  'source-missing': 'Every measurement needs a named source before it can be used.',
  'input-missing': 'Every measurement needs the batch or input level it came from.',
  'varied-missing': 'Say what varied between the measurements before this can be treated as a link.',
};

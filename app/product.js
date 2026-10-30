/**
 * AnyRB — one product, one range, one answer.
 *
 * Pure functions only: no DOM, no storage, no network.
 *
 * A person names a product, sets the range a property must stay inside, and
 * enters numbers they measured on that product. The same function returns one
 * of three plain answers for each property:
 *
 *   product — measured across more than one batch
 *   batch   — measured on one batch only
 *   missing — no measured number yet
 *
 * It never fills a number from a product name, a plastic name, a material
 * sheet, a library value or a guessed range. A version is named only when that
 * version was measured.
 */

export const STORE_KEY = 'anyrb.one-product.v1';
export const STATE_VERSION = 2;
export const MAX_PROPERTIES = 8;
export const MAX_MEASUREMENTS = 80;
export const MISSING_CAVEAT = 'A plastic name or a number from a supplier\'s sheet is not enough.';

let idSeq = 0;
function newId(prefix) {
  idSeq = (idSeq + 1) % 1_000_000;
  return `${prefix}-${Date.now().toString(36)}-${idSeq.toString(36)}`;
}

function clean(value, max = 240) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function lowerFirst(value) {
  const text = clean(value);
  if (!text) return '';
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function upperFirst(value) {
  const text = clean(value);
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Accepts "2,100", " 2100 ", "1 800" and numbers; rejects blank and non-finite. */
export function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = clean(value).replace(/,/g, '').replace(/\s/g, '');
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

export function formatNumber(value) {
  if (!Number.isFinite(value)) return '';
  const abs = Math.abs(value);
  const digits = abs >= 100 ? (Number.isInteger(value) ? 0 : 1) : abs >= 1 ? 2 : 3;
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: digits });
}

export function formatValue(value, unit = '') {
  if (!Number.isFinite(value)) return '';
  const suffix = clean(unit) ? ` ${clean(unit)}` : '';
  return `${formatNumber(value)}${suffix}`;
}

export function formatRange(min, max, unit = '') {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return '';
  const suffix = clean(unit) ? ` ${clean(unit)}` : '';
  if (min === max) return `${formatNumber(min)}${suffix}`;
  return `${formatNumber(min)}–${formatNumber(max)}${suffix}`;
}

function numberWord(value) {
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  return Number.isInteger(value) && value >= 0 && value < words.length ? words[value] : String(value);
}

function listPhrases(phrases) {
  const list = phrases.filter(Boolean);
  if (!list.length) return '';
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Blank / normalised state
// ---------------------------------------------------------------------------
export function blankProperty() {
  return { id: newId('property'), name: '', unit: '', min: '', max: '' };
}

export function blankMeasurement(propertyId = '', plastic = {}) {
  const source = plastic && typeof plastic === 'object' ? plastic : {};
  return {
    id: newId('reading'),
    propertyId: clean(propertyId, 80),
    version: '',
    batch: clean(source.batch),
    plasticType: clean(source.type),
    mix: clean(source.mix),
    dirt: clean(source.dirt),
    value: '',
  };
}

export function blankState() {
  return {
    version: STATE_VERSION,
    product: '',
    properties: [blankProperty()],
    plastic: { type: '', batch: '', mix: '', dirt: '' },
    measurements: [],
  };
}

function normalizeProperty(raw = {}) {
  return {
    id: clean(raw.id, 80) || newId('property'),
    name: clean(raw.name, 100),
    unit: clean(raw.unit, 24),
    min: clean(raw.min, 40),
    max: clean(raw.max, 40),
  };
}

function normalizeMeasurement(raw = {}, propertyIds = new Set(), fallbackPlastic = {}) {
  const propertyId = clean(raw.propertyId, 80);
  const has = (key) => Object.prototype.hasOwnProperty.call(raw, key);
  const measurement = {
    id: clean(raw.id, 80) || newId('reading'),
    propertyId: propertyIds.has(propertyId) ? propertyId : '',
    version: clean(raw.version, 100),
    batch: clean(raw.batch, 120),
    plasticType: has('plasticType') ? clean(raw.plasticType, 180) : clean(fallbackPlastic.type, 180),
    mix: has('mix') ? clean(raw.mix, 180) : clean(fallbackPlastic.mix, 180),
    dirt: has('dirt') ? clean(raw.dirt, 180) : clean(fallbackPlastic.dirt, 180),
    value: clean(raw.value, 40),
  };
  if (!measurement.propertyId) return null;
  return measurement;
}

export function normalizeState(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const rawProperties = Array.isArray(source.properties) ? source.properties : [];
  const properties = rawProperties.map(normalizeProperty).slice(0, MAX_PROPERTIES);
  if (!properties.length) properties.push(blankProperty());
  const propertyIds = new Set(properties.map((property) => property.id));
  const plastic = source.plastic && typeof source.plastic === 'object' ? source.plastic : {};
  const normalizedPlastic = {
    type: clean(plastic.type, 180),
    batch: clean(plastic.batch, 120),
    mix: clean(plastic.mix, 180),
    dirt: clean(plastic.dirt, 180),
  };
  const rawMeasurements = Array.isArray(source.measurements) ? source.measurements : [];
  const measurements = rawMeasurements
    .map((measurement) => normalizeMeasurement(measurement, propertyIds, normalizedPlastic))
    .filter(Boolean)
    .slice(0, MAX_MEASUREMENTS);
  return {
    version: STATE_VERSION,
    product: clean(source.product, 140),
    properties,
    plastic: normalizedPlastic,
    measurements,
  };
}

export function propertyIssue(property) {
  const name = clean(property && property.name);
  const min = toNumber(property && property.min);
  const max = toNumber(property && property.max);
  if (!name) return 'name';
  if (min == null || max == null) return 'range';
  if (min > max) return 'order';
  return '';
}

export function targetOf(property) {
  return {
    min: toNumber(property && property.min),
    max: toNumber(property && property.max),
    unit: clean(property && property.unit),
    valid: propertyIssue(property) === '',
  };
}

export function propertyKind(name) {
  const text = lowerFirst(name);
  if (/(weight|mass|gram|kilogram| kg\b| g\b)/.test(text)) return 'weight';
  if (/(sound|acoustic|noise|insulat|decibel| db\b|stc|r'?w\b)/.test(text)) return 'sound';
  if (/(strength|stress|tensile|flexural|yield|break|load)/.test(text)) return 'strength';
  if (/(stiff|modul|young|elastic|deflect|bend)/.test(text)) return 'stiffness';
  if (/(thick|width|height|length|depth|size|dimension)/.test(text)) return 'size';
  return 'other';
}

export function measurementsFor(state, propertyId) {
  return (state.measurements || [])
    .filter((measurement) => measurement.propertyId === propertyId)
    .map((measurement) => ({ ...measurement, numeric: toNumber(measurement.value) }))
    .filter((measurement) => Number.isFinite(measurement.numeric));
}

function sameText(left, right) {
  return clean(left).toLowerCase() === clean(right).toLowerCase();
}

function versionPhrase(label) {
  const text = clean(label);
  if (!text) return 'the version you left unnamed';
  return /\b(version|build|design|run|batch)\b/i.test(text) ? `the ${text}` : `the ${text} version`;
}

function batchReference(label) {
  const bare = clean(label).replace(/^the\s+/i, '');
  if (!bare) return 'the batch you measured';
  if (/^(batch|delivery|lot|load)\b/i.test(bare)) return bare;
  if (/\b(batch|delivery|lot|load)\b/i.test(bare)) return `the ${bare}`;
  return `the ${bare} batch`;
}

function groupRows(rows, keyOf) {
  const groups = new Map();
  for (const row of rows) {
    const display = clean(keyOf(row));
    const key = display.toLowerCase();
    if (!groups.has(key)) groups.set(key, { key, label: display, rows: [] });
    groups.get(key).rows.push(row);
  }
  return [...groups.values()];
}

function rangeOf(rows) {
  const values = rows.map((row) => row.numeric);
  return { min: Math.min(...values), max: Math.max(...values) };
}

function inTarget(range, target) {
  return range.min >= target.min && range.max <= target.max;
}

function missingHelp(property, state) {
  const name = lowerFirst(property.name) || 'this property';
  const kind = propertyKind(property.name);
  const batch = clean(state.plastic && state.plastic.batch);
  const fromBatch = batch ? ` from the ${batch} batch` : '';
  if (kind === 'weight') {
    return `Weigh the piece you made${fromBatch}. If you cannot, multiply the density of this plastic by the volume of the piece.`;
  }
  if (kind === 'sound') {
    return `Do a sound test on the piece you made${fromBatch}.`;
  }
  if (kind === 'strength') {
    return `Test strength on a piece you made${fromBatch}.`;
  }
  if (kind === 'stiffness') {
    return `Test stiffness on a piece you made${fromBatch}.`;
  }
  if (kind === 'size') {
    return `Measure ${name} on the piece you made${fromBatch}.`;
  }
  return `Measure ${name} on a piece you made${fromBatch}.`;
}

function missingNext(property, state) {
  return testCurrentBatch(property, state);
}

function nextBatchNext(property) {
  const name = lowerFirst(property.name) || 'this property';
  const kind = propertyKind(property.name);
  let action;
  if (kind === 'weight') action = 'Weigh one piece from the next batch';
  else if (kind === 'sound') action = 'Run the sound test on one piece from the next batch';
  else if (kind === 'strength') action = 'Run the strength test on one piece from the next batch';
  else if (kind === 'stiffness') action = 'Run the stiffness test on one piece from the next batch';
  else if (kind === 'size') action = `Measure ${name} of one piece from the next batch`;
  else action = `Measure ${name} on one piece from the next batch`;
  return `${action} and add the number above.`;
}

function setupItem(property, issue) {
  const name = lowerFirst(property.name) || 'this property';
  if (issue === 'order') {
    return {
      propertyId: property.id,
      name: clean(property.name),
      kind: 'setup',
      inside: null,
      headline: 'Check the range.',
      text: `The low number for ${name} is above the high number. Swap them so the range reads from low to high.`,
      next: `Fix the range for ${name}.`,
    };
  }
  return {
    propertyId: property.id,
    name: clean(property.name),
    kind: 'setup',
    inside: null,
    headline: 'Set the range first.',
    text: `Enter both numbers for ${name}: the lowest and highest values that still work.`,
    next: `Fill in the range for ${name}.`,
  };
}

function missingItem(property, state) {
  return {
    propertyId: property.id,
    name: clean(property.name),
    kind: 'missing',
    inside: null,
    headline: 'Not enough to answer yet.',
    text: missingHelp(property, state),
    next: missingNext(property, state),
  };
}

function versionGroups(rows, target) {
  return groupRows(rows, (row) => row.version).map((group) => {
    const range = rangeOf(group.rows);
    return {
      ...group,
      range,
      inside: inTarget(range, target),
    };
  });
}

function plasticNow(state) {
  return {
    type: clean(state.plastic && state.plastic.type),
    batch: clean(state.plastic && state.plastic.batch),
    mix: clean(state.plastic && state.plastic.mix),
    dirt: clean(state.plastic && state.plastic.dirt),
  };
}

function identityMatches(row, plastic) {
  return sameText(row.plasticType, plastic.type)
    && sameText(row.mix, plastic.mix)
    && sameText(row.dirt, plastic.dirt);
}

function identityChanges(rows, plastic) {
  const changes = new Set();
  for (const row of rows) {
    if (!sameText(row.plasticType, plastic.type)) changes.add('plastic type');
    if (!sameText(row.mix, plastic.mix)) changes.add('mix');
    if (!sameText(row.dirt, plastic.dirt)) changes.add('dirt or other plastic');
  }
  return [...changes];
}

function differencePhrase(changes) {
  if (!changes.length) return 'different plastic, mix or dirt';
  if (changes.length === 1) {
    if (changes[0] === 'mix') return 'a different mix';
    if (changes[0] === 'plastic type') return 'a different plastic type';
    return `different ${changes[0]}`;
  }
  return `different ${listPhrases(changes)}`;
}

function currentBatchPhrase(plastic) {
  return plastic.batch ? batchReference(plastic.batch) : 'this batch';
}

function testCurrentBatch(property, state) {
  const plastic = plasticNow(state);
  const name = lowerFirst(property.name) || 'this property';
  const kind = propertyKind(property.name);
  const place = plastic.batch ? `from ${batchReference(plastic.batch)}` : 'from this batch';
  let action;
  if (kind === 'weight') action = `Weigh one piece ${place}`;
  else if (kind === 'sound') action = `Run the sound test on one piece ${place}`;
  else if (kind === 'strength') action = `Run the strength test on one piece ${place}`;
  else if (kind === 'stiffness') action = `Run the stiffness test on one piece ${place}`;
  else if (kind === 'size') action = `Measure ${name} of one piece ${place}`;
  else action = `Measure ${name} on one piece ${place}`;
  return `${action} and add the number above.`;
}

function changedPiece(property) {
  const name = lowerFirst(property.name) || 'this property';
  const kind = propertyKind(property.name);
  if (kind === 'weight') return 'Make one changed piece and weigh it before any shipment.';
  if (kind === 'sound') return 'Make one changed piece and run the sound test on it before any shipment.';
  if (kind === 'strength') return 'Make one changed piece and run the strength test on it before any shipment.';
  if (kind === 'stiffness') return 'Make one changed piece and test its stiffness before any shipment.';
  if (kind === 'size') return `Make one changed piece and measure its ${name} before any shipment.`;
  return `Make one changed piece and measure ${name} on it before any shipment.`;
}

function amountOutside(range, target) {
  const unit = target.unit;
  const high = range.max > target.max;
  const low = range.min < target.min;
  if (high && low) {
    return `The lowest reading is ${formatValue(range.min, unit)}, ${formatValue(target.min - range.min, unit)} below your bottom; the highest is ${formatValue(range.max, unit)}, ${formatValue(range.max - target.max, unit)} above your top.`;
  }
  if (high) {
    if (range.min > target.max) {
      const lowGap = range.min - target.max;
      const highGap = range.max - target.max;
      const gap = lowGap === highGap
        ? formatValue(lowGap, unit)
        : `${formatValue(lowGap, unit)} to ${formatValue(highGap, unit)}`;
      return `It is ${gap} above your top of ${formatValue(target.max, unit)}.`;
    }
    return `The highest reading is ${formatValue(range.max, unit)}, ${formatValue(range.max - target.max, unit)} above your top of ${formatValue(target.max, unit)}.`;
  }
  if (low) {
    if (range.max < target.min) {
      const lowGap = target.min - range.max;
      const highGap = target.min - range.min;
      const gap = lowGap === highGap
        ? formatValue(lowGap, unit)
        : `${formatValue(lowGap, unit)} to ${formatValue(highGap, unit)}`;
      return `It is ${gap} below your bottom of ${formatValue(target.min, unit)}.`;
    }
    return `The lowest reading is ${formatValue(range.min, unit)}, ${formatValue(target.min - range.min, unit)} below your bottom of ${formatValue(target.min, unit)}.`;
  }
  return '';
}

function rangeDirection(range, target) {
  if (range.min > target.max) return 'high';
  if (range.max < target.min) return 'low';
  if (range.min < target.min && range.max > target.max) return 'both';
  return 'outside';
}

function versionRangeText(groups, unit) {
  return listPhrases(groups.map((group) => `${versionPhrase(group.label)} at ${formatRange(group.range.min, group.range.max, unit)}`));
}

function plasticSetupItem(property, headline, text, next) {
  return {
    propertyId: property.id,
    name: clean(property.name),
    kind: 'plastic-setup',
    inside: null,
    headline,
    text,
    next,
  };
}

function uncoveredItem(property, state, namedRows, sameMaterialRows) {
  const plastic = plasticNow(state);
  const batch = currentBatchPhrase(plastic);
  let text;
  let headline;
  if (sameMaterialRows.length) {
    headline = 'These numbers do not cover this batch.';
    text = `The numbers on hand do not cover this plastic in ${batch}: the pieces you measured are from other batches of this plastic. Do not ship ${batch}.`;
  } else {
    const changes = identityChanges(namedRows, plastic);
    headline = 'These numbers do not cover this plastic.';
    text = `The numbers on hand do not cover this plastic: the pieces you measured were made with ${differencePhrase(changes)}. Do not ship ${batch}.`;
  }
  return {
    propertyId: property.id,
    name: clean(property.name),
    kind: 'uncovered',
    inside: null,
    headline,
    text,
    next: testCurrentBatch(property, state),
  };
}

function allOutsideItem(property, state, currentRows, sameMaterialRows, target) {
  const plastic = plasticNow(state);
  const name = lowerFirst(property.name) || 'this property';
  const range = rangeOf(sameMaterialRows);
  const currentRange = rangeOf(currentRows);
  const direction = rangeDirection(range, target);
  const batches = new Set(sameMaterialRows.map((row) => clean(row.batch).toLowerCase()).filter(Boolean));
  const pieces = [];
  if (batches.size > 1) {
    if (direction === 'high') {
      pieces.push(`Every measured piece of this plastic is above your ${name} range. Your range is ${formatRange(target.min, target.max, target.unit)}, and the pieces run ${formatRange(range.min, range.max, target.unit)}.`);
    } else if (direction === 'low') {
      pieces.push(`Every measured piece of this plastic is below your ${name} range. Your range is ${formatRange(target.min, target.max, target.unit)}, and the pieces run ${formatRange(range.min, range.max, target.unit)}.`);
    } else {
      pieces.push(`Every measured piece of this plastic is outside your ${name} range. Your range is ${formatRange(target.min, target.max, target.unit)}, and the pieces run ${formatRange(range.min, range.max, target.unit)}; some are below and some are above.`);
    }
  }
  pieces.push(`This batch is outside your ${formatRange(target.min, target.max, target.unit)} range: ${formatRange(currentRange.min, currentRange.max, target.unit)}. ${amountOutside(currentRange, target)}`);
  pieces.push('Do not ship this batch or this combination.');
  return {
    propertyId: property.id,
    name: clean(property.name),
    kind: 'all-outside',
    inside: false,
    headline: batches.size > 1 ? 'Every measured piece is outside.' : 'This batch is outside.',
    text: pieces.join(' '),
    next: changedPiece(property),
  };
}

function insideItem(property, state, currentRows, sameMaterialRows, target) {
  const plastic = plasticNow(state);
  const currentRange = rangeOf(currentRows);
  const currentBatch = currentBatchPhrase(plastic);
  const versions = versionGroups(sameMaterialRows, target);
  const insideVersions = versions.filter((group) => group.inside);
  const outsideVersions = versions.filter((group) => !group.inside);
  const hasVersionSplit = versions.length > 1 && insideVersions.length > 0 && outsideVersions.length > 0;
  const batches = new Set(sameMaterialRows.map((row) => clean(row.batch).toLowerCase()).filter(Boolean));
  const pieces = [];
  const sameRange = rangeOf(sameMaterialRows);
  const batchCount = batches.size;
  if (hasVersionSplit || outsideVersions.length) {
    pieces.push('Some pieces you measured with this plastic are outside your range.');
  } else {
    pieces.push('The pieces you measured with this plastic are inside your range.');
  }
  if (batchCount > 1) {
    pieces.push(`Across the pieces of this plastic you measured, the range is ${formatRange(sameRange.min, sameRange.max, target.unit)}.`);
  }
  pieces.push(`This batch is inside: ${formatRange(currentRange.min, currentRange.max, target.unit)}, within your ${formatRange(target.min, target.max, target.unit)} range.`);
  if (hasVersionSplit) {
    pieces.push(`${upperFirst(versionRangeText(insideVersions, target.unit))} stays inside; ${versionRangeText(outsideVersions, target.unit)} is outside.`);
  }
  if (batches.size === 1) {
    pieces.push('You have measured only one batch. The next batch is unknown until you check it the same way.');
  } else {
    pieces.push('The next batch is still unknown until you test it.');
  }
  const next = hasVersionSplit
    ? `Make ${listPhrases(insideVersions.map((group) => versionPhrase(group.label)))} and drop ${listPhrases(outsideVersions.map((group) => versionPhrase(group.label)))}.`
    : nextBatchNext(property);
  return {
    propertyId: property.id,
    name: clean(property.name),
    kind: 'inside',
    inside: true,
    headline: 'This batch is inside.',
    text: pieces.join(' '),
    next,
  };
}

function outsideItem(property, state, currentRows, sameMaterialRows, target) {
  const plastic = plasticNow(state);
  const currentRange = rangeOf(currentRows);
  const currentBatch = currentBatchPhrase(plastic);
  const versions = versionGroups(sameMaterialRows, target);
  const insideVersions = versions.filter((group) => group.inside);
  const outsideVersions = versions.filter((group) => !group.inside);
  const currentVersions = versionGroups(currentRows, target);
  const currentInsideVersions = currentVersions.filter((group) => group.inside);
  const currentOutsideVersions = currentVersions.filter((group) => !group.inside);
  const batches = new Set(sameMaterialRows.map((row) => clean(row.batch).toLowerCase()).filter(Boolean));
  const pieces = [];
  const partial = currentInsideVersions.length > 0 && currentOutsideVersions.length > 0;
  const currentOutsideRows = currentRows.filter((row) => row.numeric < target.min || row.numeric > target.max);
  const currentOutsideRange = rangeOf(currentOutsideRows);
  const sameRange = rangeOf(sameMaterialRows);
  pieces.push('Some pieces you measured with this plastic are outside your range.');
  pieces.push(`Across the pieces of this plastic you measured, the range is ${formatRange(sameRange.min, sameRange.max, target.unit)}.`);
  if (partial) {
    pieces.push(`Part of this batch is outside: ${versionRangeText(currentOutsideVersions, target.unit)}. ${amountOutside(currentOutsideRange, target)}`);
    pieces.push(`${upperFirst(versionRangeText(currentInsideVersions, target.unit))} stays inside.`);
    pieces.push(`Do not ship ${listPhrases(currentOutsideVersions.map((group) => versionPhrase(group.label)))} from ${currentBatch}.`);
  } else {
    pieces.push(`This batch is outside your ${formatRange(target.min, target.max, target.unit)} range: ${formatRange(currentRange.min, currentRange.max, target.unit)}. ${amountOutside(currentRange, target)}`);
    pieces.push(`Do not ship ${currentBatch}.`);
  }
  if (insideVersions.length && !currentInsideVersions.length) {
    pieces.push(`${upperFirst(versionRangeText(insideVersions, target.unit))} was inside on the pieces you measured of this plastic.`);
  }
  if (!insideVersions.length) {
    pieces.push('No measured version of this plastic stayed inside.');
  }
  if (batches.size === 1) {
    pieces.push('You have measured only one batch. The next batch is unknown until you check it the same way.');
  }
  let next;
  if (currentInsideVersions.length && currentOutsideVersions.length) {
    next = `Make ${listPhrases(currentInsideVersions.map((group) => versionPhrase(group.label)))}; keep ${currentBatch} for ${currentInsideVersions.length === 1 ? 'that version' : 'those versions'} only.`;
  } else if (insideVersions.length) {
    next = `Make ${listPhrases(insideVersions.map((group) => versionPhrase(group.label)))} and hold ${currentBatch}.`;
  } else {
    next = changedPiece(property);
  }
  return {
    propertyId: property.id,
    name: clean(property.name),
    kind: 'outside',
    inside: false,
    headline: currentInsideVersions.length && currentOutsideVersions.length
      ? 'This batch is outside, but one version is inside.'
      : 'This batch is outside.',
    text: pieces.join(' '),
    next,
  };
}

function answerForProperty(state, property) {
  const issue = propertyIssue(property);
  if (issue === 'name') return null;
  if (issue) return setupItem(property, issue);
  const allRows = measurementsFor(state, property.id);
  if (!allRows.length) return missingItem(property, state);
  const unnamedCount = allRows.filter((row) => !clean(row.batch)).length;
  const rows = allRows.filter((row) => clean(row.batch));
  if (!rows.length) return unnamedItem(property, unnamedCount);
  const plastic = plasticNow(state);
  if (!plastic.type) {
    return plasticSetupItem(property, 'Which plastic is this?', 'Name the plastic this batch is made from so the numbers can be matched to it.', 'Add the plastic type above.');
  }
  if (!plastic.batch) {
    return plasticSetupItem(property, 'Name this batch.', 'Add the batch you have now so the numbers can be matched to it.', 'Add the batch name above.');
  }
  const sameMaterialRows = rows.filter((row) => identityMatches(row, plastic));
  const differentIdentityCount = rows.length - sameMaterialRows.length;
  const currentRows = sameMaterialRows.filter((row) => sameText(row.batch, plastic.batch));
  const target = targetOf(property);
  let item;
  if (!currentRows.length) {
    item = uncoveredItem(property, state, rows, sameMaterialRows);
  } else if (sameMaterialRows.every((row) => row.numeric < target.min || row.numeric > target.max)) {
    item = allOutsideItem(property, state, currentRows, sameMaterialRows, target);
  } else {
    const currentRange = rangeOf(currentRows);
    item = inTarget(currentRange, target)
      ? insideItem(property, state, currentRows, sameMaterialRows, target)
      : outsideItem(property, state, currentRows, sameMaterialRows, target);
  }
  if (sameMaterialRows.length && differentIdentityCount) item.text = `${item.text} ${differentPlasticText(differentIdentityCount)}`;
  if (unnamedCount) item.text = `${item.text} ${allUnnamedText(unnamedCount)}`;
  return item;
}

function unnamedItem(property, count) {
  const plural = count > 1;
  return {
    propertyId: property.id,
    name: clean(property.name),
    kind: 'batch-name',
    inside: null,
    headline: plural ? 'Name the batches for these numbers.' : 'Name the batch for this number.',
    text: plural
      ? 'These numbers are saved, but they have no batches. Add the batch each one came from so the answer can compare deliveries.'
      : 'The number is saved, but it has no batch. Add the batch it came from so the answer can compare one delivery with the next.',
    next: plural ? 'Add the batch names above.' : 'Add the batch name above.',
  };
}

function allUnnamedText(count) {
  return count === 1
    ? 'One number has no batch name, so it is not used yet. Add the batch above.'
    : `${count} numbers have no batch names, so they are not used yet. Add the batches above.`;
}

function differentPlasticText(count) {
  return count === 1
    ? 'One number was measured with a different plastic, mix or dirt, so it is not used here.'
    : `${count} numbers were measured with a different plastic, mix or dirt, so they are not used here.`;
}

function earlyAnswer(headline, text, next) {
  return {
    headline,
    items: [{ propertyId: '', name: '', kind: 'setup', inside: null, headline, text, next }],
    next,
  };
}

/**
 * Build the plain answer for the whole product.
 * Every property gets one item; the page shows the items in order and one next
 * action chosen from the most immediate unresolved item.
 */
export function buildAnswer(input) {
  const state = normalizeState(input);
  if (!state.product) {
    return earlyAnswer(
      'Start with what you are making.',
      'A product name and a range are enough to start. Add a measurement when you have one.',
      'Write the product name above.',
    );
  }
  const properties = state.properties.filter((property) => clean(property.name));
  if (!properties.length) {
    return earlyAnswer(
      'What has to stay steady?',
      'Add a property and the range it must stay inside. Weight, thickness, strength, stiffness, sound insulation — anything you can put a number on.',
      'Name a property and set its range.',
    );
  }

  const items = properties.map((property) => answerForProperty(state, property)).filter(Boolean);
  if (!items.length) {
    return earlyAnswer('What has to stay steady?', 'Add a property and the range it must stay inside.', 'Name a property and set its range.');
  }

  const urgentKinds = new Set(['uncovered', 'outside', 'all-outside']);
  const setup = items.filter((item) => item.kind === 'setup');
  const plasticSetup = items.filter((item) => item.kind === 'plastic-setup');
  const unnamed = items.filter((item) => item.kind === 'batch-name');
  const urgent = items.filter((item) => urgentKinds.has(item.kind));
  const missing = items.filter((item) => item.kind === 'missing');
  const inside = items.filter((item) => item.kind === 'inside');
  if (missing.length) missing[0].text = `${missing[0].text} ${MISSING_CAVEAT}`;

  let headline;
  let next;
  if (items.length === 1) {
    headline = items[0].headline;
  } else if (urgent.length) {
    if (urgent.length === 1) {
      headline = urgent[0].headline;
    } else {
      const allUncovered = urgent.every((item) => item.kind === 'uncovered');
      const allOutside = urgent.every((item) => item.kind === 'outside' || item.kind === 'all-outside');
      const count = upperFirst(numberWord(urgent.length));
      headline = allOutside
        ? `${count} properties are outside your range.`
        : allUncovered
          ? `${count} properties are not covered by these numbers.`
          : `${count} properties need attention.`;
    }
  } else if (setup.length) {
    headline = 'Set the range first.';
  } else if (plasticSetup.length) {
    const sameHeadline = plasticSetup.every((item) => item.headline === plasticSetup[0].headline);
    headline = sameHeadline ? plasticSetup[0].headline : 'Name the plastic and this batch.';
  } else if (unnamed.length) {
    headline = unnamed.length === 1 ? 'One batch name is missing.' : `${upperFirst(numberWord(unnamed.length))} batch names are missing.`;
  } else if (missing.length) {
    headline = 'Not enough to answer everything yet.';
  } else if (inside.length === items.length) {
    headline = 'This batch is inside.';
  } else {
    headline = 'Here is where you stand.';
  }

  if (urgent.length) next = urgent[0].next;
  else if (setup.length) next = setup[0].next;
  else if (plasticSetup.length) next = plasticSetup[0].next;
  else if (unnamed.length) next = unnamed.length === 1 ? unnamed[0].next : 'Add the batch names above.';
  else if (missing.length) next = missing[0].next;
  else if (inside.length) next = inside[0].next;
  else next = '';

  return { headline, items, next };
}

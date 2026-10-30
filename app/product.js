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
export const STATE_VERSION = 1;
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

function allVersionsPhrase(value) {
  if (value === 2) return 'both measured versions';
  if (value === 3) return 'all three measured versions';
  return `all ${numberWord(value)} measured versions`;
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

export function blankMeasurement(propertyId = '', batch = '') {
  return {
    id: newId('reading'),
    propertyId: clean(propertyId, 80),
    version: '',
    batch: clean(batch),
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

function normalizeMeasurement(raw = {}, propertyIds = new Set()) {
  const propertyId = clean(raw.propertyId, 80);
  const measurement = {
    id: clean(raw.id, 80) || newId('reading'),
    propertyId: propertyIds.has(propertyId) ? propertyId : '',
    version: clean(raw.version, 100),
    batch: clean(raw.batch, 120),
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
  const rawMeasurements = Array.isArray(source.measurements) ? source.measurements : [];
  const measurements = rawMeasurements
    .map((measurement) => normalizeMeasurement(measurement, propertyIds))
    .filter(Boolean)
    .slice(0, MAX_MEASUREMENTS);
  const plastic = source.plastic && typeof source.plastic === 'object' ? source.plastic : {};
  return {
    version: STATE_VERSION,
    product: clean(source.product, 140),
    properties,
    plastic: {
      type: clean(plastic.type, 180),
      batch: clean(plastic.batch, 120),
      mix: clean(plastic.mix, 180),
      dirt: clean(plastic.dirt, 180),
    },
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

function rangeSentence(rows, property, target) {
  const range = rangeOf(rows);
  const name = lowerFirst(property.name) || 'this property';
  const unit = target.unit;
  const count = rows.length;
  if (range.min === range.max) {
    if (count === 1) return `The measurement is ${formatValue(range.min, unit)}.`;
    return `All ${numberWord(count)} measurements read ${formatValue(range.min, unit)}.`;
  }
  return `The measurements run from ${formatNumber(range.min)} to ${formatValue(range.max, unit)}.`;
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
  const name = lowerFirst(property.name) || 'this property';
  const kind = propertyKind(property.name);
  const batch = clean(state.plastic && state.plastic.batch);
  const fromBatch = batch ? ` from the ${batch} batch` : '';
  let action;
  if (kind === 'weight') action = `Weigh one piece${fromBatch}`;
  else if (kind === 'sound') action = `Do a sound test on one piece${fromBatch}`;
  else if (kind === 'strength' || kind === 'stiffness') action = `Test ${name} on one piece${fromBatch}`;
  else if (kind === 'size') action = `Measure ${name} on one piece${fromBatch}`;
  else action = `Measure ${name} on one piece${fromBatch}`;
  return `${action} and add the number above.`;
}

function nextBatchNext(property) {
  const name = lowerFirst(property.name) || 'this property';
  const kind = propertyKind(property.name);
  let action;
  if (kind === 'weight') action = 'Weigh one piece from the next batch';
  else if (kind === 'sound') action = 'Do a sound test on one piece from the next batch';
  else if (kind === 'strength' || kind === 'stiffness') action = `Test ${name} on one piece from the next batch`;
  else if (kind === 'size') action = `Measure ${name} on one piece from the next batch`;
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

function currentBatchInfo(state, rows) {
  const current = clean(state.plastic && state.plastic.batch);
  if (!current) return null;
  const matched = rows.filter((row) => sameText(row.batch, current));
  return { label: current, matched: matched.length > 0, rows: matched };
}

function batchAnswer(state, property, rows) {
  const target = targetOf(property);
  const range = rangeOf(rows);
  const inside = inTarget(range, target);
  const current = currentBatchInfo(state, rows);
  const measuredGroups = groupRows(rows, (row) => row.batch);
  const onlyLabel = measuredGroups.length === 1 ? measuredGroups[0].label : '';
  const thisBatch = current && current.matched;
  const subject = thisBatch ? 'This batch' : upperFirst(batchReference(onlyLabel));
  const versions = versionGroups(rows, target);
  const insideVersions = versions.filter((group) => group.inside);
  const outsideVersions = versions.filter((group) => !group.inside);
  const hasVersionSplit = versions.length > 1 && insideVersions.length > 0 && outsideVersions.length > 0;

  const pieces = [];
  if (hasVersionSplit) {
    const insideText = listPhrases(insideVersions.map((group) => `${versionPhrase(group.label)} (${formatRange(group.range.min, group.range.max, target.unit)})`));
    const outsideText = listPhrases(outsideVersions.map((group) => `${versionPhrase(group.label)} (${formatRange(group.range.min, group.range.max, target.unit)})`));
    pieces.push(`${upperFirst(subject)} is inside for ${insideText} and outside for ${outsideText}.`);
    pieces.push(`Make ${listPhrases(insideVersions.map((group) => versionPhrase(group.label)))} and drop ${listPhrases(outsideVersions.map((group) => versionPhrase(group.label)))}. Do not use this batch for the ${outsideVersions.length === 1 ? 'version' : 'versions'} you are dropping.`);
  } else if (versions.length > 1 && inside) {
    const versionText = versions.map((group) => `${versionPhrase(group.label)} at ${formatRange(group.range.min, group.range.max, target.unit)}`).join('; ');
    pieces.push(`${upperFirst(subject)} is inside for ${allVersionsPhrase(versions.length)}: ${versionText}.`);
  } else {
    pieces.push(`${subject} measures ${formatRange(range.min, range.max, target.unit)}. Your range is ${formatRange(target.min, target.max, target.unit)}, so ${thisBatch ? 'this batch' : 'that batch'} is ${inside ? 'inside' : 'outside'}.`);
  }

  if (versions.length === 1 && !inside) {
    pieces.push('Hold this batch; do not ship it as this product.');
  }
  if (current && !current.matched) {
    pieces.push(`You have not measured ${batchReference(current.label)} yet.`);
  }
  pieces.push('You have measured only one batch. The next batch is unknown until you check it the same way.');

  let next;
  if (current && !current.matched) {
    next = `Test one piece from ${batchReference(current.label)} and add the number above.`;
  } else if (!inside && !hasVersionSplit) {
    next = `Hold this batch, then ${nextBatchNext(property).replace(/^./, (letter) => letter.toLowerCase())}`;
  } else {
    next = nextBatchNext(property);
  }
  return {
    propertyId: property.id,
    name: clean(property.name),
    kind: 'batch',
    inside,
    currentMatched: Boolean(thisBatch),
    headline: hasVersionSplit
      ? 'One version is inside.'
      : thisBatch
        ? inside ? 'This batch is inside.' : 'This batch is outside.'
        : inside ? 'One batch is inside.' : 'One batch is outside.',
    text: pieces.join(' '),
    next,
  };
}

function productAnswer(state, property, rows) {
  const target = targetOf(property);
  const range = rangeOf(rows);
  const inside = inTarget(range, target);
  const versions = versionGroups(rows, target);
  const insideVersions = versions.filter((group) => group.inside);
  const outsideVersions = versions.filter((group) => !group.inside);
  const current = currentBatchInfo(state, rows);
  const pieces = [];

  pieces.push(rangeSentence(rows, property, target));
  const outsideNone = range.max < target.min || range.min > target.max;
  pieces.push(`Your range is ${formatRange(target.min, target.max, target.unit)}, so ${inside ? 'all of the measured numbers are inside it' : outsideNone ? 'none of the measured numbers is inside it' : 'not every measured number is inside it'}.`);

  if (versions.length > 1) {
    const insideParts = insideVersions.map((group) => `${versionPhrase(group.label)} stays inside at ${formatRange(group.range.min, group.range.max, target.unit)}`);
    const outsideParts = outsideVersions.map((group) => `${versionPhrase(group.label)} is outside at ${formatRange(group.range.min, group.range.max, target.unit)}`);
    if (insideParts.length) pieces.push(`${upperFirst(listPhrases(insideParts))}.`);
    if (outsideParts.length) pieces.push(`${upperFirst(listPhrases(outsideParts))}.`);
  }

  if (current) {
    if (!current.matched) {
      pieces.push(`You have not measured ${batchReference(current.label)} yet.`);
    } else {
      const currentTarget = target;
      const currentRange = rangeOf(current.rows);
      const currentInside = inTarget(currentRange, currentTarget);
      if (currentInside) {
        pieces.push(`${upperFirst(batchReference(current.label))} is inside${inside ? '.' : '; another batch measured outside your range.'}`);
      } else {
        const currentVersions = versionGroups(current.rows, currentTarget);
        const currentOutside = currentVersions.filter((group) => !group.inside);
        if (currentVersions.length > 1 && currentOutside.length) {
          pieces.push(`${upperFirst(batchReference(current.label))} is outside for ${listPhrases(currentOutside.map((group) => versionPhrase(group.label)))}. Do not ship that version from this batch.`);
        } else {
          pieces.push(`${upperFirst(batchReference(current.label))} is outside. Hold it; do not ship it as this product.`);
        }
      }
    }
  }

  if (versions.length > 1) {
    if (!insideVersions.length) {
      pieces.push('None of the measured versions stays inside. Change the build or the mix; do not ship this version as it is.');
    } else if (outsideVersions.length) {
      // The next action names the version to make and the version to drop.
    } else {
      pieces.push('All measured versions stay inside.');
    }
  } else if (!inside) {
    const currentInside = current && current.matched && inTarget(rangeOf(current.rows), target);
    if (!currentInside) pieces.push('Change the build or the mix.');
  } else {
    pieces.push('Keep making this version.');
  }

  if (inside && current && current.matched) {
    pieces.push('A new batch is still unknown until you test it.');
  }

  let headline = inside ? 'This product stays inside.' : 'This product is outside.';
  if (insideVersions.length && outsideVersions.length) headline = 'One version stays inside.';
  if (!insideVersions.length && versions.length > 1) headline = 'None of these versions stays inside.';

  const makeAndDrop = () => `Make ${listPhrases(insideVersions.map((group) => versionPhrase(group.label)))} and drop ${listPhrases(outsideVersions.map((group) => versionPhrase(group.label)))}`;
  let next;
  if (insideVersions.length && outsideVersions.length) {
    next = `${makeAndDrop()}.`;
  } else if (current && !current.matched) {
    next = `Test one piece from the ${current.label} batch and add the number above.`;
  } else if (current && current.matched) {
    const currentRange = rangeOf(current.rows);
    const currentInside = inTarget(currentRange, target);
    if (!currentInside) {
      next = `Hold ${batchReference(current.label)} and change the build or the mix before you ship.`;
    } else {
      next = nextBatchNext(property);
    }
  } else if (inside) {
    next = nextBatchNext(property);
  } else if (insideVersions.length) {
    next = `Make ${listPhrases(insideVersions.map((group) => versionPhrase(group.label)))} and change the build or the mix for the rest.`;
  } else {
    next = 'Change the build or the mix, then test one piece before you ship.';
  }

  return {
    propertyId: property.id,
    name: clean(property.name),
    kind: 'product',
    inside,
    headline,
    text: pieces.join(' '),
    next,
  };
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

function answerForProperty(state, property) {
  const issue = propertyIssue(property);
  if (issue === 'name') return null;
  if (issue) return setupItem(property, issue);
  const allRows = measurementsFor(state, property.id);
  if (!allRows.length) return missingItem(property, state);
  const rows = allRows.filter((row) => clean(row.batch));
  const unnamedCount = allRows.length - rows.length;
  if (!rows.length) return unnamedItem(property, unnamedCount);
  let item;
  const namedBatches = new Set(rows.map((row) => clean(row.batch).toLowerCase()).filter(Boolean));
  if (namedBatches.size >= 2) item = productAnswer(state, property, rows);
  else item = batchAnswer(state, property, rows);
  if (unnamedCount) item.text = `${item.text} ${allUnnamedText(unnamedCount)}`;
  return item;
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

  const setup = items.filter((item) => item.kind === 'setup');
  const unnamed = items.filter((item) => item.kind === 'batch-name');
  const outside = items.filter((item) => !['setup', 'batch-name'].includes(item.kind) && item.inside === false);
  const missing = items.filter((item) => item.kind === 'missing');
  const measured = items.filter((item) => item.kind === 'batch' || item.kind === 'product');
  if (missing.length) missing[0].text = `${missing[0].text} ${MISSING_CAVEAT}`;

  let headline;
  let next;
  if (items.length === 1) {
    headline = items[0].headline;
  } else if (outside.length) {
    headline = outside.length === 1 ? 'One property is outside your range.' : `${upperFirst(numberWord(outside.length))} properties are outside your range.`;
  } else if (setup.length) {
    headline = 'Set the range first.';
  } else if (unnamed.length) {
    headline = unnamed.length === 1 ? 'One batch name is missing.' : `${upperFirst(numberWord(unnamed.length))} batch names are missing.`;
  } else if (missing.length) {
    headline = 'Not enough to answer everything yet.';
  } else if (measured.every((item) => item.kind === 'product')) {
    headline = 'This product stays inside.';
  } else if (measured.every((item) => item.kind === 'batch')) {
    headline = measured.every((item) => item.currentMatched) ? 'This batch is inside.' : 'The measured batches are inside.';
  } else {
    headline = 'Here is where you stand.';
  }

  if (outside.length) next = outside[0].next;
  else if (setup.length) next = setup[0].next;
  else if (unnamed.length) next = unnamed.length === 1 ? unnamed[0].next : 'Add the batch names above.';
  else if (missing.length) next = missing[0].next;
  else if (measured.length) next = measured[0].next;
  else next = '';

  return { headline, items, next };
}

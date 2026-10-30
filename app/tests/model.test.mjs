/**
 * AnyRB — tests for the one-product answer.
 *
 *   node app/tests/model.test.mjs
 *
 * These tests pin the three honest outcomes, the version rule, the property-
 * specific "what to measure" copy, and the absence of lab language in the
 * active page.
 */

import fs from 'node:fs';
import * as M from '../product.js';

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok ${name}`);
  } catch (error) {
    failed += 1;
    failures.push({ name, error });
    console.log(`not ok ${name}`);
    console.log(`  ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'assertion failed');
}

function equal(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message || 'value'}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

function includes(text, fragment, message) {
  if (!String(text).includes(fragment)) throw new Error(`${message || 'text'}: missing ${JSON.stringify(fragment)} in ${JSON.stringify(text)}`);
}

function excludes(text, fragment, message) {
  if (String(text).includes(fragment)) throw new Error(`${message || 'text'}: found ${JSON.stringify(fragment)} in ${JSON.stringify(text)}`);
}

function makeState(overrides = {}) {
  return M.normalizeState({
    product: 'Bench slat',
    properties: [{ id: 'p1', name: 'stiffness', unit: 'MPa', min: '1800', max: '2400' }],
    plastic: { type: 'recycled polypropylene', batch: 'April', mix: '20% HDPE', dirt: 'labels' },
    measurements: [],
    ...overrides,
  });
}

function reading(propertyId, version, batch, value) {
  return { propertyId, version, batch, value };
}

function answerText(answer) {
  return [answer.headline, ...answer.items.map((item) => `${item.name} ${item.text}`), answer.next].join('\n');
}

// ---------------------------------------------------------------------------
// Empty and incomplete states
// ---------------------------------------------------------------------------
test('first open asks for the product, not for a measurement', () => {
  const answer = M.buildAnswer(M.blankState());
  equal(answer.headline, 'Start with what you are making.');
  includes(answer.next, 'product name');
  equal(answer.items.length, 1);
});

test('a product with no named property asks what has to stay steady', () => {
  const answer = M.buildAnswer(makeState({ properties: [{ id: 'p1', name: '', unit: '', min: '', max: '' }] }));
  equal(answer.headline, 'What has to stay steady?');
});

test('a property without a range asks for both numbers first', () => {
  const answer = M.buildAnswer(makeState({ properties: [{ id: 'p1', name: 'stiffness', unit: 'MPa', min: '', max: '' }] }));
  equal(answer.headline, 'Set the range first.');
  includes(answer.next, 'Fill in the range for stiffness');
});

test('a reversed range is called out, not used', () => {
  const answer = M.buildAnswer(makeState({ properties: [{ id: 'p1', name: 'stiffness', unit: 'MPa', min: '2400', max: '1800' }] }));
  equal(answer.headline, 'Check the range.');
  includes(answer.next, 'Fix the range for stiffness');
});

// ---------------------------------------------------------------------------
// No measurement: no invented number
// ---------------------------------------------------------------------------
test('no measurement gives no result number and no chart data', () => {
  const state = makeState({ plastic: { type: 'mixed plastic', batch: '', mix: '', dirt: '' } });
  const answer = M.buildAnswer(state);
  equal(answer.headline, 'Not enough to answer yet.');
  const text = answerText(answer);
  excludes(text, '1,800');
  excludes(text, '2,400');
  excludes(text, '0');
  includes(text, 'Test stiffness on a piece you made');
  includes(answer.next, 'add the number above');
});

test('weight says to weigh the piece or use density and volume', () => {
  const state = makeState({ properties: [{ id: 'p1', name: 'weight', unit: 'g', min: '400', max: '480' }] });
  const answer = M.buildAnswer(state);
  const text = answerText(answer);
  includes(text, 'Weigh the piece you made');
  includes(text, 'density of this plastic by the volume');
  includes(text, 'A plastic name or a number from a supplier\'s sheet is not enough.');
  excludes(text, '400');
  excludes(text, '480');
});

test('sound asks for a sound test on the actual piece', () => {
  const state = makeState({ properties: [{ id: 'p1', name: 'sound insulation', unit: 'dB', min: '30', max: '40' }] });
  const text = answerText(M.buildAnswer(state));
  includes(text, 'Do a sound test on the piece you made');
  includes(text, 'A plastic name or a number from a supplier\'s sheet is not enough.');
  excludes(text, '30');
  excludes(text, '40');
});

test('strength and thickness use their own plain instruction', () => {
  const strength = M.buildAnswer(makeState({ properties: [{ id: 'p1', name: 'strength', unit: 'MPa', min: '20', max: '30' }] }));
  includes(answerText(strength), 'Test strength on a piece you made');
  const thickness = M.buildAnswer(makeState({ properties: [{ id: 'p1', name: 'thickness', unit: 'mm', min: '2', max: '3' }] }));
  includes(answerText(thickness), 'Measure thickness on the piece you made');
});

// ---------------------------------------------------------------------------
// One batch
// ---------------------------------------------------------------------------
test('one batch inside gives the number, the range, and the next check', () => {
  const state = makeState({ measurements: [reading('p1', '3 mm wall', 'April', '2100')] });
  const answer = M.buildAnswer(state);
  equal(answer.headline, 'This batch is inside.');
  const text = answerText(answer);
  includes(text, '2,100 MPa');
  includes(text, '1,800–2,400 MPa');
  includes(text, 'You have measured only one batch.');
  includes(text, 'The next batch is unknown until you check it the same way.');
  includes(answer.next, 'next batch');
});

test('one batch outside says hold it and what to check next', () => {
  const state = makeState({ measurements: [reading('p1', '3 mm wall', 'April', '2610')] });
  const answer = M.buildAnswer(state);
  equal(answer.headline, 'This batch is outside.');
  const text = answerText(answer);
  includes(text, 'Hold this batch; do not ship it as this product.');
  includes(answer.next, 'Hold this batch');
  includes(answer.next, 'next batch');
});

test('two versions in one batch name what to make and what to drop', () => {
  const state = makeState({
    measurements: [
      reading('p1', '3 mm wall', 'April', '2100'),
      reading('p1', '2 mm wall', 'April', '2600'),
    ],
  });
  const answer = M.buildAnswer(state);
  equal(answer.headline, 'One version is inside.');
  const text = answerText(answer);
  includes(text, 'inside for the 3 mm wall version');
  includes(text, 'outside for the 2 mm wall version');
  includes(text, 'Make the 3 mm wall version and drop the 2 mm wall version');
  includes(text, 'Do not use this batch for the version you are dropping.');
  includes(answer.next, 'next batch');
});

// ---------------------------------------------------------------------------
// More than one batch: the product-level answer
// ---------------------------------------------------------------------------
test('two batches with one version give the measured range and a next check', () => {
  const state = makeState({
    measurements: [
      reading('p1', '3 mm wall', 'March', '2050'),
      reading('p1', '3 mm wall', 'April', '2180'),
    ],
  });
  const answer = M.buildAnswer(state);
  equal(answer.headline, 'This product stays inside.');
  const text = answerText(answer);
  includes(text, '2,050 to 2,180 MPa');
  includes(text, '1,800–2,400 MPa');
  includes(text, 'all of the measured numbers are inside it');
  includes(text, 'The April batch is inside.');
  includes(answer.next, 'next batch');
});

test('two versions: only the measured inside version is recommended', () => {
  const state = makeState({
    measurements: [
      reading('p1', '3 mm wall', 'March', '2050'),
      reading('p1', '3 mm wall', 'April', '2180'),
      reading('p1', '2 mm wall', 'March', '2560'),
      reading('p1', '2 mm wall', 'April', '2710'),
    ],
  });
  const answer = M.buildAnswer(state);
  equal(answer.headline, 'One version stays inside.');
  const text = answerText(answer);
  includes(text, 'The 3 mm wall version stays inside at 2,050–2,180 MPa.');
  includes(text, 'The 2 mm wall version is outside at 2,560–2,710 MPa.');
  includes(text, 'The April batch is outside for the 2 mm wall version.');
  includes(answer.next, 'Make the 3 mm wall version');
  includes(answer.next, 'drop the 2 mm wall version');
  excludes(text, '4 mm');
});

test('current batch outside says do not ship that batch', () => {
  const state = makeState({
    measurements: [
      reading('p1', '3 mm wall', 'March', '2050'),
      reading('p1', '3 mm wall', 'April', '2610'),
    ],
  });
  const answer = M.buildAnswer(state);
  equal(answer.headline, 'This product is outside.');
  includes(answerText(answer), 'The April batch is outside. Hold it; do not ship it as this product.');
  includes(answer.next, 'Hold the April batch');
});

test('a current batch with no reading gets its own next check', () => {
  const state = makeState({
    measurements: [
      reading('p1', '3 mm wall', 'March', '2050'),
      reading('p1', '3 mm wall', 'February', '2100'),
    ],
  });
  const answer = M.buildAnswer(state);
  const text = answerText(answer);
  includes(text, 'You have not measured the April batch yet.');
  includes(answer.next, 'Test one piece from the April batch');
});

// ---------------------------------------------------------------------------
// Several properties
// ---------------------------------------------------------------------------
test('several properties stay separate and the urgent one leads the next action', () => {
  const state = M.normalizeState({
    product: 'Sound panel',
    properties: [
      { id: 'p1', name: 'weight', unit: 'g', min: '400', max: '480' },
      { id: 'p2', name: 'sound insulation', unit: 'dB', min: '30', max: '40' },
    ],
    plastic: { type: 'mixed plastic', batch: 'March', mix: '', dirt: '' },
    measurements: [reading('p1', 'v1', 'March', '520')],
  });
  const answer = M.buildAnswer(state);
  equal(answer.headline, 'One property is outside your range.');
  const text = answerText(answer);
  includes(text, 'This batch measures 520 g.');
  includes(text, 'Do a sound test on the piece you made');
  includes(answer.next, 'Hold this batch');
  equal(answer.items.length, 2);
});

test('all measured properties inside give the product-level answer', () => {
  const state = M.normalizeState({
    product: 'Panel',
    properties: [
      { id: 'p1', name: 'weight', unit: 'g', min: '400', max: '480' },
      { id: 'p2', name: 'thickness', unit: 'mm', min: '2', max: '3' },
    ],
    plastic: { type: 'mixed plastic', batch: 'April', mix: '', dirt: '' },
    measurements: [
      reading('p1', 'v1', 'March', '440'),
      reading('p1', 'v1', 'April', '455'),
      reading('p2', 'v1', 'March', '2.4'),
      reading('p2', 'v1', 'April', '2.6'),
    ],
  });
  const answer = M.buildAnswer(state);
  equal(answer.headline, 'This product stays inside.');
  equal(answer.items.length, 2);
});

// ---------------------------------------------------------------------------
// Numbers and language guardrails
// ---------------------------------------------------------------------------
test('numbers are formatted for reading, not as raw floats', () => {
  equal(M.formatRange(1800, 2400, 'MPa'), '1,800–2,400 MPa');
  equal(M.formatRange(2100, 2100, 'MPa'), '2,100 MPa');
  equal(M.toNumber('2,100'), 2100);
  equal(M.toNumber(' 1 800 '), 1800);
  equal(M.toNumber('not a number'), null);
});

test('property names decide only the instruction, never a value', () => {
  equal(M.propertyKind('weight'), 'weight');
  equal(M.propertyKind('sound insulation'), 'sound');
  equal(M.propertyKind('tensile strength'), 'strength');
  equal(M.propertyKind('young modulus'), 'stiffness');
  equal(M.propertyKind('thickness'), 'size');
  equal(M.propertyKind('colour match'), 'other');
});

test('the active page avoids the language of a study', () => {
  const files = ['index.html', 'product.js', 'main.js', 'styles.css'].map((name) => {
    const url = new URL(`../${name}`, import.meta.url);
    return { name, text: fs.readFileSync(url, 'utf8') };
  });
  const banned = [
    /\bevidence\b/i,
    /\bclaim(s|ed)?\b/i,
    /\bprovenance\b/i,
    /\bsimulation\b/i,
    /\bfeedstock\b/i,
    /\blot\s+passport\b/i,
    /\bgrade\b/i,
    /\bmodel-only\b/i,
    /\bP5\b/,
    /\bP95\b/,
    /coefficient\s+of\s+variation/i,
    /measured\s+link/i,
    /\bAI\b/,
    /\bbracket\b/i,
    /\bstudio\b/i,
    /\bpaper\b/i,
    /\bjournal\b/i,
    /\bstudy\b/i,
  ];
  for (const file of files) {
    for (const pattern of banned) {
      assert(!pattern.test(file.text), `${file.name} contains ${pattern}`);
    }
  }
  const html = files.find((file) => file.name === 'index.html').text;
  includes(html, 'Enter the number you measured on the piece you made.', 'measurement helper');
  assert(!html.includes('Evidence'), 'index still has an Evidence path');
  assert(!html.includes('href="#evidence"'), 'index still links to evidence');
  assert(!html.includes('bracket'), 'index still links to the bracket');
});

test('the saved state keeps only usable rows', () => {
  const normalized = M.normalizeState({
    product: '  Bench slat  ',
    properties: [{ id: 'p1', name: ' stiffness ', unit: ' MPa ', min: '1800', max: '2400' }],
    plastic: { type: ' rPP ', batch: ' April ', mix: ' HDPE ', dirt: ' labels ' },
    measurements: [
      { propertyId: 'missing', value: '10' },
      { propertyId: 'p1', value: '2100', batch: 'April' },
    ],
  });
  equal(normalized.product, 'Bench slat');
  equal(normalized.properties[0].name, 'stiffness');
  equal(normalized.measurements.length, 1);
});

test('empty measurements are ignored but started rows are kept for editing', () => {
  const state = M.normalizeState({
    product: 'Thing',
    properties: [{ id: 'p1', name: 'weight', unit: 'g', min: '1', max: '2' }],
    measurements: [{ propertyId: 'p1', version: 'v1', batch: 'March', value: '' }],
  });
  equal(state.measurements.length, 1);
  const answer = M.buildAnswer(state);
  equal(answer.headline, 'Not enough to answer yet.');
});


// ---------------------------------------------------------------------------
// Batch identity and input edge cases
// ---------------------------------------------------------------------------
function weightState(overrides = {}) {
  return M.normalizeState({
    product: 'Planter',
    properties: [{ id: 'p1', name: 'weight', unit: 'g', min: '10', max: '30' }],
    plastic: { type: 'recycled HDPE', batch: '', mix: '', dirt: '' },
    measurements: [],
    ...overrides,
  });
}

test('batch names are compared without case', () => {
  const state = weightState({ measurements: [reading('p1', 'v1', 'Batch A', '12'), reading('p1', 'v1', 'batch a', '22')] });
  const answer = M.buildAnswer(state);
  equal(answer.items[0].kind, 'batch');
  const text = answerText(answer);
  includes(text, 'You have measured only one batch.');
  excludes(text, 'The measurements run');
});

test('the current batch name is compared without case', () => {
  const state = weightState({
    plastic: { type: 'recycled HDPE', batch: 'APRIL', mix: '', dirt: '' },
    measurements: [reading('p1', 'v1', 'April', '12'), reading('p1', 'v1', 'May', '22')],
  });
  const answer = M.buildAnswer(state);
  const text = answerText(answer);
  includes(text, 'The APRIL batch is inside.');
  excludes(text, 'You have not measured');
});

test('an unlabelled reading is not folded into the named batch', () => {
  const state = weightState({
    plastic: { type: 'recycled HDPE', batch: 'April', mix: '', dirt: '' },
    measurements: [reading('p1', 'v1', 'April', '12'), reading('p1', 'v1', '', '25')],
  });
  const answer = M.buildAnswer(state);
  const text = answerText(answer);
  includes(text, 'This batch measures 12 g.');
  includes(text, 'One number has no batch name');
  excludes(text, '12–25');
});

test('a reading with no batch asks for the batch before answering', () => {
  const state = weightState({ measurements: [reading('p1', 'v1', '', '25')] });
  const answer = M.buildAnswer(state);
  equal(answer.headline, 'Name the batch for this number.');
  includes(answer.next, 'batch name');
  excludes(answerText(answer), '25');
});

test('a current batch measured inside is not held because another batch is outside', () => {
  const state = weightState({
    properties: [{ id: 'p1', name: 'weight', unit: 'g', min: '10', max: '20' }],
    plastic: { type: 'recycled HDPE', batch: 'April', mix: '', dirt: '' },
    measurements: [reading('p1', 'v1', 'April', '12'), reading('p1', 'v1', 'May', '25')],
  });
  const answer = M.buildAnswer(state);
  const text = answerText(answer);
  includes(text, 'The April batch is inside; another batch measured outside your range.');
  excludes(text, 'Hold the April batch');
  includes(answer.next, 'next batch');
});

test('a different current batch gets its own check', () => {
  const state = weightState({
    plastic: { type: 'recycled HDPE', batch: 'June', mix: '', dirt: '' },
    measurements: [reading('p1', 'v1', 'May', '15')],
  });
  const answer = M.buildAnswer(state);
  const text = answerText(answer);
  includes(text, 'You have not measured the June batch yet.');
  includes(answer.next, 'Test one piece from the June batch');
});

test('a missing batch name gets its own headline, not a range instruction', () => {
  const state = M.normalizeState({
    product: 'Bench slat',
    properties: [
      { id: 'p1', name: 'weight', unit: 'g', min: '10', max: '30' },
      { id: 'p2', name: 'strength', unit: 'MPa', min: '20', max: '30' },
    ],
    plastic: { type: 'recycled HDPE', batch: 'April', mix: '', dirt: '' },
    measurements: [
      reading('p1', 'v1', 'April', '15'),
      reading('p2', 'v1', '', '25'),
    ],
  });
  const answer = M.buildAnswer(state);
  equal(answer.headline, 'One batch name is missing.');
  includes(answer.next, 'Add the batch name above');
});

test('the aggregate does not claim the current batch when one property lacks it', () => {
  const state = M.normalizeState({
    product: 'Panel',
    properties: [
      { id: 'p1', name: 'weight', unit: 'g', min: '10', max: '20' },
      { id: 'p2', name: 'strength', unit: 'MPa', min: '20', max: '30' },
    ],
    plastic: { type: 'mixed plastic', batch: 'April', mix: '', dirt: '' },
    measurements: [
      reading('p1', 'v1', 'April', '15'),
      reading('p2', 'v1', 'May', '25'),
    ],
  });
  const answer = M.buildAnswer(state);
  equal(answer.headline, 'The measured batches are inside.');
  const text = answerText(answer);
  includes(text, 'You have not measured the April batch yet.');
  excludes(answer.headline, 'This batch is inside.');
});

test('count headlines start with a capital letter', () => {
  const outside = M.normalizeState({
    product: 'Panel',
    properties: [
      { id: 'p1', name: 'weight', unit: 'g', min: '10', max: '20' },
      { id: 'p2', name: 'strength', unit: 'MPa', min: '20', max: '30' },
    ],
    plastic: { type: 'mixed plastic', batch: 'April', mix: '', dirt: '' },
    measurements: [
      reading('p1', 'v1', 'April', '55'),
      reading('p2', 'v1', 'April', '55'),
    ],
  });
  equal(M.buildAnswer(outside).headline, 'Two properties are outside your range.');

  const unnamed = M.normalizeState({
    product: 'Panel',
    properties: [
      { id: 'p1', name: 'weight', unit: 'g', min: '10', max: '20' },
      { id: 'p2', name: 'strength', unit: 'MPa', min: '20', max: '30' },
    ],
    plastic: { type: 'mixed plastic', batch: 'April', mix: '', dirt: '' },
    measurements: [
      reading('p1', 'v1', '', '15'),
      reading('p2', 'v1', '', '25'),
    ],
  });
  const answer = M.buildAnswer(unnamed);
  equal(answer.headline, 'Two batch names are missing.');
  includes(answer.next, 'Add the batch names above.');
});

test('the missing caveat appears once even with several missing properties', () => {
  const state = M.normalizeState({
    product: 'Panel',
    properties: [
      { id: 'p1', name: 'weight', unit: 'g', min: '10', max: '30' },
      { id: 'p2', name: 'thickness', unit: 'mm', min: '2', max: '3' },
    ],
    plastic: { type: 'mixed plastic', batch: '', mix: '', dirt: '' },
    measurements: [],
  });
  const answer = M.buildAnswer(state);
  const caveat = "A plastic name or a number from a supplier's sheet is not enough.";
  equal(answerText(answer).split(caveat).length - 1, 1);
});

test('a batch label that starts with Batch reads as a batch name', () => {
  const state = weightState({ measurements: [reading('p1', 'v1', 'Batch A', '15')] });
  const answer = M.buildAnswer(state);
  includes(answerText(answer), 'Batch A measures 15 g.');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  for (const failure of failures) console.error(`\n${failure.name}\n${failure.error.stack}`);
  process.exitCode = 1;
}

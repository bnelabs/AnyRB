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

function normalize(raw = {}) {
  const plastic = raw.plastic && typeof raw.plastic === 'object' ? raw.plastic : {};
  const measurements = (Array.isArray(raw.measurements) ? raw.measurements : []).map((measurement) => ({
    plasticType: plastic.type || '',
    mix: plastic.mix || '',
    dirt: plastic.dirt || '',
    ...measurement,
  }));
  return M.normalizeState({ ...raw, measurements });
}

function makeState(overrides = {}) {
  return normalize({
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

test('one batch outside gives the amount and a changed-piece test', () => {
  const state = makeState({ measurements: [reading('p1', '3 mm wall', 'April', '2610')] });
  const answer = M.buildAnswer(state);
  equal(answer.headline, 'This batch is outside.');
  const text = answerText(answer);
  includes(text, 'It is 210 MPa above your top of 2,400 MPa.');
  includes(text, 'Do not ship this batch or this combination.');
  excludes(text, 'Change the build or the mix');
  includes(answer.next, 'Make one changed piece and test its stiffness before any shipment.');
});

test('two versions in one batch name what to make and what to drop', () => {
  const state = makeState({
    measurements: [
      reading('p1', '3 mm wall', 'April', '2100'),
      reading('p1', '2 mm wall', 'April', '2600'),
    ],
  });
  const answer = M.buildAnswer(state);
  equal(answer.headline, 'This batch is outside, but one version is inside.');
  const text = answerText(answer);
  includes(text, 'Part of this batch is outside: the 2 mm wall version at 2,600 MPa.');
  includes(text, 'It is 200 MPa above your top of 2,400 MPa.');
  includes(text, 'The 3 mm wall version at 2,100 MPa stays inside.');
  includes(text, 'Do not ship the 2 mm wall version from the April batch.');
  includes(answer.next, 'Make the 3 mm wall version; keep the April batch for that version only.');
  excludes(text, 'Change the build or the mix');
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
  equal(answer.headline, 'This batch is inside.');
  const text = answerText(answer);
  includes(text, 'Across the pieces of this plastic you measured, the range is 2,050–2,180 MPa.');
  includes(text, 'This batch is inside: 2,180 MPa, within your 1,800–2,400 MPa range.');
  includes(answer.next, 'Run the stiffness test on one piece from the next batch');
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
  equal(answer.headline, 'This batch is outside, but one version is inside.');
  const text = answerText(answer);
  includes(text, 'Part of this batch is outside: the 2 mm wall version at 2,710 MPa.');
  includes(text, 'It is 310 MPa above your top of 2,400 MPa.');
  includes(text, 'The 3 mm wall version at 2,180 MPa stays inside.');
  includes(text, 'Do not ship the 2 mm wall version from the April batch.');
  includes(answer.next, 'Make the 3 mm wall version; keep the April batch for that version only.');
  excludes(text, '4 mm');
});

test('current batch outside says by how much and does not ship it', () => {
  const state = makeState({
    measurements: [
      reading('p1', '3 mm wall', 'March', '2050'),
      reading('p1', '3 mm wall', 'April', '2610'),
    ],
  });
  const answer = M.buildAnswer(state);
  equal(answer.headline, 'This batch is outside.');
  const text = answerText(answer);
  includes(text, 'It is 210 MPa above your top of 2,400 MPa.');
  includes(text, 'Do not ship the April batch.');
  includes(text, 'No measured version of this plastic stayed inside.');
  includes(answer.next, 'Make one changed piece and test its stiffness before any shipment.');
});

test('a current batch with no reading is not covered and gets one test', () => {
  const state = makeState({
    measurements: [
      reading('p1', '3 mm wall', 'March', '2050'),
      reading('p1', '3 mm wall', 'February', '2100'),
    ],
  });
  const answer = M.buildAnswer(state);
  equal(answer.headline, 'These numbers do not cover this batch.');
  const text = answerText(answer);
  includes(text, 'The numbers on hand do not cover this plastic in the April batch');
  includes(text, 'Do not ship the April batch.');
  includes(answer.next, 'Run the stiffness test on one piece from the April batch and add the number above.');
});

// ---------------------------------------------------------------------------
// Several properties
// ---------------------------------------------------------------------------
test('several properties stay separate and the urgent one leads the next action', () => {
  const state = normalize({
    product: 'Sound panel',
    properties: [
      { id: 'p1', name: 'weight', unit: 'g', min: '400', max: '480' },
      { id: 'p2', name: 'sound insulation', unit: 'dB', min: '30', max: '40' },
    ],
    plastic: { type: 'mixed plastic', batch: 'March', mix: '', dirt: '' },
    measurements: [reading('p1', 'v1', 'March', '520')],
  });
  const answer = M.buildAnswer(state);
  equal(answer.headline, 'This batch is outside.');
  const text = answerText(answer);
  includes(text, 'This batch is outside your 400–480 g range: 520 g.');
  includes(text, 'It is 40 g above your top of 480 g.');
  includes(text, 'Do not ship this batch or this combination.');
  includes(text, 'Do a sound test on the piece you made');
  includes(answer.next, 'Make one changed piece and weigh it before any shipment.');
  equal(answer.items.length, 2);
});

test('all measured properties inside give the current-batch answer', () => {
  const state = normalize({
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
  equal(answer.headline, 'This batch is inside.');
  equal(answer.items.length, 2);
  includes(answerText(answer), '440–455 g');
  includes(answerText(answer), '2.4–2.6 mm');
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
  const normalized = normalize({
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
  const state = normalize({
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
  return normalize({
    product: 'Planter',
    properties: [{ id: 'p1', name: 'weight', unit: 'g', min: '10', max: '30' }],
    plastic: { type: 'recycled HDPE', batch: '', mix: '', dirt: '' },
    measurements: [],
    ...overrides,
  });
}

test('batch names are compared without case', () => {
  const state = weightState({
    plastic: { type: 'recycled HDPE', batch: 'Batch A', mix: '', dirt: '' },
    measurements: [reading('p1', 'v1', 'Batch A', '12'), reading('p1', 'v1', 'batch a', '22')],
  });
  const answer = M.buildAnswer(state);
  equal(answer.items[0].kind, 'inside');
  const text = answerText(answer);
  includes(text, 'This batch is inside: 12–22 g, within your 10–30 g range.');
  includes(text, 'You have measured only one batch.');
});

test('the current batch name is compared without case', () => {
  const state = weightState({
    plastic: { type: 'recycled HDPE', batch: 'APRIL', mix: '', dirt: '' },
    measurements: [reading('p1', 'v1', 'April', '12'), reading('p1', 'v1', 'May', '22')],
  });
  const answer = M.buildAnswer(state);
  equal(answer.items[0].kind, 'inside');
  const text = answerText(answer);
  includes(text, 'This batch is inside: 12 g');
  excludes(text, 'do not cover');
});

test('an unlabelled reading is not folded into the named batch', () => {
  const state = weightState({
    plastic: { type: 'recycled HDPE', batch: 'April', mix: '', dirt: '' },
    measurements: [reading('p1', 'v1', 'April', '12'), reading('p1', 'v1', '', '25')],
  });
  const answer = M.buildAnswer(state);
  const text = answerText(answer);
  includes(text, 'This batch is inside: 12 g, within your 10–30 g range.');
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
  equal(answer.headline, 'This batch is inside.');
  const text = answerText(answer);
  includes(text, 'Some pieces you measured with this plastic are outside your range.');
  excludes(text, 'Hold the April batch');
  includes(answer.next, 'next batch');
});

test('a different current batch gets its own check', () => {
  const state = weightState({
    plastic: { type: 'recycled HDPE', batch: 'June', mix: '', dirt: '' },
    measurements: [reading('p1', 'v1', 'May', '15')],
  });
  const answer = M.buildAnswer(state);
  equal(answer.headline, 'These numbers do not cover this batch.');
  const text = answerText(answer);
  includes(text, 'The numbers on hand do not cover this plastic in the June batch');
  includes(text, 'other batches of this plastic');
  includes(answer.next, 'Weigh one piece from the June batch');
});

test('a missing batch name gets its own headline, not a range instruction', () => {
  const state = normalize({
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
  const state = normalize({
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
  equal(answer.headline, 'These numbers do not cover this batch.');
  const text = answerText(answer);
  includes(text, 'The numbers on hand do not cover this plastic in the April batch');
  includes(text, 'other batches of this plastic');
  excludes(answer.headline, 'This batch is inside.');
});

test('count headlines start with a capital letter', () => {
  const outside = normalize({
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

  const unnamed = normalize({
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
  const state = normalize({
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
  const state = weightState({
    plastic: { type: 'recycled HDPE', batch: 'Batch A', mix: '', dirt: '' },
    measurements: [reading('p1', 'v1', 'Batch B', '15')],
  });
  const answer = M.buildAnswer(state);
  const text = answerText(answer);
  includes(text, 'Do not ship Batch A.');
  excludes(text, 'The Batch A');
  includes(answer.next, 'Weigh one piece from Batch A');
});


// ---------------------------------------------------------------------------
// The plastic description changes the answer
// ---------------------------------------------------------------------------
test('a different mix is not covered and is not judged from old numbers', () => {
  const state = makeState({
    measurements: [{ ...reading('p1', '3 mm wall', 'April', '9999'), mix: 'a different mix' }],
  });
  const answer = M.buildAnswer(state);
  equal(answer.headline, 'These numbers do not cover this plastic.');
  const text = answerText(answer);
  includes(text, 'The numbers on hand do not cover this plastic');
  includes(text, 'a different mix');
  includes(text, 'Do not ship the April batch.');
  excludes(text, '9,999');
  includes(answer.next, 'Run the stiffness test on one piece from the April batch');
});

test('a different dirt is not covered', () => {
  const state = makeState({
    measurements: [{ ...reading('p1', '3 mm wall', 'April', '2100'), dirt: 'sand and grit' }],
  });
  const answer = M.buildAnswer(state);
  equal(answer.headline, 'These numbers do not cover this plastic.');
  includes(answerText(answer), 'different dirt or other plastic');
  includes(answer.next, 'Run the stiffness test on one piece from the April batch');
});

test('a different plastic type is not covered', () => {
  const state = makeState({
    measurements: [{ ...reading('p1', '3 mm wall', 'April', '2100'), plasticType: 'recycled PET' }],
  });
  const answer = M.buildAnswer(state);
  equal(answer.headline, 'These numbers do not cover this plastic.');
  includes(answerText(answer), 'a different plastic type');
});

test('the next test is named by the property', () => {
  const cases = [
    ['weight', 'Weigh one piece from the April batch'],
    ['thickness', 'Measure thickness of one piece from the April batch'],
    ['strength', 'Run the strength test on one piece from the April batch'],
    ['stiffness', 'Run the stiffness test on one piece from the April batch'],
    ['sound insulation', 'Run the sound test on one piece from the April batch'],
  ];
  for (const [name, nextStart] of cases) {
    const state = makeState({
      properties: [{ id: 'p1', name, unit: '', min: '10', max: '20' }],
      measurements: [{ ...reading('p1', 'v1', 'April', '15'), mix: 'a different mix' }],
    });
    includes(M.buildAnswer(state).next, nextStart);
  }
});

test('all measured pieces high or low are stated and lead to a changed piece', () => {
  const high = makeState({
    measurements: [reading('p1', '3 mm wall', 'March', '2600'), reading('p1', '3 mm wall', 'April', '2700')],
  });
  const highAnswer = M.buildAnswer(high);
  equal(highAnswer.headline, 'Every measured piece is outside.');
  const highText = answerText(highAnswer);
  includes(highText, 'above your stiffness range');
  includes(highText, '2,600–2,700 MPa');
  includes(highText, 'Do not ship this batch or this combination.');
  includes(highAnswer.next, 'Make one changed piece and test its stiffness before any shipment.');

  const low = makeState({
    measurements: [reading('p1', '3 mm wall', 'March', '1500'), reading('p1', '3 mm wall', 'April', '1600')],
  });
  const lowAnswer = M.buildAnswer(low);
  equal(lowAnswer.headline, 'Every measured piece is outside.');
  includes(answerText(lowAnswer), 'below your stiffness range');
  includes(lowAnswer.next, 'Make one changed piece and test its stiffness before any shipment.');
});

test('a batch outside names a measured version that stayed inside', () => {
  const state = makeState({
    measurements: [
      reading('p1', '3 mm wall', 'March', '2050'),
      reading('p1', '2 mm wall', 'April', '2600'),
    ],
  });
  const answer = M.buildAnswer(state);
  equal(answer.headline, 'This batch is outside.');
  const text = answerText(answer);
  includes(text, 'This batch is outside your 1,800–2,400 MPa range: 2,600 MPa.');
  includes(text, '200 MPa above your top of 2,400 MPa');
  includes(text, 'The 3 mm wall version at 2,050 MPa was inside on the pieces you measured of this plastic.');
  includes(text, 'Do not ship the April batch.');
  includes(answer.next, 'Make the 3 mm wall version and hold the April batch.');
});

test('the per-piece plastic description is saved', () => {
  const state = normalize({
    product: 'Slat',
    properties: [{ id: 'p1', name: 'stiffness', unit: 'MPa', min: '1800', max: '2400' }],
    plastic: { type: 'rPP', batch: 'April', mix: '20% HDPE', dirt: 'labels' },
    measurements: [{ propertyId: 'p1', version: 'v1', batch: 'April', plasticType: 'rPP', mix: 'none', dirt: 'grit', value: '2100' }],
  });
  equal(state.measurements[0].plasticType, 'rPP');
  equal(state.measurements[0].mix, 'none');
  equal(state.measurements[0].dirt, 'grit');
});

test('a missing plastic name or batch name is asked for before judging', () => {
  const noType = makeState({
    plastic: { type: '', batch: 'April', mix: '', dirt: '' },
    measurements: [reading('p1', '3 mm wall', 'April', '2100')],
  });
  const typeAnswer = M.buildAnswer(noType);
  equal(typeAnswer.headline, 'Which plastic is this?');
  includes(typeAnswer.next, 'Add the plastic type above.');

  const noBatch = makeState({
    plastic: { type: 'recycled polypropylene', batch: '', mix: '20% HDPE', dirt: 'labels' },
    measurements: [reading('p1', '3 mm wall', 'April', '2100')],
  });
  const batchAnswer = M.buildAnswer(noBatch);
  equal(batchAnswer.headline, 'Name this batch.');
  includes(batchAnswer.next, 'Add the batch name above.');
});

test('the old change-the-build sentence is gone', () => {
  const source = fs.readFileSync(new URL('../product.js', import.meta.url), 'utf8');
  assert(!/change the build or the mix/i.test(source), 'source still contains the empty change sentence');
  const state = makeState({ measurements: [reading('p1', '3 mm wall', 'April', '2610')] });
  excludes(answerText(M.buildAnswer(state)), 'Change the build or the mix');
});


test('old saved measurements inherit the current plastic description', () => {
  const state = M.normalizeState({
    product: 'Bench slat',
    properties: [{ id: 'p1', name: 'stiffness', unit: 'MPa', min: '1800', max: '2400' }],
    plastic: { type: 'recycled polypropylene', batch: 'April', mix: '20% HDPE', dirt: 'labels' },
    measurements: [{ propertyId: 'p1', version: '3 mm wall', batch: 'April', value: '2100' }],
  });
  equal(state.measurements[0].plasticType, 'recycled polypropylene');
  equal(state.measurements[0].mix, '20% HDPE');
  equal(state.measurements[0].dirt, 'labels');
  equal(M.buildAnswer(state).headline, 'This batch is inside.');
});

test('a different-plastic number is called out instead of silently dropped', () => {
  const state = makeState({
    measurements: [
      reading('p1', '3 mm wall', 'April', '2100'),
      { ...reading('p1', '2 mm wall', 'April', '2200'), mix: 'a different mix' },
    ],
  });
  const answer = M.buildAnswer(state);
  const text = answerText(answer);
  includes(text, 'One number was measured with a different plastic, mix or dirt, so it is not used here.');
  includes(text, '2,100 MPa');
  excludes(text, '2,200 MPa');
});

test('the answer does not use laboratory range wording', () => {
  const states = [
    makeState({ measurements: [reading('p1', '3 mm wall', 'April', '2100')] }),
    makeState({ measurements: [reading('p1', '3 mm wall', 'April', '2610')] }),
    makeState({ measurements: [reading('p1', '3 mm wall', 'March', '2600'), reading('p1', '3 mm wall', 'April', '2700')] }),
    makeState({ measurements: [reading('p1', '3 mm wall', 'April', '2100'), reading('p1', '2 mm wall', 'April', '2600')] }),
  ];
  for (const state of states) excludes(answerText(M.buildAnswer(state)), ' against ');
});


test('multi-property plastic setup gets the plastic headline, not a range one', () => {
  const properties = [
    { id: 'p1', name: 'weight', unit: 'g', min: '10', max: '30' },
    { id: 'p2', name: 'strength', unit: 'MPa', min: '20', max: '30' },
  ];
  const rows = [
    { propertyId: 'p1', version: 'v1', batch: 'April', plasticType: 'recycled HDPE', mix: '', dirt: '', value: '15' },
    { propertyId: 'p2', version: 'v1', batch: 'April', plasticType: 'recycled HDPE', mix: '', dirt: '', value: '25' },
  ];
  const noType = normalize({
    product: 'Panel',
    properties,
    plastic: { type: '', batch: 'April', mix: '', dirt: '' },
    measurements: rows,
  });
  const typeAnswer = M.buildAnswer(noType);
  equal(typeAnswer.headline, 'Which plastic is this?');
  includes(typeAnswer.next, 'Add the plastic type above.');

  const noBatch = normalize({
    product: 'Panel',
    properties,
    plastic: { type: 'recycled HDPE', batch: '', mix: '', dirt: '' },
    measurements: rows,
  });
  const batchAnswer = M.buildAnswer(noBatch);
  equal(batchAnswer.headline, 'Name this batch.');
  includes(batchAnswer.next, 'Add the batch name above.');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  for (const failure of failures) console.error(`\n${failure.name}\n${failure.error.stack}`);
  process.exitCode = 1;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CASE_PRESETS,
  DEFAULT_STATE,
  G,
  PUBLISHED_BATCHES,
  PROPERTIES,
  PROPERTY_DEFAULTS,
  advicePayload,
  allocatePriority,
  buildCostPerPart,
  effectiveMassG,
  familyOfBatchKey,
  loadPathComparison,
  productionTotals,
  sheetYield,
  steadyValues,
  treatedOutcomeKeysFor,
  stiffnessRangeFromLoadBend,
  allTargets,
  blendCandidate,
  buildSizeText,
  capacityN,
  decisionFor,
  evaluateBuilds,
  formatRange,
  inRange,
  isReady,
  massG,
  materialGap,
  minimumThicknessCandidate,
  normalizeModelProposals,
  normalizeState,
  proposalRow,
  propertyRange,
  stiffness,
  toApiPayload,
} from '../product.js';

const base = (overrides = {}) => normalizeState({ ...DEFAULT_STATE, ...overrides });
const bracket = (overrides = {}) => normalizeState({
  ...DEFAULT_STATE,
  ...CASE_PRESETS.bracket,
  ...overrides,
});
const close = (actual, expected, tolerance = 1e-6) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
};

test('production maths: waste, stock cover, allocation and build cost', () => {
  const range = stiffnessRangeFromLoadBend(10, 5, 0);
  close(range.min, (10 * 9.80665) / 5, 1e-9);
  close(range.max, range.min * 10, 1e-9);
  assert.equal(stiffnessRangeFromLoadBend(0, 5), null);
  assert.equal(stiffnessRangeFromLoadBend(10, 5, 9), null);

  close(effectiveMassG(100, 10), 110, 1e-9);
  const totals = productionTotals({ massG: 100, runSize: 500, haveKg: 60, wastePct: 10 });
  close(totals.needKg, 55, 1e-9);            // 500 x 110 g
  close(totals.baseNeedKg, 50, 1e-9);        // before waste
  assert.equal(totals.canMake, 545);         // floor(60000 / 110)
  assert.equal(totals.covers, true);
  close(totals.leftKg, 5, 1e-9);
  assert.equal(totals.moreParts, 45);
  const short = productionTotals({ massG: 100, runSize: 500, haveKg: 40, wastePct: 0 });
  assert.equal(short.covers, false);
  close(short.shortKg, 10, 1e-9);

  const alloc = allocatePriority(100, { qty: 500, usageG: 100 }, { qty: 500, usageG: 200 });
  assert.deepEqual(alloc, { firstMade: 500, secondMade: 250, leftG: 0 });

  close(buildCostPerPart({ move: 'current', massG: 200 }, { batchPricePerKg: 10 }), 2, 1e-9);
  close(buildCostPerPart({ move: 'blend', fraction: 0.25, massG: 200 }, { batchPricePerKg: 10, steadyPricePerKg: 20 }), 2.5, 1e-9);
  assert.equal(buildCostPerPart({ move: 'blend', fraction: 0.25, massG: 200 }, { batchPricePerKg: 10 }), null);
  // treated: 200 g in the part took 250 g of raw delivery at 20% loss
  close(buildCostPerPart({ move: 'treated', massG: 200 }, { batchPricePerKg: 10, treatPricePerKg: 5, treatLossPct: 20 }), 3.5, 1e-9);
  // money counts waste exactly as material does: 10% waste on 200 g at 10/kg
  close(buildCostPerPart({ move: 'current', massG: 200 }, { batchPricePerKg: 10, wastePct: 10 }), 2.2, 1e-9);
});

test('mechanics: cantilever capacity, stiffness and mass', () => {
  const part = { product: 'bracket', mode: 'cantilever', spanMm: 180, widthMm: 40, thicknessMm: 10 };
  close(capacityN(part, 700, 14), (14 * 40 * 100) / (6 * 180), 1e-9);
  close(stiffness(part, 700), (3 * 700 * (40 * 1000 / 12)) / 180 ** 3, 1e-9);
  close(massG(part, 0.94), 0.94 * 40 * 10 * 180 / 1000, 1e-9);
});

test('mechanics: simple and compression formulas differ', () => {
  const cant = { product: 'x', mode: 'cantilever', spanMm: 100, widthMm: 20, thicknessMm: 5 };
  const simple = { ...cant, mode: 'simple' };
  const comp = { ...cant, mode: 'compression' };
  assert.ok(capacityN(simple, 700, 14) > capacityN(cant, 700, 14));
  assert.ok(stiffness(simple, 700) > stiffness(cant, 700));
  assert.ok(capacityN(comp, 700, 14) > capacityN(simple, 700, 14));
});

test('property ranges use the full plastic swing', () => {
  const part = { product: 'bracket', mode: 'cantilever', spanMm: 180, widthMm: 40, thicknessMm: 15 };
  const s = bracket();
  const range = propertyRange(part, s.plastic, 'strength');
  assert.equal(range.unit, 'kg');
  assert.ok(range.min > 0 && range.max > range.min);
  const stiff = propertyRange(part, s.plastic, 'stiffness');
  assert.equal(stiff.unit, 'N/mm');
  const weight = propertyRange(part, s.plastic, 'weight');
  assert.equal(weight.unit, 'g');
  assert.equal(weight.min, weight.max);
});

test('the app starts without a product or a decision', () => {
  assert.equal(DEFAULT_STATE.product, '');
  const s = base();
  assert.equal(isReady(s), false);
  const result = evaluateBuilds(s, []);
  assert.equal(result.ready, false);
  assert.equal(result.winner, null);
  const decision = decisionFor(s, result);
  assert.equal(decision.headline, 'What do you want to make?');
  assert.equal(decision.button, null);
  assert.doesNotMatch(decision.support, /bracket/i);
});

test('first open carries no batch, steadier stream, or other product', () => {
  const s = normalizeState({ blank: true });
  assert.equal(s.plastic.type, '');
  assert.equal(s.plastic.batch, '');
  assert.equal(s.plastic.mix, '');
  assert.equal(s.plastic.dirt, '');
  assert.equal(s.plastic.eMin, 0);
  assert.equal(s.plastic.eMax, 0);
  assert.equal(s.plastic.sMin, 0);
  assert.equal(s.plastic.sMax, 0);
  assert.equal(s.plastic.density, 0);
  assert.equal(s.steady.available, false);
  assert.equal(s.other.product, '');
  assert.equal(isReady(s), false);
});

test('a load path is required before anything is scored', () => {
  const raw = {
    blank: true,
    product: 'crate side',
    spanMm: 400,
    widthMm: 60,
    thicknessMm: 15,
    target: { property: 'strength', min: 95, max: 115 },
    plastic: { type: 'rHDPE', eMin: 1111, eMax: 1589, sMin: 41.6, sMax: 48.4, density: 0.94 },
  };
  assert.equal(normalizeState(raw).mode, '');
  assert.equal(isReady(raw), false);
  assert.equal(isReady({ ...raw, mode: 'simple' }), true);
});

test('the user can start with any of several product cases', () => {
  for (const name of Object.keys(CASE_PRESETS)) {
    const s = normalizeState({ ...DEFAULT_STATE, ...CASE_PRESETS[name] });
    assert.equal(isReady(s), true, `${name} is not ready`);
    const result = evaluateBuilds(s, []);
    assert.ok(result.winner, `${name} has no winner`);
    assert.equal(result.winner.part.product, CASE_PRESETS[name].product);
    assert.ok(result.winner.passes !== false);
    for (let i = 0; i < result.targets.length; i++) {
      assert.ok(inRange(result.winner.ranges[i], result.targets[i]));
    }
  }
});

test('one part can have several target properties at once', () => {
  const s = bracket();
  assert.equal(s.extraTargets.length, 1);
  assert.deepEqual(allTargets(s).map((t) => t.property), ['strength', 'weight']);
  const result = evaluateBuilds(s, []);
  assert.equal(result.ready, true);
  assert.ok(result.winner);
  assert.equal(result.winner.part.thicknessMm, 15);
  assert.equal(result.winner.ranges.length, 2);
  assert.ok(inRange(result.winner.ranges[0], s.target));
  assert.ok(inRange(result.winner.ranges[1], s.extraTargets[0]));
  const decision = decisionFor(s, result);
  assert.match(decision.support, /strength/i);
  assert.match(decision.support, /weighs/i);
  assert.match(decision.copy, /Requirement: Strength/);
  assert.match(decision.copy, /Requirement: Weight/);
});

test('a requirement that cannot be met stops the build even if another could', () => {
  const s = bracket({ extraTargets: [{ property: 'weight', min: 1, max: 2 }] });
  const result = evaluateBuilds(s, []);
  assert.equal(result.winner, null);
  assert.equal(result.gaps.length, 2);
  assert.ok(result.gaps[1].overHigh > 0 || result.gaps[1].shortLow > 0);
  const decision = decisionFor(s, result);
  assert.doesNotMatch(decision.headline, /do not use|don't use/i);
  assert.equal(decision.button, 'Ask about this delivery');
});

test('strength-only bracket: the declared steadier stream closes the gap', () => {
  const s = bracket({ extraTargets: [] });
  assert.equal(isReady(s), true);
  const candidate = blendCandidate(s);
  assert.ok(candidate);
  assert.equal(candidate.move, 'blend');
  const result = evaluateBuilds(s, []);
  const blend = result.passingBest.find((item) => item.move === 'blend');
  assert.ok(blend, 'the blend build passes');
  assert.equal(blend.fraction, candidate.fraction);
  // A blend is charged the steadier stream it uses in every part, so it is
  // ranked against added section material on the same axis — here the
  // thicker section brings in less material and wins.
  assert.ok(blend.addedG > 0);
  close(blend.addedG, blend.fraction * blend.massG, 1e-9);
  assert.ok(result.winner.addedG <= blend.addedG);
});

test('compression: a thin panel buckles about its weak axis', () => {
  // 180 x 4 mm panel, 300 mm tall: weak-axis Euler load at E=700 MPa is
  // pi^2 * 700 * (180 * 4^3 / 12) / 300^2 = ~74 N, not the squash load.
  const part = { product: 'planter wall', mode: 'compression', spanMm: 300, widthMm: 180, thicknessMm: 4 };
  close(capacityN(part, 700, 14), 73.7, 0.5);
  assert.ok(capacityN(part, 700, 14) < 14 * 180 * 4 / 100);
});

test('compression gap names buckling instead of asking for stronger plastic', () => {
  const s = normalizeState({
    ...DEFAULT_STATE,
    product: 'planter wall', mode: 'compression', spanMm: 300, widthMm: 180, thicknessMm: 4,
    target: { property: 'strength', min: 100, max: 140 }, extraTargets: [],
  });
  const gap = materialGap(s, { product: 'planter wall', mode: 'compression', spanMm: 300, widthMm: 180, thicknessMm: 4 }, s.target);
  assert.ok(gap.buckling && gap.buckling.governs);
  assert.match(gap.action, /buckles/i);
});

test('a blank other product never appears in the verifier trace', () => {
  const s = normalizeState({ blank: true, ...CASE_PRESETS.crate, product: 'crate side', mode: 'simple' });
  const result = evaluateBuilds(s, [{ move: 'other_product' }]);
  assert.equal(result.modelTrace.filter((item) => item.move === 'other').length, 0);
});

test('a failing decision states what the current build actually does', () => {
  const s = bracket({
    target: { property: 'strength', min: 80, max: 90 },
    extraTargets: [],
    steady: { available: false, type: '', eMpa: 0, sMpa: 0 },
  });
  const result = evaluateBuilds(s, []);
  assert.equal(result.winner, null);
  const decision = decisionFor(s, result);
  assert.match(decision.support, /as it stands, this build carries/);
  assert.match(decision.copy, /As it stands:/);
});

test('without a steadier stream, the thin build fails and mechanics finds the thicker build', () => {
  const s = bracket({
    extraTargets: [],
    steady: { available: false, type: '', eMpa: 0, sMpa: 0 },
  });
  const result = evaluateBuilds(s, []);
  assert.equal(result.current.pass, false);
  assert.equal(result.winner.move, 'thickness');
  assert.equal(result.winner.part.thicknessMm, 15);
  assert.ok(result.winner.addedG > 0);
  assert.match(decisionFor(s, result).headline, /Make the 180 mm shelf bracket, 40 × 15 mm\./);
});

test('with no model proposals there is no fixed section/span/other list', () => {
  const s = bracket({ extraTargets: [], steady: { available: false, type: '', eMpa: 0, sMpa: 0 } });
  const result = evaluateBuilds(s, []);
  assert.ok(result.winner);
  assert.equal(result.winner.move, 'thickness');
  assert.ok(!result.triedMoves.includes('section'));
  assert.ok(!result.triedMoves.includes('span'));
  assert.ok(!result.triedMoves.includes('other'));
  assert.ok(!result.triedMoves.includes('blend'));
});

test('model move thickness is refined to the passing size', () => {
  const s = bracket({ extraTargets: [], steady: { available: false, type: '', eMpa: 0, sMpa: 0 } });
  const result = evaluateBuilds(s, [{ move: 'thickness', thickness_mm: 12.5 }]);
  assert.ok(result.passingBest.some((item) => item.move === 'thickness' && item.part.thicknessMm === 15));
});

test('model move section is searched in its direction and must pass every target', () => {
  const s = bracket({ extraTargets: [] });
  const result = evaluateBuilds(s, [{ move: 'section', width_mm: 80 }]);
  const section = result.passingBest.find((item) => item.move === 'section');
  assert.ok(section);
  assert.ok(section.part.widthMm > 40);
  assert.ok(section.ranges.every((range, i) => inRange(range, result.targets[i])));
});

test('model move other product can make a build the main part cannot', () => {
  const s = bracket({ extraTargets: [{ property: 'weight', min: 200, max: 300 }], steady: { available: false, type: '', eMpa: 0, sMpa: 0 } });
  const result = evaluateBuilds(s, [{ move: 'other_product' }]);
  const other = result.passingBest.find((item) => item.move === 'other');
  assert.ok(other);
  assert.equal(other.part.product, 'heavier part');
  assert.match(proposalRow(s, other).size, /heavier part/);
});

test('model move span is clamped and a failing span is not shown', () => {
  const s = bracket({ extraTargets: [], steady: { available: false, type: '', eMpa: 0, sMpa: 0 } });
  const normalized = normalizeModelProposals(s, [{ move: 'span', span_mm: 9000 }]);
  assert.equal(normalized.length, 1);
  assert.ok(normalized[0].spanMm <= s.spanMm * 1.2);
  const result = evaluateBuilds(s, [{ move: 'span', span_mm: 150 }]);
  assert.equal(result.passingBest.some((item) => item.move === 'span'), false);
});

test('a span build is weighed as its own section, with no added support mass', () => {
  const s = bracket({
    target: { property: 'weight', min: 70, max: 80 },
    extraTargets: [],
    steady: { available: false, type: '', eMpa: 0, sMpa: 0 },
  });
  const result = evaluateBuilds(s, [{ move: 'span', span_mm: 200 }]);
  const span = result.passingBest.find((item) => item.move === 'span');
  assert.ok(span, 'the longer span inside the weight window must be offered');
  assert.equal(span.massG, massG(span.part, s.plastic.density));
  assert.equal(span.ranges[0].min, span.massG);
  assert.equal(span.ranges[0].max, span.massG);
});

test('a span move may not shorten the part to save material', () => {
  const s = normalizeState({ ...DEFAULT_STATE, ...CASE_PRESETS.crate });
  const result = evaluateBuilds(s, [{ move: 'span', span_mm: 320 }]);
  assert.equal(result.winner.move, 'current');
  assert.equal(result.winner.part.spanMm, 400);
  assert.equal(result.passingBest.some((item) => item.move === 'span' && item.part.spanMm < 400), false);
});

test('model blend only survives when steady is declared', () => {
  const without = bracket({ extraTargets: [], steady: { available: false, type: '', eMpa: 0, sMpa: 0 } });
  const withSteady = bracket({ extraTargets: [] });
  assert.equal(normalizeModelProposals(without, [{ move: 'blend', fraction: 0.5 }]).length, 0);
  assert.equal(normalizeModelProposals(withSteady, [{ move: 'blend', fraction: 0.5 }]).length, 1);
});

test('model output accepts other_product and drops invented result keys', () => {
  const s = bracket();
  const normalized = normalizeModelProposals(s, [
    { move: 'other_product', strength: 999, result: 'x' },
    { move: 'section', width_mm: 46, thickness_mm: 11, certification: 'yes' },
    { move: 'nonsense' },
  ]);
  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].move, 'other');
  assert.equal(normalized[1].move, 'section');
  assert.ok(!('strength' in normalized[0]));
  assert.ok(!('certification' in normalized[1]));
});

test('Meta exact proposals are scored and their rejection is visible', () => {
  const s = bracket({ extraTargets: [] });
  const result = evaluateBuilds(s, [{ move: 'thickness', thickness_mm: 12.5 }]);
  assert.ok(result.modelTrace.length >= 1);
  const trace = result.modelTrace[0];
  assert.equal(trace.move, 'thickness');
  assert.equal(trace.part.thicknessMm, 12.5);
  assert.equal(trace.pass, false);
  assert.equal(trace.ranges.length, 1);
});

test('passing builds are sorted by least added build material and winner is first', () => {
  const s = bracket({ extraTargets: [] });
  const result = evaluateBuilds(s, [{ move: 'section', width_mm: 80 }, { move: 'other_product' }]);
  assert.ok(result.winner);
  for (let i = 1; i < result.passingBest.length; i++) {
    assert.ok(result.passingBest[i - 1].addedG <= result.passingBest[i].addedG);
  }
  assert.equal(result.winner, result.passingBest[0]);
});

test('an impossible target does not say "do not use the delivery"', () => {
  const s = bracket({
    target: { property: 'strength', min: 80, max: 90 },
    extraTargets: [],
    steady: { available: false, type: '', eMpa: 0, sMpa: 0 },
  });
  const result = evaluateBuilds(s, [{ move: 'thickness', thickness_mm: 30 }]);
  assert.equal(result.winner, null);
  assert.ok(result.gaps.length);
  const decision = decisionFor(s, result);
  assert.doesNotMatch(decision.headline, /do not use|don't use/i);
  assert.match(decision.headline, /^(Not strong enough with this delivery|This delivery varies too much)/);
  assert.equal(decision.button, 'Ask about this delivery');
});

test('multi-target gaps are reported for each target', () => {
  const s = bracket({
    target: { property: 'strength', min: 80, max: 90 },
    extraTargets: [{ property: 'weight', min: 1, max: 2 }],
    steady: { available: false, type: '', eMpa: 0, sMpa: 0 },
  });
  const result = evaluateBuilds(s, []);
  assert.equal(result.gaps.length, 2);
  assert.deepEqual(result.gaps.map((gap) => gap.property), ['strength', 'weight']);
  assert.ok(result.gaps.every((gap) => gap.shortLow > 0 || gap.overHigh > 0 || gap.rangeTooWide));
});

test('minimum thickness candidate is a real build and passes all targets', () => {
  const s = bracket({ extraTargets: [] });
  const candidate = minimumThicknessCandidate(s);
  assert.ok(candidate);
  assert.equal(candidate.thicknessMm, 15);
  assert.notEqual(candidate.thicknessMm, s.thicknessMm);
});

test('property switch defaults are valid for a sample build', () => {
  for (const property of PROPERTIES.filter((item) => item.key !== 'none')) {
    const defaults = PROPERTY_DEFAULTS[property.key];
    assert.ok(defaults && defaults.min < defaults.max);
  }
});

test('advice payload is numeric, includes all targets and is key-free', () => {
  const s = bracket();
  const result = evaluateBuilds(s, []);
  const payload = advicePayload(s, result, 'What should I add or change to make this batch work?');
  assert.equal(payload.question, 'What should I add or change to make this batch work?');
  assert.equal(payload.targets.length, 2);
  assert.equal(typeof payload.plan.winner.added_material, 'number');
  assert.equal(payload.plan.winner.property_ranges.length, 2);
  assert.equal(payload.plan.gaps.length, 0);
  const json = JSON.stringify(payload);
  assert.doesNotMatch(json, /META_API_KEY|api[_-]?key/i);
  assert.doesNotMatch(json, /don't use|do not use/i);
});

test('proposal and advice requests carry all targets and no key', () => {
  const s = bracket();
  const payload = toApiPayload(s);
  assert.equal(payload.product.span_mm, 180);
  assert.equal(payload.targets.length, 2);
  assert.equal(payload.targets[0].property, 'strength');
  assert.equal(payload.targets[1].property, 'weight');
  assert.doesNotMatch(JSON.stringify(payload), /META_API_KEY|api[_-]?key/i);
});

test('format helpers do not invent property values', () => {
  assert.equal(formatRange({ min: 11.896, max: 15.295, unit: 'kg' }), '11.9–15.3 kg');
  const s = bracket({ extraTargets: [], steady: { available: false, type: '', eMpa: 0, sMpa: 0 } });
  const result = evaluateBuilds(s, []);
  assert.ok(result.winner.range.min >= s.target.min);
  assert.ok(result.winner.range.max <= s.target.max);
  assert.equal(buildSizeText(result.winner.part), '180 mm shelf bracket, 40 × 15 mm');
});

test('app source starts with a product question, cases and multiple requirements', async () => {
  const fs = await import('node:fs/promises');
  const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  const js = await fs.readFile(new URL('../main.js', import.meta.url), 'utf8');
  assert.match(html, /What do you want to make\?/);
  assert.match(html, /data-case="bracket"/);
  assert.match(html, /data-case="planter"/);
  assert.match(html, /id="add-target"/);
  assert.match(html, /id="brief"/);
  assert.match(html, /id="brief-submit"/);
  assert.doesNotMatch(html, /id="brief-voice"/);
  assert.match(html, /id="meta-trace"/);
  assert.doesNotMatch(html, /Make the 180 mm shelf bracket, 40 × 15 mm\./);
  assert.doesNotMatch(html, /don't use|do not use/i);
  assert.match(js, /\/api\/product\/brief/);
  assert.doesNotMatch(js, /\/api\/voice\/transcribe/);
  assert.doesNotMatch(js, /MediaRecorder|getUserMedia/);
  assert.match(js, /\/api\/product\/proposals/);
  assert.match(js, /\/api\/product\/advice/);
  assert.match(js, /SAMPLE_BRIEF/);
  assert.doesNotMatch(js, /META_API_KEY|api[_-]?key/i);
});

test('published batches give a starting range with no measurements of your own', async () => {
  const { PUBLISHED_BATCHES: batches, publishedBatchFor: match } = await import('../product.js');
  assert.ok(batches.length >= 5);
  for (const batch of batches) {
    assert.ok(batch.plastic.eMin > 0 && batch.plastic.eMax >= batch.plastic.eMin, batch.key);
    assert.ok(batch.plastic.sMin > 0 && batch.plastic.sMax >= batch.plastic.sMin, batch.key);
    assert.match(batch.note, /Not a measurement of your delivery/);
  }
  assert.equal(match('recycled HDPE from one supplier').key, 'rhdpe-measured-lot');
  assert.equal(match('recycled HDPE').key, 'rhdpe');
  assert.equal(match('mixed polyolefins').key, 'mixed-polyolefins');
  assert.equal(match('recycled HDPE, ABS, PET and PP from several suppliers').key, 'mixed-polyolefins');
  assert.equal(match('recycled PET').key, 'rpet');
  assert.equal(match('unobtainium'), null);
});

test('thin-evidence ranges and example numbers are labelled as what they are', async () => {
  const { PUBLISHED_BATCHES: batches } = await import('../product.js');
  const thin = batches.filter((b) => b.thinEvidence).map((b) => b.key);
  assert.deepEqual(thin.sort(), ['mixed-polyolefins', 'rldpe']);
  for (const batch of batches.filter((b) => b.thinEvidence)) {
    assert.match(batch.note, /not to use it for load-bearing claims/);
  }
  const fs = await import('node:fs/promises');
  const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  const js = await fs.readFile(new URL('../main.js', import.meta.url), 'utf8');
  assert.match(html, /id="case-note"/);
  assert.match(js, /Example numbers for a/);
  assert.match(js, /rough guide only/);
  assert.match(html, /They do not change any number here/);
  assert.match(html, /no safety margin is added, and it certifies nothing/);
});

test('failure wording: far below is not called a swing problem, and published ranges stay out of supplier numbers', () => {
  const far = normalizeState({ ...DEFAULT_STATE, ...CASE_PRESETS.crate, target: { property: 'strength', min: 900, max: 1000 } });
  const farDecision = decisionFor(far, evaluateBuilds(far, []));
  assert.equal(farDecision.headline, 'Not strong enough with this delivery.');
  assert.match(farDecision.support, /far below what this part needs/);
  const published = normalizeState({ ...DEFAULT_STATE, ...CASE_PRESETS.crate, rangeSource: 'published', target: { property: 'strength', min: 130, max: 150 } });
  const pubDecision = decisionFor(published, evaluateBuilds(published, []));
  assert.doesNotMatch(pubDecision.support, /MPa/);
  assert.doesNotMatch(pubDecision.copy, /MPa/);
  assert.match(pubDecision.support, /varies too much/);
});

test('decisions scale their caution: large loads, thin evidence, every veto named', () => {
  const pallet = normalizeState({ ...DEFAULT_STATE, ...CASE_PRESETS.pallet });
  const palletDecision = decisionFor(pallet, evaluateBuilds(pallet, []));
  assert.match(palletDecision.support, /calculated estimate only/);
  assert.doesNotMatch(palletDecision.support, /make one and check it before a run/);
  assert.match(palletDecision.copy, /calculated estimate only/);

  const shelf = normalizeState({
    blank: true, product: 'light shelf', mode: 'simple', spanMm: 400, widthMm: 60, thicknessMm: 6,
    target: { property: 'strength', min: 5, max: 15 },
    plastic: { type: 'recycled LDPE', eMin: 188, eMax: 312, sMin: 8, sMax: 12, density: 0.92 },
  });
  const shelfDecision = decisionFor(shelf, evaluateBuilds(shelf, []));
  assert.match(shelfDecision.support, /thin published evidence/);
  assert.match(shelfDecision.copy, /thin published evidence/);

  const bracketState = normalizeState({
    ...DEFAULT_STATE, ...CASE_PRESETS.bracket,
    plastic: { type: 'weak custom', eMin: 500, eMax: 600, sMin: 10, sMax: 12, density: 0.95 },
    steady: { available: true, type: 'cleaner stream', eMpa: 2000, sMpa: 40 },
  });
  const bracketDecision = decisionFor(bracketState, evaluateBuilds(bracketState, []));
  assert.match(bracketDecision.support, /Also holding it back: weight/);
});

test('a passing decision names a thin margin and the missing safety margin', () => {
  const s = normalizeState({ ...DEFAULT_STATE, ...CASE_PRESETS.crate });
  const decision = decisionFor(s, evaluateBuilds(s, []));
  assert.match(decision.support, /no safety margin added/);
  assert.match(decision.support, /closest margin is thin — make one and check it/);
  assert.match(decision.copy, /no safety margin added/);
});

test('the sample brief is shop language, and the batch picker is on the page', async () => {
  const fs = await import('node:fs/promises');
  const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  const js = await fs.readFile(new URL('../main.js', import.meta.url), 'utf8');
  assert.match(html, /id="batch-source"/);
  assert.match(html, /id="measured-fields"/);
  assert.match(html, /What do you know about this delivery\?/);
  assert.match(js, /recycled HDPE from one supplier, fairly clean/);
  assert.doesNotMatch(js, /SAMPLE_BRIEF = '[^']*MPa/);
});

test('imperial display converts values and never touches the mechanics', async () => {
  const m = await import('../product.js');
  const part = { product: 'crate side', mode: 'simple', spanMm: 400, widthMm: 60, thicknessMm: 15 };
  const metricCapacity = m.capacityN(part, 1000, 40);
  m.setUnitSystem('imperial');
  try {
    assert.match(m.formatRange({ min: 100, max: 100, unit: 'kg' }), /lb/);
    assert.match(m.formatRange({ min: 700, max: 850, unit: 'MPa' }), /psi/);
    assert.match(m.buildSizeText(part), /in crate side/);
    assert.doesNotMatch(m.buildSizeText(part), /mm/);
    assert.equal(m.capacityN(part, 1000, 40), metricCapacity);
  } finally {
    m.setUnitSystem('metric');
  }
  assert.match(m.buildSizeText(part), /400 mm crate side/);
});

test('settings, progress and downloads are wired without a key in the source', async () => {
  const fs = await import('node:fs/promises');
  const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  const js = await fs.readFile(new URL('../main.js', import.meta.url), 'utf8');
  assert.match(html, /id="settings-dialog"/);
  assert.match(html, /id="set-provider"/);
  assert.match(html, /id="unit-imperial"/);
  assert.match(html, /id="progress-list"/);
  assert.match(html, /id="dl-txt"/);
  assert.match(html, /id="dl-csv"/);
  assert.match(html, /id="dl-json"/);
  assert.match(js, /X-User-Meta-Key/);
  assert.match(js, /sessionStorage/);
  assert.match(js, /setUnitSystem/);
  assert.doesNotMatch(js, /META_API_KEY\s*=/);
});

test('ticket carries where the range came from, and the builds heading tells the truth', async () => {
  const fs = await import('node:fs/promises');
  const js = await fs.readFile(new URL('../main.js', import.meta.url), 'utf8');
  const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(js, /function ticketText/);
  assert.match(js, /Range source:/);
  assert.match(js, /No build works yet/);
  assert.match(html, /Delivery name/);
});

test('feedstock is priced and stocked by the tonne, as it is traded', async () => {
  const fs = await import('node:fs/promises');
  const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  const js = await fs.readFile(new URL('../main.js', import.meta.url), 'utf8');
  assert.match(html, /This delivery costs, per tonne/);
  assert.match(html, /do you have\? \(tonnes\)/);
  assert.match(js, /parsed \/ 1000/);
  assert.match(js, /parsed \* 1000/);
  assert.match(js, /per tonne before blending/);
  assert.doesNotMatch(html, /costs, per kg/);
});

test('settings keeps Meta in front and labels every model answer', async () => {
  const fs = await import('node:fs/promises');
  const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  const js = await fs.readFile(new URL('../main.js', import.meta.url), 'utf8');
  assert.match(html, /id="set-other-provider"/);
  assert.match(html, /Use a different provider instead of Meta/);
  assert.match(html, /id="set-provider-field" hidden/);
  assert.match(js, /answerSourceLine/);
  assert.match(js, /saved answer from an earlier call/);
  assert.doesNotMatch(js, /Voice: /);
});

test('production panel counts waste and sorting loss, and cost can disagree with the headline', async () => {
  const fs = await import('node:fs/promises');
  const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  const js = await fs.readFile(new URL('../main.js', import.meta.url), 'utf8');
  assert.match(html, /id="waste-pct"/);
  assert.match(html, /id="treat-loss"/);
  assert.match(html, /id="stiffness-translator"/);
  assert.match(js, /productionTotals/);
  assert.match(js, /buildCostPerPart/);
  assert.match(js, /allocatePriority/);
  assert.match(js, /The headline does not change on price alone/);
  assert.match(js, /strength is not rechecked here/);
  assert.match(js, /checked against its own requirement/);
  assert.match(js, /It can still make/);
});

test('the still-needed questions are on the page and ask for specific information', async () => {
  const fs = await import('node:fs/promises');
  const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  const js = await fs.readFile(new URL('../main.js', import.meta.url), 'utf8');
  assert.match(html, /id="need-panel"/);
  assert.match(html, /id="need-question"/);
  assert.match(js, /What does it have to do\?/);
  assert.match(js, /What is this delivery closest to\?/);
  assert.match(js, /missingSteps/);
});

test('a blank start stays blank after re-normalising (no silent default delivery)', () => {
  const s = normalizeState({
    blank: true, product: 'insulation panels', mode: 'simple',
    spanMm: 1200, widthMm: 600, thicknessMm: 15,
    target: { property: 'strength', min: 10, max: 400 },
    plastic: { type: 'recycled HDPE, ABS, PET and PP' },
  });
  const again = normalizeState(s);
  assert.equal(again.plastic.eMin, 0);
  assert.equal(again.plastic.sMin, 0);
  assert.equal(isReady(again), false);
  const result = evaluateBuilds(again, []);
  assert.equal(result.winner, null);
  assert.equal(result.ready, false);
});

test('a section move may widen a part but may not shrink its width', () => {
  const s = bracket({ extraTargets: [] });
  const result = evaluateBuilds(s, [{ move: 'section', widthMm: 10, thicknessMm: 40 }]);
  for (const build of result.passingBest) {
    assert.ok(build.part.widthMm >= s.widthMm - 1e-9, `width shrank to ${build.part.widthMm}`);
  }
  const traced = evaluateBuilds(s, [{ move: 'section', widthMm: 10, thicknessMm: 40 }]);
  assert.equal(traced.modelTrace.filter((item) => item.move === 'section').length, 0);
});

test('a 0-0 requirement is no requirement (no result is calculated against it)', () => {
  const s = bracket({ target: { property: 'strength', min: 0, max: 0 }, extraTargets: [] });
  assert.equal(isReady(s), false);
  const result = evaluateBuilds(s, []);
  assert.equal(result.ready, false);
  assert.equal(result.winner, null);
});

test('a part that carries no load gets its weight, not an invented load answer', () => {
  const s = normalizeState({
    blank: true,
    product: 'sound insulation panel', mode: 'simple', spanMm: 1200, widthMm: 800, thicknessMm: 35,
    target: { property: 'none', min: '', max: '' },
    plastic: { type: 'mixed plastics', density: 0.93 },
  });
  assert.equal(isReady(s), true);
  const result = evaluateBuilds(s, []);
  assert.equal(result.ready, true);
  assert.ok(result.winner);
  // 0.93 g/cm3 x 1200x800x35 mm = 31,248 g
  close(result.winner.ranges[0].min, 31248, 1);
  const decision = decisionFor(s, result);
  assert.match(decision.headline, /No load to check/);
  assert.match(decision.support, /31,248|31248/);
});

test('how it is held is only required when a load is being checked', () => {
  const basePart = {
    blank: true, product: 'floor mat', spanMm: 900, widthMm: 600, thicknessMm: 8,
    plastic: { type: 'mixed plastics', eMin: 560, eMax: 1040, sMin: 14, sMax: 22, density: 0.93 },
  };
  const weightOnly = normalizeState({ ...basePart, target: { property: 'weight', min: 1000, max: 9000 } });
  assert.equal(weightOnly.mode, '');
  assert.equal(isReady(weightOnly), true);
  const structural = normalizeState({ ...basePart, target: { property: 'strength', min: 5, max: 50 } });
  assert.equal(isReady(structural), false);
  const held = normalizeState({ ...basePart, mode: 'simple', target: { property: 'strength', min: 5, max: 50 } });
  assert.equal(isReady(held), true);
});

test('production totals are on the page: order, stock, next density', async () => {
  const fs = await import('node:fs/promises');
  const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  const js = await fs.readFile(new URL('../main.js', import.meta.url), 'utf8');
  assert.match(html, /id="material-have"/);
  assert.match(html, /id="next-density"/);
  assert.match(html, /id="use-note"/);
  assert.match(js, /makes about/);
  assert.match(js, /does not cover the whole order/);
  assert.match(js, /Check .* with this delivery/);
});

test('stiffness is asked as weight and bend, not as a lab number', async () => {
  const fs = await import('node:fs/promises');
  const js = await fs.readFile(new URL('../main.js', import.meta.url), 'utf8');
  assert.match(js, /need-s-load/);
  assert.match(js, /need-s-bend/);
  assert.match(js, /You do not need to know the stiffness number/);
});

test('cost comparison is wired: prices, currency, cheapest build', async () => {
  const fs = await import('node:fs/promises');
  const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  const js = await fs.readFile(new URL('../main.js', import.meta.url), 'utf8');
  assert.match(html, /id="cost-batch"/);
  assert.match(html, /id="cost-steady"/);
  assert.match(html, /id="cost-currency"/);
  assert.match(js, /What each build costs/);
  assert.match(js, /Cheapest/);
});

test('saved parts and deliveries are wired to this machine only', async () => {
  const fs = await import('node:fs/promises');
  const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  const js = await fs.readFile(new URL('../main.js', import.meta.url), 'utf8');
  assert.match(html, /id="saved-products"/);
  assert.match(html, /id="saved-deliveries"/);
  assert.match(js, /anyrb\.products\.v1/);
  assert.match(js, /anyrb\.deliveries\.v1/);
  assert.match(js, /localStorage/);
});

test('sharing one delivery between two products is wired', async () => {
  const fs = await import('node:fs/promises');
  const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  const js = await fs.readFile(new URL('../main.js', import.meta.url), 'utf8');
  assert.match(html, /id="share-other"/);
  assert.match(html, /id="share-result"/);
  assert.match(js, /cannot cover both orders in full/);
  assert.match(js, /goes first/);
});

test('inference provider menu offers endpoints beyond Meta, with details', async () => {
  const fs = await import('node:fs/promises');
  const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  const js = await fs.readFile(new URL('../main.js', import.meta.url), 'utf8');
  for (const provider of ['openrouter', 'openai', 'anthropic', 'google', 'nvidia', 'deepseek', 'custom']) {
    assert.match(html, new RegExp(`value="${provider}"`));
  }
  assert.match(html, /id="set-endpoint"/);
  assert.match(html, /id="set-model-text"/);
  assert.match(js, /X-User-Provider/);
  assert.match(js, /X-User-Base-Url/);
  assert.doesNotMatch(js, /brief-voice|Use your voice|Voice is only available/);
});

test('sorting or washing, with the effect entered, becomes a compared build', () => {
  const s = bracket({
    extraTargets: [],
    steady: { available: false, type: '', eMpa: 0, sMpa: 0 },
    treated: { available: true, eMin: 700, eMax: 850, sMin: 40, sMax: 44 },
  });
  const result = evaluateBuilds(s, []);
  const treated = result.passingBest.find((item) => item.move === 'treated');
  assert.ok(treated, 'a treated build passes with the entered stronger ranges');
  const decision = decisionFor(s, result);
  if (result.winner.move === 'treated') {
    assert.match(decision.headline, /Sort or wash this delivery/);
  }
  // without the treatment declared, no treated build may appear
  const plain = evaluateBuilds(bracket({ extraTargets: [], steady: { available: false, type: '', eMpa: 0, sMpa: 0 } }), []);
  assert.equal(plain.passingBest.filter((item) => item.move === 'treated').length, 0);
});

test('mix-in by kind: a published range blends at its weak end and can close a gap the raw delivery cannot', () => {
  const batch = PUBLISHED_BATCHES.find((item) => item.key === 'rhdpe-measured-lot');
  assert.ok(batch);
  // Wide delivery (strength swing 14-28 MPa, ratio 2) against an 11.5-16.5 kg
  // window (ratio 1.43): no thickness of the raw delivery can fit, because
  // thickness scales both ends together. A single-value mix-in narrows it.
  const s = bracket({
    extraTargets: [{ property: 'stiffness', min: 1.5, max: 1.9 }],
    plastic: { type: 'wide delivery', batch: 'June delivery', mix: '', dirt: '', dirtLevel: 'none', eMin: 700, eMax: 850, sMin: 14, sMax: 28, density: 0.94 },
    steady: { available: true, type: '', source: 'published', publishedKey: 'rhdpe-measured-lot', eMpa: 0, sMpa: 0 },
  });
  // normalizeState preserves the route; the entered numbers stay 0.
  assert.equal(s.steady.source, 'published');
  assert.equal(s.steady.publishedKey, 'rhdpe-measured-lot');
  assert.equal(s.steady.eMpa, 0);
  assert.equal(s.steady.sMpa, 0);
  // The values used are exactly the published weak end, not the strong end
  // (1589 / 48.4) and not an average.
  assert.deepEqual(steadyValues(s), { eMpa: 1111, sMpa: 41.6 });
  assert.deepEqual(steadyValues(s), { eMpa: batch.plastic.eMin, sMpa: batch.plastic.sMin });
  // A model-proposed blend also survives on the published route alone.
  assert.equal(normalizeModelProposals(s, [{ move: 'blend', fraction: 0.5 }]).length, 1);

  const candidate = blendCandidate(s);
  assert.ok(candidate);
  // With the weak end (41.6 MPa) the weak end of the blend reaches the
  // window at f=0.61; the strong end (48.4 MPa) would already reach it at
  // f=0.49. The exact fraction proves which end was used.
  assert.equal(candidate.fraction, 0.61);

  const result = evaluateBuilds(s, []);
  assert.equal(result.current.pass, false);
  assert.equal(result.winner.move, 'blend');
  assert.equal(result.winner.fraction, 0.61);
  // Exact blended ranges: plastic = 0.39 x delivery + 0.61 x weak end.
  const f = 0.61;
  const blendedSMin = (1 - f) * 14 + f * 41.6;
  const blendedSMax = (1 - f) * 28 + f * 41.6;
  const blendedEMin = (1 - f) * 700 + f * 1111;
  const blendedEMax = (1 - f) * 850 + f * 1111;
  close(result.winner.ranges[0].min, capacityN(result.winner.part, blendedEMin, blendedSMin) / G, 1e-9);
  close(result.winner.ranges[0].max, capacityN(result.winner.part, blendedEMax, blendedSMax) / G, 1e-9);
  close(result.winner.ranges[0].min, 11.645914497550887, 1e-9);
  close(result.winner.ranges[1].min, stiffness(result.winner.part, blendedEMin), 1e-9);
  close(result.winner.ranges[1].max, stiffness(result.winner.part, blendedEMax), 1e-9);

  // The raw delivery, with no mix-in declared, has no passing build at all.
  const raw = bracket({
    extraTargets: [{ property: 'stiffness', min: 1.5, max: 1.9 }],
    plastic: { type: 'wide delivery', batch: 'June delivery', mix: '', dirt: '', dirtLevel: 'none', eMin: 700, eMax: 850, sMin: 14, sMax: 28, density: 0.94 },
    steady: { available: false, type: '', source: 'numbers', publishedKey: '', eMpa: 0, sMpa: 0 },
  });
  assert.equal(blendCandidate(raw), null);
  assert.equal(evaluateBuilds(raw, []).winner, null);

  // Decision and ticket copy say the published range was used at its weak end.
  const decision = decisionFor(s, result);
  assert.match(decision.support, /using the published “.*” range at its weak end/);
  assert.match(decision.copy, /using the published “.*” range at its weak end/);
  assert.match(decision.copy, /Blend: 61%/);

  // Entered-numbers route is unchanged, and invalid routes fall back safely.
  assert.deepEqual(steadyValues(bracket({ extraTargets: [] })), { eMpa: 2000, sMpa: 40 });
  const bogus = normalizeState({
    ...s,
    steady: { available: true, type: 'x', source: 'published', publishedKey: 'no-such-batch', eMpa: 123, sMpa: 45 },
  });
  assert.equal(bogus.steady.publishedKey, '');
  assert.deepEqual(steadyValues(bogus), { eMpa: 123, sMpa: 45 });
  assert.equal(normalizeState({ ...s, steady: { ...s.steady, source: 'weird' } }).steady.source, 'numbers');
});

test('sort/wash by outcome: published range replaces entered ranges, and both routes name themselves', () => {
  const batch = PUBLISHED_BATCHES.find((item) => item.key === 'rhdpe-measured-lot');
  const basePart = {
    extraTargets: [{ property: 'stiffness', min: 1.3, max: 2.0 }],
    plastic: { type: 'delivery', batch: 'June delivery', mix: '', dirt: '', dirtLevel: 'none', eMin: 700, eMax: 850, sMin: 14, sMax: 18, density: 0.94 },
    steady: { available: false, type: '', eMpa: 0, sMpa: 0 },
  };

  // Published route: entered treated ranges are deliberately wrong (1-2 MPa);
  // the build must still use the batch range, exactly.
  const published = bracket({
    ...basePart,
    treated: { available: true, source: 'published', publishedKey: 'rhdpe-measured-lot', eMin: 1, eMax: 2, sMin: 1, sMax: 2 },
  });
  assert.equal(published.treated.source, 'published');
  assert.equal(published.treated.publishedKey, 'rhdpe-measured-lot');
  const pubResult = evaluateBuilds(published, []);
  assert.equal(pubResult.winner.move, 'treated');
  assert.equal(pubResult.winner.part.thicknessMm, 9);
  close(pubResult.winner.ranges[0].min, capacityN(pubResult.winner.part, batch.plastic.eMin, batch.plastic.sMin) / G, 1e-9);
  close(pubResult.winner.ranges[0].max, capacityN(pubResult.winner.part, batch.plastic.eMax, batch.plastic.sMax) / G, 1e-9);
  close(pubResult.winner.ranges[0].min, 12.726058337964545, 1e-9);
  close(pubResult.winner.ranges[1].min, stiffness(pubResult.winner.part, batch.plastic.eMin), 1e-9);
  close(pubResult.winner.ranges[1].max, stiffness(pubResult.winner.part, batch.plastic.eMax), 1e-9);
  const pubDecision = decisionFor(published, pubResult);
  assert.match(pubDecision.support, /After sorting or washing — to the published range for .* you picked/);
  assert.doesNotMatch(pubDecision.support, /to the ranges you entered/);
  assert.match(pubDecision.copy, /to the published range for .* you picked/);

  // Numbers route: the entered ranges are what is used, exactly.
  const numbers = bracket({
    ...basePart,
    // Entered stiffness outcome is 700-850 MPa (not the batch's 1111-1589),
    // so the stiffness window for this route is the one that range meets.
    extraTargets: [{ property: 'stiffness', min: 0.8, max: 1.1 }],
    treated: { available: true, source: 'numbers', publishedKey: '', eMin: 700, eMax: 850, sMin: 40, sMax: 44 },
  });
  const numResult = evaluateBuilds(numbers, []);
  assert.equal(numResult.winner.move, 'treated');
  assert.equal(numResult.winner.part.thicknessMm, 9);
  close(numResult.winner.ranges[0].min, capacityN(numResult.winner.part, 700, 40) / G, 1e-9);
  close(numResult.winner.ranges[0].max, capacityN(numResult.winner.part, 850, 44) / G, 1e-9);
  close(numResult.winner.ranges[0].min, 12.23659455573514, 1e-9);
  close(numResult.winner.ranges[1].min, stiffness(numResult.winner.part, 700), 1e-9);
  close(numResult.winner.ranges[1].max, stiffness(numResult.winner.part, 850), 1e-9);
  const numDecision = decisionFor(numbers, numResult);
  assert.match(numDecision.support, /After sorting or washing — to the ranges you entered/);
  assert.doesNotMatch(numDecision.support, /published range for .* you picked/);

  // Availability: valid entered ranges OR a published key (with the
  // treatment declared available). Invalid entered ranges, and an
  // unresolvable published key, produce no treated build at all.
  const invalidNumbers = bracket({
    ...basePart,
    treated: { available: true, source: 'numbers', publishedKey: '', eMin: 0, eMax: 0, sMin: 0, sMax: 0 },
  });
  assert.equal(evaluateBuilds(invalidNumbers, []).evaluated.filter((item) => item.move === 'treated').length, 0);
  const invalidPublished = bracket({
    ...basePart,
    treated: { available: true, source: 'published', publishedKey: 'no-such-batch', eMin: 700, eMax: 850, sMin: 40, sMax: 44 },
  });
  assert.equal(invalidPublished.treated.publishedKey, '');
  assert.equal(evaluateBuilds(invalidPublished, []).evaluated.filter((item) => item.move === 'treated').length, 0);
});

test('extreme geometry: a winner at a very different thickness is named plainly', () => {
  const rhdpe = PUBLISHED_BATCHES.find((item) => item.key === 'rhdpe');
  const s = normalizeState({
    blank: true,
    product: 'pallet block', mode: 'compression', spanMm: 150, widthMm: 150, thicknessMm: 80,
    target: { property: 'strength', min: 500, max: 900 }, extraTargets: [],
    plastic: { ...rhdpe.plastic },
  });
  const result = evaluateBuilds(s, []);
  assert.ok(result.winner);
  assert.equal(result.winner.part.thicknessMm, 11);
  assert.ok(result.winner.part.thicknessMm < s.thicknessMm * 0.5);
  close(result.winner.ranges[0].min, 551.445793430807, 1e-6);
  close(result.winner.ranges[0].max, 862.5177794686981, 1e-6);
  const decision = decisionFor(s, result);
  assert.match(decision.support, /at a very different thickness \(11 mm, not 80 mm\)/);
  assert.match(decision.copy, /at a very different thickness \(11 mm, not 80 mm\)/);
  // The other direction too: a 5 mm arm whose winner is 11.5 mm (> 2x).
  const thin = normalizeState({
    ...DEFAULT_STATE,
    product: 'support arm', mode: 'cantilever', spanMm: 300, widthMm: 50, thicknessMm: 5,
    target: { property: 'strength', min: 14.5, max: 18 }, extraTargets: [],
    plastic: { type: 'custom delivery', batch: 'June delivery', mix: '', dirt: '', dirtLevel: 'none', eMin: 1000, eMax: 1100, sMin: 40, sMax: 44, density: 0.95 },
    steady: { available: false, type: '', eMpa: 0, sMpa: 0 },
  });
  const thinResult = evaluateBuilds(thin, []);
  assert.equal(thinResult.winner.part.thicknessMm, 11.5);
  assert.match(decisionFor(thin, thinResult).support, /at a very different thickness \(11\.5 mm, not 5 mm\)/);
  // An ordinary winner does not get the warning.
  const crate = normalizeState({ ...DEFAULT_STATE, ...CASE_PRESETS.crate });
  const crateDecision = decisionFor(crate, evaluateBuilds(crate, []));
  assert.doesNotMatch(crateDecision.support, /very different thickness/);
  assert.doesNotMatch(crateDecision.copy, /very different thickness/);
});

test('load-path comparison: a cheaper way of holding the same part is returned, otherwise null', () => {
  const arm = normalizeState({
    ...DEFAULT_STATE,
    product: 'support arm', mode: 'cantilever', spanMm: 300, widthMm: 50, thicknessMm: 8,
    target: { property: 'strength', min: 14.5, max: 18 }, extraTargets: [],
    plastic: { type: 'custom delivery', batch: 'June delivery', mix: '', dirt: '', dirtLevel: 'none', eMin: 1000, eMax: 1100, sMin: 40, sMax: 44, density: 0.95 },
    steady: { available: false, type: '', eMpa: 0, sMpa: 0 },
  });
  const armResult = evaluateBuilds(arm, []);
  assert.equal(armResult.winner.part.thicknessMm, 11.5);
  close(armResult.winner.massG, 163.875, 1e-9);
  const comparison = loadPathComparison(arm, armResult);
  assert.ok(comparison);
  assert.equal(comparison.mode, 'simple');
  assert.equal(comparison.modeLabel, 'Held at both ends');
  assert.equal(comparison.thicknessMm, 6);
  close(comparison.massG, 85.5, 1e-9);
  // (163.875 - 85.5) / 163.875 = 47.826...% less material.
  close(comparison.savingPct, 47.82608695652174, 1e-9);
  assert.ok(comparison.savingPct > 45);

  // With no winner, the entered build is the comparison baseline:
  // the same arm plus a weight window no cantilever build can meet.
  const weighed = normalizeState({ ...arm, extraTargets: [{ property: 'weight', min: 80, max: 100 }] });
  const weighedResult = evaluateBuilds(weighed, []);
  assert.equal(weighedResult.winner, null);
  close(weighedResult.current.massG, 114, 1e-9);
  const weighedComparison = loadPathComparison(weighed, weighedResult);
  assert.equal(weighedComparison.mode, 'simple');
  assert.equal(weighedComparison.thicknessMm, 6);
  close(weighedComparison.savingPct, 25, 1e-9);

  // The crate already passes as entered under its own load path: no
  // alternative both passes and saves 10%, so the answer is null.
  const crate = normalizeState({ ...DEFAULT_STATE, ...CASE_PRESETS.crate });
  const crateResult = evaluateBuilds(crate, []);
  assert.equal(crateResult.winner.move, 'current');
  assert.equal(loadPathComparison(crate, crateResult), null);

  // No load to check: there is no load path to compare.
  const panel = normalizeState({
    blank: true,
    product: 'sound insulation panel', mode: 'simple', spanMm: 1200, widthMm: 800, thicknessMm: 35,
    target: { property: 'none', min: '', max: '' },
    plastic: { type: 'mixed plastics', density: 0.93 },
  });
  assert.equal(loadPathComparison(panel, evaluateBuilds(panel, [])), null);
  assert.equal(loadPathComparison(arm, null), null);
  assert.equal(loadPathComparison(arm, { ready: false }), null);
});

test('sheet yield: grid layouts in both orientations, exact counts', () => {
  assert.deepEqual(
    sheetYield({ sheetSpanMm: 2000, sheetWidthMm: 1000, partSpanMm: 1000, partWidthMm: 500 }),
    { perSheet: 4, along: 2, across: 2 },
  );
  // Straight layout wins: floor(2000/600) x floor(1000/400) = 3 x 2.
  assert.deepEqual(
    sheetYield({ sheetSpanMm: 2000, sheetWidthMm: 1000, partSpanMm: 600, partWidthMm: 400 }),
    { perSheet: 6, along: 3, across: 2 },
  );
  // Rotated layout wins: floor(2000/350) x floor(1000/700) = 5 x 1.
  assert.deepEqual(
    sheetYield({ sheetSpanMm: 2000, sheetWidthMm: 1000, partSpanMm: 700, partWidthMm: 350 }),
    { perSheet: 5, along: 5, across: 1 },
  );
  // Remainder is waste, never rounded up: 3 x 3 of a 650 mm part, not 4 x 4.
  assert.deepEqual(
    sheetYield({ sheetSpanMm: 2000, sheetWidthMm: 1000, partSpanMm: 650, partWidthMm: 300 }),
    { perSheet: 9, along: 3, across: 3 },
  );
  // Does not fit in either orientation, and missing sizes, yield nothing.
  assert.deepEqual(
    sheetYield({ sheetSpanMm: 2000, sheetWidthMm: 1000, partSpanMm: 2500, partWidthMm: 500 }),
    { perSheet: 0, along: 0, across: 0 },
  );
  assert.deepEqual(
    sheetYield({ sheetSpanMm: 2000, sheetWidthMm: 1000, partSpanMm: 0, partWidthMm: 500 }),
    { perSheet: 0, along: 0, across: 0 },
  );
  assert.deepEqual(sheetYield({}), { perSheet: 0, along: 0, across: 0 });
});

test('supplier sheet intake and delivery comparison are wired', async () => {
  const fs = await import('node:fs/promises');
  const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  const js = await fs.readFile(new URL('../main.js', import.meta.url), 'utf8');
  assert.match(html, /id="sheet-text"/);
  assert.match(html, /id="sheet-fill"/);
  assert.match(html, /id="compare-delivery"/);
  assert.match(html, /id="treated-available"/);
  assert.match(js, /Fill this delivery from the text|sheet-fill/);
  assert.match(js, /renderCompare/);
});

test('published outcomes stay in the delivery’s own polymer family', () => {
  assert.equal(familyOfBatchKey('rhdpe-measured-lot'), 'hdpe');
  assert.equal(familyOfBatchKey('rpetg'), 'pet');
  assert.equal(familyOfBatchKey('mixed-polyolefins'), 'mixed');
  assert.equal(familyOfBatchKey('no-such-batch'), null);
  assert.deepEqual(treatedOutcomeKeysFor('recycled HDPE', 'rhdpe'),
    ['rhdpe-measured-lot', 'rhdpe', 'mixed-polyolefins']);
  assert.deepEqual(treatedOutcomeKeysFor('', 'numbers'),
    PUBLISHED_BATCHES.map((b) => b.key));
  assert.deepEqual(treatedOutcomeKeysFor('mixed plastics', 'mixed-polyolefins'),
    PUBLISHED_BATCHES.map((b) => b.key));
});

test('blend and treated winners name the model behind the numbers', () => {
  const blended = normalizeState({
    blank: true, product: 'shelf bracket', mode: 'cantilever',
    spanMm: 180, widthMm: 40, thicknessMm: 10,
    target: { property: 'strength', min: 11.5, max: 16.5 },
    plastic: { type: 'weak', eMin: 500, eMax: 600, sMin: 10, sMax: 12, density: 0.95 },
    steady: { available: true, type: 'cleaner stream', source: 'published', publishedKey: 'rhdpe-measured-lot' },
  });
  const blendResult = evaluateBuilds(blended, []);
  assert.equal(blendResult.winner.move, 'blend');
  const blendDecision = decisionFor(blended, blendResult);
  assert.match(blendDecision.support, /mixture-rule estimate/);
  assert.match(blendDecision.copy, /optimistic end, not physically tested/);
  const treated = normalizeState({
    blank: true, product: 'crate side', mode: 'simple',
    spanMm: 400, widthMm: 60, thicknessMm: 15,
    target: { property: 'strength', min: 95, max: 115 },
    extraTargets: [{ property: 'weight', min: 320, max: 360 }],
    plastic: { type: 'weak wide', eMin: 400, eMax: 1600, sMin: 18, sMax: 45, density: 0.94 },
    treated: { available: true, source: 'published', publishedKey: 'rhdpe-measured-lot' },
  });
  const treatedResult = evaluateBuilds(treated, []);
  assert.equal(treatedResult.winner.move, 'treated');
  const treatedDecision = decisionFor(treated, treatedResult);
  assert.match(treatedDecision.support, /assumed outcome, not a measurement/);
});

test('a passing headline on a published range says so', () => {
  const published = normalizeState({ ...DEFAULT_STATE, ...CASE_PRESETS.crate, rangeSource: 'published' });
  const decision = decisionFor(published, evaluateBuilds(published, []));
  assert.match(decision.headline, /on a published range/);
  const entered = normalizeState({ ...DEFAULT_STATE, ...CASE_PRESETS.crate, rangeSource: 'numbers' });
  assert.doesNotMatch(decisionFor(entered, evaluateBuilds(entered, [])).headline, /on a published range/);
});

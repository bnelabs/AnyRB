import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CASE_PRESETS,
  DEFAULT_STATE,
  PROPERTIES,
  PROPERTY_DEFAULTS,
  advicePayload,
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
  assert.equal(decision.button, 'Ask Meta');
});

test('strength-only bracket: the declared steadier stream closes the gap', () => {
  const s = bracket({ extraTargets: [] });
  assert.equal(isReady(s), true);
  const candidate = blendCandidate(s);
  assert.ok(candidate);
  assert.equal(candidate.move, 'blend');
  const result = evaluateBuilds(s, []);
  assert.equal(result.winner.move, 'blend');
  assert.equal(result.winner.fraction, candidate.fraction);
  assert.match(decisionFor(s, result).headline, /^Blend \d+% of stiffer bottle stream/);
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
    { move: 'section', width_mm: 30, thickness_mm: 11, certification: 'yes' },
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
  assert.match(decision.headline, /^(Lift the strength low end|Narrow the strength swing)/);
  assert.equal(decision.button, 'Ask Meta');
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
  for (const property of PROPERTIES) {
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
  assert.match(html, /id="brief-voice"/);
  assert.match(html, /id="meta-trace"/);
  assert.doesNotMatch(html, /Make the 180 mm shelf bracket, 40 × 15 mm\./);
  assert.doesNotMatch(html, /don't use|do not use/i);
  assert.match(js, /\/api\/product\/brief/);
  assert.match(js, /\/api\/voice\/transcribe/);
  assert.match(js, /MediaRecorder/);
  assert.match(js, /\/api\/product\/proposals/);
  assert.match(js, /\/api\/product\/advice/);
  assert.match(js, /SAMPLE_BRIEF/);
  assert.doesNotMatch(js, /META_API_KEY|api[_-]?key/i);
});

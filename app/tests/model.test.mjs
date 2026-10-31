import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_STATE,
  PROPERTIES,
  PROPERTY_DEFAULTS,
  advicePayload,
  blendCandidate,
  buildSizeText,
  capacityN,
  decisionFor,
  evaluateBuilds,
  formatRange,
  inRange,
  massG,
  materialGap,
  minimumThicknessCandidate,
  normalizeModelProposals,
  normalizeState,
  proposalRow,
  propertyRange,
  requiredMaterial,
  stiffness,
  toApiPayload,
} from '../product.js';

const state = (overrides = {}) => normalizeState({ ...DEFAULT_STATE, ...overrides });
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
  const s = state();
  const range = propertyRange(part, s.plastic, 'strength');
  assert.equal(range.unit, 'kg');
  assert.ok(range.min > 0 && range.max > range.min);
  const stiff = propertyRange(part, s.plastic, 'stiffness');
  assert.equal(stiff.unit, 'N/mm');
  const weight = propertyRange(part, s.plastic, 'weight');
  assert.equal(weight.unit, 'g');
  assert.equal(weight.min, weight.max);
});

test('default example: thin build misses; the declared steadier stream gives a passing blend', () => {
  const s = state();
  const result = evaluateBuilds(s, []);
  assert.equal(result.current.pass, false);
  assert.ok(result.winner);
  assert.equal(result.winner.move, 'blend');
  assert.ok(result.winner.pass);
  assert.match(decisionFor(s, result).headline, /^Blend \d+% of stiffer bottle stream/);
});

test('with no steadier stream, the thin build misses and mechanics finds the thicker build', () => {
  const s = state({ steady: { available: false, type: '', eMpa: 0, sMpa: 0 } });
  const result = evaluateBuilds(s, []);
  assert.equal(result.current.pass, false);
  assert.ok(result.winner);
  assert.equal(result.winner.move, 'thickness');
  assert.equal(result.winner.part.thicknessMm, 15);
  assert.ok(result.winner.pass);
  assert.ok(result.winner.addedG > 0);
  assert.match(decisionFor(s, result).headline, /Make the 180 mm shelf bracket, 40 × 15 mm\./);
});

test('default blend example: declared steadier stream closes the gap', () => {
  const s = state();
  assert.equal(s.steady.available, true);
  const candidate = blendCandidate(s);
  assert.ok(candidate);
  assert.equal(candidate.move, 'blend');
  assert.ok(candidate.fraction >= 0.05 && candidate.fraction <= 0.9);
  const result = evaluateBuilds(s, []);
  assert.ok(result.winner);
  assert.equal(result.winner.move, 'blend');
  assert.equal(result.winner.fraction, candidate.fraction);
  const decision = decisionFor(s, result);
  assert.match(decision.headline, /^Blend \d+% of stiffer bottle stream/);
  assert.match(decision.copy, /Added material: \d+% stiffer bottle stream/);
  assert.doesNotMatch(decision.copy, /no added material/);
});

test('blend is only available when the shop declares a steadier stream', () => {
  const s = state({ steady: { available: false, type: '', eMpa: 0, sMpa: 0 } });
  assert.equal(blendCandidate(s), null);
  const result = evaluateBuilds(s, []);
  assert.ok(result.winner);
  assert.notEqual(result.winner.move, 'blend');
});

test('no model proposals means no fixed section/span/other moves', () => {
  const s = state({ steady: { available: false, type: '', eMpa: 0, sMpa: 0 } });
  const result = evaluateBuilds(s, []);
  assert.ok(result.winner);
  assert.equal(result.winner.move, 'thickness');
  assert.ok(!result.triedMoves.includes('section'));
  assert.ok(!result.triedMoves.includes('span'));
  assert.ok(!result.triedMoves.includes('other'));
  assert.ok(!result.triedMoves.includes('blend'));
});

test('model move thickness is refined to the passing size', () => {
  const s = state({ steady: { available: false, type: '', eMpa: 0, sMpa: 0 } });
  const result = evaluateBuilds(s, [{ move: 'thickness', thickness_mm: 12.5 }]);
  assert.ok(result.passingBest.some((item) => item.move === 'thickness' && item.part.thicknessMm === 15));
});

test('model move section is searched in its direction and only passes when in range', () => {
  const s = state({ steady: { available: false, type: '', eMpa: 0, sMpa: 0 } });
  const result = evaluateBuilds(s, [{ move: 'section', width_mm: 80 }]);
  const section = result.passingBest.find((item) => item.move === 'section');
  assert.ok(section);
  assert.ok(section.part.widthMm > 40);
  assert.ok(inRange(section.range, s.target));
});

test('model move other product can make a build the main part cannot', () => {
  const s = state({ steady: { available: false, type: '', eMpa: 0, sMpa: 0 } });
  const result = evaluateBuilds(s, [{ move: 'other_product' }]);
  const other = result.passingBest.find((item) => item.move === 'other');
  assert.ok(other);
  assert.equal(other.part.product, 'heavy bracket');
  assert.match(proposalRow(s, other).size, /heavy bracket/);
});

test('model move span is clamped and searched; no passing span is not shown', () => {
  const s = state({ steady: { available: false, type: '', eMpa: 0, sMpa: 0 } });
  const normalized = normalizeModelProposals(s, [{ move: 'span', span_mm: 9000 }]);
  assert.equal(normalized.length, 1);
  assert.ok(normalized[0].spanMm <= s.spanMm * 1.2);
  const result = evaluateBuilds(s, [{ move: 'span', span_mm: 150 }]);
  assert.equal(result.passingBest.some((item) => item.move === 'span'), false);
});

test('model blend only survives when steady is declared', () => {
  const without = state({ steady: { available: false, type: '', eMpa: 0, sMpa: 0 } });
  const withSteady = state();
  assert.equal(normalizeModelProposals(without, [{ move: 'blend', fraction: 0.5 }]).length, 0);
  assert.equal(normalizeModelProposals(withSteady, [{ move: 'blend', fraction: 0.5 }]).length, 1);
});

test('model output accepts other_product snake_case and drops invented fields', () => {
  const s = state({ steady: { available: false, type: '', eMpa: 0, sMpa: 0 } });
  const normalized = normalizeModelProposals(s, [
    { move: 'other_product', strength: 999, result: 'x' },
    { move: 'section', width_mm: 30, thickness_mm: 99, certification: 'yes' },
    { move: 'nonsense' },
  ]);
  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].move, 'other');
  assert.equal(normalized[1].move, 'section');
  assert.ok(!('strength' in normalized[0]));
  assert.ok(!('certification' in normalized[1]));
});

test('passing builds are sorted by least added build material and winner is first', () => {
  const s = state({ steady: { available: false, type: '', eMpa: 0, sMpa: 0 } });
  const result = evaluateBuilds(s, [{ move: 'section', width_mm: 80 }, { move: 'other_product' }]);
  assert.ok(result.winner);
  for (let i = 1; i < result.passingBest.length; i++) {
    assert.ok(result.passingBest[i - 1].addedG <= result.passingBest[i].addedG);
  }
  assert.equal(result.winner, result.passingBest[0]);
});

test('impossible target does not say "do not use the delivery"; it states the material gap', () => {
  const s = state({ target: { property: 'strength', min: 80, max: 90 }, steady: { available: false, type: '', eMpa: 0, sMpa: 0 } });
  const result = evaluateBuilds(s, [{ move: 'thickness', thickness_mm: 30 }]);
  assert.equal(result.winner, null);
  assert.ok(result.gap);
  const decision = decisionFor(s, result);
  assert.doesNotMatch(decision.headline, /do not use|don't use/i);
  assert.match(decision.headline, /^(Lift the strength low end|Narrow the strength swing)/);
  assert.match(decision.support, /needs strength/);
  assert.equal(decision.button, 'Ask Meta');
  assert.equal(result.gap.rangeTooWide, true);
});

test('material gap names the required range and the short end', () => {
  const s = state({ target: { property: 'strength', min: 80, max: 90 }, steady: { available: false, type: '', eMpa: 0, sMpa: 0 } });
  const gap = materialGap(s, s ? { ...s, mode: 'cantilever', spanMm: 180, widthMm: 40, thicknessMm: 10, product: 'shelf bracket' } : null);
  assert.ok(gap.shortLow > 0);
  assert.equal(gap.unit, 'MPa');
  assert.ok(gap.required.min > gap.batch.max);
  const required = requiredMaterial({ product: 'x', mode: 'cantilever', spanMm: 180, widthMm: 40, thicknessMm: 10 }, 'strength', s.target);
  close(required.min, gap.required.min, 1e-9);
});

test('a narrow target reports that a section cannot narrow a material swing', () => {
  const s = state({ target: { property: 'strength', min: 15.5, max: 16.5 } });
  const result = evaluateBuilds(s, []);
  assert.equal(result.winner, null);
  assert.equal(result.gap.rangeTooWide, true);
  assert.match(decisionFor(s, result).headline, /^Narrow the strength swing\./);
  assert.match(result.gap.action, /cannot narrow the swing/);
});

test('minimum thickness candidate is a real build, not the current one', () => {
  const s = state({ steady: { available: false, type: '', eMpa: 0, sMpa: 0 } });
  const candidate = minimumThicknessCandidate(s);
  assert.ok(candidate);
  assert.equal(candidate.thicknessMm, 15);
  assert.notEqual(candidate.thicknessMm, s.thicknessMm);
});

test('property switch defaults are valid for the example build', () => {
  for (const property of PROPERTIES) {
    const defaults = PROPERTY_DEFAULTS[property.key];
    assert.ok(defaults && defaults.min < defaults.max);
    const s = state({ target: { property: property.key, ...defaults } });
    const result = evaluateBuilds(s, []);
    assert.ok(result.winner, `no winner for ${property.key}`);
  }
});

test('advice payload is numeric, complete and key-free', () => {
  const s = state();
  const result = evaluateBuilds(s, []);
  const payload = advicePayload(s, result, 'What can I do with this batch?');
  assert.equal(payload.question, 'What can I do with this batch?');
  assert.equal(typeof payload.plan.winner.added_material, 'number');
  assert.equal(typeof payload.plan.current.property_range.min, 'number');
  assert.equal(payload.steady.available, true);
  assert.ok(payload.plan.blend.available);
  const json = JSON.stringify(payload);
  assert.doesNotMatch(json, /api[_-]?key|META_API_KEY|sk-/i);
  assert.doesNotMatch(json, /don't use|do not use/i);
});

test('proposal and advice requests carry snake_case shop data and no key', () => {
  const s = state();
  const payload = toApiPayload(s);
  assert.equal(payload.product.span_mm, 180);
  assert.equal(payload.plastic.stiffness_min_mpa, 700);
  assert.equal(payload.plastic.dirt_level, 'light');
  assert.equal(payload.steady_available, true);
  assert.doesNotMatch(JSON.stringify(payload), /api[_-]?key|META_API_KEY|sk-/i);
});

test('format helpers do not invent property values', () => {
  assert.equal(formatRange({ min: 11.896, max: 15.295, unit: 'kg' }), '11.9–15.3 kg');
  const s = state();
  const result = evaluateBuilds(s, []);
  assert.ok(result.winner.range.min >= s.target.min);
  assert.ok(result.winner.range.max <= s.target.max);
  assert.equal(buildSizeText(result.winner.part), '180 mm shelf bracket, 40 × 10 mm');
});

test('app source has engineering and batch sections and no forbidden rejection copy', async () => {
  const fs = await import('node:fs/promises');
  const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  const js = await fs.readFile(new URL('../main.js', import.meta.url), 'utf8');
  assert.match(html, /id="engineering-title">Engineering/);
  assert.match(html, /id="batch-title">Batch/);
  assert.match(html, /id="ask-button"/);
  assert.doesNotMatch(html, /don't use|do not use/i);
  assert.match(js, /\/api\/product\/proposals/);
  assert.match(js, /\/api\/product\/advice/);
  assert.doesNotMatch(js, /META_API_KEY|api[_-]?key/i);
});

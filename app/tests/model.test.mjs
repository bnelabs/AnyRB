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

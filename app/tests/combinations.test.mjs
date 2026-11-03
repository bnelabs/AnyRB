/**
 * Combinatorial audit of the AnyRB checker engine (app/product.js).
 *
 * Matrix (the large test below):
 *   modes      4  cantilever | simple | compression | '' (no load path)
 *   targets   10  strength | stiffness | weight | none |
 *                 strength+weight | stiffness+weight | strength+stiffness |
 *                 all three | impossible-tight | 0-top
 *   geometry   5  beam | thin panel | stubby block | bracket | wrapper
 *   delivery  10  every PUBLISHED_BATCHES entry (6, steadier stream absent) |
 *                 narrow custom ±steadier stream | wide custom ±steadier stream
 *   proposals  6  none | widening section | SHRINKING section |
 *                 thickness move | span move | blend
 *   = 4 x 10 x 5 x 11 x 6 = 13,200 combinations.
 *
 * Invariants asserted for every ready combination (failures are collected
 * with their full combination so one run reports every trigger):
 *   - no NaN / Infinity / undefined (and no "—–—" placeholder) in any range,
 *     gap, or decision headline/support/copy;
 *   - a winner's (and every passing build's) ranges sit inside its targets
 *     ('none' has no numeric window, so it is exempt from that one check);
 *   - no winner — and no model-traced build — except move 'other' shrinks
 *     the entered width; a shrinking section proposal is never offered;
 *   - a blend is only offered when a steadier stream is declared;
 *   - failure (ready, no winner) produces one finite gap per numeric
 *     target, in target order, with clean text;
 *   - readiness: 'none' and weight-only cases are ready with mode ''
 *     while any structural (strength/stiffness) case is not, and a
 *     0-top target set is never ready.
 *
 * Supplementary loops (same invariants, outside the 13,200) cover the
 * 'other' proposal — the one place a width may shrink — and a primary
 * 'none' target sitting beside numeric extra targets.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PUBLISHED_BATCHES,
  decisionFor,
  evaluateBuilds,
  formatRange,
  isReady,
  materialGap,
  normalizeState,
  publishedBatchFor,
  setUnitSystem,
} from '../product.js';

const BAD_TEXT = /\bNaN\b|\bInfinity\b|\bundefined\b|—–—|\[object/;
const STEADY = { available: true, type: 'steadier bottle stream', eMpa: 2000, sMpa: 40 };
const NO_STEADY = { available: false, type: '', eMpa: 0, sMpa: 0 };

const MODES = ['cantilever', 'simple', 'compression', ''];
const GEOMETRIES = {
  beam: { spanMm: 400, widthMm: 60, thicknessMm: 15 },
  'thin panel': { spanMm: 1200, widthMm: 600, thicknessMm: 4 },
  'stubby block': { spanMm: 150, widthMm: 150, thicknessMm: 80 },
  bracket: { spanMm: 180, widthMm: 40, thicknessMm: 10 },
  'wrapper-like': { spanMm: 500, widthMm: 300, thicknessMm: 2 },
};
const TARGET_SETS = {
  'strength only': [{ property: 'strength', min: 11.5, max: 16.5 }],
  'stiffness only': [{ property: 'stiffness', min: 3.5, max: 5.5 }],
  'weight only': [{ property: 'weight', min: 90, max: 110 }],
  'none only': [{ property: 'none', min: '', max: '' }],
  'strength+weight': [
    { property: 'strength', min: 11.5, max: 16.5 },
    { property: 'weight', min: 90, max: 110 },
  ],
  'stiffness+weight': [
    { property: 'stiffness', min: 3.5, max: 5.5 },
    { property: 'weight', min: 90, max: 110 },
  ],
  'strength+stiffness': [
    { property: 'strength', min: 11.5, max: 16.5 },
    { property: 'stiffness', min: 3.5, max: 5.5 },
  ],
  'all three': [
    { property: 'strength', min: 11.5, max: 16.5 },
    { property: 'stiffness', min: 3.5, max: 5.5 },
    { property: 'weight', min: 90, max: 110 },
  ],
  'impossible-tight': [{ property: 'strength', min: 9999, max: 10000 }],
  '0-top': [{ property: 'strength', min: 0, max: 0 }],
};
const DELIVERIES = {
  ...Object.fromEntries(PUBLISHED_BATCHES.map((batch) => [
    `published:${batch.key}`,
    { plastic: { ...batch.plastic }, steady: NO_STEADY },
  ])),
  'narrow custom + steadier': {
    plastic: { type: 'narrow custom delivery', eMin: 1000, eMax: 1050, sMin: 30, sMax: 31.5, density: 0.95 },
    steady: STEADY,
  },
  'narrow custom, no steadier': {
    plastic: { type: 'narrow custom delivery', eMin: 1000, eMax: 1050, sMin: 30, sMax: 31.5, density: 0.95 },
    steady: NO_STEADY,
  },
  'wide failing + steadier': {
    plastic: { type: 'wide custom delivery', eMin: 200, eMax: 2000, sMin: 5, sMax: 50, density: 0.93 },
    steady: STEADY,
  },
  'wide failing, no steadier': {
    plastic: { type: 'wide custom delivery', eMin: 200, eMax: 2000, sMin: 5, sMax: 50, density: 0.93 },
    steady: NO_STEADY,
  },
};
// Proposals are built per geometry so "widening"/"shrinking" mean the same
// direction for a 600 mm panel as for a 40 mm bracket.
function proposalsFor(geometry) {
  return {
    none: [],
    'widening section': [{ move: 'section', width_mm: geometry.widthMm + 80 }],
    'shrinking section (must never be offered)': [
      { move: 'section', width_mm: Math.max(2, Math.floor(geometry.widthMm / 4)) },
    ],
    'thickness move': [{ move: 'thickness', thickness_mm: geometry.thicknessMm + 10 }],
    'span move': [{ move: 'span', span_mm: Math.round(geometry.spanMm * 0.9) }],
    blend: [{ move: 'blend', fraction: 0.5 }],
  };
}
const PROPOSAL_NAMES = Object.keys(proposalsFor(GEOMETRIES.beam));

function buildState({ mode, geometryName, targets, delivery }) {
  const geometry = GEOMETRIES[geometryName];
  return normalizeState({
    blank: true,
    product: `audit ${geometryName}`,
    mode,
    ...geometry,
    target: { ...targets[0] },
    extraTargets: targets.slice(1).map((target) => ({ ...target })),
    plastic: { ...delivery.plastic },
    steady: { ...delivery.steady },
    other: {
      product: 'heavier part',
      mode: mode || 'cantilever',
      spanMm: 260,
      widthMm: 50,
      thicknessMm: 16.5,
    },
  });
}

function expectedReady(mode, targetName, targets) {
  if (targetName === '0-top') return false;
  const structural = targets.some((t) => t.property === 'strength' || t.property === 'stiffness');
  return mode !== '' || !structural;
}

test('matrix: 13,200 mode x target x geometry x delivery x proposal combinations', (t) => {
  const failures = [];
  const fail = (ctx, message) => {
    if (failures.length < 500) failures.push(`${ctx} :: ${message}`);
  };
  const counts = {
    total: 0, ready: 0, notReady: 0, winners: 0, readyNoWinner: 0,
    byMove: {}, blendWinners: 0,
  };

  for (const mode of MODES) {
    for (const [targetName, targets] of Object.entries(TARGET_SETS)) {
      for (const geometryName of Object.keys(GEOMETRIES)) {
        const geometry = GEOMETRIES[geometryName];
        const proposals = proposalsFor(geometry);
        for (const [deliveryName, delivery] of Object.entries(DELIVERIES)) {
          for (const proposalName of PROPOSAL_NAMES) {
            counts.total += 1;
            const ctx = `[mode=${mode || "''"} | targets=${targetName} | geometry=${geometryName}`
              + ` | delivery=${deliveryName} | proposal=${proposalName}]`;
            let state;
            let result;
            try {
              state = buildState({ mode, geometryName, targets, delivery });
              result = evaluateBuilds(state, proposals[proposalName]);
            } catch (error) {
              fail(ctx, `threw: ${error && error.message}`);
              continue;
            }

            // normalizeState is idempotent over the whole matrix.
            if (JSON.stringify(normalizeState(state)) !== JSON.stringify(state)) {
              fail(ctx, 'normalizeState is not idempotent');
            }

            const wantReady = expectedReady(mode, targetName, targets);
            if (isReady(state) !== wantReady) fail(ctx, `isReady=${isReady(state)}, expected ${wantReady}`);
            if (result.ready !== wantReady) fail(ctx, `evaluateBuilds ready=${result.ready}, expected ${wantReady}`);

            let decision;
            try {
              decision = decisionFor(state, result);
            } catch (error) {
              fail(ctx, `decisionFor threw: ${error && error.message}`);
              continue;
            }
            for (const [field, value] of Object.entries({
              headline: decision.headline, support: decision.support, copy: decision.copy,
            })) {
              if (typeof value !== 'string' || BAD_TEXT.test(value)) {
                fail(ctx, `decision ${field} is not clean text: ${JSON.stringify(value)}`);
              }
            }

            if (!result.ready) {
              counts.notReady += 1;
              if (result.winner !== null) fail(ctx, 'not-ready result has a winner');
              continue;
            }
            counts.ready += 1;
            if (!result.current) { fail(ctx, 'ready result has no current build'); continue; }

            const numericTargets = result.targets
              .map((target, i) => ({ target, i }))
              .filter(({ target }) => target.property !== 'none');

            // Every reported range is finite, ordered, and formats cleanly.
            const builds = [result.current, ...result.passingBest];
            for (const build of builds) {
              if (!build || !Array.isArray(build.ranges) || build.ranges.length !== result.targets.length) {
                fail(ctx, `build ${build && build.move} has malformed ranges`);
                continue;
              }
              build.ranges.forEach((range, i) => {
                if (!Number.isFinite(range.min) || !Number.isFinite(range.max) || range.min > range.max) {
                  fail(ctx, `build ${build.move} range[${i}] not finite/ordered: ${JSON.stringify(range)}`);
                }
                const formatted = formatRange(range);
                if (typeof formatted !== 'string' || BAD_TEXT.test(formatted)) {
                  fail(ctx, `formatRange not clean: ${formatted}`);
                }
              });
              if (!Number.isFinite(build.massG) || !Number.isFinite(build.addedG)) {
                fail(ctx, `build ${build.move} has non-finite mass/addedG`);
              }
              // No build except 'other' may shrink the entered width.
              if (build.move !== 'other' && build.part.widthMm < state.widthMm - 1e-9) {
                fail(ctx, `passing build ${build.move} shrinks width ${state.widthMm} -> ${build.part.widthMm}`);
              }
            }
            for (const traced of result.modelTrace || []) {
              if (traced.move !== 'other' && traced.part && traced.part.widthMm < state.widthMm - 1e-9) {
                fail(ctx, `model trace ${traced.move} shrinks width ${state.widthMm} -> ${traced.part.widthMm}`);
              }
              for (const range of traced.ranges || []) {
                if (!Number.isFinite(range.min) || !Number.isFinite(range.max)) {
                  fail(ctx, `model trace ${traced.move} has a non-finite range`);
                }
              }
            }
            if (proposalName.startsWith('shrinking')) {
              if ((result.modelTrace || []).some((item) => item.move === 'section')) {
                fail(ctx, 'shrinking section proposal reached the model trace');
              }
              if (result.passingBest.some((item) => item.move === 'section')) {
                fail(ctx, 'shrinking section proposal produced a passing build');
              }
            }

            // materialGap, called directly for every target of a ready part.
            for (const target of result.targets) {
              const gap = materialGap(state, result.current.part, target);
              const rangesOk = [gap.required, gap.batch]
                .every((r) => Number.isFinite(r.min) && Number.isFinite(r.max));
              if (!rangesOk || !Number.isFinite(gap.shortLow) || !Number.isFinite(gap.overHigh)) {
                fail(ctx, `materialGap(${target.property}) is not finite: ${JSON.stringify(gap)}`);
              }
              if (typeof gap.action !== 'string' || BAD_TEXT.test(gap.action)) {
                fail(ctx, `materialGap(${target.property}) action not clean: ${gap.action}`);
              }
              if (target.property === 'none' && (gap.shortLow !== 0 || gap.overHigh !== 0)) {
                fail(ctx, `materialGap('none') invents a gap: shortLow=${gap.shortLow} overHigh=${gap.overHigh}`);
              }
            }

            if (result.winner) {
              counts.winners += 1;
              counts.byMove[result.winner.move] = (counts.byMove[result.winner.move] || 0) + 1;
              if (result.passingBest[0] !== result.winner) fail(ctx, 'winner is not passingBest[0]');
              // A winner — indeed every passing build — sits inside its targets.
              for (const build of result.passingBest) {
                for (const { target, i } of numericTargets) {
                  const range = build.ranges[i];
                  if (!(range.min >= target.min - 1e-9 && range.max <= target.max + 1e-9)) {
                    fail(ctx, `passing build ${build.move} range ${range.min}-${range.max}`
                      + ` outside ${target.property} target ${target.min}-${target.max}`);
                  }
                }
              }
              if (result.winner.move === 'blend') {
                counts.blendWinners += 1;
                if (!state.steady.available || !(state.steady.eMpa > 0) || !(state.steady.sMpa > 0)) {
                  fail(ctx, 'blend winner without a declared steadier stream');
                }
                if (!Number.isFinite(result.winner.fraction)
                  || !(result.winner.fraction > 0 && result.winner.fraction <= 0.9)) {
                  fail(ctx, `blend winner has a bad fraction: ${result.winner.fraction}`);
                }
              }
              if (result.targets.every((target) => target.property === 'none')
                && decision.headline !== 'No load to check on this one.') {
                fail(ctx, `none-only winner decision headline: ${decision.headline}`);
              }
            } else {
              counts.readyNoWinner += 1;
              // Failure cases: one finite gap per numeric target, in order.
              const gapProperties = (result.gaps || []).map((gap) => gap.property);
              const wantProperties = numericTargets.map(({ target }) => target.property);
              if (JSON.stringify(gapProperties) !== JSON.stringify(wantProperties)) {
                fail(ctx, `failure gaps ${JSON.stringify(gapProperties)}, expected ${JSON.stringify(wantProperties)}`);
              }
              for (const gap of result.gaps || []) {
                if (![gap.required, gap.batch].every((r) => Number.isFinite(r.min) && Number.isFinite(r.max))
                  || !Number.isFinite(gap.shortLow) || !Number.isFinite(gap.overHigh)
                  || (gap.steadyShort !== null && !Number.isFinite(gap.steadyShort))) {
                  fail(ctx, `failure gap for ${gap.property} is not finite`);
                }
              }
              if (decision.button !== 'Ask about this delivery') {
                fail(ctx, `failure decision button: ${decision.button}`);
              }
            }
            if (!state.steady.available
              && [...result.passingBest, ...(result.modelTrace || [])].some((item) => item.move === 'blend')) {
              fail(ctx, 'blend offered with no steadier stream declared');
            }
          }
        }
      }
    }
  }

  t.diagnostic(`matrix combinations=${counts.total} ready=${counts.ready} notReady=${counts.notReady}`
    + ` winners=${counts.winners} readyNoWinner=${counts.readyNoWinner}`
    + ` blendWinners=${counts.blendWinners} winnerMoves=${JSON.stringify(counts.byMove)}`);
  assert.equal(counts.total, 4 * 10 * 5 * 11 * 6);
  // Readiness is proposal-independent: 29 of the 40 mode x target-set pairs
  // are ready (3 held modes x 9 non-0-top sets, plus '' x weight/none).
  assert.equal(counts.ready, 29 * 5 * 11 * 6);
  assert.equal(counts.notReady, counts.total - counts.ready);
  assert.ok(counts.winners > 1000, `expected many winners, got ${counts.winners}`);
  assert.ok(counts.readyNoWinner > 1000, `expected many failures, got ${counts.readyNoWinner}`);
  assert.ok(counts.byMove.current > 0 && counts.byMove.thickness > 0 && counts.byMove.section > 0,
    `expected current/thickness/section winners, got ${JSON.stringify(counts.byMove)}`);
  assert.deepEqual(failures, [], failures.slice(0, 40).join('\n'));
});

test('readiness: none and weight-only need no load path, structural cases do', () => {
  for (const geometryName of Object.keys(GEOMETRIES)) {
    for (const [deliveryName, delivery] of Object.entries(DELIVERIES)) {
      const ctx = `${geometryName} / ${deliveryName}`;
      const noLoad = buildState({
        mode: '', geometryName, delivery,
        targets: [{ property: 'none', min: '', max: '' }],
      });
      assert.equal(isReady(noLoad), true, `none-only not ready (${ctx})`);
      assert.ok(evaluateBuilds(noLoad, []).winner, `none-only has no winner (${ctx})`);

      const weightOnly = buildState({
        mode: '', geometryName, delivery,
        targets: [{ property: 'weight', min: 1, max: 100000 }],
      });
      assert.equal(isReady(weightOnly), true, `weight-only not ready (${ctx})`);

      for (const property of ['strength', 'stiffness']) {
        const structural = buildState({
          mode: '', geometryName, delivery,
          targets: [{ property, min: 1, max: 100000 }],
        });
        assert.equal(isReady(structural), false, `${property}-only ready with no mode (${ctx})`);
        assert.equal(evaluateBuilds(structural, []).ready, false, ctx);
      }
      for (const property of ['strength', 'stiffness', 'weight']) {
        const zeroTop = buildState({
          mode: 'simple', geometryName, delivery,
          targets: [{ property, min: 0, max: 0 }],
        });
        assert.equal(isReady(zeroTop), false, `${property} 0-0 target ready (${ctx})`);
      }
    }
  }
});

test('imperial display: the same matrix slice stays clean and winners stay inside (metric) targets', () => {
  setUnitSystem('imperial');
  try {
    assert.match(formatRange({ min: 11.896, max: 15.295, unit: 'kg' }), /lb$/);
    let checked = 0;
    let winners = 0;
    for (const mode of MODES) {
      for (const [targetName, targets] of Object.entries(TARGET_SETS)) {
        for (const geometryName of Object.keys(GEOMETRIES)) {
          for (const delivery of Object.values(DELIVERIES)) {
            const state = buildState({ mode, geometryName, targets, delivery });
            const result = evaluateBuilds(state, []);
            checked += 1;
            const decision = decisionFor(state, result);
            for (const value of [decision.headline, decision.support, decision.copy]) {
              assert.equal(typeof value, 'string');
              assert.doesNotMatch(value, BAD_TEXT, `${mode}/${targetName}/${geometryName}`);
            }
            if (!result.ready) continue;
            for (const range of result.current.ranges) {
              assert.doesNotMatch(formatRange(range), BAD_TEXT);
              assert.doesNotMatch(formatRange(range, range.unit), BAD_TEXT);
            }
            if (result.winner) {
              winners += 1;
              // Display conversion must not move the (metric) winner ranges.
              result.winner.ranges.forEach((range, i) => {
                const target = result.targets[i];
                if (target.property === 'none') return;
                assert.ok(range.min >= target.min - 1e-9 && range.max <= target.max + 1e-9,
                  `imperial winner outside target: ${targetName}/${geometryName}`);
              });
            }
          }
        }
      }
    }
    assert.equal(checked, 4 * 10 * 5 * 11);
    assert.ok(winners > 100, `expected imperial winners, got ${winners}`);
  } finally {
    setUnitSystem('metric');
  }
  assert.equal(formatRange({ min: 100, max: 100, unit: 'kg' }), '100 kg');
});

test('formatRange / setUnitSystem: metric, imperial, unknown units, reset', () => {
  assert.equal(formatRange({ min: 11.896, max: 15.295, unit: 'kg' }), '11.9–15.3 kg');
  assert.equal(formatRange({ min: 100, max: 100, unit: 'g' }), '100 g');
  assert.equal(formatRange({ min: 3, max: 5 }), '3–5');
  try {
    setUnitSystem('imperial');
    assert.match(formatRange({ min: 100, max: 100, unit: 'kg' }), /lb$/);
    assert.match(formatRange({ min: 700, max: 850, unit: 'MPa' }), /psi$/);
    assert.match(formatRange({ min: 0.93, max: 0.93, unit: 'g/cm³' }), /lb\/ft³$/);
    assert.match(formatRange({ min: 3, max: 5, unit: 'N/mm' }), /lbf\/in$/);
    // An unknown unit passes through untouched rather than inventing one.
    assert.equal(formatRange({ min: 3, max: 5, unit: 'furlongs' }), '3–5 furlongs');
  } finally {
    setUnitSystem('metric');
  }
  setUnitSystem('bogus');
  assert.equal(formatRange({ min: 100, max: 100, unit: 'kg' }), '100 kg');
  setUnitSystem('metric');
});

test('publishedBatchFor: single plastics, mixed text, and unsupported ABS/PETG', () => {
  for (const batch of PUBLISHED_BATCHES) {
    assert.ok(batch.plastic.eMin > 0 && batch.plastic.eMax >= batch.plastic.eMin, batch.key);
    assert.ok(batch.plastic.sMin > 0 && batch.plastic.sMax >= batch.plastic.sMin, batch.key);
    assert.ok(batch.plastic.density > 0, batch.key);
  }
  const key = (text) => (publishedBatchFor(text) || {}).key || null;
  // Single plastics with a published range.
  assert.equal(key('recycled HDPE'), 'rhdpe');
  assert.equal(key('recycled HDPE from one supplier'), 'rhdpe-measured-lot');
  assert.equal(key('published measured rHDPE, single-supplier stretch-film lot (n=50)'), 'rhdpe-measured-lot');
  assert.equal(key('recycled polypropylene'), 'rpp');
  assert.equal(key('PP'), 'rpp');
  assert.equal(key('recycled PET'), 'rpet');
  assert.equal(key('polyethylene terephthalate'), 'rpet');
  assert.equal(key('recycled LDPE'), 'rldpe');
  // Mixed deliveries use the wide published mixed range. That range is
  // itself labelled "Mixed plastics", so that phrase maps to it too
  // (before the fix it returned null — its own batch was unreachable).
  assert.equal(key('mixed polyolefins'), 'mixed-polyolefins');
  assert.equal(key('mixed plastics'), 'mixed-polyolefins');
  assert.equal(key('recycled HDPE, ABS, PET and PP from several suppliers'), 'mixed-polyolefins');
  assert.equal(key('ABS and HDPE'), 'mixed-polyolefins');
  assert.equal(key('PETG and polypropylene'), 'mixed-polyolefins');
  assert.equal(key('LDPE and HDPE film'), 'mixed-polyolefins');
  // PETG is in PUBLISHED_BATCHES (library values), so it maps.
  // ABS-only today: null. That is reported, not fixed —
  // PUBLISHED_BATCHES contains no ABS range to support a mapping,
  // and this audit does not invent published numbers.
  assert.equal(publishedBatchFor('ABS'), null);
  assert.equal(publishedBatchFor('recycled ABS'), null);
  assert.equal(publishedBatchFor('PETG').key, 'rpetg');
  assert.equal(publishedBatchFor('recycled PETG').key, 'rpetg');
  assert.equal(publishedBatchFor('rPETG').key, 'rpetg');
  assert.equal(publishedBatchFor('PVC'), null);
  assert.equal(publishedBatchFor('unobtainium'), null);
  assert.equal(publishedBatchFor(''), null);
});

test("'other' proposal: may shrink the width, and its decision must not deny a passing entered build", () => {
  // Current build passes (a generous weight window), the other product is
  // smaller, passes too, and wins on least added material (negative).
  let triggers = 0;
  for (const mode of ['cantilever', 'simple', 'compression']) {
    for (const geometryName of Object.keys(GEOMETRIES)) {
      const state = buildState({
        mode,
        geometryName,
        targets: [{ property: 'weight', min: 1, max: 10000 }],
        delivery: DELIVERIES['narrow custom, no steadier'],
      });
      const result = evaluateBuilds(state, [{ move: 'other_product' }]);
      assert.equal(result.ready, true);
      for (const build of result.passingBest) {
        if (build.move !== 'other') {
          assert.ok(build.part.widthMm >= state.widthMm - 1e-9,
            `${build.move} shrank width in ${mode}/${geometryName}`);
        }
        build.ranges.forEach((range, i) => {
          const target = result.targets[i];
          assert.ok(range.min >= target.min - 1e-9 && range.max <= target.max + 1e-9);
        });
      }
      if (result.winner && result.winner.move === 'other' && result.current.pass) {
        triggers += 1;
        const decision = decisionFor(state, result);
        // Before the fix this read "The <part> has no passing build."
        assert.doesNotMatch(decision.support, /has no passing build/);
        assert.match(decision.support, /also works/);
        assert.doesNotMatch(decision.support, BAD_TEXT);
      }
    }
  }
  assert.ok(triggers > 0, 'the other-wins-while-current-passes case never triggered');

  // And when the entered build really cannot pass, that claim is correct.
  // (Weight 20–30 g with strength 11.5–16.5 kg: no thickness of the
  // entered bracket meets both, the smaller other product does.)
  const base = buildState({
    mode: 'cantilever',
    geometryName: 'bracket',
    targets: [
      { property: 'strength', min: 11.5, max: 16.5 },
      { property: 'weight', min: 20, max: 30 },
    ],
    delivery: DELIVERIES['narrow custom, no steadier'],
  });
  const state = normalizeState({
    ...base,
    other: { product: 'heavier part', mode: 'cantilever', spanMm: 100, widthMm: 20, thicknessMm: 12 },
  });
  const result = evaluateBuilds(state, [{ move: 'other_product' }]);
  assert.equal(result.current.pass, false);
  assert.equal(result.winner.move, 'other');
  assert.match(decisionFor(state, result).support, /has no passing build/);
});

test("a primary 'none' beside numeric extra targets: no invented gap, no placeholder text", () => {
  let winners = 0;
  let failures = 0;
  const sets = {
    'none+weight': [{ property: 'none', min: '', max: '' }, { property: 'weight', min: 90, max: 110 }],
    'none+strength': [{ property: 'none', min: '', max: '' }, { property: 'strength', min: 11.5, max: 16.5 }],
    'none+weight (wide)': [{ property: 'none', min: '', max: '' }, { property: 'weight', min: 1, max: 10000 }],
  };
  for (const mode of MODES) {
    for (const geometryName of Object.keys(GEOMETRIES)) {
      for (const [name, targets] of Object.entries(sets)) {
        const delivery = DELIVERIES['narrow custom, no steadier'];
        const state = buildState({ mode, geometryName, targets, delivery });
        const structural = targets.some((t) => t.property === 'strength');
        const result = evaluateBuilds(state, []);
        assert.equal(result.ready, mode !== '' || !structural, `${mode}/${geometryName}/${name}`);
        if (!result.ready) continue;

        const gap = materialGap(state, result.current.part, state.target);
        assert.equal(gap.property, 'none');
        assert.equal(gap.shortLow, 0);
        assert.equal(gap.overHigh, 0);
        assert.ok(Number.isFinite(gap.required.min) && Number.isFinite(gap.required.max));

        const decision = decisionFor(state, result);
        assert.doesNotMatch(decision.headline, BAD_TEXT);
        assert.doesNotMatch(decision.support, BAD_TEXT);
        assert.doesNotMatch(decision.copy, BAD_TEXT);
        assert.doesNotMatch(decision.copy, /No load to check:/);

        if (result.winner) {
          winners += 1;
          // Numeric extra targets still have to be stated as requirements.
          assert.notEqual(decision.headline, 'No load to check on this one.');
          assert.match(decision.copy, /Requirement: (Weight|Strength)/);
          result.winner.ranges.forEach((range, i) => {
            const target = result.targets[i];
            if (target.property === 'none') return;
            assert.ok(range.min >= target.min - 1e-9 && range.max <= target.max + 1e-9);
          });
        } else {
          failures += 1;
          assert.deepEqual(result.gaps.map((g) => g.property),
            targets.filter((t) => t.property !== 'none').map((t) => t.property));
          assert.ok(result.gaps.every((g) => Number.isFinite(g.shortLow) && Number.isFinite(g.overHigh)));
        }
      }
    }
  }
  assert.ok(winners > 0 && failures > 0, `winners=${winners} failures=${failures}`);
});

test('impossible-tight failure: finite gaps and a clean headline at every geometry/mode', () => {
  for (const mode of ['cantilever', 'simple', 'compression']) {
    for (const geometryName of Object.keys(GEOMETRIES)) {
      const state = buildState({
        mode,
        geometryName,
        targets: [{ property: 'strength', min: 15, max: 15.01 }],
        delivery: DELIVERIES['wide failing, no steadier'],
      });
      const result = evaluateBuilds(state, [{ move: 'thickness', thickness_mm: 30 }]);
      assert.equal(result.ready, true);
      if (result.winner) continue; // a passing build is fine; it is checked elsewhere
      assert.equal(result.gaps.length, 1);
      const [gap] = result.gaps;
      assert.ok(Number.isFinite(gap.required.min) && Number.isFinite(gap.required.max));
      assert.ok(Number.isFinite(gap.shortLow) && Number.isFinite(gap.overHigh));
      const decision = decisionFor(state, result);
      assert.doesNotMatch(decision.headline, BAD_TEXT);
      assert.doesNotMatch(decision.support, BAD_TEXT);
      assert.doesNotMatch(decision.copy, BAD_TEXT);
    }
  }
});

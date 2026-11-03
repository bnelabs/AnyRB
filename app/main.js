import {
  DEFAULT_STATE,
  MODES,
  PROPERTIES,
  PROPERTY_DEFAULTS,
  CASE_PRESETS,
  PUBLISHED_BATCHES,
  advicePayload,
  convertForDisplay,
  convertFromDisplay,
  displayUnit,
  propertyMeta,
  setUnitSystem,
  publishedBatchFor,
  buildSizeText,
  decisionFor,
  evaluateBuilds,
  formatNumber,
  formatTarget,
  isReady,
  materialGap,
  normalizeState,
  proposalRow,
  toApiPayload,
} from './product.js';

const $ = (id) => document.getElementById(id);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const API_BASE = location.protocol === 'file:' ? 'http://127.0.0.1:8787' : '';

let state = normalizeState({ blank: true });
let modelProposals = [];
let modelState = 'loading';
let modelSeq = 0;
let modelTimer = 0;
let adviceSeq = 0;
let lastResult = null;
let lastDecision = null;
let copyReset = 0;
let metaSource = null;
let feedbackRound = false;
let batchSource = '';
let briefPublished = null;
let briefBatchChoiceNeeded = false;

// Settings: provider/model/units persist on this machine; the user's own key
// is kept in session storage (this tab only) and sent only to the local server.
let settings = {
  provider: localStorage.getItem('anyrb.provider') || 'meta',
  model: localStorage.getItem('anyrb.model') || 'muse-spark-1.3-contributor',
  units: localStorage.getItem('anyrb.units') || 'metric',
};
let userKey = sessionStorage.getItem('anyrb.key') || '';
setUnitSystem(settings.units);

function modelOff() {
  return settings.provider === 'local';
}
function syncBriefHelp() {
  const help = document.querySelector('.brief-help');
  if (!help) return;
  help.textContent = modelOff()
    ? 'The model is off in Settings. Type the fields below, or pick an example.'
    : 'These words are sent to the model you chose in Settings, which fills the fields below from what you said. You can correct every field afterwards.';
}
function metaHeaders(json = true) {
  const headers = {};
  if (json) headers['Content-Type'] = 'application/json';
  if (userKey) headers['X-User-Meta-Key'] = userKey;
  headers['X-User-Meta-Model'] = settings.model;
  return headers;
}

const FIELD_UNITS = {
  span: 'mm', width: 'mm', thickness: 'mm',
  'other-span': 'mm', 'other-width': 'mm', 'other-thickness': 'mm',
  'e-min': 'MPa', 'e-max': 'MPa', 's-min': 'MPa', 's-max': 'MPa',
  'steady-e': 'MPa', 'steady-s': 'MPa', density: 'g/cm³',
};
function shownValue(id, metric) {
  if (metric === '' || metric === 0 || metric == null) return '';
  const unit = FIELD_UNITS[id];
  const value = unit ? convertForDisplay(Number(metric), unit) : Number(metric);
  return String(Math.round(value * 1000) / 1000);
}
function shownTarget(metric, property) {
  if (metric === '' || metric == null || metric === 0) return '';
  const meta = PROPERTIES.find((item) => item.key === property) || PROPERTIES[0];
  const value = convertForDisplay(Number(metric), meta.unit);
  return String(Math.round(value * 1000) / 1000);
}
function parsedValue(id, raw) {
  const unit = FIELD_UNITS[id];
  if (!unit || raw === '') return raw;
  const value = Number(String(raw).replace(/,/g, ''));
  return Number.isFinite(value) ? convertFromDisplay(value, unit) : raw;
}
let runSize = 0;

const SAMPLE_BRIEF = 'I make crate sides, 400 mm long, 60 mm wide and 15 mm thick, supported at both ends. Each side has to carry 95 to 115 kg, and one side should weigh 320 to 360 g. This delivery is recycled HDPE from one supplier, fairly clean, with paper labels on some of it.';



function setValue(id, value) {
  const input = $(id);
  if (input) input.value = value == null ? '' : String(value);
}

function setSelectOptions(id, items) {
  const select = $(id);
  select.replaceChildren();
  for (const item of items) {
    const option = document.createElement('option');
    option.value = item.key;
    option.textContent = item.label || item.key;
    select.append(option);
  }
}

function updateTargetLabels() {
  const meta = PROPERTIES.find((p) => p.key === state.target.property);
  $('target-min-label').textContent = meta ? `Low (${displayUnit(meta.unit)})` : 'Low';
  $('target-max-label').textContent = meta ? `High (${displayUnit(meta.unit)})` : 'High';
}

function updateSteadyVisibility() {
  $('steady-fields').hidden = !$('steady-available').checked;
}

function targetUnit(property) {
  return (PROPERTIES.find((item) => item.key === property) || PROPERTIES[0]).unit;
}

function renderExtraTargets() {
  const wrap = $('extra-targets');
  wrap.replaceChildren();
  state.extraTargets.forEach((target, index) => {
    const row = document.createElement('div');
    row.className = 'extra-target';
    const propertyField = document.createElement('div');
    propertyField.className = 'field';
    const propertyLabel = document.createElement('label');
    propertyLabel.textContent = 'Also holds';
    const select = document.createElement('select');
    for (const item of PROPERTIES) {
      const option = document.createElement('option');
      option.value = item.key;
      option.textContent = `${item.label} (${displayUnit(item.unit)})`;
      select.append(option);
    }
    select.value = target.property;
    select.addEventListener('change', () => {
      const property = select.value;
      const defaults = PROPERTY_DEFAULTS[property] || PROPERTY_DEFAULTS.strength;
      state.extraTargets[index] = { property, min: defaults.min, max: defaults.max };
      renderExtraTargets();
      onFieldChange();
    });
    propertyField.append(propertyLabel, select);

    const lowField = document.createElement('div');
    lowField.className = 'field';
    const lowLabel = document.createElement('label');
    lowLabel.textContent = `Low (${displayUnit(targetUnit(target.property))})`;
    const low = document.createElement('input');
    low.type = 'text';
    low.inputMode = 'decimal';
    low.value = target.min == null || target.min === '' ? '' : String(Math.round(convertForDisplay(Number(target.min), targetUnit(target.property)) * 1000) / 1000);
    low.addEventListener('input', () => {
      const n = Number(low.value.replace(/,/g, ''));
      state.extraTargets[index].min = low.value === '' || !Number.isFinite(n) ? low.value : convertFromDisplay(n, targetUnit(target.property));
      onFieldChange();
    });
    lowField.append(lowLabel, low);

    const highField = document.createElement('div');
    highField.className = 'field';
    const highLabel = document.createElement('label');
    highLabel.textContent = `High (${displayUnit(targetUnit(target.property))})`;
    const high = document.createElement('input');
    high.type = 'text';
    high.inputMode = 'decimal';
    high.value = target.max == null || target.max === '' ? '' : String(Math.round(convertForDisplay(Number(target.max), targetUnit(target.property)) * 1000) / 1000);
    high.addEventListener('input', () => {
      const n = Number(high.value.replace(/,/g, ''));
      state.extraTargets[index].max = high.value === '' || !Number.isFinite(n) ? high.value : convertFromDisplay(n, targetUnit(target.property));
      onFieldChange();
    });
    highField.append(highLabel, high);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-target';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      state.extraTargets.splice(index, 1);
      renderExtraTargets();
      onFieldChange();
    });

    row.append(propertyField, lowField, highField, remove);
    wrap.append(row);
  });
  $('add-target').hidden = state.extraTargets.length >= 3;
}

function paint() {
  setValue('product', state.product);
  $('mode').value = state.mode;
  setValue('span', shownValue('span', state.spanMm));
  setValue('width', shownValue('width', state.widthMm));
  setValue('thickness', shownValue('thickness', state.thicknessMm));
  $('property').value = state.target.property;
  setValue('target-min', shownTarget(state.target.min, state.target.property));
  setValue('target-max', shownTarget(state.target.max, state.target.property));
  setValue('plastic-type', state.plastic.type);
  setValue('plastic-batch', state.plastic.batch);
  setValue('plastic-mix', state.plastic.mix);
  $('dirt-level').value = state.plastic.dirtLevel;
  setValue('plastic-dirt', state.plastic.dirt);
  setValue('e-min', shownValue('e-min', state.plastic.eMin));
  setValue('e-max', shownValue('e-max', state.plastic.eMax));
  setValue('s-min', shownValue('s-min', state.plastic.sMin));
  setValue('s-max', shownValue('s-max', state.plastic.sMax));
  setValue('density', shownValue('density', state.plastic.density));
  $('steady-available').checked = state.steady.available;
  setValue('steady-type', state.steady.type);
  setValue('steady-e', shownValue('steady-e', state.steady.eMpa));
  setValue('steady-s', shownValue('steady-s', state.steady.sMpa));
  setValue('other-product', state.other.product);
  $('other-mode').value = state.other.mode;
  setValue('other-span', shownValue('other-span', state.other.spanMm));
  setValue('other-width', shownValue('other-width', state.other.widthMm));
  setValue('other-thickness', shownValue('other-thickness', state.other.thicknessMm));
  updateTargetLabels();
  updateSteadyVisibility();
  renderExtraTargets();
  syncBatchSourceUI();
}

function syncBatchSourceUI() {
  const select = $('batch-source');
  if (!select || !select.options.length) return;
  select.value = batchSource;
  const note = $('batch-note');
  const pub = PUBLISHED_BATCHES.find((b) => b.key === batchSource);
  if (pub) {
    note.hidden = false;
    note.textContent = pub.note;
  } else if (batchSource === 'numbers') {
    note.hidden = false;
    note.textContent = 'Using the numbers below, exactly as entered.';
  } else {
    note.hidden = true;
    note.textContent = '';
  }
}

function applyBatchSource(key) {
  batchSource = key;
  const pub = PUBLISHED_BATCHES.find((b) => b.key === key);
  if (pub) {
    state.plastic = {
      ...state.plastic,
      type: pub.plastic.type,
      eMin: pub.plastic.eMin, eMax: pub.plastic.eMax,
      sMin: pub.plastic.sMin, sMax: pub.plastic.sMax,
      density: pub.plastic.density,
    };
    paint();
    onFieldChange();
    return;
  }
  if (key === 'numbers') {
    $('measured-fields').open = true;
  }
  syncBatchSourceUI();
}

function fade(elements, fn) {
  for (const element of elements) element.classList.add('is-fading');
  window.setTimeout(() => {
    fn();
    for (const element of elements) element.classList.remove('is-fading');
  }, 90);
}

function renderBuildList(result) {
  const list = $('build-list');
  const empty = $('empty-build');
  list.replaceChildren();
  if (!result.passingBest.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  for (const item of result.passingBest.slice(0, 6)) {
    const row = proposalRow(result.state, item);
    const li = document.createElement('li');
    li.className = 'build-row' + (item === result.winner ? ' winner' : '');
    const move = document.createElement('span');
    move.className = 'move';
    move.textContent = row.move;
    if (item === result.winner) {
      const least = document.createElement('span');
      least.className = 'least';
      least.textContent = 'uses the least extra material';
      move.append(least);
    }
    if (row.originLabel) {
      const origin = document.createElement('span');
      origin.className = 'least';
      origin.textContent = row.originLabel;
      move.append(origin);
    }
    const size = document.createElement('span');
    size.className = 'size';
    size.textContent = row.size;
    const prop = document.createElement('span');
    prop.className = 'prop';
    prop.textContent = row.property;
    const added = document.createElement('span');
    added.className = 'added';
    added.textContent = row.added;
    li.append(move, size, prop, added);
    list.append(li);
  }
}

function renderGap(result) {
  const gap = $('gap');
  gap.replaceChildren();
  if (!result.targetValid) {
    const p = document.createElement('p');
    p.textContent = 'The low end of a range is above the high end. Check the ranges.';
    gap.append(p);
    return;
  }
  if (result.winner) {
    const intro = document.createElement('p');
    intro.className = 'gap-note';
    intro.textContent = '“Needs” is what the part asks of the plastic. “Gives” is this delivery, in the units a supplier sheet uses (MPa).';
    gap.append(intro);
    for (const target of result.targets) {
      const meta = propertyMeta(target.property);
      const needed = materialGap(result.state, result.winner.part, target);
      const p = document.createElement('p');
      const needText = formatRange(needed.required, needed.unit);
      const batchText = formatRange(needed.batch, needed.unit);
      if (result.winner.move === 'blend') {
        p.textContent = `${meta.label}: the base delivery gives ${batchText}; this build needs ${needText}. ${Math.round(result.winner.fraction * 100)}% of ${result.state.steady.type || 'the steadier stream'} brings it into the window.`;
      } else {
        p.textContent = `${meta.label}: this build needs ${needText}; your delivery gives ${batchText}. It fits.`;
      }
      gap.append(p);
    }
    return;
  }
  if (!result.gaps || !result.gaps.length) return;
  const primary = result.gaps.find((item) => item.rangeTooWide || item.shortLow > 0 || item.overHigh > 0) || result.gaps[0];
  const head = document.createElement('p');
  head.className = 'gap-head';
  if (primary.rangeTooWide) {
    head.textContent = 'This delivery varies too much for at least one of these.';
  } else {
    const short = primary.shortLow > 0
      ? `${primary.shortLow.toFixed(primary.shortLow >= 10 ? 0 : 1)} ${primary.unit} short at the low end`
      : `${primary.overHigh.toFixed(primary.overHigh >= 10 ? 0 : 1)} ${primary.unit} over at the high end`;
    head.textContent = `This delivery is ${short}.`;
  }
  gap.append(head);
  const intro = document.createElement('p');
  intro.className = 'gap-note';
  intro.textContent = '“Needs” is what the part asks of the plastic. “Gives” is this delivery, in the units a supplier sheet uses (MPa).';
  gap.append(intro);
  for (const item of result.gaps) {
    const meta = propertyMeta(item.property);
    const p = document.createElement('p');
    p.textContent = `${meta.label}: needs ${formatRange(item.required, item.unit)}; delivery gives ${formatRange(item.batch, item.unit)}. ${item.action}`;
    gap.append(p);
  }
}

function renderTrace(result) {
  const trace = $('meta-trace');
  const items = result.modelTrace || [];
  trace.replaceChildren();
  if (modelState !== 'meta' || !items.length) {
    trace.hidden = true;
    return;
  }
  trace.hidden = false;
  const accepted = items.filter((item) => item.pass).length;
  const rejected = items.length - accepted;
  const head = document.createElement('p');
  head.className = 'trace-head';
  head.textContent = `The model proposed ${items.length} move${items.length === 1 ? '' : 's'}. At the size proposed: ${accepted} work${accepted === 1 ? 's' : ''}, ${rejected} do${rejected === 1 ? 'es' : ''} not.`;
  trace.append(head);
  for (const item of items.slice(0, 5)) {
    const row = proposalRow(result.state, { ...item, addedG: 0, range: item.ranges[0] });
    const line = document.createElement('div');
    line.className = 'trace-row';
    const state = document.createElement('span');
    state.className = `trace-state ${item.pass ? 'accepted' : 'rejected'}`;
    state.textContent = item.pass ? 'passes' : 'does not pass';
    const text = document.createElement('span');
    text.className = 'trace-text';
    text.textContent = `${row.move} · ${row.size} · ${row.property}`;
    line.append(state, text);
    trace.append(line);
  }
  const note = document.createElement('p');
  note.className = 'trace-note';
  note.textContent = rejected
    ? 'Moves that don’t work at that size go to the checker, which finds a size that works in the same direction. Those are the builds above.'
    : 'The exact model proposals were checked before the mechanics search.';
  trace.append(note);
}

function formatRange(range, unit) {
  const a = convertForDisplay(Number(range.min), unit).toLocaleString('en-US', { maximumFractionDigits: 1 });
  const b = convertForDisplay(Number(range.max), unit).toLocaleString('en-US', { maximumFractionDigits: 1 });
  return `${a}–${b} ${displayUnit(unit)}`;
}
function fmtVal(value, unit) {
  return `${formatNumber(convertForDisplay(value, unit))} ${displayUnit(unit)}`;
}

function metaSourceText() {
  if (!metaSource) return '';
  const round = feedbackRound ? ' Shown the checked result, the model proposed again.' : '';
  if (metaSource.kind === 'live') return ` Live answer, just now.${round}`;
  if (metaSource.kind === 'cached') return ` Saved answer from an earlier call.${round}`;
  if (metaSource.kind === 'offline') return ' The model is not reachable from here; the calculated build stands on its own.';
  return '';
}

function renderProgress(result) {
  const wrap = $('progress-list');
  if (!wrap) return;
  wrap.replaceChildren();
  const partDone = Boolean(state.product && state.mode && state.spanMm > 0 && state.widthMm > 0 && state.thicknessMm > 0);
  const targets = [state.target, ...state.extraTargets].filter((t) => t && t.property);
  const targetDone = Boolean(targets.length && targets.every((t) => t.min !== '' && t.max !== '' && Number.isFinite(Number(t.min)) && Number.isFinite(Number(t.max))));
  const batchDone = Boolean(state.plastic.eMin > 0 && state.plastic.eMax > 0 && state.plastic.sMin > 0 && state.plastic.sMax > 0 && state.plastic.density > 0);
  const metaDetail = modelOff()
    ? 'off in Settings — the local checker is running'
    : modelState === 'meta'
      ? `${modelProposals.length} move${modelProposals.length === 1 ? '' : 's'} checked`
      : modelState === 'loading'
        ? 'asking the model for sizes…'
        : modelState === 'local'
          ? 'off in Settings — the local checker is running'
          : 'not checked yet';
  const items = [
    { label: 'The part', detail: partDone ? `${state.product}, sized below` : 'name it and set its size', done: partDone },
    { label: 'What it has to do', detail: targetDone ? 'set below — every one has to hold at once' : 'add at least one property range', done: targetDone },
    { label: 'This delivery', detail: batchDone ? 'set below' : 'pick a published range, or enter supplier numbers', done: batchDone },
    { label: 'Model check', detail: metaDetail, done: modelState === 'meta', info: true },
    {
      label: 'Decision',
      detail: result && result.winner
        ? 'ready — pinned at the top, builds below'
        : result && result.ready
          ? 'no build passes — the headline names the change'
          : 'appears when the first three are set',
      done: Boolean(result && result.ready),
    },
  ];
  for (const item of items) {
    const li = document.createElement('li');
    li.className = `progress-item${item.done ? ' is-done' : ''}${item.info && !item.done ? ' is-info' : ''}`;
    const mark = document.createElement('span');
    mark.className = 'p-mark';
    mark.textContent = item.done ? '✓' : '–';
    const text = document.createElement('span');
    text.className = 'p-text';
    const strong = document.createElement('strong');
    strong.textContent = item.label;
    text.append(strong, document.createTextNode(` — ${item.detail}`));
    li.append(mark, text);
    wrap.append(li);
  }
  let next;
  if (!partDone) next = 'Next: name the part and set its size.';
  else if (!targetDone) next = 'Next: say what it has to do — how much it carries, how stiff, or how much it may weigh.';
  else if (!batchDone) next = 'Next: set this delivery — pick a published range, or enter supplier numbers.';
  else if (result && result.winner) next = 'Next: copy the build, or download it under “Builds that work”.';
  else if (result && result.ready) next = 'Next: follow the change in the headline — or ask Meta about this batch below.';
  else next = 'Next: finish the steps above.';
  $('progress-next').textContent = next;
}


function renderVerdict(result, decision) {
  const card = $('verdict');
  if (!result.ready || !result.current) {
    card.hidden = true;
    $('gap-title').hidden = true;
    return;
  }
  card.hidden = false;
  $('gap-title').hidden = false;
  const item = result.winner || result.current;
  const chip = $('verdict-chip');
  chip.textContent = result.winner ? 'Works' : 'Doesn’t work yet';
  chip.className = `verdict-chip ${result.winner ? 'pass' : 'fail'}`;
  $('verdict-title').textContent = decision.headline;
  $('verdict-build').textContent = result.winner
    ? `${proposalRow(result.state, item).originLabel} · material: ${proposalRow(result.state, item).added}`
    : `As entered: ${buildSizeText(item.part)}`;
  const tbody = $('verdict-rows');
  tbody.replaceChildren();
  result.targets.forEach((target, i) => {
    const meta = propertyMeta(target.property);
    const range = item.ranges[i];
    const passes = range.min >= target.min - 1e-9 && range.max <= target.max + 1e-9;
    const tr = document.createElement('tr');
    const cells = [
      meta.label,
      formatTarget(target),
      formatRange(range, meta.unit),
    ];
    cells.forEach((text, idx) => {
      const td = document.createElement('td');
      td.textContent = text;
      if (idx > 0) td.className = 'num';
      tr.append(td);
    });
    const status = document.createElement('td');
    status.className = `v-status ${passes ? 'pass' : 'fail'}`;
    if (passes) {
      const lowMargin = range.min - target.min;
      const highMargin = target.max - range.max;
      status.textContent = `Inside · ${fmtVal(Math.min(lowMargin, highMargin), meta.unit)} to spare`;
    } else if (range.min < target.min && range.max > target.max) {
      status.textContent = `Short ${fmtVal(target.min - range.min, meta.unit)} low, over ${fmtVal(range.max - target.max, meta.unit)} high`;
    } else if (range.min < target.min) {
      status.textContent = `Short by ${fmtVal(target.min - range.min, meta.unit)} at the low end`;
    } else {
      status.textContent = `Over by ${fmtVal(range.max - target.max, meta.unit)} at the high end`;
    }
    tr.append(status);
    tbody.append(tr);
    // slim range picture under each row: pale = needed, solid = given
    const lo = Math.min(target.min, range.min);
    const hi = Math.max(target.max, range.max);
    const pad = (hi - lo) * 0.18 || Math.abs(hi) * 0.1 || 1;
    const d0 = lo - pad; const d1 = hi + pad;
    const pct = (v) => `${Math.max(0, Math.min(100, ((v - d0) / (d1 - d0)) * 100))}%`;
    const width = (a, b) => `${Math.max(1.5, ((b - a) / (d1 - d0)) * 100)}%`;
    const barRow = document.createElement('tr');
    barRow.className = 'v-bar-row';
    const barCell = document.createElement('td');
    barCell.colSpan = 4;
    const track = document.createElement('div');
    track.className = 'rv-track';
    const band = document.createElement('div');
    band.className = 'rv-target';
    band.style.left = pct(target.min); band.style.width = width(target.min, target.max);
    const bar = document.createElement('div');
    bar.className = `rv-bar ${passes ? 'pass' : 'fail'}`;
    bar.style.left = pct(range.min); bar.style.width = width(range.min, range.max);
    track.append(band, bar);
    barCell.append(track);
    barRow.append(barCell);
    tbody.append(barRow);
  });
  const legend = document.createElement('tr');
  legend.className = 'v-legend';
  const lc = document.createElement('td');
  lc.colSpan = 4;
  lc.textContent = 'Pale band: what you need. Dark bar: what this build gives, from the weakest to the strongest end of this delivery.';
  legend.append(lc);
  tbody.append(legend);
  $('verdict-next').textContent = result.winner
    ? 'Next: copy the build, or download it below.'
    : 'Next: follow the change in the headline — or ask about this delivery below.';
}

function renderRangeView(result) {
  const wrap = $('range-view');
  wrap.replaceChildren();
  if (!result.ready || !result.current) return;
  const item = result.winner || result.current;
  const title = document.createElement('p');
  title.className = 'rv-title';
  title.textContent = result.winner
    ? 'The build above, against each requirement'
    : 'Your current build, against each requirement';
  wrap.append(title);
  result.targets.forEach((target, i) => {
    const meta = propertyMeta(target.property);
    const range = item.ranges[i];
    const passes = range.min >= target.min - 1e-9 && range.max <= target.max + 1e-9;
    const lo = Math.min(target.min, range.min);
    const hi = Math.max(target.max, range.max);
    const pad = (hi - lo) * 0.18 || Math.abs(hi) * 0.1 || 1;
    const d0 = lo - pad;
    const d1 = hi + pad;
    const pct = (v) => `${Math.max(0, Math.min(100, ((v - d0) / (d1 - d0)) * 100))}%`;
    const width = (a, b) => `${Math.max(1.5, ((b - a) / (d1 - d0)) * 100)}%`;

    const row = document.createElement('div');
    row.className = 'rv-row';
    const head = document.createElement('div');
    head.className = 'rv-head';
    const name = document.createElement('span');
    name.className = 'rv-name';
    name.textContent = `${meta.label} — ${meta.verb} ${formatRange(range, meta.unit)}; needs ${formatTarget(target)}`;
    const margin = document.createElement('span');
    margin.className = `rv-margin ${passes ? 'pass' : 'fail'}`;
    if (passes) {
      const lowMargin = range.min - target.min;
      const highMargin = target.max - range.max;
      const atLow = lowMargin <= highMargin;
      margin.textContent = `closest margin ${fmtVal(Math.min(lowMargin, highMargin), meta.unit)} at the ${atLow ? 'low' : 'high'} end`;
    } else if (range.min < target.min && range.max > target.max) {
      margin.textContent = `${fmtVal(target.min - range.min, meta.unit)} short at the low end, ${fmtVal(range.max - target.max, meta.unit)} over at the high end`;
    } else if (range.min < target.min) {
      margin.textContent = `${fmtVal(target.min - range.min, meta.unit)} short at the low end`;
    } else {
      margin.textContent = `${fmtVal(range.max - target.max, meta.unit)} over at the high end`;
    }
    head.append(name, margin);
    const track = document.createElement('div');
    track.className = 'rv-track';
    const band = document.createElement('div');
    band.className = 'rv-target';
    band.style.left = pct(target.min);
    band.style.width = width(target.min, target.max);
    const bar = document.createElement('div');
    bar.className = `rv-bar ${passes ? 'pass' : 'fail'}`;
    bar.style.left = pct(range.min);
    bar.style.width = width(range.min, range.max);
    track.append(band, bar);
    const scale = document.createElement('div');
    scale.className = 'rv-scale';
    const s0 = document.createElement('span');
    s0.textContent = fmtVal(d0, meta.unit);
    const s1 = document.createElement('span');
    s1.textContent = fmtVal(d1, meta.unit);
    scale.append(s0, s1);
    row.append(head, track, scale);
    wrap.append(row);
  });
  const legend = document.createElement('p');
  legend.className = 'rv-legend';
  legend.textContent = 'Pale band: what you need. Dark bar: what this build gives, from the weakest to the strongest end of this delivery.';
  wrap.append(legend);
}

function renderRunNote(result) {
  const note = $('run-note');
  if (!result.ready || !result.winner || !(runSize > 0)) {
    note.textContent = '';
    return;
  }
  const winner = result.winner;
  const totalKg = (winner.addedG * runSize) / 1000;
  if (winner.move === 'blend') {
    const pct = Math.round(winner.fraction * 100);
    note.textContent = `At ${runSize.toLocaleString('en-US')} parts, that blend uses ${fmtVal(totalKg, 'kg')} of ${state.steady.type || 'the steadier stream'} (${pct}% of every part).`;
  } else if (Math.abs(winner.addedG) < 0.5) {
    note.textContent = `At ${runSize.toLocaleString('en-US')} parts, this build uses the same material a part as the one you entered.`;
  } else if (winner.addedG > 0) {
    note.textContent = `At ${runSize.toLocaleString('en-US')} parts, that is ${fmtVal(totalKg, 'kg')} more material than your current build.`;
  } else {
    note.textContent = `At ${runSize.toLocaleString('en-US')} parts, that saves ${fmtVal(Math.abs(totalKg), 'kg')} against your current build.`;
  }
}

function renderDecisionBar(result, decision) {
  const bar = $('decision-bar');
  if (!result.ready || !decision.button) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  $('decision-dot').className = `decision-dot ${result.winner ? 'pass' : 'fail'}`;
  $('decision-bar-text').textContent = modelState === 'loading'
    ? `${decision.headline} — asking the model for sizes…`
    : decision.headline;
  const action = $('decision-bar-action');
  action.textContent = decision.button;
}

function renderStatus(result) {
  const status = $('model-status');
  if (modelState === 'idle') {
    status.textContent = '';
    return;
  }
  if (modelState === 'loading') {
    status.textContent = 'The model is suggesting sizes…';
    return;
  }
  if (modelState === 'meta') {
    status.textContent = `${modelProposals.length} suggested moves. ${result.passingCount} build${result.passingCount === 1 ? '' : 's'} pass.${metaSourceText()}`;
    return;
  }
  if (modelState === 'local') {
    status.textContent = 'Model is off in Settings. The calculated build stands.';
    return;
  }
  if (modelState === 'empty') {
    status.textContent = `The model returned no usable moves. The calculated build stands.${metaSourceText()}`;
    return;
  }
  status.textContent = 'The model is unavailable. The calculated build stands.';
}

function render(result) {
  lastResult = result;
  const decision = decisionFor(result.state, result);
  lastDecision = decision;
  const primary = $('primary');
  primary.hidden = !decision.button;
  primary.textContent = decision.button || '';
  primary.dataset.mode = decision.button === 'Copy build' ? 'copy' : 'ask';
  $('builds-panel').hidden = !result.ready;
  $('gap').hidden = !result.ready;
  $('ask-panel').hidden = !result.ready;
  renderProgress(result);
  renderDecisionBar(result, decision);
  $('see-details').hidden = !result.ready;
  $('downloads').hidden = !result.ready;
  fade([$('decision'), $('support')], () => {
    $('decision').textContent = decision.headline;
    $('support').textContent = decision.support;
  });
  if (!result.ready) {
    $('verdict').hidden = true;
    $('gap-title').hidden = true;
    $('build-list').replaceChildren();
    $('range-view').replaceChildren();
    $('run-note').textContent = '';
    $('empty-build').hidden = true;
    $('model-status').textContent = '';
    $('meta-trace').hidden = true;
    $('live').textContent = decision.headline;
    return;
  }
  renderVerdict(result, decision);
  fade([$('build-list'), $('gap')], () => {
    renderRunNote(result);
    renderBuildList(result);
    renderGap(result);
    renderTrace(result);
    renderStatus(result);
  });
  $('live').textContent = `${decision.headline} ${decision.support}`;
}

function refresh({ model = true } = {}) {
  const ready = isReady(state);
  if (model) {
    window.clearTimeout(modelTimer);
    modelProposals = [];
    modelState = ready ? 'loading' : 'idle';
    if (ready) modelTimer = window.setTimeout(fetchProposals, 850);
  }
  const result = evaluateBuilds(state, modelProposals);
  render(result);
  return result;
}

function onFieldChange() {
  refresh({ model: true });
  clearAdvice();
}

function setNumeric(path, value) {
  const parts = path.split('.');
  let target = state;
  for (let i = 0; i < parts.length - 1; i++) target = target[parts[i]];
  target[parts[parts.length - 1]] = value;
}

function bind(id, path, { number = false } = {}) {
  $(id).addEventListener('input', (event) => {
    let value = event.target.value;
    if (id === 'target-min' || id === 'target-max') {
      const meta = PROPERTIES.find((item) => item.key === state.target.property) || PROPERTIES[0];
      const n = Number(String(value).replace(/,/g, ''));
      if (value !== '' && Number.isFinite(n)) value = convertFromDisplay(n, meta.unit);
    } else {
      value = parsedValue(id, value);
    }
    setNumeric(path, value);
    onFieldChange();
  });
}

function bindSelect(id, path, after = null) {
  $(id).addEventListener('change', (event) => {
    setNumeric(path, event.target.value);
    if (after) after();
    onFieldChange();
  });
}

// ---------------------------------------------------------------------------
// Model proposals
// ---------------------------------------------------------------------------
async function fetchProposals() {
  if (!isReady(state)) return;
  if (modelOff()) {
    modelProposals = [];
    modelState = 'local';
    metaSource = null;
    render(evaluateBuilds(state, []));
    return;
  }
  const seq = ++modelSeq;
  const payload = toApiPayload(state);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${API_BASE}/api/product/proposals`, {
      method: 'POST',
      headers: metaHeaders(),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await response.json();
    if (seq !== modelSeq) return;
    if (!response.ok) throw new Error('proposal request failed');
    const proposals = Array.isArray(data.proposals) ? data.proposals : [];
    const fallback = Boolean(data._meta && data._meta.fallback);
    if (fallback) {
      modelProposals = [];
      modelState = 'offline';
      metaSource = { kind: 'offline', model: data._model || '' };
    } else {
      modelProposals = proposals;
      modelState = proposals.length ? 'meta' : 'empty';
      metaSource = data._cached
        ? { kind: 'cached', model: data._model || '' }
        : { kind: 'live', model: data._model || '' };
    }
    // One informed second round: if the checker rejected the model's exact
    // proposals and any did not pass at that size, show Spark the checked
    // ranges and let it propose different parameters once.
    feedbackRound = false;
    if (!fallback && modelProposals.length) {
      const checked = evaluateBuilds(state, modelProposals);
      const failed = (checked.modelTrace || []).filter((item) => !item.pass);
      if (failed.length) {
        try {
          const feedback = failed.map((item) => ({
            move: item.move === 'other' ? 'other_product' : item.move,
            ranges: item.ranges.map((range, i) => ({
              property: checked.targets[i].property,
              min: range.min,
              max: range.max,
              unit: range.unit,
            })),
          }));
          const second = await fetch(`${API_BASE}/api/product/proposals`, {
            method: 'POST',
            headers: metaHeaders(),
            body: JSON.stringify({ ...payload, verifier_feedback: feedback }),
            signal: controller.signal,
          });
          const secondData = await second.json();
          if (seq !== modelSeq) return;
          const secondProposals = Array.isArray(secondData.proposals) ? secondData.proposals : [];
          const secondFallback = Boolean(secondData._meta && secondData._meta.fallback);
          if (second.ok && !secondFallback && secondProposals.length) {
            const seen = new Set(modelProposals.map((p) => JSON.stringify(p)));
            for (const proposal of secondProposals) {
              if (!seen.has(JSON.stringify(proposal))) modelProposals.push(proposal);
            }
            modelState = 'meta';
            metaSource = secondData._cached
              ? { kind: 'cached', model: secondData._model || '' }
              : { kind: 'live', model: secondData._model || '' };
            feedbackRound = true;
          }
        } catch (error) {
          // The first round and the calculated build stand.
        }
      }
    }
    const result = evaluateBuilds(state, modelProposals);
    render(result);
  } catch (error) {
    if (seq !== modelSeq) return;
    modelProposals = [];
    modelState = 'offline';
    metaSource = { kind: 'offline', model: '' };
    const result = evaluateBuilds(state, []);
    render(result);
  } finally {
    window.clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Advice
// ---------------------------------------------------------------------------
function clearAdvice() {
  adviceSeq += 1;
  $('ask-status').textContent = '';
  $('ask-answer').replaceChildren();
}

async function askMeta() {
  if (!lastResult || !lastResult.ready) return;
  const input = $('ask-question');
  const question = (input.value.trim() || 'What should I add or change to make this batch work?').slice(0, 800);
  input.value = question;
  const result = lastResult || evaluateBuilds(state, modelProposals);
  const payload = advicePayload(state, result, question);
  const seq = ++adviceSeq;
  if (modelOff()) {
    $('ask-status').textContent = 'The model is off in Settings, so there is no answer from it. The plan above still applies.';
    return;
  }
  $('ask-status').textContent = 'Thinking…';
  $('ask-answer').replaceChildren();
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${API_BASE}/api/product/advice`, {
      method: 'POST',
      headers: metaHeaders(),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await response.json();
    if (seq !== adviceSeq) return;
    if (!data.available || !data.answer) {
      const reason = data._meta && data._meta.reason_code;
      if (reason === 'grounding_failed') {
        $('ask-status').textContent = 'The answer did not stay with the numbers here. The calculated plan still applies.';
      } else if (reason === 'test_instruction') {
        $('ask-status').textContent = 'The answer was not a make-or-change action. The calculated plan still applies.';
      } else {
        $('ask-status').textContent = 'The model is unavailable right now. The calculated plan still applies.';
      }
      return;
    }
    $('ask-status').textContent = '';
    const answer = document.createElement('p');
    answer.textContent = data.answer;
    $('ask-answer').append(answer);
    if (Array.isArray(data.actions) && data.actions.length) {
      const list = document.createElement('ul');
      for (const action of data.actions) {
        const li = document.createElement('li');
        li.textContent = action;
        list.append(li);
      }
      $('ask-answer').append(list);
    }
  } catch (error) {
    if (seq !== adviceSeq) return;
    $('ask-status').textContent = 'The model is unavailable right now. The calculated plan still applies.';
  } finally {
    window.clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------
function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  }
  return Promise.resolve(fallbackCopy(text));
}

function fallbackCopy(text) {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  try { document.execCommand('copy'); } catch (error) { /* no-op */ }
  area.remove();
}

function onPrimary() {
  if (!lastResult || !lastResult.ready) return;
  const primary = $('primary');
  if (primary.dataset.mode === 'ask') {
    askMeta();
    return;
  }
  if (!lastDecision) return;
  copyText(lastDecision.copy);
  window.clearTimeout(copyReset);
  primary.textContent = 'Copied';
  copyReset = window.setTimeout(() => { primary.textContent = lastDecision.button; }, 1500);
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------
setSelectOptions('mode', MODES.map((m) => ({ key: m.key, label: m.label })));
setSelectOptions('other-mode', MODES.map((m) => ({ key: m.key, label: m.label })));
for (const id of ['mode', 'other-mode']) {
  const choose = document.createElement('option');
  choose.value = '';
  choose.textContent = 'Choose…';
  $(id).prepend(choose);
}
setSelectOptions('property', PROPERTIES.map((p) => ({ key: p.key, label: `${p.label} (${p.unit})` })));
{
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = 'Choose a property';
  $('property').prepend(blank);
}
{
  const select = $('batch-source');
  select.replaceChildren();
  const first = document.createElement('option');
  first.value = '';
  first.textContent = 'Not set yet — pick one';
  select.append(first);
  for (const batch of PUBLISHED_BATCHES) {
    const option = document.createElement('option');
    option.value = batch.key;
    option.textContent = batch.label;
    select.append(option);
  }
  const own = document.createElement('option');
  own.value = 'numbers';
  own.textContent = 'I have numbers (supplier sheet or my own test)';
  select.append(own);
  select.addEventListener('change', () => applyBatchSource(select.value));
}
setSelectOptions('dirt-level', [
  { key: 'none', label: 'None' },
  { key: 'light', label: 'Light' },
  { key: 'moderate', label: 'Moderate' },
  { key: 'heavy', label: 'Heavy' },
]);

$('property').addEventListener('change', (event) => {
  const property = event.target.value;
  if (!property) {
    state.target = { property: '', min: '', max: '' };
    setValue('target-min', '');
    setValue('target-max', '');
  } else {
    state.target.property = property;
    const defaults = PROPERTY_DEFAULTS[property] || PROPERTY_DEFAULTS.strength;
    state.target.min = defaults.min;
    state.target.max = defaults.max;
    setValue('target-min', defaults.min);
    setValue('target-max', defaults.max);
  }
  updateTargetLabels();
  onFieldChange();
});
$('steady-available').addEventListener('change', (event) => {
  state.steady.available = event.target.checked;
  updateSteadyVisibility();
  onFieldChange();
});
bind('product', 'product');
bind('span', 'spanMm');
bind('width', 'widthMm');
bind('thickness', 'thicknessMm');
bind('target-min', 'target.min');
bind('target-max', 'target.max');
bind('plastic-type', 'plastic.type');
bind('plastic-batch', 'plastic.batch');
bind('plastic-mix', 'plastic.mix');
bind('plastic-dirt', 'plastic.dirt');
bind('e-min', 'plastic.eMin');
bind('e-max', 'plastic.eMax');
bind('s-min', 'plastic.sMin');
bind('s-max', 'plastic.sMax');
bind('density', 'plastic.density');
bind('steady-type', 'steady.type');
bind('steady-e', 'steady.eMpa');
bind('steady-s', 'steady.sMpa');
bind('other-product', 'other.product');
bind('other-span', 'other.spanMm');
bind('other-width', 'other.widthMm');
bind('other-thickness', 'other.thicknessMm');
bindSelect('mode', 'mode');
bindSelect('other-mode', 'other.mode');
bindSelect('dirt-level', 'plastic.dirtLevel');
let voiceRecorder = null;
let voiceStream = null;
let voiceChunks = [];
let voiceBusy = false;

async function blobToWav(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext();
  const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  await audioContext.close();
  return encodeWav(decoded);
}

function encodeWav(buffer) {
  const channels = Math.min(2, buffer.numberOfChannels);
  const frames = buffer.length;
  const rate = 16000;
  const offline = new OfflineAudioContext(1, Math.ceil(frames * rate / buffer.sampleRate), rate);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start();
  return offline.startRendering().then((rendered) => {
    const samples = rendered.getChannelData(0);
    const out = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(out);
    const write = (offset, text) => {
      for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
    };
    write(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    write(8, 'WAVE');
    write(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    write(36, 'data');
    view.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Blob([out], { type: 'audio/wav' });
  });
}

function resetVoiceButton() {
  const button = $('brief-voice');
  button.textContent = 'Use your voice';
  button.classList.remove('is-recording');
  button.setAttribute('aria-pressed', 'false');
  button.disabled = false;
  voiceBusy = false;
  if (voiceStream) {
    for (const track of voiceStream.getTracks()) track.stop();
    voiceStream = null;
  }
}

async function sendVoice(blob) {
  $('brief-status').textContent = 'Writing down what you said…';
  const data = new FormData();
  data.append('audio', blob, 'brief.wav');
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(`${API_BASE}/api/voice/transcribe`, {
      method: 'POST',
      headers: metaHeaders(false),
      body: data,
      signal: controller.signal,
    });
    const result = await response.json();
    const transcript = (result.transcript || '').trim();
    if (!response.ok || !transcript) {
      $('brief-status').textContent = 'The voice could not be heard clearly. Try again, or type it.';
      return;
    }
    const field = $('brief');
    field.value = transcript;
    field.focus();
    field.setSelectionRange(0, 0);
    field.scrollTop = 0;
    $('brief-status').textContent = 'Heard it. Filling in the form…';
    await readBrief();
  } catch (error) {
    $('brief-status').textContent = 'Voice is unavailable. Type the description instead.';
  } finally {
    window.clearTimeout(timer);
    resetVoiceButton();
  }
}

async function toggleVoice() {
  const button = $('brief-voice');
  if (modelOff() && !(voiceRecorder && voiceRecorder.state === 'recording')) {
    $('brief-status').textContent = 'The model is off in Settings, so voice is off too. Type the description, or turn the model on in Settings.';
    return;
  }
  if (voiceRecorder && voiceRecorder.state === 'recording') {
    button.disabled = true;
    button.textContent = 'Reading voice…';
    voiceRecorder.stop();
    return;
  }
  if (voiceBusy) return;
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    $('brief-status').textContent = 'This browser cannot record audio. Type the description instead.';
    return;
  }
  voiceBusy = true;
  try {
    voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    voiceChunks = [];
    voiceRecorder = new MediaRecorder(voiceStream);
    voiceRecorder.addEventListener('dataavailable', (event) => {
      if (event.data && event.data.size) voiceChunks.push(event.data);
    });
    voiceRecorder.addEventListener('stop', async () => {
      const blob = new Blob(voiceChunks, { type: voiceRecorder.mimeType || 'audio/webm' });
      voiceRecorder = null;
      try {
        const wav = await blobToWav(blob);
        await sendVoice(wav);
      } catch (error) {
        $('brief-status').textContent = 'Could not use that recording. Type the description instead.';
        resetVoiceButton();
      }
    });
    voiceRecorder.start();
    button.textContent = 'Stop';
    button.classList.add('is-recording');
    button.setAttribute('aria-pressed', 'true');
    $('brief-status').textContent = 'Listening — describe the part out loud, then press Stop.';
  } catch (error) {
    $('brief-status').textContent = 'Microphone permission was not given. Type the description instead.';
    resetVoiceButton();
  }
}

function mapBriefToState(brief, originalText = '') {
  const source = brief && typeof brief === 'object' ? brief : {};
  const targets = Array.isArray(source.targets)
    ? source.targets.filter((target) => target && ['strength', 'stiffness', 'weight'].includes(target.property))
    : [];
  const plastic = source.plastic && typeof source.plastic === 'object' ? source.plastic : {};
  const steady = source.steady && typeof source.steady === 'object' ? source.steady : {};
  const normalized = normalizeState({
    blank: true,
    product: source.product || '',
    mode: source.mode || '',
    spanMm: source.span_mm ?? 0,
    widthMm: source.width_mm ?? 0,
    thicknessMm: source.thickness_mm ?? 0,
    target: targets[0] || { property: '', min: '', max: '' },
    extraTargets: targets.slice(1),
    plastic: {
      type: plastic.type ?? '',
      batch: plastic.batch ?? '',
      mix: plastic.mix ?? '',
      dirt: plastic.dirt ?? '',
      dirtLevel: plastic.dirt_level ?? 'none',
      eMin: plastic.stiffness_min_mpa ?? 0,
      eMax: plastic.stiffness_max_mpa ?? 0,
      sMin: plastic.strength_min_mpa ?? 0,
      sMax: plastic.strength_max_mpa ?? 0,
      density: plastic.density_g_cm3 ?? 0,
    },
    steady: {
      available: typeof steady.available === 'boolean' ? steady.available : false,
      type: steady.type ?? '',
      eMpa: steady.stiffness_mpa ?? 0,
      sMpa: steady.strength_mpa ?? 0,
    },
    other: state.other,
  });
  return applyPublishedIfMissing(normalized, originalText);
}

function applyPublishedIfMissing(normalized, originalText = '') {
  briefPublished = null;
  briefBatchChoiceNeeded = false;
  const plastic = normalized.plastic;
  const hasRanges = plastic.eMin > 0 && plastic.eMax > 0 && plastic.sMin > 0 && plastic.sMax > 0 && plastic.density > 0;
  if (hasRanges) return normalized;
  const pub = publishedBatchFor(`${plastic.type} ${plastic.batch} ${originalText}`);
  if (!pub) {
    // A plastic was named but no single published range describes it
    // (e.g. several kinds mixed). Say so instead of guessing one.
    briefBatchChoiceNeeded = Boolean(plastic.type || plastic.batch);
    return normalized;
  }
  briefPublished = pub;
  batchSource = pub.key;
  normalized.plastic = {
    ...plastic,
    type: plastic.type || pub.plastic.type,
    eMin: pub.plastic.eMin, eMax: pub.plastic.eMax,
    sMin: pub.plastic.sMin, sMax: pub.plastic.sMax,
    density: pub.plastic.density,
  };
  return normalized;
}

async function readBrief() {
  const field = $('brief');
  const text = field.value.trim();
  if (!text) {
    field.focus();
    $('brief-status').textContent = 'Describe the part, what it has to do, and this delivery.';
    return;
  }
  if (modelOff()) {
    $('brief-status').textContent = 'The model is off in Settings, so this won’t be filled in for you. Fill the fields below, pick an example, or turn the model on in Settings.';
    field.focus();
    return;
  }
  const button = $('brief-submit');
  button.disabled = true;
  $('brief-status').textContent = 'Filling in the form…';
  $('brief-status').classList.add('is-working');
  $('support').textContent = 'Filling in the form. This usually takes about ten seconds — you do not need to fill anything in while it works.';
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${API_BASE}/api/product/brief`, {
      method: 'POST',
      headers: metaHeaders(),
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok || !data.available || !data.brief) {
      $('brief-status').textContent = 'That description could not be filled in. Try again, or fill the fields below.';
      render(evaluateBuilds(state, modelProposals));
      return;
    }
    state = mapBriefToState(data.brief, text);
    paint();
    refresh();
    field.setSelectionRange(0, 0);
    field.scrollTop = 0;
    const filledTargets = [state.target, ...state.extraTargets]
      .filter((t) => t.property && t.min !== '' && t.max !== '' && Number.isFinite(Number(t.min)) && Number.isFinite(Number(t.max)));
    const sourcePlain = data._cached
      ? 'That was a saved answer from an earlier call.'
      : 'That answer just came in.';
    let status = 'Done — the part is in the form.';
    if (!filledTargets.length) {
      status += ' No result yet: your description did not say what it has to do. Add that below — how much it has to carry, how stiff it has to be, or how much it may weigh.';
    }
    if (briefBatchChoiceNeeded) {
      status += ' This delivery names more than one kind of plastic, so no range was chosen for it. Pick the closest one under “This delivery”, or enter your supplier’s numbers.';
    } else if (briefPublished) {
      status += ` For this delivery, the published range “${briefPublished.label}” was used — that is a published range, not a measurement of this delivery. Change it under “This delivery” if your supplier’s numbers differ.`;
    }
    status += ` ${sourcePlain}`;
    $('brief-status').textContent = status;
  } catch (error) {
    $('brief-status').textContent = 'The model is unavailable. Fill the fields below; the checker on this page still works.';
    render(evaluateBuilds(state, modelProposals));
  } finally {
    $('brief-status').classList.remove('is-working');
    button.disabled = false;
    window.clearTimeout(timer);
  }
}

function applyCase(name) {
  if (name === 'custom') {
    batchSource = '';
    state = normalizeState({ blank: true });
    paint();
    refresh();
    $('product').focus();
    $('product').select();
    return;
  }
  const preset = CASE_PRESETS[name];
  if (!preset) return;
  batchSource = 'numbers';
  state = normalizeState({
    ...state,
    product: preset.product,
    mode: preset.mode,
    spanMm: preset.spanMm,
    widthMm: preset.widthMm,
    thicknessMm: preset.thicknessMm,
    target: { ...preset.target },
    extraTargets: preset.extraTargets.map((target) => ({ ...target })),
    plastic: preset.plastic ? { ...state.plastic, ...preset.plastic } : { ...DEFAULT_STATE.plastic },
    steady: preset.steady ? { ...state.steady, ...preset.steady } : { ...DEFAULT_STATE.steady },
  });
  paint();
  refresh();
  closeDetails();
}

function addTarget() {
  const used = new Set([state.target.property, ...state.extraTargets.map((target) => target.property)]);
  const property = ['strength', 'stiffness', 'weight'].find((candidate) => !used.has(candidate)) || 'weight';
  const defaults = PROPERTY_DEFAULTS[property] || PROPERTY_DEFAULTS.strength;
  state.extraTargets.push({ property, min: defaults.min, max: defaults.max });
  renderExtraTargets();
  onFieldChange();
}

$('brief-submit').addEventListener('click', readBrief);
$('brief-voice').addEventListener('click', toggleVoice);
$('brief-sample').addEventListener('click', () => {
  const field = $('brief');
  field.value = SAMPLE_BRIEF;
  field.focus();
  field.setSelectionRange(0, 0);
  field.scrollTop = 0;
  readBrief();
});
$('brief').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    readBrief();
  }
});
for (const id of ['e-min', 'e-max', 's-min', 's-max', 'density']) {
  $(id).addEventListener('input', () => {
    if (batchSource !== 'numbers') {
      batchSource = 'numbers';
      syncBatchSourceUI();
    }
  });
}
for (const button of $$('.case')) button.addEventListener('click', () => applyCase(button.dataset.case));
$('add-target').addEventListener('click', addTarget);
$('primary').addEventListener('click', onPrimary);
$('decision-bar-action').addEventListener('click', onPrimary);
$('run-size').addEventListener('input', (event) => {
  const parsed = Number(String(event.target.value).replace(/[^0-9]/g, ''));
  runSize = Number.isFinite(parsed) ? parsed : 0;
  if (lastResult) renderRunNote(lastResult);
});
$('ask-button').addEventListener('click', askMeta);
$('ask-question').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    askMeta();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeDetails();
});
function closeDetails() {
  $$('details[open]').forEach((details) => { details.open = false; });
}


// ---------------------------------------------------------------------------
// Downloads, settings, units
// ---------------------------------------------------------------------------
function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function resultsCsv(result) {
  const rows = [['Requirement', 'Needs low', 'Needs high', 'Unit', 'Build low', 'Build high', 'Inside']];
  const item = result.winner || result.current;
  result.targets.forEach((target, i) => {
    const meta = propertyMeta(target.property);
    const range = item.ranges[i];
    rows.push([
      meta.label,
      Math.round(convertForDisplay(target.min, meta.unit) * 1000) / 1000,
      Math.round(convertForDisplay(target.max, meta.unit) * 1000) / 1000,
      displayUnit(meta.unit),
      Math.round(convertForDisplay(range.min, meta.unit) * 1000) / 1000,
      Math.round(convertForDisplay(range.max, meta.unit) * 1000) / 1000,
      range.min >= target.min - 1e-9 && range.max <= target.max + 1e-9 ? 'yes' : 'no',
    ]);
  });
  rows.push([]);
  rows.push(['Build', 'From', 'Size', 'Ranges', 'Material a part']);
  for (const build of result.passingBest) {
    const row = proposalRow(result.state, build);
    rows.push([row.move, row.originLabel, row.size, row.property, row.added]);
  }
  if (!result.passingBest.length && result.gaps) {
    rows.push([]);
    rows.push(['Gap', 'Needs', 'This delivery gives']);
    for (const gap of result.gaps) rows.push([gap.property, formatRange(gap.required, gap.unit), formatRange(gap.batch, gap.unit)]);
  }
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}

function resultsJson(result) {
  const clean = (build) => build ? {
    move: build.move,
    from: proposalRow(result.state, build).originLabel,
    size: build.part,
    ranges: build.ranges,
    material_a_part_g: Math.round(build.addedG * 10) / 10,
  } : null;
  return JSON.stringify({
    exportedFrom: 'AnyRB page',
    units: 'metric (mm, kg, g, N/mm, MPa, g/cm3) — the page converts for display; this file does not',
    part: { product: state.product, mode: state.mode, spanMm: state.spanMm, widthMm: state.widthMm, thicknessMm: state.thicknessMm },
    targets: result.targets,
    delivery: { type: state.plastic.type, stiffnessMpa: [state.plastic.eMin, state.plastic.eMax], strengthMpa: [state.plastic.sMin, state.plastic.sMax], density: state.plastic.density },
    decision: lastDecision ? lastDecision.headline : '',
    currentBuild: clean(result.current),
    winningBuild: clean(result.winner),
    passingBuilds: result.passingBest.map(clean),
  }, null, 2);
}

$('dl-txt').addEventListener('click', () => {
  if (!lastResult || !lastDecision) return;
  downloadFile('anyrb-build.txt', `${lastDecision.copy}\n`, 'text/plain');
});
$('dl-csv').addEventListener('click', () => {
  if (!lastResult) return;
  downloadFile('anyrb-results.csv', resultsCsv(lastResult), 'text/csv');
});
$('dl-json').addEventListener('click', () => {
  if (!lastResult) return;
  downloadFile('anyrb-results.json', resultsJson(lastResult), 'application/json');
});

const FIELD_LABELS = {
  span: 'Span', width: 'Width', thickness: 'Thickness',
  'other-span': 'Span', 'other-width': 'Width', 'other-thickness': 'Thickness',
  'e-min': 'Stiffness low', 'e-max': 'Stiffness high', 's-min': 'Strength low', 's-max': 'Strength high',
  density: 'Density', 'steady-e': 'Its stiffness', 'steady-s': 'Its strength',
};
function updateUnitLabels() {
  for (const [id, label] of Object.entries(FIELD_LABELS)) {
    const el = document.querySelector(`label[for="${id}"]`);
    if (el) el.textContent = `${label} (${displayUnit(FIELD_UNITS[id])})`;
  }
  const currentProperty = $('property').value;
  setSelectOptions('property', PROPERTIES.map((item) => ({ key: item.key, label: `${item.label} (${displayUnit(item.unit)})` })));
  $('property').value = currentProperty || state.target.property;
  updateTargetLabels();
}
function syncUnitButtons() {
  $('unit-metric').classList.toggle('is-active', settings.units === 'metric');
  $('unit-imperial').classList.toggle('is-active', settings.units === 'imperial');
  $('unit-metric').setAttribute('aria-pressed', String(settings.units === 'metric'));
  $('unit-imperial').setAttribute('aria-pressed', String(settings.units === 'imperial'));
}
function applyUnits(system) {
  settings.units = system === 'imperial' ? 'imperial' : 'metric';
  localStorage.setItem('anyrb.units', settings.units);
  setUnitSystem(settings.units);
  syncUnitButtons();
  updateUnitLabels();
  paint();
  refresh({ model: false });
}
$('unit-metric').addEventListener('click', () => applyUnits('metric'));
$('unit-imperial').addEventListener('click', () => applyUnits('imperial'));

$('settings-open').addEventListener('click', () => {
  $('set-provider').value = settings.provider;
  $('set-model').value = settings.model;
  $('set-key').value = '';
  $('set-key').placeholder = userKey ? 'Your key is saved for this tab' : 'Paste your own key';
  $('settings-dialog').showModal();
});
$('set-cancel').addEventListener('click', () => $('settings-dialog').close());
$('set-clear-key').addEventListener('click', () => {
  userKey = '';
  sessionStorage.removeItem('anyrb.key');
  $('set-key').value = '';
  $('set-key').placeholder = 'Paste your own key';
  $('key-note').textContent = 'Your key was removed from this tab.';
});
$('settings-form').addEventListener('submit', (event) => {
  event.preventDefault();
  settings.provider = $('set-provider').value;
  settings.model = $('set-model').value;
  localStorage.setItem('anyrb.provider', settings.provider);
  localStorage.setItem('anyrb.model', settings.model);
  const entered = $('set-key').value.trim();
  if (entered) {
    userKey = entered;
    sessionStorage.setItem('anyrb.key', userKey);
  }
  $('settings-dialog').close();
  syncBriefHelp();
  refresh();
});
syncUnitButtons();
updateUnitLabels();
syncBriefHelp();

paint();
const initial = evaluateBuilds(state, []);
render(initial);
if (isReady(state)) fetchProposals();

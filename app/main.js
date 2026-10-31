import {
  DEFAULT_STATE,
  MODES,
  PROPERTIES,
  PROPERTY_DEFAULTS,
  CASE_PRESETS,
  advicePayload,
  propertyMeta,
  blendCandidate,
  buildSizeText,
  decisionFor,
  evaluateBuilds,
  isReady,
  materialGap,
  normalizeState,
  proposalRow,
  toApiPayload,
} from './product.js';

const $ = (id) => document.getElementById(id);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const API_BASE = location.protocol === 'file:' ? 'http://127.0.0.1:8787' : '';

let state = normalizeState(DEFAULT_STATE);
let modelProposals = [];
let modelState = 'loading';
let modelSeq = 0;
let modelTimer = 0;
let adviceSeq = 0;
let lastResult = null;
let lastDecision = null;
let copyReset = 0;

const SAMPLE_BRIEF = 'I make a 400 mm crate side, 60 mm wide and 15 mm thick, simply supported. It must have a load capacity of 95–115 kg (strength requirement) and a weight of 320–360 g (weight requirement). My batch is a published measured rHDPE range: 380–1,250 MPa stiffness, 41.6–48.4 MPa strength, density 0.94.';



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
  $('target-min-label').textContent = meta ? `Low (${meta.unit})` : 'Low';
  $('target-max-label').textContent = meta ? `High (${meta.unit})` : 'High';
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
      option.textContent = `${item.label} (${item.unit})`;
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
    lowLabel.textContent = `Low (${targetUnit(target.property)})`;
    const low = document.createElement('input');
    low.type = 'text';
    low.inputMode = 'decimal';
    low.value = target.min == null ? '' : String(target.min);
    low.addEventListener('input', () => {
      state.extraTargets[index].min = low.value;
      onFieldChange();
    });
    lowField.append(lowLabel, low);

    const highField = document.createElement('div');
    highField.className = 'field';
    const highLabel = document.createElement('label');
    highLabel.textContent = `High (${targetUnit(target.property)})`;
    const high = document.createElement('input');
    high.type = 'text';
    high.inputMode = 'decimal';
    high.value = target.max == null ? '' : String(target.max);
    high.addEventListener('input', () => {
      state.extraTargets[index].max = high.value;
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
  setValue('span', state.spanMm || '');
  setValue('width', state.widthMm || '');
  setValue('thickness', state.thicknessMm || '');
  $('property').value = state.target.property;
  setValue('target-min', state.target.min || '');
  setValue('target-max', state.target.max || '');
  setValue('plastic-type', state.plastic.type);
  setValue('plastic-batch', state.plastic.batch);
  setValue('plastic-mix', state.plastic.mix);
  $('dirt-level').value = state.plastic.dirtLevel;
  setValue('plastic-dirt', state.plastic.dirt);
  setValue('e-min', state.plastic.eMin || '');
  setValue('e-max', state.plastic.eMax || '');
  setValue('s-min', state.plastic.sMin || '');
  setValue('s-max', state.plastic.sMax || '');
  setValue('density', state.plastic.density || '');
  $('steady-available').checked = state.steady.available;
  setValue('steady-type', state.steady.type);
  setValue('steady-e', state.steady.eMpa || '');
  setValue('steady-s', state.steady.sMpa || '');
  setValue('other-product', state.other.product);
  $('other-mode').value = state.other.mode;
  setValue('other-span', state.other.spanMm);
  setValue('other-width', state.other.widthMm);
  setValue('other-thickness', state.other.thicknessMm);
  updateTargetLabels();
  updateSteadyVisibility();
  renderExtraTargets();
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
      least.textContent = 'least build mass';
      move.append(least);
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
    head.textContent = 'This delivery swings too wide for at least one target.';
  } else {
    const short = primary.shortLow > 0
      ? `${primary.shortLow.toFixed(primary.shortLow >= 10 ? 0 : 1)} ${primary.unit} short at the low end`
      : `${primary.overHigh.toFixed(primary.overHigh >= 10 ? 0 : 1)} ${primary.unit} over at the high end`;
    head.textContent = `This delivery is ${short}.`;
  }
  gap.append(head);
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
  head.textContent = `Muse Spark proposed ${items.length} move${items.length === 1 ? '' : 's'}. The verifier accepted ${accepted} exactly and rejected ${rejected}.`;
  trace.append(head);
  for (const item of items.slice(0, 5)) {
    const row = proposalRow(result.state, { ...item, addedG: 0, range: item.ranges[0] });
    const line = document.createElement('div');
    line.className = 'trace-row';
    const state = document.createElement('span');
    state.className = `trace-state ${item.pass ? 'accepted' : 'rejected'}`;
    state.textContent = item.pass ? 'accepted' : 'rejected';
    const text = document.createElement('span');
    text.className = 'trace-text';
    text.textContent = `${row.move} · ${row.size} · ${row.property}`;
    line.append(state, text);
    trace.append(line);
  }
  const note = document.createElement('p');
  note.className = 'trace-note';
  note.textContent = rejected
    ? 'Rejected moves were handed to the mechanics search; the passing builds above are the verifier’s result.'
    : 'The exact Muse Spark proposals were checked before the mechanics search.';
  trace.append(note);
}

function formatRange(range, unit) {
  const a = Number(range.min).toLocaleString('en-US', { maximumFractionDigits: 1 });
  const b = Number(range.max).toLocaleString('en-US', { maximumFractionDigits: 1 });
  return `${a}–${b} ${unit}`;
}

function renderStatus(result) {
  const status = $('model-status');
  if (modelState === 'idle') {
    status.textContent = '';
    return;
  }
  if (modelState === 'loading') {
    status.textContent = 'Muse Spark is proposing moves…';
    return;
  }
  if (modelState === 'meta') {
    status.textContent = `${modelProposals.length} moves from Muse Spark. ${result.passingCount} build${result.passingCount === 1 ? '' : 's'} pass.`;
    return;
  }
  if (modelState === 'empty') {
    status.textContent = 'Muse Spark returned no usable moves. The calculated build stands.';
    return;
  }
  status.textContent = 'Muse Spark is unavailable. The calculated build stands.';
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
  fade([$('decision'), $('support')], () => {
    $('decision').textContent = decision.headline;
    $('support').textContent = decision.support;
  });
  if (!result.ready) {
    $('build-list').replaceChildren();
    $('empty-build').hidden = true;
    $('model-status').textContent = '';
    $('meta-trace').hidden = true;
    $('live').textContent = decision.headline;
    return;
  }
  fade([$('build-list'), $('gap')], () => {
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
    setNumeric(path, number ? event.target.value : event.target.value);
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
  const seq = ++modelSeq;
  const payload = toApiPayload(state);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${API_BASE}/api/product/proposals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    } else {
      modelProposals = proposals;
      modelState = proposals.length ? 'meta' : 'empty';
    }
    const result = evaluateBuilds(state, modelProposals);
    render(result);
  } catch (error) {
    if (seq !== modelSeq) return;
    modelProposals = [];
    modelState = 'offline';
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
  $('ask-status').textContent = 'Muse Spark is thinking…';
  $('ask-answer').replaceChildren();
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${API_BASE}/api/product/advice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await response.json();
    if (seq !== adviceSeq) return;
    if (!data.available || !data.answer) {
      const reason = data._meta && data._meta.reason_code;
      if (reason === 'grounding_failed') {
        $('ask-status').textContent = 'Muse Spark’s answer did not stay with the numbers here. The calculated plan still applies.';
      } else if (reason === 'test_instruction') {
        $('ask-status').textContent = 'Muse Spark’s answer was not a make-or-change action. The calculated plan still applies.';
      } else {
        $('ask-status').textContent = 'Muse Spark is unavailable right now. The calculated plan still applies.';
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
    $('ask-status').textContent = 'Muse Spark is unavailable right now. The calculated plan still applies.';
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
setSelectOptions('property', PROPERTIES.map((p) => ({ key: p.key, label: `${p.label} (${p.unit})` })));
{
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = 'Choose a property';
  $('property').prepend(blank);
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
function mapBriefToState(brief) {
  const source = brief && typeof brief === 'object' ? brief : {};
  const targets = Array.isArray(source.targets)
    ? source.targets.filter((target) => target && ['strength', 'stiffness', 'weight'].includes(target.property))
    : [];
  const plastic = source.plastic && typeof source.plastic === 'object' ? source.plastic : {};
  const steady = source.steady && typeof source.steady === 'object' ? source.steady : {};
  return normalizeState({
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
}

async function readBrief() {
  const field = $('brief');
  const text = field.value.trim();
  if (!text) {
    field.focus();
    $('brief-status').textContent = 'Describe the part, the properties that must hold, and this delivery.';
    return;
  }
  const button = $('brief-submit');
  button.disabled = true;
  $('brief-status').textContent = 'Muse Spark is reading the brief…';
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${API_BASE}/api/product/brief`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok || !data.available || !data.brief) {
      $('brief-status').textContent = 'Muse Spark could not read that brief. Fill the fields below, or try again.';
      return;
    }
    state = mapBriefToState(data.brief);
    paint();
    refresh();
    field.setSelectionRange(0, 0);
    field.scrollTop = 0;
    const targetCount = 1 + state.extraTargets.length;
    $('brief-status').textContent = `Muse Spark read ${state.product || 'the part'} and ${targetCount} requirement${targetCount === 1 ? '' : 's'}. Check the fields; anything not stated remains yours to fill.`;
  } catch (error) {
    $('brief-status').textContent = 'Muse Spark is unavailable. Fill the fields below; the local mechanics still works.';
  } finally {
    button.disabled = false;
    window.clearTimeout(timer);
  }
}

function applyCase(name) {
  if (name === 'custom') {
    state = normalizeState({
      ...DEFAULT_STATE,
      plastic: state.plastic,
      steady: state.steady,
      other: state.other,
    });
    paint();
    refresh();
    $('product').focus();
    $('product').select();
    return;
  }
  const preset = CASE_PRESETS[name];
  if (!preset) return;
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
for (const button of $$('.case')) button.addEventListener('click', () => applyCase(button.dataset.case));
$('add-target').addEventListener('click', addTarget);
$('primary').addEventListener('click', onPrimary);
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

paint();
const initial = evaluateBuilds(state, []);
render(initial);
if (isReady(state)) fetchProposals();

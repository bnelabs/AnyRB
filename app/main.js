import {
  DEFAULT_STATE,
  MODES,
  PROPERTIES,
  PROPERTY_DEFAULTS,
  advicePayload,
  blendCandidate,
  buildSizeText,
  decisionFor,
  evaluateBuilds,
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
  const meta = PROPERTIES.find((p) => p.key === state.target.property) || PROPERTIES[0];
  $('target-min-label').textContent = `Low (${meta.unit})`;
  $('target-max-label').textContent = `High (${meta.unit})`;
}

function updateSteadyVisibility() {
  $('steady-fields').hidden = !$('steady-available').checked;
}

function paint() {
  setValue('product', state.product);
  $('mode').value = state.mode;
  setValue('span', state.spanMm);
  setValue('width', state.widthMm);
  setValue('thickness', state.thicknessMm);
  $('property').value = state.target.property;
  setValue('target-min', state.target.min);
  setValue('target-max', state.target.max);
  setValue('plastic-type', state.plastic.type);
  setValue('plastic-batch', state.plastic.batch);
  setValue('plastic-mix', state.plastic.mix);
  $('dirt-level').value = state.plastic.dirtLevel;
  setValue('plastic-dirt', state.plastic.dirt);
  setValue('e-min', state.plastic.eMin);
  setValue('e-max', state.plastic.eMax);
  setValue('s-min', state.plastic.sMin);
  setValue('s-max', state.plastic.sMax);
  setValue('density', state.plastic.density);
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
    p.textContent = 'The low end of the range is above the high end. Check the range.';
    gap.append(p);
    return;
  }
  if (result.winner) {
    const needed = materialGap(result.state, result.winner.part);
    const p = document.createElement('p');
    const needText = `${formatRange(needed.required, needed.unit)}`;
    const batchText = `${formatRange(needed.batch, needed.unit)}`;
    if (result.winner.move === 'blend') {
      p.textContent = `The base delivery gives ${batchText}; this build needs ${needText}. ${Math.round(result.winner.fraction * 100)}% of ${result.state.steady.type || 'the steadier stream'} brings it into the window.`;
    } else {
      p.textContent = `This build needs ${needText}; your delivery gives ${batchText}. It fits.`;
    }
    gap.append(p);
    return;
  }
  if (!result.gap) return;
  const head = document.createElement('p');
  head.className = 'gap-head';
  if (result.gap.rangeTooWide) {
    head.textContent = 'This delivery swings too wide for the target.';
  } else {
    const short = result.gap.shortLow > 0
      ? `${result.gap.shortLow.toFixed(result.gap.shortLow >= 10 ? 0 : 1)} ${result.gap.unit} short at the low end`
      : `${result.gap.overHigh.toFixed(result.gap.overHigh >= 10 ? 0 : 1)} ${result.gap.unit} over at the high end`;
    head.textContent = `This delivery is ${short}.`;
  }
  const body = document.createElement('p');
  body.textContent = `At the current build, the range needs ${formatRange(result.gap.required, result.gap.unit)}; the delivery gives ${formatRange(result.gap.batch, result.gap.unit)}. ${result.gap.action}`;
  gap.append(head, body);
}

function formatRange(range, unit) {
  const a = Number(range.min).toLocaleString('en-US', { maximumFractionDigits: 1 });
  const b = Number(range.max).toLocaleString('en-US', { maximumFractionDigits: 1 });
  return `${a}–${b} ${unit}`;
}

function renderStatus(result) {
  const status = $('model-status');
  if (modelState === 'loading') {
    status.textContent = 'Meta is proposing moves…';
    return;
  }
  if (modelState === 'meta') {
    status.textContent = `${modelProposals.length} moves from Meta. ${result.passingCount} build${result.passingCount === 1 ? '' : 's'} pass.`;
    return;
  }
  if (modelState === 'empty') {
    status.textContent = 'Meta returned no usable moves. The calculated build stands.';
    return;
  }
  status.textContent = 'Meta is unavailable. The calculated build stands.';
}

function render(result) {
  lastResult = result;
  const decision = decisionFor(result.state, result);
  lastDecision = decision;
  fade([$('decision'), $('support')], () => {
    $('decision').textContent = decision.headline;
    $('support').textContent = decision.support;
    const primary = $('primary');
    primary.textContent = decision.button;
    primary.dataset.mode = decision.button === 'Copy build' ? 'copy' : 'ask';
  });
  fade([$('build-list'), $('gap')], () => {
    renderBuildList(result);
    renderGap(result);
    renderStatus(result);
  });
  $('live').textContent = `${decision.headline} ${decision.support}`;
}

function refresh({ model = true } = {}) {
  if (model) {
    modelState = 'loading';
    modelProposals = [];
  }
  const result = evaluateBuilds(state, modelProposals);
  render(result);
  if (model) {
    window.clearTimeout(modelTimer);
    modelTimer = window.setTimeout(fetchProposals, 850);
  }
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
  const input = $('ask-question');
  const question = (input.value.trim() || 'What should I add or change to make this batch work?').slice(0, 800);
  input.value = question;
  const result = lastResult || evaluateBuilds(state, modelProposals);
  const payload = advicePayload(state, result, question);
  const seq = ++adviceSeq;
  $('ask-status').textContent = 'Meta is thinking…';
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
        $('ask-status').textContent = 'Meta’s answer did not stay with the numbers here. The calculated plan still applies.';
      } else if (reason === 'test_instruction') {
        $('ask-status').textContent = 'Meta’s answer was not a make-or-change action. The calculated plan still applies.';
      } else {
        $('ask-status').textContent = 'Meta is unavailable right now. The calculated plan still applies.';
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
    $('ask-status').textContent = 'Meta is unavailable right now. The calculated plan still applies.';
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
setSelectOptions('dirt-level', [
  { key: 'none', label: 'None' },
  { key: 'light', label: 'Light' },
  { key: 'moderate', label: 'Moderate' },
  { key: 'heavy', label: 'Heavy' },
]);

$('property').addEventListener('change', (event) => {
  state.target.property = event.target.value;
  const defaults = PROPERTY_DEFAULTS[event.target.value] || PROPERTY_DEFAULTS.strength;
  state.target.min = defaults.min;
  state.target.max = defaults.max;
  setValue('target-min', defaults.min);
  setValue('target-max', defaults.max);
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
fetchProposals();

/**
 * AnyRB v0.3 — UI controller (review-response release).
 *
 * Three-step AI studio: 01 Brief → 02 Design → 03 Prove.
 * The verified engine (engine.js / optimize.js) does every number; the AI layer
 * (ai.js + aicore.js) proposes, parses and explains. Dev shell uses this ES
 * module; build.py inlines it into the standalone HTML.
 */

import {
  GEOMETRY, DEFAULTS, MATERIAL_PRESETS, OPTIMIZER, APP_META, V03, apiUrl,
} from './config.js';
import * as E from './engine.js';
import * as O from './optimize.js';
import { buildBinarySTL, stlFileName } from './stl.js';
import * as AC from './aicore.js';
import { createAIClient } from './ai.js';
import { PRODUCT_RENDER_DATA_URL, PRODUCT_RENDER_LABEL, PRODUCT_RENDER_MODEL } from './product_render.js';

// ---------------------------------------------------------------------------
// DOM + format helpers
// ---------------------------------------------------------------------------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = (x, d = 2) => (Number.isFinite(x) ? Number(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
const int = (x) => (Number.isFinite(x) ? Math.round(x).toLocaleString('en-US') : '—');
const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

function fmtPf(pf, d = 3) {
  if (!Number.isFinite(pf)) return '—';
  if (pf <= 0) return '0 %';
  const pct = pf * 100;
  if (pct < 0.001) return '< 0.001 %';
  if (pct < 0.01) return pct.toFixed(4) + ' %';
  if (pct < 1) return pct.toFixed(d) + ' %';
  return pct.toFixed(pct < 10 ? 2 : 1) + ' %';
}
const pctVal = (v, d = 2) => (Number.isFinite(v) ? (v * 100).toFixed(d) + ' %' : '—');
const signed = (v, d = 1) => (v >= 0 ? '+' : '') + nf(v, d);
const debounce = (fn, ms = 90) => { let t = 0; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = String(html).trim();
  return t.content.firstElementChild;
}
function highlightNumbers(text) {
  return esc(text).replace(/(?<![\w.])-?\d+(?:,\d{3})*(?:\.\d+)?\s?%?/g, (m) => `<b>${m}</b>`);
}
function toast(message, kind = '') {
  const region = $('#toast-region');
  if (!region) return;
  const t = el(`<div class="toast ${kind === 'err' ? 'is-err' : ''}" role="status">${esc(message)}</div>`);
  region.appendChild(t);
  requestAnimationFrame(() => t.classList.add('is-on'));
  setTimeout(() => { t.classList.remove('is-on'); setTimeout(() => t.remove(), 260); }, 2800);
}

const ICONS = {
  check: '<svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 10.5 4 4 8-9"/></svg>',
  chev: '<svg class="chev" width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 5 5 5-5 5"/></svg>',
  warn: '<svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3.5 18 16.5H2z"/><path d="M10 8v4M10 14.5v0"/></svg>',
};

// ---------------------------------------------------------------------------
// Demo switches (?mock=1 · ?state=loading|error|offline · ?screen= · ?smoke=1)
// ---------------------------------------------------------------------------
const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const demo = {
  mock: params.get('mock') === '1',
  state: params.get('state'),
  screen: params.get('screen'),
  smoke: params.get('smoke') === '1',
  forceOffline: params.get('state') === 'offline',
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = {
  project: 'rPETG wall bracket',
  step: 'brief',
  maxStep: 'brief',
  brief: AC.coerceBrief({
    partType: 'shelf bracket',
    loadN: 150,
    deflLimitMm: 2.5,
    targetPf: 0.01,
    process: 'FDM/FFF',
    preset: 'rPETG',
    notes: 'A wall bracket for a recycled PETG shelf unit. 150 N tip load, 2.5 mm max tip deflection, 1 % failure target across delivered lots.',
  }),
  briefMeta: { model: null, confidence: null, fallback: true, ms: 0 },
  lot: AC.presetLot('rPETG'),
  lotMeta: { model: 'Published data', confidence: 1, fallback: false },
  material: AC.materialFromLot(AC.presetLot('rPETG')),
  plan: null,
  planMeta: { model: null, fallback: true },
  candidates: [],
  hero: null,
  selectedId: 'optimised',
  comparison: null,
  optimized: null,
  proof: null,
  validation: AC.validationFallback(),
  view: 'geometry',
  lab: false,
  busy: false,
  passport: { e: 1, sy: 1, adapt: null },
  qc: { lotId: '', supplier: '', recycledPct: null, e: null, sy: null, cv: V03.measurementCvDefault * 100, mfi: null, density: null, tensileRow: '' },
  ai: null,
  aiMode: 'detecting',
  aiCalls: [],
};

const ai = createAIClient({ demo: { mock: demo.mock, forceOffline: demo.forceOffline } });
state.ai = ai;
ai.onChange((snap) => {
  state.aiCalls = snap.calls;
  state.aiMode = snap.mode;
  document.documentElement.setAttribute('data-anybatch-ai-mode', snap.mode);
  renderAIStatus(snap);
});

const ctx = () => O.makeContext({ F: state.brief.loadN, uLim: state.brief.deflLimitMm, rho: state.material.rho });
const selectedCandidate = () => {
  if (state.selectedId === 'optimised' && state.hero) return state.hero;
  return state.candidates.find((c) => c.id === state.selectedId) || state.hero || state.candidates[0] || null;
};

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
const DRAFT_KEY = 'anyrb.v2.draft';
function persist() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      project: state.project, step: state.step, maxStep: state.maxStep,
      brief: state.brief, briefMeta: state.briefMeta, lot: state.lot,
      lab: state.lab, selectedId: state.selectedId, view: state.view,
      savedAt: new Date().toISOString(),
    }));
  } catch (err) { /* private mode — silent */ }
}
function restoreDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d.project) state.project = String(d.project).slice(0, 60);
    if (d.brief) state.brief = AC.coerceBrief(d.brief, state.brief);
    if (d.briefMeta) state.briefMeta = d.briefMeta;
    if (d.lot && Number.isFinite(d.lot.E_mean)) { state.lot = d.lot; state.material = AC.materialFromLot(d.lot); }
    if (typeof d.lab === 'boolean') state.lab = d.lab;
    if (typeof d.view === 'string') state.view = d.view;
  } catch (err) { /* ignore corrupt draft */ }
}

// ---------------------------------------------------------------------------
// Top bar / AI status
// ---------------------------------------------------------------------------
function renderAIStatus(snap) {
  const mode = demo.forceOffline ? 'offline' : (snap ? snap.mode : state.aiMode);
  const pill = $('#ai-pill');
  const label = $('#ai-pill-label');
  if (!pill) return;
  pill.dataset.mode = mode;
  if (mode === 'live') label.textContent = 'Live · Meta models';
  else if (mode === 'mock') label.textContent = 'Demo · simulated AI';
  else label.textContent = 'Offline · built-in text';
  pill.setAttribute('aria-label', `AI status: ${label.textContent}. Open AI mode menu.`);
  const count = state.aiCalls.length;
  const provCount = $('#prov-count');
  if (provCount) provCount.textContent = `${count} request${count === 1 ? '' : 's'}`;
  const provSub = $('#ai-menu-prov-sub');
  if (provSub) provSub.textContent = `${count} request${count === 1 ? '' : 's'} · ${mode === 'offline' ? 'built-in text' : mode === 'mock' ? 'simulated AI' : 'live AI'}`;
  $$('#ai-menu [role="menuitemradio"]').forEach((b) => {
    b.setAttribute('aria-checked', b.dataset.mode === mode || (mode === 'mock' && b.dataset.mode === 'live') ? 'true' : 'false');
  });
  renderBanner();
  renderProvenance();
}
function renderBanner() {
  const banner = $('#banner');
  if (!banner) return;
  if (demo.state === 'error' && banner.dataset.dismissed !== '1') {
    banner.hidden = false;
    banner.dataset.kind = 'error';
    $('#banner-title').textContent = 'The AI service didn’t respond.';
    $('#banner-body').textContent = 'Your brief is safe. The calculator still runs, and the numbers will not change.';
    const actions = $('#banner-actions');
    if (!actions.childElementCount) {
      actions.innerHTML = '<button class="btn btn--sm" id="banner-retry" type="button">Retry AI</button><button class="btn btn--sm btn--ghost" id="banner-offline" type="button">Continue offline</button>';
      $('#banner-retry')?.addEventListener('click', () => { demo.state = null; ai.detect().then(() => toast('Retrying AI connection…')); });
      $('#banner-offline')?.addEventListener('click', () => { banner.hidden = true; banner.dataset.dismissed = '1'; });
    }
    return;
  }
  if (state.aiMode === 'offline' && banner.dataset.dismissed !== '1') {
    banner.hidden = false;
    banner.dataset.kind = 'offline';
    $('#banner-title').textContent = 'Offline mode';
    const standalone = typeof location !== 'undefined' && location.protocol === 'file:';
    $('#banner-body').textContent = standalone
      ? 'This is the standalone file and the local backend at http://127.0.0.1:8787 is not reachable. Start the backend, then reload this file (or open the served app) to use the live AI service. The calculator still runs locally; AI text comes from built-in templates.'
      : 'The backend is not reachable. The calculator still runs locally; AI text comes from built-in templates. Start the backend and reload to use live AI.';
    $('#banner-actions').innerHTML = '<a class="btn btn--sm" href="http://127.0.0.1:8787/" target="_blank" rel="noopener">Open live studio</a><button class="btn btn--sm" id="banner-retry-live" type="button">Retry connection</button><button class="btn btn--sm btn--ghost" id="banner-dismiss" type="button">Dismiss</button>';
    $('#banner-retry-live')?.addEventListener('click', async () => {
      banner.hidden = true; banner.dataset.dismissed = '1';
      toast('Checking for the local Meta backend…');
      await ai.detect();
      const snap = ai.getSnapshot();
      if (snap.mode === 'live') toast('Connected to the live AI service');
      else toast('Still offline — start the backend and try again', 'err');
    });
    $('#banner-dismiss')?.addEventListener('click', () => { banner.hidden = true; banner.dataset.dismissed = '1'; });
    return;
  }
  banner.hidden = true;
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------
const STEP_ORDER = ['brief', 'design', 'prove'];
function setStep(step, { force = false } = {}) {
  if (!STEP_ORDER.includes(step)) return;
  if (!force && STEP_ORDER.indexOf(step) > STEP_ORDER.indexOf(state.maxStep)) return;
  state.step = step;
  if (STEP_ORDER.indexOf(step) > STEP_ORDER.indexOf(state.maxStep)) state.maxStep = step;
  document.body.dataset.screen = step;
  STEP_ORDER.forEach((s) => {
    const sec = $(`#screen-${s}`);
    if (sec) sec.dataset.active = s === step ? 'true' : 'false';
    const btn = $(`#step-${s}`);
    if (btn) {
      const active = s === step;
      const done = STEP_ORDER.indexOf(s) < STEP_ORDER.indexOf(state.maxStep) && !active;
      btn.dataset.state = active ? 'active' : done ? 'done' : 'future';
      if (active) btn.setAttribute('aria-current', 'step');
      else btn.removeAttribute('aria-current');
    }
  });
  try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch (err) { window.scrollTo(0, 0); }
  persist();
}
function wireStepper() {
  STEP_ORDER.forEach((s) => {
    const btn = $(`#step-${s}`);
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (STEP_ORDER.indexOf(s) <= STEP_ORDER.indexOf(state.maxStep)) setStep(s);
      else toast('Complete the previous step first');
    });
  });
}

// ---------------------------------------------------------------------------
// Brief rendering
// ---------------------------------------------------------------------------
function renderProject() {
  const pn = $('#project-name');
  if (pn) pn.textContent = state.project;
  const seed = $('#session-seed');
  if (seed) seed.textContent = String(DEFAULTS.seed);
  const engine = $('#session-engine');
  if (engine) engine.textContent = 'v0.4';
  const valid = $('#session-valid');
  if (valid) {
    const v = state.validation || {};
    const counts = v.counts || { PASS: v.checks.filter((c) => c.status === 'pass').length, WARN: v.checks.filter((c) => c.status && c.status !== 'pass').length, FAIL: 0 };
    const total = v.total || v.countsTotal || 46;
    valid.textContent = `${counts.PASS} of ${total} passed · ${counts.WARN} warning${counts.WARN === 1 ? '' : 's'}`;
  }
}
function renderBriefText() {
  const ta = $('#brief-text');
  if (ta && document.activeElement !== ta) ta.value = state.brief.notes || '';
  updateWordCount();
  renderBriefMeta();
}
function updateWordCount() {
  const ta = $('#brief-text');
  const c = $('#word-count');
  if (!ta || !c) return;
  const words = ta.value.trim().split(/\s+/).filter(Boolean).length;
  c.textContent = `${words} word${words === 1 ? '' : 's'}`;
}
function renderBriefMeta() {
  const m = $('#brief-meta');
  if (!m) return;
  const parts = ['Draft saved on this device', `run ${DEFAULTS.seed}`];
  parts.push(state.aiMode === 'live' ? 'AI service live' : state.aiMode === 'mock' ? 'simulated AI' : 'built-in assistant');
  m.textContent = parts.join(' · ');
  renderFeasibility();
}
function renderUnderstanding() {
  const host = $('#understanding-fields');
  if (!host) return;
  const b = state.brief;
  host.innerHTML = '';
  const mkRow = (label, valueHtml, key) => el(`<div class="kv-row" data-k="${key}"><span class="k">${esc(label)}</span><span class="v">${valueHtml}<span class="edit" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m13.5 3.5 3 3L7 16H4v-3z"/></svg></span></span></div>`);
  host.appendChild(mkRow('Part', `<input class="u-input" type="text" data-field="partType" value="${esc(b.partType)}" aria-label="Part type" style="width:150px">`, 'partType'));
  host.appendChild(mkRow('Design load', `<input class="u-input" type="number" data-field="loadN" value="${b.loadN}" min="${AC.BRIEF_LIMITS.loadN[0]}" max="${AC.BRIEF_LIMITS.loadN[1]}" step="5" aria-label="Design load in newtons" style="width:86px"> N`, 'loadN'));
  host.appendChild(mkRow('Deflection limit', `<input class="u-input" type="number" data-field="deflLimitMm" value="${b.deflLimitMm}" min="${AC.BRIEF_LIMITS.deflLimitMm[0]}" max="${AC.BRIEF_LIMITS.deflLimitMm[1]}" step="0.1" aria-label="Deflection limit in millimetres" style="width:86px"> mm`, 'deflLimitMm'));
  host.appendChild(mkRow('Reliability target', `<input class="u-input" type="number" data-field="targetPf" value="${(b.targetPf * 100).toFixed(2)}" min="0.01" max="20" step="0.01" aria-label="Reliability target, failure probability in percent" style="width:86px"> %`, 'targetPf'));
  host.appendChild(mkRow('Print process', `<input class="u-input" type="text" data-field="process" value="${esc(b.process)}" aria-label="Print process" style="width:130px">`, 'process'));
  host.appendChild(mkRow('Batch', `<input class="u-input" type="text" data-field="preset" value="${esc(b.preset)}" aria-label="Material batch preset" style="width:110px">`, 'preset'));
  if (b.massCapG) host.appendChild(mkRow('Mass cap', `<span class="mono">${nf(b.massCapG, 0)} g</span>`, 'massCapG'));

  host.querySelectorAll('.u-input').forEach((input) => {
    input.addEventListener('change', () => {
      const field = input.dataset.field;
      const raw = input.value;
      if (field === 'targetPf') state.brief.targetPf = clamp(Number(raw) / 100, 0.0001, 0.2);
      else if (field === 'partType' || field === 'process') state.brief[field] = String(raw).slice(0, 60);
      else if (field === 'preset') {
        const key = Object.keys(MATERIAL_PRESETS).find((k) => k.toLowerCase() === String(raw).toLowerCase()) || state.brief.preset;
        state.brief.preset = key;
        applyPresetLot(key);
        input.value = key;
      } else if (field === 'loadN' || field === 'deflLimitMm') state.brief[field] = Number(raw);
      state.brief = AC.coerceBrief(state.brief, state.brief);
      renderUnderstanding();
      renderLot();
      renderPlanPreview();
      renderBriefMeta();
      renderAdvancedControls();
      persist();
    });
  });
  const badge = $('#understand-badge');
  if (badge) {
    badge.dataset.kind = state.briefMeta.fallback ? 'fallback' : 'live';
    badge.innerHTML = `<span class="b-dot"></span>${esc(state.briefMeta.model || 'built-in reader')}${state.briefMeta.ms ? ` · ${(state.briefMeta.ms / 1000).toFixed(2)} s` : ''}`;
  }
  const conf = $('#understand-confidence');
  if (conf) conf.textContent = `Confidence ${state.briefMeta.confidence != null ? state.briefMeta.confidence.toFixed(2) : '—'}`;
  const sub = $('#understanding-sub');
  if (sub) sub.textContent = state.briefMeta.fallback ? 'Read by the built-in reader — every field is editable.' : 'Read by the AI assistant — every field is editable.';
}

function applyPresetLot(key) {
  state.lot = AC.presetLot(key);
  state.material = AC.materialFromLot(state.lot);
  state.brief.preset = key;
  state.lotMeta = { model: 'Published data', confidence: 1, fallback: false };
  renderLot();
  renderAdvancedControls();
  persist();
}
function renderLot() {
  const lot = state.lot;
  const pMeta = MATERIAL_PRESETS[state.brief.preset] || MATERIAL_PRESETS[DEFAULTS.preset];
  $('#lot-name').textContent = pMeta.label;
  const presetMeta = MATERIAL_PRESETS[state.brief.preset] || MATERIAL_PRESETS[DEFAULTS.preset];
  const processTag = state.material.printProcessOk ? '3D-printed test data' : 'moulded data · comparison only';
  $('#lot-source').textContent = lot.source || 'Published material data';
  $('#lot-source').title = lot.sourceDetails || '';
  $('#lot-E').textContent = `${int(lot.E_mean)} MPa`;
  $('#lot-Ecv').textContent = `${nf(lot.E_cv * 100, 1)} %`;
  $('#lot-sy').textContent = `${nf(lot.sy_mean, 1)} MPa`;
  $('#lot-sycv').textContent = `${nf(lot.sy_cv * 100, 1)} %`;
  const share = (lot.lotFraction || 0.92195) ** 2;
  $('#lot-insight').textContent = `${(share * 100).toFixed(0)} % of the variance is between lots — that is the batch problem this tool exists to solve.`;
  const badge = $('#lot-badge');
  if (badge) {
    badge.innerHTML = state.lotMeta.fallback
      ? '<span class="p-dot"></span>Offline extracted'
      : `<span class="p-dot"></span>${esc(state.lotMeta.model || 'Published data')}`;
    badge.className = 'pill ' + (state.lotMeta.fallback ? 'pill--fallback' : 'pill--verify');
  }
  renderFeasibility();
}
function renderPresetMenu() {
  const host = $('#preset-menu');
  if (!host) return;
  host.innerHTML = '<div class="micro" style="margin-bottom:8px">Material sets · printed parts vs comparison only</div>';
  Object.values(MATERIAL_PRESETS).forEach((p) => {
    const contrast = p.printProcessOk === false;
    const b = el(`<button class="chip" type="button" aria-pressed="${p.key === state.brief.preset}" title="${esc(contrast ? 'Comparison only — moulded-part data, not valid for a printed design' : 'Printed test data — valid for this model')}" style="margin:0 6px 6px 0">${esc(p.label)}${contrast ? ' <span style="color:var(--accent-ink);font-size:10px">· comparison only</span>' : ''}</button>`);
    b.addEventListener('click', () => {
      applyPresetLot(p.key);
      host.hidden = true;
      if (contrast) toast(`${p.label} · comparison only: moulded-part data cannot size a printed design — Design is blocked`, 'err');
      else toast(`${p.label} applied · ${int(p.E_mean)} MPa stiffness · ${nf(p.sy_mean, 1)} MPa strength`);
      renderUnderstanding();
      renderPlanPreview();
    });
    host.appendChild(b);
  });
}function renderPlanPreview() {
  const host = $('#plan-preview');
  if (!host) return;
  const plan = state.plan;
  const items = (plan && plan.candidates.length ? plan.candidates : [
    { id: 'light', name: 'Light', tagline: 'Minimum mass', rationale: 'Mean-material sizing, risky across batches.' },
    { id: 'balanced', name: 'Balanced', tagline: 'Mass vs reliability', rationale: 'Mass against reliability, optimised for the target.' },
    { id: 'conservative', name: 'Conservative', tagline: 'Safety factor', rationale: 'Safety-factor sizing. Pays for safety nobody asked for.' },
  ]);
  host.innerHTML = items.map((c) => `
    <div class="plan-item">
      <div class="pi-top"><span class="pi-name">${esc(c.name)}</span><span class="pill pill--muted">prior</span></div>
      <div class="pi-rationale">${esc(c.rationale || AC.CANDIDATE_META[c.id]?.rationale || '')}</div>
      <div class="pi-prior">${esc(c.tagline || AC.CANDIDATE_META[c.id]?.tagline || 'AI suggestion')}</div>
    </div>`).join('');
  const badge = $('#plan-badge');
  if (badge) {
    badge.dataset.kind = state.planMeta.fallback ? 'fallback' : 'live';
    badge.innerHTML = `<span class="b-dot"></span>${esc(state.planMeta.model || '3 AI-proposed priors')}`;
  }
}

// ---------------------------------------------------------------------------
// Activity strip
// ---------------------------------------------------------------------------
function setActivity(statesArr, elapsedMs) {
  const act = $('#activity');
  if (!act) return;
  if (!statesArr) { act.hidden = true; return; }
  act.hidden = false;
  statesArr.forEach((s, i) => {
    const step = $(`#act-${i + 1}`);
    if (step) {
      step.dataset.state = s;
      const mark = step.querySelector('.a-mark');
      if (mark) mark.innerHTML = s === 'done' ? ICONS.check : '';
    }
  });
  const elp = $('#activity-elapsed');
  if (elp) elp.textContent = elapsedMs != null ? `${(elapsedMs / 1000).toFixed(2)} s` : '—';
  act.setAttribute('aria-label', `AI activity: ${statesArr.map((s, i) => `step ${i + 1} ${s}`).join(', ')}`);
}
function setBusy(busy) {
  state.busy = busy;
  ['#btn-design', '#btn-continue', '#btn-lot-parse'].forEach((sel) => {
    const b = $(sel);
    if (b) b.disabled = busy;
  });
  const designBtn = $('#btn-design');
  if (designBtn) designBtn.innerHTML = busy ? 'Designing…' : `Design with AI ${ICONS.chev}`;
}

// ---------------------------------------------------------------------------
// Design flow
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runDesignFlow() {
  if (state.busy) return;
  if (state.feasibility && (state.feasibility.process_ok === false || !state.feasibility.feasible)) {
    toast(state.feasibility.process_ok === false
      ? 'Material data is injection/compression, not a printed process — Design is blocked'
      : 'Infeasible for this bracket/lattice family — Design is blocked', 'err');
    renderFeasibility();
    return;
  }
  const t0 = performance.now();
  setBusy(true);
  setActivity(['running', 'future', 'future']);
  const errorCard = $('#understanding-error');
  if (errorCard) errorCard.hidden = true;
  try {
    const text = ($('#brief-text').value || '').trim();
    state.brief.notes = text;
    const parsed = await ai.parseBrief(text, { ...state.brief, preset: state.brief.preset });
    state.brief = AC.coerceBrief(parsed.brief, state.brief);
    state.briefMeta = { model: parsed.model, confidence: parsed.confidence, fallback: parsed.fallback, ms: parsed.provenance ? parsed.provenance.latencyMs : 0 };
    renderUnderstanding();
    setActivity(['done', 'running', 'future'], performance.now() - t0);
    await sleep(100);

    state.material = AC.materialFromLot(state.lot);
    const plan = await ai.planDesign(state.brief, state.material, ctx());
    state.plan = plan;
    state.planMeta = { model: plan.provenance ? plan.provenance.model : plan.model, fallback: !!plan.fallback };
    renderPlanPreview();
    setActivity(['done', 'done', 'running'], performance.now() - t0);
    await sleep(70);

    // Priors are evaluated exactly as proposed (no hidden optimisation) so the
    // three trade-offs stay distinct; the optimiser result is the separate hero.
    state.candidates = AC.evaluateAndRankCandidates(plan.candidates, state.material, ctx(), state.brief.targetPf);
    state.hero = AC.recommendedDesign(state.material, ctx(), state.brief.targetPf);
    state.selectedId = 'optimised';
    state.comparison = buildComparisonStrip();
    setActivity(['done', 'done', 'done'], performance.now() - t0);
    renderDesign();
    renderDesignMemo(state.hero);
    state.maxStep = 'design';
    setStep('design', { force: true });
    persist();
    toast(`Three AI suggestions checked · best design found at ${nf(state.hero.printed_mass_g, 2)} g estimated printed mass · ${((performance.now() - t0) / 1000).toFixed(2)} s`);
  } catch (err) {
    console.error(err);
    showAIError(err);
    setActivity(null);
    toast('The AI step failed — we can use the built-in text instead', 'err');
  } finally {
    setBusy(false);
  }
}

function printedOf(row) {
  return row && (row.printed_mass_g != null ? row.printed_mass_g : row.mass_g);
}
function buildComparisonStrip() {
  const material = state.material;
  const c = ctx();
  const solid = O.solidBaseline(material, c, state.brief.targetPf);
  const uniform = O.uniformTargetBaseline(material, c, state.brief.targetPf);
  return {
    solid: { mass_g: printedOf(solid), mass_analytic_g: solid.mass_g, pf: solid.pf, label: 'Solid plate' },
    uniform: { mass_g: printedOf(uniform), mass_analytic_g: uniform.mass_g, pf: uniform.pf, label: 'Uniform · target-sized' },
    nominal: null,
    meanOnly: null,
  };
}

function selectCandidate(id) {
  if (id === state.selectedId) return;
  state.selectedId = id;
  renderCandidates();
  renderHero();
  renderMetrics();
  renderBrittle(selectedCandidate(), 'design');
  renderLattice();
  renderVsStrip();
  const c = selectedCandidate();
  if (c) {
    renderDesignMemo(c);
    toast(id === 'optimised' ? 'Best design selected' : `${c.name} suggestion selected — proof will improve it`);
    persist();
  }
}

function renderDesign() {
  const c = selectedCandidate();
  if (!c) return;
  renderCandidates();
  renderHero();
  renderMetrics();
  renderBrittle(selectedCandidate(), 'design');
  renderLattice();
  renderVsStrip();
  const preset = MATERIAL_PRESETS[state.brief.preset] || MATERIAL_PRESETS[DEFAULTS.preset];
  $('#viz-meta').textContent = `${GEOMETRY.Lx} × ${GEOMETRY.Ly} × ${GEOMETRY.depth} mm · ${preset.label} · ${nf(state.brief.loadN, 0)} N tip load`;
  const cap = $('#viz-caption-text');
  const rankLabel = Number.isFinite(c.rank) ? `checked by the calculator · option ${c.rank}` : 'best of this family';
  if (cap) cap.textContent = `Showing: ${c.name} · ${c.feasible ? 'meets target' : 'below target'} · ${rankLabel}`;
  setStep('design');
}
function renderCandidates() {
  const host = $('#candidates');
  if (!host) return;
  host.innerHTML = '';
  state.candidates.forEach((c) => {
    const print = c.printability || {};
    const printPass = c.printabilityPass ?? !!(print.pass);
    const ratio = print.max_neighbour_width_ratio ?? print.maxNeighbourRatio ?? 1;
    const slen = print.max_slenderness ?? print.maxSlenderness ?? 0;
    const recommended = c.rank === 1 && c.feasible;
    const btn = el(`
      <button class="candidate" type="button" aria-pressed="${c.id === state.selectedId}" data-id="${esc(c.id)}" aria-label="${esc(c.name)} candidate: ${nf(c.mass_g, 2)} grams printed mass, probability of failure ${fmtPf(c.pf)}, ${printPass ? 'printability pass' : 'printability warning'}">
        <div class="c-tags">
          <span class="pill pill--muted">AI suggestion</span>
          ${recommended ? '<span class="pill pill--verify"><span class="p-dot"></span>Recommended</span>' : ''}
          ${printPass ? '' : '<span class="pill pill--accent">printability warn</span>'}
        </div>
        <div class="c-name">${esc(c.name)}</div>
        <div class="c-mass">${nf(c.mass_g, 2)} <span class="u">g</span> <span style="font-size:11px;color:var(--muted);font-family:var(--mono)">printed</span></div>
        <div class="c-pf">Failure chance ${fmtPf(c.pf)} <span style="color:var(--muted)">· target ${fmtPf(state.brief.targetPf)}</span></div>
        <div class="c-tradeoff">${esc(c.rationale || AC.CANDIDATE_META[c.id]?.rationale || '')}</div>
        <div class="c-engine">
          <span class="c-print pill ${printPass ? 'pill--verify' : 'pill--accent'}" style="height:22px">${printPass ? 'print pass' : ICONS.warn + ' print warn'} · w-ratio ${nf(ratio, 2)} · L/w ${nf(slen, 1)}</span>
        </div>
        <div class="micro" style="margin-top:6px">AI suggestion · checked as proposed · high-side estimate ${nf(c.mass_analytic_g ?? 0, 2)} g<br>Pick it and the calculator will improve it from here</div>
      </button>`);
    btn.addEventListener('click', () => selectCandidate(c.id));
    host.appendChild(btn);
  });
}
function renderHero() {
  const h = state.hero;
  const card = $('#optimised-hero');
  if (!card) return;
  if (!h) { card.hidden = true; return; }
  card.hidden = false;
  const print = h.printability || {};
  $('#hero-mass').textContent = `${nf(h.printed_mass_g, 2)} g`;
  $('#hero-ub').textContent = `${nf(h.mass_analytic_g, 2)} g`;
  $('#hero-pf').textContent = fmtPf(h.pf);
  $('#hero-print').textContent = `${h.printabilityPass ? 'pass' : 'warn'} · ratio ${nf(print.max_neighbour_width_ratio, 2)} · L/w ${nf(print.max_slenderness, 1)}`;
  $('#hero-mode').textContent = h.governing || '—';
  const polish = $('#hero-polish');
  if (polish) {
    if (h.union_polished) {
      polish.innerHTML = `<b>Mass check:</b> the final local search reduced the estimated printed mass from ${nf(h.union_before_printed_g, 2)} g to <b>${nf(h.union_after_printed_g, 2)} g</b>. Failure chance and printability were rechecked afterwards.`;
    } else {
      polish.innerHTML = `<b>Mass check:</b> the final local search found no lighter printable design, so we kept the best result from the main search.`;
    }
  }
  const btn = $('#btn-select-hero');
  if (btn) {
    const active = state.selectedId === 'optimised';
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    btn.textContent = active ? 'Selected' : 'Use optimised design';
    btn.dataset.id = 'optimised';
  }
}function renderMetrics() {
  const c = selectedCandidate();
  if (!c) return;
  $('#metric-mass-value').innerHTML = `${nf(c.mass_g, 2)} <span class="m-unit">g</span>`;
  $('#metric-mass-sub').textContent = `estimated printed mass · high-side estimate ${nf(c.mass_analytic_g ?? 0, 2)} g`;
  const pfEl = $('#metric-pf-value');
  pfEl.textContent = fmtPf(c.pf);
  pfEl.className = 'm-value ' + (c.pf <= state.brief.targetPf ? 'is-good' : 'is-warn');
  $('#metric-pf-sub').textContent = `target ≤ ${fmtPf(state.brief.targetPf)} · across delivered lots`;
  const modeEl = $('#metric-mode-value');
  modeEl.textContent = c.governing || '—';
  $('#metric-mode-sub').textContent = 'whichever failure mode carries the probability';
  const print = c.printability || {};
  const badge = $('#metric-print-badge');
  if (badge) {
    const pass = c.printabilityPass ?? !!(print.pass);
    badge.className = 'pill ' + (pass ? 'pill--verify' : 'pill--accent');
    badge.textContent = `${pass ? 'printability pass' : 'printability warn'} · ratio ${nf(print.max_neighbour_width_ratio ?? print.maxNeighbourRatio, 2)} · L/w ${nf(print.max_slenderness ?? print.maxSlenderness, 1)}`;
  }
  renderMassFootnotes();
}
function renderMassFootnotes() {
  const c = selectedCandidate();
  const proving = state.proof && state.step === 'prove';
  const mass = proving ? (state.proof.optimizedAnalysis.printed_mass_g ?? state.proof.optimizedAnalysis.mass_g) : (c ? c.mass_g : null);
  if (mass == null) return;
  const d = AC.massDisclosure(mass);
  const designNote = $('#mass-footnote');
  if (designNote) designNote.textContent = d.note;
  const proofNote = $('#proof-mass-note');
  if (proofNote) {
    const up = state.proof;
    const union = up ? (up.union_polished
      ? ` Final mass check: ${nf(up.union_before_printed_g, 2)} g → ${nf(up.union_after_printed_g, 2)} g estimated printed mass.`
      : ' Final mass check: no lighter printable design found.') : '';
    proofNote.textContent = `Estimated printed mass ${nf(d.printed_g, 2)} g · high-side estimate ${nf(d.analytic_upper_bound_g, 2)} g (+${nf(d.upper_bound_pct, 1)}%) — ${d.note}${union}`;
  }
}

function renderVsStrip() {
  const c = selectedCandidate();
  const host = $('#vs-bars');
  if (!host || !c) return;
  const rows = [];
  if (state.comparison?.solid) rows.push({ key: 'solid', label: 'Solid plate', mass: state.comparison.solid.mass_g, selected: false });
  if (state.comparison?.uniform) rows.push({ key: 'uniform', label: 'Uniform · target', mass: state.comparison.uniform.mass_g, selected: false });
  if (state.comparison?.nominal) rows.push({ key: 'nominal', label: 'Nominal FoS 1.5', mass: state.comparison.nominal.mass_g, selected: false });
  rows.push({ key: 'selected', label: 'Your design', mass: c.mass_g, selected: true });
  const max = Math.max(...rows.map((r) => r.mass)) * 1.04;
  host.innerHTML = rows.map((r) => `
    <div class="vs-row ${r.selected ? 'is-selected' : ''}">
      <span class="vs-k">${esc(r.label)}</span>
      <div class="vs-track"><div class="vs-fill" style="width:${clamp((r.mass / max) * 100, 3, 100).toFixed(1)}%"></div></div>
      <span class="vs-v">${nf(r.mass, 1)}</span>
    </div>`).join('');
  const solid = state.comparison?.solid;
  const uniform = state.comparison?.uniform;
  const parts = [];
  if (solid && solid.mass_g > c.mass_g) parts.push(`${((1 - c.mass_g / solid.mass_g) * 100).toFixed(0)} % lighter than the solid plate`);
  if (uniform && uniform.mass_g > c.mass_g) parts.push(`${((1 - c.mass_g / uniform.mass_g) * 100).toFixed(0)} % lighter than a uniform lattice sized to the same target`);
  $('#vs-takeaway').textContent = (parts.length ? parts.join(' · ') + '. ' : '') + 'Bars show estimated printed mass; the solid plate is exact.';
}

function renderDesignMemo(c) {
  const card = $('#design-memo');
  const body = $('#design-memo-body');
  const badge = $('#design-memo-badge');
  if (!body || !c) return;
  const payload = AC.buildDesignMemoPayload({ brief: state.brief, selected: c, comparison: state.comparison });
  const fallback = AC.fallbackDesignReview(payload);
  body.innerHTML = '<span class="state-note" style="padding:0"><span class="dot-pulse"></span>Writing the design memo…</span>';
  (async () => {
    try {
      const res = await ai.reviewDesign(payload);
      body.innerHTML = highlightNumbers(res.memo || fallback.memo);
      const kind = res.fallback || res.live === false ? 'fallback' : 'live';
      badge.dataset.kind = kind;
      badge.innerHTML = `<span class="b-dot"></span>${esc(res.provenance ? res.provenance.model : 'AI assistant')}${res.provenance ? ` · ${(res.provenance.latencyMs / 1000).toFixed(2)} s` : ''} · ${kind}${res.grounded === false ? ' · fallback (numbers not checked)' : ' · numbers checked'}`;
      card.classList.toggle('is-fallback', kind === 'fallback');
      const actions = $('#design-memo-actions');
      const next = (res.nextActions && res.nextActions.length ? res.nextActions : fallback.nextActions).slice(0, 3);
      actions.innerHTML = next.map((a) => `<button class="btn btn--sm btn--ghost" type="button">${esc(a)}</button>`).join('');
      actions.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => toast(`${b.textContent} — suggestion noted`)));
    } catch (err) {
      console.error(err);
      body.innerHTML = highlightNumbers(fallback.memo);
      badge.dataset.kind = 'fallback';
      badge.innerHTML = '<span class="b-dot"></span>built-in assistant · fallback';
    }
  })();
}

function renderLattice() {
  const c = selectedCandidate();
  const stage = $('#lattice-stage');
  if (!stage || !c) return;
  const material = state.material;
  const analysis = c.analysis;
  const view = state.view;
  const W = 980;
  const H = 320;
  const padL = 92;
  const padR = 150;
  const padT = 34;
  const padB = 50;
  const scale = Math.min((W - padL - padR) / (GEOMETRY.Lx + 18), (H - padT - padB) / (GEOMETRY.Ly + 12));
  const ox = padL + 14 * scale;
  const oy = H - padB;
  const px = (x) => ox + x * scale;
  const py = (y) => oy - y * scale;
  const widths = analysis.elements.map((e) => e.w);
  const wMin = Math.min(...widths);
  const wMax = Math.max(...widths);
  const util = analysis.elements.map((e) => (analysis.F * e.sigmaCoeff) / Math.max(1e-9, material.sy_mean));
  const maxU = Math.max(...util);
  const maxIdx = util.indexOf(maxU);
  const strokew = (w) => (view === 'width' ? 2 + ((w - wMin) / Math.max(1e-6, wMax - wMin)) * 15 : 2.2 + (w - 1) * 1.7);
  const color = (i) => {
    if (view === 'geometry') return '#565E6A';
    if (view === 'stress') {
      const t = clamp(util[i] / Math.max(0.35, maxU || 1), 0, 1);
      if (t < 0.45) return `rgba(86,94,106,${(0.45 + t).toFixed(2)})`;
      if (t < 0.8) return '#FF8A6E';
      return '#FF5A36';
    }
    return '#15171A';
  };
  const nodes = E.MESH_NODES;
  const els = analysis.elements;
  const disp = E.nodeDisplacements(analysis, material.E_mean);
  let maxDisp = 0;
  for (let n = 0; n < E.NODE_COUNT; n++) maxDisp = Math.max(maxDisp, Math.abs(disp[3 * n + 1]));
  const fac = maxDisp > 1e-9 ? clamp((0.13 * GEOMETRY.Ly) / maxDisp, 1, 30) : 1;
  const defs = `<defs>
    <marker id="ab-arrow" markerWidth="8" markerHeight="8" refX="4" refY="6" orient="auto"><path d="M0,0 L8,6 L0,12 z" fill="#FF5A36"/></marker>
    <pattern id="ab-hatch" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="7" stroke="#D3CCBD" stroke-width="1"/></pattern>
    <filter id="ab-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>`;
  const struts = els.map((e, i) => {
    const n1 = nodes[e.n1]; const n2 = nodes[e.n2];
    return `<line x1="${px(n1.x).toFixed(1)}" y1="${py(n1.y).toFixed(1)}" x2="${px(n2.x).toFixed(1)}" y2="${py(n2.y).toFixed(1)}" stroke="${color(i)}" stroke-width="${strokew(e.w).toFixed(2)}" stroke-linecap="round"/>`;
  }).join('');
  const deformed = els.map((e) => {
    const n1 = nodes[e.n1]; const n2 = nodes[e.n2];
    return `<line x1="${px(n1.x + disp[3 * e.n1] * fac).toFixed(1)}" y1="${py(n1.y + disp[3 * e.n1 + 1] * fac).toFixed(1)}" x2="${px(n2.x + disp[3 * e.n2] * fac).toFixed(1)}" y2="${py(n2.y + disp[3 * e.n2 + 1] * fac).toFixed(1)}" stroke="#FF5A36" stroke-opacity="0.3" stroke-width="1" stroke-dasharray="3 4" fill="none"/>`;
  }).join('');
  const nodesDots = nodes.map((n) => `<circle cx="${px(n.x).toFixed(1)}" cy="${py(n.y).toFixed(1)}" r="1.7" fill="#15171A" opacity="0.5"/>`).join('');
  const supports = [0, 1, 2, 3].map((j) => {
    const n = nodes[E.nodeId(0, j)];
    const x = px(n.x); const y = py(n.y);
    return `<path d="M${x},${y} l-11,-7 v14 z" fill="#F1EDE3" stroke="#565E6A" stroke-width="1"/>`;
  }).join('');
  const loads = [0, 1, 2, 3].map((j) => {
    const n = nodes[E.nodeId(GEOMETRY.nx, j)];
    const x = px(n.x); const y = py(n.y);
    return `<line x1="${x}" y1="${(y + 32).toFixed(1)}" x2="${x}" y2="${(y + 8).toFixed(1)}" stroke="#FF5A36" stroke-width="2" marker-end="url(#ab-arrow)"/>`;
  }).join('');
  const maxGlow = view === 'stress' && els[maxIdx]
    ? `<line x1="${px(nodes[els[maxIdx].n1].x).toFixed(1)}" y1="${py(nodes[els[maxIdx].n1].y).toFixed(1)}" x2="${px(nodes[els[maxIdx].n2].x).toFixed(1)}" y2="${py(nodes[els[maxIdx].n2].y).toFixed(1)}" stroke="#FF5A36" stroke-opacity="0.55" stroke-width="${(strokew(els[maxIdx].w) + 2).toFixed(1)}" stroke-linecap="round" filter="url(#ab-glow)"/>`
    : '';
  const dims = `
    <line x1="${px(0)}" y1="${py(GEOMETRY.Ly) - 20}" x2="${px(GEOMETRY.Lx)}" y2="${py(GEOMETRY.Ly) - 20}" stroke="#D3CCBD"/>
    <line x1="${px(0)}" y1="${py(GEOMETRY.Ly) - 25}" x2="${px(0)}" y2="${py(GEOMETRY.Ly) - 15}" stroke="#D3CCBD"/>
    <line x1="${px(GEOMETRY.Lx)}" y1="${py(GEOMETRY.Ly) - 25}" x2="${px(GEOMETRY.Lx)}" y2="${py(GEOMETRY.Ly) - 15}" stroke="#D3CCBD"/>
    <text x="${(px(0) + px(GEOMETRY.Lx)) / 2}" y="${py(GEOMETRY.Ly) - 26}" text-anchor="middle" font-family="-apple-system, Segoe UI, sans-serif" font-size="11" fill="#6B7280">${GEOMETRY.Lx} mm</text>
    <line x1="${px(GEOMETRY.Lx) + 24}" y1="${py(0)}" x2="${px(GEOMETRY.Lx) + 24}" y2="${py(GEOMETRY.Ly)}" stroke="#D3CCBD"/>
    <text x="${px(GEOMETRY.Lx) + 34}" y="${(py(0) + py(GEOMETRY.Ly)) / 2}" font-family="-apple-system, Segoe UI, sans-serif" font-size="11" fill="#6B7280" transform="rotate(90 ${px(GEOMETRY.Lx) + 34} ${(py(0) + py(GEOMETRY.Ly)) / 2})" text-anchor="middle">${GEOMETRY.Ly} mm</text>
    <text x="${px(GEOMETRY.Lx) + 46}" y="${py(GEOMETRY.Ly) + 24}" font-family="-apple-system, Segoe UI, sans-serif" font-size="11" fill="#FF5A36">${nf(state.brief.loadN, 0)} N tip load</text>
    <text x="${px(0) - 20}" y="${py(GEOMETRY.Ly) / 2}" font-family="-apple-system, Segoe UI, sans-serif" font-size="10" fill="#6B7280" transform="rotate(-90 ${px(0) - 20} ${py(GEOMETRY.Ly) / 2})" text-anchor="middle">fixed wall pad</text>`;
  stage.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Graded lattice elevation, ${E.N_ELEMENTS} struts, ${view} view">
    <title>Graded lattice bracket elevation</title>
    <desc>${GEOMETRY.nx} by ${GEOMETRY.ny} cell X-braced lattice, struts coloured by ${view === 'stress' ? 'stress utilisation' : view === 'width' ? 'strut width' : 'geometry'}.</desc>
    ${defs}
    <rect x="${px(0) - 15}" y="${py(GEOMETRY.Ly)}" width="15" height="${GEOMETRY.Ly * scale}" fill="url(#ab-hatch)" stroke="#D3CCBD"/>
    <rect x="${px(0)}" y="${py(GEOMETRY.Ly)}" width="${GEOMETRY.padWidth * scale}" height="${GEOMETRY.Ly * scale}" fill="#F1EDE3" stroke="#D3CCBD"/>
    ${deformed}
    ${struts}
    ${maxGlow}
    ${nodesDots}
    ${supports}
    ${loads}
    ${dims}
  </svg>`;
  const l1 = $('#legend-1');
  const l2 = $('#legend-2');
  if (l1) l1.style.background = view === 'stress' ? 'rgba(86,94,106,.6)' : view === 'width' ? 'var(--muted)' : 'var(--muted-strong)';
  if (l2) l2.style.background = view === 'stress' ? 'var(--accent)' : 'var(--ink)';
  const legendNote = $('#viz-caption-meta');
  if (legendNote) legendNote.textContent = view === 'stress'
    ? `max stress use ${maxU.toFixed(2)} · bend shown ×${fac.toFixed(1)} · not to scale`
    : view === 'width' ? `width ${nf(wMin, 2)}–${nf(wMax, 2)} mm · not to scale` : 'not to scale · illustrative rendering';
}
function wireViewToggle() {
  $$('#view-toggle button').forEach((b) => {
    b.addEventListener('click', () => {
      state.view = b.dataset.view;
      $$('#view-toggle button').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
      renderLattice();
      persist();
    });
  });
}

// ---------------------------------------------------------------------------
// Prove flow
// ---------------------------------------------------------------------------
async function runProofFlow() {
  if (state.busy) return;
  const c = selectedCandidate();
  if (!c) { toast('Run the design step first', 'err'); return; }
  setBusy(true);
  state.maxStep = 'prove';
  setStep('prove', { force: true });
  renderProofSkeletons();
  const t0 = performance.now();
  try {
    const material = state.material;
    const context = ctx();
    await sleep(40);

    const objective = O.robustObjective(material, context, state.brief.targetPf);
    let seeded = null;
    try {
      const gen = O.patternSearchGen(objective, c.logWidth, {});
      let step = gen.next();
      while (!step.done) step = gen.next();
      seeded = step.value;
    } catch (err) { console.error(err); }
    const multi = O.robustOptimize(material, context, { targetPf: state.brief.targetPf });
    let bestDesign = multi.design;
    let bestAnalysis = multi.analysis;
    let bestPf = multi.pf;
    if (seeded) {
      const seededAnalysis = E.analyzeLattice(seeded.design, context);
      const seededPf = E.probabilityOfFailure(seededAnalysis, material, 'lot');
      if (seededPf <= state.brief.targetPf && seededAnalysis.mass_g < multi.mass - 1e-6) {
        bestDesign = seeded.design; bestAnalysis = seededAnalysis; bestPf = seededPf;
      }
    }
    const report = E.reliabilityReport(bestAnalysis, material, { seed: DEFAULTS.seed, nSamples: DEFAULTS.nMc });
    const win = O.acceptanceWindow(bestAnalysis, material, { targetPf: state.brief.targetPf, eLoRatio: 0.6, eHiRatio: 1.3 });
    await sleep(60);

    const comparison = O.compareStrategies(material, context, { targetPf: state.brief.targetPf });
    const row = (k) => comparison.rows.find((r) => r.key === k);
    state.comparison = {
      solid: { mass_g: comparison.solid.mass_g, pf: comparison.solid.pf, label: 'Solid plate' },
      uniform: { mass_g: comparison.uniform.mass_g, pf: comparison.uniform.pf, label: 'Uniform · target-sized' },
      nominal: { mass_g: row('nominal_sf15').mass_g, pf: row('nominal_sf15').pf, label: 'Nominal FoS 1.5' },
      meanOnly: { mass_g: row('mean_only').mass_g, pf: row('mean_only').pf, label: 'Mean-only' },
      rows: comparison.rows,
    };
    const sustained = E.sustainedBound(bestAnalysis, state.material, {
      creepFactor: V03.creepFactor, compressionFactor: V03.compressionFactor,
    });
    state.qc.e = state.qc.e ?? state.material.E_mean;
    state.qc.sy = state.qc.sy ?? state.material.sy_mean;
    state.qc.cv = state.qc.cv ?? V03.measurementCvDefault * 100;
    const recipe = O.lotSpecificRecipe(state.material, bestDesign, {
      targetPf: state.brief.targetPf,
      measurementCv: state.qc.cv / 100,
      lotE: state.qc.e,
      lotSy: state.qc.sy,
      F: state.brief.loadN,
      uLim: state.brief.deflLimitMm,
    });
    const brittle = E.brittleScreen(bestAnalysis, state.material, 'lot');
    const assumptions = E.assumptionBounds(
      state.material, bestAnalysis.demands.sigma_y_req, bestAnalysis.demands.E_req, 'lot',
    );
    state.validation = await loadValidation();
    const printedRows = comparison.rows.map((r) => ({
      ...r,
      mass_g: r.printed_mass_g != null ? r.printed_mass_g : r.mass_g,
      mass_analytic_g: r.mass_g,
    }));
    state.comparison = {
      solid: { mass_g: comparison.solid.printed_mass_g ?? comparison.solid.mass_g, pf: comparison.solid.pf, label: 'Solid plate' },
      uniform: { mass_g: comparison.uniform.printed_mass_g ?? comparison.uniform.mass_g, pf: comparison.uniform.pf, label: 'Uniform · target-sized' },
      nominal: { mass_g: printedOf(row('nominal_sf15')), pf: row('nominal_sf15').pf, label: 'Nominal FoS 1.5' },
      meanOnly: { mass_g: printedOf(row('mean_only')), pf: row('mean_only').pf, label: 'Mean-only' },
      rows: printedRows,
    };
    state.optimized = {
      design: bestDesign, analysis: bestAnalysis, pf: bestPf,
      mass: bestAnalysis.printed_mass_g ?? bestAnalysis.mass_g,
      mass_analytic_g: bestAnalysis.mass_g,
      starts: multi.starts || [],
    };
    state.proof = {
      optimizedDesign: bestDesign, optimizedAnalysis: bestAnalysis,
      report, window: win,
      sustained, recipe, qc: { ...state.qc },
      brittle, assumptions,
      union_polished: !!multi.union_polished,
      union_evals: multi.union_evals || 0,
      union_before_printed_g: multi.union_before_printed_g,
      union_after_printed_g: multi.union_after_printed_g,
      passport: { eRatio: 1, syRatio: 1, lotE: recipe.lot.lot_E, lotSy: recipe.lot.lot_sy, adapt: null },
      comparison, proofMemo: null, render: null,
    };
    setStep('prove', { force: true });
    renderProof();
    persist();
    toast(`Proof ready · ${nf(bestAnalysis.printed_mass_g ?? bestAnalysis.mass_g, 2)} g estimated printed mass · failure chance ${fmtPf(bestPf)}`);
    loadProofMemos();
  } catch (err) {
    console.error(err);
    showAIError(err);
    toast('Proof step failed — see console', 'err');
  } finally {
    setBusy(false);
  }
}

function computePassport(analysis, material, eRatio, syRatio) {
  const lotE = material.E_mean * eRatio;
  const lotSy = material.sy_mean * syRatio;
  const adapt = O.batchAdaptiveScale(analysis.designLogWidth, material, { E: lotE, sy: lotSy }, ctx(), { targetPf: state.brief.targetPf });
  return { eRatio, syRatio, lotE, lotSy, adapt };
}
function renderProofSkeletons() {
  const stage = $('#gauge');
  if (stage) stage.innerHTML = '<div class="skel-line is-skel" style="width:100%;height:140px;border-radius:16px"></div>';
  const body = $('#proof-memo-body');
  if (body) body.innerHTML = '<span class="state-note" style="padding:0"><span class="dot-pulse"></span>The engine is running, then the AI will write the qualification memo…</span>';
  const list = $('#validation-list');
  if (list) list.innerHTML = '<div class="skel-line is-skel" style="width:80%;margin:8px 0"></div><div class="skel-line is-skel" style="width:65%;margin:8px 0"></div>';
  const chart = $('#acceptance-chart');
  if (chart) chart.innerHTML = '<div class="skel-line is-skel" style="width:100%;height:220px;border-radius:12px"></div>';
}

function renderProof() {
  const p = state.proof;
  if (!p) return;
  const a = p.optimizedAnalysis;
  const rep = p.report;
  const target = state.brief.targetPf;
  const meets = rep.pfAnalytic <= target;
  const chip = $('#prove-status');
  chip.className = 'status-chip' + (meets ? '' : ' is-warn');
  chip.innerHTML = `<span class="p-dot" style="background:currentColor"></span>${meets ? 'Meets' : 'Misses'} ${(100 - target * 100).toFixed(0)} % reliability target`;

  drawGauge($('#gauge'), rep.pfAnalytic, target);
  $('#gauge-mode').textContent = rep.modes.governingLabel;
  const printed = a.printed_mass_g ?? a.mass_g;
  $('#gauge-mass').textContent = `${nf(printed, 2)} g`;
  const ub = $('#gauge-mass-ub');
  if (ub) ub.textContent = `${nf(a.mass_analytic_g ?? a.mass_g, 2)} g`;
  const pr = E.printabilityReport(a);
  $('#gauge-print').textContent = pr
    ? `${pr.pass ? 'pass' : 'warn'} · ratio ${nf(pr.max_neighbour_width_ratio, 2)} · L/w ${nf(pr.max_slenderness, 1)}`
    : '—';
  $('#gauge-rel').textContent = `${(rep.reliability * 100).toFixed(2)} %`;

  renderQC();
  drawAcceptance($('#acceptance-chart'), p.window, a, p.passport);
  $('#acceptance-caption').textContent = 'Lot-mean envelope the engine accepts for this design. The known-lot recipe re-optimises all 8 width controls for the measured lot (measurement CV retained) instead of one global scale.';
  $('#acceptance-target').textContent = `target failure chance ≤ ${fmtPf(target)}`;

  renderRecipe();
  renderSustained();
  renderBrittle(p.brittle, 'proof');
  renderAssumptions(p.assumptions);
  renderValidation();
  renderClaims();
  renderMassFootnotes();
  renderProject();
  $('#stl-meta').textContent = pr ? `min width ${nf(pr.min_width_mm, 2)} mm · box per strut` : '—';
  renderRenderCard(null);
}

function drawGauge(host, pf, target) {
  if (!host) return;
  const reliability = 1 - pf;
  const W = 210;
  const H = 128;
  const cx = W / 2;
  const cy = H - 16;
  const r = 78;
  const start = Math.PI;
  const arc = (fraction, color, width) => {
    const x0 = cx + r * Math.cos(start + Math.PI);
    const y0 = cy + r * Math.sin(start + Math.PI);
    const x1 = cx + r * Math.cos(start + Math.PI * failure(fraction));
    const y1 = cy + r * Math.sin(start + Math.PI * failure(fraction));
    return `<path d="M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
  };
  const failure = (v) => 1 - v;
  const targetFraction = 1 - target;
  const angle = start + Math.PI * (1 - targetFraction);
  const tx0 = cx + (r - 9) * Math.cos(angle);
  const ty0 = cy + (r - 9) * Math.sin(angle);
  const tx1 = cx + (r + 9) * Math.cos(angle);
  const ty1 = cy + (r + 9) * Math.sin(angle);
  const meets = pf <= target;
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Probability of failure ${fmtPf(pf)}, target ${fmtPf(target)}">
    <title>Probability of failure across batches</title>
    <desc>${fmtPf(pf)} against a target of ${fmtPf(target)}; reliability ${(reliability * 100).toFixed(2)} percent.</desc>
    ${arc(1, '#F1EDE3', 11)}
    ${arc(reliability, meets ? '#0B6B53' : '#FF5A36', 11)}
    <line x1="${tx0}" y1="${ty0}" x2="${tx1}" y2="${ty1}" stroke="#15171A" stroke-width="1.6"/>
    <text x="${cx}" y="${cy - 30}" text-anchor="middle" font-family="Iowan Old Style, Georgia, serif" font-size="34" fill="${meets ? '#0B6B53' : '#B8361A'}">${fmtPf(pf)}</text>
    <text x="${cx}" y="${cy - 10}" text-anchor="middle" font-family="-apple-system, Segoe UI, sans-serif" font-size="11" fill="#6B7280">target ≤ ${fmtPf(target)}</text>
    <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="10.5" fill="#565E6A">reliability ${(reliability * 100).toFixed(2)} %</text>
  </svg>`;
}

function drawAcceptance(host, win, analysis, passport) {
  if (!host || !win) return;
  const pts = win.points;
  const feasible = pts.filter((p) => Number.isFinite(p.sy));
  const W = 980;
  const H = 270;
  const pad = { l: 64, r: 26, t: 24, b: 40 };
  const eMin = pts[0].E;
  const eMax = pts[pts.length - 1].E;
  const syCandidates = [analysis.demands.sigma_y_req, ...feasible.map((p) => p.sy)];
  const syMin = Math.min(...syCandidates) * 0.8;
  const syMax = Math.max(...syCandidates) * 1.22;
  const mx = (x) => pad.l + ((x - eMin) / (eMax - eMin)) * (W - pad.l - pad.r);
  const my = (y) => H - pad.b - ((y - syMin) / (syMax - syMin)) * (H - pad.t - pad.b);
  const curve = feasible.map((p, i) => `${i === 0 ? 'M' : 'L'} ${mx(p.E).toFixed(1)} ${my(p.sy).toFixed(1)}`).join(' ');
  const area = feasible.length > 1
    ? `M ${mx(feasible[0].E).toFixed(1)} ${my(syMax).toFixed(1)} ` + feasible.map((p) => `L ${mx(p.E).toFixed(1)} ${my(p.sy).toFixed(1)}`).join(' ')
      + ` L ${mx(feasible[feasible.length - 1].E).toFixed(1)} ${my(syMax).toFixed(1)} Z`
    : '';
  const gridX = [0, 1, 2, 3, 4].map((i) => {
    const x = pad.l + ((W - pad.l - pad.r) * i) / 4;
    const v = eMin + ((eMax - eMin) * i) / 4;
    return `<line x1="${x}" y1="${pad.t}" x2="${x}" y2="${H - pad.b}" stroke="#E4DFD3"/><text x="${x}" y="${H - pad.b + 16}" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="10" fill="#6B7280">${int(v)}</text>`;
  }).join('');
  const gridY = [0, 1, 2, 3].map((i) => {
    const y = pad.t + ((H - pad.t - pad.b) * i) / 3;
    const v = syMax - ((syMax - syMin) * i) / 3;
    return `<line x1="${pad.l}" y1="${y}" x2="${W - pad.r}" y2="${y}" stroke="#E4DFD3"/><text x="${pad.l - 8}" y="${y + 3}" text-anchor="end" font-family="ui-monospace, Menlo, monospace" font-size="10" fill="#6B7280">${nf(v, 0)}</text>`;
  }).join('');
  const nominalX = mx(win.reference.E_mean);
  const nominalY = my(win.reference.sy_mean);
  const lotX = mx(clamp(passport.lotE, eMin, eMax));
  const lotY = my(clamp(passport.lotSy, syMin, syMax));
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Batch acceptance window">
    <title>Batch acceptance window</title>
    <desc>The curve is the minimum lot mean yield strength that keeps failure probability under target for each lot mean modulus. The dot marks the measured lot.</desc>
    <rect x="${pad.l}" y="${pad.t}" width="${W - pad.l - pad.r}" height="${H - pad.t - pad.b}" fill="#FDEDE7" opacity="0.55"/>
    <path d="${area}" fill="#E9F1ED"/>
    <path d="${curve}" fill="none" stroke="#0B6B53" stroke-width="2.2"/>
    ${gridX}${gridY}
    <text x="${mx(feasible[0]?.E ?? eMin) + 12}" y="${my(syMax) + 20}" font-family="-apple-system, Segoe UI, sans-serif" font-size="11" font-weight="650" fill="#0B6B53" letter-spacing="0.08em">ACCEPTED</text>
    <text x="${pad.l + 10}" y="${H - pad.b - 8}" font-family="-apple-system, Segoe UI, sans-serif" font-size="11" fill="#B8361A">rejected / reroute</text>
    <line x1="${nominalX}" y1="${pad.t}" x2="${nominalX}" y2="${H - pad.b}" stroke="#D3CCBD" stroke-dasharray="3 4"/>
    <line x1="${pad.l}" y1="${nominalY}" x2="${W - pad.r}" y2="${nominalY}" stroke="#D3CCBD" stroke-dasharray="3 4"/>
    <circle cx="${lotX}" cy="${lotY}" r="5" fill="#15171A"/>
    <circle cx="${lotX}" cy="${lotY}" r="9" fill="none" stroke="#15171A" stroke-opacity="0.3"/>
    <text x="${lotX + 14}" y="${lotY - 8}" font-family="-apple-system, Segoe UI, sans-serif" font-size="11" fill="#15171A">measured lot</text>
    <text x="${W - pad.r}" y="${H - 8}" text-anchor="end" font-family="-apple-system, Segoe UI, sans-serif" font-size="11" fill="#6B7280">lot mean E · MPa</text>
    <text x="14" y="${(pad.t + (H - pad.b)) / 2}" font-family="-apple-system, Segoe UI, sans-serif" font-size="11" fill="#6B7280" transform="rotate(-90 14 ${(pad.t + (H - pad.b)) / 2})" text-anchor="middle">batch strength · MPa</text>
  </svg>`;
}

// ---------------------------------------------------------------------------
// v0.3 Known-lot print recipe + QC record + sustained-load advisory
// ---------------------------------------------------------------------------
function renderQC() {
  const m = state.material;
  const q = state.qc;
  const set = (sel, value) => {
    const el = $(sel);
    if (el && document.activeElement !== el && value != null && value !== '') el.value = value;
  };
  set('#qc-lot-id', q.lotId || 'LOT-2026-014');
  set('#qc-supplier', q.supplier || 'Recycled Polymer Co.');
  set('#qc-recycled', q.recycledPct == null ? 78 : q.recycledPct);
  set('#qc-e', q.e == null ? Math.round(m.E_mean) : q.e);
  set('#qc-sy', q.sy == null ? Math.round(m.sy_mean * 10) / 10 : q.sy);
  set('#qc-cv', q.cv == null ? V03.measurementCvDefault * 100 : q.cv);
  set('#qc-mfi', q.mfi);
  set('#qc-density', q.density);
  set('#qc-tensile-row', q.tensileRow);
}
function qcRecord() {
  const num = (sel, fallback) => {
    const v = Number($(sel)?.value);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  };
  return {
    lotId: ($('#qc-lot-id')?.value || '').trim(),
    supplier: ($('#qc-supplier')?.value || '').trim(),
    recycledPct: num('#qc-recycled', null),
    e: num('#qc-e', state.material.E_mean),
    sy: num('#qc-sy', state.material.sy_mean),
    cv: num('#qc-cv', V03.measurementCvDefault * 100),
    mfi: num('#qc-mfi', null),
    density: num('#qc-density', null),
    tensileRow: ($('#qc-tensile-row')?.value || '').trim(),
    notUsedNote: 'MFI / density / tensile row recorded for traceability only — NOT used in the simulation (no calibrated proxy).',
    recycledContentNote: 'Recycled-content % is a paperwork claim — not simulated or verified.',
    designStageNoDeliveredLot: !($('#qc-lot-id')?.value || '').trim(),
  };
}
function recipeVerdictKind(verdict) {
  if (/reject/i.test(verdict)) return 'reject';
  if (/conditional/i.test(verdict)) return 'compensate';
  if (/compensation/i.test(verdict)) return 'compensate';
  return 'pass';
}
function renderRecipe() {
  const p = state.proof;
  const host = $('#recipe-multipliers');
  const summary = $('#recipe-summary');
  if (!host) return;
  const r = p && p.recipe;
  const target = state.brief.targetPf;
  if (!r) {
    host.innerHTML = '';
    if (summary) summary.textContent = 'Recompute to see the lot-specific recipe.';
    return;
  }
  host.innerHTML = r.width_multipliers.map((v, i) => `
    <div class="recipe-mult ${v > 1.15 ? 'is-heavy' : ''}" title="Width multiplier for control ${i + 1}">
      <div class="rm-k">C${i + 1}</div><div class="rm-v">${v.toFixed(2)}×</div>
    </div>`).join('');
  const pr = r.printability || {};
  if (summary) {
    summary.innerHTML = `
      <span>Estimated printed mass <b>${nf(r.printed_mass_g, 2)} g</b> · high-side estimate <b>${nf(r.printed_mass_analytic_g, 2)} g</b></span>
      <span>Added mass <b>${signed(r.added_mass_pct, 1)} %</b> vs as-designed</span>
      <span>Failure chance for this batch <b>${fmtPf(r.pf)}</b> · target ${fmtPf(target)}</span>
      <span>Measurement CV <b>${nf(r.measurement_cv * 100, 0)} %</b> retained</span>
      <span>Printability <b>${r.printability_pass ? 'pass' : 'warn'}</b> · ratio ${nf(pr.max_neighbour_width_ratio, 2)} · L/w ${nf(pr.max_slenderness, 1)}</span>
      <span>Global equivalent <b>${r.global_equivalent_scale.toFixed(2)}×</b> (slicer setting only)</span>`;
  }
  const verdict = $('#passport-verdict');
  const icon = $('#verdict-icon');
  const title = $('#verdict-title');
  const body = $('#verdict-body');
  if (verdict) {
    verdict.dataset.kind = recipeVerdictKind(r.verdict);
    icon.textContent = /reject/i.test(r.verdict) ? '✕' : /conditional/i.test(r.verdict) ? '!' : '✓';
    title.textContent = r.verdict.toUpperCase();
    body.textContent = `Eight-zone resize · global equivalent ${r.global_equivalent_scale.toFixed(2)}× · estimated printed mass ${nf(r.printed_mass_g, 2)} g (${signed(r.added_mass_pct, 1)} %) · failure chance ${fmtPf(r.pf)} against ${fmtPf(target)}${/conditional/i.test(r.verdict) ? ' — a lot of extra material; check with the supplier before printing.' : /reject/i.test(r.verdict) ? ' — use this batch for a non-structural part.' : '.'}`;
  }
}
function renderSustained() {
  const p = state.proof;
  const host = $('#sustained-values');
  if (!host) return;
  const s = p && p.sustained;
  if (!s) { host.textContent = '—'; return; }
  const qualified = s.pf_bound <= state.brief.targetPf;
  const card = $('#sustained-card');
  if (card) card.classList.toggle('is-warn', !qualified);
  const badge = $('#sustained-badge');
  if (badge) {
    badge.dataset.kind = qualified ? 'engine' : 'fallback';
    badge.innerHTML = `<span class="b-dot"></span>${qualified ? 'rough check · inside target' : 'not cleared for long-term load'}`;
  }
  host.innerHTML = `
    <span>Failure chance under long-term assumptions <b>${fmtPf(s.pf_bound)}</b> vs target ${fmtPf(state.brief.targetPf)}</span>
    <span>Deflection bound <b>${nf(s.deflection_bound_mm, 2)} mm</b> (creep ×${nf(s.creep_factor, 1)})</span>
    <span>E_req bound <b>${nf(s.E_req_bound_MPa, 0)} MPa</b> (static ${nf(state.proof.optimizedAnalysis.demands.E_req, 0)} MPa ×${nf(s.creep_factor, 1)})</span>
    <span>Strength demand under long-term assumptions <b>${nf(s.sigma_req_bound_MPa, 1)} MPa</b> (static ${nf(state.proof.optimizedAnalysis.demands.sigma_y_req, 1)} MPa ÷${nf(s.compression_factor, 1)})</span>`;
  const note = $('#sustained-note');
  if (note) note.textContent = qualified
    ? 'A rough check only — it stays inside your failure target. The main design result above is unchanged; this is not a physical long-term test.'
    : 'Do not use this part for long-term or compressive load without physical test data: the rough long-term check exceeds your failure target. The main design result above is unchanged.';
}
function recomputeRecipe() {
  const p = state.proof;
  if (!p) return;
  const readNum = (sel, fallback) => {
    const v = Number($(sel)?.value);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  };
  state.qc.e = readNum('#qc-e', state.material.E_mean);
  state.qc.sy = readNum('#qc-sy', state.material.sy_mean);
  state.qc.cv = readNum('#qc-cv', V03.measurementCvDefault * 100);
  state.qc.lotId = ($('#qc-lot-id')?.value || '').slice(0, 64);
  state.qc.supplier = ($('#qc-supplier')?.value || '').slice(0, 64);
  state.qc.recycledPct = readNum('#qc-recycled', null);
  state.qc.mfi = readNum('#qc-mfi', null);
  state.qc.density = readNum('#qc-density', null);
  state.qc.tensileRow = ($('#qc-tensile-row')?.value || '').slice(0, 128);
  const btn = $('#btn-recipe');
  if (btn) { btn.disabled = true; btn.textContent = 'Computing…'; }
  setTimeout(() => {
    try {
      p.recipe = O.lotSpecificRecipe(state.material, p.optimizedDesign, {
        targetPf: state.brief.targetPf,
        measurementCv: state.qc.cv / 100,
        lotE: state.qc.e,
        lotSy: state.qc.sy,
        F: state.brief.loadN,
        uLim: state.brief.deflLimitMm,
      });
      p.qc = { ...state.qc };
      p.passport = { eRatio: 1, syRatio: 1, lotE: state.qc.e, lotSy: state.qc.sy, adapt: null };
      renderRecipe();
      renderQC();
      persist();
      toast(`Lot recipe: ${p.recipe.verdict} · ${nf(p.recipe.printed_mass_g, 2)} g printed · +${nf(p.recipe.added_mass_pct, 1)} %`);
    } catch (err) {
      console.error(err);
      toast('Recipe computation failed — see console', 'err');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Recompute recipe'; }
    }
  }, 40);
}
function wireRecipe() {
  $('#btn-recipe')?.addEventListener('click', recomputeRecipe);
  ['#qc-e', '#qc-sy', '#qc-cv'].forEach((sel) => {
    $(sel)?.addEventListener('change', debounce(() => { if (state.proof) recomputeRecipe(); }, 500));
  });
  ['#qc-lot-id', '#qc-supplier', '#qc-recycled', '#qc-mfi', '#qc-density', '#qc-tensile-row'].forEach((sel) => {
    $(sel)?.addEventListener('change', () => {
      const rec = qcRecord();
      state.qc = { ...state.qc, ...rec };
      persist();
    });
  });
  $$('[data-lot]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const kind = chip.dataset.lot;
      const eRatio = kind === 'weak' ? 0.8 : kind === 'reject' ? 0.5 : 1.0;
      if (!state.proof) { toast('Run the proof step first'); return; }
      state.qc.e = state.material.E_mean * eRatio;
      state.qc.sy = state.material.sy_mean * (kind === 'weak' ? 0.95 : 1.0);
      renderQC();
      recomputeRecipe();
    });
  });
}

// ---------------------------------------------------------------------------
// Brief feasibility gate (widest printable uniform lattice vs target)
// ---------------------------------------------------------------------------
function renderBrittle(br, where) {
  const host = $(where === 'proof' ? '#proof-brittle-values' : '#brittle-values');
  const badge = $(where === 'proof' ? '#proof-brittle-badge' : '#brittle-badge');
  const note = $(where === 'proof' ? '#proof-brittle-note' : '#brittle-note');
  if (!host) return;
  if (!br) { host.textContent = '—'; return; }
  const warn = br.brittle_ok === false;
  host.innerHTML = `
    <div><span class="micro">Stretch the design needs</span><b>${nf(br.strain_req_pct, 3)} %</b></div>
    <div><span class="micro">Stretch at break</span><b>${nf(br.elongation_mean_pct, 1)} % <span style="color:var(--muted);font-size:11px">variation ${nf(br.elongation_cv * 100, 0)} %</span></b></div>
    <div><span class="micro">Separate crack risk</span><b>${fmtPf(br.pf_brittle)}</b></div>
    <div><span class="micro">Extra estimate · main + crack risk</span><b>${fmtPf(br.pf_brittle_bound)}</b></div>
    <div class="${warn ? 'is-warn' : ''}"><span class="micro">Check</span><b>${warn ? 'review this batch' : 'stretch margin OK'}</b></div>`;
  if (badge) badge.innerHTML = `<span class="b-dot"></span>separate check · not in main failure chance`;
  if (note) note.textContent = `${br.brittle_note || ''} The needed stretch is the required stress divided by average stiffness; the capacity comes from printed test data. The link between stiffness and stretch is assumed ${nf(br.corr_E_elong_assumed ?? br.corr_E_elong ?? -0.25, 2)}.`;
}
function renderAssumptions(a) {
  const host = $('#assumptions-values');
  if (!host) return;
  if (!a) { host.textContent = '—'; return; }
  const corr = Array.isArray(a.corr_range) ? a.corr_range : [];
  const split = Array.isArray(a.split_range) ? a.split_range : [];
  host.innerHTML = `<div class="assumption-band" style="grid-column:1/-1">Failure chance range <b>${fmtPf(a.pf_min)} – ${fmtPf(a.pf_max)}</b> across the two unmeasured inputs</div>
    <div><span class="micro">Stiffness–strength link 0.30 / 0.70</span><br>${corr.map((x) => `<b>${fmtPf(x.pf)}</b>`).join(' &nbsp;·&nbsp; ')}</div>
    <div><span class="micro">Batch-vs-within spread 75 % / 95 %</span><br>${split.map((x) => `<b>${fmtPf(x.pf)}</b>`).join(' &nbsp;·&nbsp; ')}</div>`;
  const badge = $('#assumptions-badge');
  if (badge) badge.innerHTML = '<span class="b-dot"></span>sensitivity check · not validation';
}
function renderFeasibility() {
  const familyGate = $('#family-gate');
  const processGate = $('#process-gate');
  if (!familyGate) return;
  const target = state.brief.targetPf;
  const ff = E.familyFeasibility(state.material, {
    targetPf: target,
    F: state.brief.loadN,
    uLim: state.brief.deflLimitMm,
  });
  state.feasibility = ff;
  const btn = $('#btn-design');
  if (ff.process_ok === false) {
    processGate.hidden = false;
    familyGate.hidden = true;
    const sub = $('#process-gate-sub');
    if (sub) sub.textContent = 'These numbers come from moulded parts, so they do not describe a 3D-printed lattice. Choose rPETG (printed), or use this preset only for comparison.';
    const facts = $('#process-gate-facts');
    if (facts) facts.innerHTML = `process <b>${esc(state.material.process)}</b> · this model needs <b>3D-printed material data</b> · ${esc(state.material.processNote || 'moulded-part data')}`;
    if (btn) { btn.disabled = true; btn.dataset.blocked = '1'; btn.dataset.blockReason = 'process'; btn.title = ff.detail || 'Material data is not for a printed process — Design blocked'; }
    return;
  }
  processGate.hidden = true;
  const facts = $('#family-gate-facts');
  if (!ff.feasible) {
    familyGate.hidden = false;
    if (facts) facts.innerHTML = `widest struts <b>${nf(ff.max_width_mm, 2)} mm</b> · best failure chance <b>${fmtPf(ff.min_achievable_pf)}</b> vs target ${fmtPf(target)} · needs <b>${nf(ff.sigma_req_MPa, 1)} MPa</b> strength / <b>${nf(ff.E_req_MPa, 0)} MPa</b> stiffness`;
    if (btn) { btn.disabled = true; btn.dataset.blocked = '1'; btn.dataset.blockReason = 'infeasible'; btn.title = 'This bracket family cannot meet the target — change the target, load or material'; }
  } else {
    familyGate.hidden = true;
    if (btn && btn.dataset.blocked === '1') { btn.disabled = false; delete btn.dataset.blocked; delete btn.dataset.blockReason; btn.title = ''; }
  }
}
// ---------------------------------------------------------------------------
// Validation + claims// ---------------------------------------------------------------------------
// Validation + claims
// ---------------------------------------------------------------------------
async function loadValidation() {
  const fallback = AC.validationFallback();
  const tryFetch = async (url) => {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = setTimeout(() => controller && controller.abort(), 1600);
      const res = await fetch(url, { headers: { accept: 'application/json' }, signal: controller ? controller.signal : undefined });
      clearTimeout(timer);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) { return null; }
  };
  const live = await tryFetch(apiUrl('/api/validation'));
  const local = live || await tryFetch('validation/results.json');
  if (!local) return fallback;
  const checks = Array.isArray(local.checks) ? local.checks : null;
  if (checks && checks.length) {
    // Group the 46 validator checks by category for the quiet checklist.
    const groups = new Map();
    for (const chk of checks) {
      const cat = chk.category || 'other';
      const label = String(cat);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(chk);
    }
    const grouped = Array.from(groups.entries()).map(([label, arr]) => {
      const warn = arr.some((x) => /warn/i.test(x.status || ''));
      const fail = arr.some((x) => /fail/i.test(x.status || ''));
      const status = fail ? 'fail' : warn ? 'warn' : 'pass';
      const pass = arr.filter((x) => /pass/i.test(x.status || '')).length;
      const first = arr[0] || {};
      return {
        id: label.split(':')[0] || label,
        title: label.replace(/^[A-Z]:\s*/, ''),
        detail: `${pass}/${arr.length} pass${warn ? ' · 1 quantified warning (conservative)' : ''}${fail ? ' · 1 failure — review' : ''}${first.geometry ? ` · ${first.geometry}` : ''}`,
        status,
      };
    });
    const counts = local.summary
      ? { PASS: local.summary.PASS, WARN: local.summary.WARN, FAIL: local.summary.FAIL }
      : { PASS: grouped.filter((g) => g.status === 'pass').length, WARN: grouped.filter((g) => g.status === 'warn').length, FAIL: grouped.filter((g) => g.status === 'fail').length };
    const ladder = local.claim_ladder ? Object.entries(local.claim_ladder).map(([k, v]) => ({
      id: k.startsWith('L') ? k.split('_')[0] : k,
      level: k.replace(/_/g, ' ').replace(/^L(\d)/, 'L$1 · '),
      status: v.status || 'partial',
      text: v.evidence || '',
    })) : fallback.claimLadder;
    return {
      source: local.suite ? `${local.suite} · validation/results.json` : 'validation/results.json',
      generated: local.generated_utc || local.generated_at || null,
      counts,
      checks: grouped,
      countsTotal: local.summary ? local.summary.total : local.total,
      total: local.summary ? local.summary.total : local.total,
      runtime_s: local.summary ? local.summary.runtime_s : null,
      claimLadder: ladder,
      modelFormLimitations: local.model_form_limitations || fallback.modelFormLimitations,
    };
  }
  if (local.counts && local.total) {
    return {
      source: 'validation summary',
      counts: local.counts,
      checks: fallback.checks,
      countsTotal: local.total,
      total: local.total,
      claimLadder: fallback.claimLadder,
      modelFormLimitations: fallback.modelFormLimitations,
    };
  }
  return fallback;
}
function renderValidation() {
  const list = $('#validation-list');
  const v = state.validation || AC.validationFallback();
  if (list) {
    list.innerHTML = v.checks.map((c) => {
      const warn = c.status && c.status !== 'pass';
      return `<div class="check-row">
        <span class="c-icon ${warn ? 'is-warn' : ''}">${warn ? ICONS.warn : ICONS.check}</span>
        <span><span class="c-name">${esc(c.title)}</span><span class="c-detail">${esc(c.detail)}</span></span>
        <span class="c-status ${warn ? 'is-warn' : ''}">${esc(c.status || 'pass')}</span>
      </div>`;
    }).join('');
  }
  const counts = v.counts || { PASS: v.checks.filter((c) => c.status === 'pass').length, WARN: v.checks.filter((c) => c.status && c.status !== 'pass').length, FAIL: 0 };
  const total = v.countsTotal || v.total || v.checks.length;
  const foot = $('#validation-foot');
  if (foot) {
    const runtime = v.runtime_s ? ` · ${Number(v.runtime_s).toFixed(1)} s` : '';
    foot.textContent = `${counts.PASS} passed · ${counts.WARN} warning${counts.WARN === 1 ? '' : 's'} · ${counts.FAIL} failed · ${total} checks${runtime}`;
  }
  const sub = $('#validation-sub');
  if (sub) sub.textContent = 'The maths and code were checked by a separate script. No physical tests yet.';
  const pill = $('#validation-pill');
  if (pill) pill.innerHTML = `<span class="p-dot"></span>${counts.FAIL ? 'needs review' : counts.WARN ? 'model checked · notes' : 'model checked'}`;
  const link = $('#validation-link');
  if (link) { link.href = 'validation/VALIDATION.md'; link.textContent = 'See the checks ↗'; }
}
function renderClaims() {
  const host = $('#claims-list');
  if (!host) return;
  const ladder = AC.claimsLadderFromValidation(state.validation);
  host.innerHTML = ladder.map((c) => {
    const cls = c.tone === 'green' ? 'is-green' : c.tone === 'amber' ? 'is-amber' : 'is-muted';
    const tag = /achiev/i.test(c.status) ? 'checked' : /partial/i.test(c.status) ? 'partly' : /planned/i.test(c.status) ? 'planned' : 'not yet';
    return `<div class="claim-row"><span class="cl-level">${esc(c.level)}</span><span class="cl-text">${esc(c.text)}</span><span class="cl-tag ${cls}">${tag}</span></div>`;
  }).join('');
}

// ---------------------------------------------------------------------------
// Proof memos + render image
// ---------------------------------------------------------------------------
function loadProofMemos() {
  const p = state.proof;
  if (!p) return;
  const selected = {
    analysis: p.optimizedAnalysis, pf: p.report.pfAnalytic,
    feasible: p.report.pfAnalytic <= state.brief.targetPf,
    governing: p.report.modes.governingLabel,
    sigma_y_req: p.optimizedAnalysis.demands.sigma_y_req,
    E_req: p.optimizedAnalysis.demands.E_req,
    deflection_mm: p.report.deflectionAtMeanE,
    controlWidthsMm: E.designWidths(p.optimizedDesign),
    printability: E.printabilityReport(p.optimizedAnalysis),
  };
  const payload = AC.buildProofPayload({ brief: state.brief, selected, proof: { passport: p.passport, sustained: p.sustained, recipe: p.recipe, brittle: p.brittle, assumptions: p.assumptions, union_polished: p.union_polished, union_evals: p.union_evals, union_before_printed_g: p.union_before_printed_g, union_after_printed_g: p.union_after_printed_g }, validation: state.validation });
  const badge = $('#proof-memo-badge');
  (async () => {
    try {
      const res = await ai.proofMemo(payload);
      p.proofMemo = res;
      renderProofMemo(res);
      const kind = res.fallback || res.live === false ? 'fallback' : 'live';
      badge.dataset.kind = kind;
      badge.innerHTML = `<span class="b-dot"></span>${esc(res.provenance ? res.provenance.model : 'AI assistant')}${res.provenance ? ` · ${(res.provenance.latencyMs / 1000).toFixed(2)} s` : ''} · ${kind}${res.grounded === false ? ' · fallback (numbers not checked)' : ' · numbers checked'}`;
    } catch (err) {
      console.error(err);
      renderProofMemo({ memo: AC.fallbackProofMemo(payload).memo, fallback: true, nextTest: '' });
    }
  })();
  (async () => {
    try {
      const r = await ai.renderIllustration({
        prompt: `${state.brief.partType} in recycled ${state.brief.preset}, ${nf(p.optimizedAnalysis.mass_g, 1)} g graded lattice`,
        design: { mass_g: p.optimizedAnalysis.mass_g, widths_mm: E.designWidths(p.optimizedDesign) },
      });
      p.render = r;
      renderRenderCard(r);
    } catch (err) {
      console.error(err);
      renderRenderCard(null);
    }
  })();
}
function renderProofMemo(res) {
  const body = $('#proof-memo-body');
  if (!body || !res) return;
  body.innerHTML = highlightNumbers(res.memo || '');
  const actions = $('#proof-memo-actions');
  const tests = res.recommendedTests && res.recommendedTests.length ? res.recommendedTests.slice(0, 2) : [res.nextTest || 'Measure stiffness and strength on three incoming batches'].filter(Boolean);
  actions.innerHTML = tests.map((t) => `<button class="btn btn--sm btn--ghost" type="button">${esc(t)}</button>`).join('');
  actions.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => toast(`${b.textContent} — added to review list`)));
  const risk = $('#proof-memo-risk');
  if (risk) risk.textContent = res.keyRisk ? `Key risk: ${res.keyRisk}` : '';
}
function renderRenderCard(render) {
  const frame = $('#render-frame');
  const cap = $('#render-caption');
  const b = $('#render-badge');
  if (!frame) return;
  const liveImage = render && render.imageUrl && !render.fallback;
  if (liveImage) {
    frame.innerHTML = `<img src="${render.imageUrl}" alt="AI illustration of the bracket — not the CAD model" loading="lazy">`;
    cap.textContent = render.label || 'AI illustration — not the CAD model.';
    if (b) {
      b.dataset.kind = 'live';
      b.innerHTML = `<span class="b-dot"></span>${esc(render.model || 'Muse Image 1.0')} · live`;
    }
  } else if (PRODUCT_RENDER_DATA_URL) {
    // Embedded Muse Image demo render (labelled illustration; used offline / when /api/image/render is unavailable).
    frame.innerHTML = `<img src="${PRODUCT_RENDER_DATA_URL}" alt="AI illustration of the bracket — not the CAD model">`;
    cap.textContent = PRODUCT_RENDER_LABEL;
    if (b) {
      b.dataset.kind = 'fallback';
      b.innerHTML = `<span class="b-dot"></span>${esc(PRODUCT_RENDER_MODEL)}${render && render.fallback ? ' · offline' : ''}`;
    }
  } else {
    const svg = AC.fallbackRenderSvg({ facts: { part_type: state.brief.partType, widths_mm: state.proof ? E.designWidths(state.proof.optimizedDesign) : [] } });
    frame.innerHTML = svg.svg;
    cap.textContent = 'Offline illustration — generated locally, not the CAD model.';
    if (b) { b.dataset.kind = 'fallback'; b.innerHTML = '<span class="b-dot"></span>offline illustration · local'; }
  }
}

// ---------------------------------------------------------------------------
// Provenance drawer
// ---------------------------------------------------------------------------
function openDrawer() {
  const drawer = $('#drawer');
  if (!drawer) return;
  renderProvenance();
  drawer.classList.add('is-open');
  drawer.setAttribute('aria-hidden', 'false');
  $('#scrim')?.classList.add('is-open');
  $('#drawer-close')?.focus();
  toast(`AI activity · ${state.aiCalls.length} request${state.aiCalls.length === 1 ? '' : 's'} in this run`);
}
function closeDrawer() {
  $('#drawer')?.classList.remove('is-open');
  $('#drawer')?.setAttribute('aria-hidden', 'true');
  $('#scrim')?.classList.remove('is-open');
  $('#btn-provenance')?.focus();
}
function renderProvenance() {
  const body = $('#drawer-body');
  if (!body) return;
  const calls = state.aiCalls;
  const fallbackCount = calls.filter((c) => c.fallback).length;
  const cached = calls.filter((c) => c.cached).length;
  const avg = calls.length ? calls.reduce((s, c) => s + (c.latencyMs || 0), 0) / calls.length : 0;
  const summary = `<div class="prov-summary">
    <div class="prov-stat"><div class="ps-k">Requests</div><div class="ps-v">${calls.length}</div></div>
    <div class="prov-stat"><div class="ps-k">Average time</div><div class="ps-v">${(avg / 1000).toFixed(2)} s</div></div>
    <div class="prov-stat"><div class="ps-k">Fallback / cached</div><div class="ps-v">${fallbackCount} / ${cached}</div></div>
  </div>`;
  if (!calls.length) {
    body.innerHTML = summary + '<div class="drawer-empty">No AI requests yet.<br>Run “Design with AI” to see which model answered, how long it took, whether it was cached, and whether it fell back.</div>';
    return;
  }
  body.innerHTML = summary + '<div class="prov-list">' + calls.slice().reverse().map((c) => {
    const status = c.demo ? 'mock' : c.fallback ? 'fallback' : 'live';
    return `<div class="prov-row">
      <div class="pr-top"><span class="pr-endpoint">${esc(c.endpoint)}</span><span class="pr-status ${status}">${status}</span></div>
      <div class="pr-meta">
        <span class="pr-model">${esc(c.model)}</span>
        <span>${(c.latencyMs / 1000).toFixed(2)} s</span>
        <span>${c.cached ? 'cached' : 'fresh'}</span>
        <span>${c.schemaOk ? 'schema ok' : 'schema issue'}</span>
        ${c.grounding ? `<span>${esc(c.grounding)}</span>` : ''}
      </div>
      <details><summary>Raw response</summary><pre>${esc(JSON.stringify(c, null, 2))}</pre></details>
    </div>`;
  }).join('') + '</div>';
}
function wireDrawer() {
  $('#btn-provenance')?.addEventListener('click', openDrawer);
  $('#ai-menu-prov')?.addEventListener('click', () => { $('#ai-menu').hidden = true; openDrawer(); });
  $('#btn-why-memo')?.addEventListener('click', openDrawer);
  $('#drawer-close')?.addEventListener('click', closeDrawer);
  $('#scrim')?.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if ($('#drawer')?.classList.contains('is-open')) closeDrawer();
      if (!$('#ai-menu')?.hidden) $('#ai-menu').hidden = true;
    }
  });
  $('#drawer-copy')?.addEventListener('click', async () => {
    const text = JSON.stringify({ session: DEFAULTS.seed, mode: state.aiMode, calls: state.aiCalls }, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      toast('AI activity copied');
    } catch (err) {
      toast('Copy blocked — export the AI activity log instead', 'err');
    }
  });
}

// ---------------------------------------------------------------------------
// AI menu / mic / datasheet / lab / help
// ---------------------------------------------------------------------------
function wireAIMenu() {
  const pill = $('#ai-pill');
  const menu = $('#ai-menu');
  pill?.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
    pill.setAttribute('aria-expanded', menu.hidden ? 'false' : 'true');
  });
  document.addEventListener('click', (e) => {
    if (!menu || menu.hidden) return;
    if (!menu.contains(e.target) && e.target !== pill) { menu.hidden = true; pill.setAttribute('aria-expanded', 'false'); }
  });
  $$('#ai-menu [role="menuitemradio"]').forEach((b) => {
    b.addEventListener('click', async () => {
      menu.hidden = true;
      pill.setAttribute('aria-expanded', 'false');
      const mode = b.dataset.mode;
      if (mode === 'live') {
        demo.state = null;
        await ai.detect();
        if (state.aiMode !== 'live') toast('Meta backend unreachable — staying on the offline assistant', 'err');
        else toast('Live Meta models connected');
      } else if (mode === 'offline') {
        demo.state = 'offline';
        toast('Offline mode · built-in text, calculator still local');
      } else {
        toast('Cached session · showing the last responses');
      }
      renderBanner();
    });
  });
}
async function runMic() {
  const btn = $('#btn-mic');
  const label = $('#mic-label');
  if (!btn) return;
  if (state.aiMode === 'offline') {
    toast('Voice transcription needs the Meta backend — type the brief instead', 'err');
    return;
  }
  btn.dataset.state = 'listening';
  if (label) label.textContent = 'Listening…';
  await sleep(650);
  btn.dataset.state = 'transcribing';
  if (label) label.textContent = 'Transcribing…';
  try {
    const res = await ai.transcribe(null);
    if (res.transcript) {
      const ta = $('#brief-text');
      if (ta) { ta.value = res.transcript; state.brief.notes = res.transcript; }
      updateWordCount();
    }
    toast(`Transcribed · ${res.model || 'Muse Voice Transcribe'} · ${((res.provenance && res.provenance.latencyMs) || 0) / 1000}s${res.fallback ? ' (fallback)' : ''}`);
  } catch (err) {
    console.error(err);
    toast('Voice transcription unavailable — type the brief instead', 'err');
  } finally {
    btn.dataset.state = '';
    if (label) label.textContent = 'Describe it out loud';
  }
}
function wireDatasheet() {
  $('#btn-change-preset')?.addEventListener('click', () => {
    const menu = $('#preset-menu');
    menu.hidden = !menu.hidden;
    renderPresetMenu();
  });
  $('#btn-paste-datasheet')?.addEventListener('click', () => {
    const panel = $('#lot-paste');
    panel.hidden = !panel.hidden;
    $('#btn-paste-datasheet')?.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
    if (!panel.hidden) $('#lot-text')?.focus();
  });
  $('#btn-lot-cancel')?.addEventListener('click', () => { $('#lot-paste').hidden = true; });
  $('#btn-lot-parse')?.addEventListener('click', async () => {
    const text = ($('#lot-text').value || '').trim();
    if (!text) { toast('Paste the supplier text first', 'err'); return; }
    const btn = $('#btn-lot-parse');
    btn.disabled = true;
    btn.textContent = 'Extracting…';
    try {
      const res = await ai.parseLot(text, state.brief.preset);
      state.lot = res.lot || state.lot;
      state.material = AC.materialFromLot(state.lot);
      state.lotMeta = { model: res.model, confidence: res.confidence, fallback: !!res.fallback };
      renderLot();
      renderAdvancedControls();
      renderUnderstanding();
      persist();
      toast(`Lot data extracted · confidence ${(res.confidence || 0).toFixed(2)}${res.fallback ? ' (offline heuristic)' : ''}`);
      $('#lot-paste').hidden = true;
    } catch (err) {
      console.error(err);
      toast('Lot extraction failed — preset retained', 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Extract with AI';
    }
  });
}
function renderAdvancedControls() {
  const host = $('#adv-controls');
  if (!host) return;
  host.innerHTML = '';
  const makeRange = (label, min, max, step, value, unit, onChange) => {
    const wrap = el(`<div class="adv-field"><label>${esc(label)}</label><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${esc(label)}"><output>${nf(value, 2)} ${unit}</output></div>`);
    const input = wrap.querySelector('input');
    const out = wrap.querySelector('output');
    input.addEventListener('input', () => {
      const v = Number(input.value);
      out.textContent = `${nf(v, 2)} ${unit}`;
      onChange(v);
    });
    host.appendChild(wrap);
  };
  makeRange('Load F (N)', 50, 400, 5, state.brief.loadN, 'N', (v) => { state.brief.loadN = v; renderUnderstanding(); persist(); });
  makeRange('Deflection limit (mm)', 0.5, 6, 0.1, state.brief.deflLimitMm, 'mm', (v) => { state.brief.deflLimitMm = v; renderUnderstanding(); persist(); });
  makeRange('Allowed failure chance (%)', 0.05, 5, 0.05, state.brief.targetPf * 100, '%', (v) => { state.brief.targetPf = v / 100; renderUnderstanding(); persist(); });
  makeRange('CV(E) (%)', 2, 30, 0.5, state.material.E_cv * 100, '%', (v) => { state.material.E_cv = v / 100; state.lot.E_cv = v / 100; renderLot(); persist(); });
  makeRange('Strength variation (%)', 2, 30, 0.5, state.material.sy_cv * 100, '%', (v) => { state.material.sy_cv = v / 100; state.lot.sy_cv = v / 100; renderLot(); persist(); });
  makeRange('Stiffness–strength link', -0.5, 0.9, 0.01, state.material.corr, '', (v) => { state.material.corr = v; persist(); });
  const c = selectedCandidate();
  if (c) {
    makeRange('Uniform width scale', 0.6, 1.6, 0.01, 1, '×', (v) => {
      c.controlWidthsMm = c.controlWidthsMm.map((w) => clamp(w * v, GEOMETRY.wMin, GEOMETRY.wMax));
      Object.assign(c, AC.evaluateCandidate(c, state.material, ctx(), state.brief.targetPf));
      renderCandidates();
      renderMetrics();
      renderLattice();
      renderDesignMemo(c);
    });
  }
}
function wireLab() {
  const btn = $('#btn-lab');
  btn?.addEventListener('click', () => {
    state.lab = !state.lab;
    document.body.classList.toggle('lab-on', state.lab);
    btn.setAttribute('aria-pressed', String(state.lab));
    toast(state.lab ? 'Advanced view on · model inputs visible' : 'Advanced view off');
    if (state.lab) {
      $('#advanced-brief')?.setAttribute('open', '');
      renderAdvancedControls();
    }
    persist();
  });
}
function wireHelp() {
  $('#btn-help')?.addEventListener('click', () => {
    openDrawer();
    toast('Every AI sentence is grounded in calculated numbers. See “What this can and can’t prove” on Prove.');
  });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function buildDesignJson() {
  const p = state.proof;
  const c = selectedCandidate();
  return {
    format: 'anyrb-design/v2',
    generated_at: new Date().toISOString(),
    mode: state.aiMode,
    in_silico_only: true,
    disclaimer: 'Model estimates — confirm the final design with a physical test before production.',
    project: state.project,
    brief: state.brief,
    lot: state.lot,
    candidates: state.candidates.map((x) => ({ id: x.id, name: x.name, control_widths_mm: x.controlWidthsMm, mass_g: x.mass_g, pf: x.pf, feasible: x.feasible, governing: x.governing })),
    selected: c ? { id: c.id, name: c.name, control_widths_mm: c.controlWidthsMm, mass_g: c.mass_g, pf: c.pf } : null,
    family_scope: 'best of this bracket/lattice family',
    printed_process: { process: state.material.process, print_process_ok: !!state.material.printProcessOk, note: state.material.processNote || null },
    optimized: p ? {
      design_log_width: p.optimizedDesign,
      widths_mm: E.designWidths(p.optimizedDesign),
      printed_mass_g: p.optimizedAnalysis.printed_mass_g,
      mass_analytic_upper_bound_g: p.optimizedAnalysis.mass_g,
      mass_basis: AC.massDisclosure(p.optimizedAnalysis.printed_mass_g).note,
      printability: E.printabilityReport(p.optimizedAnalysis),
      sigma_y_req_MPa: p.optimizedAnalysis.demands.sigma_y_req,
      E_req_MPa: p.optimizedAnalysis.demands.E_req,
      E_req_def_MPa: p.optimizedAnalysis.demands.E_req_def,
      E_req_buck_MPa: p.optimizedAnalysis.demands.E_req_buck,
      pf_analytic: p.report.pfAnalytic,
      pf_mc: p.report.mc.pfMc,
      pf_mc_std_error: p.report.mc.pfMcStdErr,
      governing_mode: p.report.modes.governingLabel,
      printability: E.printabilityReport(p.optimizedAnalysis),
      mass_disclosure: AC.massDisclosure(p.optimizedAnalysis.mass_g),
      union_polish: {
        polished: !!p.union_polished,
        evals: p.union_evals || 0,
        before_printed_g: p.union_before_printed_g ?? null,
        after_printed_g: p.union_after_printed_g ?? null,
        note: 'Short local pattern search minimising the 10k-sample Halton printed mass subject to P_f + printability; accepted only if the final 60k printed mass improves.',
      },
    } : null,
    sustained_load_advisory: p && p.sustained ? {
      ...p.sustained,
      qualified: p.sustained.pf_bound <= state.brief.targetPf,
      label: 'ADVISORY — not the static design allowable; static result unchanged',
    } : null,
    known_lot_recipe: p && p.recipe ? {
      lot: p.recipe.lot,
      measurement_cv: p.recipe.measurement_cv,
      width_multipliers: p.recipe.width_multipliers,
      global_equivalent_scale: p.recipe.global_equivalent_scale,
      printed_mass_g: p.recipe.printed_mass_g,
      printed_mass_analytic_g: p.recipe.printed_mass_analytic_g,
      added_mass_pct: p.recipe.added_mass_pct,
      pf: p.recipe.pf,
      verdict: p.recipe.verdict,
      printability: p.recipe.printability,
      note: 'Lot-specific 8-control resize; global equivalent scale is a slicer fallback only.',
    } : null,
    qc_record: p ? {
      lot_id: qcRecord().lotId || null,
      supplier: qcRecord().supplier || null,
      measurement_used: { E_MPa: qcRecord().e, sy_MPa: qcRecord().sy },
      measurement_cv: qcRecord().cv / 100,
      recycled_content_pct: qcRecord().recycledPct,
      mfi_g_10min: qcRecord().mfi,
      density_g_cm3: qcRecord().density,
      tensile_row: qcRecord().tensileRow || null,
      not_used_note: qcRecord().notUsedNote,
      recycled_content_note: qcRecord().recycledContentNote,
      design_stage_no_delivered_lot: !qcRecord().lotId,
    } : null,
    brittle_screen: p && p.brittle ? {
      strain_req_pct: p.brittle.strain_req_pct,
      elongation_mean_pct: p.brittle.elongation_mean_pct,
      elongation_cv: p.brittle.elongation_cv,
      pf_brittle: p.brittle.pf_brittle,
      pf_brittle_bound: p.brittle.pf_brittle_bound,
      brittle_ok: p.brittle.brittle_ok,
      included_in_headline_pf: false,
      corr_E_elong_assumed: -0.25,
      note: p.brittle.note,
    } : null,
    assumption_bounds: p && p.assumptions ? {
      ...p.assumptions,
      label: 'Assumption sensitivity — unmeasured assumptions, NOT validation.',
    } : null,
    qc_optional: {
      mfi_g_10min: state.qc.mfi,
      density_g_cm3: state.qc.density,
      tensile_row: state.qc.tensileRow,
      used_in_simulation: false,
      note: 'Recorded for traceability only — no calibrated proxy; not used to infer E or σy.',
    },
    design_stage_no_delivered_lot: !(qcRecord().lotId),
    validation: state.validation,
    ai: { mode: state.aiMode, calls: state.aiCalls },
    limitations: [
      'Linear-elastic plane-frame idealisation; no plasticity, creep, fatigue or joint behaviour.',
      'Loading across layer lines is not modelled. The PETG strength number comes from printed test parts pulled in the print direction.',
      'Optimum is local (multi-start pattern search), not proven global.',
      'Mass: the headline is an estimate of the printed part from a simulated print volume. A higher cautious estimate is shown separately.',
      'Printability: neighbour width ratio > 1.5 or slenderness > 30 is a hard constraint in the optimiser; the selected design passes both.',
      'Sustained load: the creep x2.0 / compression /0.8 bound is an advisory only; static design allowables are unchanged and no sustained-load qualification has been performed.',
      'Known lot: the lot-specific recipe retains measurement uncertainty (default CV 12 %) and re-optimises all 8 width controls; global equivalent scale is a slicer fallback.',
      'Brittleness check: a separate estimate of crack risk. It is not part of the main failure chance because the link between stiffness and stretch is assumed.',
      'Process guard: only 3D-printed material data can design this printed part. Moulded-part presets are comparison-only and block Design.',
      'The uncertainty range shows how the failure chance moves if the stiffness–strength link and batch spread are different. It is a sensitivity check, not validation.',
      'Design-stage report: no delivered lot is specified unless a lot ID/measurement is entered in the QC record.',
      'Feedstock distributions are literature-derived; no experimental validation in this project.',
    ],
  };
}
function buildReportHtml() {
  const p = state.proof;
  const b = state.brief;
  const a = p ? p.optimizedAnalysis : (selectedCandidate() ? selectedCandidate().analysis : null);
  const rep = p ? p.report : null;
  const pr = a ? E.printabilityReport(a) : null;
  const rows = state.comparison?.rows || [];
  const memo = (p?.proofMemo?.memo) || AC.fallbackProofMemo(AC.buildProofPayload({ brief: b, selected: { analysis: a, pf: rep?.pfAnalytic || 0, controlWidthsMm: [] } })).memo;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>AnyRB qualification — ${esc(state.project)}</title>
<style>
  :root{--paper:#F7F5F0;--card:#fff;--ink:#15171A;--muted:#6B7280;--line:#E4DFD3;--verify:#0B6B53;--accent:#FF5A36}
  body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.6 -apple-system,Segoe UI,sans-serif;padding:48px;max-width:900px;margin:auto}
  h1,h2{font-family:Georgia,serif;font-weight:500;letter-spacing:-.02em} h1{font-size:38px;margin:0 0 8px} h2{font-size:24px;margin:36px 0 12px}
  .micro{font-size:11px;font-weight:650;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
  .card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:22px 24px;margin:14px 0}
  table{width:100%;border-collapse:collapse;font-size:13px} th,td{text-align:right;padding:8px 10px;border-bottom:1px solid var(--line)} th:first-child,td:first-child{text-align:left}
  .badge{display:inline-block;font-family:ui-monospace,Menlo,monospace;font-size:10.5px;border:1px solid var(--line);border-radius:99px;padding:4px 9px;color:var(--muted)}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .k{color:var(--muted);font-size:12px} .v{font-family:ui-monospace,Menlo,monospace;font-size:13px}
  .memo{background:#FCFBF7} .lim{font-size:12px;color:var(--muted)}
  .tag{color:var(--verify)} .warn{color:#B8361A}
</style></head><body>
<div class="micro">AnyRB v0.4 · design and batch check · model estimates</div>
<h1>${esc(state.project)}</h1>
<div class="badge">Generated ${new Date().toISOString()} · AI mode: ${esc(state.aiMode)} · seed ${DEFAULTS.seed}</div>
<div class="card"><div class="micro">Brief</div>
<p><b>${esc(b.partType)}</b> · load ${nf(b.loadN, 0)} N · deflection limit ${nf(b.deflLimitMm, 1)} mm · reliability target ${fmtPf(b.targetPf)} · process ${esc(b.process)}</p>
<div class="k">Batch: ${esc(state.lot.name || state.lot.id)} — E ${int(state.lot.E_mean)} MPa (CV ${nf(state.lot.E_cv * 100, 1)} %), σy ${nf(state.lot.sy_mean, 1)} MPa (CV ${nf(state.lot.sy_cv * 100, 1)} %), ρ ${nf(state.lot.rho, 2)} g/cm³. ${esc(state.lot.source || '')}</div></div>
${a ? `<h2>Qualification summary</h2><div class="card"><div class="grid">
<div><div class="k">Printed mass (Halton union)</div><div class="v">${nf(a.printed_mass_g ?? a.mass_g, 3)} g</div></div>
<div><div class="k">Analytic upper bound</div><div class="v">${nf(a.mass_analytic_g ?? a.mass_g, 3)} g · ${esc(AC.massDisclosure(a.printed_mass_g ?? a.mass_g).note)}</div></div>
<div><div class="k">Governing mode</div><div class="v">${esc(rep ? rep.modes.governingLabel : '')}</div></div>
<div><div class="k">σy demand</div><div class="v">${nf(a.demands.sigma_y_req, 2)} MPa</div></div>
<div><div class="k">E demand</div><div class="v">${nf(a.demands.E_req, 1)} MPa (def ${nf(a.demands.E_req_def, 1)}, buck ${nf(a.demands.E_req_buck, 1)})</div></div>
<div><div class="k">P_f analytic (lot level)</div><div class="v ${rep && rep.pfAnalytic <= b.targetPf ? 'tag' : 'warn'}">${fmtPf(rep ? rep.pfAnalytic : 0)}</div></div>
<div><div class="k">Reliability</div><div class="v">${rep ? (rep.reliability * 100).toFixed(2) + ' %' : '—'}</div></div>
<div><div class="k">Monte-Carlo P_f (5,000)</div><div class="v">${rep ? fmtPf(rep.mc.pfMc) + ' ± ' + fmtPf(rep.mc.pfMcStdErr) : '—'}</div></div>
<div><div class="k">Tip deflection at mean E</div><div class="v">${nf(rep ? rep.deflectionAtMeanE : 0, 3)} mm · limit ${nf(b.deflLimitMm, 1)} mm</div></div>
<div><div class="k">Mass disclosure (validator F4)</div><div class="v">${esc(AC.massDisclosure(a ? a.mass_g : AC.MASS_UNION.analyticMassG).note)}</div></div>
${pr ? `<div><div class="k">Printability</div><div class="v">${pr.pass ? 'PASS' : 'WARN'} · min w ${nf(pr.min_width_mm, 2)} mm · L/w ${nf(pr.max_slenderness, 1)} · neighbour ${nf(pr.max_neighbour_width_ratio, 2)}</div></div>` : ''}
</div></div>` : ''}
<h2>Design memo</h2><div class="card memo">${esc(memo)}</div>
${rows.length ? `<h2>Strategy comparison</h2><div class="card"><p class="lim">All masses are printed/union mass (Halton QMC); analytic upper bound is not used in this table.</p><table><thead><tr><th>Strategy</th><th>Printed mass g</th><th>P_f</th><th>E_req MPa</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.label)}</td><td>${nf(r.printed_mass_g ?? r.mass_g, 2)}</td><td>${fmtPf(r.pf)}</td><td>${nf(r.E_req, 1)}</td></tr>`).join('')}</tbody></table></div>` : ''}
${p ? `<h2>Batch passport</h2><div class="card"><div class="k">Measured lot</div><div class="v">E ${nf(p.passport.lotE, 0)} MPa (${p.passport.eRatio.toFixed(2)} ×), σy ${nf(p.passport.lotSy, 1)} MPa (${p.passport.syRatio.toFixed(2)} ×)</div>
<div class="k" style="margin-top:8px">Verdict</div><div class="v">${esc(p.passport.adapt.verdict)} · required width scale ${p.passport.adapt.scale == null ? 'not achievable' : nf(p.passport.adapt.scale, 2) + ' ×'} · added mass ${p.passport.adapt.addedMassPct == null ? '—' : signed(p.passport.adapt.addedMassPct, 1) + ' %'}</div>
<p class="lim">Illustrative v0.1 logic; supplier proxies should replace assumed lot means before production decisions.</p></div>` : ''}
${p && p.sustained ? `<h2>Sustained-load advisory</h2><div class="card"><div class="v">${p.sustained.pf_bound <= b.targetPf ? 'Inside the reliability target under the creep/compression bound.' : '<b class="warn">NOT qualified for sustained load.</b> The creep x2.0 / compression /0.8 bound exceeds the target; the static result is unchanged.'}</div>
<div class="k" style="margin-top:8px">P_f bound ${fmtPf(p.sustained.pf_bound)} · deflection bound ${nf(p.sustained.deflection_bound_mm, 2)} mm · E_req bound ${nf(p.sustained.E_req_bound_MPa, 0)} MPa · σy_req bound ${nf(p.sustained.sigma_req_bound_MPa, 1)} MPa</div>
<p class="lim">Advisory for long-term loads; never the static design allowable.</p></div>` : ''}
${p && p.recipe ? `<h2>Known-batch print recipe</h2><div class="card"><p class="lim">Lot-specific 8-control resize (not one global scale), measurement CV ${nf(p.recipe.measurement_cv * 100, 0)} % retained.</p>
<div class="v">Width multipliers: ${p.recipe.width_multipliers.map((v) => nf(v, 2) + '×').join(' · ')}</div>
<div class="k" style="margin-top:8px">Global equivalent scale ${nf(p.recipe.global_equivalent_scale, 2)}× (slicer fallback only) · printed mass ${nf(p.recipe.printed_mass_g, 2)} g (${signed(p.recipe.added_mass_pct, 1)} %) · P_f ${fmtPf(p.recipe.pf)} · verdict <b>${esc(p.recipe.verdict)}</b></div>
<div class="k" style="margin-top:8px">QC record: lot ${esc(qcRecord().lotId || '—')} · supplier ${esc(qcRecord().supplier || '—')} · measurement used E ${nf(qcRecord().e, 0)} MPa / σy ${nf(qcRecord().sy, 1)} MPa · measurement CV ${nf(qcRecord().cv, 0)} % · recycled content ${qcRecord().recycledPct == null ? '—' : nf(qcRecord().recycledPct, 0) + ' %'} <i>(paperwork claim, not simulated)</i></div>
<div class="k" style="margin-top:4px">MFI ${qcRecord().mfi == null ? '—' : nf(qcRecord().mfi, 1) + ' g/10 min'} · density ${qcRecord().density == null ? '—' : nf(qcRecord().density, 2) + ' g/cm³'} · tensile row ${esc(qcRecord().tensileRow || '—')} <i>(traceability only — NOT used in the simulation; no calibrated proxy)</i></div>
${qcRecord().designStageNoDeliveredLot ? '<p class="lim"><b>Design-stage report:</b> no delivered lot specified — this report is a design-stage prediction, not a batch qualification. Enter lot ID/measurements in the QC record or use the known-batch print recipe before release.</p>' : ''}</div>` : ''}
${p && p.brittle ? `<h2>Brittle-lot screen (NOT in headline P_f)</h2><div class="card"><div class="grid">
<div><div class="k">Peak strain demand</div><div class="v">${nf(p.brittle.strain_req_pct, 3)} %</div></div>
<div><div class="k">Elongation capacity</div><div class="v">${nf(p.brittle.elongation_mean_pct, 1)} % · CV ${nf(p.brittle.elongation_cv * 100, 0)} %</div></div>
<div><div class="k">Marginal P_f (brittle)</div><div class="v">${fmtPf(p.brittle.pf_brittle)}</div></div>
<div><div class="k">Add-on estimate (not a formal bound)</div><div class="v">${fmtPf(p.brittle.pf_brittle_bound)}</div></div>
</div><p class="lim">Marginal lognormal screen, reported separately and NOT folded into the headline two-property P_f because the E-elongation correlation is assumed (-0.25). ${esc(p.brittle.brittle_ok ? 'Brittle margin OK.' : 'Brittle-lot warning.')}</p></div>` : ''}
${p && p.assumptions ? `<h2>Assumption sensitivity (not validation)</h2><div class="card"><div class="k">P_f range across unmeasured assumptions: <b>${fmtPf(p.assumptions.pf_min)} – ${fmtPf(p.assumptions.pf_max)}</b></div>
<div class="k" style="margin-top:6px">corr(lnE, lnσy) 0.30 / 0.70: ${p.assumptions.corr_range.map((x) => fmtPf(x.pf)).join(' · ')}</div>
<div class="k" style="margin-top:4px">lot-vs-within split 75 % / 95 %: ${p.assumptions.split_range.map((x) => fmtPf(x.pf)).join(' · ')}</div>
<p class="lim">Assumption sensitivity, NOT validation: correlation and variance split are unmeasured model inputs.</p></div>` : ''}
<h2>Validation</h2><div class="card">${state.validation.checks.map((x) => `<div style="padding:6px 0;border-bottom:1px solid var(--line)"><b>${esc(x.title)}</b> <span class="badge">${esc(x.status)}</span><br><span class="lim">${esc(x.detail)}</span></div>`).join('')}
<p class="lim">Source: ${esc(state.validation.source || 'embedded fallback')}</p></div>
<h2>AI provenance</h2><div class="card"><table><thead><tr><th>Endpoint</th><th>Model</th><th>Latency</th><th>Status</th></tr></thead><tbody>${state.aiCalls.map((cl) => `<tr><td>${esc(cl.endpoint)}</td><td>${esc(cl.model)}</td><td>${(cl.latencyMs / 1000).toFixed(2)} s</td><td>${cl.demo ? 'mock' : cl.fallback ? 'fallback' : 'live'}${cl.cached ? ' · cached' : ''}</td></tr>`).join('') || '<tr><td colspan="4">No AI calls recorded</td></tr>'}</tbody></table></div>
<h2>What to check before production</h2><div class="card"><p class="lim"><b>These are model estimates, not measurements.</b> The part is represented in 2-D with simplified physics; material data comes from published studies; the design is a local best, not a proven global one; and nothing has been physically tested. Use this to choose a design and a batch, then confirm with a physical test.</p></div>
</body></html>`;
}
function wireExports() {
  $$('#export-buttons [data-export]').forEach((btn) => {
    btn.addEventListener('click', () => {
      try {
        const kind = btn.dataset.export;
        const stamp = new Date().toISOString().slice(0, 10);
        if (kind === 'report') {
          download(new Blob([buildReportHtml()], { type: 'text/html' }), `anyrb_qualification_${stamp}.html`);
          toast('Qualification report queued');
        } else if (kind === 'stl') {
          const a = state.proof ? state.proof.optimizedAnalysis : (selectedCandidate() ? selectedCandidate().analysis : null);
          if (!a) throw new Error('no design');
          const stl = buildBinarySTL(a);
          download(new Blob([stl.buffer], { type: 'model/stl' }), stlFileName(a, state.material));
          toast(`STL exported · ${stl.boxCount} boxes / ${stl.triangleCount} triangles`);
        } else if (kind === 'json') {
          download(new Blob([JSON.stringify(buildDesignJson(), null, 2)], { type: 'application/json' }), `anyrb_design_${stamp}.json`);
          toast('Design JSON exported');
        } else if (kind === 'provenance') {
          download(new Blob([JSON.stringify({ session: DEFAULTS.seed, mode: state.aiMode, calls: state.aiCalls, exported_at: new Date().toISOString() }, null, 2)], { type: 'application/json' }), `anyrb_provenance_${stamp}.json`);
          toast('AI activity log exported');
        }
      } catch (err) {
        console.error(err);
        toast('Export failed — see console', 'err');
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
function showAIError(err) {
  const banner = $('#banner');
  if (!banner) return;
  banner.hidden = false;
  banner.dataset.kind = 'error';
  $('#banner-title').textContent = 'The AI partner didn’t respond.';
  $('#banner-body').textContent = `Using the built-in reader (${String(err && err.message || 'request failed').slice(0, 120)}). The calculated numbers are unchanged.`;
  $('#banner-actions').innerHTML = '<button class="btn btn--sm" id="banner-retry2" type="button">Retry AI</button><button class="btn btn--sm btn--ghost" id="banner-dismiss2" type="button">Continue offline</button>';
  $('#banner-retry2')?.addEventListener('click', () => ai.detect().then(() => { hideAIError(); toast('Retrying AI connection…'); }));
  $('#banner-dismiss2')?.addEventListener('click', hideAIError);
  const errorCard = $('#understanding-error');
  if (errorCard) errorCard.hidden = false;
}
function hideAIError() {
  const banner = $('#banner');
  if (banner && banner.dataset.kind === 'error') banner.hidden = true;
  const card = $('#understanding-error');
  if (card) card.hidden = true;
}

// ---------------------------------------------------------------------------
// Static wiring + boot
// ---------------------------------------------------------------------------
function buildStatic() {
  $$('[data-example]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.example;
      const map = {
        bracket: 'A wall bracket for a recycled PETG shelf unit. 150 N tip load, 2.5 mm max tip deflection, 1 % failure target across delivered lots. Print it upright in rPETG on a 0.4 mm nozzle.',
        tighter: 'A stiff bracket for a recycled PETG enclosure. 150 N tip load, but only 1.2 mm tip deflection allowed; 1 % failure target across delivered lots. FDM in rPETG.',
        heavy: 'A heavy-duty wall bracket for a recycled PETG shelf. 300 N tip load, 3 mm tip deflection limit, 2 % failure target across lots; must fit on a 220 mm bed, printed in rPETG.',
      };
      const ta = $('#brief-text');
      if (ta) {
        ta.value = map[id] || map.bracket;
        state.brief.notes = ta.value;
        updateWordCount();
        ta.focus();
        toast('Example filled in — press “Design with AI” when ready');
      }
    });
  });
  $('#brief-text')?.addEventListener('input', () => { updateWordCount(); state.brief.notes = $('#brief-text').value; });
  $('#btn-design')?.addEventListener('click', runDesignFlow);
  $('#btn-mic')?.addEventListener('click', runMic);
  $('#btn-back-brief')?.addEventListener('click', () => setStep('brief'));
  $('#btn-continue')?.addEventListener('click', runProofFlow);
  $('#btn-retry-brief')?.addEventListener('click', () => { $('#understanding-error').hidden = true; runDesignFlow(); });
  $('#btn-select-hero')?.addEventListener('click', () => selectCandidate('optimised'));
  wireStepper(); wireViewToggle(); wireRecipe(); wireExports(); wireDrawer(); wireAIMenu(); wireDatasheet(); wireLab(); wireHelp();
  renderClaims(); renderValidation(); renderPlanPreview(); renderUnderstanding(); renderLot(); renderPresetMenu(); renderAdvancedControls();
  if ($('#brief-text')) $('#brief-text').value = state.brief.notes || $('#brief-text').value;
  updateWordCount();
}
async function applyDemoState() {
  if (demo.state === 'loading') {
    const loading = $('#understanding-loading');
    if (loading) loading.hidden = false;
    setActivity(['running', 'future', 'future']);
    const btn = $('#btn-design');
    if (btn) btn.disabled = true;
    await sleep(2600);
    const l = $('#understanding-loading');
    if (l) l.hidden = true;
    setActivity(null);
    if (btn) btn.disabled = false;
    renderUnderstanding();
    toast('Demo state: loading skeleton shown');
  }
  if (demo.state === 'error') {
    const card = $('#understanding-error');
    if (card) card.hidden = false;
    const banner = $('#banner');
    if (banner) {
      banner.hidden = false;
      banner.dataset.kind = 'error';
      $('#banner-title').textContent = 'The AI service didn’t respond.';
      $('#banner-body').textContent = 'Your brief is safe. The calculator still runs, and the numbers will not change.';
      $('#banner-actions').innerHTML = '<button class="btn btn--sm btn--ghost" id="banner-demo-offline" type="button">Continue offline</button>';
      $('#banner-demo-offline')?.addEventListener('click', () => { banner.hidden = true; });
    }
    toast('Demo state: AI error, using built-in text');
  }
  if (demo.state === 'offline') toast('Demo state: offline assistant (forced)');
}
async function boot() {
  buildStatic();
  restoreDraft();
  renderProject();
  renderBriefText();
  renderUnderstanding();
  renderLot();
  renderPlanPreview();
  renderAdvancedControls();
  renderFeasibility();
  setStep('brief', { force: true });
  try { await ai.detect(); } catch (err) { console.error(err); }
  renderAIStatus(ai.getSnapshot());
  await applyDemoState();
  const veil = $('#loading-veil');
  if (veil) { veil.classList.add('is-off'); setTimeout(() => veil.remove(), 350); }
  document.documentElement.setAttribute('data-anyrb-ready', '1');
  document.documentElement.setAttribute('data-anyrb-ai-mode', state.aiMode);
  if (demo.smoke) {
    try {
      await runDesignFlow();
      await sleep(250);
      await runProofFlow();
      await sleep(700);
      document.documentElement.setAttribute('data-anyrb-smoke', 'ok');
      document.documentElement.setAttribute('data-anyrb-step', state.step);
    } catch (err) {
      console.error(err);
      document.documentElement.setAttribute('data-anyrb-smoke', 'error');
    }
  }
}

window.addEventListener('error', (e) => { console.error(e.error || e.message); });
window.addEventListener('unhandledrejection', (e) => { console.error(e.reason); });

boot();

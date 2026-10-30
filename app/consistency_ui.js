/**
 * AnyRB v0.5 — open consistency-record screen.
 *
 * One editable record. The form is data; the right column is the answer.
 * Results are rendered only from stored measurements. This module never calls
 * the bracket engine, the material presets, the AI layer or a 3D simulator.
 */

import * as C from './consistency.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = (s) => String(s || 'record').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'record';

let store = null;
let activeId = null;
let root = null;
let onRecordChange = () => {};
let saveTimer = 0;
let wired = false;
let pendingFocus = null;

const KIND_OPTIONS = C.RESULT_KINDS.map((k) => `<option value="${esc(k.key)}">${esc(k.label)}</option>`).join('');

function activeRecord() {
  return store.records.find((r) => r.id === activeId) || store.records[0] || null;
}
function findResult(record, id) {
  return record && record.results.find((r) => r.id === id);
}
function findPoint(result, id) {
  return result && result.link.points.find((p) => p.id === id);
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
function loadStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(C.STORE_KEY) || 'null');
    if (raw && Array.isArray(raw.records) && raw.records.length) {
      const records = raw.records.map((r) => C.normalizeRecord(r));
      const active = records.some((r) => r.id === raw.activeId) ? raw.activeId : records[0].id;
      return { schema: C.STORE_SCHEMA, activeId: active, records };
    }
  } catch (err) { /* corrupt or private mode — start a fresh record */ }
  const fresh = C.newRecord();
  return { schema: C.STORE_SCHEMA, activeId: fresh.id, records: [fresh] };
}

function setSaveState(text, kind = '') {
  const el = $('#consistency-save-state');
  if (!el) return;
  el.textContent = text;
  el.dataset.kind = kind;
}
function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = 0;
  try {
    const record = activeRecord();
    if (record) {
      record.updatedAt = new Date().toISOString();
      for (const result of record.results) {
        if (result.kind === 'other') {
          const inferred = C.classifyResultKind(result.name, result.unit);
          if (inferred !== 'other') result.kind = inferred;
        }
      }
    }
    localStorage.setItem(C.STORE_KEY, JSON.stringify({ schema: C.STORE_SCHEMA, activeId, records: store.records }));
    setSaveState('Saved on this device');
  } catch (err) {
    setSaveState('Could not save — download the record', 'err');
  }
}
function scheduleSave() {
  setSaveState('Saving…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 260);
}
function notify() {
  const record = activeRecord();
  if (!record) return;
  try { onRecordChange({ title: C.recordTitle(record), record, savedAt: record.updatedAt }); } catch (err) { console.error(err); }
}
function markChanged({ renderFormNow = false } = {}) {
  const record = activeRecord();
  if (record) record.updatedAt = new Date().toISOString();
  scheduleSave();
  if (renderFormNow) renderForm();
  else updateFormDerived();
  renderOutcomes();
  notify();
}

// ---------------------------------------------------------------------------
// Tiny downloads + toasts
// ---------------------------------------------------------------------------
function toast(message, kind = '') {
  const region = $('#toast-region');
  if (!region) return;
  const t = document.createElement('div');
  t.className = 'toast' + (kind === 'err' ? ' is-err' : '');
  t.setAttribute('role', 'status');
  t.textContent = message;
  region.appendChild(t);
  requestAnimationFrame(() => t.classList.add('is-on'));
  setTimeout(() => { t.classList.remove('is-on'); setTimeout(() => t.remove(), 260); }, 2800);
}
function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ---------------------------------------------------------------------------
// Form rendering
// ---------------------------------------------------------------------------
function field(label, input, hint = '', cls = '') {
  return `<label class="field ${cls}"><span class="field-label">${esc(label)}</span>${input}${hint ? `<span class="field-hint">${esc(hint)}</span>` : ''}</label>`;
}
function textInput(attrs, value, placeholder = '') {
  return `<input class="input" type="text" ${attrs} value="${esc(value || '')}" placeholder="${esc(placeholder)}">`;
}
function numberInput(attrs, value, placeholder = '') {
  return `<input class="input" type="number" inputmode="decimal" ${attrs} value="${value == null ? '' : esc(value)}" placeholder="${esc(placeholder)}">`;
}

function targetNote(result) {
  const t = C.targetState(result);
  if (t.error === 'min-above-max') return 'Min is above max — swap the bounds.';
  if (!t.valid) return 'Add both bounds to check a measured value against the target.';
  return `Target ${C.formatRange({ min: t.min, max: t.max }, result.unit || '')}`;
}

function pointRow(result, point) {
  return `<div class="measurement-row" data-point-row="${esc(point.id)}">
    ${textInput(`data-result-id="${esc(result.id)}" data-point-id="${esc(point.id)}" data-point-field="choice" aria-label="Product choice"`, point.choice, 'e.g. 3 mm ribbed build')}
    ${textInput(`data-result-id="${esc(result.id)}" data-point-id="${esc(point.id)}" data-point-field="input" aria-label="Batch or input level"`, point.input, 'e.g. batch A')}
    ${numberInput(`data-result-id="${esc(result.id)}" data-point-id="${esc(point.id)}" data-point-field="value" aria-label="Measured result value" step="any"`, point.value, 'value')}
    ${textInput(`data-result-id="${esc(result.id)}" data-point-id="${esc(point.id)}" data-point-field="source" aria-label="Measurement source"`, point.source, 'report / certificate / row')}
    <button class="icon-btn icon-btn--sm measurement-remove" type="button" data-action="remove-measurement" data-result-id="${esc(result.id)}" data-point-id="${esc(point.id)}" aria-label="Remove this measurement">×</button>
  </div>`;
}

function resultEditor(result, index, total) {
  const testPlaceholder = C.defaultTestNeeded(activeRecord(), result);
  const points = result.link.points;
  const outcome = C.outcomeFor(activeRecord(), result);
  const mode = outcome.mode;
  const sourceTitle = mode === 'link' ? 'Measured link' : mode === 'batch' ? 'One batch measured' : 'No measured link';
  return `<article class="result-editor" data-result-id="${esc(result.id)}">
    <div class="result-editor-head">
      <div><span class="micro">Result ${index + 1}${result.name ? ` · ${esc(result.name)}` : ''}</span>
        <h3>${esc(result.name || 'Untitled result')}</h3></div>
      <div class="result-editor-tools">
        <span class="pill result-link-state" data-link-state-for="${esc(result.id)}" data-mode="${esc(mode)}">${esc(sourceTitle)}</span>
        ${total > 1 ? `<button class="btn btn--sm btn--ghost" type="button" data-action="remove-result" data-result-id="${esc(result.id)}">Remove result</button>` : ''}
      </div>
    </div>
    <div class="result-fields">
      ${field('Result to keep consistent', textInput(`data-result-id="${esc(result.id)}" data-result-field="name"`, result.name, 'e.g. mass, sound insulation, thickness'), '', 'field--name')}
      ${field('Unit', textInput(`data-result-id="${esc(result.id)}" data-result-field="unit"`, result.unit, 'e.g. g, dB, mm'), '', 'field--unit')}
      ${field('Target minimum', numberInput(`data-result-id="${esc(result.id)}" data-result-field="min" step="any"`, result.min, 'min'), '', 'field--bound')}
      ${field('Target maximum', numberInput(`data-result-id="${esc(result.id)}" data-result-field="max" step="any"`, result.max, 'max'), '', 'field--bound')}
      <label class="field field--kind"><span class="field-label">Result type <span class="field-hint-inline">for limits only</span></span>
        <select class="input" data-result-id="${esc(result.id)}" data-result-field="kind">${KIND_OPTIONS.replace(`value="${esc(result.kind)}"`, `value="${esc(result.kind)}" selected`)}</select>
      </label>
    </div>
    <p class="result-target-note" data-target-note="${esc(result.id)}">${esc(targetNote(result))}</p>

    <details class="link-editor" open>
      <summary><span>Measurement and source</span><span class="pill pill--muted">${points.length} row${points.length === 1 ? '' : 's'}</span><span class="chev" aria-hidden="true">›</span></summary>
      <div class="link-body">
        <p class="field-hint">A result is only shown when this result has a measurement for this same product, a named source, and at least two input levels with what varied. One batch stays one batch.</p>
        ${field('What varied between the measurements?', textInput(`data-result-id="${esc(result.id)}" data-link-field="varied"`, result.link.varied, 'e.g. 100 % rPP → 70/30 rPP/HDPE; filler 2–24 %'), 'The record uses this description; it does not guess what changed.', 'field--wide')}
        <div class="measurement-head" aria-hidden="true">
          <span>Product choice</span><span>Batch / input level</span><span>Measured value</span><span>Named source</span><span></span>
        </div>
        <div class="measurement-rows" data-measurement-rows="${esc(result.id)}">
          ${points.length ? points.map((p) => pointRow(result, p)).join('') : '<div class="measurement-empty">No measurements saved. This is the empty measurement slot.</div>'}
        </div>
        <div class="link-actions">
          <button class="btn btn--sm" type="button" data-action="add-measurement" data-result-id="${esc(result.id)}">Add measurement</button>
          <span class="field-hint">Source examples: lab report and row, supplier certificate, test sheet.</span>
        </div>
      </div>
    </details>

    <label class="field test-needed-field"><span class="field-label">Test that would create the link</span>
      <textarea class="input" rows="3" data-result-id="${esc(result.id)}" data-result-field="testNeeded" placeholder="${esc(testPlaceholder)}">${esc(result.testNeeded || '')}</textarea>
    </label>
  </article>`;
}

function recordToolbar() {
  const options = store.records.map((r) => `<option value="${esc(r.id)}"${r.id === activeId ? ' selected' : ''}>${esc(C.recordTitle(r))}</option>`).join('');
  return `<div class="record-toolbar">
    <label class="record-picker"><span class="micro">Saved record</span>
      <select id="record-select" class="input" aria-label="Open a saved record">${options}</select>
    </label>
    <div class="record-actions">
      <button class="btn btn--sm" type="button" data-action="new-record">New record</button>
      <button class="btn btn--sm" type="button" data-action="download-record">Download</button>
      <button class="btn btn--sm" type="button" data-action="import-record">Import</button>
      <button class="btn btn--sm btn--ghost" type="button" data-action="delete-record">Delete</button>
    </div>
    <span class="save-state" id="consistency-save-state">Saved on this device</span>
  </div>
  <input type="file" id="record-import-file" accept="application/json,.json" hidden>`;
}

function renderForm() {
  if (!root) return;
  const host = $('#consistency-form', root);
  const record = activeRecord();
  if (!host || !record) return;
  host.innerHTML = `
    ${recordToolbar()}
    <div class="record-section">
      <div class="record-section-head"><span class="micro">01 · Product</span><h3>What are we keeping consistent?</h3></div>
      <div class="record-section-body">
        ${field('Product name', textInput('data-record-field="product"', record.product, 'e.g. counterweight, sound-insulation sheet, pedal, tile, handle, panel'), 'Type any product. There is no product list and no preset is applied.', 'field--wide')}
      </div>
    </div>

    <div class="record-section">
      <div class="record-section-head"><span class="micro">02 · Recycled input that can change</span><h3>Describe the stream in your own words.</h3></div>
      <div class="record-section-body">
        <div class="field-grid field-grid--2">
          ${field('Plastic type or grade', textInput('data-input-field="plasticType"', record.input.plasticType, 'e.g. recycled polypropylene, mixed polyolefins'), '', 'field--wide')}
          ${field('Batch or delivery', textInput('data-input-field="batch"', record.input.batch, 'e.g. 12 bales from supplier A, 2025–26'), '', 'field--wide')}
          ${field('Mix or blend', textInput('data-input-field="mix"', record.input.mix, 'e.g. 20 % HDPE mixed in'), '', 'field--wide')}
          ${field('Minor contamination', textInput('data-input-field="contamination"', record.input.contamination, 'e.g. ≤ 2 % paper-label residue'), '', 'field--wide')}
        </div>
        <p class="field-hint">These descriptions are saved with the record. They are not matched to a material preset and they do not create a measured link.</p>
      </div>
    </div>

    <div class="record-section">
      <div class="record-section-head"><span class="micro">03 · Result and measured link</span><h3>Set the range, then record what you measured.</h3></div>
      <div class="record-section-body">
        <div class="result-list">${record.results.map((r, i) => resultEditor(r, i, record.results.length)).join('')}</div>
        <button class="btn btn--sm" type="button" data-action="add-result">Add another result</button>
      </div>
    </div>

    <div class="record-footer">
      <span class="micro">One open record</span>
      <span>Saved on this device · download JSON to keep a copy · no AI fills a missing result.</span>
    </div>`;
}

function updateFormDerived() {
  const record = activeRecord();
  if (!record || !root) return;
  const select = $('#record-select', root);
  if (select) {
    const option = select.options[select.selectedIndex];
    if (option) option.textContent = C.recordTitle(record);
  }
  record.results.forEach((result) => {
    const outcome = C.outcomeFor(record, result);
    const note = $(`[data-target-note="${result.id}"]`, root);
    if (note) note.textContent = targetNote(result);
    const editor = $$('.result-editor', root).find((el) => el.dataset.resultId === result.id);
    if (editor) {
      const title = $('.result-editor-head h3', editor);
      if (title) title.textContent = result.name || 'Untitled result';
      const micro = $('.result-editor-head .micro', editor);
      if (micro) micro.textContent = `Result ${record.results.indexOf(result) + 1}${result.name ? ` · ${result.name}` : ''}`;
    }
    const badge = $(`[data-link-state-for="${result.id}"]`, root);
    if (badge) {
      badge.dataset.mode = outcome.mode;
      badge.textContent = outcome.mode === 'link' ? 'Measured link' : outcome.mode === 'batch' ? 'One batch measured' : 'No measured link';
    }
    const textarea = $(`[data-result-field="testNeeded"][data-result-id="${result.id}"]`, root);
    if (textarea) textarea.placeholder = C.defaultTestNeeded(record, result);
  });
}

// ---------------------------------------------------------------------------
// Outcome rendering
// ---------------------------------------------------------------------------
function modeLabel(mode) {
  if (mode === 'link') return 'Measured link';
  if (mode === 'batch') return 'One batch only';
  return 'No measured link';
}
function reasonText(outcome) {
  return C.MISSING_REASON_TEXT[outcome.reason] || 'No usable measured link is stored.';
}
function sourceDetails(outcome) {
  if (!outcome.sourceRows.length) return '';
  return `<details class="source-details">
    <summary>Measurements and sources <span class="pill pill--muted">${outcome.sourceRows.length}</span></summary>
    <div class="source-table">
      <div class="source-head"><span>Product choice</span><span>Batch / level</span><span>Measured</span><span>Source</span></div>
      ${outcome.sourceRows.map((row) => `<div class="source-row">
        <span>${esc(row.choice)}</span>
        <span>${esc(row.input)}</span>
        <span class="source-value">${esc(C.formatValue(row.value, outcome.unit))}</span>
        <span>${esc(row.source)}</span>
      </div>`).join('')}
    </div>
  </details>`;
}
function threeDLine(outcome) {
  const d = outcome.threeD;
  const sim = d.simulation ? '<span class="pill pill--accent">simulation</span>' : '';
  const flag = d.applicable ? 'applicable: yes' : 'applicable: no';
  return `<div class="three-d-line">
    <span class="three-d-k">3D model</span>
    <span class="three-d-v"><b>${esc(d.label)}</b> <span class="three-d-flag">${flag}</span> ${sim} ${esc(d.reason)}</span>
  </div>`;
}
function choiceRows(outcome) {
  if (!outcome.target.valid) {
    return `<p class="outcome-note">A measured range is shown, but the target is incomplete, so the record does not say inside or outside.</p>`;
  }
  return `<div class="choice-list">
    ${outcome.choices.map((c) => `<div class="choice-row ${c.inside === true ? 'is-inside' : c.inside === false ? 'is-outside' : ''}">
      <span class="choice-name">${esc(c.choice)}</span>
      <span class="choice-range">${esc(C.formatRange(c.range, outcome.unit))}</span>
      <span class="choice-state">${c.inside === true ? 'inside target' : c.inside === false ? 'outside target' : 'target incomplete'}</span>
    </div>`).join('')}
  </div>
  ${outcome.insideChoices.length
    ? `<p class="outcome-copy"><b>Product choice inside the target:</b> ${outcome.insideChoices.map((c) => esc(c.choice)).join(', ')}.</p>`
    : `<p class="outcome-note">No measured product choice stays inside the target. The ranges above are what was measured; no other build is invented.</p>`}`;
}
function renderLink(outcome) {
  return `<div class="outcome-value-row">
      <div><span class="outcome-value">${esc(C.formatRange(outcome.range, outcome.unit))}</span><span class="outcome-caption">measured range</span></div>
      <div class="outcome-fact"><b>${outcome.inputLabels.length}</b><span>input levels</span></div>
    </div>
    <p class="outcome-copy"><b>What varied:</b> ${esc(outcome.varied)}</p>
    ${choiceRows(outcome)}
    <p class="outcome-note">Measured on this product and this result. It does not predict a batch that was not measured.</p>
    ${sourceDetails(outcome)}`;
}
function renderBatch(outcome) {
  const inside = outcome.inside;
  const valueHtml = outcome.values.length === 1
    ? `<span class="outcome-value">${esc(C.formatValue(outcome.values[0].value, outcome.unit))}</span>`
    : `<div class="batch-values">${outcome.values.map((v) => `<span><b>${esc(C.formatValue(v.value, outcome.unit))}</b><span class="batch-choice">${esc(v.choice)}</span></span>`).join('')}</div>`;
  const verdict = outcome.target.valid
    ? `<p class="outcome-copy ${inside ? 'is-inside-copy' : 'is-outside-copy'}">This batch is <b>${inside ? 'inside' : 'outside'}</b> your target of ${esc(C.formatRange({ min: outcome.target.min, max: outcome.target.max }, outcome.unit))}.</p>`
    : `<p class="outcome-note">A value is measured, but the target is incomplete, so the record does not say inside or outside.</p>`;
  return `<div class="outcome-value-row"><div>${valueHtml}<span class="outcome-caption">this batch</span></div></div>
    ${verdict}
    <p class="outcome-note">One batch only. This record does not predict the next batch, and no 3D model is used to extend it.</p>
    ${sourceDetails(outcome)}`;
}
function renderMissing(outcome) {
  return `<div class="outcome-blank"><span class="blank-value">—</span><span class="blank-caption">result left blank</span></div>
    <p class="outcome-copy"><b>${esc(reasonText(outcome))}</b> The product, target, input and empty measurement slot are saved.</p>
    ${outcome.partialRows.length ? `<p class="outcome-note">${outcome.partialRows.length} measurement row${outcome.partialRows.length === 1 ? ' is' : 's are'} saved but not usable yet.</p>` : ''}
    <div class="test-needed">
      <div class="micro">Test still needed</div>
      <p>${esc(outcome.testNeeded)}</p>
    </div>`;
}
function renderOutcome(outcome) {
  const target = outcome.target;
  let targetHtml = 'Target not set';
  if (target.error === 'min-above-max') targetHtml = 'Target range is invalid: min is above max';
  else if (target.valid) targetHtml = C.targetLabel(target, outcome.unit);
  return `<article class="outcome-card" data-outcome-result="${esc(outcome.resultId)}" data-mode="${esc(outcome.mode)}">
    <div class="outcome-head">
      <div><span class="micro">Result</span><h3>${esc(outcome.name)}</h3><span class="outcome-target">${esc(targetHtml)}</span></div>
      <span class="pill outcome-mode outcome-mode--${esc(outcome.mode)}">${esc(modeLabel(outcome.mode))}</span>
    </div>
    ${outcome.mode === 'link' ? renderLink(outcome) : outcome.mode === 'batch' ? renderBatch(outcome) : renderMissing(outcome)}
    ${threeDLine(outcome)}
  </article>`;
}

function renderOutcomes() {
  if (!root) return;
  const host = $('#consistency-outcomes', root);
  if (!host) return;
  const record = activeRecord();
  if (!record) return;
  const evaluated = C.evaluateRecord(record);
  host.innerHTML = `
    <div class="outcome-lead">
      <div class="micro">What the record can say now</div>
      <h2>Only measured links count.</h2>
      <p>Product names, material presets, assumed variation and the bracket model are not links. A result stays blank until a measurement for this product and this result is stored.</p>
    </div>
    <div class="outcome-list">${evaluated.results.map(renderOutcome).join('')}</div>
    <p class="outcome-foot">No chart, score or overall pass/fail. Each result is answered separately from its own measurements.</p>`;
}

// ---------------------------------------------------------------------------
// Form events
// ---------------------------------------------------------------------------
function updateResultFromInput(record, el) {
  const result = findResult(record, el.dataset.resultId);
  if (!result) return false;
  if (el.dataset.resultField) {
    const field = el.dataset.resultField;
    if (field === 'name') result.name = el.value.slice(0, 90);
    else if (field === 'unit') result.unit = el.value.slice(0, 24);
    else if (field === 'min' || field === 'max') result[field] = el.value.trim() === '' ? null : (Number.isFinite(Number(el.value)) ? Number(el.value) : null);
    else if (field === 'kind') result.kind = C.RESULT_KINDS.some((k) => k.key === el.value) ? el.value : 'other';
    else if (field === 'testNeeded') result.testNeeded = el.value.slice(0, 1200);
    return true;
  }
  if (el.dataset.linkField === 'varied') {
    result.link.varied = el.value.slice(0, 360);
    return true;
  }
  if (el.dataset.pointField) {
    const point = findPoint(result, el.dataset.pointId);
    if (!point) return false;
    const field = el.dataset.pointField;
    if (field === 'value') point.value = el.value.trim() === '' ? null : (Number.isFinite(Number(el.value)) ? Number(el.value) : null);
    else if (field === 'choice') point.choice = el.value.slice(0, 100);
    else if (field === 'input') point.input = el.value.slice(0, 120);
    else if (field === 'source') point.source = el.value.slice(0, 220);
    return true;
  }
  return false;
}

function onFieldInput(event) {
  const el = event.target;
  if (!(el instanceof HTMLElement)) return;
  if (!el.matches('input, textarea, select')) return;
  const record = activeRecord();
  if (!record) return;
  let changed = false;
  if (el.dataset.recordField === 'product') {
    record.product = el.value.slice(0, 140);
    changed = true;
  } else if (el.dataset.inputField) {
    const field = el.dataset.inputField;
    if (field in record.input) {
      record.input[field] = el.value.slice(0, 180);
      changed = true;
    }
  } else {
    changed = updateResultFromInput(record, el);
  }
  if (changed) markChanged();
}

function setActiveRecord(id) {
  if (id === activeId) return;
  if (!store.records.some((r) => r.id === id)) return;
  saveNow();
  activeId = id;
  saveNow();
  renderForm();
  renderOutcomes();
  notify();
}

function newRecord() {
  saveNow();
  const record = C.newRecord();
  store.records.push(record);
  activeId = record.id;
  saveNow();
  renderForm();
  renderOutcomes();
  notify();
  pendingFocus = 'product';
  applyPendingFocus();
}

function deleteRecord() {
  const record = activeRecord();
  if (!record) return;
  if (!window.confirm(`Delete “${C.recordTitle(record)}” from this device? Download it first if you need a copy.`)) return;
  store.records = store.records.filter((r) => r.id !== activeId);
  if (!store.records.length) store.records.push(C.newRecord());
  activeId = store.records[0].id;
  saveNow();
  renderForm();
  renderOutcomes();
  notify();
  toast('Record deleted');
}

function addResult() {
  const record = activeRecord();
  if (!record) return;
  if (record.results.length >= 12) { toast('A record can hold 12 results; split it into another record.', 'err'); return; }
  record.results.push(C.blankResult());
  markChanged({ renderFormNow: true });
  pendingFocus = 'result-name';
  applyPendingFocus();
}
function removeResult(id) {
  const record = activeRecord();
  if (!record || record.results.length <= 1) { toast('Keep at least one result in the record.', 'err'); return; }
  record.results = record.results.filter((r) => r.id !== id);
  markChanged({ renderFormNow: true });
}
function addMeasurement(resultId) {
  const record = activeRecord();
  const result = findResult(record, resultId);
  if (!result) return;
  if (result.link.points.length >= 48) { toast('That result already has 48 measurement rows.', 'err'); return; }
  result.link.points.push(C.blankPoint());
  markChanged({ renderFormNow: true });
  pendingFocus = 'point-choice';
  applyPendingFocus();
}
function removeMeasurement(resultId, pointId) {
  const record = activeRecord();
  const result = findResult(record, resultId);
  if (!result) return;
  result.link.points = result.link.points.filter((p) => p.id !== pointId);
  markChanged({ renderFormNow: true });
}

function applyPendingFocus() {
  const mode = pendingFocus;
  pendingFocus = null;
  if (!mode) return;
  requestAnimationFrame(() => {
    let target = null;
    if (mode === 'product') target = $('[data-record-field="product"]', root);
    else if (mode === 'result-name') {
      const all = $$('[data-result-field="name"]', root);
      target = all[all.length - 1] || null;
    } else if (mode === 'point-choice') {
      const all = $$('[data-point-field="choice"]', root);
      target = all[all.length - 1] || null;
    }
    if (target) target.focus();
  });
}

function downloadRecord() {
  const record = activeRecord();
  if (!record) return;
  const data = C.exportRecord(record);
  const date = new Date().toISOString().slice(0, 10);
  download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `anyrb_record_${slug(C.recordTitle(record))}_${date}.json`);
  toast('Record downloaded');
}
function importRecordFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const raw = JSON.parse(String(reader.result || '{}'));
      const imported = C.cloneRecord(C.importRecord(raw));
      store.records.push(imported);
      activeId = imported.id;
      saveNow();
      renderForm();
      renderOutcomes();
      notify();
      toast(`Imported “${C.recordTitle(imported)}”`);
    } catch (err) {
      console.error(err);
      toast(`Could not import that file: ${String(err.message || err).slice(0, 100)}`, 'err');
    }
  };
  reader.onerror = () => toast('Could not read the file', 'err');
  reader.readAsText(file);
}

function onClick(event) {
  const btn = event.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  if (action === 'new-record') newRecord();
  else if (action === 'delete-record') deleteRecord();
  else if (action === 'add-result') addResult();
  else if (action === 'remove-result') removeResult(btn.dataset.resultId);
  else if (action === 'add-measurement') addMeasurement(btn.dataset.resultId);
  else if (action === 'remove-measurement') removeMeasurement(btn.dataset.resultId, btn.dataset.pointId);
  else if (action === 'download-record') downloadRecord();
  else if (action === 'import-record') $('#record-import-file', root)?.click();
}

function onChange(event) {
  const el = event.target;
  if (el.id === 'record-select') { setActiveRecord(el.value); return; }
  if (el.id === 'record-import-file') { importRecordFile(el.files && el.files[0]); el.value = ''; return; }
  // A typed result name can tell us which model limits apply; keep an explicit
  // user choice, but replace the generic "other" default on blur.
  if (el.dataset && el.dataset.resultField === 'name' && el.dataset.resultId) {
    const record = activeRecord();
    const result = findResult(record, el.dataset.resultId);
    if (record && result && result.kind === 'other') {
      const inferred = C.classifyResultKind(result.name, result.unit);
      if (inferred !== 'other') {
        result.kind = inferred;
        const select = $(`select[data-result-id="${result.id}"][data-result-field="kind"]`, root);
        if (select) select.value = inferred;
        markChanged();
      }
    }
  }
}

function wire() {
  root.addEventListener('input', onFieldInput);
  root.addEventListener('change', onChange);
  root.addEventListener('click', onClick);
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------
export function initConsistencyScreen(options = {}) {
  root = document.getElementById('screen-consistency');
  if (!root) return null;
  onRecordChange = typeof options.onRecordChange === 'function' ? options.onRecordChange : () => {};
  store = loadStore();
  activeId = store.activeId;
  if (!wired) {
    wire();
    window.addEventListener('beforeunload', saveNow);
    wired = true;
  }
  renderForm();
  renderOutcomes();
  notify();
  return {
    refresh() { renderForm(); renderOutcomes(); notify(); },
    getTitle() { const r = activeRecord(); return r ? C.recordTitle(r) : 'Untitled record'; },
    hasRecord() { return !!activeRecord(); },
  };
}

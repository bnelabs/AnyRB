/**
 * AnyRB v0.6 — evidence map screen.
 *
 * Renders the evidence map from app/evidence.js. It is a reading surface, not a
 * product catalog and not a result generator: only the PNAS {8,5} row links to
 * the one allowed, simulation-labelled calculation in the consistency record.
 */

import * as EV from './evidence.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const doiUrl = (doi) => (doi ? `https://doi.org/${doi}` : '');
const pmcUrl = (pmc) => (pmc ? `https://pmc.ncbi.nlm.nih.gov/articles/${pmc}/` : '');

let root = null;
let callbacks = {};

function gradeClass(grade) {
  if (grade === 'measured_on_product_class') return 'is-measured';
  if (grade === 'model_only') return 'is-model';
  return 'is-absent';
}

function renderSummary() {
  const host = document.getElementById('evidence-summary');
  if (!host) return;
  const summary = EV.evidenceSummary();
  const c = summary.counts;
  host.innerHTML = `
    <div class="micro">What the literature actually measures</div>
    <h2>A citation is not a result on your batch.</h2>
    <p class="evidence-lede">This map separates three grades. A measured link means the paper tested that product class and result with a varying input; a model-only row has no physical product test; absent means no qualifying link was found. A product-class formulation result is not automatically a batch link.</p>
    <div class="evidence-counts">
      <span><b>${c.measured_on_product_class}</b> measured on a product class</span>
      <span><b>${c.model_only}</b> model only</span>
      <span><b>${c.absent}</b> absent</span>
    </div>
    <div class="evidence-actions">
      <button class="btn btn--sm" type="button" id="evidence-open-record">Back to the consistency record</button>
      <button class="btn btn--sm btn--ghost" type="button" id="evidence-open-studio">Historical bracket studio →</button>
    </div>`;
  document.getElementById('evidence-open-record')?.addEventListener('click', () => callbacks.onOpenRecord?.());
  document.getElementById('evidence-open-studio')?.addEventListener('click', () => callbacks.onOpenStudio?.());
}

function renderField(label, value) {
  return `<div class="ev-field"><span class="micro">${esc(label)}</span><div>${esc(value || '—')}</div></div>`;
}

function renderRow(row) {
  const sourceLinks = [];
  if (row.doi) sourceLinks.push(`<a href="${esc(doiUrl(row.doi))}" target="_blank" rel="noopener">doi:${esc(row.doi)}</a>`);
  if (row.pmcid) sourceLinks.push(`<a href="${esc(pmcUrl(row.pmcid))}" target="_blank" rel="noopener">${esc(row.pmcid)}</a>`);
  const calc = row.calcEligible
    ? '<span class="pill pill--verify ev-calc-pill">Calculation in consistency record</span>'
    : (row.grade === 'measured_on_product_class'
      ? '<span class="pill pill--muted">Product-class evidence; not a batch link</span>'
      : '');
  return `<article class="evidence-row ${gradeClass(row.grade)}" data-evidence-id="${esc(row.id)}">
    <div class="ev-head">
      <div>
        <span class="micro">${esc(row.grade.replace(/_/g, ' '))}</span>
        <h3>${esc(row.productClass)}</h3>
        <p class="ev-detail">${esc(row.detail)}</p>
      </div>
      <div class="ev-head-right">
        <span class="ev-grade ${gradeClass(row.grade)}">${esc(EV.GRADE_LABELS[row.grade] || row.grade)}</span>
        ${calc}
      </div>
    </div>
    <div class="ev-grid">
      ${renderField('Result', row.result)}
      ${renderField('Input that varied', row.inputVaried)}
      ${renderField('What was physically measured', row.measured)}
      ${renderField('Sample size', row.sampleSize)}
      ${renderField('What moved', row.moved)}
      ${renderField('Experiment or model', row.type)}
      ${renderField('What it does not cover', row.notCovered)}
    </div>
    <div class="ev-source"><span class="micro">Source</span><p>${esc(row.source)}${row.locator ? ` · ${esc(row.locator)}` : ''}</p><p>${sourceLinks.join(' · ')}</p></div>
  </article>`;
}

function renderRows() {
  const host = document.getElementById('evidence-rows');
  if (!host) return;
  host.innerHTML = EV.EVIDENCE_ROWS.map(renderRow).join('');
}

function renderNote() {
  const host = document.getElementById('evidence-note');
  if (!host) return;
  host.innerHTML = `
    <div class="micro">The one calculation</div>
    <h3>PNAS 2025 {8,5} platelet–matrix modulus</h3>
    <p>The only calculation the app is allowed to run is the PNAS {8,5} case, and only when the user has selected that product class, a modulus result in MPa with a target, a measured recyclate stiffness distribution, and a measured composite modulus baseline. The paper reports the measured CV ratio 18 %→4 % but <b>no absolute measured E_eff mean</b>; that is why a measured baseline is required.</p>
    <p class="ev-warning"><b>The 93 % is not used.</b> It is the paper's <b>model-only</b> stretch-film case relative to a modelled 26 % total introduced variability (554 ± 10 MPa, CV 2 %). The measured {8,5} composite result is 18 %→4 % CV. Neither is a result on your product or batch.</p>
    <p><a href="${esc(EV.EVIDENCE_MAP_MD)}" target="_blank" rel="noopener">Read the full evidence map</a> · <a href="${esc(EV.EVIDENCE_MAP_JSON)}" target="_blank" rel="noopener">machine-readable map</a></p>`;
}

export function initEvidenceScreen(options = {}) {
  root = document.getElementById('screen-evidence');
  if (!root) return null;
  callbacks = options || {};
  renderSummary();
  renderRows();
  renderNote();
  return {
    refresh() { renderSummary(); renderRows(); renderNote(); },
  };
}

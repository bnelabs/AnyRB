import {
  STORE_KEY,
  MAX_MEASUREMENTS,
  MAX_PROPERTIES,
  blankMeasurement,
  blankProperty,
  blankState,
  buildAnswer,
  normalizeState,
} from './product.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function loadState() {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved) return normalizeState(JSON.parse(saved));
  } catch (error) {
    // A broken saved value should not stop the page from opening.
  }
  return blankState();
}

let state = loadState();

function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (error) {
    // The page still works when storage is unavailable.
  }
}

function namedProperties() {
  return state.properties.filter((property) => property.name.trim());
}

function propertyById(id) {
  return state.properties.find((property) => property.id === id) || null;
}

function measurementById(id) {
  return state.measurements.find((measurement) => measurement.id === id) || null;
}

// ---------------------------------------------------------------------------
// Property lines
// ---------------------------------------------------------------------------
function renderProperties(focusId = '') {
  const list = $('#property-list');
  list.replaceChildren();
  state.properties.forEach((property) => {
    const row = document.createElement('div');
    row.className = 'property-row';
    row.dataset.propertyId = property.id;
    row.innerHTML = `
      <input class="property-name" data-field="name" type="text" autocomplete="off" spellcheck="false" aria-label="Property" placeholder="property">
      <span class="range-line">
        <span class="connector">must stay between</span>
        <input class="property-min" data-field="min" type="text" inputmode="decimal" autocomplete="off" aria-label="Lowest value" placeholder="low">
        <span class="connector">and</span>
        <input class="property-max" data-field="max" type="text" inputmode="decimal" autocomplete="off" aria-label="Highest value" placeholder="high">
        <input class="property-unit" data-field="unit" type="text" autocomplete="off" spellcheck="false" aria-label="Unit" placeholder="unit">
      </span>
      <button class="remove" type="button" aria-label="Remove this property">×</button>`;
    row.querySelector('[data-field="name"]').value = property.name;
    row.querySelector('[data-field="min"]').value = property.min;
    row.querySelector('[data-field="max"]').value = property.max;
    row.querySelector('[data-field="unit"]').value = property.unit;
    if (state.properties.length === 1) row.querySelector('.remove').remove();
    list.append(row);
  });
  $('#add-property').disabled = state.properties.length >= MAX_PROPERTIES;
  if (focusId) {
    const input = list.querySelector(`[data-property-id="${focusId}"] [data-field="name"]`);
    if (input) input.focus();
  }
}

function refreshMeasurementUnits() {
  $$('.measurement-row').forEach((row) => {
    const measurement = measurementById(row.dataset.measurementId);
    const property = measurement ? propertyById(measurement.propertyId) : null;
    const unit = row.querySelector('.m-unit');
    if (unit) unit.textContent = property && property.unit ? property.unit : '';
  });
}

// ---------------------------------------------------------------------------
// Measurement lines
// ---------------------------------------------------------------------------
function renderMeasurements(focusId = '') {
  const list = $('#measurement-list');
  const empty = $('#measurement-empty');
  const add = $('#add-measurement');
  list.replaceChildren();
  const selectable = state.properties;

  state.measurements.forEach((measurement) => {
    const property = propertyById(measurement.propertyId);
    const row = document.createElement('div');
    row.className = 'measurement-row';
    row.dataset.measurementId = measurement.id;

    let propertyControl;
    if (selectable.length <= 1) {
      propertyControl = document.createElement('span');
      propertyControl.className = 'm-property-static';
      propertyControl.textContent = property && property.name.trim() ? property.name.trim() : 'property';
    } else {
      const select = document.createElement('select');
      select.className = 'm-property';
      select.dataset.field = 'propertyId';
      select.setAttribute('aria-label', 'Property');
      selectable.forEach((item) => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.name.trim() || 'property';
        select.append(option);
      });
      select.value = measurement.propertyId;
      if (!select.value && selectable[0]) {
        select.value = selectable[0].id;
        measurement.propertyId = selectable[0].id;
      }
      propertyControl = select;
    }

    function phrase(word, ...nodes) {
      const span = document.createElement('span');
      span.className = 'phrase';
      const label = document.createElement('span');
      label.className = 'word';
      label.textContent = word;
      span.append(label, ...nodes);
      return span;
    }

    const version = document.createElement('input');
    version.className = 'm-version';
    version.dataset.field = 'version';
    version.type = 'text';
    version.autocomplete = 'off';
    version.spellcheck = false;
    version.placeholder = 'version';
    version.setAttribute('aria-label', 'Version');
    version.value = measurement.version;

    const batch = document.createElement('input');
    batch.className = 'm-batch';
    batch.dataset.field = 'batch';
    batch.type = 'text';
    batch.autocomplete = 'off';
    batch.spellcheck = false;
    batch.placeholder = 'batch';
    batch.setAttribute('aria-label', 'Batch');
    batch.value = measurement.batch;

    const value = document.createElement('input');
    value.className = 'm-value';
    value.dataset.field = 'value';
    value.type = 'text';
    value.inputMode = 'decimal';
    value.autocomplete = 'off';
    value.placeholder = 'number';
    value.setAttribute('aria-label', 'Measured number');
    value.value = measurement.value;

    const unit = document.createElement('span');
    unit.className = 'm-unit';
    unit.textContent = property && property.unit ? property.unit : '';

    const remove = document.createElement('button');
    remove.className = 'remove';
    remove.type = 'button';
    remove.setAttribute('aria-label', 'Remove this measurement');
    remove.textContent = '×';

    const plasticLine = document.createElement('div');
    plasticLine.className = 'measurement-plastic';
    function plasticPhrase(word, field, label, placeholder) {
      const wrap = document.createElement('span');
      wrap.className = 'plastic-phrase';
      const text = document.createElement('span');
      text.className = 'word';
      text.textContent = word;
      const input = document.createElement('input');
      input.className = `m-${field}`;
      input.dataset.field = field;
      input.type = 'text';
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.placeholder = placeholder;
      input.setAttribute('aria-label', label);
      input.value = measurement[field] || '';
      wrap.append(text, input);
      return wrap;
    }
    plasticLine.append(
      plasticPhrase('made with', 'plasticType', 'Plastic type for this piece', 'plastic type'),
      plasticPhrase('mixed with', 'mix', 'Mix for this piece', 'mix'),
      plasticPhrase('dirt', 'dirt', 'Dirt or other plastic for this piece', 'other plastic'),
    );

    row.append(propertyControl, phrase('on', version), phrase('from', batch), phrase('was', value, unit), remove, plasticLine);
    list.append(row);
  });

  const hasNamedProperty = namedProperties().length > 0;
  empty.hidden = state.measurements.length > 0;
  if (!hasNamedProperty) {
    empty.textContent = 'Add a property above before adding a number.';
  } else {
    empty.textContent = 'No measured numbers yet.';
  }
  add.disabled = !hasNamedProperty || state.measurements.length >= MAX_MEASUREMENTS;
  if (focusId) {
    const input = list.querySelector(`[data-measurement-id="${focusId}"] [data-field="value"]`);
    if (input) input.focus();
  }
}

// ---------------------------------------------------------------------------
// Answer
// ---------------------------------------------------------------------------
function renderAnswer() {
  const answer = buildAnswer(state);
  $('#answer-headline').textContent = answer.headline;
  const body = $('#answer-body');
  body.replaceChildren();
  answer.items.forEach((item) => {
    const paragraph = document.createElement('p');
    if (item.name && ['inside', 'outside', 'all-outside', 'uncovered'].includes(item.kind)) {
      const label = document.createElement('b');
      label.textContent = item.name.charAt(0).toUpperCase() + item.name.slice(1);
      paragraph.append(label, ': ');
    }
    paragraph.append(document.createTextNode(item.text));
    body.append(paragraph);
  });
  const next = $('#answer-next');
  const nextText = $('#next-text');
  nextText.textContent = answer.next || '';
  next.hidden = !answer.next;
  const live = $('#live-answer');
  if (live) {
    const liveText = `${answer.headline}${answer.next ? ` Next: ${answer.next}` : ''}`;
    if (live.textContent !== liveText) live.textContent = liveText;
  }
}

// ---------------------------------------------------------------------------
// Initial paint
// ---------------------------------------------------------------------------
function paintPlastic() {
  $('#plastic-type').value = state.plastic.type;
  $('#plastic-batch').value = state.plastic.batch;
  $('#plastic-mix').value = state.plastic.mix;
  $('#plastic-dirt').value = state.plastic.dirt;
}

function paintAll() {
  $('#product').value = state.product;
  paintPlastic();
  renderProperties();
  renderMeasurements();
  renderAnswer();
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
$('#product').addEventListener('input', (event) => {
  state.product = event.target.value;
  saveState();
  renderAnswer();
});

const plasticFields = {
  '#plastic-type': 'type',
  '#plastic-batch': 'batch',
  '#plastic-mix': 'mix',
  '#plastic-dirt': 'dirt',
};

Object.entries(plasticFields).forEach(([selector, field]) => {
  $(selector).addEventListener('input', (event) => {
    state.plastic[field] = event.target.value;
    saveState();
    renderAnswer();
  });
});

$('#property-list').addEventListener('input', (event) => {
  const row = event.target.closest('[data-property-id]');
  const field = event.target.dataset.field;
  if (!row || !field) return;
  const property = propertyById(row.dataset.propertyId);
  if (!property) return;
  property[field] = event.target.value;
  if (field === 'name') renderMeasurements();
  if (field === 'unit') refreshMeasurementUnits();
  saveState();
  renderAnswer();
});

$('#property-list').addEventListener('click', (event) => {
  const button = event.target.closest('.remove');
  if (!button) return;
  const row = button.closest('[data-property-id]');
  if (!row || state.properties.length === 1) return;
  const id = row.dataset.propertyId;
  state.properties = state.properties.filter((property) => property.id !== id);
  state.measurements = state.measurements.filter((measurement) => measurement.propertyId !== id);
  saveState();
  renderProperties();
  renderMeasurements();
  renderAnswer();
});

$('#add-property').addEventListener('click', () => {
  if (state.properties.length >= MAX_PROPERTIES) return;
  const property = blankProperty();
  state.properties.push(property);
  saveState();
  renderProperties(property.id);
  renderMeasurements();
  renderAnswer();
});

function onMeasurementChange(event) {
  const row = event.target.closest('[data-measurement-id]');
  const field = event.target.dataset.field;
  if (!row || !field) return;
  const measurement = measurementById(row.dataset.measurementId);
  if (!measurement) return;
  measurement[field] = event.target.value;
  if (field === 'propertyId') refreshMeasurementUnits();
  saveState();
  renderAnswer();
}

$('#measurement-list').addEventListener('input', onMeasurementChange);
$('#measurement-list').addEventListener('change', (event) => {
  if (event.target.matches('select')) onMeasurementChange(event);
});

$('#measurement-list').addEventListener('click', (event) => {
  const button = event.target.closest('.remove');
  if (!button) return;
  const row = button.closest('[data-measurement-id]');
  if (!row) return;
  state.measurements = state.measurements.filter((measurement) => measurement.id !== row.dataset.measurementId);
  saveState();
  renderMeasurements();
  renderAnswer();
});

$('#add-measurement').addEventListener('click', () => {
  const property = namedProperties()[0];
  if (!property || state.measurements.length >= MAX_MEASUREMENTS) return;
  const measurement = blankMeasurement(property.id, state.plastic);
  state.measurements.push(measurement);
  saveState();
  renderMeasurements(measurement.id);
  renderAnswer();
});

$('#start-over').addEventListener('click', () => {
  const hasContent = state.product.trim() || state.measurements.length || state.plastic.type.trim() || state.plastic.batch.trim() || state.plastic.mix.trim() || state.plastic.dirt.trim();
  if (hasContent && !window.confirm('Start over with a new product? This clears what is on the page.')) return;
  state = blankState();
  saveState();
  paintAll();
  $('#product').focus();
});

window.addEventListener('pagehide', saveState);

paintAll();

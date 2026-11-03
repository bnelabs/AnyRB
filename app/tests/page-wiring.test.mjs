import test from 'node:test';
import assert from 'node:assert/strict';

// Page wiring: voice confirm, extracted-field marking, live re-call,
// proposal tally, mix-in/treated published routes, load-path line, sheet yield.
// Source-string guards: the behaviour lives in main.js/index.html/styles.css,
// so these tests pin the wiring the checker tests cannot see.
const load = async (name) => {
  const fs = await import('node:fs/promises');
  return fs.readFile(new URL(name, import.meta.url), 'utf8');
};

test('page sends a cache-bust header when the user asks for a live answer', async () => {
  const js = await load('../main.js');
  assert.match(js, /X-User-Cache-Bust/);
  assert.match(js, /metaHeaders\(true, bust\)/);
  assert.match(js, /fetchProposals\(bust = false\)/);
  assert.match(js, /readBrief\(bust = false\)/);
  assert.match(js, /askMeta\(bust = false\)/);
});

test('every saved answer gets a call-again control', async () => {
  const js = await load('../main.js');
  const html = await load('../index.html');
  for (const id of ['brief-recall', 'model-recall', 'ask-recall']) {
    assert.match(html, new RegExp(`id="${id}"`));
    assert.match(js, new RegExp(`\\$\\('${id}'\\)`));
  }
  assert.match(html, /Call again for a live answer/);
  assert.match(js, /model-recall'\)\.hidden = !metaSource \|\| metaSource\.kind !== 'cached'/);
});

test('voice is reviewed, not auto-parsed, and edits clear the voice source', async () => {
  const js = await load('../main.js');
  assert.match(js, /check it above, then press Fill in the form/);
  assert.match(js, /\$\('brief'\)\.addEventListener\('input', \(\) => \{ voiceSource = '';/);
});

test('fields filled from the user’s words are marked until edited', async () => {
  const js = await load('../main.js');
  const css = await load('../styles.css');
  assert.match(js, /function markBriefFilled/);
  assert.match(js, /function clearAiFilled/);
  assert.match(js, /Filled from your words/);
  assert.match(js, /marked fields clear when you edit them/);
  assert.match(js, /document\.addEventListener\(type, \(event\) => \{/);
  assert.match(css, /\.ai-filled/);
});

test('the builds status counts exact passes and the feedback round', async () => {
  const js = await load('../main.js');
  assert.match(js, /passed exactly as proposed/);
  assert.match(js, /more after the model saw the checked ranges/);
  assert.match(js, /feedbackAdded/);
});

test('mix-in and treated ranges can come from a published pick', async () => {
  const js = await load('../main.js');
  const html = await load('../index.html');
  assert.match(html, /id="steady-source"/);
  assert.match(html, /id="treated-source"/);
  assert.match(html, /id="steady-published-note"/);
  assert.match(html, /id="treated-published-note"/);
  assert.match(js, /steady-source/);
  assert.match(js, /treated-source/);
  assert.match(js, /at its weak end/);
  assert.match(js, /state\.steady = key === 'numbers'/);
  assert.match(js, /state\.treated = key === 'numbers'/);
});

test('the verdict names the cheaper way to hold the part', async () => {
  const js = await load('../main.js');
  assert.match(js, /loadPathComparison\(result\.state, result\)/);
  assert.match(js, /less material\./);
});

test('sheet cutting is counted in the production note', async () => {
  const js = await load('../main.js');
  const html = await load('../index.html');
  assert.match(html, /id="sheet-span"/);
  assert.match(html, /id="sheet-width"/);
  assert.match(js, /sheetYield\(\{ sheetSpanMm, sheetWidthMm/);
  assert.match(js, /sheet gives/);
  assert.match(js, /sheets\./);
});

test('a blend that also works is named in the builds heading', async () => {
  const js = await load('../main.js');
  assert.match(js, /including a blend/);
});

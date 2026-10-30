# AnyRB app

One page, one job: can this recycled plastic make the product the person named, inside the range they set?

## Files

- `index.html` — masthead, four questions, one answer.
- `styles.css` — paper background, one serif display face, one accent, one column.
- `product.js` — pure functions. No DOM, no storage, no network.
- `main.js` — DOM rendering, editing, localStorage.
- `build.py` — inlines CSS and JS into `../index.html` and `standalone.html`.
- `tests/model.test.mjs` — answer logic and visible-language guard.

## Data

```js
{
  product: "Bench slat",
  properties: [{ id, name: "stiffness", unit: "MPa", min: "1800", max: "2400" }],
  plastic: { type: "recycled polypropylene", batch: "April", mix: "20% HDPE", dirt: "labels" },
  measurements: [
    { id, propertyId, version: "3 mm wall", batch: "March", value: "2050" }
  ]
}
```

Saved under `anyrb.one-product.v1` in localStorage.

## Answers

For each property:

- `missing` — no usable measured number. No number or pass is invented. The instruction depends only on
  the property name: weight, sound, strength/stiffness, size, or a general measure.
- `batch` — one named batch measured. State inside/outside, say the next batch is unknown, give one check.
- `product` — two or more named batches measured. Give the measured range, the version split if present,
  and the batch action. A version is named only when that version was measured.

The version recommendation is not a prediction. It names only measured versions.

## Build

```bash
python3 app/build.py
node app/tests/model.test.mjs
```

## Boundaries

The active page contains no catalog, material presets, charts, scores, paper links, or extra screens.
The retired v0.6 interface, bracket prototype, research notes and validation suite live outside this app.

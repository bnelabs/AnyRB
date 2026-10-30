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
    {
      id, propertyId, version: "3 mm wall", batch: "March", value: "2050",
      plasticType: "recycled polypropylene", mix: "20% HDPE", dirt: "labels"
    }
  ]
}
```

Saved under `anyrb.one-product.v1` in localStorage.

## Answers

For each property, the current plastic (type, batch, mix, dirt) is matched against each measurement's
plastic. Then:

- `missing` — no usable measured number. No number or pass is invented. The instruction depends only on
  the property name: weight, sound, strength/stiffness, size, or a general measure.
- `uncovered` — no measured piece has this batch and this plastic/mix/dirt. Show no number; say the
  numbers do not cover this batch or plastic; give one test on a piece from this batch.
- `inside` — this batch is inside. If this is the only batch, say the next batch is unknown and give one
  next-batch check. If a measured version is outside, name the version to make and drop.
- `outside` — this batch is outside. Say by how much, say not to ship it, name any measured version that
  stayed inside, and give one version or test action.
- `all-outside` — every measured piece of this plastic/mix/dirt is outside. Say high or low, say not to
  ship the combination, and give one changed-piece test.

A version is named only when that version was measured.

## Build

```bash
python3 app/build.py
node app/tests/model.test.mjs
```

## Boundaries

The active page contains no catalog, material presets, charts, scores, paper links, or extra screens.
The retired v0.6 interface, bracket prototype, research notes and validation suite live outside this app.

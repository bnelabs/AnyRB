# AnyRB v0.7 — one product, one answer

## The job

A person is making something from recycled plastic. The plastic can change: polypropylene, PET,
polyethylene, a mix, a dirty stream, another batch. The product can be whatever they name. They set the
physical properties that must stay inside a range they choose. The app tells them whether this input can
keep the product inside that range, and what to do next.

## The one screen

1. What are you making? Free text.
2. What has to stay steady? One or more free-text properties, each with unit and low/high range.
3. What plastic are you using? Type, batch, mix, dirt or other plastic. All free text.
4. What have you measured? Numbers measured on the actual product, with version and batch.

Then one answer and one next action.

## The three outcomes

- **Product:** measured on at least two named batches. Show the measured range, whether it is inside the
  range, name the version to make and the version to drop when that split was measured, and hold/change/
  not-ship for the current batch when it is outside.
- **Batch:** one named batch measured. Say whether that batch is inside, say the next batch is unknown
  until checked the same way, and give one check.
- **Missing:** no usable measurement for this product and property. No number, chart or pass. Say what to
  measure in one or two plain sentences, then stop.

## Rules

- A product name, a plastic name, a material sheet, a preset, a guessed range or an unmeasured build never
  produces a number.
- A version is named only when that version was measured.
- Weight: weigh the actual piece, or density times volume.
- Sound: sound test on the actual piece.
- Strength or stiffness: test the actual piece.
- The active page contains no catalog, no 3D viewer, no score, no research library, no paper links.
- One column on a phone; a simple page on a desk; one accent for the action.

## Files

- `app/index.html`, `app/styles.css`, `app/main.js`, `app/product.js`
- `app/build.py` → `index.html` + `app/standalone.html`
- `app/tests/model.test.mjs`
- `demo/screenshots/v7/` — first open, no measurement, one batch, two versions, phone.

The v0.6 interface, evidence-map screen, bracket studio and research notes are retired from the active
app; the sources are in `history/v0.6-app/` and `research/`.

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
4. What have you measured? Numbers measured on the actual piece, with version, batch, and the plastic
   that piece was made with (type, mix, dirt or other plastic).

Then one answer and one next action.

## The answer

For each property, compare the current plastic (type, batch, mix, dirt) with the plastic recorded on every
measured piece.

- **Covered by this batch:** show the measured range, whether this batch is inside, and, when outside, the
  amount above or below the range. Say not to ship an outside batch and name the measured version that
  stayed inside, if one exists.
- **One version inside, another outside:** name the measured version to make and the version to drop.
- **Every measured piece of this plastic outside:** say which property missed and whether it was high or
  low, say not to ship the combination, and give one changed-piece test. Do not give an empty "change the
  build or the mix" instruction.
- **Not covered:** if this batch, mix, dirt or plastic type is different from every measured piece, say the
  numbers on hand do not cover this plastic or batch, say not to ship it, and give one test on a piece
  from this batch. Do not show a result or a pass.
- **Missing:** no usable measurement. No number, chart or pass. Say what to measure in one or two plain
  sentences, then stop.

## Rules

- A product name, a plastic name, a material sheet, a preset, a guessed range or an unmeasured build never
  produces a number.
- A version is named only when that version was measured.
- The next line must be one concrete action: make a named version, hold a named batch, run one named
  test, or measure one changed piece.
- If the measured pieces do not match this batch, mix, dirt or plastic, their numbers are not shown as a
  result for this input.
- Weight: weigh the actual piece, or density times volume.
- Sound: sound test on the actual piece.
- Strength or stiffness: test the actual piece.
- The active page contains no catalog, no 3D viewer, no score, no research library, no paper links.
- One column on a phone; a simple page on a desk; one accent for the action.

## Files

- `app/index.html`, `app/styles.css`, `app/main.js`, `app/product.js`
- `app/build.py` → `index.html` + `app/standalone.html`
- `app/tests/model.test.mjs`
- `demo/screenshots/v7/` — first open, no measurement, one batch, two versions, phone, mix mismatch.

The v0.6 interface, evidence-map screen, bracket studio and research notes are retired from the active
app; the sources are in `history/v0.6-app/` and `research/`.

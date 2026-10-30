# AnyRB

**A straight answer for a product made from recycled plastic.**

You name the product. You set the range that has to hold. You describe the plastic and what can change
from delivery to delivery. AnyRB tells you whether the product stays inside your range, and what to do
next — in plain words.

There is one screen and one job. No catalog, no material presets, no chart, no score, no 3D viewer, and
no research library in the app.

## What it asks

1. **What are you making?** Any product name.
2. **What has to stay steady?** Any property, with your own unit and a low/high range. Weight, thickness,
   strength, stiffness, sound insulation — or a property that is not on that list.
3. **What plastic are you using?** Plastic type, this batch, what it is mixed with, dirt or other plastic.
4. **What have you measured?** A number taken from the actual product, with the version, the batch, and
   the plastic that piece was made with. A plastic name or a number from a material sheet is not a
   measurement.

## How the answer is built

For every property, AnyRB compares the plastic you described with the plastic recorded on each measured
piece: the type, the batch, the mix, and the dirt or other plastic.

- **The numbers cover this batch.** AnyRB gives the measured range, says whether this batch is inside,
  and says by how much it misses when it is outside. It says not to ship an outside batch and names the
  measured version that stayed inside, if one exists.
- **One measured version is inside and another is outside.** AnyRB names the version to make and the
  version to drop. It does not suggest an unmeasured build.
- **Every measured piece of this plastic/mix/dirt is outside.** AnyRB says which property missed and
  whether the numbers are high or low, says not to ship the combination, and gives one changed-piece test
  as the next action.
- **The measured pieces are from another batch, mix, dirt, or plastic.** AnyRB says the numbers on hand
  do not cover this plastic or batch, says not to ship it, and gives the one test to run on a piece from
  this batch. It does not show a result or a pass.
- **Nothing is measured.** AnyRB shows no number and no pass. It says what to measure: weigh the actual
  piece, or do the one test that matches the property. Then it stops.

Every next line is a concrete action: make a named measured version, hold a named batch, run one named
test, or measure one changed piece. No number is filled from a product name, a plastic name, a material
sheet, a preset, or a guess.

## Open it

```bash
# simplest: double-click the built page
open index.html

# or serve it
python3 -m http.server 8000
# http://localhost:8000/index.html
```

The page works offline. It saves the current entry in this browser only.

## Build and test

```bash
python3 app/build.py          # app/index.html + sources → ./index.html and app/standalone.html
node app/tests/model.test.mjs # answer logic, empty states, version rule, language guard
make test                     # historical bracket engine tests
make test-server              # historical AI backend tests
```

The active app has no runtime dependencies and makes no network calls.

## Files

```
anyrb/
├── app/
│   ├── index.html      the one page: masthead, four questions, answer
│   ├── styles.css      paper, one accent, one column
│   ├── product.js      pure answer logic: plastic coverage, range, next action
│   ├── main.js         small DOM layer and localStorage
│   ├── build.py        inlines everything into one standalone page
│   └── tests/          model tests
├── index.html          built standalone page (open this)
├── history/v0.6-app/   retired v0.6 record + bracket interface; not built or linked
├── research/           research notes, kept out of the interface
├── engine/             historical bracket engine and tests
├── server/             historical local AI backend for the bracket prototype
├── validation/         historical validation suite for the bracket engine
├── demo/screenshots/v7/  the checked screens
└── V0_7_SPEC.md        the one-product contract
```

The old v0.6 app is kept only as history. It is not built, served, or linked from the page. The research
notes and the bracket engine are likewise outside the interface.

## What this does not claim

A measurement is not a guarantee about the next delivery. One batch stays one batch until it is measured
again. AnyRB does not certify a product, does not predict an unmeasured build, and does not turn a
literature number into a result for your product.

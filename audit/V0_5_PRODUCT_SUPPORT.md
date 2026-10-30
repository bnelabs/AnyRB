# AnyRB v0.5 — what the current files can and cannot support

**Audit written before any v0.5 app change.** Date: 2026-10-30.
**Scope reviewed:** `app/` (all JS, HTML, CSS, tests), `engine/anyrb/`, `server/`,
`data/feedstock_library.json`, `research/01`–`02`, `validation/`, `reports/`.
**Question:** which products and recycled-input streams can the *current* code support
with a measured or simulated result?

---

## 1. Short answer

| Product class | Can the current repo show a product property? | Why |
|---|---|---|
| **rPETG 3D-printed wall bracket** (the only modelled part) | **Yes — simulation only.** Stiffness, yield, elongation screen, printed mass, failure chance, batch window and lot recipe. | 2-D plane-frame FE and a lattice mass model exist for this one geometry. Material data are printed-rPETG literature values, not lot measurements. |
| **Any other named product** (pedal, tile, handle, weight, panel, sheet, counterweight, …) | **No.** | There is no generic geometry model, no generic material→product property link, and no product measurement store. |
| **Counterweight / mass of another product** | **No.** | No measured density of a delivered stream and no measured product volume are stored. The feedstock library densities are literature stand-ins. No counterweight geometry exists, and no 3-D volume model exists. |
| **Sound-insulation sheet / acoustic result** | **No.** | No acoustic measurement, no acoustic model, no sheet model, no thickness→insulation test, no transmission-loss data. A structural model cannot substitute. |
| **Thickness or weight of a sheet** | **No** (outside the bracket). | Thickness is only a drawing dimension of the bracket; mass is only the bracket lattice mass. Neither is a general product measurement. |
| **Recycled PP, rPET, rHDPE, mixes, contamination** | **No for an arbitrary product result.** | The library carries literature property distributions for these streams; it carries **no measured link** from plastic type / mix / contamination to any arbitrary product's chosen result. v0.4 also blocks all non-printed presets from the bracket designer. |

The current app is therefore **one simulated product**: the rPETG wall bracket. It is a
2-D frame model, not a 3-D product simulator.

---

## 2. Inventory of current product support

### 2.1 The bracket studio (`app/index.html`, `app/ui.js`, `app/engine.js`)

Fixed product contract (`app/config.js`, `PRODUCT_SPEC.md` §2):

- 150 × 60 × 10 mm cantilever bracket with a 10 mm wall pad, 7 × 3 X-braced lattice,
  94 two-dimensional frame elements, 32 nodes.
- In-plane tip load (default 150 N), tip-deflection limit (default 2.5 mm),
  failure-probability target (default 1 %).
- Outputs are **simulated**:
  - stiffness demand / deflection,
  - strength demand (yield),
  - elongation / brittle-lot screen,
  - analytic strut-sum mass and Halton printed-mass estimate,
  - bivariate-lognormal failure probability and Monte-Carlo cross-check,
  - batch acceptance window and lot-specific 8-control print recipe.

Material input path:

- Four material presets in `app/config.js` / `data/feedstock_library.json`:
  `rPETG` (printed), `rPET`, `rHDPE`, `rPP` (all moulded comparison data).
- `engine.familyFeasibility()` returns `process_ok:false` for every preset except
  `rPETG`. `app/ui.js` disables Design and renders the process gate. The v0.4 gate
  must stay.
- A user can paste supplier text; the parser extracts E/σy/density, but density is
  explicitly recorded for traceability only and **not used** in the bracket model
  (`qcRecord().notUsedNote`). The parser does not create a product property link.
- The lot-specific recipe accepts measured lot E, σy and measurement CV **for the
  bracket only**, and it still runs the bracket model. It is not a route for a
  counterweight, a sheet, or any other product.

What this means: the bracket's batch window and compensation recipe are the *only*
existing "input varies → product result" path, and they are explicitly scoped to the
bracket. They must not be repurposed.

### 2.2 Product geometry / 3-D

- `app/stl.js` and `engine/anyrb/stl.py` **write** an STL of the bracket lattice
  (overlapping strut boxes plus pad). They do **not** read STL, compute volume, or
  simulate anything.
- No 3-D FE, no 3-D mesh, no generic geometry kernel, no CAD import, no product volume
  extraction.
- The Design screen draws a 2-D SVG elevation. It is not a 3-D result.
- `server/app.py` image generation is an illustrative Muse Image render, explicitly
  labelled "not the CAD model" in the app; it is not a simulation.

### 2.3 Acoustic / sheet

- Search of `app/`, `engine/anyrb/`, `server/`, `data/` and `validation/` finds no
  acoustic property, no sound-insulation target, no transmission-loss model, no sheet
  geometry, and no thickness→acoustic test.
- The app has no result field for sound insulation, no dB unit handling, and no
  acoustic validation.

### 2.4 Mass / density / counterweight

- Printed mass exists only for the bracket lattice, from the bracket's own volume and
  the **preset density** in `config.js` / `feedstock_library.json`.
- The library densities are literature/engineering estimates:
  rPET 1.34, rPETG 1.24, rHDPE 0.95, rPP 0.94, mixed polyolefins 0.93 g/cm³. They are
  not measurements of a delivered batch.
- The app's QC block records a density field but labels it "not used — no calibrated
  proxy" (`app/ui.js`, Prove screen). It does not multiply density by product volume.
- There is no counterweight geometry and no measured product volume. Showing a
  counterweight mass from a library density would be exactly the failure mode the
  v0.5 brief prohibits.

### 2.5 Recycled input streams described in the research/library

`data/feedstock_library.json` and `research/01-recyclate-variability.md` contain
literature-derived distributions for:

- rPET, rPETG, rHDPE, rPP, rLDPE, mixed polyolefins;
- variability drivers: polymer mix, filler 2–24 wt % in spec-compliant rPP lots,
  contaminants/metals 1–3,000 ppm, up to nine polymers in a packaging stream;
- proxy ideas: MFR, density, NIR composition, ash/filler.

They are **literature evidence for why variability exists**, not a measured link from
those inputs to a chosen result of a user-named product. The library even marks the
MFR→mechanical relation as unreliable for rPP and the correlations as assumptions.
Using any of these to fill a product record would be a fabricated link.

---

## 3. What is missing for the v0.5 requirement

1. **An open product record.** Current state stores a bracket brief only
   (`localStorage` key `anyrb.v2.draft`). There is no product name, user-typed results,
   targets, input stream, measured link, empty measurement slot, or test-needed field.
2. **A measurement store.** Current measurements are bracket material parameters
   (E, σy) and QC traceability fields; there is no table of measured product results
   with source and what varied.
3. **A product-level property model.** No generic relationship exists between a
   varying recycled input and a user-named result. The bracket FE and the lot recipe
   are the only models, and both are bracket-only.
4. **A 3-D applicability decision.** No code decides whether a result depends on shape
   or whether the required measured density / modulus / strength is present.
5. **A three-outcome presentation.** The app currently shows a design/proof dashboard
   with charts, scores and pass/fail for the bracket only. Nothing renders the three
   v0.5 outcomes: measured link, one-batch measurement, or missing link.

---

## 4. Rules this audit imposes on v0.5

1. Keep the bracket studio as **one** simulated product, still labelled as a 2-D
   simulation, and do not use its result for the open record.
2. Add a single **open consistency record**; do not add product-specific screens or a
   closed product catalog.
3. Accept any product name and any result name/unit/range the user types.
4. Accept plastic type, batch, mix and contamination as **free text**, not presets.
5. A result is only shown when there is a valid measured link for **this product and
   this result**, with a named source and a stated variation. One batch → one-batch
   answer only. No measurement → blank result and the test still needed.
6. Do not derive a mass from the feedstock library density; do not invent a 3-D
   counterweight; do not route rPP/mixes/contamination through the bracket solver.
7. A 3-D model may be mentioned as applicable only when the result depends on shape
   and the required measured input exists. No generic 3-D simulator is added. Sound
   insulation is never a structural 3-D result.
8. Any 3-D-derived number (if one is ever produced) is labelled a simulation until a
   physical test of that same product exists.
9. The record, target, input and empty measurement slot are saved so the user can
   return with a measurement.

---

## 5. Evidence anchors in the current repo

- `app/config.js` — material presets, process flags, geometry, defaults.
- `app/engine.js` — 2-D frame FE, demands, mass, reliability, brittle screen.
- `app/optimize.js` — robust optimiser, batch window, lot recipe.
- `app/ui.js` — current 3-step UI, QC record, process gate, exports.
- `app/stl.js` — bracket STL **export only**.
- `app/aicore.js` — offline assistant, no product result model.
- `server/app.py`, `server/contract_v04.py` — AI schema validation; no acoustic or
  product-specific measurement endpoints.
- `data/feedstock_library.json` — literature distributions and gaps; no product link.
- `research/01-recyclate-variability.md` — variability evidence (rPP 10 lots,
  filler 2–24 wt %, contamination, MFR limitations).
- `validation/` — bracket/coupon validation only; coupon plan is for the bracket.
- `reports/` — qualification report for the bracket only.

**Conclusion:** the current files support exactly one product (the rPETG printed
bracket) and no arbitrary product/input stream. v0.5 therefore must start from the
user's own measurement data, not from the existing material library or models.

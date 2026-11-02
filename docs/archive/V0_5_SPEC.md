# AnyRB v0.5 — open consistency record (quality, not geometry)

**Status:** implementation contract. Audit of current support:
[`audit/V0_5_PRODUCT_SUPPORT.md`](audit/V0_5_PRODUCT_SUPPORT.md).

**One sentence:** AnyRB can now keep a user-named product's user-named result inside a
user-set range while the recycled input varies — but only when the record contains a
measured link for that same product and result. No link: the result stays blank and the
record names the test still needed.

The existing rPETG bracket studio stays as the one simulated product in the repo. It is
a 2-D frame simulation, not a 3-D simulator, and its numbers are never used for the open
record.

---

## 1. Product boundary

- **In scope:** one open record type that can represent any user-named product and any
  user-typed result. A product name is data, not a route in the code.
- **Out of scope:** a product catalog, a per-product screen, a general optimiser, a
  general 3-D simulator, a new material model, a finished-looking assurance screen.
- **Examples only:** a counterweight, a sound-insulation sheet, a pedal, a tile, a
  handle. None gets its own screen or preset.

The record is a single form. A saved record can be opened, copied to JSON and imported
back, so another product can be stored with an empty measurement slot.

---

## 2. Record schema

Local storage key: `anyrb.consistency.v1` (active record id + saved records).

```json
{
  "schema": "anyrb.consistency/v1",
  "id": "rec-...",
  "createdAt": "ISO",
  "updatedAt": "ISO",
  "product": "user text",
  "input": {
    "plasticType": "user text",
    "batch": "user text",
    "mix": "user text",
    "contamination": "user text"
  },
  "results": [
    {
      "id": "res-...",
      "name": "user text, e.g. mass",
      "kind": "mass|strength|stiffness|sound|thickness|other",
      "unit": "user text, e.g. g",
      "min": 40,
      "max": 50,
      "testNeeded": "user-editable test description",
      "link": {
        "varied": "what changed between measurements",
        "points": [
          {
            "id": "m-...",
            "choice": "product build / choice label",
            "input": "batch or input level label",
            "value": 44.2,
            "source": "named measurement source"
          }
        ]
      }
    }
  ]
}
```

Rules:

1. `product`, result name, unit and the four input descriptions are free text. No
   material preset is loaded into or inferred from this record.
2. Each result holds its own numeric target range. A sheet may hold sound insulation,
   thickness and weight as separate results.
3. `link.points` is the measurement slot. An empty array is stored as the empty slot.
4. The record is auto-saved on edit. It can also be downloaded/imported as JSON.
5. A record with no measurement is valid. It is shown as the missing-link outcome.

---

## 3. What counts as a measured link

A measurement point is **usable** only when it has:

- a finite result value;
- a named source (free text);
- an input-level label (batch/level);
- a product-choice label (blank is normalised to "As measured").

A result has a **measured link** only when:

- at least **two usable measurements** exist;
- they cover at least **two distinct input-level labels**;
- `link.varied` says what changed between them.

The app never treats any of the following as a link:

- the product name;
- a material preset or feedstock-library density;
- an assumed coefficient of variation;
- the bracket's 2-D model or its bracket-only lot recipe;
- a 3-D geometry with no measurement;
- a literature value.

One usable measurement on one input level is a **one-batch measurement**, not a link.
It may be reported for that batch only.

---

## 4. The three outcomes (exactly one per result)

Each result card renders one of these three states. There is no fourth score, gauge or
overall pass/fail.

### A. Measured link exists

Conditions: §3 link. Show:

- the measured result **range** (min–max of the measured points);
- how many distinct input levels and what varied;
- the measured **product choice** groups and their ranges;
- which measured choice or choices keep the range inside the user's target;
- all measurement sources;
- a clear statement that this is measured on this product/result, not a prediction for
  an unmeasured batch.

If no measured choice stays inside target, say so and do not invent a different build.
If a target bound is missing, show the range and that the target is incomplete.

### B. One batch measured only

Conditions: at least one usable measurement, but not a §3 link. Show:

- the measured value(s) for this batch (and product choice if given);
- whether **this batch** is inside the target;
- "one batch only — the next batch is not predicted";
- the source;
- no 3-D extension and no range forecast.

### C. No measured link

Conditions: no usable measurement, or a measurement that cannot be used because source,
input label, or `varied` is missing. Show:

- the result blank (`—`), not an estimate;
- the product, target and input already saved;
- the **test still needed**, named for this product/result/kind;
- the reason the link is missing;
- no chart, score, pass/fail or "assured" language;
- no 3-D simulation.

A partially entered measurement (e.g. value but no source) stays in the record and is
shown as an incomplete measurement, but it does not produce outcome A or B.

---

## 5. 3-D applicability gate

The record stores a computed `threeD` status per result in exports.

- A result **depends on shape** for mass, strength or stiffness. Acoustic/insulation
  results are not structural 3-D results. Thickness/dimension targets do not need a
  structural model. Other results get no default 3-D model.
- A 3-D model is **applicable** only if the result depends on shape **and** the required
  measured input exists: measured density for mass, measured modulus and strength for
  strength/stiffness. Presence is necessary, not sufficient: no generic model is added.
- v0.5 adds no 3-D simulator. It never produces a 3-D result for an arbitrary product.
  The UI must say what is missing instead of drawing a shape.
- The bracket studio's 2-D frame is not a 3-D model and is never presented as the 3-D
  result for another product.
- If a future version produces a 3-D number, it is labelled **simulation** until a
  physical test of the same product exists.

The v0.5 statuses are:

| Result kind | Shape-dependent? | 3-D status in v0.5 |
|---|---|---|
| mass | yes | No 3-D result. With a direct measured mass: not needed. Without: measured density + measured/3-D volume missing; library density not used. |
| strength / stiffness | yes | No 3-D result. Direct measurement: not needed. Without: measured modulus and strength for the material and process are missing, and no structural 3-D model exists for this product. |
| sound / acoustic | no structural 3-D result | No 3-D result. Acoustic test is required. |
| thickness / dimension | no | No 3-D result. |
| other | not assumed | No 3-D result. |

This is deliberately conservative. The goal is consistency from measurements, not a new
geometry demo.

---

## 6. UI

### Navigation

- Top-bar view switch: **Consistency** (default) and **Bracket studio**.
- Consistency: rail hidden, full-width single record, no AI badge/tooling.
- Bracket studio: existing three-step v0.4 studio, explicitly labelled as one simulated
  2-D bracket product. Its AI path and validation stay unchanged.

### Consistency screen

Two columns (stacked at narrow widths):

**Left — the open record**

- record switcher (saved records by user product name, New, Delete, Download, Import);
- product name;
- recycled input: plastic type, batch, mix, minor contamination (free text);
- results: name, unit, target min/max, type, remove; add result;
- each result: measurement editor with what varied, measurement rows
  (choice / input level / value / source), add measurement;
- per-result `testNeeded`.

**Right — what can be said now**

- promise: "Only measurements show a result. Nothing is filled from a preset."
- one result card per result with exactly one of the three outcomes;
- 3-D gate line for each result;
- sources table.

No chart, no overall score, no "assured" seal.

### Existing bracket studio

- Keep the 3-step flow and all v0.4 results.
- Add an explicit scope note that it is the one 2-D simulated bracket, not a 3-D
  product simulator and not proof for the open record.
- Version strings move to v0.5.

---

## 7. Tests

Add to `app/tests/run.mjs`:

1. empty record → outcome C, blank value, named test, no 3-D.
2. one usable batch measurement → outcome B, inside/outside, no prediction.
3. two input levels + source + what varied → outcome A, correct range.
4. two input levels but no `varied` → not a link (outcome C, blank).
5. missing source → not a link (outcome C).
6. product-choice grouping → correct measured choices inside/outside.
7. multi-result record → each result gets its own outcome independently.
8. arbitrary product/result names round-trip through persistence helpers unchanged.
9. sound insulation → 3-D never applicable; no structural result.
10. mass with no measurement → no mass from library density, no 3-D counterweight.
11. strength/stiffness with no structural model → no 3-D result.
12. record JSON export/import keeps empty measurement slots and test plan.
13. build and UI smoke: standalone app boots, view switch works, live/offline state.

Also re-run: engine tests, JS suite, server tests, validation suite.

---

## 8. Non-goals

- No product catalog or per-product screens.
- No general optimiser.
- No general 3-D simulator, CAD kernel or structural model.
- No new material model or literature-derived property link.
- No acoustic model.
- No fabricated pass/fail or assurance screen for a result without a measured link.
- No AI filling of missing record measurements.
- No replacement of the bracket studio's 2-D simulation.

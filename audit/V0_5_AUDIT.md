# AnyRB v0.5 — post-change audit

**Audit scope:** implementation of the open consistency record against the v0.5 brief.
**Pre-change support audit:** [`V0_5_PRODUCT_SUPPORT.md`](V0_5_PRODUCT_SUPPORT.md).
**Spec:** [`../V0_5_SPEC.md`](../V0_5_SPEC.md).

Date: 2026-10-30. Status: **PASS** for the stated scope, with the limitations listed in §5.

---

## 1. What changed

- New pure module `app/consistency.js`: record schema/normalisation, result-kind
  classification, target state, measured-link rules, the three outcomes, source rows,
  test-needed text, 3-D applicability gate, import/export helpers.
- New `app/consistency_ui.js`: one open record screen, saved records, local storage,
  JSON download/import, live outcome rendering, no AI and no engine calls.
- `app/index.html`: top-bar workspace switch (**Consistency** default, **Bracket studio**
  second), one consistency screen, explicit bracket-studio scope note.
- `app/ui.js`: workspace routing, hidden AI/lab controls on the consistency screen,
  v0.5 version labels; the bracket studio flow is unchanged.
- `app/styles.css`: new view-switch and record/outcome styles; responsive layout.
- `app/config.js`: v0.5 app metadata and the V05 rule contract.
- `app/ai.js`: fixed an existing dev-shell import bug (`fallbackLot` was imported but not
  exported; the built file did not exercise ES module export checking).
- `app/tests/run.mjs`: 11 consistency tests (48 total JS tests).
- `V0_5_SPEC.md`, `README.md`, `app/README.md`, `HACKATHON.md`, `demo/README.md`,
  `demo/screenshots/v5/`.

No change to the Python engine, FE model, optimiser, reliability code, material library,
AI contract or bracket validation suite.

---

## 2. Brief-to-implementation checks

| Requirement | Evidence |
|---|---|
| Any product, no closed catalog | `product` is free text; no product list/preset in `consistency.js` or `consistency_ui.js`. Saved-record switcher lists only user-created records. |
| Any result, typed by user | `result.name`/`unit` free text; kind select only controls model-limit copy. Multiple results per record. |
| User-set numeric range per result | `result.min`/`result.max`; target shown in every outcome card. |
| Input: plastic type, batch, mix, minor contamination | Four free-text fields in `record.input`; not matched to feedstock presets. |
| Measurement + source + what varied | `link.points[]` has choice/input/value/source; `link.varied` is required for a link. |
| Only measured link shows a range | `outcomeFor()` returns `mode:'link'` only with ≥2 usable points, ≥2 distinct input labels, sources and `varied`. |
| One batch stays one batch | `mode:'batch'`; UI says "One batch only... does not predict the next batch". |
| No measurement = blank + test | `mode:'missing'`; value/range null; `testNeeded` shown; no chart/score/pass-fail. |
| 3-D gate stored/shown | `threeDStatus()` per result, included in UI and in exported outcomes (`three_d`); every current status has `applicable:false` unless a future model is added. |
| No 3-D for no measurement | All missing outcomes show "No 3D result/Not applicable"; no geometry is generated. |
| No 3-D counterweight from library density | No density from `feedstock_library.json` is imported anywhere in the record path; mass-with-no-measurement remains blank and says measured density + volume are required. |
| Sound insulation never a structural 3-D result | `effectiveKind==='sound'` returns `not_applicable` with acoustic reason, even when a measured acoustic link exists. |
| Strength/stiffness need measured modulus/strength and a structural model | Missing strength/stiffness shows the requirement and states that the bracket 2-D frame is not used for this product. |
| Bracket studio remains one simulated product | The studio is still the v0.4 2-D bracket path; its scope note says so. Process gate and all v0.4 outputs unchanged. |
| Do not present bracket result as proof for another product | Consistency modules do not import `engine.js`/`optimize.js`/`config.js`; UI copy says the bracket model is not used. |
| Other products stay possible with empty slot | Saved records + JSON export/import include product, results, input and empty `link.points`; tested. |
| No general optimizer/3-D simulator/material model | No such module added; consistency code is ~1,180 lines of pure record logic and rendering (542 logic + 641 UI). |

---

## 3. Evidence produced

### Module assertions — 48/48 JS tests pass

New 11 tests cover:

- empty result → missing, blank, named test, no 3-D;
- one batch → inside/outside, no range/prediction;
- two input levels + sources + varied → measured range;
- missing source / input / varied → no link;
- product-choice grouping (inside and outside choices named);
- multi-result independence (sound/thickness/mass);
- sound link never structural 3-D;
- strength/stiffness without structural model → blank, required measurements;
- arbitrary product/result/target round-trip through JSON export/import;
- kind inference (sound, mass/weight, strength, stiffness, thickness);
- incomplete measurements and invalid target.

### Browser checks

| Surface | Check | Result |
|---|---|---|
| Dev shell `http://127.0.0.1:8123/app/` | boot, no page errors, consistency default, outcome card rendered | pass |
| Served app `http://127.0.0.1:8787/` | boot, consistency screen, AI pill hidden on record, visible/live in studio | pass |
| Standalone `file://…/anyrb/index.html` | boot, consistency screen, view switch, no page errors | pass |
| Mobile 390 × 844 | no horizontal overflow; record and outcome stack | pass |
| Full flow | no measurement → one batch → measured link; source/varied/target/choice changes update outcome; saved record survives switch and reload | pass |
| Multi-result | sound insulation, thickness and weight each get their own outcome | pass |
| Saved records | New record, switcher, download JSON, import JSON, empty slot preserved | pass |
| Bracket studio | existing `?smoke=1` flow reaches Prove; AI live/offline status unchanged | pass |

### Backend/validation

- Engine tests: **33/33 passed**.
- Server tests (mock): **51 passed, 1 skipped**.
- Independent validation: **56 PASS / 2 WARN / 0 FAIL** (58 checks), unchanged.
- Standalone build: `python3 app/build.py` → **516 KiB**, `node --check` pass.

---

## 4. Deliberate refusals (checked in code)

- No 3-D volume model, STL reader, generic CAD or structural solver is added.
- No measured density / modulus / strength fields are invented to make 3-D UI light up.
- No library density, preset mean, assumed CV or bracket result is used as a record link.
- No acoustic model or thickness→insulation relation is added.
- No product catalog, product selector or per-product screen is added.
- No chart/score/overall pass-fail is rendered for a record.
- No AI call is made from the consistency screen.

---

## 5. Remaining limitations (honest)

1. The 3-D gate always returns **not applicable / not used** in v0.5. The record can say
   what would be required, but no generic 3-D mass or structural model is implemented.
2. A measured link needs at least two input levels with a stated variation. Two
   measurements of the same input level remain a one-batch answer.
3. The product-choice answer comes from the user's measurement labels; the app does not
   enumerate or invent builds.
4. The measured range is evidence for the measured levels, not a prediction for an
   unmeasured batch.
5. Records live in browser local storage; download/import is the durable copy.
6. The bracket studio's 2-D simulation and its validation remain bracket-only and are
   unchanged.

These limitations are shown in the UI, not hidden.

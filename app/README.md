# AnyRB v0.2 — AI reliability studio (interactive app)

**One line:** AnyRB is an AI reliability studio for recycled plastics — describe the
part you need, give it the batch you actually have, and it designs internal geometry that
behaves reliably; the AI acts as the design partner, the verified physics does the math.

> **Decision support, not certification.** In-silico only. Literature-derived feedstock,
> simulated reliability, a local (not proven global) optimum, no physical testing.
> Validate with your own lot data and physical tests before production.

This folder is the judged hackathon artifact: a three-step AI studio (**01 Brief →
02 Design → 03 Prove**) wired to the FastAPI Meta backend in `anyrb/server/`, with a
deterministic offline assistant so the standalone file never breaks.

---

## 1. Run modes

| Mode | How | AI behaviour |
|---|---|---|
| **Offline standalone** (double-click) | open **`anyrb/index.html`** in Chrome/Safari (built by `python3 app/build.py`) | AI pill shows **Offline · fallback on**; deterministic assistant with identical JSON schemas; engine runs fully locally |
| **Dev shell** | `python3 -m http.server 8000` from `anyrb/`, open `http://localhost:8000/app/` | same as file:// (ES modules, no backend) |
| **Live served by backend** | `cd AnyRB && .venv/bin/python -m server.app` → `http://127.0.0.1:8787` (serves `anyrb/index.html` at `/`) | same-origin `/api/*`: Muse Spark for intent/plan/memos, Muse Voice for mic, Muse Image for the concept render; pill shows **Live · Meta models** |
| **Simulated live** (UI demo without backend) | add `?mock=1` | pill shows **Live · simulated Meta**; deterministic responses with synthetic latency, no network |
| **State demos** | `?state=loading`, `?state=error`, `?state=offline`; deep links `?screen=brief|design|prove` | forces the corresponding loading/error/offline UI state |

The backend holds the Meta API key; **the browser never sees a key**. Absent or
unreachable backend → offline assistant, clearly badged per card and in the top bar.

### Build / test

```bash
python3 app/build.py        # inlines app sources -> anyrb/index.html (+ app/standalone.html)
node app/tests/run.mjs      # 37 tests: engine fixtures, FE checks, v0.4 AI helpers
```

---

## 2. The three steps

**01 · Brief** — large prompt (textarea + mic + examples); the AI parses it into an
editable brief (part, load, deflection limit, reliability target, process, batch); the
lot passport card shows the verified recyclate preset (E, σy, CVs, density, 85/15
lot-to-lot variance) or extracts fields from pasted supplier text; plan preview shows the
three candidate directions.

**02 · Design** — one large engine-rendered lattice elevation (geometry / stress & buckling /
strut width modes, deformed-shape overlay, measurement ticks, load arrow); three hero
metrics (mass, P_f across batches, binding failure mode) each with a “why this number?”
disclosure; three AI-proposed candidate cards (width-field priors) **evaluated and ranked
by the verified engine**; an AI design memo whose numbers are injected from the engine
(ungrounded AI text is replaced by a deterministic fallback); a vs-conventional strip.
Selecting a candidate updates canvas, metrics, memo. “Continue to proof” optimises the
selected direction with the engine’s deterministic multi-start pattern search.

**03 · Prove** — reliability gauge (P_f vs target, governing mode, mass, printability),
batch acceptance window chart (engine-computed), live batch passport (lot mean E / σy →
required width scale, added mass, pass / compensate / reject), scientific-validation
checklist reading `validation/results.json` (fallback embedded: **56 PASS / 2 WARN /
0 FAIL · 58 checks**, L0–L1 achieved, L2 partial), AI qualification memo, Muse Image
concept render (labelled “AI illustration — not the CAD model”), exports (qualification
HTML report, STL, design JSON, AI provenance log), claims ladder and limitations.

Global chrome: AI status pill + mode menu, lab mode (advanced material/load/width inputs),
session card, AI provenance drawer showing model · latency · cached · fallback · schema ·
grounding for every call.

---

## 3. AI integration and honesty

| Endpoint | Live model | Job | Fallback |
|---|---|---|---|
| `GET /api/health` | — | detect live backend, models, validation counts | offline assistant |
| `POST /api/brief/parse` | Muse Spark 1.3 | NL brief → validated JSON targets | keyword/number heuristics |
| `POST /api/lot/parse` | Muse Spark 1.3 | supplier text → material distribution | number extraction heuristic |
| `POST /api/design/plan` | Muse Spark 1.3 | brief + baseline → 3 width priors | deterministic 3 priors from first-pass feasibility |
| `POST /api/design/review` | Muse Spark 1.3 | metrics → design memo | templated memo from payload numbers |
| `POST /api/proof/memo` | Muse Spark 1.3 | qualification narrative | templated narrative |
| `POST /api/voice/transcribe` | Muse Voice | mic brief (MediaRecorder) | offline demo transcript (mic disabled offline) |
| `POST /api/image/render` | Muse Image 1.0 | illustrative concept render | embedded Muse Image demo render (`app/product_render.js`) |
| `GET /api/validation` | — | real validation summary | embedded 56/2/58 fallback |

Every AI response carries `_meta = {model, latency_s, cached, fallback, grounding, ...}`
and every card shows a badge from it. **Number grounding:** AI memos may only phrase
numbers present in the structured payload the app sends (engine metrics, brief targets,
validation counts). The client re-validates every number; ungrounded text falls back to a
deterministic template and the provenance row records `fallback`/`grounding`.

**Mass disclosure (validator F4):** the analytic mass counts strut volumes before unioning
at joints. For the robust design, printed Halton-union estimate 46.40 g vs analytic 50.81 g (upper bound,
+9.5 % conservative; corrected v0.3 audit). The app reports the printed union estimate as the
design mass, shows the analytic upper bound as a footnote, uses printed mass for candidate
ranking/comparison bars, and includes both in the exported report/JSON.

---

## 4. Architecture

```
app/
  index.html      dev shell (ES modules, needs HTTP)
  styles.css      v0.2 design system: exact DESIGN_SPEC tokens (warm paper, ink,
                  safety orange + verified green, serif display, tabular numerals)
  config.js       engine/material/optimiser defaults (unchanged v0.1 physics config)
  engine.js       verified 2-D frame FE, width field, demands, mass, bivariate-lognormal
                  reliability, two-level sampling, Monte-Carlo, metrics  (UNCHANGED)
  optimize.js     multi-start pattern-search robust optimiser, baselines, batch passport,
                  acceptance window, sensitivity  (UNCHANGED)
  stl.js          binary STL of strut boxes + wall pad  (UNCHANGED)
  aicore.js       pure AI layer: offline assistant, response normalisers, brief/lot
                  coercion, candidate priors + engine ranking, number grounding,
                  provenance, payload builders, validation fallback
  ai.js           browser AI client: /api/health detection, live/mock/offline modes,
                  fetch + timeout/retry/fallback, schema validation, provenance log
  product_render.js embedded Muse Image concept render (downscaled, single-file safe)
  ui.js           3-step state machine, DOM/canvas/SVG rendering, memos, passport,
                  validation, exports, provenance drawer, demo states
  build.py        inlines modules (scoped IIFEs) + CSS into a classic-script standalone
  tests/run.mjs   engine fixture tests + v0.2 UI-helper tests
```

Build notes: sources are ES modules for Node/dev; `build.py` wraps each module in its own
scope, wires imports/exports through a registry, inlines CSS, strips dev-only markup and
runs `node --check` on the generated classic script. No external fonts, CDNs or assets.

---

## 5. Results in the app (rPETG, 150 N, 2.5 mm, 1 % target)

| Quantity | Value |
|---|---|
| default uniform 2.0 mm | 62.69 g · P_f 0.0082 % · governing Euler buckling |
| robust multi-start optimum | **46.40 g · P_f 0.996 %** (analytic mass basis) |
| comparison | solid 111.60 g · uniform target-sized 53.97 g @1.00 % · nominal FoS1.5 50.77 g · mean-only 41.11 g @51.8 % |
| printability | min width 1.24 mm · L/w 21.9 · neighbour ratio 1.38 (pass; limits enforced) |
| batch passport at robust design | E ×0.90 → global-equivalent 1.15 (+14.9 % printed mass, conditional); E ×0.50 → reject; 8-control resize, 12 % measurement CV retained |
| validation | 56 PASS / 2 WARN / 0 FAIL · 58 checks · L0–L1 verified, L2 partial |
| AI verification | live backend: brief/plan/review/proof via Muse Spark (10.8–22.8 s, cached on repeat), Muse Image render, Muse Voice ASR |

Engine fixture cross-check against the canonical Python engine remains exact (deterministic
fields ≤1e-9 relative, P_f ≤1e-6 absolute).

---

## 6. Known limits / deviations from the prototype

- **Physics unchanged from v0.1:** linear-elastic 2-D frame; no plasticity, creep,
  fatigue, joints, out-of-plane/layer-normal loading or spatial material scatter; Euler
  buckling is pure axial with pinned–pinned effective length; feedstock distributions are
  literature-derived. The optimum is local (multi-start pattern search), not proven global.
- **Analytic mass is conservative** (node overlap not unioned; validator F4 WARN).
- **Batch passport/acceptance window** is illustrative v0.1 logic; replace assumed lot
  means with supplier measurements before production decisions.
- **Design prototype adoption:** tokens, copy deck and screen order follow
  `design/DESIGN_SPEC.md`; the Design screen uses the prototype's two-column hero
  (visualisation + stacked metrics) and “Three ways to build it” candidate row. The
  lattice is a live engine-rendered SVG (the prototype used a placeholder frame), and
  class names follow the DESIGN_SPEC component inventory rather than the prototype's
  internal classes because implementation started before `prototype.html` landed. Small
  spacing/hierarchy differences from the prototype remain (noted for the designer).
- Live AI latency is model-bound (Spark calls 9–20 s; cached ≈1 ms). The engine numbers
  never wait for AI: canvases and metrics render first, memos/render appear async with
  skeletons and badges. Timeouts 90 s with retry → deterministic fallback.
- Safari was not machine-verified here (headless evidence is Chrome via CDP); code uses
  broadly supported APIs and guards clipboard/MediaRecorder.


---

## v0.3 — response to independent review (JS/UI half)

The Python engine (`engine/anyrb/`) is the reference implementation; the app mirrors it.

1. **Printed mass is the headline mass.** `engine.js` implements the same deterministic
   **Halton quasi-Monte-Carlo union** (60,000 samples, bases 2/3/5, bbox
   [-4,154]×[-4,64]×[-5,5], pad [0,10]×[0,60], strut boxes along their full length) as
   `engine/anyrb/lattice.py::printed_volume_mm3`. JS matches the Python values:
   w=1 mm 33.0888 g, w=2 mm 55.9081 g, w=3 mm 75.5722 g, w=4 mm 92.1566 g; the shipped
   robust design 46.40 g printed vs 50.81 g analytic upper bound. `mass_g` remains the
   analytic upper bound; `printed_mass_g` is displayed/exported and used for final
   candidate ranking/selection, baselines and passports. The optimisation search still
   ranks with the fast analytic bound.
2. **Printability is a hard constraint.** Robust/nominal/mean-only objectives include the
   same penalty as Python (neighbour width ratio > 1.5, slenderness > 30; weight 80), and
   final selection/baseline rows require `printability.pass`. The definition is the
   Python one: ratio over consecutive FE elements **including wrap-around**
   (`np.roll(widths, 1)`). Ratio/slenderness badges are shown on candidates and Prove.
3. **Known lot keeps measurement uncertainty.** `E.lotFromMeasurement(material, E, sy,
   measurementCv=0.12)` combines within-lot and measurement CV in quadrature and sets
   lot fraction 0 (Python-identical: E_cv 0.126095… for rPETG with CV 12 %).
4. **Lot-specific resize, not one global scale.** `optimize.lotSpecificRecipe()` optimises
   all 8 width controls for the measured lot (measurement CV retained), returning the 8
   width multipliers, `global_equivalent_scale` (slicer fallback only), printed mass and
   delta, P_f, printability and verdict ∈ pass as designed / pass with compensation /
   conditional (heavy compensation) / reject–reroute. Prove shows the 8 multipliers, QC
   record (lot ID, supplier, measurement used + CV, recycled content marked "paperwork
   claim") and the recipe note.
5. **Brief feasibility gate.** `E.familyFeasibility()` evaluates the widest printable
   uniform lattice (4.0 mm) against the target; when infeasible the Brief shows an
   "Infeasible for this bracket family" banner with the minimum achievable P_f and the
   Design button is disabled (no AI plan call, no candidate drawn).
6. **Sustained-load advisory.** `E.sustainedBound()` reports the creep ×2.0 /
   compression ÷0.8 bound (E_req×2, σy_req÷0.8, deflection×2) with P_f and deflection
   bounds; labelled advisory only, never the static allowable. If the bound fails, Prove
   says the part is **not qualified for sustained load** (static result unchanged).
7. **Family scope & claims.** Every Design/Prove result is labelled "best of this
   bracket/lattice family"; exports carry the QC record, analytic upper bound, printed
   mass, printability, sustained advisory, lot recipe and the updated claims ladder.
8. **Tests.** `node app/tests/run.mjs` → **33 passed** (v0.3: Halton mass vs Python
   references < 0.5 %, printability wrap definition, feasibility gate, measurement CV,
   8-control recipe, sustained bound). Fixtures are tolerated if the Lead's regenerated
   `reference.json` lacks the new fields; when `printed_mass_g` / `printability` are
   present they are compared directly (tolerance 0.5 % mass, 1e-9 printability).

**Fixture fields requested from the Lead:** `cases[*].printed_mass_g`,
`cases[*].mass_analytic_g`, `cases[*].printability
{min_width_mm,max_width_mm,max_slenderness,max_neighbour_width_ratio,out_of_bounds}`;
optionally a `lot_recipe` fixture for a weak measured lot. The app works without them
using the Python reference values above.


---

## v0.4 — remaining-gaps release (second review)

All JS mirrors the Python reference (`engine/anyrb/`); no physics objective change.

1. **Printed-process gate.** Presets carry `process`, `printProcessOk` (FDM/FFF only) and
   printed elongation. `E.familyFeasibility` returns
   `{feasible:false, process_ok:false, reason:"process_mismatch", detail}` for moulded-data
   presets (rPET, rHDPE, rPP), and the Brief shows a clear “material data is injection/
   compression — not valid for a printed lattice” banner, disables Design and never calls
   the AI plan. Presets remain visible with a “contrast only” label; rPETG is the valid default.
2. **Brittle-lot screen.** `E.failureProbabilityElongation` is the marginal lognormal
   P(elongation-at-break < strain demand), lot/within split identical to Python.
   `E.brittleScreen` adds `strain_req`, `elongation_mean_pct`, `elongation_cv`,
   `pf_brittle`, `pf_brittle_bound` and `brittle_ok`. Design/Prove show a card explicitly
   labelled **NOT in headline P_f**, with the E–elongation correlation (−0.25) flagged as an
   assumption. Exports carry the screen; the design objective is unchanged.
3. **Union-mass final polish.** After multi-start selection, a short local pattern search
   (≤90 evals) minimises the 10k-sample Halton printed mass subject to P_f + printability,
   then checks the final 60k estimate; accepted only if printed mass improves by ≥0.1 %.
   `union_polished`, `union_evals`, pre/post printed masses are exposed and reported; the
   global search still ranks with the analytic bound (disclosed).
4. **Assumption bounds.** `E.assumptionBounds` varies corr(lnE, lnσy) 0.30/0.70 and the
   lot-vs-within split 75/95 % and reports the P_f range. Prove shows a compact band labelled
   “assumption sensitivity, not validation”.
5. **QC/lot record.** Existing lot ID / supplier / measurement used / measurement CV /
   recycled-content fields stay; optional MFI, density and tensile-row fields are recorded for
   traceability only and explicitly marked “not used — no calibrated proxy” (E and σy are the
   only simulation inputs). Exports/report include the record, the “paperwork claim” note, and
   a design-stage statement that no delivered lot exists unless lot fields are filled.
6. **Validation fallback** remains 56 PASS / 2 WARN / 0 FAIL · 58 checks (live reads
   `/api/validation`). Tests: process gate, brittle constants vs Python, union polish
   improvement/no-regression + runtime, assumption bounds, plus the existing engine/hero suite.

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
node app/tests/run.mjs      # 28 tests: engine fixtures, FE checks, v0.2 AI helpers
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
checklist reading `validation/results.json` (fallback embedded: **45 PASS / 1 WARN /
0 FAIL · 46 checks**, L0–L1 achieved, L2 partial), AI qualification memo, Muse Image
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
| `GET /api/validation` | — | real validation summary | embedded 45/1/0 fallback |

Every AI response carries `_meta = {model, latency_s, cached, fallback, grounding, ...}`
and every card shows a badge from it. **Number grounding:** AI memos may only phrase
numbers present in the structured payload the app sends (engine metrics, brief targets,
validation counts). The client re-validates every number; ungrounded text falls back to a
deterministic template and the provenance row records `fallback`/`grounding`.

**Mass disclosure (validator F4):** the analytic mass counts strut volumes before unioning
at joints. For the robust design, analytic 50.73 g vs voxel-union estimate ≈ 40.5 g
(≈20 % lower; analytic ≈25 % conservative). The app reports the conservative analytic
figure, shows the footnote on Design and Prove, includes it in the exported report/JSON,
and keeps comparison bars on the same analytic basis.

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
| robust multi-start optimum | **50.73 g · P_f 0.997 %** (analytic mass basis) |
| comparison | solid 111.60 g · uniform target-sized 60.31 g @1.00 % · nominal FoS1.5 56.41 g · mean-only 44.34 g @51.8 % |
| printability | min width 1.18 mm · L/w 22.7 · neighbour ratio 1.45 (all pass) |
| batch passport at robust design | E ×0.80 → scale 1.10 (+8.5 % mass, pass); E ×0.50 → reject |
| validation | 45 PASS / 1 WARN / 0 FAIL · 46 checks · L0–L1 verified, L2 partial |
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
- Live AI latency is model-bound (Spark calls 8–25 s; cached ≈1 ms). The engine numbers
  never wait for AI: canvases and metrics render first, memos/render appear async with
  skeletons and badges. Timeouts 90 s with retry → deterministic fallback.
- Safari was not machine-verified here (headless evidence is Chrome via CDP); code uses
  broadly supported APIs and guards clipboard/MediaRecorder.

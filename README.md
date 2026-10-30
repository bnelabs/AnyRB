# AnyRB — Any Recycled Batch

**AnyRB — Any Recycled Batch.** Software for keeping a recycled-plastic product consistent while the
batch changes. Name the product, the result and the range that must hold, describe the recycled input
that can vary, and enter the measurement that links them. A result appears only when the record holds a
measured link for that same product and result.

> *Recycled plastic is not a second-class material. It is a distribution. AnyRB works with the distribution.*

Built for the **Meta Global AI Developer Hackathon — Indie Developer track, "Push the Frontier"**.

> **v0.6 (evidence map):** the record is now backed by a pre-written **evidence map** of what is measured
> on a product class, what is model only, and what is absent. One calculation is allowed — the PNAS 2025
> `{8,5}` rHDPE-platelet / PDMS-matrix modulus case — and only with a measured recyclate stiffness
> distribution **and** a measured composite modulus baseline; it is labelled simulation. The paper's
> measured result is **18 %→4 % modulus scatter on those composite specimens**; the 93 % stretch-film
> figure is model-only and is not copied. The historical bracket studio, voice brief and concept image
> are off the default path. See [`V0_6_SPEC.md`](V0_6_SPEC.md),
> [`research/06-evidence-map.md`](research/06-evidence-map.md) and the deep read
> [`research/06a-pnas-deep-read.md`](research/06a-pnas-deep-read.md).
>
> **v0.5 (quality consistency):** an **open consistency record** for any user-named product and result.
> It shows one of three outcomes only: a measured link with a range and measured product choice, a
> one-batch measurement, or no measurement with the test still needed. No product catalog, no material
> preset and no model fills a result. See [`V0_5_SPEC.md`](V0_5_SPEC.md) and the pre-change audit
> [`audit/V0_5_PRODUCT_SUPPORT.md`](audit/V0_5_PRODUCT_SUPPORT.md).
>
> **v0.4 (remaining gaps):** printed-process gate (IM presets blocked), elongation/brittle-lot screen, final union-mass polish, and assumption-sensitivity bounds. See the v0.4 addendum in [`REVIEW_RESPONSE.md`](REVIEW_RESPONSE.md).
>
> **v0.3 (review response):** headline masses are now printed union estimates (robust ~46.4 g; analytic 50.8 g upper bound), printability is enforced, known-lot passports keep measurement uncertainty, compensation is an 8-control lot-specific resize, and the Brief runs an engine feasibility gate. Full point-by-point response: [`REVIEW_RESPONSE.md`](REVIEW_RESPONSE.md).

**Repo:** `github.com/bnelabs/AnyRB` (private) · **Product:** AnyRB — Any Recycled Batch.
The **consistency record** uses measurements only and has no AI. The **historical bracket studio** is a
separate 2-D simulation of one printed bracket; Meta models (Muse Spark, Muse Image, Muse Voice
Transcribe, SAM 3.1) live only there. The AI backend contract remains v0.4.

---

## Deliverables quick index

- **App:** `index.html` (single file; consistency record opens by default; evidence map one click away; historical bracket studio at the bottom link; auto-connects to the local backend) — also served at `/`
- **v0.6 evidence:** `research/06-evidence-map.md` + `research/evidence_map.json` + `research/06a-pnas-deep-read.md` + `research/06b-primary-links.md` · `app/evidence.js` / `app/evidence_ui.js` · `V0_6_SPEC.md`
- **v0.5 record:** `app/consistency.js` (outcome rules, no DOM) · `app/consistency_ui.js` (one open record) · `V0_5_SPEC.md` · `audit/V0_5_PRODUCT_SUPPORT.md`
- **Hackathon pack:** `HACKATHON.md` (models, demo script, checklist) · `PRODUCT_V2.md` (IA/AI requirements)
- **Research:** `reports/AnyRB_Research_Synthesis.pdf` · `reports/AnyRB_Full_Research_Dossier.pdf` · `research/00–05`
- **Qualification report:** `reports/AnyRB_Qualification_Report.pdf` (generated per design; `make report`)
- **Live Meta backend:** `server/` (`API.md`, tests, `evidence/live_calls.json`)
- **Independent validation:** `validation/VALIDATION.md` + `results.json` (56 PASS / 2 WARN / 0 FAIL)
- **Specs:** `V0_3_SPEC.md` / `V0_4_SPEC.md` / `V0_5_SPEC.md` / `V0_6_SPEC.md`; point-by-point review response `REVIEW_RESPONSE.md`
- **Audits:** `audit/AUDIT.md`, `audit/REAUDIT.md`, `audit/HACKATHON_AUDIT.md` (historical v0.2: SHIP); v0.3/v0.4 delta audits; v0.5 pre/post audits; v0.6 research + implementation audit `audit/V0_6_AUDIT.md`

## The product in three minutes

| Workspace | What you do | What happens |
|---|---|---|
| **Consistency record** (default) | Name any product, type the result and target range, describe the recycled input, then enter measurements with sources. | Each result gets exactly one outcome: measured link, one-batch measurement, or missing link. Missing means blank result plus the test still needed. Product names, material presets, assumed CVs and the bracket model never fill a gap. |
| **Evidence map** (research) | Read what is measured on a product class, model only, or absent. | The map backs the one allowed calculation. It cannot fill a record result. A citation is not a result on your batch. |
| **Historical bracket studio** (off default path) | Describe the rPETG wall bracket, choose/import the lot, inspect, screen and export. | Muse Spark / Voice Transcribe / Muse Image remain inside this one 2-D bracket simulation. It is historical evidence for that one part, not proof for another product. |

### The consistency record in detail

- **Any product name** — pedal, tile, handle, counterweight, sound-insulation sheet, panel or something
  not on that list. There is no product selector and no closed catalog.
- **Any result name** — mass, thickness, strength, sound insulation or text the user types. Each result
  has its own unit and numeric target range; a sheet can hold sound insulation, thickness and weight.
- **The input** — plastic type, batch, mix and minor contamination, in the user's own words.
- **The measured link** — measurements for the same product and result, each with a named source, an
  input level, and a "what varied" description. Two or more input levels are required before the app
  shows a range. One level stays one batch.
- **The 3D gate** — the record stores whether a 3-D model could apply. It never runs one for an
  arbitrary product: mass needs a measured density and a measured/modelled volume, strength/stiffness
  need measured modulus and strength plus a structural model, and sound insulation is never a structural
  3-D result. No 3-D number is generated to fill a missing link. The bracket's 2-D frame is not used here.
- **Saved records** — the screen can hold several user-created records and stores empty measurement slots,
  targets and test plans. Records can be downloaded and imported as JSON.

There is no chart, score or overall pass/fail for the consistency record. That is deliberate: a pretty
screen is not a measurement.

### The one calculation (PNAS 2025 `{8,5}` case)

- **What the paper measured:** rHDPE platelets in a soft PDMS matrix, fabricated `{N=8, M=5}` composite;
  modulus scatter reduced from **18 % to 4 %** on those specimens (n = 5 composite; n = 50/10 plates
  feedstock). Strength 0.22 MPa. The paper reports **no absolute measured composite modulus mean**.
- **What the app needs:** the PNAS `{8,5}` case selected and confirmed, a modulus/stiffness result in MPa
  with a target, a measured recyclate stiffness distribution, and a measured composite modulus baseline
  (n ≥ 3, named source). Without any required input it does not run; it names the missing test.
- **What it computes:** a baseline-anchored, case-scaled simulation. The measured 18 %→4 % CV ratio sets
  the spread; your measured baseline sets the absolute MPa level. P5–P95 range and inside/outside target
  are shown with a **simulation** label. It is not the paper's full UATSC network and not a physical test
  of your product.
- **What is not used:** the paper's **93 %** is the model-only `{8,7}` stretch-film case relative to a
  modelled ≈26 % total introduced variability (554 ± 10 MPa, CV 2 %); it is never copied. Library
  density, counterweight mass, sheet acoustics, another plastic/mix/contamination and the historical
  bracket are not used to fill a result.

## Run it

### Live AI mode (Meta models in the live path — the hackathon demo)
```bash
cd AnyRB
cp server/.env.example server/.env     # add your Meta API key; never commit this file
.venv/bin/python -m server.app         # http://127.0.0.1:8787
```
Open **http://127.0.0.1:8787** — the backend serves the app and same-origin `/api/*` endpoints.
The consistency record opens by default and uses no AI. Open the **historical bracket studio** from the
record's bottom link for the Meta model path; only there the app shows a green **Live · Meta models**
pill and logs every call in the AI activity drawer.

### Offline mode (no network, no key)
Open **`index.html`** by double-click or use `http://127.0.0.1:8787/`. The consistency record works
offline without any AI. The standalone file also probes the local backend at `127.0.0.1:8787`; in the
**historical bracket studio**, live AI switches to **Live · Meta models** when the backend is running, otherwise it
uses the built-in offline assistant (badged, with every AI-shaped response labelled `fallback`). Useful for
judges without network and for stage safety.

### Rebuild
```bash
python3 app/build.py          # → anyrb/index.html (single file) + app/standalone.html
make test                     # 33 engine tests (~55 s), includes Python↔JS cross-check
make test-server              # AI backend tests in mock mode
node app/tests/run.mjs        # 54 JS tests (37 bracket + 11 record + 6 evidence/calculation)
make validate                 # independent scientific validation suite (56 PASS / 2 WARN / 0 FAIL)
make verify-live              # real Meta calls → server/evidence/live_calls.json
make report                   # regenerate qualification report + STL
make pdf                      # rebuild PDF deliverables
```

## Meta models in the live path (verified 2026-10-29)

| Model | Role | Endpoint | Observed latency |
|---|---|---|---|
| **Muse Spark 1.3 Contributor** | brief parser, lot-datasheet extractor, design proposer, design reviewer, qualification narrative | `/api/brief/parse`, `/api/lot/parse`, `/api/design/plan`, `/api/design/review`, `/api/proof/memo` | 9–20 s measured (v0.3 live pass) |
| **Muse Voice Transcribe 1.0** | hands-free design brief | `/api/voice/transcribe` | ~3.6 s |
| **Muse Image 1.0** | illustrative product render | `/api/image/render` | ~12–20 s |
| **SAM 3.1** | optional existing-part photo segmentation | `/api/photo/segment` | optional |

**AI safety/grounding rules:** the browser never sees the key; every model response is JSON-schema
validated; every call is cached and provenance-logged. Every number in AI-authored **review and proof
memos** is checked against the structured payload — ungrounded output is replaced by the deterministic
fallback. Brief/lot parsing is schema-constrained and range-clamped; design proposals are parameter priors
that the verified engine evaluates and ranks. The AI may phrase numbers; it may not produce them.

## Science (the part that does not move)

- 2-D plane-frame FE, 94 elements / 96 DOF, exact Euler–Bernoulli element, unit-load caching.
- Material demand pair (σ_req, E_req) from yield + Euler buckling + deflection limits.
- Closed-form bivariate-lognormal batch failure probability, cross-checked against Monte-Carlo, SciPy
  and independent quadrature.
- Deterministic multi-start pattern-search optimiser (mass minimisation subject to P_f ≤ target), with
  six baseline strategies (solid, uniform, mass-matched, nominal FoS 1.5, mean-only, robust).
- Batch passport: lot-specific 8-control resize + global-equivalent slicer scale, measurement CV retained, acceptance window, and a QC record (lot identity, supplier, measurement, recycled-content paperwork claim).
- Independent validation suite: **56 PASS / 2 WARN / 0 FAIL** — including a re-implemented frame element, corrected full-length union sampling, Halton-QMC vs 2e6-sample Monte Carlo, cell-size and pin-joint model-form bands, coupon pre-registration,
  an energy-minimisation solver, 1e6-sample Monte-Carlo checks, periodic unit-cell homogenisation,
  optimiser brute-force comparison, and STL geometry audit. The two WARNs are *known, quantified*
  items: analytic strut-sum is an upper bound (robust design: analytic 50.8 g vs printed union
  estimate 46.4 g, +9.5 % conservative; the old 25 %/40.5 g figure came from a validator sampler bug and is retired).
  The Halton printed-union estimate itself is audited against independent Monte Carlo (F5): ≤0.1 % on the shipped
  designs, worst 0.35 % at w=1 mm — the second documented WARN. See [`validation/VALIDATION.md`](validation/VALIDATION.md).

## Honest limits

**Bracket studio (simulation):** no physical testing; linear-elastic 2-D idealisation (no plasticity,
creep, fatigue, layer anisotropy, out-of-plane behaviour, joint detail, print defects); literature-derived
feedstock distributions must be replaced by the user's lot data; optimiser is a local search, not a
global-optimality proof; mass is conservatively over-counted at joints; AI text is explanatory, rounded
through the engine and never the source of a number. The result applies to this bracket only.

**Consistency record (measurements):** it shows a range only for the product/result measurements stored
in that record. It does not predict an unmeasured batch, does not infer a missing result from a product
name, material preset, assumed CV or the bracket model, and does not run a generic 3-D simulator. One
batch stays one batch; no measurement stays blank with the test still needed. A measured range is not a
guarantee that the next delivered batch will be inside the target — it is evidence from the batches that
were measured.

**PNAS `{8,5}` calculation (simulation):** the paper measured 18 %→4 % modulus scatter on its fabricated
rHDPE-platelet / PDMS-matrix specimens, not an absolute mean; the paper's 93 % applies only to its
model-only `{8,7}` stretch-film case relative to a modelled ≈26 % input. The app's calculation is
baseline-anchored case scaling, not the paper's full UATSC network and not a test of the user's product.
It requires a measured recyclate distribution and a measured composite baseline; otherwise it does not
run and names the test. It does not transfer to counterweight mass, sound insulation, another plastic,
mix or contamination.

## Repository map

```
AnyRB/
├── index.html                  ← standalone app (auto-connects to local backend when running)
├── app/                        ← app sources: consistency.js, evidence.js, consistency_ui.js, evidence_ui.js, ui.js, engine.js, optimize.js, ai.js, aicore.js, styles.css, build.py
├── server/                     ← FastAPI Meta AI backend (Spark/Image/Voice/SAM), API.md, tests, live evidence
├── design/                     ← v0.2 design system + high-fidelity prototype (visual target)
├── validation/                 ← independent validation suite, results.json, VALIDATION.md, figures
├── engine/                     ← canonical Python engine + 33 tests + fixtures
├── research/                   ← cited dossiers 00–06: v0.6 evidence map, PNAS deep read, primary links, references
├── reports/                    ← qualification report, STL, PDFs
├── audit/                      ← v0.5/v0.6 audits + historical v0.2/v0.3/v0.4 audits
├── REVIEW_RESPONSE.md          ← point-by-point reply to the external review
├── V0_3_SPEC.md                ← shared v0.3 response contract
├── V0_4_SPEC.md                ← v0.4 remaining-gaps contract
├── V0_5_SPEC.md                ← v0.5 consistency-record contract
├── V0_6_SPEC.md                ← v0.6 evidence-map + PNAS case contract
├── PRODUCT_V2.md               ← product/IA/AI requirements
├── HACKATHON.md                ← submission pack: models, demo script, checklist
├── REPORT.md                   ← research synthesis (the scientific answer, cited)
└── README.md
```

## The one-paragraph answer

Batch variability stops recycled polymers from being used where reliability matters, and physical testing
cannot be the design-time answer: it is too slow, too late and too expensive per iteration. Software can
replace the design iteration by treating the lot distribution as the input — encode the variability,
propagate it through verified mechanics, optimise the internal geometry for a chosen reliability instead
of a nominal safety factor, and output a printable design plus a lot-acceptance/compensation recipe.
AnyRB also adds the other half of the problem: an open consistency record that keeps a user-named
product's result inside a target only when there is a measured link for that product and result. If there
is no link, the record stays blank and names the test. An evidence map gates the only calculation (the PNAS
{8,5} composite modulus case) and marks the model-only film result and the absent counterweight/sheet/batch
links. With Meta AI models making the bracket workflow usable by a designer rather than a CAE specialist,
and the deterministic engine keeping every bracket number honest, the deliverable includes a claim ladder,
an independent validation suite, and the minimum experimental programme (T1 per-lot tensile, T2 lattice
coupons, T3 full bracket) that would turn a good virtual design into a measured one.

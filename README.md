# AnyRB — Any Recycled Batch

**AnyRB — Any Recycled Batch.** An AI reliability studio for recycled plastics. Describe the part you need, give it the batch you
actually have, and get an internal geometry that behaves reliably — plus the proof you can hand to a review.

> *Recycled plastic is not a second-class material. It is a distribution. AnyRB designs for the distribution.*

Built for the **Meta Global AI Developer Hackathon — Indie Developer track, "Push the Frontier"**.

> **v0.4 (remaining gaps):** printed-process gate (IM presets blocked), elongation/brittle-lot screen, final union-mass polish, and assumption-sensitivity bounds. See the v0.4 addendum in [`REVIEW_RESPONSE.md`](REVIEW_RESPONSE.md).
>
> **v0.3 (review response):** headline masses are now printed union estimates (robust ~46.4 g; analytic 50.8 g upper bound), printability is enforced, known-lot passports keep measurement uncertainty, compensation is an 8-control lot-specific resize, and the Brief runs an engine feasibility gate. Full point-by-point response: [`REVIEW_RESPONSE.md`](REVIEW_RESPONSE.md).

**Repo:** `github.com/bnelabs/AnyRB` (private) · **Product:** AnyRB — Any Recycled Batch.
Meta models (Muse Spark, Muse Image, Muse Voice Transcribe, SAM 3.1) do the understanding, proposing and
explaining; a verified physics engine does every number.

---

## Deliverables quick index

- **App:** `index.html` (single file, offline) — served live by the backend at `/`
- **Hackathon pack:** `HACKATHON.md` (models, demo script, checklist) · `PRODUCT_V2.md` (IA/AI requirements)
- **Research:** `reports/AnyRB_Research_Synthesis.pdf` · `reports/AnyRB_Full_Research_Dossier.pdf` · `research/00–05`
- **Qualification report:** `reports/AnyRB_Qualification_Report.pdf` (generated per design; `make report`)
- **Live Meta backend:** `server/` (`API.md`, tests, `evidence/live_calls.json`)
- **Independent validation:** `validation/VALIDATION.md` + `results.json` (56 PASS / 2 WARN / 0 FAIL)
- **Review response:** `REVIEW_RESPONSE.md` (point-by-point, v0.3 + v0.4 addendum) · `V0_3_SPEC.md` / `V0_4_SPEC.md`
- **Audits:** `audit/AUDIT.md`, `audit/REAUDIT.md`, `audit/HACKATHON_AUDIT.md` (historical v0.2 audit: SHIP); v0.3 delta audit in `audit/V0_3_AUDIT.md` when complete

## The 3-minute product

| Step | What you do | What happens |
|---|---|---|
| **01 · Brief** | Describe the part in plain language, or speak it. Choose/import the lot. | Muse Spark turns intent into an editable structured brief; Voice Transcribe handles speech; a lot passport captures the recyclate distribution (E, σy, CVs, provenance). |
| **02 · Design** | Pick a candidate. | Muse Spark proposes three strategies as parameter priors; the verified frame-FE engine evaluates and ranks them; the selected design is optimised for minimum mass at a reliability target; Spark writes the design memo from the computed numbers only. |
| **03 · Prove** | Screen a lot, export. | Batch acceptance window + per-lot compensation decision, live scientific-validation checklist, AI qualification narrative, Muse Image concept render, HTML/PDF qualification report + STL + JSON. |

Everything is simulated decision support — never certification. The claim ladder is on screen:
**L0–L1 verified, L2 partial, L4–L6 absent** (no physical testing was performed).

## Run it

### Live AI mode (Meta models in the live path — the hackathon demo)
```bash
cd AnyRB
cp server/.env.example server/.env     # add your Meta API key; never commit this file
.venv/bin/python -m server.app         # http://127.0.0.1:8787
```
Open **http://127.0.0.1:8787** — the backend serves the app and same-origin `/api/*` endpoints.
The app shows a green **Live · Meta models** pill and logs every call in the AI provenance drawer
(model, latency, tokens, cached/fallback).

### Offline mode (no network, no key)
Open **`index.html`** by double-click. The same UI runs with a deterministic offline assistant; the pill
says **Offline assistant** and every AI-shaped response is labelled `fallback`. Useful for judges without
network and for stage safety.

### Rebuild
```bash
python3 app/build.py          # → anyrb/index.html (single file) + app/standalone.html
make test                     # 33 engine tests (~55 s), includes Python↔JS cross-check
make test-server              # AI backend tests in mock mode
node app/tests/run.mjs        # 37 JS engine/UI tests
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

## Honest limits (also on the Prove screen)

No physical testing; linear-elastic 2-D idealisation (no plasticity, creep, fatigue, layer anisotropy,
out-of-plane behaviour, joint detail, print defects); literature-derived feedstock distributions must be
replaced by the user's lot data; optimiser is a local search, not a global-optimality proof; mass is
conservatively over-counted at joints; AI text is explanatory, rounded through the engine and never the
source of a number; the product does not certify any part, material or recycled-content claim.

## Repository map

```
AnyRB/
├── index.html                  ← standalone app (offline, double-click)
├── app/                        ← app sources: engine.js, optimize.js, ai.js, aicore.js, ui.js, styles.css, build.py
├── server/                     ← FastAPI Meta AI backend (Spark/Image/Voice/SAM), API.md, tests, live evidence
├── design/                     ← v0.2 design system + high-fidelity prototype (visual target)
├── validation/                 ← independent validation suite, results.json, VALIDATION.md, figures
├── engine/                     ← canonical Python engine + 33 tests + fixtures
├── research/                   ← cited dossiers 00–05 + machine-readable references
├── reports/                    ← qualification report, STL, PDFs
├── audit/                      ← historical v0.2 audits (SHIP) + v0.3 delta audit
├── REVIEW_RESPONSE.md          ← point-by-point reply to the external review
├── V0_3_SPEC.md                ← shared v0.3 response contract
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
AnyRB does exactly that, with Meta AI models making the workflow usable by a designer rather than a CAE
specialist, while the deterministic verified engine keeps every number honest. What software cannot do is
validate itself — so the deliverable includes a claim ladder, an independent validation suite, and the
minimum experimental programme (T1 per-lot tensile, T2 lattice coupons, T3 full bracket) that would turn
a good virtual design into a certified one.

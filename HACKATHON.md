# AnyRB (Any Recycled Batch) — Meta Global AI Developer Hackathon submission pack

**Track:** Indie Developer · "Push the Frontier" · solo builder
**Deadline:** internal Tue Nov 3 18:00 ET · hard Wed Nov 4 21:00 ET (Thu Nov 5 05:00 Istanbul)

> **One line:** *AnyRB keeps a named recycled-plastic product's result inside a target only when a
> measured link exists for that product and result — then offers one evidence-map calculation (PNAS {8,5})
> only with its required measured inputs, and keeps a historical 2-D bracket studio where Meta models help
> design one printed bracket. No product catalog, no preset, no model fills a missing result.*

## v0.6 evidence-map highlights

- **Research gate first:** `research/06-evidence-map.md` grades product-class links as measured, model only or absent. It was written before the new calculation code.
- **One calculation only:** PNAS 2025 `{8,5}` rHDPE-platelet / PDMS-matrix modulus case. Requires explicit product-class confirmation, a modulus result in MPa with a target, a measured recyclate stiffness distribution, and a measured composite modulus baseline (n ≥ 3, named source). Labelled simulation.
- **The measured PNAS result:** modulus scatter **18 % → 4 %** on those composite specimens (n=5 composite; n=50/10 plates feedstock). The paper reports no absolute measured composite mean, so no absolute MPa range runs without a measured baseline.
- **The 93 % film result is model-only** (`{8,7}` stretch film, 554 ± 10 MPa, CV 2 %, relative to modelled ≈26 % input) and is not copied.
- **Blank rows stay blank:** counterweight mass, sheet acoustics, another plastic/mix/contamination, pipe ring stiffness and any batch→product link are absent. No 3-D, catalog or optimizer added.
- **Default path:** consistency record + evidence map. The historical 2-D bracket studio, voice brief and concept image are off the default path.

## v0.5 consistency-record highlights

- **One open record, any product, any result.** Product/result names are free text; targets are numeric
  ranges; recycled input is described as plastic type, batch, mix and minor contamination.
- **Exactly three outcomes per result:** measured link (range + measured product choice), one-batch
  measurement (inside/outside only), or missing link (blank result + the test still needed).
- **No fake link.** A product name, material preset, assumed CV or the bracket model never creates one.
- **3-D gate, no fake geometry.** No generic 3-D simulator was added. Mass would need measured density
  plus a measured/modelled volume; strength/stiffness would need measured modulus and strength plus a
  structural model; sound insulation is never a structural 3-D result. The bracket's 2-D frame is not
  reused for another product.
- **Saved records** can hold empty measurement slots and test plans, and can be downloaded/imported.

## v0.3 review-response highlights

- Printed/union mass is the headline (~46.4 g robust; analytic 50.8 g is a conservative upper bound).
- Printability (neighbour ratio ≤1.5, slenderness ≤30) is enforced in the optimiser.
- Known-lot passports retain 12 % measurement uncertainty; compensation is an 8-control lot-specific resize.
- Brief runs an engine feasibility gate before any AI candidate is drawn; sustained-load creep bound is shown as an advisory.
- Full point-by-point response: `REVIEW_RESPONSE.md`; coupon pre-registration: `validation/COUPON_TEST_PLAN.md`.

## v0.4 remaining-gap fixes

- Printed-process gate: only FDM/FFF material data can design the printed lattice; IM/compression presets are contrast-only.
- Elongation/brittle-lot screen: peak strain demand vs printed elongation; marginal P_f shown as an add-on estimate, not in headline P_f.
- Union-mass final polish stage; assumption-sensitivity bounds for correlation and lot/within split.
- Non-FDM presets blocked, QC lot record retained.

## Why this is a frontier problem

Recycled plastics are cheap and required by regulation, but their mechanical properties swing wildly from
lot to lot (rHDPE modulus 380–1,250 MPa across MRFs; "spec-compliant" PCR-PP lots with 2–24 wt % filler and
10–100 % elongation). Engineers either over-design or avoid recyclate. Structural design can suppress the
*consequence* of that variation (PNAS 2025: measured rHDPE modulus CV 18 % → 4 %), but the workflow to use
that insight does not exist: no tool couples **lot distribution → structural reliability → internal-geometry
optimisation → per-batch recipe → qualification artifact**. AnyRB is that workflow, and AI is what makes
it usable by a designer instead of a CAE expert.

## Meta models in the live path (verified today, 2026-10-29)

| Model | Role in AnyRB | Endpoint | Verified latency |
|---|---|---|---|
| **Muse Spark 1.3 Contributor** | brief parser, lot-datasheet extractor, design proposer, design reviewer, qualification narrative | `/api/brief/parse`, `/api/lot/parse`, `/api/design/plan`, `/api/design/review`, `/api/proof/memo` | 9–20 s measured (v0.3 live pass; reasoning model) |
| **Muse Image 1.0** | illustrative product render for the design card | `/api/image/render` | ~19 s (WebP 1600² → image data URL) |
| **Muse Voice Transcribe 1.0** | hands-free design brief | `/api/voice/transcribe` | ~3.6 s (exact transcript) |
| **SAM 3.1** (optional) | segment an existing part photo for the brief | `/api/photo/segment` | tested, optional |

Everything is cached on disk and logged for provenance. If the network or API fails, a deterministic
fallback keeps the demo alive and the UI says so ("Offline assistant"). Live evidence:
`server/evidence/live_calls.json`. **AI never computes the numbers:**
the app passes structured engine outputs into the prompts, the model may only phrase them; AI-authored review and proof memos pass a programmatic number-grounding
check that rejects numbers not present in the input, and brief/lot parsing is schema-constrained with
clamped ranges while design proposals are priors the engine evaluates.
The browser never sees the API key; it stays in a local server process.

## What is genuinely new in this build

| Day | Work |
|---|---|
| Oct 28–29 | v0.1 science: verified 2-D frame engine (94 elements), closed-form bivariate-lognormal reliability, multi-start robust lattice optimiser, batch passport, qualification report + STL, independent audit (SHIP) |
| Oct 29 (this phase) | v0.2 product: 3-step AI studio redesign, live Meta AI backend (4 models), number-grounded AI memos, independent scientific-validation suite, hackathon packaging |
| Oct 30 (this phase) | v0.5 open consistency record: measurement-only outcomes, 3-D gate, saved records, tests/docs; bracket studio kept as the separate 2-D simulation |
| Oct 30 (v0.6) | evidence map + primary search; one PNAS {8,5} baseline-anchored simulation; record/evidence navigation; bracket/voice/image demoted to a historical link; 54 tests |
| Oct 30–Nov 2 | demo video, polish from feedback, final verification, public repo |
| Nov 3–4 | submission + confirmation |

## 3-minute demo script

1. **0:00–0:20 — The problem.** A shelf bracket from recycled PETG; a supplier lot whose modulus is 25 % below
   last month's. "Same part, same printer — different behaviour."
2. **0:20–0:50 — Consistency record (the new default).** Name a product (counterweight, sheet, pedal — pick
   one), type the result and target range, describe the recycled input. With no measurement, show the
   blank result and the named test. Add one batch → "one batch only". Add a second input level with source
   and what varied → measured range and measured product choice. Show the 3-D line: no 3-D result / not
   applicable, and why. No preset or bracket model is involved.
3. **0:50–1:15 — Evidence map + one calculation.** Open **Evidence map**: show measured vs model vs absent; point at the PNAS measured row (18 %→4 % on its composite), and the 93 % model-only film case with its 26 % denominator. In the record, select the PNAS case, confirm product class, enter a baseline; it runs only when the required measurement is present, and shows a simulated P5–P95 with a **simulation** label. It never fills the record's missing measured result.
4. **1:15–1:50 — Brief (AI intake, historical studio).** Open the historical bracket studio. Speak the brief (Muse Voice Transcribe): *"A shelf bracket for 15 kg, 1 % failure risk, under 60 g, recycled PETG."* Show the transcript, then Muse Spark's structured understanding card. Paste a supplier datasheet; Spark extracts E, σy, CVs with provenance.
5. **1:50–2:25 — Design (AI proposes, physics disposes).** Show three AI-proposed candidates; the verified
   engine ranks them. Pick the balanced one and optimise: 55.9 g printed prior → 46.4 g printed optimum (analytic 62.7 → 50.8 g) at ~1 % failure probability.
   Show the lattice, the binding failure mode and the AI memo.
6. **2:25–2:55 — Prove.** Batch passport: a lot with 90 % of nominal E needs a 1.15× global-equivalent scale (+14.9 % printed mass, conditional); an 80 %-E lot needs 1.39× (+22.0 %, conditional); a 50 %-E lot is rejected. The recipe is a lot-specific 8-control resize with 12 % measurement uncertainty retained. Scientific validation checklist (L0–L1 verified, L2 partial, no
   physical tests). Muse Spark writes the qualification narrative; Muse Image renders the illustrative product.
7. **2:55–3:20 — Why it matters.** 58 % lighter than a solid plate at the same simulated risk; 14 % lighter than
   a uniform lattice; conventional FoS-1.5 over-pays. The claim ladder and minimum validation programme
   (T1/T2/T3) are on screen.
8. **3:20–3:30 — Close.** "Recycled plastic is not a second-class material. It's a distribution. AnyRB
   designs for the distribution." Repo URL + live-run command.

## Run it

```bash
cd AnyRB
cp server/.env.example server/.env   # add your Meta API key (never committed)
.venv/bin/python -m server.app       # http://127.0.0.1:8787  (AI live)
# offline fallback: open index.html directly (deterministic assistant, clearly labelled)
```

Tests: `make test` (engine, 33) · `make test-server` (API, 51+1, mock) · `node app/tests/run.mjs` (UI/engine/record/evidence, 54) ·
`make validate` (independent scientific validation) · `make verify-live` (real Meta calls → evidence file).

## Submission checklist

- [ ] Public repo by **Nov 3 18:00 ET**; no `.env`, keys, caches or recordings in history
- [ ] `README.md` maps Meta models → features and links the live verification evidence
- [ ] 3-minute video recorded (script above) with the AI calls visible
- [ ] Demo runs on a clean machine: `python -m server.app` + browser at `http://127.0.0.1:8787`
- [ ] Offline fallback demonstrated (no network) so the demo never dies
- [ ] Claims/limitations page visible: L0–L1 verified, L2 partial, L4–L6 absent; not a certification tool
- [ ] Public flip checklist + logged-out check + screenshot of submission confirmation

## Honest limitations (also in the app)

**Bracket studio:** no physical testing was performed. Material distributions are literature-derived and
must be replaced by user lot data. The mechanics is a linear-elastic 2-D frame idealisation (no plasticity,
creep, fatigue, layer anisotropy, out-of-plane behaviour, joint detail or print defects). The optimiser is
a multi-start local search. All displayed/exported design masses are printed union estimates (robust design
46.4 g); the analytic strut-sum (50.8 g) is a conservative upper bound (+9.5 %). The old 25 %/≈40.5 g figure
came from a validator sampler bug and is retired. AI text is grounded in engine outputs but is explanatory,
not analytical.

**Consistency record:** results are shown only for measurements of the same product and result that are
stored in the record. One batch is not a range; no measurement is not a result. The app does not predict an
unmeasured batch, does not infer a missing result from a product name, preset or the bracket model, and does
not run a generic 3-D simulator. The 3-D gate is deliberately conservative. A measured range is evidence
from the measured input levels, not a guarantee for the next delivered batch.

**PNAS case:** the measured result is 18 %→4 % modulus scatter on the fabricated `{8,5}` rHDPE-platelet
/ PDMS-matrix specimens; the paper does not report an absolute measured composite mean. The 93 % is the
`{8,7}` stretch-film model relative to a modelled ≈26 % input (554 ± 10 MPa, CV 2 %) and is not copied.
The app calculation is baseline-anchored case scaling, not the full UATSC network and not a physical test
of the user's product. It cannot run without the measured distribution and baseline; it does not fill the
record's outcome.

**Independent validation (58 checks):** 56 PASS / 2 WARN / 0 FAIL — re-implemented frame element, energy
minimisation vs direct stiffness, SciPy/quad/1e6-MC reliability cross-checks, periodic unit-cell
homogenisation, brute-force optimiser comparison, STL geometry audit; the two WARNs are the analytic mass upper bound and the Halton printed-estimate tolerance at minimum width. See `validation/VALIDATION.md`.

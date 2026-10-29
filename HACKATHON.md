# AnyRB (Any Recycled Batch) — Meta Global AI Developer Hackathon submission pack

**Track:** Indie Developer · "Push the Frontier" · solo builder
**Deadline:** internal Tue Nov 3 18:00 ET · hard Wed Nov 4 21:00 ET (Thu Nov 5 05:00 Istanbul)

> **One line:** *AnyRB is an AI reliability studio for recycled plastics — describe the part you need,
> give it the batch you actually have, and it designs internal geometry that behaves reliably. Meta models
> act as the design partner; a verified physics engine does the math.*

## v0.3 review-response highlights

- Printed/union mass is the headline (~46.4 g robust; analytic 50.8 g is a conservative upper bound).
- Printability (neighbour ratio ≤1.5, slenderness ≤30) is enforced in the optimiser.
- Known-lot passports retain 12 % measurement uncertainty; compensation is an 8-control lot-specific resize.
- Brief runs an engine feasibility gate before any AI candidate is drawn; sustained-load creep bound is shown as an advisory.
- Full point-by-point response: `REVIEW_RESPONSE.md`; coupon pre-registration: `validation/COUPON_TEST_PLAN.md`.

## v0.4 remaining-gap fixes

- Printed-process gate: only FDM/FFF material data can design the printed lattice; IM/compression presets are contrast-only.
- Elongation/brittle-lot screen: peak strain demand vs printed elongation; marginal P_f shown as a conservative add-on, not in headline P_f.
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
| Oct 30–Nov 2 | demo video, polish from feedback, final verification, public repo |
| Nov 3–4 | submission + confirmation |

## 3-minute demo script

1. **0:00–0:20 — The problem.** A shelf bracket from recycled PETG; a supplier lot whose modulus is 25 % below
   last month's. Show the batch-distribution histogram. "Same part, same printer — different behaviour."
2. **0:20–0:55 — Brief (AI intake).** Speak the brief (Muse Voice Transcribe): *"A shelf bracket for 15 kg,
   1 % failure risk, under 60 g, recycled PETG."* Show the transcript, then Muse Spark's structured
   understanding card. Paste a supplier datasheet; Spark extracts E, σy, CVs with provenance.
3. **0:55–1:35 — Design (AI proposes, physics disposes).** Show three AI-proposed candidates; the verified
   engine ranks them. Pick the balanced one and optimise: 55.9 g printed prior → 46.4 g printed optimum (analytic 62.7 → 50.8 g) at ~1 % failure probability.
   Show the lattice, the binding failure mode and the AI memo.
4. **1:35–2:10 — Prove.** Batch passport: a lot with 90 % of nominal E needs a 1.15× global-equivalent scale (+14.9 % printed mass, conditional); an 80 %-E lot needs 1.39× (+22.0 %, conditional); a 50 %-E lot is rejected. The recipe is a lot-specific 8-control resize with 12 % measurement uncertainty retained. Scientific validation checklist (L0–L1 verified, L2 partial, no
   physical tests). Muse Spark writes the qualification narrative; Muse Image renders the illustrative product.
5. **2:10–2:40 — Why it matters.** 58 % lighter than a solid plate at the same simulated risk; 14 % lighter than
   a uniform lattice; conventional FoS-1.5 over-pays. The claim ladder and minimum validation programme
   (T1/T2/T3) are on screen: decision support, not certification.
6. **2:40–3:00 — Close.** "Recycled plastic is not a second-class material. It's a distribution. AnyRB
   designs for the distribution." Repo URL + live-run command.

## Run it

```bash
cd AnyRB
cp server/.env.example server/.env   # add your Meta API key (never committed)
.venv/bin/python -m server.app       # http://127.0.0.1:8787  (AI live)
# offline fallback: open index.html directly (deterministic assistant, clearly labelled)
```

Tests: `make test` (engine, 29) · `make test-server` (API, mock) · `node app/tests/run.mjs` (UI/engine, 22) ·
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

No physical testing was performed. Material distributions are literature-derived and must be replaced by
user lot data. The mechanics is a linear-elastic 2-D frame idealisation (no plasticity, creep, fatigue, layer
anisotropy, out-of-plane behaviour, joint detail or print defects). The optimiser is a multi-start local
search. All displayed/exported design masses are printed union estimates (robust design 46.4 g); the
analytic strut-sum (50.8 g) is a conservative upper bound (+9.5 %). The old 25 %/≈40.5 g figure
came from a validator sampler bug and is retired. AI text is grounded in engine outputs but
is explanatory, not analytical. The product is decision-support software and does not certify any part or
material.

**Independent validation (58 checks):** 56 PASS / 2 WARN / 0 FAIL — re-implemented frame element, energy
minimisation vs direct stiffness, SciPy/quad/1e6-MC reliability cross-checks, periodic unit-cell
homogenisation, brute-force optimiser comparison, STL geometry audit; the two WARNs are the analytic mass upper bound and the Halton printed-estimate tolerance at minimum width. See `validation/VALIDATION.md`.

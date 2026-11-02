# AnyRB (Any Recycled Batch) v0.2 — Product redesign + Meta AI integration PRD

> **Historical note:** this document describes an earlier AnyRB prototype (v0.6 and earlier). The active product is the one-page v0.7 app; see [`README.md`](README.md).

**Track:** Meta Global AI Developer Hackathon · Indie Developer · "Push the Frontier" (deadline 2026-11-04).
**One line:** *AnyRB is an AI reliability studio for recycled plastics — describe the part you need, give it the batch you actually have, and it designs internal geometry that behaves reliably; the AI acts as the design partner, the verified physics does the math.*

Why it can win: the existing v0.1 proved the hard science (verified frame FE + exact reliability + robust design), but it looked like a CAE dashboard and had no AI in the live path. v0.2 turns it into a product a designer can use in 3 minutes, with Meta models doing what they are genuinely good at — understanding intent, planning, explaining, generating — while all numbers stay in a deterministic, verified engine.

---

## 1. The three-step product flow (replaces the 8-section dashboard)

Global chrome: wordmark · project name · **AI status pill** (Live Meta models / Offline assistant) · "Lab mode" toggle · help. Thin vertical stepper on the left: **01 Brief → 02 Design → 03 Prove**, with progress and completion ticks. On mobile the stepper becomes a top segmented control.

### 01 · Brief — what are we making, and from which batch?
- Large prompt: *"Describe the part, the load it must carry, and any limits."* Textarea, mic button (Muse Voice Transcribe), three example chips.
- **AI understanding card** (Muse Spark): structured, editable fields — part type, design load (N), deflection limit (mm), reliability target, batch (preset or imported), print process, constraints. Confidence and model shown. Everything editable; nothing is hidden.
- **Lot passport card**: choose a verified preset, or paste a supplier datasheet / certificate text → *AI extracts* material (E, σy, CVs, density, source) with provenance and a confidence badge; user confirms/edits. This is the "batch variability is the input" story in one panel.
- Advanced (collapsed): geometry dimensions, width clips, lot/within split.
- Primary CTA: **"Design with AI →"**. Shows an AI activity strip: "Parsing brief…", "Planning candidates…", "Running verified solver…".
- AI plan preview: candidate strategies it will test (e.g., light / balanced / conservative), with one-line rationale each.

### 02 · Design — AI proposes, physics disposes
- Large part visualisation (canvas), with toggles: Geometry / Stress & buckling / Strut width. Clean isometric feel, measurement ticks, wall + load annotation.
- Three hero metrics only: **mass**, **probability of failure across batches**, **binding failure mode**. Plus a tiny "vs conventional" strip.
- **Candidate cards** (3, AI-proposed parameter priors): each evaluated by the verified engine; show mass, P_f, printability pass/warn, and a plain-language trade-off. Selecting one updates the canvas. This is the core AI contribution: the model proposes design directions; the deterministic solver ranks them; the AI then explains *why*.
- **AI design memo** (Muse Spark): 4–6 sentences grounded in the computed metrics, plus 1–2 suggested next actions (e.g., "tighten root struts", "control lot E mean"). Numbers must be injected from the engine; the model may not invent values.
- Secondary controls (Lab mode): width-field sliders, material sliders, load/target, re-optimise.
- Action: **"Continue to proof →"**.

### 03 · Prove — can we ship this batch?
- Qualification summary: reliability gauge, governing mode, mass, printability checks; batch acceptance window chart; **batch passport** — enter a lot's measured E/σy or quality index → pass / compensate / reject with the exact width scale and added mass, explained by AI in plain language.
- **Scientific validation card**: live L0–L2 checklist (element benchmark, equilibrium, cross-implementation, Monte-Carlo vs closed form, convergence, independent solver, homogenisation check), pointing to the validation report. This is the "validate the science" surface.
- **AI engineering memo** (Muse Spark): a short qualification narrative for a design review — design intent, key risk, what would change the answer, next test. Grounded in structured results; explicit "AI-written from computed outputs".
- **Generated product render** (Muse Image): illustrative concept image, clearly labelled "AI illustration — not the CAD model".
- Export: qualification report (HTML/PDF), STL, design JSON, AI provenance log (models, latencies, cache/fallback).
- Persistent **claims ladder** + limitations.

## 2. AI integration requirements (live path, Meta models)

Backend (`server/`, FastAPI) — the browser never sees the API key:

| Endpoint | Model | Job |
|---|---|---|
| `POST /api/brief/parse` | Muse Spark 1.3 (contributor) | natural-language brief → valid JSON targets (schema-validated, deterministic fallback) |
| `POST /api/lot/parse` | Muse Spark | datasheet text → material distribution JSON with provenance/confidence |
| `POST /api/design/plan` | Muse Spark | brief + first-pass engine results → 3 candidate strategies as parameter priors (engine-validated) |
| `POST /api/design/review` | Muse Spark | final structured metrics → design memo / rationale (numbers injected, no invention) |
| `POST /api/proof/memo` | Muse Spark | qualification narrative + next-test recommendation |
| `POST /api/voice/transcribe` | Muse Voice Transcribe | audio brief → transcript |
| `POST /api/image/render` | Muse Image 1.0 | illustrative product render (labelled) |
| `POST /api/photo/segment` | SAM 3.1 (optional) | upload existing part photo → segment it for the brief/reference |
| `GET /api/health` | — | model configuration, latency, cache stats |
| `GET /api/provenance` | — | append-only log of model calls for the current session |

Rules: every AI response is JSON-schema validated and cached; every endpoint has a deterministic fallback so the demo never dies; prompts treat user text as data (delimited, allow-listed fields, no tool execution); model IDs/latencies/tokens logged; AI may only phrase numbers supplied in the request; app shows Live/Offline/fallback state honestly.

## 3. Visual design direction

Premium, calm, editorial-lab — not a dark dashboard. Warm paper background (#F7F5F0), ink (#15171A), muted (#6B7280), one accent only: safety orange (#FF5A36) for the primary action and risk, a deep green (#0B6B53) for "verified/pass". White cards, 1px warm-grey borders, 18–22px radii, generous spacing, tabular numerals, large serif display headings (Iowan Old Style/Georgia fallback) with a clean sans UI face. Thin technical linework/measurement ticks as a motif. No neon gradients, no glassmorphism, no dense tables on the primary path.

Required states: empty, AI thinking (skeleton), success, offline fallback, error, and "why this number?" disclosure on every metric. Accessible contrast, keyboard focus, reduced-motion support, responsive down to 900px.

## 4. Science + validation requirements

Keep the verified Python engine as the source of truth. Add an independent validation suite (`validation/`, `make validate`) that checks and reports:
1. FE element benchmarks (cantilever exact, axial, rigid-body, equilibrium, symmetry).
2. Mesh/cell-refinement convergence of the product model (4×2 → 14×6 cells) and a Richardson-style error estimate.
3. An independently formulated solver (energy minimisation on the assembled system vs direct stiffness) matching displacements/forces.
4. Closed-form bivariate-normal P_f vs SciPy vs high-precision quadrature vs Monte-Carlo, including extreme correlations and degenerate limits.
5. Periodic unit-cell homogenisation vs analytical truss/Gibson–Ashby scaling (relative-density exponents, anisotropy).
6. Optimiser robustness: reduced-parameter brute-force grid vs multi-start pattern search; constraint satisfaction; no better feasible design found by an independent random search.
7. Mass/STL geometry audit (analytic volume vs exported triangles, bounds, triangle count, overlap disclosure).
8. Material-model audit (lognormal moments, copula correlation, two-level variance decomposition).
Produce `validation/VALIDATION.md` + `validation/results.json` + figures; the app's Prove step reads the summary. Every AI claim that touches numbers must be traceable to these engine outputs.

## 5. Hackathon packaging

- `HACKATHON.md` in the project: one-liner, track, Meta models in live path (with verified latencies), demo script (3 min), architecture diagram, submission checklist, repo hygiene (no keys).
- `server/.env.example`; real key only in `server/.env` (gitignored). Key may be reused from the existing local development environment for the demo, never committed.
- Demo URL: local `http://127.0.0.1:8787` with live models; offline file build `index.html` remains as fallback.
- Public repo ready, new-work table, 3-minute video script.

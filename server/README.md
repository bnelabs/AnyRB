# AnyRB AI backend (`server/`)

Local FastAPI service that puts **Meta AI models in the live path** of the AnyRB v0.2
design studio. The verified physics runs in the browser/engine; this service does intent
parsing, design proposals, narrative generation, voice input and illustrative rendering —
with **pydantic-validated JSON**, **disk caching**, **provenance logging** and
**deterministic fallbacks**, so the demo never dies (exception: the product-proposal endpoint
never fabricates suggestions — if the model is unavailable it returns an empty proposals list
with `_meta.fallback=true`).

**The browser never sees the API key.** It only ever talks to `http://127.0.0.1:8787/api/*`.

```
Browser (AnyRB app)
   │  same-origin fetch /api/*            no key, no model call
   ▼
FastAPI server/  ── schema gate (schemas.py) ── cache/server/cache ── provenance.jsonl
   │                 │
   │                 └─ deterministic fallback (offline assistant)
   ▼  server-side only: Authorization: Bearer $META_API_KEY
Meta Model API (api.meta.ai/v1)
   ├ Muse Spark 1.3 contributor  /chat/completions   brief, lot, plan, review, proof
   ├ Muse Image 1.0              /images/generations  illustrative product render
   ├ Muse Voice Transcribe 1.0   /asr/transcribe      audio brief → transcript
   └ SAM 3.1                     /responses           optional part-photo segmentation
```

## Setup

```bash
cd AnyRB
.venv/bin/python -m pip install fastapi uvicorn httpx python-multipart pytest   # already in .venv
cp server/.env.example server/.env    # then fill META_API_KEY (NEVER commit server/.env)
```

`server/.env` is gitignored. The backend loads it at import; a *present but empty*
`META_API_KEY` forces offline mode (that is how the tests stay key-free).

## Run

```bash
cd AnyRB

# live (reads server/.env) — recommended demo command
.venv/bin/python -m server.app
# same, explicit uvicorn form (use -m: see moved-repo note below)
.venv/bin/python -m uvicorn server.app:app --port 8787

# mock / offline demo (no key, no network, deterministic)
ANYRB_MOCK=1 .venv/bin/python -m server.app
.venv/bin/python -m server.app --mock
```

> **Moved-repo note:** this `.venv` was created when the project folder was called
> `anybatch`, so the console scripts `.venv/bin/uvicorn` / `.venv/bin/pip` have a stale
> shebang (`bad interpreter`). Use `.venv/bin/python -m uvicorn …` / `.venv/bin/python -m pip …`
> (both verified), or re-link once with `python3 -m venv --upgrade .venv`.

Open **http://127.0.0.1:8787** — the backend serves the built app (`/`) and the API
same-origin. Both commands were verified on 2026-10-29 (`--port 8787`; if that port is
already taken by an integration server, use `--port 8788`).

Per-request mode override (useful for demoing Live vs fallback without restarting):
`POST /api/brief/parse?mock=1` (or header `X-AnyRB-Mock: 1`) forces the deterministic
fallback path; `?mock=0` clears the override. Responses always report what happened in
`_meta` (`model`, `latency_s`, `cached`, `fallback`, `mock`, `usage/tokens`).

## v0.4 contract (second review response)

v0.4 closes the remaining gaps from the second external review. Additive again; `GET /api/health`
reports `version: "v0.4"`. See `API.md` §v0.4 for the full contract. Summary:

* **Printed-process gate** — only FDM/FFF material data is valid for the printed bracket family.
  `GET /api/health` exposes `engine.printed_process_gate`; the plan endpoint accepts
  `feasibility.process_ok` / `reason` and `material.process`, and returns
  `process {ok, process, reason, rule}`. If the gate fails the server **does not call the AI**:
  `blocked: true`, `_meta.mock_reason: "process_mismatch"` and a note that the IM/compression preset
  cannot be used for a printed lattice (deterministic placeholders only for schema compatibility).
  The plan prompt states the same rule.
* **Elongation / brittle-lot screen** — review/proof accept a `brittle` block and the memo reports
  it as a **add-on estimate (not a formal bound), not folded into the headline two-property P_f**; brittle lots are
  flagged, with `health.engine.elongation_brittle_screen` exposing the capability.
* **Assumption bounds** — review/proof accept `assumptions {pf_min, pf_max, corr_range,
  split_range}` and the memo labels the P_f range as **unmeasured sensitivity, not validation**.
* **Union-mass polish** — `health.engine.union_mass_polish` (the AI never computes mass; final
  selection is polished on the printed union mass by the engine).
* **Lot QC record** — review/proof accept `qc {lot_id, supplier, measurement_source,
  measurement_cv, recycled_content_pct}`; lot identity is a record and recycled content is a
  **paperwork claim (not simulated)**. An explicit QC measurement CV overrides the 12 % default.
* The process block is echoed on review/proof responses; `process.ok: false` makes the memo state
  that the printed-lattice design is blocked. The sustained bound remains advisory.

Freshness note: `server/evidence/live_calls.json` is the v0.2-era live evidence; the v0.3 and v0.4
contract changes are mock-tested (`51 passed, 1 skipped`). Re-run
`.venv/bin/python server/verify_live.py` with a key to refresh live evidence (the endpoints still
accept the script's payloads).

## v0.3 contract (reviewer response)

v0.3 constrains the AI to decisions the verified engine can refuse, surfaces family scope and
carries measurement uncertainty (v0.4 builds additively on this). All changes are additive; `GET /api/health` reports
`version: "v0.3"`. See `API.md` §v0.3 for the full contract. Summary:

* **Brief/lot parsing** now return optional `measurement_cv` (default `0.12`, retained in
  lot-level `P_f`; stated vs defaulted is flagged), lot `lot_id` / `supplier` /
  `measurement_source` / `measurement_cv`, and the brief response carries a camel-case `brief`
  mirror for the browser client. Values are never invented: absent means null/default.
* **Plan** prompt states the scope is "best of this bracket/lattice family" (not a topology
  optimiser), candidates must respect printability (neighbour ratio ≤ 1.5, slenderness ≤ 30)
  and the engine feasibility gate; the model proposes priors only. If the request's engine
  gate says the family is infeasible, the server does not call the AI: it returns
  `blocked: true` placeholders so the UI can refuse the design.
* **Review/proof memos** receive the full engine facts (printed mass + analytic upper bound,
  printability, lot-specific recipe multipliers/scale/added mass, measurement CV, sustained
  bound, feasibility, family scope), cite printed mass for comparisons, label analytic as an
  upper bound, call the sustained bound advisory (and say "not qualified for sustained load"
  when it fails), never claim certification, and remain number-grounded.
* v0.2 request payloads are still accepted; old response consumers keep working.

## Verified live calls (2026-10-29, real key)

Evidence file: [`server/evidence/live_calls.json`](evidence/live_calls.json) (no key in it —
asserted at write time). All required calls succeeded with **0 fallbacks**; the second pass
of the same requests was served from disk cache in ~0.001 s (5/5 cache hits), which is why
the demo is instant after warm-up.

| Endpoint | Model | Latency | Tokens (prompt/completion/total) | Fallback |
|---|---|---|---|---|
| POST `/api/brief/parse` | muse-spark-1.3-contributor | 9.8 s | 396 / 888 / 1284 | no |
| POST `/api/lot/parse` | muse-spark-1.3-contributor | 11.6 s | 335 / 815 / 1150 | no |
| POST `/api/design/plan` | muse-spark-1.3-contributor | 13.7 s | 503 / 1688 / 2191 | no |
| POST `/api/design/review` | muse-spark-1.3-contributor | 19.3 s | 558 / 1290 / 1848 | no |
| POST `/api/proof/memo` | muse-spark-1.3-contributor | 14.5 s | 565 / 2704 / 3269 | no |
| POST `/api/voice/transcribe` | muse-voice-transcribe-1.0 | 3.6 s | audio 8.8 s | no |
| POST `/api/image/render` | muse-image-1.0 | 19.1 s | — | no |
| POST `/api/photo/segment` | sam-3.1 | 2.1 s | — | no |

Observed behaviour worth knowing:

* Spark is a reasoning model: 9–20 s per call (`reasoning_effort=low`, `max_tokens≥3000`).
  Use a 60 s client timeout; the server allows up to 240 s read.
* The generated image comes back WebP 1600×1600; the backend converts it to a JPEG data URL
  (1280 px, ~270–290 KB) so the browser payload stays small. It is labelled
  `"AI illustration — not the CAD model"`.
* Voice: `say -o /tmp/brief.wav --data-format=LEI16@16000 "…"` is accepted directly and the
  transcript came back exact ("…carries 15 kilograms with 1% failure risk and stays under
  60 grams."). Non-16 kHz WAV is normalised server-side.
* SAM 3.1 accepted the synthetic test photo (call succeeded, `mocked:false`); the synthetic
  image contained no real part so it returned `count:0`. Optional feature.
* Live `design/review` and `proof/memo` outputs passed the **number-grounding gate**: every
  number in the memos exists in the request payload (`_meta.grounding.ok = true`). An invented
  number would be replaced by the deterministic memo and flagged `_meta.fallback = true`.

Re-run the live evidence at any time (it clears the demo cache first, so it is a genuine
fresh pass; use `--keep-cache` to avoid it):

```bash
cd AnyRB
.venv/bin/python server/verify_live.py            # all endpoints incl. optional SAM
.venv/bin/python server/verify_live.py --skip-sam # faster, skips SAM 3.1
```

## Tests (no key needed)

```bash
cd AnyRB
AI_MOCK=1 .venv/bin/python -m pytest server/tests -q
# whole suite: 115 passed, 1 skipped; the product modules add 24 product-proposal and
# 40 product-advice tests (multi-target coverage included).

# product-proposal / advice tests only:
AI_MOCK=1 .venv/bin/python -m pytest server/tests/test_product_proposals.py -q   # 24 passed
AI_MOCK=1 .venv/bin/python -m pytest server/tests/test_product_advice.py -q      # 40 passed
# (skipped test = optional live smoke test, opt in with ANYRB_LIVE_TEST=1)
```

The suite isolates itself before importing the app: `META_API_KEY=""`, a temporary cache and
provenance file, 1 MB body limit, unlimited test rate. It covers: health + schema, brief/lot/
plan/review/proof/voice/image/segment/product-proposal and product-advice contracts (including
that an unavailable model returns empty proposals/advice, never invented content), schema
validation on every response,
deterministic fallbacks, prompt-injection guard (user text is delimited untrusted data and
cannot change the schema or clamp boundaries), number-grounding acceptance/rejection,
per-request `?mock=1`, cache hit on the second call (simulated live transport), provenance
shape/session filter, no-key-leak scan of responses **and** the on-disk provenance log,
size limits (422 for oversize text, 413 for oversize body), JSON error shapes, rate limit 429,
and static-path safety (no `/server/.env`, `.venv`, or traversal).

## Files

| File | Purpose |
|---|---|
| `server/app.py` | FastAPI app: endpoints, CORS, request-size guard, rate limit, static same-origin serving, JSON error handlers, `--mock` CLI |
| `server/schemas.py` | pydantic request/response models; every handler response is validated through them (`_respond`) |
| `server/meta_client.py` | Meta model clients (Spark/Image/ASR/SAM), env loading, retry, disk cache, provenance log, `configured()` health, deterministic fallbacks, key redaction |
| `server/contract_v03.py` | v0.3 payload normaliser: canonical grounded payload, family scope, printability limits, lot recipe, measurement, sustained bound, feasibility |
| `server/contract_v04.py` | v0.4 payload normaliser: printed-process gate, brittle/elongation screen, assumption bounds, lot QC record |
| `server/prompts.py` | grounded prompts, untrusted-text delimiters, number-grounding helper, deterministic fallbacks |
| `server/product_ai.py` | product-view MOVE proposals: request sanitising, allow-listed parameter output, clamps; empty proposals (no invention) when the model is unavailable |
| `server/tests/test_server.py` | pytest suite (mock mode) |
| `server/tests/test_product_proposals.py` | product-proposal endpoint tests (mock mode, no live model calls) |
| `server/tests/test_product_advice.py` | batch-advice endpoint tests: grounding, no-advice fallback, security (mock mode) |
| `server/verify_live.py` | live verification + evidence writer |
| `server/evidence/live_calls.json` | recorded live calls (model, latency, tokens, cache, hashes; no key) |
| `server/API.md` | frontend contract |
| `server/cache/` | disk cache (gitignored) |
| `server/provenance.jsonl` | append-only call log (gitignored) |

## API surface

`POST /api/brief/parse`, `POST /api/lot/parse`, `POST /api/design/plan`,
`POST /api/design/review`, `POST /api/proof/memo`, `POST /api/voice/transcribe` (multipart),
`POST /api/image/render`, `POST /api/photo/segment` (multipart),
`POST /api/product/proposals` (product view: MOVE parameters only — the browser scores them),
`POST /api/product/advice` (Batch/Alchemy: grounded practical advice, or no advice at all),
`GET /api/health`, `GET /api/provenance`, `GET /api/validation`.

See [`API.md`](API.md) for request/response JSON, error shapes, grounding rules and latency
expectations. `GET /api/health` reports `mode` (`live`/`mock`/`offline`), model IDs, cache
entry count, current-session call count, per-model live latencies and client-model latencies.

Limits: 16 MB request body (configurable `ANYRB_MAX_BODY_MB`), 12 MB audio/image upload,
120 requests/min/IP (`ANYRB_RATE_LIMIT_RPM`), 6000-char text fields. All limits return a
JSON error (`{ok:false,error,message}`), never an HTML page.

## Product-proposal endpoint (product view)

`POST /api/product/proposals` takes the current product geometry, target property range, plastic
batch description, another product on the same batch and `steady_available`; it returns MOVE
parameter objects (`thickness`, `section`, `span`, `other_product`, plus `blend` only when steady
availability exists) and nothing else. The model proposes parameters only — no strength,
stiffness, weight, property ranges, expected results or certification ever leave the endpoint;
the browser scores every proposal deterministically with the verified engine. Requests may carry
several target properties at once (optional `targets` array alongside the legacy `target`); ALL of
them are passed to the model with "satisfy all simultaneously", never just the first. All numbers
are sanitised/clamped server-side (thickness 2–200 mm, width 5–500 mm, span 50–5000 mm, blend
fraction 0.15–0.75); unknown moves/invalid values are dropped and the server never pads or invents
proposals. **If Meta is unavailable (mock mode, no key, timeout, invalid output) the endpoint
returns `proposals: []` with `_meta.fallback: true` and an `_meta.error` — no fixed-list
thickness/section/span suggestions.** The browser scores the user's current build locally and
shows no proposed alternatives in that state. `load_kg` is optional context (the frontend sends
`0`) and is never used to invent results. Uses `meta_client.spark_json("product_proposals", …)`
with the same cache and provenance behaviour. See `API.md` for the full contract.

## Batch/Alchemy advice endpoint

`POST /api/product/advice` takes the user's plain-language question plus the app-computed plan
(current build, passing builds, material gap, optional blend recipe, product/target/plastic
context) and returns `{answer, actions, available}`. The model answers **what to do with this
batch** — blend/add the steadier stream (using the supplied fraction/type), sort/wash/dry, change
the section or span, move the batch to the other product — and must never simply reject the
delivery. The request may carry several target requirements (`targets`) and the plan several gaps
(`gaps`); the answer/actions must address every supplied requirement and gap, not just the first.
It may use only numbers supplied in the request; strength/stiffness/weight/property ranges, measured
results, invented numbers and certification claims are forbidden. It also must
never send the user off to **test/trial/prototype/sample/measure a piece** — a hard user rule —
so a deterministic word-boundary guard rejects such text (`reason_code:"test_instruction"`) while
keeping ordinary process advice (blend, sort, wash, dry, change section/span, route product, split
delivery). The server enforces this: answer ≤ 1200 chars, 1–5 actions ≤ 140 chars, and a
**number-grounding check** (every number must exist in the request; rounding/percent forms
allowed). Any failure — Meta unavailable, unusable output, certification language, test/trial
instructions, or ungrounded numbers — returns `answer:"", actions:[], available:false` with a
`_meta.reason_code`; **no fixed advice fallback is invented**. Uses `meta_client.spark_json("product_advice", …)` with the usual cache/provenance.
See `API.md` for the full contract.

## Security / honesty notes

* The key lives only in `server/.env` (gitignored). It is never sent to the browser, never
  written to provenance/evidence (a defence-in-depth `redact()` scrubs it if it ever appears
  in an error string, and the evidence writer asserts it is absent).
* Contributor-mode Spark may train on inputs/outputs — fine for this hackathon demo, switch
  `META_MODEL_SPARK=muse-spark-1.3` for real users' data.
* The AI only *phrases* numbers supplied in the request for review/proof memos; the
  grounding gate enforces this programmatically. Physics numbers come from the verified engine.
* AI output is decision support, not certification: memos avoid certification language and
  the app labels renders as illustrations.

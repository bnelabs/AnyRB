# AnyRB AI backend (`server/`)

Local FastAPI service that puts **Meta AI models in the live path** of the AnyRB v0.2
design studio. The verified physics runs in the browser/engine; this service does intent
parsing, design proposals, narrative generation, voice input and illustrative rendering —
with **pydantic-validated JSON**, **disk caching**, **provenance logging** and
**deterministic fallbacks**, so the demo never dies.

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
.venv/bin/pip install fastapi uvicorn httpx python-multipart pytest   # already in .venv
cp server/.env.example server/.env    # then fill META_API_KEY (NEVER commit server/.env)
```

`server/.env` is gitignored. The backend loads it at import; a *present but empty*
`META_API_KEY` forces offline mode (that is how the tests stay key-free).

## Run

```bash
cd AnyRB

# live (reads server/.env) — recommended demo command
.venv/bin/python -m server.app
# same, explicit uvicorn form
.venv/bin/uvicorn server.app:app --port 8787

# mock / offline demo (no key, no network, deterministic)
ANYRB_MOCK=1 .venv/bin/python -m server.app
.venv/bin/python -m server.app --mock
```

Open **http://127.0.0.1:8787** — the backend serves the built app (`/`) and the API
same-origin. Both commands were verified on 2026-10-29 (`--port 8787`; if that port is
already taken by an integration server, use `--port 8788`).

Per-request mode override (useful for demoing Live vs fallback without restarting):
`POST /api/brief/parse?mock=1` (or header `X-AnyRB-Mock: 1`) forces the deterministic
fallback path; `?mock=0` clears the override. Responses always report what happened in
`_meta` (`model`, `latency_s`, `cached`, `fallback`, `mock`, `usage/tokens`).

## Verified live calls (2026-10-29, real key)

Evidence file: [`server/evidence/live_calls.json`](evidence/live_calls.json) (no key in it —
asserted at write time). All required calls succeeded with **0 fallbacks**; the second pass
of the same requests was served from disk cache in ~0.001 s (5/5 cache hits), which is why
the demo is instant after warm-up.

| Endpoint | Model | Latency | Tokens (prompt/completion/total) | Fallback |
|---|---|---|---|---|
| POST `/api/brief/parse` | muse-spark-1.3-contributor | 10.5 s | 396 / 888 / 1284 | no |
| POST `/api/lot/parse` | muse-spark-1.3-contributor | 10.3 s | 335 / 815 / 1150 | no |
| POST `/api/design/plan` | muse-spark-1.3-contributor | 18.0 s | 503 / 1688 / 2191 | no |
| POST `/api/design/review` | muse-spark-1.3-contributor | 13.0 s | 558 / 1290 / 1848 | no |
| POST `/api/proof/memo` | muse-spark-1.3-contributor | 24.6 s | 565 / 2704 / 3269 | no |
| POST `/api/voice/transcribe` | muse-voice-transcribe-1.0 | 4.0 s | audio 8.8 s | no |
| POST `/api/image/render` | muse-image-1.0 | 19.3 s | — | no |
| POST `/api/photo/segment` | sam-3.1 | 1.5 s | — | no |

Observed behaviour worth knowing:

* Spark is a reasoning model: 10–25 s per call (`reasoning_effort=low`, `max_tokens≥3000`).
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
# 26 passed, 1 skipped  (skipped = optional live smoke test, opt in with ANYRB_LIVE_TEST=1)
```

The suite isolates itself before importing the app: `META_API_KEY=""`, a temporary cache and
provenance file, 1 MB body limit, unlimited test rate. It covers: health + schema, brief/lot/
plan/review/proof/voice/image/segment contracts, schema validation on every response,
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
| `server/prompts.py` | grounded prompts, untrusted-text delimiters, number-grounding helper, deterministic fallbacks |
| `server/tests/test_server.py` | pytest suite (mock mode) |
| `server/verify_live.py` | live verification + evidence writer |
| `server/evidence/live_calls.json` | recorded live calls (model, latency, tokens, cache, hashes; no key) |
| `server/API.md` | frontend contract |
| `server/cache/` | disk cache (gitignored) |
| `server/provenance.jsonl` | append-only call log (gitignored) |

## API surface

`POST /api/brief/parse`, `POST /api/lot/parse`, `POST /api/design/plan`,
`POST /api/design/review`, `POST /api/proof/memo`, `POST /api/voice/transcribe` (multipart),
`POST /api/image/render`, `POST /api/photo/segment` (multipart), `GET /api/health`,
`GET /api/provenance`, `GET /api/validation`.

See [`API.md`](API.md) for request/response JSON, error shapes, grounding rules and latency
expectations. `GET /api/health` reports `mode` (`live`/`mock`/`offline`), model IDs, cache
entry count, current-session call count, per-model live latencies and client-model latencies.

Limits: 16 MB request body (configurable `ANYRB_MAX_BODY_MB`), 12 MB audio/image upload,
120 requests/min/IP (`ANYRB_RATE_LIMIT_RPM`), 6000-char text fields. All limits return a
JSON error (`{ok:false,error,message}`), never an HTML page.

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

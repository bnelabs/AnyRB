# AnyRB AI API contract (backend → app)

Base URL in live mode: `http://127.0.0.1:8787`. When the app is served by this backend,
use same-origin `/api/...`. The browser never receives an API key.

Every AI response carries `_meta = {kind, model, latency_s, cached, fallback, usage, grounding?, generated_at}`.
`fallback: true` means the deterministic offline assistant produced the text — the UI must label it.
All endpoints are JSON unless marked multipart. Errors: HTTP 4xx/5xx with `{detail}` or `{ok:false,error,message}`.

## GET /api/health
```json
{"ok": true,
 "ai": {"live": true, "mock": false, "key_present": true,
        "models": {"spark":"muse-spark-1.3-contributor","spark_standard":"muse-spark-1.3",
                   "image":"muse-image-1.0","asr":"muse-voice-transcribe-1.0","sam":"sam-3.1"},
        "calls_logged": 12, "live_calls_logged": 9, "last_latency_s": 11.6,
        "contributor_note": "..."},
 "validation": {"counts": {"PASS": 24, "WARN": 2, "FAIL": 0}, "total": 26, "report": "validation/VALIDATION.md"},
 "service": {"name":"anyrb-ai","version":"0.2","port":8787}}
```
The app uses this to set Live / Offline badge. Absent backend → offline assistant.

## POST /api/brief/parse
Request: `{"text": "shelf bracket for 15 kg, 1% failure risk, under 60 g, recycled PETG", "source": "text"|"voice", "defaults": {...}}`
Response: `{part_label, load_N, deflection_limit_mm, target_pf, mass_cap_g, material_key, process, constraints[], missing[], confidence, rationale, interpretation[], _meta}`.
`material_key ∈ {rpetg, rpet, rhdpe, rpp}`. The app applies the returned targets to the engine; all fields editable.

## POST /api/lot/parse
Request: `{"text": "<supplier datasheet text>"}` → `{material_key, E_mean, E_cv, sy_mean, sy_cv, rho, corr, source_label, fields_found[], assumptions[], confidence, _meta}`.
App shows the extracted values as editable inputs with provenance badges.

## POST /api/design/plan
Request:
```json
{"brief": {...},
 "baseline": {"uniform_width_mm": 2.0, "mass_g": 62.69, "pf": 0.0000822,
              "sigma_req_MPa": 13.92, "E_req_MPa": 1478.5, "u_tip_mm": 1.61},
 "material": {"E_mean": 2100, "E_cv": 0.10, "sy_mean": 46, "sy_cv": 0.10, "rho": 1.24}}
```
Response: `{"candidates":[{"id":"A","name":"Conservative","strategy":"...","width_priors_mm":[8 numbers 1.0–4.0],"why":"...","risk":"..."} ×3], "_meta":...}`
`width_priors_mm` order: bottom row x = 0, 1/3, 2/3, 1 of the span, then top row same x order. The app converts to log-width controls (`log(w)`) and evaluates/optimises each candidate with the verified JS engine. AI proposes; physics decides.

## POST /api/design/review
Request:
```json
{"brief": {...},
 "selected": {"mass_g": 50.73, "pf": 0.00997, "sigma_req_MPa": 18.34, "E_req_MPa": 1688.1,
              "binding_mode": "stiffness/buckling", "p5_margin": 1.215,
              "mass_cap_g": 60, "printability": {"min_width_mm":1.18,"max_slenderness":22.7,"neighbour_ratio":1.45}},
 "comparison": [{"strategy":"solid","mass_g":111.6,"pf":0.0}, ...],
 "material": {"E_mean":2100,...}, "sensitivity": {...}}
```
Response: `{"memo":"…","key_risk":"…","next_actions":["…","…"],"caveats":["…"],"_meta":{"grounding":{"ok":true,...}}}`.
Numbers in the text are checked against the request payload; ungrounded output falls back.

## POST /api/proof/memo
Request: `{"brief":{...},"design":{...},"batch_passport":{"verdict":"pass with compensation","scale_required":1.10,"added_mass_pct":8.5,"lot_E":1680,"lot_sy":46},"comparison":[...],"validation":{"counts":{"PASS":24,"WARN":2,"FAIL":0}}}`
Response: `{"memo":"…","what_would_change_answer":["…"],"recommended_tests":["…"],"claim_level":"…","_meta":...}`.

## POST /api/voice/transcribe  (multipart)
Fields: `audio` = recorded blob (WAV or WebM/Opus; backend normalises). Response: `{"transcript":"…","duration_s":9.7,"_meta":{...}}`.

## POST /api/image/render
Request: `{"prompt":"optional custom prompt","design":{"mass_g":50.73}}`. Response: `{"image_data_url":"data:image/png;base64,…"|null,"illustrative":true,"label":"AI illustration — not the CAD model","_meta":...}`.
The app displays it only with the "AI illustration" label.

## POST /api/photo/segment  (multipart)
Fields: `image`, `concept` (short noun phrase). Response: `{"concept":"…","boxes":[{x1,y1,x2,y2,w,h}],"count":n,"mocked":bool,"_meta":...}`. Optional feature.

## GET /api/provenance?n=50
`{"calls":[{ts,kind,model,latency_s,cached,fallback,...}],"count":n,"live_mode":true}` — app's AI provenance drawer.

## GET /api/validation
Validation summary from `validation/results.json` (the validator module writes it); 404 until generated.

## Offline mode
If `/api/health` is unreachable (file:// or server down), the app must use its built-in deterministic assistant with the same response shapes, set `_meta.fallback=true`, and show "Offline assistant (no Meta API)" — never silently pretend AI is live.

---

# Additive contract notes (v0.2.1, backend-verified 2026-10-29)

Everything above stays valid; this section documents the additions. Endpoint paths and the
core fields the app already uses (`_meta`, `candidates[].width_priors_mm`,
`memo/key_risk/next_actions/caveats`, `verdict/scale_required/added_mass_pct`,
`image_data_url`, `transcript`) are unchanged.

## Response envelope additions

Every AI endpoint additionally returns two convenience aliases that mirror `_meta`:

```json
{"_model": "muse-spark-1.3-contributor", "_cached": false, "_meta": { ... }}
```

`_meta` now also carries `mock` (true when the deterministic path was forced or no key is
configured), `tokens` (alias of `usage`), `session_id`, `mock_reason` (`mock` | `offline` |
`api_error`), `error` (sanitised) and, for review/proof, `grounding`
(`{"ok":true,"ungrounded_numbers":[],"numbers_checked":12}`). Treat `_meta` as the source of
truth for the Live / Offline / cached / fallback badge.

## GET /api/health (additive fields)

Existing fields are kept; new ones:

```json
{"ok": true, "mode": "live",
 "ai": { "...": "...", "model_latencies": {"muse-spark-1.3-contributor": {"calls": 4, "mean_s": 14.2, "max_s": 24.6}},
         "cache": {"entries": 8, "bytes": 734112, "dir": "…/server/cache"} },
 "cache": {"entries": 8, "bytes": 734112},
 "session": {"id": "ebf493e4b163", "calls": 8, "uptime_s": 312.4},
 "endpoints": ["/api/brief/parse", "…"],
 "uptime_s": 312.4}
```

`mode`: `live` = key configured and not mock; `mock` = mock forced (env/`?mock=1`/`--mock`);
`offline` = no key (cache/fallback only).

## Per-request mock override

Any AI endpoint accepts `?mock=1` (or `?mock=0`) and the header `X-AnyRB-Mock: 1|0`.
Forced mock **bypasses the disk cache** and returns the deterministic fallback with
`_meta.mock=true`, `_meta.fallback=true`, `_meta.mock_reason="mock"`, so the UI can honestly
show the fallback state on demand. Without an override the server follows its mode.

## POST /api/design/plan — `width_priors` (engine-ready)

Each candidate keeps `width_priors_mm` (8 strut widths in mm, 1.0–4.0, order = bottom row
x=0, 1/3, 2/3, 1 then top row same order). The server also returns the engine-ready natural
log widths so the app can pass them straight into `widths_from_controls`/`evaluate`:

```json
{"id":"B","name":"Graded Balanced","strategy":"root-heavy graded lattice",
 "width_priors_mm":[2.6,2.2,1.8,1.4,2.6,2.2,1.8,1.4],
 "width_priors":[0.9555,0.7885,0.5878,0.3365,0.9555,0.7885,0.5878,0.3365],
 "why":"…","risk":"…"}
```

`width_priors[k] = ln(width_priors_mm[k])`, clipped to `[ln 1, ln 4] = [0, 1.3863]`; the two
arrays are interchangeable (`exp(width_priors) == width_priors_mm`). The app may use either;
the schema guarantees exactly 3 candidates and 8 values each.

## GET /api/provenance — session filter + aggregate

`GET /api/provenance?n=50&session_only=true`

* `session_only=true` filters to the **current server session** (default false = file tail).
* Response keeps `calls`, `count`, `live_mode` and adds `session_id`, `aggregate`
  (per-model `{calls,cached,fallback}`) and `cache` stats.
* Each call entry: `ts, session_id, kind, model, latency_s, cached, fallback, mock, tokens,
  response_hash, error` (never the key).

## Errors, limits, latency

All errors are JSON: `{"ok":false,"error":"validation_error|rate_limited|payload_too_large|
not_found|…","message":"…","detail":…}`.

| Condition | Status |
|---|---|
| empty/invalid text, wrong field types, >6000-char text | 422 `validation_error` |
| request body > 16 MB (`ANYRB_MAX_BODY_MB`) | 413 `payload_too_large` |
| audio/image upload > 12 MB | 413 |
| > 120 requests/min/IP (`ANYRB_RATE_LIMIT_RPM`) | 429 `rate_limited` |
| unknown route | 404 `not_found` |

Latency expectations (live, single call): brief/lot 7–11 s, plan 14–18 s, review 12–14 s,
proof 22–25 s, ASR 4 s, image 12–19 s, SAM 1–5 s. Cached repeats: ~1 ms. Use a 60 s client
timeout for Spark calls and keep the UI skeleton visible.

## Which fields are AI-generated vs engine-supplied

| Field | Source |
|---|---|
| `brief/parse` → `part_label`, `material_key`, `process`, `constraints`, `rationale`, `missing`, `confidence` | AI (transcribed/interpreted from user text, ranges clamped by server) |
| `brief/parse` → `load_N`, `deflection_limit_mm`, `target_pf`, `mass_cap_g` | AI extraction from user text; must be physically sensible or the deterministic parser is used |
| `lot/parse` → `E_mean, E_cv, sy_mean, sy_cv, rho, corr` | AI extraction from the pasted datasheet; `null` when not stated |
| `design/plan` → `width_priors_mm` | AI proposal (validated/clamped, 3 distinct candidates) — the app evaluates them with the verified engine; **no performance numbers come from the AI** |
| `design/review`/`proof/memo` → text | AI phrasing of numbers **supplied in the request** (programmatically grounded; ungrounded output is replaced and flagged) |
| all metrics (`mass_g`, `pf`, `sigma_req`, `E_req`, batch verdict) | verified engine, never the model |

## Static same-origin routes

`GET /` → built `index.html`; `/index.html`; `/assets/*` → `demo/assets/*`; plus read-only
`/app/*`, `/data/*`, `/design/*`, `/validation/*`, `/reports/*`, `/research/*`, `/audit/*`,
`/demo/*` for the app's data files. `server/`, `.venv/`, dotfiles and path traversal are
always 404 — the key and cache are never exposed.

## Frontend integration checklist

1. `GET /api/health` on load → if unreachable, use the in-app offline assistant and show
   "Offline assistant (no Meta API)"; if `mode!=="live"`, show that too.
2. Send AI calls same-origin (no `Authorization` header anywhere in browser code).
3. Display `_meta.model` + `_meta.latency_s` + cached/fallback state on every AI output.
4. Pass the app's engine metrics into `design/review` / `proof/memo`; every number in the
   returned text is then guaranteed to be grounded in that payload.
5. On 429/413/422, show the JSON `message`; on timeout, retry once then use the local
   deterministic assistant and label it.

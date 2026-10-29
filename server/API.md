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
 "selected": {"mass_g": 46.40, "pf": 0.00997, "sigma_req_MPa": 18.34, "E_req_MPa": 1688.1,
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
Request: `{"prompt":"optional custom prompt","design":{"mass_g":46.40}}`. Response: `{"image_data_url":"data:image/png;base64,…"|null,"illustrative":true,"label":"AI illustration — not the CAD model","_meta":...}`.
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

---

# v0.3 changes — engine-refusable AI, family scope, measurement uncertainty

Contract version **v0.3** (`GET /api/health` → `version: "v0.3"`, `contract_version: "v0.3"`).
All changes are additive: a v0.2 client keeps working, new fields are optional on input.
The design principle: the AI may only phrase decisions the **verified engine can refuse**;
it never computes performance numbers, never claims topology optimality, and never certifies.

## GET /api/health — v0.3 fields

```json
{"ok": true, "version": "v0.3", "contract_version": "v0.3",
 "family_scope": "best of this bracket/lattice family (7x3 X-braced cantilever bracket, 8 log-width control points) — not a general topology optimiser",
 "printability_limits": {"max_neighbour_width_ratio": 1.5, "max_slenderness": 30.0},
 "engine": {"version": "0.3", "printed_mass": true, "mass_analytic_upper_bound": true,
            "family_feasibility": true, "lot_specific_recipe": true,
            "sustained_bound": true, "measurement_cv_default": 0.12},
 "service": {"name": "anyrb-ai", "version": "0.3"}}
```

The existing `mode` / `ai` / `cache` / `session` / `model_latencies` fields are unchanged.

## POST /api/brief/parse — measurement uncertainty

Response adds (all optional in the old response):

```json
{"measurement_cv": 0.12, "measurement_cv_stated": false,
 "brief": {"partType": "cantilever bracket", "loadN": 147.15, "deflLimitMm": 2.5,
           "targetPf": 0.01, "preset": "rPETG", "process": "FDM/FFF",
           "massCapG": 60.0, "measurementCv": 0.12, "constraints": [], "notes": "…"}}
```

* `measurement_cv` — uncertainty of the **measurement/lot data**, a fraction in `[0, 0.5]`,
  default **0.12** (12 %). It is retained in lot-level `P_f` by the engine (a single coupon
  must not zero the uncertainty). The AI only fills it when the brief states one
  ("measurement uncertainty 15 %"); a *material* CV is never treated as measurement uncertainty.
* `measurement_cv_stated` — `true` only if the user stated it (otherwise the default applies).
* `brief` — camel-case mirror for the browser client (identical values). Input `defaults`
  may carry `measurement_cv` to override the default explicitly.

## POST /api/lot/parse — lot identity + measurement provenance

Response adds:

```json
{"lot_id": "2026-31", "supplier": "Recyclex GmbH",
 "measurement_source": "datasheet|certificate|email|measurement|unknown",
 "measurement_cv": 0.08, "measurement_cv_stated": true}
```

`lot_id`/`supplier` are `null` when absent; `measurement_cv` defaults to `0.12`
(`measurement_cv_stated: false`). The model must not invent these values.

## POST /api/design/plan — family scope, printability, feasibility gate

Request (v0.2 keys still accepted; all new keys optional):

```json
{"brief": {...},
 "first_pass": {"feasible_uniform_width_mm": 2.4, "material": {...}, "feasibility": {...}},
 "baseline": {"uniform_width_mm": 2.0, ...},          // v0.2 equivalent, still accepted
 "material": {...},
 "feasibility": {"feasible": true, "min_achievable_pf": 0.0002, "target_pf": 0.01},
 "printability_limits": {"max_neighbour_width_ratio": 1.5, "max_slenderness": 30.0},
 "family_scope": "optional override (defaults to the standard family scope)"}
```

Response adds:

```json
{"family_scope": "best of this bracket/lattice family (…) — not a general topology optimiser",
 "printability_limits": {"max_neighbour_width_ratio": 1.5, "max_slenderness": 30.0},
 "feasibility": {"feasible": true, "min_achievable_pf": 0.0002, "target_pf": 0.01},
 "blocked": false, "note": ""}
```

`candidates` keeps exactly three `{id,name,strategy,width_priors_mm[8],width_priors[8],why,risk}`.
Prompt contract stated to the model: candidates are *priors* the engine re-evaluates and can
refuse; they must respect printability (neighbour width ratio ≤ 1.5, slenderness ≤ 30) and the
engine feasibility gate; the model must never claim topology optimality or invent performance.

**Infeasible family (engine gate):** if the request carries
`feasibility: {feasible: false, ...}` the server **does not call the AI**. It returns HTTP 200
with `blocked: true`, `_meta.model: "fallback"`, `_meta.mock_reason: "family_infeasible"`,
`note` explaining the gate, and three deterministic placeholder candidates solely for schema
compatibility. The UI should block Design before calling; this is the server-side backstop.

## POST /api/design/review and /api/proof/memo — engine-fact payload

The server normalises both the **v0.2** shape (`brief`/`selected`/`comparison`/`material`/
`sensitivity`; `brief`/`design`/`batch_passport`/`comparison`/`validation`) and the **v0.3**
shape into one canonical payload. v0.3 requests may send any of:

```json
{"facts": {"printed_mass_g": 46.0, "mass_analytic_g": 50.73, "pf": 0.00997,
           "target_pf": 0.01, "governing_mode": "stiffness/buckling",
           "sigma_y_req_mpa": 18.34, "E_req_mpa": 1688.0, "deflection_mm": 2.01,
           "min_width_mm": 1.18, "max_slenderness": 22.7, "neighbour_ratio": 1.45,
           "load_n": 147.15, "deflection_limit_mm": 2.5, "feasible": true},
 "design": {"control_widths_mm": [2.0, "...", 8 values], "printability": {...}},
 "brief": {...},
 "lot_recipe": {"width_multipliers": [8 numbers], "global_equivalent_scale": 1.0994,
                "added_mass_pct": 8.5, "printed_mass_g": 49.5,
                "base_printed_mass_g": 46.0, "verdict": "pass with compensation",
                "measurement_cv": 0.15, "lot_id": "2026-31", "supplier": "…",
                "measurement_source": "certificate", "printability": {...}},
 "measurement": {"cv": 0.15, "lot_id": "2026-31", "supplier": "…",
                 "measurement_source": "certificate"},
 "sustained_bound": {"pf_bound": 0.04, "deflection_bound_mm": 4.0,
                     "creep_factor": 2.0, "compression_factor": 0.8},
 "feasibility": {"feasible": true, "min_achievable_pf": 0.0002, "target_pf": 0.01},
 "validation": {"counts": {"PASS": 24, "WARN": 2, "FAIL": 0}, "total": 26},
 "proof": {"lot_recipe": {...}, "sustained_bound": {...}, "passport": {...}},
 "batch_passport": {...}}                 // v0.2 wording, mapped to lot_recipe
```

Canonical blocks the model sees (and the grounding gate checks): `family_scope`, `brief`,
`design` (with `printed_mass_g`, `mass_analytic_g`, `mass_basis`, `pf`, `governing_mode`,
`printability`), `printability_limits`, `lot_recipe`, `measurement`, `sustained_bound`,
`feasibility`, `comparison`, `material`, `sensitivity`, `validation`.

Response additions (existing `memo`/`key_risk`/`next_actions`/`caveats` and
`memo`/`what_would_change_answer`/`recommended_tests`/`claim_level` unchanged):

```json
{"family_scope": "best of this bracket/lattice family …",
 "mass_basis": "printed_mass_g is the reported mass …; mass_analytic_g is an upper bound …",
 "sustained_advisory": "not qualified for sustained load (advisory)" | "" | "sustained-load bound is advisory only",
 "feasibility": {"feasible": true, ...},
 "lot_recipe": {...}, "measurement": {...}          // proof only
}
```

Prompt/number rules enforced (and regression-tested):

1. Cite **`design.printed_mass_g`** for mass comparisons; `mass_analytic_g` is an **upper
   bound** and must be labelled as such if mentioned. Old payloads without a printed mass are
   phrased "analytic mass … (upper bound; printed mass not supplied)".
2. Printability is a constraint: neighbour width ratio (≤ 1.5) and slenderness (≤ 30) are
   discussed against those limits.
3. A lot-specific recipe is described by its 8 width multipliers, global-equivalent scale and
   added mass — not as one global scale.
4. Measurement CV is stated as retained in the lot reliability.
5. The sustained-load/creep bound is **advisory only**; if it fails the text says the part is
   "not qualified for sustained load" and that the static result is unchanged.
6. Scope is always "best of this bracket/lattice family", never a topology optimum or
   certification claim.
7. Every number in the text must exist in the request-derived canonical payload; otherwise the
   deterministic memo is returned with `_meta.fallback: true` and `_meta.grounding.ok: false`.

## Backward compatibility

| Client payload | v0.3 server |
|---|---|
| v0.2 review/proof request keys | accepted, normalised (printed mass absent → analytic labelled upper bound; measurement CV defaults to 0.12) |
| v0.2 brief/lot response consumers | all old fields still present; new fields additive |
| app `first_pass` plan payload | accepted and mapped to `baseline`/`material` |
| `?mock=1` / `X-AnyRB-Mock` | unchanged |

## Testing / evidence

40 mock-mode pytest tests (no live model calls) cover the new fields, the feasibility gate,
grounding accept/reject on the v0.3 payload, both payload generations, prompt rules and the
health contract. Seeded `reports` on disk (evidence/live_calls.json) are from the v0.2-era live
pass; re-run `python server/verify_live.py` with a key to refresh them (old payloads still
accepted by these endpoints).

---

# v0.4 changes — printed-process gate, brittle screen, assumption bounds, QC record

Contract version **v0.4** (`GET /api/health` → `version: "v0.4"`, `contract_version: "v0.4"`).
Additive again: v0.2/v0.3 clients keep working, every v0.4 block is optional. The principle is
unchanged — the AI only phrases engine decisions the engine can refuse; it computes no performance
numbers and certifies nothing.

## GET /api/health — v0.4 engine capabilities

```json
{"ok": true, "version": "v0.4", "contract_version": "v0.4",
 "process_rule": "only FDM/FFF material data is valid for the printed bracket family; …",
 "engine": {"version": "0.4",
            "printed_process_gate": true, "elongation_brittle_screen": true,
            "union_mass_polish": true, "assumption_bounds": true,
            "printed_mass": true, "family_feasibility": true,
            "lot_specific_recipe": true, "sustained_bound": true,
            "measurement_cv_default": 0.12},
 "service": {"name": "anyrb-ai", "version": "0.4"}}
```

The four v0.4 capabilities: `printed_process_gate` (only FDM/FFF data may feed the printed
lattice path), `elongation_brittle_screen` (marginal elongation-at-break P_f, reported as an
add-on), `union_mass_polish` (final design mass is polished on the printed union mass, not the
analytic upper bound), `assumption_bounds` (correlation / lot-split P_f range).

## POST /api/design/plan — printed-process gate

Request additions (all optional):

```json
{"material": {"process": "FDM/FFF" | "IM" | "IM/compression" | …},
 "feasibility": {"feasible": true, "process_ok": true, "reason": "", "min_achievable_pf": 0.0002},
 "process": {"ok": true, "process": "FDM/FFF", "reason": ""}}
```

The server infers the gate from `feasibility.process_ok` / `feasibility.reason`, an explicit
`process.ok`, or `material.process` (FDM/FFF ⇒ printed; IM / injection / compression / moulded /
SLA / resin ⇒ not printed). Response adds `process`:

```json
{"process": {"ok": false, "process": "IM/compression", "reason": "process_mismatch",
             "rule": "only FDM/FFF material data is valid for the printed bracket family; …"}}
```

**If the gate fails, the AI is not called.** The response is HTTP 200 with `blocked: true`,
`_meta.model: "fallback"`, `_meta.mock_reason: "process_mismatch"`, `process` echoed, and `note`:
*"the selected material preset is IM/compression data and cannot be used for a printed lattice —
design is blocked; choose an FDM/FFF preset (e.g. rPETG)"*. Three deterministic placeholders are
returned only for schema compatibility. `process_mismatch` takes precedence over the family
infeasibility gate (`mock_reason: "family_infeasible"`).

Prompt contract (stated to the model): "Only FDM/FFF material data is valid for the printed bracket
family." — IM/compression presets are contrast data, never printed-lattice input.

## POST /api/design/review and /api/proof/memo — v0.4 blocks

Optional request blocks (all accepted in snake_case; camelCase tolerated):

```json
{"brittle": {"strain_req_pct": 0.87, "elongation_mean_pct": 4.0, "elongation_cv": 0.20,
             "pf_brittle": 0.0009, "pf_bound": 0.0109, "note": "…"},
 "assumptions": {"pf_min": 0.004, "pf_max": 0.030,
                 "corr_range": [{"corr": 0.3, "pf": 0.006}, {"corr": 0.7, "pf": 0.004}],
                 "split_range": [{"lot_fraction": 0.75, "pf": 0.008},
                                 {"lot_fraction": 0.95, "pf": 0.016}]},
 "process": {"ok": true, "process": "FDM/FFF", "reason": ""},
 "qc": {"lot_id": "LOT-2026-014", "supplier": "Recycled Polymer Co.",
        "measurement_source": "certificate", "measurement_cv": 0.15,
        "recycled_content_pct": 78}}
```

Also accepted from the app's flattened payload: `facts.mass_analytic_upper_bound_g`,
`facts.sustained_pf_bound` / `facts.sustained_deflection_bound_mm`, `proof.sustained`,
`proof.recipe`, `proof.qc`. `qc.measurement_cv` (fraction) or the app panel's `qc.cv`
(percent) both work; an explicit QC measurement CV overrides the 12 % default in the memo.

Response additions (optional; only echoed when supplied):

```json
{"brittle": {"pf_brittle": 0.0009, "pf_brittle_pct": 0.09, "pf_bound": 0.0109,
             "pf_bound_pct": 1.09, "label": "add-on estimate (not a formal bound), not folded into the headline two-property P_f",
             "headline": false},
 "assumptions": {"pf_min": 0.004, "pf_max": 0.03, "pf_min_pct": 0.4, "pf_max_pct": 3.0,
                 "corr_range": [...], "split_range": [...], "label": "unmeasured assumption sensitivity, not validation",
                 "is_validation": false},
 "process": {"ok": true, "process": "FDM/FFF", "rule": "…"},
 "qc": {"lot_id": "LOT-2026-014", "supplier": "…", "measurement_source": "certificate",
        "measurement_cv": 0.15, "measurement_cv_pct": 15.0,
        "recycled_content_pct": 78.0, "recycled_content_note": "paperwork claim (not simulated)"}}
```

Prompt/number rules enforced (and regression-tested):

1. **Brittle / elongation screen** is a *add-on estimate*: it is never folded into the
   headline two-property P_f; brittle lots are flagged as an add-on risk.
2. **Assumption bounds** are *unmeasured sensitivity* (ln E / ln sy correlation and lot-vs-within
   split) — never validation, and the model may not claim the range was measured.
3. **Process mismatch blocks design** — if `process.ok` is false the memo says the printed-lattice
   design is blocked (IM/compression data cannot be used for a printed part).
4. **Lot identity / QC** is a record; a recycled-content % is a *paperwork claim (not simulated)*.
5. The **sustained-load / creep bound** remains advisory (and says "not qualified for sustained
   load" when it fails); printed mass remains the comparison basis, analytic mass is an upper bound.
6. Every number in the text must exist in the request-derived canonical payload; otherwise the
   deterministic memo is returned with `_meta.fallback: true` and `_meta.grounding.ok: false`.

## Backward compatibility

| Client payload | v0.4 server |
|---|---|
| v0.2 review/proof request keys | accepted (unchanged behaviour) |
| v0.3 review/proof blocks (`facts`, `design`, `lot_recipe`, `measurement`, `sustained_bound`, `feasibility`, `family_scope`) | accepted; v0.4 blocks absent ⇒ v0.3 response shapes (brittle/assumptions/process/qc omitted) |
| v0.2/v0.3 plan payloads (`brief`/`baseline`/`first_pass`/`feasibility`) | accepted; no process info ⇒ gate not applied |
| `?mock=1` / `X-AnyRB-Mock` | unchanged |

## Testing

`51 passed, 1 skipped` in mock mode (no live model calls): v0.4 adds process-blocked plan
(feasibility- and material-derived, precedence over family infeasibility), printed-process
non-blocking, prompt-rule assertions, brittle/assumption/QC grounding and wording on review and
proof, absent-v0.4-block backwards compatibility, app-shaped sustained-key pickup, and the v0.4
health contract. Run: `cd AnyRB && .venv/bin/python -m pytest server/tests -q`.

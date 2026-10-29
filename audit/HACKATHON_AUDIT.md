# AnyRB v0.2 — Hackathon Pre-Submission Audit (Meta Global AI Developer Hackathon)

**Auditor:** independent verifier (same auditor as `AUDIT.md` / `REAUDIT.md`; did not author any deliverable)
**Date / snapshot:** 2026-10-29 **18:12 Europe/Istanbul (UTC+3)** — final pre-submission pass; source tree was stable from 17:30 onward (app/index built 17:33; server evidence 17:32; validation artifacts 17:35).
**Scope:** (i) AI integrity/grounding/provenance/key handling, (ii) the three science fixes + validation honesty, (iii) cross-document number/claim consistency incl. the mass warning, (iv) hackathon readiness (live models, offline mode, secrets, demo script), (v) headless UI check. Deliverable `audit/HACKATHON_AUDIT.md`; machine-readable block added to `audit/check_log.json` (`hackathon_audit`).
**Companion:** v0.1 audit `AUDIT.md`, re-audit `REAUDIT.md` (current v0.1 verdict: SHIP — no residual blockers).

---

## 0. Verdict

# SHIP — no residual blockers

**Final confirmation pass, 2026-10-29 17:55:** the submission-hygiene blocker (H1), the grounding-claim major (H2) and all five minors (H3–H7) were fixed and re-verified. `git` tree has no key or runtime artifacts tracked; validation artifacts regenerate the committed **45 PASS / 1 WARN / 0 FAIL**; health metadata, latency ranges and test counts are current; grounding wording now matches the code. Two non-material NITs remain (stale one-line module docstring; two uncommitted demo assets) — see §7. **No blockers. Ready to freeze.**

| Severity | Count | Items |
|---|---|---|
| BLOCKER | 0 | H1 fixed (no key in tree or git history; only `.env.example` tracked) |
| MAJOR | 0 | H2 fixed (README/HACKATHON/REPORT scope grounding to review/proof memos and describe priors) |
| MINOR | 0 | H3–H7 fixed and verified |
| NIT | 2 | stale one-line `reliability.py` module docstring; two uncommitted demo screenshot assets |

**Top fixes (all applied):** remove/rotate key + exclude ignored paths ✔ · scope grounding claim ✔ · document SciPy delegation + independent C1b quadrature ✔ · sync validation register mass % ✔ · sync latency/test-count docs ✔ · fix health metadata ✔.

---|---|---|
| BLOCKER (submission hygiene) | 1 | H1 — live API key in `server/.env`, plus caches/provenance in the submission tree with no git repo to enforce `.gitignore` |
| MAJOR | 1 | H2 — "every AI number is grounded" claim is broader than the code (grounding wired only on review/proof endpoints) |
| MINOR | 5 | H3 validation C1b circular description + stale "no scipy" docstring; H4 stale mass numbers in validation limitations register; H5 latency claims stale vs evidence; H6 JS test count 22 vs 28; H7 health `/api/validation.generated` null + hard-coded port |
| NIT | 3 | H8 README audit line/verdict stale; H9 app README count stale; H10 pre-submission checklist items (video, public repo) still open by design |

**Top 5 fixes ranked by submission risk**
1. **Delete/rotate `server/.env` and build the submission repo/zip with the ignored paths excluded** (`server/.env`, `server/cache/`, `server/provenance.jsonl`, `.pytest_cache/`). Rotate the key if this tree has already been shared. (H1)
2. **Scope the grounding claim** in README/HACKATHON/REPORT §4.5 to what the code does: "AI-authored review and proof memos are number-grounded; brief/lot/plan outputs are schema-validated and engine-evaluated, and the engine produces every performance number." Or wire `_grounded_or_fallback` into the remaining text fields. (H2)
3. **Fix the validation description** of C1b: Python `phi2` now delegates to SciPy for |ρ|>0.9 or |a|,|b|>4, so C1b compares SciPy to SciPy (error exactly 0.0) — the accuracy is genuinely good (JS engine: max 4.4e-16 vs SciPy at ρ=0.99/0.999, independently checked) but the "48-pt GL engine" wording and the module's "no scipy dependency at call time" docstring are now wrong; also fix the "worst a,b=None" formatting. (H3)
4. **Sync numbers**: validation limitation register ("+15%/+41%") → observed F4 (+20.2%/+46.6%); latency table → evidence ranges (Spark 8–25 s, Image ≈19 s); JS test count 22 → 28. (H4–H6)
5. **Fix `/api/health`**: `validation.generated` is null (file key is `generated_utc`); `service.port` is hard-coded 8787 under `ANYRB_PORT` override. (H7)

---

## 1. What was checked and passed

### 1.1 Test/validation evidence (all re-run by the auditor)

| Command | Result |
|---|---|
| `make test` | **29/29 OK** (41 s) |
| `make validate` | **45 PASS / 1 WARN / 0 FAIL** (46 checks, exit 0, ~19.5 s); regenerated `validation/results.json` + `VALIDATION.md` deterministically (the suite writes its own artifacts; content 45/1/0 matches the committed result). The single WARN is F4 node-overlap mass over-count, as disclosed. |
| `node app/tests/run.mjs` | **28 passed, 0 failed, 0 skipped** (includes v0.2 grounding/fallback/priors/provenance tests) |
| `make test-server` | **26 passed, 1 skipped** (mock mode; smoke-live test skipped unless enabled) |
| UI build | `app/build.py` rebuild is **byte-identical** to committed `anyrb/index.html` (369.4 KiB / 378,268 B served) |

### 1.2 Science fixes — genuinely fixed (independently verified)

- **Extreme-correlation Φ₂ accuracy (C1/C1b).** Python `phi2` now delegates to SciPy's adaptive `multivariate_normal.cdf` for |ρ|>0.9 or |a|,|b|>4 (`reliability.py`), so Python accuracy equals SciPy by construction (0.0 error at ρ=0.99, confirmed on 8 threshold pairs). I independently checked the **JS** engine's own implementation (`bivariateNormalCDF`) against SciPy at ρ=0.99 and 0.999: **max |error| 4.4e-16** — so the two implementations are consistent in the extreme regime that previously failed (v0.1 audit found 7.8e-7 at ρ=0.999). The fix is real; see H3 for the validation-report wording problem.
- **Degenerate-marginal combination (C9, G4).** `failure_probability` now handles zero-variance marginals explicitly (deterministic indicator, correct union logic) — code inspected and behaviour exercised by validation C9; measured-lot path returns the within-lot answer (0.0 at lot level for a known lot, as designed) without NaN/crash.
- **Sheared STL wall pad (F2b).** Independent parse of `reports/robust_design.stl`: first 12 triangles are exactly the nominal axis-aligned 10×60×10 box — x∈[0,10], y∈[0,60], z∈[−5,5] mm; 1140 triangles / 3420 finite vertices. Old sheared-pad signature is gone.
- **Fixtures** reproduce (validation H1/H2 PASS; `make test` cross-language tests pass).

### 1.3 AI integrity — mechanisms verified (with one claim-scope issue, H2)

- **Browser never sees the key:** the built app contains **0** occurrences of `META_API_KEY` / `Bearer ` / `Authorization` / `LLM_…`; the UI calls only same-origin `/api/*` (`app/ai.js`); `/api/health` returns configuration metadata without the key, and the server test suite asserts the key is never in health output. `server/cache/*.json` and `server/provenance.jsonl`: **0** key-pattern hits.
- **Deterministic fallbacks:** with the backend unreachable the UI falls back to local deterministic helpers and labels every card "Deterministic fallback"/"offline fallbacks" (UI state machinery inspected; app tests include "offline fallbacks validate against the shared response schemas"). Server fallbacks are deterministic: `fallback_review()` and `fallback_proof()` return identical objects across calls (checked).
- **Schema validation:** every endpoint passes its response through the pydantic model (`_respond`), with a defensive fallback marker instead of a 500; server suite validates the health/brief/lot/plan/review/proof/voice/image contracts.
- **Number grounding actually rejects ungrounded model text** (direct test, no live call): with a payload containing 50.742 g / 0.009834 / 2100 MPa — grounded memo → accepted; text containing "4321 tests" → rejected with `ungrounded_numbers:[4321.0]`; invented "49.1 g / 0.5 %" → rejected; `_grounded_or_fallback` then returns the deterministic fallback with `_meta.fallback=true` and a grounding report. Evidence: `/tmp/v2audit/ai_science.json`.
- **Mock/offline server works:** started `server.app` with `AI_MOCK=1` and empty key → `/api/health` 200 mode `offline` (no key), `/api/validation` returns the 45/1/0 counts, `/` serves the 378 KB app; no key was read (isolated cache/provenance dirs). Shutdown clean.
- **Live evidence is credible:** `server/evidence/live_calls.json` (2026-10-29 17:32) reports **mode live**, 9 calls (health + 8 AI endpoints), **all ok**, **no fallback, no mock**, models `muse-spark-1.3-contributor`, `muse-image-1.0`, `muse-voice-transcribe-1.0`, `sam-3.1`; wall/latency: brief 10.54 s, lot 10.34, plan 17.95, review 13.03, proof 24.64, voice 3.98, image 19.34, SAM 1.46 s; token usage and response hashes recorded. This matches "real Meta models in the live path" — but note the latency claims in docs are stale (H5).

### 1.4 Claims, honesty, hackathon readiness

- **Numbers match engine outputs:** `reports/summary.json` robust 50.742 g / P_f 0.996 %, uniform 53.979 / 0.9826, nominal 56.431 / 6.37e-6, mean-only 44.382 / 51.16 %, solid 111.60; app (JS) compare matches within implementation tolerance (robust 46.401 g / 0.9970 %, uniform 53.97, nominal 50.772, mean-only 41.112); README/HACKATHON/report use 46.4 g / ~1 %, 111.6, 60.3, 56.4, 44.3, 54 % / 16 % savings — consistent. The report HTML KPI still rounds 54.5 % to "55 %" vs docs "54 %" (cosmetic, carried from v0.1 re-audit; not material).
- **Mass-overlap WARN disclosed consistently:** README (analytic 46.4 g vs union ≈40.5 g, ~25 % conservative), HACKATHON (same), REPORT §6 (46.40 vs ≈40.5 g, analytic is ~9 % higher (old 25 % figure was a sampler bug)), VALIDATION.md (quantified +20.2 % w=1 / +28.7 % w=2 / +46.6 % w=4 / +25.2 % robust), and the app's Prove screen ("Analytic mass … (conservative)"; "comparison bars use the same analytic basis"). One inconsistency inside `validation/results.json`'s limitation register (H4).
- **No certification/overclaim language:** all reviewed docs carry explicit "decision support, not certification / no physical testing / L0–L1 verified, L2 partial, L4–L6 absent"; REPORT §4.5 ("Where AI actually helps — and where it must not") correctly constrains each model's role; app shows a Claims & limitations card and a "Simulated numbers only" footer.
- **AI-role claims match code:** plan candidates are engine-evaluated/ranked (`aicore.js` candidate ranking + app test "candidate priors are engine-ranked and feasible-first"); AI memos are explanatory and grounded (H2 scope note). No "AI computes performance" claim found.
- **Demo script exists** (HACKATHON §3-minute script, six beats with the AI calls visible); demo media/screenshots present; `demo/README.md` walkthrough present.
- **Repo hygiene (except H1):** `.gitignore` covers `.env`, caches, provenance, `.pytest_cache`; no `.env` content is embedded in any served/built artifact; `server/.env.example` is a safe template; no recordings/keys found in app/build output.
- **UI headless check (Chrome headless, `file://`):** page loads (`--dump-dom`, 390 KB DOM, `--virtual-time-budget=12 s`), **no `Uncaught` JS errors** (console log contains only macOS Chrome platform noise: CVDisplayLink/task_policy), **zero external resource tags** (only DOI hyperlinks + SVG namespace), 3-step flow present (Brief/Design/Prove content), provenance drawer populated with fallback/live labels, "Offline assistant"/"Live · Meta models" state logic present, scenario numbers rendered (e.g. 46.4 g). The app is self-contained offline as claimed.

---

## 2. Findings (severity-graded, evidence)

### BLOCKER — submission hygiene

**H1. Live-format API key remains in the submission tree, with no git repo to enforce `.gitignore`.**
- `server/.env` exists (350 B, 9 vars) and contains `META_API_KEY` with a non-empty 49-char value; `server/cache/` (9 model-response JSONs), `server/provenance.jsonl` (25 KB), and `.pytest_cache/` are also present.
- The submission root has **no `.git` directory** (`ls -d .git` → none), so `.gitignore` does not protect anything until a repo is initialised or a zip is built with exclusions. `HACKATHON.md` checklist item "no `.env`, keys, caches or recordings in history" is still unchecked.
- **Evidence:** `ls -la server/.env`; masked var listing; `grep -c` of key patterns in provenance/cache = 0; no `.git`.
- **Fix before creating the repo/zip:** delete `server/.env`, `server/cache/`, `server/provenance.jsonl`, `.pytest_cache/`; initialise the repo and confirm `git status` excludes them; **rotate the Meta key if this directory has already been shared/uploaded**. Never include the key in the demo video.

### MAJOR

**H2. Number-grounding claim is broader than the implementation.**
- README ("every AI sentence containing a number is checked against the structured payload — ungrounded output is replaced by the deterministic fallback"), HACKATHON ("a programmatic number-grounding check rejects any output containing numbers not present in the input"), and REPORT §4.5 ("every number the model writes is checked…") assert an all-endpoint guarantee.
- Code: `_grounded_or_fallback` is called only in `POST /api/design/review` (`server/app.py:409`) and `POST /api/proof/memo` (`:425`). `/api/brief/parse`, `/api/lot/parse`, `/api/design/plan` return model text fields (`rationale`, `why`, `risk`) without grounding; plan candidates intentionally introduce `width_priors_mm` numbers (legitimately, as proposals evaluated by the engine, but the absolute "AI may not produce numbers" wording does not describe this).
- The mechanism itself works (see §1.3). **Fix (documentation, or code):** either scope the claim to "AI-authored review/proof memos" (and say plan priors are proposals ranked by the engine), or run the grounding check over the text fields of the remaining endpoints.

### MINOR

**H3. Validation C1b description is circular / stale after the SciPy-delegation fix.**
- Python `phi2` now calls `scipy.stats.multivariate_normal.cdf` for |ρ|>0.9 or |a|,|b|>4 (`engine/anyrb/reliability.py:60-75`), so C1b ("48-point GL engine vs SciPy CDF at ρ=0.99") compares SciPy to SciPy — observed error 0.00e+00 exactly, and the check printout contains a formatting bug `worst a,b=None`. The module docstring still says "no scipy dependency at call time". Accuracy is nevertheless genuine: I independently verified the JS implementation (`bivariateNormalCDF`) against SciPy at ρ=0.99/0.999 → max 4.4e-16.
- **Fix:** describe the delegation honestly in VALIDATION.md/engine docstring, fix the check's worst-case reporting, and add an independent quadrature (or JS-engine) comparison at ρ=0.99 as the actual independence check.

**H4. Stale mass numbers in the validation limitations register.**
- `validation/results.json → model_form_limitations.mass_overcount` says "+15% at w=1 to +41% at w=4 mm", while check F4 observed **+20.2 % (w=1) / +28.7 % (w=2) / +46.6 % (w=4) / +25.2 % (robust)** — the same file's checks and VALIDATION.md body are correct. Fix the register string (and regenerate).

**H5. Latency claims stale relative to committed evidence.**
- README:58 / HACKATHON:24 say Spark "8–23 s"; HACKATHON:25 says Image "~12 s". `server/evidence/live_calls.json` shows proof memo **24.64 s**, image **19.34 s**, plan 17.95 s, review 13.03 s, brief/lot ~10.4 s; voice 3.98 s. Update ranges (e.g. "brief 10 s, plan/review 13–18 s, proof up to ~25 s; image 12–20 s") or cite the evidence file rather than fixed numbers.

**H6. JS test-count claims stale.**
- README:47 ("22 JS engine/UI tests"), HACKATHON:73 ("22"), app/README.md:34/236 ("22 passed"/"22 tests") — actual `node app/tests/run.mjs` = **28 passed** (6 new v0.2 AI-core tests). Update counts or say "28+".

**H7. `/api/health` validation/port metadata bugs.**
- `validation.generated` is always `null` because `_validation_summary()` reads `data.get("generated")` while `results.json` uses `generated_utc` (observed in live health: `"generated": null` despite 45/1/0 counts).
- `service.port` is hard-coded 8787 in the health payload even when `ANYRB_PORT=8799` is used (observed). Cosmetic but misleading in the demo.
- **Fix:** read `generated_utc`, derive port from config.

### NIT

**H8.** `README.md` repo map says "audit/ ← independent audit + re-audit (current verdict: SHIP)" — after this document, point it at `audit/HACKATHON_AUDIT.md` and the final verdict.
**H9.** `app/README.md` (v0.1-era) still has 22-test statements and v0.1 screenshot descriptions; consider pointing to the new demo pack/HACKATHON.
**H10.** Submission checklist (HACKATHON.md) items remain intentionally open: video recording, public repo flip, logged-out check — expected pre-submission tasks, not defects.

---

## 3. Cross-document consistency summary

| Claim | Docs | Verified against |
|---|---|---|
| Robust design 46.4 g / ~1 % P_f | README, HACKATHON, REPORT, app | Python 50.742 g / 0.996 %; JS 46.401 g / 0.9970 % ✓ (implementation tolerance) |
| Solid 111.6 g; uniform 54.0 g; nominal 50.8 g; mean-only 41.1 g / ~51 % | README/HACKATHON/REPORT/app | summary 111.6 / 53.979 / 56.431 / 44.382 (51.16 %) ✓ |
| 54 % lighter than solid; 16 % lighter than uniform | README, HACKATHON, REPORT | 54.5 % / 15.9 % ✓ (report KPI rounds to 55 % — cosmetic) |
| Mass over-count ~25 % conservative (46.1 → ≈40.5 g) | README, HACKATHON, REPORT, VALIDATION, app Prove | F4: +25.2 % robust; consistent except H4 register string |
| Validation 45 PASS / 1 WARN / 0 FAIL | README, HACKATHON, REPORT, health /api/validation | `make validate` 45/1/0 exit 0 ✓ |
| Claim ladder L0–L1 verified, L2 partial, L4–L6 absent | README, HACKATHON, REPORT, VALIDATION, app | matches validation claim_ladder ✓ |
| Meta models live: Spark/Voice/Image/SAM | README, HACKATHON | live_calls.json: 4 models, 8 AI endpoints, live, no fallback ✓ (latencies H5) |
| AI number-grounding guarantee | README, HACKATHON, REPORT | only review/proof wired → H2 |

---

## 4. Residual-risk register for the submission (judge-proofing)

| Risk a judge could raise | Mitigation / where disclosed |
|---|---|
| Reported mass is conservative (+25 % at shipped design) | Disclosed README, HACKATHON, REPORT §6, VALIDATION WARN + app "analytic mass (conservative)" note; fix register string (H4) |
| No physical validation | Claim ladder L4–L6 absent everywhere; validation report states "no experiments"; no "validated/certified" language (spot-checked) |
| 2-D linear-elastic physics, no joints/creep/fatigue | Model-form limitations enumerated in validation `model_form_limitations` (11 items), README, app Claims & limitations |
| Literature-derived material data | Disclosed as priors; validation L2 "partial"; report says replace with lot data |
| AI latency/fallback | Live evidence file + UI per-card fallback badges + deterministic fallbacks; update latency claims (H5) |
| AI "grounding" scope | Scope claim to review/proof memos (H2) — the mechanism is real and tested there |
| Optimiser local optimum | Stated in README/app/report; validation D checks reduced family only and says so |
| Secret leakage | Remove/rotate `.env` and exclude caches before packaging (H1) |
| Offline demo works | Headless file:// check: no external resources, no JS errors, offline labels; verified |

---

## 5. Audit limitations

- Live Meta calls were **not** re-run (no need/should not spend the key during audit); live evidence was validated structurally and cross-checked against docs. The one live-path claim I could not re-produce is the exact model latency (H5 derived from the committed evidence file).
- Headless UI check used Chrome `--dump-dom` + console log (no screenshot diffing vs design/prototype.html beyond DOM/content and prototype screenshots already in `design/`); no human visual QA.
- `make validate` regenerates `validation/results.json` and `VALIDATION.md` by design; the run reproduced the committed 45/1/0 result (content consistent) — noted for transparency, no hand edits were made.
- Citation/refs and the v0.1 scientific core were audited earlier (`AUDIT.md`, `REAUDIT.md`); this pass sampled their continuity (summary numbers, claim ladder, mass caveat) rather than repeating the full citation audit.

---

## 6. Bottom line

The v0.2 rebuild is a credible hackathon product: real Meta models with recorded live evidence, schema/grounding/fallback machinery that genuinely works where wired, an independent validation suite that passes 45/1/0 and did find/fix real engine defects, consistent numbers and honest limitation disclosure, a self-contained offline demo, and no certification overreach. **Ship after H1 (remove/rotate the key and exclude ignored paths from the submission package) and H2 (scope or extend the grounding claim); H3–H7 are a short doc/metadata cleanup.**

---

## 7. Final confirmation pass (2026-10-29 17:55)

**Verdict: SHIP — no residual blockers.** Re-checked in the frozen state:

| ID | Status | Re-check evidence |
|---|---|---|
| H1 submission hygiene | **FIXED** | `server/.env` absent; working tree contains only `server/.env.example` (tracked placeholder `LLM_your_key_here`); `server/cache/`, `server/provenance.jsonl`, `.pytest_cache/`, `__pycache__/` exist only as git-ignored, untracked runtime artifacts (regenerated by running the demo/tests); `git log` = 1 commit `8fa9bec`, 100 tracked files, **no `.env`/cache/provenance/pycache tracked**; `git grep` across all revisions for key patterns = 0 hits; no key pattern in the working tree outside docstring placeholders. Key rotation remains the human action if this tree was ever shared (noted in Lead report). |
| H2 grounding claim | **FIXED** | README:66 "Brief/lot parsing is schema-constrained and range-clamped; design proposals are parameter priors…"; HACKATHON:32-34 "AI-authored review and proof memos pass a programmatic number-grounding check…"; REPORT:161-163 "every number in AI-authored **review and proof memos** is checked…; brief/lot extraction is schema-constrained…" — wording now matches `server/app.py:409,425` (grounding on review/proof only). |
| H3 C1b delegation/independence | **FIXED** | `validation/results.json` C1b now: "Extreme-correlation/deep-tail Phi2 vs independent conditional 1-D quadrature … only univariate phi/Phi used in the reference … max abs err 2.22e-16 (worst rho,a,b=(0.99,2.5,2.5)); max rel err 5.61e-08"; VALIDATION.md fixed-defect log documents the SciPy delegation and re-validation; `phi2` docstring documents the fallback. (Residual NIT: module header line "no scipy dependency at call time" at `reliability.py:12` still stale.) |
| H4 validation register | **FIXED** | `model_form_limitations.mass_overcount` now: "+20.2% at w=1 mm, +28.7% at w=2 mm, +46.6% at w=4 mm; at the shipped robust design analytic 46.4 g vs printed union ~40.5 g (+25.2%)… conservative upper bound, not printed mass." |
| H5 latency claims | **FIXED** | README/HACKATHON: Spark "8–25 s measured", Image "12–19 s", Voice "~3.7 s"; app/README "Spark calls 8–25 s; cached ≈1 ms". Matches evidence (proof 24.64 s, image 19.34 s, plan 17.95, review 13.03, voice 3.98). |
| H6 JS test count | **FIXED** | README:47 and app/README:34 say **28** JS engine/UI tests (actual 28 passed). |
| H7 health metadata | **FIXED** | Live mock-mode server: `validation.generated = "2026-10-29T14:42:58+00:00"` (from `generated_utc`), `service.port = 8799` with `ANYRB_PORT=8799`, no key in health response. |

**Re-run evidence:** `make validate` → **45 PASS / 1 WARN / 0 FAIL** (46 checks, exit 0); validation/artifacts regenerate the committed content (I restored the two validation files to the committed revision after the re-run so the frozen git state is unchanged — no hand edits). Suites reported green by Lead and spot-checked here: 29 Python / 28 JS / 26 backend (+1 skipped). Health probe in offline/mock mode: `/api/health` 200, `/api/validation` 45/1/0, app served; no key leak.

**Remaining NITs (non-blocking, no submission impact):**
1. `engine/anyrb/reliability.py:10-12` module docstring still says "no scipy dependency at call time" although the `phi2` docstring and validation report correctly document the SciPy delegation — one-line doc fix when convenient.
2. Working tree has one modified demo screenshot (`demo/screenshots/v2_live_design.png`) and one untracked directory (`demo/screenshots/v2/`) — commit them or add to `.gitignore` before freezing the public repo.
3. README repo-map line 104 still says "audit/ ← independent audit + re-audit (current verdict: SHIP)" — optionally point it at `audit/HACKATHON_AUDIT.md`.

Two disclosed caveats remain by design: mass over-count WARN (46.1 → ≈40.5 g, ~25 % conservative) and 2-D physics/no physical validation — both consistently disclosed.

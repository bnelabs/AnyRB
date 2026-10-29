# AnyRB v0.4 — Delta Audit (remaining-gaps release from second external review)

**Auditor:** independent verifier (same auditor as v0.1–v0.3 audits; authored no deliverable)
**Repo:** `/Users/barisnacierzeren/Downloads/Candidate-2/anyrb` · private `bnelabs/AnyRB`
**Commit audited:** `da0c198` — “AnyRB v0.4 — remaining-gaps release: printed-process gate, elongation/brittle screen, union-mass polish, assumption bounds” · `main` in sync with `origin/main`, working tree clean (0 modified).
**Date:** 2026-10-29 23:45 Europe/Istanbul (UTC+3)
**Scope (delta, per request):** correctness/disclosure of the brittle/elongation marginal and assumption bounds (not overclaimed), printed-process gate (blocks without AI), union-polish accept/decline logic, validation count consistency, repo/remote hygiene (keys/secrets), docs/PDF stale-number risk, and any new overstatement.
**Read-only:** no code/docs edited. I re-ran `make validate` while auditing (it regenerates `validation/results.json` + `VALIDATION.md` by design) and then restored both to the committed `da0c198` state — working tree is clean at the commit.

---

## 0. Verdict

# SHIP WITH FIXES

**No blockers, no majors.** The v0.4 changes are implemented correctly and independently corroborated: the printed-process gate works at engine, API and UI level without invoking AI; the brittle marginal math matches an independent SciPy implementation to ~1e-17 and is explicitly excluded from the headline P_f; the assumption bounds reproduce independently; the union polish is recorded and correctly declined on the shipped design; validation is a genuine 58 checks / 56 PASS / 2 WARN / 0 FAIL; all suites are green; the repo has no key/secrets tracked or in history; docs/PDFs carry the v0.4 material with the headline masses unchanged.
**Three MINOR documentation/claim hardenings and three NITs are worth a quick pass** — none of them blocks submission: stale test counts in README/HACKATHON (user-facing), the “conservative add-on bound” wording for the brittle screen (stricter than the math justifies), and a latent 2 % P_f tolerance in the union-polish/multi-start acceptance gate that conflicts with the stated “P_f ≤ target” claim.

| Severity | Count | Items |
|---|---|---|
| BLOCKER | 0 | — |
| MAJOR | 0 | — |
| MINOR | 3 | M1 stale test counts in docs; M2 “conservative add-on bound” overstates the brittle marginal’s rigor (mean-E strain demand; wrong two-level split for elongation); M3 union-polish/multi-start acceptance allows P_f up to 1.02× target while contract/report say “P_f ≤ target”/“target met” |
| NIT | 3 | N1 flagship report HTML omits the union-polish (declined) disclosure; N2 assumption-bound upper 1.20 % exceeds the 1 % target but the report doesn’t say “target met only under the default split”; N3 stale “v0.3 AI helpers” label in app README |

---

## 1. Requested checks — results

### 1.1 Printed-process gate (blocks without AI) — **PASS**
- **Engine:** `Material.print_process_ok` true only for FDM/FFF (`engine/anyrb/materials.py:73`); `family_feasibility` returns `{feasible:False, process_ok:False, reason:"process_mismatch", min_achievable_pf:None}` for moulded data (`optimize.py:408-430`). Independent probe: `rPETG (FDM/FFF) ok/feasible=True/True`; **rPET (IM), rHDPE (IM/compression), rPP (IM) all process_ok=False, feasible=False, reason=process_mismatch** — exactly as claimed.
- **App:** `renderFeasibility()` disables `#btn-design` and shows the “CONTRAST ONLY” label for non-printed presets (`app/ui.js:346,1265-1292`); `runDesignFlow()` **returns before any AI call** when `process_ok === false` or infeasible (`app/ui.js:437-446`) — the brief parse and `/api/design/plan` are never invoked. App test `v0.4 printed-process gate blocks moulded-data presets` covers the gate (37 JS tests pass).
- **Server:** `/api/design/plan` independently short-circuits with `blocked=true`, `_meta` `process_mismatch` and a note, without calling Muse Spark (`server/app.py:476-489`, `server/contract_v04.py`) — stronger than required.
- rPETG default is FDM/printed; presets remain visible only as contrast data, labelled.

### 1.2 Elongation / brittle-lot screen — **PASS on the maths, MINOR on the wording (M2)**
- Engine: `strain_req = σ_req / E_mean` (`mechanics.py:211`); `pf_brittle` is a marginal lognormal P(elongation-at-break < strain demand) at the chosen level (`reliability.py:108-125`); `pf_brittle_bound = pf + pf_brittle`; returned with `brittle_ok` and explicit `brittle_included_in_headline=False`-style disclosure in app/report. Material elongation means/CVs match `data/feedstock_library.json` (rPETG 4.0 %/0.20, rPET 3.5/0.25, rHDPE 14/0.30, rPP 25/0.45); known lots add measurement CV in quadrature (12 % → elongation CV 0.1428, validation K5).
- **Independent check:** strain_req 0.008955 (0.8955 %); engine pf_brittle 2.7756e-16 vs independent SciPy lognormal 2.8977e-16 (abs err 1.2e-17); headline pf unchanged at 0.009956; add-on bound = 0.009956. Validation K5 (PASS) does the same check to 5.6e-16.
- **The claim is not overclaimed in scope** (app badge “marginal screen · NOT in headline P_f”; report “Not included in the headline P_f because E–elongation correlation is assumed (-0.25)”) — but see M2: calling it a “**conservative** add-on bound” is stronger than the implementation supports because the marginal uses mean-E strain demand and the elongation two-level split is inherited from E/σy.

### 1.3 Assumption bounds — **PASS (computed correctly, labelled as assumptions)**
- `assumption_bounds` varies corr(lnE,lnσy) 0.30/0.70 and lot-variance fraction 75 %/95 % (with `within = sqrt(1−frac²)`), reporting the P_f range (`reliability.py:128-147`). Independent SciPy reproduction: max error **3.1e-17**; corr range insensitive (0.009956/0.009956 — stiffness-governed design), split range **0.001996 → 0.012010**; `pf_min/pf_max` 0.001996/0.012010. Matches validation K7 (PASS).
- Labels: report HTML “These are assumptions, not validated population values”; app badge “assumption sensitivity · not validation”; V0_4_SPEC §4. Not overclaimed. N2 notes a completeness improvement only (upper bound 1.20 % > 1 % target; see §3).

### 1.4 Union-mass final polish — **PASS (decline logic); MINOR on acceptance tolerance (M3)**
- Global multi-start still ranks with the analytic upper bound; final selection among start solutions uses printed mass (`optimize.py:230-270`). A short local pattern search (`_union_polish`, `optimize.py:379-405`, max 90 evals) minimises the **10k-sample Halton printed mass** subject to P_f + printability; acceptance requires the final **60k** printed mass to improve by >0.1 % (`improved = … < before*0.999`) and pf/printability constraints. `DesignResult.union_polished/union_evals` exposed; app mirrors this with `acceptFactor` (`app/optimize.js:385-425`).
- Reference design: pre-polish printed **46.400 g → final 46.400 g**, `union_polished=False`, `union_evals=0` — correctly **declined** (validation K6 PASS: runtime 4.9 s, 60k-vs-independent-union +0.01 %, mode=declined). Docs correctly describe this as a stage that only accepts genuine improvements; no mass-improvement overclaim.
- **M3:** both the multi-start filter (`optimize.py:249`: `if r["pf"] > target_pf*1.02: continue`) and polish acceptance (`optimize.py:262`: `r2["pf"] <= target_pf*1.02`; app `app/optimize.js` `afterPf <= targetPf*1.02`) permit up to **2 % above the target**, while the contract/README/report state “P_f ≤ target” and REPORT:186 says “target met”. Not triggered in the shipped build (polish declined; final pf 0.9956 % < 1 %), so no published number is wrong — latent only.

### 1.5 Validation counts and consistency — **PASS**
Committed `da0c198:validation/results.json` = `{'total':58,'PASS':56,'WARN':2,'FAIL':0}`; `VALIDATION.md` is the v0.4 report; new K4–K8 checks PASS (process gate, brittle marginal, union polish, assumption bounds, report/app disclosure); F4/F5 are the expected two WARNs (analytic upper bound; Halton 0.35 % at w=1 mm vs 0.3 % target). Fresh `make validate`: **56 PASS / 2 WARN / 0 FAIL (58 checks, exit 0, 58.3 s)**. Docs all state 56 PASS / 2 WARN / 0 FAIL (README:27,65,95; HACKATHON:112; REPORT:220; app README:59/138/254; report HTML verification section). WARN disclosure is present and quantified in report HTML, README, HACKATHON, REPORT, VALIDATION.md and the app; not hidden. **Test suites:** `make test` **33/33 OK** (54.6 s), `node app/tests/run.mjs` **37/37 passed**, `make test-server` **51 passed, 1 skipped** — all green.

### 1.6 Repo hygiene / keys & secrets — **PASS**
- `git status` clean at `da0c198`; `main...origin/main` in sync; remote `https://github.com/bnelabs/AnyRB.git`.
- No `.env`, cache, provenance, `.pytest_cache` or `__pycache__` files tracked (`git ls-files` clean); `git grep` for `LLM_…`/key patterns across **all revisions** = **0 hits**. `.env` exists only locally on disk (untracked, `.gitignore`d) and `server/.env.example` holds the placeholder `LLM_your_key_here`; neither appears in the commit or history. (Same operational note as before: if this working tree is ever zipped/shared, exclude the ignored runtime files.)
- Commit `da0c198` contains the v0.4 validation artifacts, report HTML, three rebuilt PDFs, updated docs, rebuilt `index.html`/`app/standalone.html`, and the new v0.4 screenshots (`demo/screenshots/v4/03-design-brittle.png`, `04-process-gate.png`, `06-assumptions.png`).

### 1.7 Docs / PDFs — **PASS with MINOR stale counts (M1)**
- No stale v0.3 validation claims found: “53 checks”, “51 PASS”, “33 JS”, “40 tests”, old mass 55.3/46.0/50.9 are absent from README/HACKATHON/REPORT/report HTML (the old 25 %/40.5 g appears only in its explicit “retired/void” context). Mass numbers unchanged and correct: analytic 50.809 g / printed 46.400 g / +9.50 %, robust pf 0.9956 %, report/report-HTML tables consistent.
- PDFs rebuilt 23:06–23:08, after the doc/report updates (REPORT 23:04, report HTML 23:05) — page counts 21/43/9 (Research Synthesis / Full Dossier / Qualification), all regenerated from current sources (`demo/build_pdf.py` reads `REPORT.md` and the report HTML). No stale-number PDF risk found; the v0.4 addendum line (REPORT:281) is in the source of the rebuilt dossier.
- **M1:** user-facing test counts are stale: `README.md:62` “29 engine tests” and `README.md:120` “29 tests” (actual **33**); `HACKATHON.md:88` “engine, 29” and “`node app/tests/run.mjs` (UI/engine, **22**)” (actual **33 engine / 37 JS**). Counts in app README/validation docs are correct. Fix the two README lines and the HACKATHON test line.

### 1.8 Overstatement scan — no new overclaims beyond M2/M3
Docs use “partial/roadmap/assumed/not validation/not in headline P_f” consistently; the process gate, brittle screen, bounds and polish are scoped and disclosed; no certification, “validated”, or “guaranteed” language in the new material; the claim ladder remains L0–L1 verified / L2 partial / L3 pre-registered / L4–L6 absent. The only wording raised in §3.

---

## 2. Additional independent evidence (v0.4)

- Independent `assumption_bounds` replication: corr 0.30/0.70 → 0.009956/0.009956; split 75/95 % → 0.001996/0.012010; engine vs SciPy max err 3.1e-17.
- Independent brittle marginal: engine 2.7755575615628914e-16 vs SciPy lognormal 2.8977e-16 (1.2e-17); headline pf 0.009956 unchanged; `pf_brittle_bound == pf + pf_brittle`.
- Process gate probes (above). Union polish reference: `union_polished=False`, `union_evals=0`, printed 46.400 g.
- Built app (`index.html` 454,445 B, built 23:07 from sources 23:06): **0** key-pattern strings, **0** external resource URLs (`src`), v0.4 strings present (brittle/assumption/process/contrast-only); app 37/37 tests.
- Report HTML discloses: validation 56/2/0 of 58, both WARNs, brittle screen (not in headline), assumption-bounds range 0.20–1.20 %, process compatibility, lot record/no delivered lot; see N1 for the missing polish line.
- QC/lot record: app export carries lot ID/supplier/measurement source+CV/recycled-content paperwork; report states no delivered lot was supplied and points to the export (validation K8 PASS; engine report `report.py:527`; app fields in `ui.js`).

---

## 3. Findings (detail)

### MINOR

**M1 — Stale test counts in user-facing docs.**
`README.md:62` (“29 engine tests (~20 s)”) and `README.md:120` (“canonical Python engine + 29 tests + fixtures”); `HACKATHON.md:88` (“`make test` (engine, 29) … `node app/tests/run.mjs` (UI/engine, 22)”). Actual suite counts against `da0c198`: **engine 33** (`make test` → Ran 33 tests OK), **JS 37** (`node app/tests/run.mjs` → 37 passed). The app README says 37 but labels them “v0.3 AI helpers” (N3). **Fix:** update to 33/37 (and engine ~55 s, not ~20 s).

**M2 — “Conservative add-on bound” for the brittle screen is stronger wording than the implementation supports.**
`pf_brittle` is evaluated at the **mean-E** strain demand (`mechanics.py:211` `strain_req = d.sigma_req / mat.E_mean`; app `engine.js:1076`), so it does not integrate over lot-to-lot E variation in the strain demand; and the two-level level factor for elongation reuses the **E/σy** lot fraction (`reliability.py:119-121` uses `mat.lot_fraction`; known-lot path uses `within_fraction`) whereas the feedstock library assigns elongation its own split (`data/feedstock_library.json` rPETG elongation `lot_variance_fraction: 0.5`) and `research/01` recommends 60/40 for elongation. Consequently `pf + pf_brittle` is an add-on estimate, not a rigorous conservative upper bound on the true three-property joint failure probability (the docs do disclose the assumed E–elongation correlation and that it is excluded from headline P_f — good). App/engine also hard-code the brittle-screen threshold at 1 % (`mechanics.py:243`, `engine.js:1086`) rather than the user's target. Practical impact on the shipped design is nil (pf_brittle 2.8e-16; bound 1.00 %), but the phrase is used in README/HACKATHON/report/app. **Fix:** relabel “add-on estimate (not a formal upper bound; strain demand at mean E; E–elongation correlation assumed)”, use the elongation-specific two-level split (library 50/50 or research 60/40), and state the screen threshold is a fixed 1 % advisory (or pass the target through).

**M3 — Union-polish / multi-start acceptance allows up to 1.02× the reliability target.**
`engine/anyrb/optimize.py:249` (`if r["pf"] > target_pf * 1.02: continue`) and `:262` (`r2["pf"] <= target_pf * 1.02`), mirrored in `app/optimize.js` (`afterPf <= targetPf * 1.02`). The contract/README state “mass minimisation subject to P_f ≤ target” (`README.md:92`) and REPORT:186 says “target met” for the shipped design. A selected/polished design with P_f up to 1.02 % could therefore be reported under a 1 % target. **Not triggered by the shipped build** (polish declined, final pf 0.9956 %; validation K6 only exercises the decline path), so all published numbers are correct — but the tolerance contradicts the stated constraint. **Fix:** use `pf <= target_pf` (no slack) in both places, or document the 2 % acceptance tolerance and always print the achieved P_f vs target.

### NIT

**N1 — Qualification report omits the union-polish stage/decline.**
`reports/qualification_report.html` documents the printed-mass basis, brittle screen, assumption bounds, process compatibility and lot record, but never mentions the v0.4 union-polish stage or that it was declined (grep for “polish” = 0). README/HACKATHON/REPORT and app export carry `union_polished/union_evals` (reference: declined, 0 evals), and validation K8 records only `html_ok=True` without this item. **Fix:** one line in the report’s mass-basis/verification section (“final mass is selected on the printed union; v0.4 polish was declined on this design (0 evals; no improvement)”) and regenerate.

**N2 — Assumption-bound upper value exceeds the target but the report doesn’t connect the two.**
Report/HTML show “lot-vs-within split 75–95 % moves P_f from 0.20 % to 1.20 %” and correctly call it assumption sensitivity, but a reader comparing 1.20 % with the 1 % target may wonder whether the design still meets target at the upper assumption. One clause (“the 1 % target is met under the project’s default 85/15 split; under a 95 %-lot assumption the P_f bound is 1.20 %”) would close this without changing any number.

**N3 — Stale label in app README.**
`app/README.md:34` says “37 tests: … v0.3 AI helpers” — count right, label stale; update to v0.4 (and align with M1).

---

## 4. Bottom line

**SHIP WITH FIXES — no blockers.** The v0.4 delta is real, correctly implemented and honestly scoped: process gate (engine + API + UI, no AI call on incompatible material), brittle marginal and assumption bounds independently reproduced, union-polish stage correctly recorded/declined, validation a genuine 58 checks/56 PASS/2 WARN/0 FAIL, all suites green (33/37/51+1), repo has no secrets and is clean at `da0c198`, PDFs/report rebuilt with no stale v0.3 numbers, and the headline masses/claims are unchanged and correct. The three MINOR items are a 10-minute doc/claim hardening (test counts; brittle “conservative” wording + elongation split; polish acceptance slack); the NITs are report/README completeness. After those, this is a clean SHIP.

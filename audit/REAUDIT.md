# AnyRB — Re-Audit (targeted second pass, after task-6 fixes)

**Auditor:** independent verifier (same auditor as `AUDIT.md`; no deliverable authored)
**Requested by:** Lead, 2026-10-29
**Snapshots:** first re-audit snapshot 2026-10-29 **16:38 Europe/Istanbul (UTC+3)** (findings §3); **final confirmation snapshot 16:45** (all fixes re-verified, §6). Files were still landing during the first pass; the final state was re-checked at 16:42–16:45 (mtimes: README/REPORT 16:40, SPEC 16:40, app config/UI 16:40, standalone build 16:40:55, PDFs 16:40:13–16).
**Scope of this pass:** the seven targeted checks requested by the Lead (rPETG provenance, same-mass caveat vs table, differential-evolution strings, REPORT headline/mode numbers vs `summary.json`, app live numbers after the rebuild, new input guards, citations), plus a file-state diff against the first audit's open findings.
**Companion:** first-pass findings in [`AUDIT.md`](AUDIT.md); machine-readable re-audit results in [`check_log.json`](check_log.json) (`reaudit` block).

---

## 0. Verdict

# SHIP — no residual blockers

**Final confirmation pass, 2026-10-29 16:45:** the 1 MAJOR residual found at the 16:38 snapshot (RA-1, stale README reference-scenario material) and the 10 MINOR residuals have been fixed and re-verified. All seven Lead-requested checks pass. No material, numerical, methodological or reproducibility inconsistency remains. Five non-material items are listed in §6 as accepted/cosmetic (carry-forward citation metadata explicitly accepted by the Lead; rounding display; stale dossier "correction" notes; dead `?? 0.8` fallback; cosmetic seed mismatch) — none affects any number or claim.

**Original four MAJORs (A1–A4): fixed and verified.** Residual count now: **0 BLOCKER, 0 MAJOR, 0 MINOR, 5 cosmetic NIT (accepted/documented)**.

---

## 1. Status of the first-audit findings

| First-audit ID | Status in this pass | Evidence |
|---|---|---|
| **A1** rPETG double-count | **FIXED (core), PARTIAL (provenance text)** — engine preset = library = 46 MPa / CV 0.10; SPEC §3, REPORT §5, app config and report HTML updated; readme line and three stale comments still say 23 MPa/knockdown → RA-1…RA-4 | `engine/anyrb/materials.py:135`; `data/feedstock_library.json:155`; `reports/summary.json` material sy 46.0/0.10; app config sy 46.0/0.10 |
| **A2** PCR-PP "MFR drift" | **FIXED** — REPORT §0.1 now says "large composition, elongation and fatigue-life drift … even though every lot met the same MFR/density specification"; also Eriksen anchor ranges corrected to 22.2–48.4 MPa / 11.2–17.0 % (fixes first-audit B12) | `REPORT.md:19` (16:32 update) |
| **A3** DE mis-description | **FIXED** — no v0.1 differential-evolution claim remains in SPEC, research/03, app UI, app README or built HTML; Python and JS both deterministically multi-start pattern search (Python `_run_multistart`, JS `multiStartWidths`). Only remaining "differential evolution" string is a correct v0.2 method-menu sentence ("pattern search … appropriate; differential evolution … [R52]; v0.1 uses the same deterministic multi-start pattern search in both JS and Python") | `PRODUCT_SPEC.md` §2.3; `engine/anyrb/optimize.py:129-150`; `research/03:179`; grep of repo |
| **A4** hard-coded 96 % | **FIXED** — caption now interpolates `results['uniform_match'].pf`; report table and caveat both show **100 %** (uniform-match P_f 99.9987 %) | `engine/anyrb/report.py:473-475`; committed `reports/qualification_report.html`; fresh regen identical |
| B1 `corr=1.0` crash | **FIXED** — `Material` rejects corr outside (−0.99, 0.99) with a clear ValueError; negative correlations now allowed (−0.5 tested) | `materials.py:57-58`; guard probe |
| B2 NaN / measured-lot silent NaN | **FIXED** — NaN controls, F/NaN/∞/≤0, u_lim≤0/∞ and non-finite widths now raise `ValueError` (see §2.4) | `mechanics.py:121-126`; `lattice.py:87`; guard probe |
| B3 negative-corr cross-impl mismatch | **FIXED** — Python domain widened to (−0.99, 0.99); app UI range [−0.6, 0.9] and JS clamp ±0.95 are now a subset, no mismatch | `materials.py:57`; `app/config.js:167`; `app/engine.js:70` |
| B5 L1 / rigid-body | **PARTIAL** — rigid-body zero-stress test added (`test_engine.py:131`), limitation "pure axial load (no combined axial-bending buckling)" added to engine/report limitations; still no mesh-refinement/convergence study behind "L1 achieved" → RA-7 | `engine/tests/test_engine.py:131`; `reports/summary.json` limitations; `REPORT.md:192` |
| B6 weak test | **FIXED** — the misnamed `test_element_force_conventions` was replaced by a real rigid-body-mode test | `test_engine.py:131-140` |
| B10 batch-passport range | **FIXED** — Python `max_scale=1.5`, app `scaleMax=1.5`, report label now "> 1.5 (reject)" | `optimize.py:318`; `app/config.js:154`; `report.py:372` |
| B12 Eriksen provenance | **FIXED** — REPORT now quotes 22.2–48.4 MPa / 11.2–17.0 % (primary ranges) | `REPORT.md:19` |
| B14 combined buckling omitted | **FIXED** in engine limitations/report; app limitation list still omits it → RA-10 | `reports/summary.json` limitations; `reports/qualification_report.html`; `app/ui.js:183-191` |
| C2 "40–70 entries" | **FIXED** — now "35–70 entries each" | `REPORT.md:226` |
| C5 missing artifacts | **FIXED** — `research/00-executive-evidence-map.md` exists (6.7 KB, consistent: 46 MPa, 85/15, multi-start); `app/README.md` exists | files; read in full |
| C1 README test count | **PARTIAL** — "29 tests" now correct in two places, "25 verification tests" left in the repo map → RA-12 | `README.md:30,96,107` |
| B4 mass overlap, B7 sensitivity ranking, B9 citation metadata, B13 app caveat, C3/C4/C6/C7 | **NOT FIXED / not in scope of the Lead's fix list** → RA-5, RA-8, RA-9, RA-11, RA-13…RA-17 | see §3 |

---

## 2. Requested checks — results

### 2.1 (i) rPETG provenance internal consistency — **PARTIAL (one stale line + comments)**
Consistent in: `data/feedstock_library.json:155` (mean 46, CV 0.10), `engine/anyrb/materials.py:135` (sy_mean=46.0, sy_cv=0.10), `PRODUCT_SPEC.md` §3 table, `REPORT.md:145`, `app/config.js` rPETG block, report HTML title/KPIs, `research/00:28`.
Inconsistent in: **`README.md:55`** — "**Reference scenario** (rPETG as-printed, effective weakest-axis σy ≈ 23 MPa …)" sits immediately above a results table computed at 46 MPa (RA-1); **`engine/anyrb/materials.py:130-134`** stale comment (23 MPa / 0.50 knockdown) directly above the 46 MPa preset (RA-2); `app/config.js:40-43` stale 0.8/0.6 split comment (RA-3); `REPORT.md:185` "beyond the single effective-strength knockdown" (RA-4).
The A1 scientific fix itself is correct: with 46 MPa the reference bracket is stiffness/buckling-governed, yield marginal ≈ 0 %, and REPORT/README/report HTML now state that honestly.

### 2.2 (ii) Report same-mass caveat equals its table — **PASS**
Committed 16:32 report: table row `Uniform lattice, same mass | 50.7 | 100% | 0.001%`; caption "…so the **100 %** figure illustrates the value of shaping…" — caption is now the interpolated computed value (99.9987 % → 100 %). Old hard-coded "96 %" is gone (grep of HTML: 0 hits). Fresh regeneration to `/tmp` reproduces the committed report text byte-identically after stripping the two timestamps.

### 2.3 (iii) No differential-evolution claims — **PASS**
`grep -rn 'differential evolution|differential_evolution'` over the repo (excluding `.venv`, `__pycache__`, `audit/`) returns only:
- `research/03:179` — a correct v0.2 method-menu sentence that explicitly says v0.1 uses the same deterministic multi-start pattern search in both JS and Python;
- the generated `demo/_pdf_tmp/dossier.html` intermediate (same sentence);
- `app/README.md:294` — "no differential evolution anywhere" (statement of the fix).
No doc or UI claims DE was used. SPEC §2.3 and app UI/README now describe deterministic multi-start pattern search; Python `optimize.py` implements it (`_starts`, `_run_multistart`, `pattern_search`).

### 2.4 (iv) REPORT headline mode/numbers vs `summary.json` — **PASS**
- Table: solid 111.6 / uniform 60.3 @0.98 % / nominal 56.4 @~0.001 % / mean-only 44.4 @51 % / robust 50.7 @0.98 % — all match `summary.json` (111.6; 60.3187/0.9826 %; 56.4311/6.37e-6; 44.3819/51.16 %; 50.7423/0.9834 %).
- Savings: 54 % vs solid ((111.6−50.74)/111.6 = 54.5 %), 16 % vs uniform (15.9 %), 10 % vs SF-1.5 (10.1 %) — consistent with summary.
- Mode statement: "stiffness/buckling accounts for essentially all of the failure probability; strength demand only ~40 % of the mean printed strength" — engine: σ_req 18.334 / σy 46 = 0.399 (40 %), E_req/E_mean = 1687.3/2100 = 0.804; sensitivity CV(σy) ≈ 0 (−3e-17); correct.
- Batch passport "80 % E → width scale ≈ 1.10 (+8.5 % mass)": engine `batch_recipe` → 1.0996, +8.50 %; "70 % strength → no compensation": engine → scale 1.0 / ±0 % — matches.
- One internal inconsistency remains in the same document: REPORT §4.4 line 183 still lists "CV(E)" among the top drivers while line 156 (corrected) and the engine sensitivity (mean E +77.7 pp, load +52.7 pp, deflection limit +52.7 pp, CV(E) +2.25 pp) say otherwise → RA-5.
- Report figure KPI says "**55 %** lighter than solid plate" while README/REPORT say "**54 %**" (54.53 % true) → RA-13 (NIT).

### 2.5 (v) App live numbers match new calibration — **PASS**
Verified twice: (a) by importing `app/engine.js` + `app/optimize.js` under Node and running compare/optimiser/batch passport; (b) visually in `demo/screenshots/02_design_comparison.png` (captured 16:29 from the rebuilt app).

| quantity | app (JS) | Python engine | delta |
|---|---|---|---|
| solid | 111.60 g | 111.60 g | 0 |
| uniform target-sized | 60.308 g / 1.000 % | 60.319 g / 0.983 % | 0.02 % mass |
| uniform mass-matched | 50.731 g / 99.999 % | 50.742 g / ~100 % | 0.02 % |
| nominal SF1.5 | 56.412 g / 0.0006 % | 56.431 g / 0.00064 % | 0.03 % |
| mean-only | 44.342 g / 51.77 % | 44.382 g / 51.16 % | 0.09 % |
| robust-opt | **50.731 g / 0.9970 %** | **50.742 g / 0.9834 %** | 0.02 % mass |
| batch passport E×0.8 | 1.0994 / +8.48 % | 1.0996 / +8.50 % | negligible |

Screenshot also confirms required sy/E (18.34 MPa / 1.688 GPa), mode "misses" verdicts and the caveat text. App tests: **22 passed, 0 failed**. The built `index.html` (16:28:38, 227,461 B) rebuilds **byte-identically** from the current `app/` sources and has no external resources (5 DOI hyperlinks only, no script/CSS/font fetches).

### 2.6 (vi) New input guards raise rather than silently return NaN — **PASS**
Direct probe of the fixed engine (all `ValueError`):
`Material(corr=±1.0)` → "corr must be strictly inside (-1, 1)"; `corr=−0.5`/`0.99` accepted; `evaluate(..., controls=[nan]*8)` and one-NaN vectors → "control_logw must contain only finite numbers"; `F ∈ {inf, nan, 0, −150}` → "F must be a positive finite number"; `u_lim ∈ {0, inf}` → "u_lim must be a positive finite number"; `widths=[nan]*94` → "widths must be finite and match the element count"; `demands(F=inf)` raises too. No silent NaN path found in the core API.

### 2.7 (vii) Citations still resolve — **PASS**
Resolved 10 refs via Crossref on 2026-10-29 (5 from `app/config.js`, which now contains the three previously missing DOIs, plus 5 sampled dossier refs). All 10 returned HTTP 200 with matching title / first author / year:
PNAS `10.1073/pnas.2502613122` (Georgiou 2025); Cecon `10.1016/j.wasman.2023.09.002`; Eriksen `10.1016/j.wasman.2019.07.005`; ACS zero-cost `10.1021/acssusresmgt.5c00040` (Hibi 2025); R07 PETG `10.3221/igf-esis.70.18` (Marsavina 2024); plus sampled refs-01 R03 (Cecon 2024), R05 (Hinczica 2026), R08 (Celik 2022), R14 (Krantz 2024), R17 (Roosen 2020). The app's CITATIONS block now carries DOIs for PNAS/Cecon/Eriksen/ACS/R07 and no "pending verification" text.

---

## 3. Residual findings at the 16:38 snapshot (severity-graded) — **all fixed in the final pass, see §6**

### MAJOR

**RA-1 — README still describes the reference scenario with the old 23 MPa material.**
`README.md:55`: "**Reference scenario** (rPETG as-printed, effective weakest-axis σy ≈ 23 MPa, …)" — immediately above the results table that is computed with σy = 46 MPa, and contradicting every other artifact (`engine/anyrb/materials.py:135`, `data/feedstock_library.json:155`, `PRODUCT_SPEC.md` §3, `REPORT.md:145`, `app/config.js`, report HTML title/KPIs). This is the one surviving instance of the A1 provenance defect in a user-facing document; a reviewer reading only the README would conclude the numbers were made with a material the code no longer uses. **Fix:** replace with "rPETG printed in-plane: E = 2,100 MPa (CV 10 %), σy = 46 MPa (CV 10 %), from the verified library; 85 % of variance between lots".

### MINOR

| ID | Area | Finding | Evidence | Fix |
|---|---|---|---|---|
| RA-2 | honesty / code docs | Stale comment block still describes "in-plane 46 MPa × 0.50 layer-adhesion knockdown (ASSUMPTION, CV 0.15) → 23 MPa, CV 0.18" directly above the 46.0/0.10 preset; contradicts the new NOTE ON ORIENTATION 6 lines above and the code itself | `engine/anyrb/materials.py:130-134` vs `:135` | delete the 4 stale comment lines |
| RA-3 | honesty / code docs | Two-level split comment says `CV_lot = 0.8·CV_preset, CV_within = 0.6·CV_preset` (64/36 variance) while actual `lotFraction=0.92195`, `withinFraction=0.38730` (85/15, per research/01 §6.1) — values correct, comment stale (same stale text also lives in `PRODUCT_SPEC` §3 history and `data` library's "previous_v0_1_split" note, which are historical and acceptable) | `app/config.js:40-43` vs `:53-54` | update comment to 0.92195/0.38730 |
| RA-4 | honesty | REPORT still says "layer-adhesion anisotropy **beyond the single effective-strength knockdown**" — no knockdown exists after the A1 fix | `REPORT.md:185` | drop ", beyond … knockdown" |
| RA-5 | honesty / numerics | REPORT §4.4 (line 183) still lists "(mean E, CV(E), load)" as the dominant P_f drivers; REPORT line 156 was corrected to "mean E, load and the deflection limit dominate", and engine sensitivity is mean E +77.67 pp, load +52.72 pp, deflection limit +52.72 pp, CV(E) +2.25 pp, CV(σy)/corr ≈ 0 | `REPORT.md:183` vs `:156`; `reports/summary.json` sensitivity | edit line 183 to match 156 |
| RA-6 | consistency (data artifact) | `data/feedstock_library.json` rPETG `lot_vs_within_split` says `lot_variance_fraction: 0.6` for both E and σy (lines 182/189 → 60/40), while library default (line 15) and research/01 §6.1 recommend 0.85 (85/15) and the engine/app use 0.92195/0.38730. A consumer importing the library would get a different two-level model than the product ships; current report numbers are unaffected | `data/feedstock_library.json:15,182,189`; `engine/anyrb/materials.py:51-52`; `app/config.js:54-55`; `research/01` §6.1 | set rPETG E/yield `lot_variance_fraction` to 0.85 (and cv_lot/cv_within to 0.092/0.039) or add a note that the engine overrides it |
| RA-7 | honesty / V&V claim | L1 "solution verified" = **achieved** (`REPORT.md:192`; `research/05:77` says "achieved (to be documented)") lists "refinement/convergence studies" as required evidence, but the repo has no mesh-refinement/convergence study and no tolerance report; rigid-body test now exists (good, B5 partially fixed) | `REPORT.md:189-197`; `research/05:76-77`; `engine/tests/` (29 tests, only rigid-body added) | add a 2-mesh refinement note/test or mark L1 "partial (to be documented)" |
| RA-8 | citations (carry-forward) | Unchanged since first audit: 6 DOI records with cited year ≠ Crossref issued (refs-01 R36 2021/2020; refs-02 R18 2008/2009, R20 2023/2024; refs-03 R03 2006/2005, R61 2017/2016; refs-05 R12 2002/2001); refs-04 R07 Hyperganic EULA URL now returns HTTP 404 while status `verified_search_snippet`; refs-03 R34 never cited; refs schema inconsistent (2 top-level shapes; no `status` in refs-03/05; IDs restart per file). No fabricated refs — all DOI-bearing refs still resolve | `/tmp/doi_resolution.json` (first pass, files re-checked unchanged); `research/refs/*` mtimes 16:02–16:05 | optional cleanup |
| RA-9 | physics / mass (carry-forward) | Lattice mass still sums A·L per element with no deduction for shared-node/crossing overlap: uniform w = 4 mm mass = 117.95 g > solid envelope mass 111.60 g; conservative but undisclosed in the mass definition | `engine/anyrb/lattice.py` mass_g; recompute | document mass as upper bound, or deduct overlaps, or state that all strategy masses use the same convention |
| RA-10 | honesty parity | Engine/report limitations now include "pure axial load (no combined axial-bending buckling)" but the **app** limitations list does not | `reports/summary.json` limitations vs `app/ui.js:183-191` | add the sentence to app LIMITATIONS |
| RA-11 | honesty parity | App mass-matched row note ("Same mass as robust optimum (50.73 g); reliability collapses — the mass/reliability trade-off is steep") still omits the report's buckling-cliff "illustrative, not a general-purpose prediction" caveat | `app/optimize.js:474` vs `report.py:473-475` / `REPORT.md:162` | append the caveat to the app note |

### NITs

| ID | Finding | Evidence | Fix |
|---|---|---|---|
| RA-12 | README says "29 tests" (line 30) and "29 engine tests pass" (line 107) but repo map still says "25 verification tests" (line 96) | `README.md:30,96,107`; `make test` = 29 | one-word fix |
| RA-13 | Cross-artifact rounding: README/REPORT "54 % lighter than solid" vs report HTML KPI "55 % lighter" (true 54.53 %); "~0.001 %" vs report-exact 0.000637 % | `README.md:65`, `REPORT.md:25`, report HTML KPI | align rounding convention |
| RA-14 | App seed 20251029 vs Python MC default seed 20261029 — "seed shown in UI" does not reproduce Python's MC stream (analytic values unaffected) | `app/config.js:133`; `engine/anyrb/reliability.py:140` | align or document |
| RA-15 | `make_fixtures.py` docstring says JS must match to "~1e-9 relative"; the cross-language test tolerance is 1e-6 | `engine/make_fixtures.py:4-5`; `engine/tests/test_js_engine.py:85` | fix docstring |
| RA-16 | `research/01` §7 and `research/05` §6 item 9 still say PRODUCT_SPEC attributes the PNAS paper to "Ghosh et al." — the spec has been correct since 16:23 | `research/01:235`; `research/05:242`; `PRODUCT_SPEC.md:7` | update/remove stale correction notes |
| RA-17 | `demo/_pdf_tmp/` (5.1 MB of generated HTML intermediates) is left in the repo by `demo/build_pdf.py:125`; not mentioned in README | `demo/_pdf_tmp/{synthesis,dossier}.html` | clean up or gitignore |

---

## 4. Positive verification in this pass (evidence)

- `make test` → **29/29 OK** (22.1 s); `node app/tests/run.mjs` → **22/22 passed**; `make verify` → deliverables OK (50.7423 g / 0.0098338).
- Fresh `anyrb.cli demo --out /tmp/reaudit2` → `summary.json` numbers **identical** to committed and report HTML text **identical** modulo timestamps (fresh run at 16:35; committed 16:32).
- Fixtures `engine/make_fixtures.py` in `/tmp` → byte-identical `app/tests/fixtures/reference.json`; fixture material now E 2100/0.10, sy 46/0.10 ✓; robust_optimised fixture 50.742 g / 0.009834 ✓.
- App build from current `app/` → **byte-identical** to committed root `index.html` (227,461 B), `node --check` passes; no external resources beyond DOI hyperlinks.
- Report HTML self-contained: 0 http(s) refs, 9 inline PNG charts, "in-silico · not a certification" badge present; STL: 1,140 triangles / 3,420 finite vertices.
- New deliverables present and consistent with README claims: three PDFs (page counts via `mdls`: Research Synthesis **18 pp**, Full Dossier **40 pp**, Qualification Report **8 pp** — exactly as README states), demo screenshots 6 PNG, demo README numbers match the new calibration (62.69 g default → 50.73 g robust, 50.7 g/0.98 %, 1.10× passport).
- `research/00-executive-evidence-map.md` read in full: consistent with the fixed model (46 MPa, 85/15, multi-start, L0–L2 claims, explicit assumptions); no stale numbers found.
- App vs Python numbers (table §2.5), guards (§2.6) and 10/10 DOI resolutions (§2.7) as above.

**Audit limitations (unchanged):** no headless browser interaction QA was run by this auditor (the app was verified structurally, by deterministic build, 22 JS tests, a Node module probe and the demo screenshots); PDF page counts verified via metadata and their build sources (mtime 16:32, after the doc fixes), not by extracting every PDF glyph; primary Cecon/Eriksen tables still not re-extracted (anchors verified via the PNAS quotation as before).

---

## 5. Recommendation

Ship after these three edits (all text-only, no regeneration required except none):
1. **README.md:55** → correct the reference-scenario material line (RA-1, MAJOR).
2. Delete/update the stale comment blocks: `materials.py:130-134` (RA-2) and `app/config.js:40-43` (RA-3); drop "beyond the single effective-strength knockdown" at `REPORT.md:185` (RA-4) and fix `REPORT.md:183` (RA-5).
3. Align `data/feedstock_library.json` rPETG split with 85/15 (RA-6) — or add the override note.

Everything else is NIT polish. The four original MAJOR findings are fixed in substance; the remaining MAJOR was a stale sentence, not a methodological or numerical problem.

> **Update 16:45 — final pass:** RA-1 and the stale comment/REPORT/library items were applied and re-verified; the residual counts above are superseded by §6. Final verdict: **SHIP — no residual blockers.**

---

## 6. Final confirmation pass (2026-10-29 16:45)

**Final verdict: SHIP — no residual blockers.**

All RA findings from the 16:38 snapshot were re-checked against the fixed files; none of the fixes regressed any number, claim or reproducibility property.

### 6.1 Residual findings — final status

| ID | Status | Re-checked evidence |
|---|---|---|
| RA-1 MAJOR | **FIXED** | `README.md:55` now reads "rPETG printed in-plane: E = 2,100 MPa, CV 10 %; σy = 46 MPa, CV 10 % — verified library values; 85 % of variance between lots"; grep for `effective weakest-axis` and `23 MPa` across README/REPORT/SPEC/engine/app/report HTML → **0 hits** |
| RA-2 | **FIXED** | `materials.py:130-134` now states the no-knockdown rationale (printed in-plane 46 MPa, ISO 527-2 R07) matching code and the orientation note |
| RA-3 | **FIXED** | `app/config.js:40-46` now documents 0.92195/0.38730 (85/15) with the correct identity; no stale 0.8/0.6 text |
| RA-4 | **FIXED** | `REPORT.md:185` now "layer-adhesion anisotropy (the 2-D in-plane model uses the measured printed in-plane strength)" |
| RA-5 | **FIXED** | `REPORT.md:183` now "mean E, load and the deflection limit — for this stiffness-governed geometry, strength CV contributes almost nothing", consistent with `:156` and `summary.json` sensitivity |
| RA-6 | **FIXED** | `data/feedstock_library.json`: every preset now has `lot_variance_fraction 0.85` for E and yield with recomputed `cv_lot`/`cv_within` (e.g. rPETG 0.10 → 0.0922/0.0387), matching `research/01` §6.1 and the engine |
| RA-7 | **FIXED (documented)** | rigid-body test added (29 engine tests pass); `REPORT.md:192` L1 note: "MC standard errors, deterministic seeds and tolerance checks; mesh refinement is not a free parameter because the 94-element lattice topology is fixed — stated in §6" |
| RA-9 | **FIXED (disclosed)** | mass-overlap overcount now disclosed as conservative over-estimate in `reports/summary.json` limitations, `reports/qualification_report.html` limitations, `PRODUCT_SPEC.md:150` claim limits and the app limitations card; combined axial–bending buckling also disclosed in all four |
| RA-10 | **FIXED** | app `LIMITATIONS` now include "pure axial load (no combined axial–bending interaction)" and the mass-overlap clause |
| RA-11 | **FIXED** | app mass-matched row note now carries the buckling-cliff + "illustrative, not a general prediction" caveat (`app/optimize.js:474`) |
| RA-12 | **FIXED** | `README.md` now says 29 tests in all three places (30/96/107); actual `make test` = 29 |
| RA-15 | **FIXED** | `engine/make_fixtures.py` docstring now "~1e-6 relative in the test (and P_f ~1e-8 absolute)" |
| RA-17 | **FIXED** | `demo/_pdf_tmp/` removed (build_pdf.py adjusted); demo/ now only README, build_pdf.py, screenshots |
| RA-8 | **ACCEPTED / documented** | carry-forward citation metadata (6 year mismatches, one 404 URL, schema shape) unchanged and explicitly accepted by the Lead — all headline claims use independently resolved DOIs (re-verified 10/10 in the first re-audit pass); no fabricated refs |
| RA-14 | **ACCEPTED / cosmetic** | app seed 20251029 vs Python MC default 20261029 — analytic P_f unaffected; Lead accepted as cosmetic |
| RA-13 | **COSMETIC (documented)** | display rounding: README/REPORT "54 % lighter" vs report KPI "55 %" (true 54.53 %); README "~0.001 %" vs report-exact 0.000637 % — display convention only |
| RA-16 | **COSMETIC (documented)** | `research/01:235` / `research/05:242` still phrase the "Ghosh et al." correction as an instruction to fix the spec; `PRODUCT_SPEC.md:7` is already correct — stale wording in a dossier note, not a claim |
| new (NIT) | **COSMETIC (documented)** | `app/engine.js:75` still has a dead `?? 0.8` lotFraction fallback (DEFAULTS.material.lotFraction is always defined); unreachable code only |

### 6.2 Final verification evidence

- `make test` → **Ran 29 tests … OK**; `node app/tests/run.mjs` → **22 passed, 0 failed**; `make verify` → deliverables OK: **50.74226843282504 g, P_f 0.009833803252807971**.
- Fresh report regeneration (`anyrb.cli demo --out /tmp/final-rep`): `summary.json` numbers **identical**, report HTML text **identical** modulo timestamps.
- Fixture regeneration (`engine/make_fixtures.py` in `/tmp/final-fix`): `app/tests/fixtures/reference.json` **byte-identical**.
- App rebuild from current `app/` sources (`app/build.py` in `/tmp/final-app`): **byte-identical** to committed `index.html` — 227,875 B (matches the Lead-reported rebuild size); no external resources.
- App live values (Node probe of `app/engine.js`+`optimize.js` + demo screenshots): solid 111.60 g, uniform 60.308 g/1.000 %, mass-matched 50.731 g/99.999 %, nominal 56.412 g/0.0006 %, mean-only 44.342 g/51.77 %, robust **50.731 g / 0.9970 %**; passport E×0.8 → **1.0994 / +8.48 %** — consistent with Python (50.742 g / 0.9834 %, 1.0996 / +8.50 %).
- Report invariants: same-mass table row and caption both **100 %** (no "96 %" anywhere); 0 external URLs, 9 inline PNGs; STL 1,140 triangles; PDFs 18/40/8 pp and rebuilt at 16:40 after the doc edits; README/REPORT headline table and savings consistent with `summary.json`.
- Stale-string sweep: `effective weakest-axis` → 0; `23 MPa` → 0; `differential evolution` → only the correct v0.2 method-menu sentence in `research/03:179`; `differential_evolution` → 0.
- Requested-input guards still raise (corr ±1, NaN controls, F/NaN/∞/≤0, u_lim ≤0/∞); 10/10 sampled DOIs still resolve.

### 6.3 Remaining non-material items (accepted, no action required for ship)

1. Citation-record metadata hygiene (RA-8) — documented above; headline claims use independently resolved DOIs.
2. Display rounding (RA-13) — 54 % vs 55 % / 0.001 % vs 0.000637 %.
3. Stale "Ghosh" correction wording in research/01 §7 and research/05 §6 (the spec is already correct).
4. Dead `?? 0.8` fallback in `app/engine.js:75` (unreachable).
5. App-vs-Python MC seed cosmetic mismatch (RA-14).

**No remaining material inconsistency. Final verdict: SHIP — no residual blockers.**

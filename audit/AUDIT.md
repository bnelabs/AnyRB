# AnyRB — Independent Audit (v0.1)

**Auditor:** independent verifier (not an author of any deliverable)
**Date:** 2026-10-29, final snapshot **16:21 Europe/Istanbul (UTC+3)** — artifacts were landing during the audit; the final state was re-checked at 16:20–16:21 (report/STL/summary last regenerated 16:11; app sources 16:16–16:19; root `index.html` 16:19; app/README.md appeared 16:18).
**Scope:** citations, numerics, physics/statistics, software correctness, honesty/red-team, reproducibility. Read-only against source; no source/research/app/report file was modified. Temporary build/report artifacts were generated under `/tmp`.
**Deliverables audited:** `README.md`, `REPORT.md`, `PRODUCT_SPEC.md`, `research/01..05` + `research/refs/*.json`, `engine/anyrb/*.py`, `engine/tests/*.py`, `app/` (engine.js, optimize.js, ui.js, config.js, build.py, tests), `reports/summary.json`, `reports/qualification_report.html`, `reports/robust_design.stl`, root `index.html`.

**Companion machine-readable log:** [`check_log.json`](check_log.json) (check id → status, expected vs observed, evidence).

> **Re-audit (2026-10-29):** targeted second pass after the A1–A4/minor fixes is in [`REAUDIT.md`](REAUDIT.md). Intermediate snapshot (16:38) found 1 MAJOR + 10 MINOR + 6 NIT residuals; all were fixed and re-verified in the final confirmation pass (16:45) → **final verdict: SHIP — no residual blockers** (see REAUDIT.md §6); machine-readable record in the `reaudit` block of `check_log.json`.

---

## 0. Overall verdict

# SHIP WITH FIXES

**No BLOCKER.** The core scientific/engineering claims reproduce numerically, the test suites pass (27 Python tests, 21 JS tests), the report and app are deterministic and offline, and the citation base is real (no fabricated references found in 241 refs / 143 DOIs). The blockers are not of the "wrong answer" kind: they are **four credibility defects that a scientific reviewer or investor will find quickly** — an undocumented deviation between the engine's default material and the research library it claims as authoritative (§1.1), a misstatement of one headline evidence anchor (§1.2), a false description of the Python optimiser in three documents plus the app (§1.3), and a stale self-contradicting number inside the flagship qualification report (§1.4). Each is a small edit, not a redesign.

| Severity | Count |
|---|---|
| BLOCKER | 0 |
| MAJOR | 4 |
| MINOR | 14 |
| NIT | 8 |

**Top 5 fixes, ranked by risk to credibility** (detail in §3):
1. **Fix the rPETG effective-strength provenance** (§1.1) — engine preset 23 MPa/0.18 CV vs authoritative library 46 MPa/0.10 CV, via an uncited 0.5 "layer-adhesion knockdown" applied to a value that is *already* a measured printed-part strength. Either cite the knockdown or use the library value; make report/app/library agree. This is the single most likely thing for a reviewer to catch, because REPORT §9 itself declares the machine-readable library "the authoritative source".
2. **Fix the PCR-PP "MFR drift" claim** (§1.2) — REPORT §0.1 overstates the R05 evidence and contradicts REPORT §1 within the same document.
3. **Fix the stale "96 %" in the qualification report** (§1.4) — the report's own caveat contradicts its own table (98.3 %); regenerate after editing hard-coded text in `report.py`.
4. **Correct the Python-optimiser description** (§1.3) — `differential_evolution` is claimed in spec/dossier/app; the code is a deterministic pattern search.
5. **Harden input validation / cross-language parity** (§1.5–1.7): `corr = 1.0` is accepted by the material model then crashes the reliability function; NaN inputs propagate silently; the app offers negative correlations that the Python engine rejects; batch-passport range is 1.6 in Python vs 1.5 in spec/app.

---

## 1. Findings

Severity scale: **BLOCKER** = must not ship; **MAJOR** = fix before external review (credibility or correctness defect); **MINOR** = fix soon / disclose; **NIT** = polish.

### Summary table

| ID | Sev. | Area | Finding (short) | Evidence |
|---|---|---|---|---|
| A1 | **MAJOR** | honesty / traceability | Engine rPETG σy = 23 MPa / 0.18 CV vs authoritative library 46 MPa / 0.10 CV via uncited 0.5 knockdown; mode-balance headline is an artefact of the knockdown | `data/feedstock_library.json:155`; `engine/anyrb/materials.py:128-137`; `REPORT.md:145,215`; recompute below |
| A2 | **MAJOR** | honesty / citation | "PCR-PP stream drifted in MFR and mechanical performance" misstates R05 (all 10 lots met the MFR 7–13 spec); contradicts REPORT §1 within the same document | `REPORT.md:19` vs `REPORT.md:49`; OpenAlex abstract for 10.1002/app.70501 |
| A3 | **MAJOR** | software / documentation | Python optimiser described as `scipy.optimize.differential_evolution`; it is a deterministic pattern search (`optimize.py:65`) | `PRODUCT_SPEC.md:89`; `research/03-computational-methods.md:179,242`; `app/ui.js:1557`; `app/README.md:169,267`; `engine/anyrb/optimize.py:65`; `REPORT.md:137` (correct) |
| A4 | **MAJOR** | honesty / reproducibility | Generated report caveat says "the 96 % figure" while its own table shows 98.3 % (hard-coded string in `report.py`) | `engine/anyrb/report.py:462`; `reports/qualification_report.html` (rendered text); regenerated to `/tmp` reproduces 96 % |
| B1 | MINOR | software | `Material(corr=1.0)` passes validation, then `failure_probability()` raises `ValueError` from `phi2` (|ρ|≥1 guard) | `engine/anyrb/materials.py:57-58`; `reliability.py:48-49`; command output |
| B2 | MINOR | software | NaN control vector silently returns NaN mass/P_f instead of an error; measured-lot material queried at `level="lot"` silently returns 0.0 (zero lot CV division) | `mechanics.py:193-227`; `materials.py:94-115`; `reliability.py:63-71`; command output |
| B3 | MINOR | software / cross-impl. | App allows `corr ∈ [−0.6, 0.9]` (JS clamps ±0.95) but Python `Material` rejects negative corr → interactive results not reproducible by the canonical engine | `app/config.js:165`; `app/engine.js:70`; `engine/anyrb/materials.py:57-58` |
| B4 | MINOR | physics / mass | Lattice mass sums `A·L` for every element with no deduction for overlapping material at shared nodes/crossing diagonals; at w = 4 mm the lattice mass (117.95 g) exceeds the whole solid envelope (111.6 g) — physically impossible | `engine/anyrb/lattice.py:119-123`; command output |
| B5 | MINOR | honesty / V&V | L1 "achieved" (REPORT) and `research/05` claims (rigid-body modes zero stress, refinement trend) are not backed by tests; no rigid-body or mesh-refinement test exists | `REPORT.md:192`; `research/05:76-77,86`; `PRODUCT_SPEC.md:147`; `engine/tests/test_engine.py` |
| B6 | MINOR | software / tests | Test named "Pure axial extension: N must be positive, moments ~0" solves the whole lattice and only asserts finiteness + `max|M1| < 1e5`; it does not test the convention it names | `engine/tests/test_engine.py:131-137` |
| B7 | MINOR | honesty / numerics | REPORT claims sensitivity ranking "(mean E, CV(E), load)"; engine ranking is mean E ≫ load ≫ deflection limit ≫ mean σy ≫ CV(E) ≫ CV(σy) ≫ corr | `REPORT.md:156`; `reports/summary.json` sensitivity block; command output |
| B8 | MINOR | citation copy | App CITATIONS still says Cecon/Eriksen "DOI pending verification" with `doi: null` although refs JSON has verified DOIs; ACS 2025 entry has no DOI at all | `app/config.js:200-213`; `research/refs/refs-01.json` R02/R04/R06 |
| B9 | MINOR | citation metadata | 6 DOI records have a year different from Crossref `issued`; one cited PDF URL is 404; `refs-03.json` R34 is never cited anywhere | `/tmp/doi_resolution.json`; url-check output; `research/refs/refs-04.json` R07 |
| B10 | MINOR | cross-impl. | Batch-passport scale domain differs: Python `max_scale=1.6` vs spec §2.4 and app `scaleMax=1.5`; report footnote text "> 1.6 (reject)" | `engine/anyrb/optimize.py:254`; `PRODUCT_SPEC.md:99`; `app/config.js:152`; `report.py:369` |
| B11 | MINOR | citations schema | The five refs files use two top-level shapes (bare list vs wrapper dict), `status` is absent in refs-03/05, and IDs restart at R01 per file (a bare `[Rxx]` is globally ambiguous) | `research/refs/refs-01.json` (list); `refs-02.json` (dict, `refs`); `refs-03.json` (dict, `references`); etc.; `PRODUCT_SPEC.md:163` |
| B12 | MINOR | citation provenance | "rHDPE strength 22–50 MPa and elongation 11–18 % (Eriksen 2019)" is PNAS's quotation of Eriksen; the dossier's own extraction from Eriksen gives 22.2–48.4 MPa and 11.2–17.0 % (upper bounds rounded outward). Attribute as "via PNAS" or use primary ranges | `REPORT.md:19`; `research/01:16-21,§2.1`; PNAS full text (Eriksen ref. 7 sentence) |
| B13 | MINOR | honesty | App's mass-matched row note ("reliability collapses – trade-off steep") omits the report's caveat that this is a buckling-cliff artefact, not a general prediction | `app/optimize.js:391-392` vs `REPORT.md:162` / `report.py:461-463` |
| B14 | MINOR | physics / claim limits | Buckling check uses pure axial Euler load and ignores axial–bending interaction in a rigid-jointed frame; "no combined-load buckling" is not in the limitations lists | `engine/anyrb/mechanics.py:130-145`; `reports/summary.json` limitations |
| C1 | NIT | documentation | README cites "25 engine/verification tests" in three places — actual suite is 27 Python tests | `README.md:25,89,100`; `make test` output |
| C2 | NIT | documentation | REPORT says refs databases are "40–70 entries each" — three files have 35/36/37 | `REPORT.md:226`; file counts |
| C3 | NIT | numerics | "7 % heavier than robust" is 7.8 % (57.776/53.579 − 1) and README's "7 % lighter" is 7.3 % ((57.776−53.579)/57.776); same "7 %" for two denominators | `REPORT.md:152`; `README.md:60`; summary values |
| C4 | NIT | documentation | `make_fixtures.py` claims JS must match to "~1e-9 relative"; the test tolerance is 1e-6 (README says 1e-6) | `engine/make_fixtures.py:4-5`; `engine/tests/test_js_engine.py:85` |
| C5 | NIT | completeness | `research/00-executive-evidence-map.md` (listed in PRODUCT_SPEC §8) is absent at final snapshot (`app/README.md` landed 16:18) | directory listings |
| C6 | NIT | documentation | `research/01` §7 and `research/05` §6 still say PRODUCT_SPEC attributes the PNAS paper to "Ghosh et al." — the current spec correctly says Georgiou | `research/01` §7, `research/05` §6; `PRODUCT_SPEC.md:7` |
| C7 | NIT | reproducibility | App shows seed 20251029; Python MC default seed is 20261029 — "seed shown in UI" does not reproduce Python MC streams (analytic values unaffected) | `app/config.js:134`; `engine/anyrb/reliability.py:117` |
| C8 | NIT | naming | Report/preset name "rPETG as-printed (effective weakest-axis strength)" vs library name "rPETG (printed/regrind)" — harmless naming drift | `materials.py:134`; `data/feedstock_library.json:119` |

---

### 1.1 [MAJOR] A1 — The default material deviates from the research library it calls authoritative

**What the engine uses** (`engine/anyrb/materials.py:128-137`):
`rPETG: E = 2100 MPa, CV(E) = 0.10, σy = 23.0 MPa, CV(σy) = 0.18, ρ = 1.24, corr = 0.55` with the comment that 23 MPa is "in-plane 46 MPa (CV 0.10) × 0.50 layer-adhesion knockdown (ASSUMPTION, CV 0.15 on the knockdown)".

**What the research says:**
- `research/01-recyclate-variability.md` §0.1 "Recommended AnyRB feedstock presets (v0.1)": rPETG `E = 2,100, CV 0.10, σy = 46, CV 0.10, ρ = 1.24`; §6.4 says "Use the values in §0.1 table".
- `data/feedstock_library.json` (rPETG, line 155): `"yield_strength": {"mean": 46, "cv": 0.1, ...}` with evidence "Peak tensile stress 46.5 MPa (SD 0.66) … ISO 527-2, n=6 [R07]. **Use printed-part values for printed lattice.**"
- R07 is a *printed-specimen* tensile study (new filament 46.5 MPa printed peak stress), i.e. the 46 MPa figure is already an as-printed measurement. Applying a further 0.5 "layer-adhesion knockdown" to it is a double count of the process effect, and the 0.5 factor has no citation anywhere in the repo.
- `REPORT.md:215` states "the machine-readable library is the authoritative source"; `REPORT.md:145` discloses the 0.55/0.5 assumption only in the results section, while `reports/summary.json` and the report say "material data: provisional literature-derived presets (research/01)".

**Observed impact (independently recomputed):** with the library value (σy 46, CV 0.10, corr 0.50) instead of the engine preset:

| quantity | engine preset | library value |
|---|---|---|
| robust mass | 53.579 g | 53.44 g |
| robust P_f | 0.989 % | 0.988 % |
| marginal yield P_f at optimum | **0.303 %** | **0.000 %** |
| marginal stiffness P_f | 0.753 % | 0.988 % |
| strength demand / lot mean | 0.627 | 0.315 |

The headline "failure-mode balance — 0.30 % from yield, 0.75 % from stiffness/buckling" (README line 63, REPORT line 161, report/app figures) **is created by the unsourced knockdown**: with the library value the yield marginal collapses to ~0 and the design is single-mode. The 1 % joint target is still met and the mass claim survives (53.58 vs 53.44 g), so this is a traceability/honesty defect rather than a wrong answer — but it is exactly the sort of thing a reviewer checks first, because the report itself claims the library is authoritative.

**Checks run:** sample commands in `check_log.json` C27; recomputation quoted above.
**Recommended fix (pick one, then regenerate report/STL and re-run make test):**
(a) add a sourced printed-part reduction factor to `data/feedstock_library.json` with citation and an explicit "effective printed σy" property, update `research/01` §0.1/§6.4; or
(b) set the preset back to σy = 46 MPa, CV 0.10 (library value) and regenerate; or
(c) keep 23 MPa but label it everywhere as a *scenario assumption* (not "library in-plane 46 MPa") and remove the "0.30 % yield" mode-balance claim or mark it conditional.

---

### 1.2 [MAJOR] A2 — PCR-PP evidence anchor misstated

`REPORT.md:19` ("The variability is real…"): "**a single industrial PCR-PP stream drifted in MFR and mechanical performance over 15 months**".

That contradicts the source and the report itself:
- R05 (`10.1002/app.70501`, Hinczica et al. 2026) abstract, verified via OpenAlex on 2026-10-29: ten batches "all ordered with identical specifications for melt flow rate (**MFR = 7–13 g/10 min**) and density", yet filler 2–24 wt %, elongation 10–100 %, fatigue life 3,000–6.52 M cycles varied. The point is the **opposite**: MFR stayed in spec; other properties did not.
- `REPORT.md:49` states the correct version: "Ten PCR-PP lots … all met the same MFR (7–13 g/10 min) and density specification, yet filler content ranged…".
- `research/01` §0.2 item 2 and `PRODUCT_SPEC.md:6` use the correct framing ("composition/mechanical drift", not MFR drift).

**Verdict:** misleading overstatement of a headline anchor in the executive answer; low effort to fix.
**Fix:** rewrite `REPORT.md:19` as "…a single industrial PCR-PP lot series met datasheet MFR/density specs yet varied strongly in composition and mechanical performance over 15 months".

---

### 1.3 [MAJOR] A3 — Python optimiser is described as differential evolution but is a pattern search

- `PRODUCT_SPEC.md:89`: "Deterministic pattern search (coordinate descent with shrinking step) in JS; `scipy.optimize.differential_evolution` in Python."
- `research/03-computational-methods.md:179`: "v0.1 uses pattern search in JS and DE in Python [SPEC §2.3]"; line 242 (v0.1 stack): "pattern search (JS) and differential evolution (Python)".
- `app/ui.js:1557`: "the canonical Python engine uses differential evolution and finds a similar, slightly lighter design."; `app/README.md:169` ("Python differential evolution: 53.58 g") and `app/README.md:267` repeat it.
- Actual implementation: `engine/anyrb/optimize.py:65` `def pattern_search(objective, x0, step=0.25, min_step=0.012, max_evals=1200)`; `optimize_robust`/`optimize_deterministic` call it. There is no `scipy.optimize` import anywhere in `engine/anyrb/optimize.py`.
- `REPORT.md:137` correctly says "deterministic pattern search".

**Verdict:** false method claim in the engineering contract, one research dossier, and user-facing app copy; also a V&V-relevant statement (the app tells the user a stronger search was used). No numerical consequence.
**Fix:** replace all four instances with "deterministic pattern search (same algorithm as JS)" or implement DE and re-verify, then regenerate fixtures/tests.

---

### 1.4 [MAJOR] A4 — Flagship report contradicts itself: "96 %" caveat vs 98.3 % table

`engine/anyrb/report.py:461-463` hard-codes:

> "Note on the same-mass row: reliability is very sensitive near the buckling-controlled sizing cliff in this idealised model, so the **96 %** figure illustrates the value of shaping…"

while the same report renders the same-mass row from the live computation: `Uniform lattice, same mass | 53.6 | 98.3 %` (`reports/qualification_report.html`, regenerated to `/tmp/audit-reports2` reproduces both strings identically; only the timestamp differs). 96.2 % was the value under the *previous* material preset; the number was not templated when the preset changed.

**Verdict:** a reviewer opening the qualification report sees a table and a caveat that disagree about the same number. Fix is one line plus `make report`.
**Fix:** make the caveat interpolate `results['uniform_match'].pf` (e.g. `{results['uniform_match'].pf:.1%}`); regenerate.

---

### 1.5 [MINOR] B1 — `corr = 1.0` passes validation then crashes

```
>>> Material(..., corr=1.0)                 # accepted (materials.py:57-58 allows 0..1)
>>> failure_probability(m, 10, 1000)        # ValueError: rho must be strictly inside (-1, 1)
```
`phi2` guards `|rho| >= 1-1e-12` (`reliability.py:48-49`) but `Material.__post_init__` only checks `0 <= corr <= 1`. Any caller setting perfect correlation (a physically meaningful limit) gets an exception from a documented API. **Fix:** reject `corr >= 1-1e-12` in `Material` with a clear message, or handle ρ=1 analytically (P_f = max(Φ(a), Φ(b))).

### 1.6 [MINOR] B2 — NaN / measured-lot edge cases

- `evaluate(mat, np.full(8, np.nan))` returns `mass_g = nan`, `sigma_req = nan`, `pf = nan` silently (`mechanics.py`, `lattice.py`) — no finite-value guard; an app/CLI caller could render NaN as a "result".
- `lot_from_measurement()` sets `lot_fraction = 0`; querying that material at `level="lot"` makes `sig = 0` and returns `pf = 0.0` silently instead of raising or falling back (`materials.py:94-115`, `reliability.py:63-71`). Expected: documented fallback or explicit error.

### 1.7 [MINOR] B3 — App and Python disagree on the admissible correlation range

`app/config.js:165` `corr: [-0.6, 0.9]` (slider), `app/engine.js:70` clamps to `[-0.95, 0.95]`; Python `Material` raises for `corr < 0` (`materials.py:57-58`). The app therefore computes (and displays) reliability for negative correlations that the "canonical" engine refuses, contradicting the claim that the two implementations are the same model. **Fix:** restrict the UI to [0, 0.95] or widen the Python model and add a negative-corr test.

### 1.8 [MINOR] B4 — Mass overcounts overlapping strut material

`mass_g` sums `DEPTH*widths*lengths` over all 94 elements plus pad (`lattice.py:119-123`); element lengths are node-to-node, so material at shared nodes and at the crossing diagonals is counted twice. Evidence: uniform 4 mm lattice mass = **117.95 g** > full solid envelope mass = **111.60 g** (`make compare`: solid 111.60 g; `evaluate(..., uniform_controls(4.0))` mass 117.95 g). A lattice cannot contain more material than the block it occupies. The bias is conservative for the design (over-states required material) and applies to all lattice strategies, but it is undisclosed in the mass definition (the STL does disclose "overlapping strut boxes"). **Fix:** deduct joint/crossing overlap analytically, or state explicitly in PRODUCT_SPEC §2.1, REPORT and UI that mass is an upper bound and that "lighter than solid" comparisons are conservative.

### 1.9 [MINOR] B5 — V&V claim ladder is one notch stronger than the evidence bundled in the repo

L1 = "solution verified" requires "refinement/convergence studies" (`research/05:77`); REPORT marks L1 **achieved** (`REPORT.md:192`). The repo has no mesh-refinement study and no rigid-body-mode test, although `PRODUCT_SPEC.md:147` requires "rigid-body modes; … mesh/refinement trend", and `research/05:86` asserts "rigid-body modes produce zero stress" is demonstrable. `make test` covers element stiffness, equilibrium, symmetry, linearity, ϕ₂, sampler statistics, optimiser feasibility, STL and fixtures — solid work, but not refinement/rigid-body. **Fix:** add a three-element rigid-body translation/rotation test (expected zero internal forces) and either add a mesh-refinement note or mark L1 "partial (to be documented)".

### 1.10 [MINOR] B6 — A test does not test what its name/docstring says

`engine/tests/test_engine.py:131-137`:
```python
def test_element_force_conventions(self):
    """Pure axial extension: N must be positive (tension), moments ~0."""
    ...
    sol = solve_unit(lat, w, F_total=1.0, E=1.0)      # whole lattice, not pure axial
    self.assertTrue(np.all(np.isfinite(sol["N"])))
    self.assertLess(np.max(np.abs(sol["M1"])), 1e5)   # arbitrary bound
```
No axial-tension load case and no sign convention check. **Fix:** build a one-element bar in tension, assert `N > 0` and `N = F`, `M ≈ 0`; rename the current test "forces finite".

### 1.11 [MINOR] B7 — Sensitivity ranking claim is wrong

REPORT §4.4: "The acceptance window and sensitivity ranking (**mean E, CV(E), load** — not correlation) are generated per design". Live values (`reports/summary.json`, "sensitivity", +25 % perturbation except mean terms −25 %): mean E **+0.747**, load **+0.498**, deflection limit **+0.488**, mean σy **+0.151**, CV(E) **+0.019**, CV(σy) **+0.011**, corr **−0.0004**. CV(E) is fifth, not second. The correct statement is "mean E, load and deflection limit dominate; CV(E) matters more than correlation but is second order". Fix the sentence (or the UI ranking rule), since "what to control in the supply chain" is a product claim.

### 1.12–1.21 Other MINOR items

- **B8** `app/config.js:200-213`: Cecon 2023 and Eriksen 2019 carry `doi: null` and "(DOI pending verification)" even though `research/refs/refs-01.json` records verified DOIs `10.1016/j.wasman.2023.09.002` and `10.1016/j.wasman.2019.07.005`; the ACS 2025 entry has no DOI (`10.1021/acssusresmgt.5c00040` is verified). App copy contradicts the repo's citation standard.
- **B9** DOI/URL metadata: all 143 DOI-bearing refs resolve via Crossref/OpenAlex (0 failures, 0 first-author mismatches), but 6 records carry a year that differs from Crossref `issued` (`refs-01` R36 2021/2020; `refs-02` R18 2008/2009, R20 2023/2024; `refs-03` R03 2006/2005, R61 2017/2016; `refs-05` R12 2002/2001 — online-first vs issue-year ambiguity, not fabrication); `refs-04` R07 (Hyperganic EULA PDF) returns **HTTP 404** while status is `verified_search_snippet`; `refs-03` R34 is never cited; `refs-01` R13/R20/R21/R23/R24/R26/R27/R30/R35 appear only in the "reference index" list, not inline.
- **B10** Batch-passport domain: Python `batch_recipe(..., max_scale=1.6)` (`optimize.py:254`) vs `PRODUCT_SPEC.md:99` and `app/config.js:152` = 1.5; `report.py:369` prints "> 1.6 (reject)". Align to one contract (spec says 1.5).
- **B11** Refs schema inconsistency: `refs-01`/`refs-04` are bare lists; `refs-02` is `{...,"refs":[...]}`, `refs-03`/`refs-05` are `{...,"references":[...]}`; `refs-03`/`refs-05` have no `status` field (they use `"verified": "<text>"`); IDs restart at R01 in each file (§8 of PRODUCT_SPEC specifies one schema). Machine-readable yes, but not uniformly.
- **B12** Eriksen anchor provenance (see table): the 22–50 MPa / 11–18 % numbers are PNAS's quotation of Eriksen; the dossier's own extraction is 22.2–48.4 MPa / 11.2–17.0 %. Cite as "via PNAS" or quote the primary table ranges.
- **B13** App mass-matched row caveat is weaker than the report's (app: "reliability collapses — the mass/reliability trade-off is steep", `optimize.js:391-392`; report: "reliability is very sensitive near the buckling-controlled sizing cliff … illustrative, not a general-purpose prediction").
- **B14** Buckling model uses a pure axial Euler load; a real rigid-jointed frame member under compression + end moments has a lower critical load. The limitations lists "Euler buckling k=1; joints ignored" but not the combined-load omission. One sentence in the limitations card/report closes this.

### 1.22 NITs

C1 README cites 25 engine/verification tests (3 places) vs 27 actual; C2 "40–70 entries each" vs 35/36/37; C3 "7 % heavier than robust" (actually 7.8 %) vs "7 % lighter" (7.3 %); C4 `make_fixtures.py` 1e-9 docstring vs 1e-6 test; C5 `research/00-executive-evidence-map.md` missing (app/README.md landed 16:18); C6 dossier "corrections to spec" now stale (spec fixed); C7 app seed ≠ Python MC default seed; C8 preset naming drift.

---

## 2. What was checked and passed (evidence, not assertion)

### 2.1 Reproducibility — PASS

| Check | Command | Result |
|---|---|---|
| Python test suite | `make test` | **27/27 OK** in 3.26 s (README claims 25) |
| JS test suite | `node app/tests/run.mjs` | **21/21 passed** |
| Combined verify | `make verify` | `deliverables OK: 53.57902039805621 g, P_f 0.009989021363734614` |
| Report regeneration | `PYTHONPATH=engine .venv/bin/python -m anyrb.cli demo --out /tmp/audit-reports2` | 4.7 s; **summary numbers identical** to committed `reports/summary.json` (robust 53.5790 g / 0.009989; uniform 60.4806 / 0.009952; nominal 57.7760 / 0.001100; mean-only 50.0310 / 0.515252; solid 111.6 / 0). Report HTML text identical to committed modulo the `generated` timestamp/engine-build times. |
| Fixture regeneration | `engine/make_fixtures.py` into `/tmp/repro` | byte-identical `reference.json` (29,879 B, 5 cases) |
| App build | `python3 app/build.py` from a copied `app/` | "BUILD OK — 212.0 KiB"; output **byte-identical** to committed root `index.html`; JS passes `node --check` |
| Report self-contained | grep of `reports/qualification_report.html` | 0 `http(s)://` references; 9 inline `data:image/png;base64` charts; `in-silico · not a certification` badge present |
| App offline | root `index.html` | single inline classic `<script>` (163 KB inline JS); no external script/link/font resources; only external URL is a DOI **hyperlink** in the citation cards (not loaded) |
| STL validity | parse `reports/robust_design.stl` | 1 solid; **1,140 triangles** (94 elements × 12 + 12 pad boxes), 3,420 finite vertices, bbox x 0–150.72, y −4.93–64.93, z ±5; starts `solid anyrb_robust`, ends `endsolid anyrb_robust` |

**Cross-implementation check (independent of the author-facing test):** `engine/tests/test_js_engine.py` imports the actual `app/engine.js` under Node, evaluates it on the frozen `app/tests/fixtures/reference.json` (5 designs: uniform 1.5/2.0/2.5 mm, graded custom, robust-optimised) and compares mass, σ_req, E_req, E_req_def, E_req_buck, u_tip to 1e-6 relative and P_f to 1e-8 absolute. It passes in the final snapshot (part of the 27/27), and the JS smoke output for the default uniform-2.0 mm design matches Python exactly on mass 62.69 g, σ_req 13.9192 MPa, E_req 1478.50 MPa, u_tip 1.6114 mm, P_f 0.00158258.

**Transient observation (not a final finding):** during the audit window the suite briefly failed with `uniform_w2.0.mass_g: js=64.2097 py=62.6929 rel=0.0242` because the Python material preset was updated before the JS `config.js` and fixtures were. It was fixed by the authors within ~2 minutes (final state passes 27/27). This is evidence of active landing, not a defect in the shipped snapshot — but it demonstrates that **the cross-language contract is only as current as the last `make fixtures`/`make app-build`**, which the Makefile targets handle correctly.

### 2.2 Independent physics / statistics — PASS

Recomputed from first principles with `engine/` (script in `/tmp/physics_checks.py`; results in `check_log.json`):

- **Element stiffness:** `_local_stiffness` matches the standard 2-D Euler–Bernoulli frame matrix; transformation `Tᵀ k_local T` is the standard global-to-local form. Single-element cantilever tip deflection vs `FL³/3EI`: relative error **4.3e-16**; pure axial vs `FL/EA`: **0**.
- **Boundary conditions:** all 3 DOF fixed at the four `x = 10 mm` nodes, load `F/4` at the four `x = 150 mm` nodes (`mechanics.py:89-96`) — matches PRODUCT_SPEC §2.1.
- **Unit-load scaling:** `u_tip_unit` is load-independent (checked by evaluating F=100 vs F=200: `σ_req`, `E_req` scale exactly ×2); `u = F·u_tip_unit/E`.
- **Buckling units:** engine `E_req_buck` vs hand `max F|N|L²/(π²I)` on the same solve: **rel. err 0.0**; magnitudes correct (N·mm²/mm⁴ = MPa).
- **Deflection demand:** engine `E_req_def` vs hand `F·u_tip/u_lim`: **rel. err 0.0**.
- **Bivariate-normal formula:** `P_f = Φ(a)+Φ(b)−Φ₂(a,b;ρ)` equals `1 − Φ₂` orthant form exactly; checked against `scipy.stats.multivariate_normal.cdf` for ρ ∈ {−0.95, −0.5, 0, 0.3, 0.5, 0.6, 0.9, 0.95, 0.999}, a,b ∈ [−30, 30]: max |error| **7.8e-7** (only at the pathological ρ = 0.999, a = b = 1e-9 corner); typical errors ~1e-12–1e-15.
- **Lognormal parameterisation:** `mu = ln(mean) − s²/2`, `s² = ln(1+CV²)` (`materials.py:27-34`); Monte-Carlo of 2 M samples reproduces target means (100.00) and CVs (0.02, 0.12, 0.50, 0.90 within MC error).
- **Two-level split:** `CV_lot = 0.92195·CV`, `CV_within = 0.38730·CV`, and 0.92195² + 0.38730² = 1 (85 %/15 % variance) — empirical sampled CVs match configured values; consistent with `research/01` §6.1 recommendation.
- **MC vs analytic:** `make report` MC P_f 0.0108 ± 0.00042 vs analytic 0.009989 (≈1.9σ — consistent with sampling error).
- **Optimiser feasibility:** target 1e-4 → mass 59.529 g, P_f 9.98e-5 (feasible); 1e-3, 1e-2, 5e-2, 0.2 (mass 51.396 g, P_f 0.19997) all feasible; penalty formula matches spec (`mass·(1+100·max(0,P_f−target)/target)`).
- **Iso-mass grading claim verified:** peak utilisation of the mass-matched uniform lattice vs robust design = **1.52×** (buckling-controlled), inside the claimed 1.3–1.6× iso-mass grading effect (`REPORT.md:163`, `research/02` §0.4).
- **Docstring edge cases:** bad control-vector shapes raise clear `ValueError`; F = 1e−9 / 1e9 do not crash; CV = 0.9 handled.

### 2.3 Numeric consistency of headline claims — PASS (with A4 exception)

Independently recomputed every headline number against `make compare` / `reports/summary.json` and `app` fixtures:

| Claim (README/REPORT/report HTML) | Recomputed | Verdict |
|---|---|---|
| solid 111.6 g / ~0 | 111.60 g / 0 | ✓ |
| uniform 60.5 g / 1.00 % | 60.4806 g / 0.9952 % | ✓ (rounding) |
| nominal SF1.5 57.8 g / 0.11 % | 57.7760 g / 0.10999 % | ✓ |
| mean-only 50.0 g / 51.5 % | 50.0310 g / 51.525 % | ✓ |
| robust 53.6 g / 1.00 % | 53.5790 g / 0.9989 % | ✓ |
| 52 % lighter than solid | 1−53.579/111.6 = 52.0 % | ✓ |
| 11 % lighter than uniform | 1−53.579/60.481 = 11.4 % | ✓ (rounds 11) |
| 7 % … SF-1.5 | 7.3 % / 7.8 % depending on denominator | ✓/− (NIT C3) |
| mode split 0.30 % yield / 0.75 % stiffness / joint 1.00 % | 0.3026 % / 0.7529 % / 0.9989 % | ✓ (but see A1) |
| batch passport: lot E = 80 % → s ≈ 1.03 (+2.5 % mass) | s = 1.0293, +2.52 % | ✓ |
| report table: E×0.85 → 1.009/+0.8 %; E×0.75 → 1.052/+4.4 % | 1.0094/+0.81 %; 1.0516/+4.44 % | ✓ |
| same-mass uniform 53.6 g → 98.3 % | 53.579 g / 0.98305 | ✓ (table), ✗ caveat says 96 % (A4) |
| sensitivity: CV(E)+25 % +1.89 pp; mean E−25 % +74.68 pp; load+25 % +49.77 pp | identical to `summary.json` | ✓ |
| robustness index 0.85 | 0.8535 | ✓ |
| STL 1,140 triangles | 1,140 | ✓ |
| PNAS 18 %→4 %; "93 %" relative to modelled 26 %; strength 0.22 MPa; ≥68 % strain | 93 %/68 % confirmed from PNAS abstract; 0.22 MPa confirmed from PNAS PDF text via search; 18→4 %, 41 % (554/1350 MPa), 26 % from dossier locators (PMC page does not expose figure values; see audit limitation §6) | ✓ with caveat |

### 2.4 Citation integrity — PASS at the "real references" level; MINOR issues only

- **Volume/coverage:** 241 reference records across 5 JSON files (36/35/63/70/37); 143 carry DOIs, **all 143 resolve** via Crossref (0 failures, 0 fabricated/404 DOIs). 98 have no DOI — these are standards, regulations, vendor pages and datapoints, as expected; 1 record is explicitly `status: "unverified"` (ISO 14021:2016, `refs-01` R30) and **is not used in any headline claim** (checked: it appears only in standards context / reference index).
- **Metadata:** 0/143 first-author mismatches against Crossref; 3 field-matched titles are short forms of books ("Cellular Solids", "Integrated Computational Materials Engineering") — not errors; publication year vs Crossref `issued` differs for 6 records (online-first vs issue year, B9).
- **Anchor numbers:** PNAS 2025 (Georgiou, Sun, Liu & Athanasiou; `10.1073/pnas.2502613122`) — 93 % / ≥68 % verified from the abstract; 0.22 MPa strength verified from the PNAS text; 1,350 ± 239 MPa (CV 17.7 %, n = 50/10 plates) verified from Methods; Cecon 2023 380–1,250 MPa and Eriksen 2019 22–50 MPa / 11–18 % verified **as PNAS's quotations** of those papers (the dossier itself records that the Cecon range came "via R01", and the Eriksen upper bounds are rounded outward — B12). ACS 2025 "23 lots / >85 %" and Hinczica 2026 "10 lots / 15 months, filler 2–24 %, elongation 10–100 %, 3,000–6.52 M cycles" verified from OpenAlex abstracts. No source contradicted its quoted number.
- **Dangling keys:** zero. `[Rxx]` tokens in every dossier resolve inside that dossier's own refs file (01: 27/27, 02: 35/35, 03: 59/59, 04: 70/70, 05: 37/37). (Global ambiguity from per-file restarting IDs is B11.)
- **Research dossiers' own "what we could not verify" sections** (01 §7, 02 §9, 03 §7, 04 §7, 05 §6–7) are unusually candid — they disclose the correlation assumptions, the lot/within split inference, paywalled full texts, the Cecon derivation via PNAS, the ISO 14021 403, the PNAS author-name error, and that no physical validation exists. I found no case of a dossier hiding a failed verification.

### 2.5 Honesty / red-team checklist (task items i–vii)

| # | Requirement | Result |
|---|---|---|
| i | 93 % PNAS claim carries denominator and is not transferred to single-material lattices | **PASS** — README:5, REPORT:21, PRODUCT_SPEC:7, report HTML §6, app `config.js:193-197` all state "relative to modelled 26 %"; report HTML explicitly says "it does not transfer to a single-material printed bracket". (Verification of the 26 % figure itself: dossier locator Fig. 6; not independently re-extractable, see §6.) |
| ii | No claim that geometry reduces material CV | **PASS** — README:5 caveat, REPORT §2 exact statement + levers table, report HTML levers card "AnyRB v0.1 … does not claim to reduce the material's own CV", app honesty-key card. |
| iii | 96 % same-mass comparison caveated | **PARTIAL** — REPORT:162 and report HTML carry the buckling-cliff caveat; report HTML's caveat number is stale (A4); app has a weaker note (B13). |
| iv | In-silico / not-certification disclaimers present and visible | **PASS** — report badge "in-silico · not a certification"; app header badge + disclaimer block; README honesty section; `summary.json` limitations; report §5–6. |
| v | Limitations complete (no physical validation, linear-elastic 2-D, Euler k=1, batch-uniform, provisional material data) | **PASS** with one gap: combined axial–bending buckling not listed (B14); "provisional material data" present. |
| vi | No fake precision | **PASS** — headline numbers rounded ("52 %", "11 %", "53.6 g", "~380–1,250 MPa"); no 8-digit claims in user copy; caveats use "~", "illustrative". The "96 %" is a stale round, not fake precision (A4). |
| vii | Cross-document consistency | **PASS for headline numbers after the authors' last update** — README/REPORT/report-HTML all 53.6/60.5/57.8/50.0/111.6 and 1.00/0.11/51.5 %; remaining inconsistencies: A2 (MFR drift), A4 (96 %), B7 (sensitivity order). Earlier-in-the-audit stale copies of README/REPORT (with 56.9 g / 0.98 % / 0.61 %+0.51 %) were replaced by the authors at 16:06/16:11 and are **not** reported as findings. |

### 2.6 Honesty of headline framing (adversarial reading)

The project's strongest honesty features are real and visible: the explicit single-material sensitivity law, the levers-not-active card, the "library is not the goal — the distribution is" reframing, the claim ladder, and the in-silico badge. The main risk is not spin but **traceability**: the qualification report's numbers depend on a material preset (23 MPa / 0.5 knockdown) that the repo's own "authoritative" library contradicts (A1), and one headline evidence anchor is stated more strongly than its source (A2). Both are fixable without touching the physics. I found no claim that simulated reliability is measured reliability, no certification implication, and no attempt to hide the missing external validation.

---

## 3. Top 5 fixes ranked by risk

1. **rPETG effective-strength provenance (A1).** Highest risk because `REPORT.md:215` declares the library authoritative while the engine default contradicts it; a domain reviewer will recompute the preset. Fix provenance (cite the knockdown or use the library value), update `research/01`, and re-run `make test fixtures report app-build`; note that the mass headline survives but the "mode balance" claim does not.
2. **Report "96 %" → live computed value (A4).** Trivial fix, high embarrassment risk: the flagship qualification artifact currently contradicts itself in adjacent sentences. Template the number and regenerate.
3. **PCR-PP MFR-drift sentence (A2).** Executive-summary overstatement of an otherwise strong anchor; one-sentence rewrite, no regeneration needed.
4. **Python optimiser description (A3).** Replace `differential_evolution` with pattern search in spec/dossier/app copy; either that or implement DE + re-verify fixtures. Low effort, removes a false method claim from the V&V story.
5. **Input validation + cross-language parity batch (B1, B2, B3, B10):** reject `corr ≥ 1` with a clear error (or special-case), add finite-input guards, restrict the app correlation slider to the Python-admissible domain (or extend Python), and align the passport scale domain at 1.5. These are the adversarial-input cases an investor's technical diligence will poke at.

---

## 4. Gaps in this audit / what I could not verify

- **Interactive browser behaviour:** no headless browser was available in the audit environment. The app was verified structurally (offline self-containment, single inline script, `node --check`, deterministic build, 21 JS unit tests including a 5,000-sample MC + FE < 300 ms performance check) but not by clicking through the UI. Screenshots/manual QA remain for the demo-engineer/Lead.
- **PNAS figure-level values (26 % modelled baseline, 554 MPa effective modulus, 18 %→4 % Fig. 5):** the PNAS abstract confirms 93 %/≥68 %; the PNAS full-text HTML (PMC12377729) strips figure content; the PNAS PDF is Cloudflare-protected. I confirmed 0.22 MPa and the 1,350 ± 239 MPa feedstock from the full text/search, and the 18 %→4 %, 554 MPa and 26 % values are recorded with figure locators in `research/02` §2.2. I could not independently re-extract those three figure values; the report's use of them is consistent with the dossier, but the dossier should ideally include a screenshot/extract as evidence.
- **Primary Cecon 2023 and Eriksen 2019 tables:** Elsevier abstracts are not exposed via OpenAlex/Crossref; the 380–1,250 MPa and 22–50 MPa / 11–18 % figures were verified as PNAS quotations of those papers (the dossiers say so for Cecon; see B12 for Eriksen rounding).
- **Artifacts still landing:** `research/00-executive-evidence-map.md` was still absent at the 16:21 final snapshot and is unaudited. `app/README.md` landed at 16:18 and was read; its own claim of a headless-Chrome smoke test (page renders, zero console errors) could not be independently reproduced here (no browser tooling) — the build/JS/offline checks in §2.1 support it but do not prove it. The audit snapshot for all "PASS" claims is the final-state files listed in §2.1 (re-checked 16:20–16:21 local).

---

## 5. Audit method / commands

```
make test                          # 27 tests OK (3.26 s)
node app/tests/run.mjs             # 21 tests passed
make verify                        # deliverables OK
PYTHONPATH=engine .venv/bin/python -m anyrb.cli compare
PYTHONPATH=engine .venv/bin/python -m anyrb.cli demo --out /tmp/audit-reports2
PYTHONPATH=engine .venv/bin/python -m anyrb.cli fixtures   # (via engine/make_fixtures.py in /tmp/repro)
python3 app/build.py               # in /tmp/appcheck2, output diffed vs repo root index.html
```
Independent scripts (kept in `/tmp`, reproducible): `/tmp/resolve_refs.py` (Crossref/OpenAlex for all 241 refs), `/tmp/physics_checks.py` (FE/ϕ₂/lognormal/adversarial), `/tmp/adversarial2.json`, `/tmp/doi_resolution.json`, `/tmp/url_checks.json`. No source/research/app/report file was modified; all temporary artifacts are under `/tmp`.

# AnyRB v0.3 — Delta Audit (response-to-review release)

**Auditor:** independent verifier (same auditor as v0.1/v0.2 audits; did not author any deliverable)
**Repo:** `/Users/barisnacierzeren/Downloads/Candidate-2/anyrb` · private `bnelabs/AnyRB` · HEAD `19c9026` (v0.3, pushed, `main...origin/main` in sync)
**Date:** 2026-10-29 19:20 Europe/Istanbul (UTC+3)
**Scope (delta, per request):** mass numbers across engine/app/report/docs after the corrected union sampler; claim overstatement check; stale v0.2 numbers/method strings; validation WARN disclosure; F5 tolerance honesty; coupon pre-registration integrity; AI/grounding scope; repo hygiene (keys). Not a full re-audit — the v0.1 science core and v0.2 AI-integrity mechanisms were audited earlier (`AUDIT.md`, `REAUDIT.md`, `HACKATHON_AUDIT.md`) and are spot-checked here.
**Read-only:** no code/docs edited. The only working-tree changes created by this audit are the **regenerated v0.3 validation artifacts** (`make validate`, project canonical command) described in B1 — the committed files were stale v0.2 and were replaced in the working tree with the correct v0.3 output (3 modified files; not hand-edited).

---

## 0. Verdict

# SHIP WITH FIXES

**No product/science blocker.** The v0.3 delta is real and independently corroborated: the corrected mass audit is right (analytic 50.809 g / printed union 46.400 g / +9.50 % on the shipped design — reproduced with two independent union methods), printability is genuinely constrained, measurement uncertainty and lot-specific resize are implemented and exercised, the feasibility gate and sustained-load advisory behave as described, the coupon pre-registration is cryptographically intact and numerically frozen against the shipped engine, AI/grounding claims match the code, and no keys are committed.
**One submission blocker:** the pushed v0.3 commit contains the **stale v0.2 validation artifacts** (46 checks / 45 PASS / 1 WARN with the retired +25.2 %/40.5 g mass numbers). Correct v0.3 artifacts (53 checks / 51 PASS / 2 WARN / 0 FAIL, including K1–K3 and L1) were regenerated in the working tree and must be committed + pushed. Four minor stale/overstated numbers in docs and the report also need a quick edit.

| Severity | Count | Items |
|---|---|---|
| BLOCKER | 1 | B1 — HEAD commit ships v0.2 `validation/results.json` + `VALIDATION.md` (46 checks, 45/1/0, old 25.2 % mass), contradicting all v0.3 claims; regenerated v0.3 artifacts are uncommitted |
| MAJOR | 0 | — |
| MINOR | 4 | M1 REPORT.md comparison table stale vs engine/report HTML (+ PDFs inherit); M2 batch-passport example 1.10×/+8.5 % is v0.2 (v0.3 with 12 % measurement CV ≈1.39×/+22 %, "conditional"); M3 demo script mixes analytic start with printed end ("62.7 → 46.4 g"); M4 qualification report HTML omits the two validation WARNs/counts |
| NIT | 4 | N1 app hard-coded mass disclosure 50.78 g/+9.4 % vs engine 50.81/+9.5 %, JS reference 46.34 vs 46.40; N2 "same printed mass" uniform is 46.25 g vs robust 46.40 g (n=10k Halton in matching); N3 CLI `compare` prints analytic mass unlabelled vs "every displayed mass is printed" claim; N4 stale "AnyBatch v0.2" comment in `app/product_render.js` |

---

## 1. Mass audit — verified (the central v0.3 change)

| Claim | Independent check | Verdict |
|---|---|---|
| Analytic mass over-counts printed union by **+9.5 %** on shipped robust design: **50.81 g analytic vs 46.40 g printed** | Engine: analytic `50.8094286681 g`, printed Halton `46.4002560533 g` (+9.502 %). Independent 2-D Monte-Carlo union (2 M samples, exact full-length strut boxes): **46.395 g ± 0.045 g**; independent 4000×4000 fine grid: **46.382 g**; engine Halton deviates +0.01–0.04 % (consistent with validation F5). | **PASS** |
| Corrected over-counts: w=1 **+5.6 %**, w=2 **+12.2 %**, w=4 **+27.9 %** (old 25 %/40.5 g retired) | Independent union MC: w=1 analytic 35.066 / printed 33.206 → **+5.6 %**; w=2 62.693/55.853 → **+12.2 %**; w=4 117.946/92.195 → **+27.9 %**; engine Halton gives 6.0/12.1/28.0 % (within F5 tolerance). Old `+25 %/40.5 g` appears only in explicit "retired/void/error" context in `REVIEW_RESPONSE.md`, `README.md:97`, `REPORT.md:227,276`, `validation/VALIDATION.md`; **absent** from the qualification report HTML and headline docs. | **PASS** |
| Headline/selection basis is printed union mass | `reports/summary.json` `mass_basis` = analytic 50.809 / printed 46.400 / 9.502 %; report HTML KPI 46.4 g (+ "analytic upper bound 50.8 g"); app cards/hero/exports use `printed_mass_g` (`app/aicore.js:336-352,404-417`); engine final multi-start selection and comparison use printed (`optimize.py:244,291,311,347,434-436`); inner search still analytic for speed — **disclosed as partial** in `REVIEW_RESPONSE.md` and `V0_3_SPEC.md`. | **PASS** (partial-scope honestly disclosed) |
| Halton-QMC estimator accuracy (F5) | Engine vs independent MC: robust +0.01 %, worst **−0.35 % at w=1 mm**; validation WARN at the 0.3 % pre-documented threshold. Threshold is documented, the estimator **fails it** at minimum width and is surfaced as WARN rather than tuned to pass — honest. | **PASS with WARN** (disclosed) |

---

## 2. Findings

### BLOCKER

**B1 — The pushed v0.3 commit ships stale v0.2 validation artifacts.**
- `git show HEAD:validation/results.json` → `{'total': 46, 'PASS': 45, 'WARN': 1, 'FAIL': 0}` with F4 observed **"+20.2 %; +28.7 %; +46.6 %; robust +25.2 % (union 32692 ± 72 mm³ vs analytic 40921 mm³)"** — i.e. the *retired, buggy-sampler* numbers. `git show HEAD:validation/VALIDATION.md` is headed **"# AnyRB independent validation report (v0.2)"** and contains no K1/K2/K3/L1 checks. HEAD is `19c9026` “AnyRB v0.3 — review response …”, pushed and in sync with `origin/main`.
- Consequence: every v0.3 claim in README/HACKATHON/REPORT/REVIEW_RESPONSE (53 checks, 51 PASS / 2 WARN / 0 FAIL, corrected +9.5 %) is **contradicted by the validation artifacts a judge/reviewer will read in the repo**. The stable working tree lacked the correct artifacts too after the commit.
- I re-ran the canonical `make validate`: **51 PASS / 2 WARN / 0 FAIL (53 checks, exit 0, 32.6 s)**; `validation/results.json` + `VALIDATION.md` now contain the v0.3 version (including K1/K2/K3, L1, corrected F4/F5). These three files (`validation/results.json`, `validation/VALIDATION.md`, `validation/figures/04_mass_overlap_vs_width.png`) are **modified/uncommitted relative to HEAD**.
- **Fix before submission:**
  ```bash
  cd anyrb
  make validate                       # already done — reproduces 51/2/0
  git add validation/ && git commit -m "v0.3 validation artifacts (53 checks; 51 PASS/2 WARN)"
  git push origin main
  ```
  Then re-check `git show HEAD:validation/results.json` shows 53 checks. This is the only thing standing between the repo and SHIP.

### MINOR

**M1 — `REPORT.md` §5 comparison table is stale vs the engine / qualification-report HTML; PDFs inherit it.**
`REPORT.md:181-186` (committed in `19c9026`) vs `reports/summary.json` / report HTML:

| Row | REPORT.md | Engine (printed mass) | report HTML |
|---|---|---|---|
| Uniform target-sized | **55.3 g** | **53.974 g** | 54.0 g |
| Uniform, same printed mass as robust | **46.0 g** | **46.254 g** | 46.3 g |
| Nominal SF 1.5 | **50.9 g** | **50.772 g** | 50.8 g |
| Mean-material SF 1.0 | **41.3 g** | **41.113 g** | 41.1 g |
| Solid note | "2.2× the mass" | printed ratio = **2.41×** (2.20× only on analytic basis) | — |

The savings sentence ("14 % printed-mass saving") matches the printed basis, so the table is internally mixed/stale. The PDFs were rebuilt 18:56 from this REPORT.md (`demo/build_pdf.py:128` reads `REPORT.md`), so `AnyRB_Research_Synthesis.pdf`/`Full_Research_Dossier.pdf` carry the stale table too. **Fix:** update the four table cells + 2.2×→2.4×, then `make pdf`.

**M2 — Batch-passport example is v0.2 behaviour and now understates compensation.**
`REPORT.md:188`, `HACKATHON.md:64`, `app/README.md:137` say a lot at 80 % nominal E needs **1.10× / +8.5 % mass, "pass with compensation"**. With v0.3's retained 12 % measurement CV, engine `lot_specific_recipe` gives for E×0.8: **global-equivalent scale 1.388×, +22.0 % printed mass, verdict "conditional (heavy compensation)"** (E×0.9: 1.15×/+14.9 %/conditional). The qualification report HTML batch table correctly carries the new values (E×0.75 1.443/+32.0 %, E×0.85 1.275/+20.2 %, E×0.95 1.143/+10.7 %, sy×0.8 1.086/+6.4 %). **Fix:** replace the stale example in REPORT/HACKATHON/app README (or state it is the no-measurement-CV counterfactual).

**M3 — Demo script mixes analytic start mass with printed end mass.**
`HACKATHON.md:62`: "optimise: **62.7 g → 46.4 g** at ~1 % failure probability". 62.7 g is the *analytic* uniform-2.0 mm mass; the printed basis is 55.9 g → 46.4 g (≈17 % reduction). As written the demo implies a ≈26 % optimisation gain and mixes mass bases. **Fix:** "55.9 g printed → 46.4 g printed (analytic basis 62.7 → 50.8 g)".

**M4 — Qualification report HTML omits the validation counts and both WARNs.**
`reports/qualification_report.html` contains no "WARN", "53", "validation suite" or 51/2/0 disclosure (only the row "Mean-material 51.2 %" incidentally contains "51"). README §validation, HACKATHON §honest limitations, REPORT §6/§231, VALIDATION.md and the app UI all disclose the two WARNs and counts correctly — but the flagship qualification artifact does not. **Fix:** add the 51 PASS / 2 WARN + F4/F5 sentences to the report's verification section and regenerate.

### NIT

- **N1** `app/aicore.js:813-816` hard-codes "analytic **50.78 g** vs printed union ≈46.40 g (**+9.4 %** upper bound)" while engine is **50.81 g / +9.5 %**; `app/config.js:252-253` reference block has `robust_printed_mass_g: 46.34` (JS Halton) beside `python_robust_printed_mass_g: 46.40`. User-visible disclosure text is ~0.05 % off and internally two-valued; align to the Python reference.
- **N2** The "uniform lattice, same printed mass as robust (46.4 g)" row is actually **46.25 g** (0.3 % lighter). Cause: `uniform_width_for_mass` bisects on a **10 k-sample** Halton estimate (`optimize.py:205-219`), whose noise is ~0.3 %; use n=60 k for the matching or label "≈46.4 g".
- **N3** `engine/anyrb/cli.py:34` `compare` prints `r.mass_g` (analytic) unlabelled, while REVIEW_RESPONSE says "every displayed/exported mass is the deterministic union estimate". Developer CLI only — either print both masses or scope the claim.
- **N4** `app/product_render.js:2` comment still says "AnyBatch v0.2" (inlined into the standalone build; comment only, not user-visible). Cosmetic rebrand residue.

---

## 3. Requested checks — results

| # | Check | Result |
|---|---|---|
| 1 | **Mass numbers across engine/app/report/docs** | **PASS with M1/M2/N1/N2**: engine 50.809 analytic / 46.400 printed / +9.50 %; app JS printed 46.34–46.40 (within 0.5 % contract); report HTML 46.4/54.0/46.3/50.8/41.1 correct; README/HACKATHON headline 46.4 printed + 50.8 analytic bound correct; REPORT.md table stale (M1) and batch example stale (M2); independent union cross-checks reproduce the corrected figures. |
| 2 | **Overstatement check** | No science overclaim. Honest partials: inner search analytic (disclosed), single topology "best of this bracket/lattice family" (disclosed), no physical validation (claim ladder L0–L1 verified / L2 partial / L4–L6 absent, repeated), sustained-load bound fails and part is labelled **not qualified for sustained load** (K1 + REPORT:280 + app), mass upper bound labelled. The only overstatements are the stale examples M2/M3 and the "every displayed mass" scope N3. |
| 3 | **Stale v0.2 numbers/method strings** | Retired 25 %/40.5 g only in explicit "retired/void" context (good). Stale content found: REPORT.md table (M1), batch example (M2), demo mass arithmetic (M3), app/branding NITs (N1/N4) — plus the **committed v0.2 validation artifacts (B1)** which is the material one. |
| 4 | **Validation WARN disclosure** | **PASS in docs/app** — README:93-98 (+ detail on F5), HACKATHON:108, REPORT §6/§231, `validation/VALIDATION.md` (F4/F5 sections), app UI counts ("51/53 pass · 2 warn"). **FAIL only in the qualification report HTML** (M4). WARN content: F4 analytic upper bound (+9.5 % robust), F5 Halton estimate worst 0.35 % at W_MIN — both quantified. |
| 5 | **F5 tolerance honesty** | **PASS (with note)**: the 0.3 % threshold is documented, the estimator **exceeds it** at w=1 mm (−0.35 %) and the check reports **WARN**, not PASS — i.e. not tuned to pass. Note: the 0.3 % threshold’s provenance is a design choice, not an independent standard; the WARN disclosure is the honest mitigant. Independent union MC agrees with the engine to ±0.04 g on the shipped design. |
| 6 | **Coupon pre-registration integrity** | **PASS (strong).** `validation/coupon_predictions.json` SHA-256 `pre_registration_hash = sha256:70fa40dc1a11f539…` recomputes **exactly** over the canonical payload (sorted keys, compact separators); the frozen bracket controls equal the current engine robust optimum (`controls match: True`); predicted printed/analytic masses equal current engine (46.400256 / 50.809429); `created_utc` predates measurement activity; no measured data exists (only blank `coupon_measurements_template.csv`); `compare_measurements.py` refuses files without a préregistration hash and the plan forbids post-hoc tuning; validation L1 passes (hash OK, prediction recompute rel 0.0). |
| 7 | **AI / grounding scope** | **PASS.** README:78-81, HACKATHON:40-41, REPORT:161-163 scope grounding to *AI-authored review and proof memos*; brief/lot parsing is schema-constrained/range-clamped; design proposals are engine-evaluated priors; feasibility gate blocks Design before any AI candidate. Matches code (`server/app.py` grounding on review/proof; `contract_v03.py` feasibility gate). Server v0.3 contract: **40 passed, 1 skipped** (`make test-server`). No "AI computes the numbers" claim. |
| 8 | **Repo hygiene (keys)** | **PASS.** No `.env`, cache, provenance or pycache files tracked (`git ls-files` clean); `git grep` across all revisions for `LLM_…`/key patterns = 0 hits; `.env` exists locally but is untracked/ignored, and `server/.env.example` holds only `LLM_your_key_here`; repo has origin `bnelabs/AnyRB`, `main` in sync with `origin/main`; HEAD `19c9026`. Untracked runtime artifacts (`server/cache/`, `server/provenance.jsonl`, `.pytest_cache/`) are ignored — exclude them if zipping the working tree. **Exception: B1 (stale validation artifacts in the commit).** |

---

## 4. Test/validation evidence re-run (this audit)

- `make test` → **29 tests OK** (25.8 s).
- `make validate` → **51 PASS / 2 WARN / 0 FAIL** (53 checks, exit 0, 32.6 s), regenerating v0.3 artifacts; F4/F5 WARN text as quoted above; K1 (sustained advisory), K2 (12 % measurement CV + resize recipe), K3 (feasibility gate), L1 (coupon pre-registration) all PASS.
- `node app/tests/run.mjs` → **33 passed** (v0.3 printability, feasibility gate, known-lot measurement CV + 8-control recipe, sustained-load advisory tests included).
- `make test-server` → **40 passed, 1 skipped** (v0.3 contract).
- Independent extras: union volume via validator code (46.395 ± 0.045 g) and 4000² grid (46.382 g) vs engine Halton 46.400 g; printability of all baseline designs (robust 1.375/21.9, nominal 1.461/19.8, mean-only 1.427/25.0 — all ≤1.5/≤30); measurement-CV material E_cv 0.1261 at 12 %; weak-lot family feasibility infeasible (min P_f 0.322); recipe E×0.8 → 1.388×/+22.0 %/conditional; coupon hash/controls/masses matched.

**Note on working tree:** B1 detection led me to regenerate the v0.3 validation artifacts with the project’s canonical `make validate`. Consequently three tracked files now differ from HEAD: `validation/results.json`, `validation/VALIDATION.md`, `validation/figures/04_mass_overlap_vs_width.png`. These are generated artifacts (not hand-edited); commit them as the B1 fix.

---

## 5. Bottom line

The v0.3 review response is substantively sound: the corrected mass audit is independently reproducible (46.40 g printed, +9.5 % analytic bound; uniform over-counts 5.6/12.2/27.9 %), the mass basis and printability constraints are real, measurement uncertainty/lot-specific resize/feasibility/creep-advisory are implemented and tested, the coupon pre-registration is tight, the AI grounding scope is accurate, and repo secrets hygiene is clean. **Ship after B1** (commit + push the regenerated v0.3 validation artifacts — one command) **and the quick doc fixes M1–M4** (REPORT table, batch example, demo arithmetic, report-HTML WARN line; then rebuild PDFs/report). No residual blockers after that.

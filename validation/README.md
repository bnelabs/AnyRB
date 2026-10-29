# AnyRB — independent validation package (v0.4)

Independent scientific validation of the AnyRB engine (Python reference + JS app contract). It is
deliberately separate from `engine/tests/` and `app/tests/`: the frame element is re-implemented from
the specification, the global system is assembled independently, reliability is re-derived with SciPy
quadrature / bivariate-normal CDF / Monte-Carlo, the optimiser is compared against a brute-force grid,
and the mass basis is audited against a high-precision independent union sampler.

**Current result: 55 PASS · 3 WARN · 0 FAIL (58 independent checks, ~57 s).**
The three WARNs are deliberate and documented: **F4** (analytic mass is a conservative upper bound),
**F5** (Halton-QMC printed-union estimate deviates by 0.35% at the W_MIN width w=1 mm; ≤0.1% at the
shipped designs), and **K8** (the generated report embeds validation counts from the previous run — run
`make report` after each validation to flip K8 to PASS). No FAIL means the shipped numbers reproduce and
the contract holds.

## Run

```bash
cd anyrb
make validate                                        # standalone suite -> results.json + VALIDATION.md + figures
.venv/bin/python validation/run_validation.py        # equivalent
.venv/bin/python -m pytest validation/pytest_checks.py -q   # optional CI wrappers (ratchet)
.venv/bin/python validation/generate_coupon_prereg.py       # re-issue coupon pre-registration (hash changes)
.venv/bin/python validation/compare_measurements.py --template measurements_template.csv
```

Outputs: `validation/results.json` (machine-readable per-check evidence), `validation/VALIDATION.md`
(generated report with a quotable "For the app" block, model-form bands, limitations, defect status),
`validation/figures/*.png` (5 figures), `validation/artifacts/` (regenerated fixture, JS cross-check),
`validation/COUPON_TEST_PLAN.md` + `coupon_predictions.json` + `compare_measurements.py` (L3+ path).

## How to read a status

- **PASS** — observed within the pre-registered tolerance; verified by an independent method.
- **WARN** — outside the target tolerance but explained and documented, and therefore surfaced to the
  product: analytic mass is a design-dependent upper bound (F4); the deterministic printed-union estimate
  is 0.35% low at the W_MIN width (F5). Neither invalidates the shipped design; both must be disclosed.
- **FAIL** — no acceptable explanation; the engine must change. The suite exits non-zero (currently 0).

Tolerances were fixed before inspecting results; do not tune them to turn a FAIL into a PASS.
`pytest_checks.py` is a ratchet: known-open defects must still fail until the engine is fixed.

## What was verified (51 PASS)

| Category | Established independently |
|---|---|
| **A. Code verification** | Frame element reproduces axial/cantilever closed forms (≤2e-16); rigid-body modes zero force; engine solve matches an independent assembly (≤1.7e-14); equilibrium/symmetry exact; linearity. |
| **B. Independent solver** | Potential-energy minimisation (L-BFGS-B) reproduces the direct stiffness displacements to ≤2e-7 relative. |
| **C. Reliability** | φ₂/`P_f` vs SciPy CDF (≤1.5e-13 for ρ≤0.95), independent double quadrature (3e-15), extreme ρ=0.99/0.999 and deep tails vs independent 1-D conditional quadrature (2.2e-16), 10⁶-sample Monte Carlo (max \|z\| 1.0), GL-order convergence, degenerate limits exact. |
| **D. Optimiser** | Reduced 2-parameter brute-force grid vs production pattern search (production 0.9% better, feasible); 200 random designs cannot beat it by >2%; shipped 8-parameter design feasible and independently reproduced. |
| **E. Homogenisation** | Periodic unit cell reproduces the analytical stretch-dominated axial stiffness within 0.15%, is isotropic, scales as w¹ (fit 1.000), satisfies Maxwell–Betti; shear within 3.2% of the truss estimate. |
| **F. Mass / STL** | Mass arithmetic exact; STL strut mesh and axis-aligned pad correct, signed volume exact. **F4**: analytic mass (sums struts, double-counts nodes) is a conservative upper bound: corrected over-count +5.6% (w=1), +12.2% (w=2), +27.9% (w=4), +9.5% shipped robust (analytic 50.81 g vs printed union 46.39 g). **F5**: engine's deterministic Halton-QMC printed mass matches an independent 2e6–10e6-sample MC to −0.35% worst case at w=1 (W_MIN) and ≤0.1% at the shipped designs. |
| **G. Material model** | Preset moments/CV/correlation recovered; two-level variance identity and hierarchical sampling; measured-lot path uses within-lot distribution. |
| **H. Cross-implementation** | Fixtures reproduce byte-identically; JS fixture/engine tests pass; live JS↔Python agreement ≤1e-6/≤1e-8. |
| **J. Model form** | **J1** cell-size/topology band (4×2…14×6 on the same 140×60 envelope): same-width spread u_tip 88%, σ_req 34%, E_req 495%; mass-matched spread u_tip 58%, σ_req 98%, E_req 23% — the 7×3 layout is the product contract. **J2** rigid frame vs pin-jointed truss: tip stiffness ×1.004, σ_req ×1.141, E_req ×0.997 (frame is conservative on strength demand, neutral on global stiffness; real printed joints lie between). |
| **K. v0.4 features** | **K4** printed-process gate: only FDM/FFF data may enter the model; rPET/rHDPE/rPP (IM/compression) are refused with `process_mismatch`, independent process-string probes all correct. **K5** brittle-lot screen: marginal lognormal `pf_brittle` matches independent `scipy.stats.lognorm`/Φ to ≤1e-12 using the elongation-specific lot/within split (rPETG 50% lot variance vs 85% for E/σy; measured lot f=1), reproduces the Lead reference values (lot 0.02 → 6.010388069466188e-07; 0.04 → 0.5280467959439502; measured-lot elongation CV 0.1854723699099141), monotone, zero-CV/NaN limits exact, `strain_req = σ_req/E_mean`, add-on estimate = headline + marginal, joint three-property probability explicitly not claimed, `brittle_ok` uses the documented fixed 1% screen (not the target). **K6** union polish: pre-polish vs final printed 60k mass recorded (declines when no compliant improvement), strict acceptance P_f ≤ target (1.000001 rounding tolerance, no 1.02× allowance), final feasible/printable, ≤0.5% vs independent union, runtime ~5 s. **K7** assumption bounds: corr 0.30/0.70 and lot split 75/95% match independent P_f (≤1e-12); range labelled assumption sensitivity, not validation. **K8** report/export disclosures present (brittle, assumptions, process, no-lot statement, app lot identity). |
| **K (v0.3). Sustained/recipe/feasibility** | **K1** sustained-load bound (creep ×2, compression ×0.8) gives P_f ≈ 1.0 and 4.02 mm bound deflection > 2.5 mm limit — the static design is **not** qualified for sustained load (advisory only). **K2** a known lot with 12% measurement CV keeps scatter (E_cv 0.126; known-lot P_f 0.0082 vs ~1e-16 at 0% CV); lot-specific recipe returns 8 self-consistent multipliers (global scale 1.00, printed 45.96 g, verdict "pass as designed"). **K3** feasibility gate matches independent W_MAX computation: rPETG feasible (P_f ≈ 0 ≤ 1%), synthetic weak material infeasible (min P_f 0.322 > 1%), so design is blocked before candidates are drawn. |
| **I. Claim scope** | L0/L1 demonstrated; L2 partial; L3 pre-registered only (no data); L4–L6 absent. 15 model-form limitations enumerated and quantified. |
| **L. Coupon plan** | Frozen blind-prediction package: geometry, material, predicted tip stiffness and first-yield load, uncertainty bands, protocol, acceptance criteria, SHA-256 pre-registration hash; `compare_measurements.py` ingests measured CSVs without editing the pre-registration. **No physical test is claimed.** |

## Coupon / bracket pre-registration (L3+ path)

`COUPON_TEST_PLAN.md` + `coupon_predictions.json` freeze, before any physical test exists:

| Specimen | Predicted tip stiffness | Predicted first-yield load | Mass basis |
|---|---|---|---|
| Coupon 3×2 cells, uniform 2.0 mm, 10 mm pad | 349.4 N/mm (0.43 mm @ 150 N) | 689.7 N | printed 22.0 g (analytic 24.3 g) |
| Shipped bracket 7×3 robust design | 74.6 N/mm (2.01 mm @ 150 N) | 366.9 N | printed 46.4 g (analytic 50.81 g) |

The v0.4 package also freezes the **brittle screen** predictions (bracket strain demand 0.896% vs
elongation 4.0% CV 0.20 → marginal P_f ≈ 3e-16; coupon 0.476%) and adds an ISO 527-2 elongation-coupon
test. Uncertainty is separated into material lot-to-lot (90% lognormal PI ≈ ×[0.86, 1.16]) and model form
(cell size J1; frame vs truss J2). Acceptance: stiffness ±25% per specimen, first-yield −25%/+35%,
measured elongation within the printed prior band, 90% interval coverage ≥80%; protocol: cantilever
fixture, 1 mm/min, ISO 291 conditioning, ISO 7500-1 calibration, ISO/ASTM 52921 + ASTM F2971 reporting,
blinded against the hash. Passing would support L4 for this geometry/process/material class only — not
certification. Reissue predictions only by re-running `generate_coupon_prereg.py`; check **L1** flags any
drift.

## Deliberate limitations (what this does NOT validate)

No physical specimen has been tested: the 2-D frame idealisation, joint compliance, layer anisotropy,
out-of-plane behaviour, plasticity, creep/fatigue, spatial defect statistics and literature-derived
material distributions are outside these checks. The cell-size and joint bands (J1/J2) are internal
model-form estimates, not experiments. The sustained-load bound is advisory arithmetic, not a creep
model. The brittle screen is a marginal add-on, not a joint three-property probability; the assumption
bounds are sensitivity to unmeasured values; the process gate restricts claim scope but does not validate
printed-part properties; the report's validation counts are generated artifacts (K8 WARN until
regenerated). The coupon/bracket package is pre-registered only. Claim level remains **L0–L1
(code/solution verification) with partial L2**, not L3–L6; nothing here supports certification, production
reliability, or ISO/ASTM/UL/PPWR compliance.

## For the demo / UI engineer — fields in `results.json`

| UI need | Field |
|---|---|
| Headline counts + runtime | `summary` → `{total, PASS, WARN, FAIL, runtime_s, exit_code}` |
| Mass disclosure (must show) | `checks[] id=="F4"` → `observed`, `notes`, `evidence.by_design.robust.{analytic_mm3, union_mm3, printed_engine_mm3, overcount_pct}`; `id=="F5"` for the estimator audit |
| Model-form bands | `checks[] id=="J1"/"J2"` → `evidence` (bands, ratios) |
| Sustained-load advisory | `checks[] id=="K1"` → `observed`, `notes` |
| Brittle screen / assumptions / process gate | `checks[] id=="K5"/"K7"/"K4"` → `evidence`; report `brittle_screen`, `assumptions`, `process_ok` |
| Claim badge / honesty card | `claim_ladder.L0_code_verified / L1_solution_verified / L2_literature_calibrated_uq / L3_literature_reproduced`; `model_form_limitations` (15 keys) |
| Audit line | `environment.engine_files` (engine SHA-256), `environment.fixture_sha256` |
| Figures | `figures` (6 paths) |

Displayed mass must be `printed_mass_g`; `mass_g` is only a conservative upper bound (label it).

## Reproducibility

- ~57 s, no network; fixed seeds (20261029, 7, 11, 42, 101, 2027, 5, 17, 23).
- `results.json` records Python/NumPy/SciPy/Matplotlib/Node versions, engine source SHA-256 and fixture
  SHA-256, so engine drift is detectable.
- Environment: `anyrb/.venv` (Python 3.15, NumPy 2.5, SciPy 1.18); Node ≥ 20 for the JS checks.

## Files

```
validation/
├── run_validation.py              # the suite (58 checks, standalone)
├── pytest_checks.py               # optional CI ratchet
├── README.md                      # this file
├── VALIDATION.md                  # generated report (quotable app summary at top)
├── results.json                   # generated machine-readable results
├── figures/                       # generated: 6 PNGs
├── artifacts/                     # generated: regenerated fixture, JS cross-check, CSV template
├── COUPON_TEST_PLAN.md            # pre-registered L3+ validation plan
├── coupon_predictions.json        # frozen blind predictions + SHA-256 pre-registration hash
├── compare_measurements.py        # measured-CSV -> prediction-error report (no data fabricated)
└── generate_coupon_prereg.py      # re-issue the pre-registration (new hash)
```

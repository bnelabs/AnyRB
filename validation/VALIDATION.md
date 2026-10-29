# AnyRB independent validation report (v0.2)

Generated: 2026-10-29T15:02:59+00:00 · Suite runtime 13.5 s · Python 3.15.2 · NumPy 2.5.4 · SciPy 1.18.1 · Matplotlib 3.11.2

**Independent** means: the frame element is re-implemented here, the global stiffness matrix is assembled here, reliability is re-derived with SciPy quadrature/CDF/Monte-Carlo, and the optimiser is checked against a brute-force grid. The engine is imported only where a check is explicitly *engine vs independent*. The suite is reproducible with `cd AnyRB && .venv/bin/python validation/run_validation.py`.

## For the app — quotable summary (generated)

- **Validation:** 45 PASS, 1 WARN, 0 FAIL across 46 independent checks (runtime 13 s, reproducible with `make validate`).
- **Claim level:** L0 (code verified) and L1 (solution verified) are demonstrated by independent checks; L2 (literature-calibrated UQ) is partial; L3-L6 are absent — no physical validation exists.
- **The one WARN:** F4 — node-overlap mass over-count: the analytic mass is a conservative upper bound (+29% at w=2 mm, +25% at the robust design); printed mass is lower. Quote reported mass as 'conservative analytic mass', not as printed mass.

## Summary

| PASS | WARN | FAIL | total |
|---|---|---|---|
| 45 | 1 | 0 | 46 |

Interpretation: **PASS** = observed within the pre-registered tolerance. **WARN** = outside the target tolerance but explained and documented (a known conservative approximation or a deliberately coarse analytical reference); it must be surfaced, not hidden. **FAIL** = outside tolerance without an acceptable explanation; the engine must be changed before the claim stands. Tolerances were fixed before the numbers were inspected and were not tuned to pass.

## Open issues (WARN) — actionable

- **WARN F4 — Node-overlap over-count of the reported mass (known limitation, quantified).** w=1.0: +20.2% ; w=2.0: +28.7% ; w=4.0: +46.6% robust design: +25.2% (union 32692 +/- 72 mm^3 vs analytic 40921 mm^3). The engine documents 'mass sums strut volumes without subtracting node overlap (conservative)'. Quantified consequence: +20.2% at w=1, +28.7% at w=2, +46.6% at w=4, +25.2% at the shipped robust design. The bias is design-dependent, so absolute mass claims and mass-based rankings can shift. Disclosure to be surfaced in the app/report: 'printed mass (union) ~40.5 g vs analytic 50.7 g (conservative)'. Recommended engine change: compute a unique union volume (clip overlapping strut segments) or report nominal-solid vs summed mass separately.

## Results

| ID | Category | Check | Method | Tolerance | Observed | Status |
|---|---|---|---|---|---|---|
| A1 | A | Pure axial bar elongation | Independent assembly of one frame element; fixed node 0, unit axial load | relative error <= 1e-10 | rel err 0.000e+00 (u=4.761904761905e-04 mm) | **PASS** |
| A2 | A | Single-element cantilever tip deflection and rotation | Independent element assembly, fixed node, unit tip load | relative error <= 1e-10 (both) | rel err u 1.46e-16, theta 0.00e+00 | **PASS** |
| A3-tran | A | Rigid-body translation gives zero internal force | Independent 3-element assembly; apply exact rigid translation/rotation | max |K u| / (EA/L) <= 1e-10 | rel 0.000e+00 | **PASS** |
| A3-rota | A | Rigid-body rotation gives zero internal force | Independent 3-element assembly; apply exact rigid translation/rotation | max |K u| / (EA/L) <= 1e-10 | rel 2.115e-19 | **PASS** |
| A4 | A | Engine unit-load solve matches an independent assembly | Independent assembly + NumPy direct solve vs anyrb.mechanics.solve_unit | relative error <= 1e-9 (u, N, M1) | rel err u 9.45e-15, N 1.27e-14, M1 1.74e-14 | **PASS** |
| A5 | A | Global equilibrium of the full lattice | Independent assembly reactions vs applied unit tip load | relative residual <= 1e-12 (force, moment, free residual) | force 6.57e-14, moment 7.28e-14, free 9.95e-14 | **PASS** |
| A6 | A | Reflection symmetry and load-reversal symmetry | DOF permutation + sign map on independent stiffness matrix; solve reversed load | relative error <= 1e-10 | K symmetry 0.00e+00, u symmetry 0.00e+00 | **PASS** |
| A7 | A | Demand linearity in applied load | Engine demands at F=150 N and F=300 N on a graded design | relative deviation from exact scaling <= 1e-13 | 0.00e+00 | **PASS** |
| B-uniform | B | Energy minimisation matches direct stiffness solve (uniform) | Minimise 0.5 u^T K u - f^T u with L-BFGS-B on free DOFs; compare with direct solve | relative displacement error <= 1e-6; grad norm <= 1e-6 | rel u 8.85e-08, \|grad\| 2.27e-07, energy rel 6.16e-15 | **PASS** |
| B-graded | B | Energy minimisation matches direct stiffness solve (graded) | Minimise 0.5 u^T K u - f^T u with L-BFGS-B on free DOFs; compare with direct solve | relative displacement error <= 1e-6; grad norm <= 1e-6 | rel u 2.04e-07, \|grad\| 3.10e-07, energy rel 2.85e-14 | **PASS** |
| C1 | C | Closed-form Phi2 vs SciPy bivariate-normal CDF (rho <= 0.95) | 48-point GL (engine) vs scipy.stats.multivariate_normal.cdf over 24 cases | max absolute error <= 1e-9 | 3.33e-15 (worst a,b,rho=(2.5, 2.5, 0.0)) | **PASS** |
| C1b | C | Extreme-correlation/deep-tail Phi2 vs independent conditional 1-D quadrature | scipy.integrate.quad of phi(x)*Phi((b-rho*x)/s) over finite [a-40,a], split at the conditional median; rho=0.99/0.999 and deep tails (a down to -8); only univariate phi/Phi used in the reference | max absolute error <= 1e-8 and max relative error <= 1e-6 where reference > 1e-10 | max abs err 2.22e-16 (worst rho,a,b=(0.99, 2.5, 2.5)); max rel err 5.61e-08 | **PASS** |
| C2 | C | Closed-form Phi2 vs independent double quadrature | dblquad over (-inf,a]x(-inf,b] vs engine 48-point GL | max absolute error <= 1e-8 | 3.44e-15 | **PASS** |
| C3 | C | Analytic P_f vs 10^6 Monte-Carlo samples | 5 threshold pairs x 3 correlations x 1e6 standard bivariate normal samples | max |z-score| <= 4 (99.99% sampling band; 15 comparisons) | max \|z\| 1.04 | **PASS** |
| C4 | C | Actual design P_f vs 10^6 lognormal MC | 1e6 engine samples at lot level vs closed form | |z-score| <= 4 | analytic 8.220e-05, MC 8.600e-05 +/- 9.1e-06, z=0.42 | **PASS** |
| C5 | C | Gauss-Legendre quadrature-order convergence (12/24/48/96) | Same integrand integrated at 12/24/48/96/192 GL points, compared to SciPy | error(48) <= 1e-10 and non-increasing trend | err48 1.78e-15, err96 2.00e-15, errors ['2.3e-04', '1.0e-09', '1.8e-15', '2.0e-15', '5.4e-15'] | **PASS** |
| C6 | C | Lognormal parameterisation recovers target mean/CV/correlation | 2e6 samples at lot level; sample moments vs targets | mean rel err <= 0.5%, CV rel err <= 2%, corr abs err <= 0.005 | mean E +5.88e-05, CV E +5.67e-04, mean sy +9.88e-05, CV sy -2.59e-04, corr 0.5504 vs 0.55 | **PASS** |
| C7 | C | Two-level variance decomposition and hierarchical sampling | Parameter identity + 2000 lots x 500 within-lot specimens | CV^2 identity <= 1e-6 (fractions rounded to 5 dp); sigma^2 identity <= 1e-4; hierarchical CV rel <= 2% | param identity 6.9e-08, sigma^2 identity 1.3e-05, hierarchical CV 0.0994 vs 0.1 (-6.13e-03) | **PASS** |
| C8 | C | Measured-lot override changes the distribution level correctly | Semantics + P_f for measured lot 2300 MPa / 50 MPa against robust-design demands | exact semantics; known-lot P_f < 1e-3 and lot-level equals within-level (zero lot CV) | semantics=True, P_f known 7.22e-16, lot-level 0.00e+00 | **PASS** |
| C9 | C | Degenerate (zero-variance) marginal and extreme-threshold limits | Constructed degenerate Material; compare P_f to deterministic indicator; extreme demands | exact indicator match <= 1e-15; finite results for extreme demands | degenerate ok=True, extreme sum=1.000000 | **PASS** |
| D1 | D | Brute-force grid baseline on the reduced 2-parameter family | 2109 evaluations of anyrb.evaluate (~5.2 s) | grid must contain feasible designs | best mass 53.311 g (w0=1.35, g=0.40, pf=0.0028); feasible 1346 | **PASS** |
| D2 | D | Production pattern search vs brute-force grid (2 parameters) | 4 deterministic starts x up to 1500 evals (~0.8 s) via an 8-D wrapper | feasible (P_f <= target) and mass <= grid best * 1.01 | mass 52.812 g vs grid 53.311 g (-0.94%), pf 0.0078, w0=1.34, g=0.40 | **PASS** |
| D3 | D | 200 random designs cannot beat the optimiser by > 2% | 200 uniform random (w0, g) designs vs the fixed optimiser result | no feasible random design lighter than 0.98 x optimiser mass | random best 56.161 g (feasible 134/200) vs 53.311 g | **PASS** |
| D4 | D | Shipped robust design is feasible and independently reproducible | Recompute demands with independent assembly; P_f via SciPy bivariate normal; mass from widths | pf <= target; |pf_diff| <= 1e-8; mass rel diff <= 1e-10; widths in bounds | reported pf 0.009834 vs independent 0.009834; mass 50.742 g vs independent 50.742 g; widths [1.18,2.01] mm; target 0.01 | **PASS** |
| D5 | D | Printability metrics are reported, not silently rejected | Engine printability_report vs manual recomputation on the robust design | values match <= 1e-12; out_of_bounds False | min/max width 1.18/2.01 mm, slenderness 22.70 (limit 30), neighbour ratio 1.457 (limit 1.5), out_of_bounds False | **PASS** |
| E1 | E | Unit-cell axial stiffness vs independent pin-jointed truss estimate | Periodic/affine BC frame solve (6 elements, rotations free) vs C11_truss = E_s (w/L)(2 + 1/sqrt2) | relative error <= 5e-3 (frame vs pin-jointed difference grows with w) | max rel err 1.43e-03 over w=1..3 mm | **PASS** |
| E2 | E | In-plane isotropy of the square X-braced cell | Two unit-strain states of the same periodic cell | relative difference <= 1e-8 | 0.00e+00 | **PASS** |
| E3 | E | Shear stiffness vs pin-jointed truss estimate | Simple-shear macro strain; compare with G_truss = E_s (w/L)/sqrt2 | relative error <= 5% | max rel err 3.18% over w=1..3 mm (grows with w: +0.4% at w=1, +3.2% at w=3) | **PASS** |
| E4 | E | Stiffness scaling exponent vs relative density | Power-law fit of C11 vs w from the periodic cell | fitted exponent in [0.95, 1.05] | fitted exponent 1.0011 (intercept 0.999) | **PASS** |
| E5 | E | Maxwell-Betti symmetry of the effective stiffness matrix | Stress-based C12 (sigma22/eps11) vs C21 (sigma11/eps22) | relative difference <= 1e-8 | 2.22e-16 | **PASS** |
| E6 | E | Energy-based vs stress-based stiffness consistency | Two independent post-processes of the same periodic-cell solution | relative difference <= 1e-8 | 2.22e-16 | **PASS** |
| F1 | F | Width field, strut volume and mass recomputed independently | Independent bilinear interpolation from the 8 controls + strut volume + pad | width and mass relative difference <= 1e-12 | width abs diff 0.00e+00 mm, mass rel diff 0.00e+00 (53.6601 g) | **PASS** |
| F2a | F | STL strut mesh: count, finite coordinates, envelope, non-degenerate | lattice_triangles on uniform w=2; strut triangles = 94x12 = 1128 | count == 1128; all finite; all areas > 1e-10; bounds inside [10-w/2, 150+w/2] x [-w/2, 60+w/2] x [-5,5] | 1128 strut triangles, bounds x[9.00,151.00] y[-1.00,61.00] z[-5.00,5.00], min area 10.00 | **PASS** |
| F2b | F | STL wall-pad mesh is the nominal 10x60x10 prism | anyrb.stl._pad_triangles: pad box vertices (first 12 triangles of the export) | all pad vertex coordinates within 1e-9 of the nominal 10x60x10 box | pad bounds x[0.00,10.00] y[0.00,60.00] z[-5.00,5.00] mm | **PASS** |
| F3 | F | STL signed volume equals the summed strut + pad volume | Divergence-theorem volume over all 1140 triangles vs analytic sum | relative difference <= 1e-9 | STL 50558.79 mm^3 vs analytic 50558.79 mm^3 (4.32e-16) | **PASS** |
| F4 | F | Node-overlap over-count of the reported mass (known limitation, quantified) | Monte-Carlo union volume of the actual box geometry (400k samples) vs analytic sum, w=1/2/4 mm + robust design | documented, expected conservative bias; over-count < 50% and must be reported (WARN, not hidden) | w=1.0: +20.2% ; w=2.0: +28.7% ; w=4.0: +46.6% robust design: +25.2% (union 32692 +/- 72 mm^3 vs analytic 40921 mm^3) | **WARN** |
| G1 | G | rPETG preset moments and correlation recovered by sampling | Monte-Carlo moment recovery on the shipped preset | mean <= 0.5% rel; CV <= 2% rel; corr <= 0.005 abs | E mean -2.92e-05, E CV -5.15e-05, sy mean -1.37e-05, sy CV -1.34e-03, corr 0.5496/0.55 | **PASS** |
| G2 | G | Two-level CV split: CV_lot^2 + CV_within^2 = CV_total^2 | Engine params('lot'/'within'/'total') + fractions identity | identity <= 1e-6 and combined fraction within 1e-5 of 1 (fractions rounded to 5 dp) | identity 6.9e-08, combined fraction 0.999996546, variance split 0.8500/0.1500 | **PASS** |
| G3 | G | Hierarchical lot->specimen sampling reproduces total CV | Draw lot means with CV_lot then specimens with CV_within; estimate total CV | relative error <= 1% | total CV 0.1003 vs 0.1 (+2.74e-03) | **PASS** |
| G4 | G | Measured-lot path uses within-lot distribution | Compare lot_pass_probability with failure_probability(level='within') | exact equality; input material not mutated | 4.947828e-06 vs 4.947828e-06 | **PASS** |
| H1 | H | Frozen fixtures reproduce from the current Python engine | 5 cases in app/tests/fixtures/reference.json | deterministic fields rel diff <= 1e-12; P_f abs diff <= 1e-12 | max rel 0.00e+00 (), max \|dP_f\| 0.00e+00 | **PASS** |
| H2 | H | Frozen fixture regenerates byte-identically | Reconstructed fixture dict (robust controls taken from fixture) re-serialised with json.dump(indent=1) | byte-identical files | identical (30074 vs 30074 bytes); regenerated at artifacts/reference_regenerated.json | **PASS** |
| H3 | H | JavaScript engine/fixture cross-language tests pass | node app/tests/run.mjs fixture (engine/fixture scope) + full suite for transparency | filtered engine/fixture tests: exit 0 and 0 failures | 1 passed, 0 failed, 0 skipped (filter 'fixture'), exit 0, 4.0 s | **PASS** |
| H4 | H | Live JavaScript vs Python cross-implementation agreement | node ESM cross-check script computing all five cases in app/engine.js | deterministic fields rel <= 1e-6; P_f abs <= 1e-8 | max rel 4.77e-14 (uniform_w1.5:sigma_req_MPa), max \|dP_f\| 1.07e-13 over 5 cases | **PASS** |
| I1 | I | Claim-ladder mapping (L0-L2) updated by this validation | Mapping of A-H results onto the dossier-05 claim ladder | documentation consistent with evidence (no over-claim) | L0 achieved, L1 achieved, L2 partial, L3+ absent | **PASS** |
| I2 | I | Model-form limitations are enumerated and quantified where possible | Limitations register compiled from PRODUCT_SPEC §7, REPORT §6 and checks A-H | all known major limitations listed | 11 limitations documented | **PASS** |

## A. FE element benchmarks, rigid body, equilibrium, symmetry

### A1 — Pure axial bar elongation [PASS]

- **Claim:** The 2-D frame element reproduces the exact bar formula
- **Method:** Independent assembly of one frame element; fixed node 0, unit axial load
- **Tolerance:** relative error <= 1e-10
- **Observed:** rel err 0.000e+00 (u=4.761904761905e-04 mm)

### A2 — Single-element cantilever tip deflection and rotation [PASS]

- **Claim:** Frame element reproduces Euler-Bernoulli FL^3/3EI and FL^2/2EI
- **Method:** Independent element assembly, fixed node, unit tip load
- **Tolerance:** relative error <= 1e-10 (both)
- **Observed:** rel err u 1.46e-16, theta 0.00e+00

### A3-tran — Rigid-body translation gives zero internal force [PASS]

- **Claim:** The assembled stiffness matrix annihilates rigid-body modes
- **Method:** Independent 3-element assembly; apply exact rigid translation/rotation
- **Tolerance:** max |K u| / (EA/L) <= 1e-10
- **Observed:** rel 0.000e+00

### A3-rota — Rigid-body rotation gives zero internal force [PASS]

- **Claim:** The assembled stiffness matrix annihilates rigid-body modes
- **Method:** Independent 3-element assembly; apply exact rigid translation/rotation
- **Tolerance:** max |K u| / (EA/L) <= 1e-10
- **Observed:** rel 2.115e-19

### A4 — Engine unit-load solve matches an independent assembly [PASS]

- **Claim:** Engine solve_unit == independent 94-element frame assembly
- **Method:** Independent assembly + NumPy direct solve vs anyrb.mechanics.solve_unit
- **Tolerance:** relative error <= 1e-9 (u, N, M1)
- **Observed:** rel err u 9.45e-15, N 1.27e-14, M1 1.74e-14

### A5 — Global equilibrium of the full lattice [PASS]

- **Claim:** Reaction forces balance applied force and moment; free-DOF residual vanishes
- **Method:** Independent assembly reactions vs applied unit tip load
- **Tolerance:** relative residual <= 1e-12 (force, moment, free residual)
- **Observed:** force 6.57e-14, moment 7.28e-14, free 9.95e-14

### A6 — Reflection symmetry and load-reversal symmetry [PASS]

- **Claim:** Bracket is symmetric about y=30 mm: reflected stiffness equal, reversed load flips v and theta
- **Method:** DOF permutation + sign map on independent stiffness matrix; solve reversed load
- **Tolerance:** relative error <= 1e-10
- **Observed:** K symmetry 0.00e+00, u symmetry 0.00e+00

### A7 — Demand linearity in applied load [PASS]

- **Claim:** sigma_req, E_req and tip deflection scale linearly with F for a linear model
- **Method:** Engine demands at F=150 N and F=300 N on a graded design
- **Tolerance:** relative deviation from exact scaling <= 1e-13
- **Observed:** 0.00e+00

## B. Independent energy-minimisation solver

### B-uniform — Energy minimisation matches direct stiffness solve (uniform) [PASS]

- **Claim:** Energy minimisation and direct stiffness solve agree on the same assembled system
- **Method:** Minimise 0.5 u^T K u - f^T u with L-BFGS-B on free DOFs; compare with direct solve
- **Tolerance:** relative displacement error <= 1e-6; grad norm <= 1e-6
- **Observed:** rel u 8.85e-08, |grad| 2.27e-07, energy rel 6.16e-15
- **Notes:** L-BFGS-B success=True, nit=109

### B-graded — Energy minimisation matches direct stiffness solve (graded) [PASS]

- **Claim:** Energy minimisation and direct stiffness solve agree on the same assembled system
- **Method:** Minimise 0.5 u^T K u - f^T u with L-BFGS-B on free DOFs; compare with direct solve
- **Tolerance:** relative displacement error <= 1e-6; grad norm <= 1e-6
- **Observed:** rel u 2.04e-07, |grad| 3.10e-07, energy rel 2.85e-14
- **Notes:** L-BFGS-B success=True, nit=132

## C. Reliability: closed form, quadrature, SciPy, Monte Carlo

### C1 — Closed-form Phi2 vs SciPy bivariate-normal CDF (rho <= 0.95) [PASS]

- **Claim:** Engine's Gauss-Legendre Phi2 agrees with SciPy's independent implementation for rho <= 0.95
- **Method:** 48-point GL (engine) vs scipy.stats.multivariate_normal.cdf over 24 cases
- **Tolerance:** max absolute error <= 1e-9
- **Observed:** 3.33e-15 (worst a,b,rho=(2.5, 2.5, 0.0))

### C1b — Extreme-correlation/deep-tail Phi2 vs independent conditional 1-D quadrature [PASS]

- **Claim:** The engine's extreme-rho path is genuinely verified, not SciPy-vs-SciPy
- **Method:** scipy.integrate.quad of phi(x)*Phi((b-rho*x)/s) over finite [a-40,a], split at the conditional median; rho=0.99/0.999 and deep tails (a down to -8); only univariate phi/Phi used in the reference
- **Tolerance:** max absolute error <= 1e-8 and max relative error <= 1e-6 where reference > 1e-10
- **Observed:** max abs err 2.22e-16 (worst rho,a,b=(0.99, 2.5, 2.5)); max rel err 5.61e-08
- **Notes:** The engine delegates to SciPy's bivariate-normal CDF for |rho|>0.9 (and for extreme a/b); this check validates that path against independent 1-D conditional quadrature, and the independent JavaScript implementation is cross-checked in H4. The reference uses only scipy.special.ndtr and phi, never the bivariate CDF. The first validation run (2026-10-29) found ~3.1e-6 error at rho=0.99 with the original fixed 48-point GL rule, which motivated the delegation; this check is retained as a regression guard.
- **Evidence:** `{"rows": [{"rho": 0.99, "a": -2.5, "b": 1.2, "engine": 0.006209665325776159, "independent_quad": 0.006209665325776135, "abs_err": 2.42861286636753e-17, "rel_err": 3.911020544515387e-15, "quad_err_est": 1.4247570585673596e-16}, {"rho": 0.99, "a": 0.3, "b": -1.1, "engine": 0.13566606094638262, "independent_quad": 0.13566606094638267, "abs_err": 5.551115123125783e-17, "rel_err": 4.091749317701256e-16, "quad_err_est": 9.775296528340435e-15}, {"rho": 0.99, "a": 2.5, "b": 2.5, "engine": 0.9928057299327883, "independent_quad": 0.9928057299327885, "abs_err": 2.220446049250313e-16, "rel_err": 2.236536295374357e-16, "quad_err_est": 7.707180487194924e-14}, {"rho": 0.99, "a": -4.0, "b": -3.5, "engine": 3.16687845323127e-05, "independent_quad": 3.166878453234673e-05, "abs_err": 3.403039568888877e-17, "rel_err": 1.0745722070302343e-12, "quad_err_est": 3.517166802332819e-19}, {"rho": 0.99, "a": -6.0, "b": -1.0, "engine": 9.865877004244794e-10, "independent_quad": 9.865876450376995e-10, "abs_err": 5.538677986987196e-17, "rel_err": 5.6139746071678724e-08, "quad_err_est": 8.865656379699596e-15}, {"rho": 0.99, "a": -8.0, "b": -2.0, "engine": 6.661338147750939e-16, "independent_quad": 6.31790374004179 …`

### C2 — Closed-form Phi2 vs independent double quadrature [PASS]

- **Claim:** Engine Phi2 agrees with scipy.integrate.dblquad of the bivariate normal density
- **Method:** dblquad over (-inf,a]x(-inf,b] vs engine 48-point GL
- **Tolerance:** max absolute error <= 1e-8
- **Observed:** 3.44e-15

### C3 — Analytic P_f vs 10^6 Monte-Carlo samples [PASS]

- **Claim:** Engine closed form lies within Monte-Carlo sampling error for rho=0/0.6/0.95 incl. tails
- **Method:** 5 threshold pairs x 3 correlations x 1e6 standard bivariate normal samples
- **Tolerance:** max |z-score| <= 4 (99.99% sampling band; 15 comparisons)
- **Observed:** max |z| 1.04
- **Evidence:** `{"rows": [{"rho": 0.0, "a": -2.5, "b": -1.0, "mc": 0.000994, "exact": 0.0009851960290904183, "z": 0.28062819995863364}, {"rho": 0.0, "a": -1.5, "b": 0.5, "mc": 0.04632, "exact": 0.04619467182019299, "z": 0.5970667921637175}, {"rho": 0.0, "a": 0.0, "b": -2.0, "mc": 0.01148, "exact": 0.011375065974089604, "z": 0.9895177602319989}, {"rho": 0.0, "a": 1.5, "b": 1.5, "mc": 0.870783, "exact": 0.8708487996036616, "z": -0.19620165904688802}, {"rho": 0.0, "a": -3.0, "b": -2.5, "mc": 1.1e-05, "exact": 8.38241500034087e-06, "z": 0.904103258125663}, {"rho": 0.6, "a": -2.5, "b": -1.0, "mc": 0.005034, "exact": 0.004975179408664432, "z": 0.836003423591032}, {"rho": 0.6, "a": -1.5, "b": 0.5, "mc": 0.065525, "exact": 0.06532685182360426, "z": 0.8018891400763904}, {"rho": 0.6, "a": 0.0, "b": -2.0, "mc": 0.021871, "exact": 0.02180436389821444, "z": 0.4562732537644809}, {"rho": 0.6, "a": 1.5, "b": 1.5, "mc": 0.889084, "exact": 0.8891798860691565, "z": -0.3054579297101532}, {"rho": 0.6, "a": -3.0, "b": -2.5, "mc": 0.000328, "exact": 0.00034743308707441134, "z": -1.0427535240987842}, {"rho": 0.95, "a": -2.5, "b": -1.0, "mc": 0.006276, "exact": 0.006209659864737538, "z": 0.8444910690817186}, {"rho": 0.95, …`

### C4 — Actual design P_f vs 10^6 lognormal MC [PASS]

- **Claim:** Analytic P_f for uniform_w2.0/rPETG agrees with MC from the engine two-level sampler
- **Method:** 1e6 engine samples at lot level vs closed form
- **Tolerance:** |z-score| <= 4
- **Observed:** analytic 8.220e-05, MC 8.600e-05 +/- 9.1e-06, z=0.42

### C5 — Gauss-Legendre quadrature-order convergence (12/24/48/96) [PASS]

- **Claim:** Engine's 48-point rule is converged; error decreases with order
- **Method:** Same integrand integrated at 12/24/48/96/192 GL points, compared to SciPy
- **Tolerance:** error(48) <= 1e-10 and non-increasing trend
- **Observed:** err48 1.78e-15, err96 2.00e-15, errors ['2.3e-04', '1.0e-09', '1.8e-15', '2.0e-15', '5.4e-15']
- **Evidence:** `{"errors_by_order": {"12": 0.00022520004969417418, "24": 9.961590441420753e-10, "48": 1.7763568394002505e-15, "96": 1.9984014443252818e-15, "192": 5.440092820663267e-15}}`

### C6 — Lognormal parameterisation recovers target mean/CV/correlation [PASS]

- **Claim:** Material.params/sample reproduce the declared arithmetic mean, CV and log-correlation
- **Method:** 2e6 samples at lot level; sample moments vs targets
- **Tolerance:** mean rel err <= 0.5%, CV rel err <= 2%, corr abs err <= 0.005
- **Observed:** mean E +5.88e-05, CV E +5.67e-04, mean sy +9.88e-05, CV sy -2.59e-04, corr 0.5504 vs 0.55

### C7 — Two-level variance decomposition and hierarchical sampling [PASS]

- **Claim:** CV_lot^2 + CV_within^2 = CV_total^2 and hierarchical sampling reproduces total CV
- **Method:** Parameter identity + 2000 lots x 500 within-lot specimens
- **Tolerance:** CV^2 identity <= 1e-6 (fractions rounded to 5 dp); sigma^2 identity <= 1e-4; hierarchical CV rel <= 2%
- **Observed:** param identity 6.9e-08, sigma^2 identity 1.3e-05, hierarchical CV 0.0994 vs 0.1 (-6.13e-03)
- **Notes:** Exact identity holds before rounding; Material stores lot/within fractions rounded to 5 decimal places, leaving 6.9e-8 absolute in CV^2 and 1.3e-5 in sigma^2 from the log1p transform. This is a documentation/precision issue, not a model error.

### C8 — Measured-lot override changes the distribution level correctly [PASS]

- **Claim:** lot_from_measurement replaces lot means, zeroes lot CV, keeps within CV; known-lot P_f uses within level
- **Method:** Semantics + P_f for measured lot 2300 MPa / 50 MPa against robust-design demands
- **Tolerance:** exact semantics; known-lot P_f < 1e-3 and lot-level equals within-level (zero lot CV)
- **Observed:** semantics=True, P_f known 7.22e-16, lot-level 0.00e+00

### C9 — Degenerate (zero-variance) marginal and extreme-threshold limits [PASS]

- **Claim:** failure_probability handles zero-CV marginals and extreme demands without NaN/overflow
- **Method:** Constructed degenerate Material; compare P_f to deterministic indicator; extreme demands
- **Tolerance:** exact indicator match <= 1e-15; finite results for extreme demands
- **Observed:** degenerate ok=True, extreme sum=1.000000

## D. Optimiser vs brute-force grid

### D1 — Brute-force grid baseline on the reduced 2-parameter family [PASS]

- **Claim:** A 57x37 grid establishes the reference optimum of the uniform-width + root-gradient family
- **Method:** 2109 evaluations of anyrb.evaluate (~5.2 s)
- **Tolerance:** grid must contain feasible designs
- **Observed:** best mass 53.311 g (w0=1.35, g=0.40, pf=0.0028); feasible 1346

### D2 — Production pattern search vs brute-force grid (2 parameters) [PASS]

- **Claim:** Deterministic engine pattern_search finds a feasible design within +1% of the grid optimum
- **Method:** 4 deterministic starts x up to 1500 evals (~0.8 s) via an 8-D wrapper
- **Tolerance:** feasible (P_f <= target) and mass <= grid best * 1.01
- **Observed:** mass 52.812 g vs grid 53.311 g (-0.94%), pf 0.0078, w0=1.34, g=0.40

### D3 — 200 random designs cannot beat the optimiser by > 2% [PASS]

- **Claim:** Random sampling of the reduced design space is not a substitute for the optimiser
- **Method:** 200 uniform random (w0, g) designs vs the fixed optimiser result
- **Tolerance:** no feasible random design lighter than 0.98 x optimiser mass
- **Observed:** random best 56.161 g (feasible 134/200) vs 53.311 g

### D4 — Shipped robust design is feasible and independently reproducible [PASS]

- **Claim:** The v0.2 robust optimum meets its reliability constraint and its reported P_f/mass reproduce
- **Method:** Recompute demands with independent assembly; P_f via SciPy bivariate normal; mass from widths
- **Tolerance:** pf <= target; |pf_diff| <= 1e-8; mass rel diff <= 1e-10; widths in bounds
- **Observed:** reported pf 0.009834 vs independent 0.009834; mass 50.742 g vs independent 50.742 g; widths [1.18,2.01] mm; target 0.01

### D5 — Printability metrics are reported, not silently rejected [PASS]

- **Claim:** Width bounds satisfied; neighbour ratio and slenderness reported with correct values
- **Method:** Engine printability_report vs manual recomputation on the robust design
- **Tolerance:** values match <= 1e-12; out_of_bounds False
- **Observed:** min/max width 1.18/2.01 mm, slenderness 22.70 (limit 30), neighbour ratio 1.457 (limit 1.5), out_of_bounds False
- **Notes:** Ratio 1.457 and slenderness 22.7 are close to the advisory printability limits; they are reported as warnings in the app and are not optimisation constraints.

## E. Periodic unit-cell homogenisation

### E1 — Unit-cell axial stiffness vs independent pin-jointed truss estimate [PASS]

- **Claim:** C11 (and C22) of the X-braced cell equals the analytical truss estimate to frame-rotation accuracy
- **Method:** Periodic/affine BC frame solve (6 elements, rotations free) vs C11_truss = E_s (w/L)(2 + 1/sqrt2)
- **Tolerance:** relative error <= 5e-3 (frame vs pin-jointed difference grows with w)
- **Observed:** max rel err 1.43e-03 over w=1..3 mm
- **Notes:** Residual is the frame's rotational compatibility at shared nodes: the pin-jointed truss estimate has no bending, the frame cell must bend slightly; error is <0.15%.

### E2 — In-plane isotropy of the square X-braced cell [PASS]

- **Claim:** E1 == E2 for the square cell (C11 = C22)
- **Method:** Two unit-strain states of the same periodic cell
- **Tolerance:** relative difference <= 1e-8
- **Observed:** 0.00e+00

### E3 — Shear stiffness vs pin-jointed truss estimate [PASS]

- **Claim:** G12 is of the same order and follows the same w-scaling as the truss estimate
- **Method:** Simple-shear macro strain; compare with G_truss = E_s (w/L)/sqrt2
- **Tolerance:** relative error <= 5%
- **Observed:** max rel err 3.18% over w=1..3 mm (grows with w: +0.4% at w=1, +3.2% at w=3)
- **Notes:** Frame action stiffer than pin-jointed estimate for shear because shared-node rotation constraints force bending; documented, not a failure.

### E4 — Stiffness scaling exponent vs relative density [PASS]

- **Claim:** C11 ~ w^1 (stretch-dominated scaling, exponent 1) over w=1..3 mm
- **Method:** Power-law fit of C11 vs w from the periodic cell
- **Tolerance:** fitted exponent in [0.95, 1.05]
- **Observed:** fitted exponent 1.0011 (intercept 0.999)
- **Notes:** The Gibson-Ashby-like reference for a stretching-dominated lattice is exponent 1.

### E5 — Maxwell-Betti symmetry of the effective stiffness matrix [PASS]

- **Claim:** Cross terms satisfy C12 == C21 (energy-consistent cell)
- **Method:** Stress-based C12 (sigma22/eps11) vs C21 (sigma11/eps22)
- **Tolerance:** relative difference <= 1e-8
- **Observed:** 2.22e-16

### E6 — Energy-based vs stress-based stiffness consistency [PASS]

- **Claim:** C11 from strain energy equals sigma11/eps11 from boundary reactions
- **Method:** Two independent post-processes of the same periodic-cell solution
- **Tolerance:** relative difference <= 1e-8
- **Observed:** 2.22e-16

## F. Mass / STL / overlap audit

### F1 — Width field, strut volume and mass recomputed independently [PASS]

- **Claim:** Bilinear log-width interpolation and mass formula reproduce the engine exactly
- **Method:** Independent bilinear interpolation from the 8 controls + strut volume + pad
- **Tolerance:** width and mass relative difference <= 1e-12
- **Observed:** width abs diff 0.00e+00 mm, mass rel diff 0.00e+00 (53.6601 g)

### F2a — STL strut mesh: count, finite coordinates, envelope, non-degenerate [PASS]

- **Claim:** 12 triangles per strut, finite vertices, inside the expected strut envelope
- **Method:** lattice_triangles on uniform w=2; strut triangles = 94x12 = 1128
- **Tolerance:** count == 1128; all finite; all areas > 1e-10; bounds inside [10-w/2, 150+w/2] x [-w/2, 60+w/2] x [-5,5]
- **Observed:** 1128 strut triangles, bounds x[9.00,151.00] y[-1.00,61.00] z[-5.00,5.00], min area 10.00
- **Notes:** Strut boxes extend past the nominal envelope by w/2 at diagonal ends; expected for a box-per-strut visualisation export.

### F2b — STL wall-pad mesh is the nominal 10x60x10 prism [PASS]

- **Claim:** Pad triangles lie inside [0,10]x[0,60]x[-5,5] and form an axis-aligned prism
- **Method:** anyrb.stl._pad_triangles: pad box vertices (first 12 triangles of the export)
- **Tolerance:** all pad vertex coordinates within 1e-9 of the nominal 10x60x10 box
- **Observed:** pad bounds x[0.00,10.00] y[0.00,60.00] z[-5.00,5.00] mm
- **Notes:** REAL DEFECT (engine, stl.py): _pad_triangles builds a box whose axis runs along the pad diagonal (0,0)->(10,60) and then clips x to [0,10]; vertices land at y=0.00 and y=60.00 instead of 0..60. The pad is exported as a sheared parallelogram (signed volume still 6000 mm^3, F3), so a slicer receives a pad shifted ~5 mm out of the design envelope. The FE model and mass formula are unaffected; only the STL artifact is wrong. Recommend replacing _pad_triangles with a plain axis-aligned box (or reuse _box_triangles on the pad axis).

### F3 — STL signed volume equals the summed strut + pad volume [PASS]

- **Claim:** The box mesh is closed and consistently oriented; total signed volume equals the analytic sum
- **Method:** Divergence-theorem volume over all 1140 triangles vs analytic sum
- **Tolerance:** relative difference <= 1e-9
- **Observed:** STL 50558.79 mm^3 vs analytic 50558.79 mm^3 (4.32e-16)

### F4 — Node-overlap over-count of the reported mass (known limitation, quantified) [WARN]

- **Claim:** mass_g sums strut volumes, double-counting strut overlap at nodes; the printed/union mass is lower
- **Method:** Monte-Carlo union volume of the actual box geometry (400k samples) vs analytic sum, w=1/2/4 mm + robust design
- **Tolerance:** documented, expected conservative bias; over-count < 50% and must be reported (WARN, not hidden)
- **Observed:** w=1.0: +20.2% ; w=2.0: +28.7% ; w=4.0: +46.6% robust design: +25.2% (union 32692 +/- 72 mm^3 vs analytic 40921 mm^3)
- **Notes:** The engine documents 'mass sums strut volumes without subtracting node overlap (conservative)'. Quantified consequence: +20.2% at w=1, +28.7% at w=2, +46.6% at w=4, +25.2% at the shipped robust design. The bias is design-dependent, so absolute mass claims and mass-based rankings can shift. Disclosure to be surfaced in the app/report: 'printed mass (union) ~40.5 g vs analytic 50.7 g (conservative)'. Recommended engine change: compute a unique union volume (clip overlapping strut segments) or report nominal-solid vs summed mass separately.
- **Evidence:** `{"by_width": {"1.0": {"analytic_mm3": 28279.393923934003, "union_mm3": 23532.82331004, "union_se_mm3": 64.42066363468878, "overcount_pct": 20.17000064700667}, "2.0": {"analytic_mm3": 50558.78784786801, "union_mm3": 39294.951186959996, "union_se_mm3": 74.5883114581288, "overcount_pct": 28.66484451734326}, "4.0": {"analytic_mm3": 95117.57569573601, "union_mm3": 64878.502848839984, "union_se_mm3": 75.1166222332879, "overcount_pct": 46.608771039846374}}, "robust": {"analytic_mm3": 40921.18422002019, "union_mm3": 32692.464839352924, "overcount_pct": 25.17007946969514}}`

## G. Material model

### G1 — rPETG preset moments and correlation recovered by sampling [PASS]

- **Claim:** 2e6 lot-level samples reproduce declared means, CVs and log-correlation
- **Method:** Monte-Carlo moment recovery on the shipped preset
- **Tolerance:** mean <= 0.5% rel; CV <= 2% rel; corr <= 0.005 abs
- **Observed:** E mean -2.92e-05, E CV -5.15e-05, sy mean -1.37e-05, sy CV -1.34e-03, corr 0.5496/0.55

### G2 — Two-level CV split: CV_lot^2 + CV_within^2 = CV_total^2 [PASS]

- **Claim:** lot_fraction/within_fraction encode 85%/15% variance split and sum to unity
- **Method:** Engine params('lot'/'within'/'total') + fractions identity
- **Tolerance:** identity <= 1e-6 and combined fraction within 1e-5 of 1 (fractions rounded to 5 dp)
- **Observed:** identity 6.9e-08, combined fraction 0.999996546, variance split 0.8500/0.1500
- **Notes:** lot_fraction=0.92195, within_fraction=0.38730 are rounded: squares are 0.850000/0.150000 to 3e-6, so the identity is satisfied to rounding, not to machine precision.

### G3 — Hierarchical lot->specimen sampling reproduces total CV [PASS]

- **Claim:** Independent two-level generator (3000 lots x 400 specimens) matches the declared total CV
- **Method:** Draw lot means with CV_lot then specimens with CV_within; estimate total CV
- **Tolerance:** relative error <= 1%
- **Observed:** total CV 0.1003 vs 0.1 (+2.74e-03)

### G4 — Measured-lot path uses within-lot distribution [PASS]

- **Claim:** lot_pass_probability(measured lot) == within-level P_f of the measured material
- **Method:** Compare lot_pass_probability with failure_probability(level='within')
- **Tolerance:** exact equality; input material not mutated
- **Observed:** 4.947828e-06 vs 4.947828e-06

## H. Cross-implementation / fixture determinism

### H1 — Frozen fixtures reproduce from the current Python engine [PASS]

- **Claim:** Every fixture case recomputes from its stored controls to machine precision
- **Method:** 5 cases in app/tests/fixtures/reference.json
- **Tolerance:** deterministic fields rel diff <= 1e-12; P_f abs diff <= 1e-12
- **Observed:** max rel 0.00e+00 (), max |dP_f| 0.00e+00

### H2 — Frozen fixture regenerates byte-identically [PASS]

- **Claim:** The fixture generator's deterministic output is exactly the committed reference.json
- **Method:** Reconstructed fixture dict (robust controls taken from fixture) re-serialised with json.dump(indent=1)
- **Tolerance:** byte-identical files
- **Observed:** identical (30074 vs 30074 bytes); regenerated at artifacts/reference_regenerated.json

### H3 — JavaScript engine/fixture cross-language tests pass [PASS]

- **Claim:** The JS engine reproduces the frozen fixtures; full app suite reported informationally
- **Method:** node app/tests/run.mjs fixture (engine/fixture scope) + full suite for transparency
- **Tolerance:** filtered engine/fixture tests: exit 0 and 0 failures
- **Observed:** 1 passed, 0 failed, 0 skipped (filter 'fixture'), exit 0, 4.0 s
- **Notes:** Full app suite: 28 passed, 0 failed, 0 skipped; no app-layer failures. Failures outside the engine/fixture contract (v0.2 app schema/grounding) are reported here for transparency and are not scored against the engine.

### H4 — Live JavaScript vs Python cross-implementation agreement [PASS]

- **Claim:** JS analyzeLattice/probabilityOfFailure reproduce Python fixture values within the contract
- **Method:** node ESM cross-check script computing all five cases in app/engine.js
- **Tolerance:** deterministic fields rel <= 1e-6; P_f abs <= 1e-8
- **Observed:** max rel 4.77e-14 (uniform_w1.5:sigma_req_MPa), max |dP_f| 1.07e-13 over 5 cases

## I. Claim scope and limitations

### I1 — Claim-ladder mapping (L0-L2) updated by this validation [PASS]

- **Claim:** L0 and L1 are demonstrated by independent checks; L2 is partial; L3+ remain absent
- **Method:** Mapping of A-H results onto the dossier-05 claim ladder
- **Tolerance:** documentation consistent with evidence (no over-claim)
- **Observed:** L0 achieved, L1 achieved, L2 partial, L3+ absent
- **Notes:** Every user-facing number should carry its level; this suite raises L0/L1 confidence only.
- **Evidence:** `{"L0_code_verified": {"status": "achieved", "evidence": "A1-A7 (element benchmarks, rigid body, equilibrium, symmetry, independent assembly, linearity)"}, "L1_solution_verified": {"status": "achieved", "evidence": "B (energy-minimisation cross-check), C1-C5 (reliability quadrature/MC convergence), D1-D3 (optimiser vs brute force), E (periodic cell energy/stress consistency), H (counts/determinism)"}, "L2_literature_calibrated_uq": {"status": "partial", "evidence": "rPETG preset moments/correlation verified internally (G); literature provenance not independently re-derived here"}, "L3_literature_reproduced": {"status": "not attempted in v0.2", "evidence": "planned (research/05 \u00a74.3)"}, "L4_component_validated": {"status": "absent", "evidence": "no coupon experiments exist"}, "L5_system_validated": {"status": "absent", "evidence": "no full-bracket experiments exist"}, "L6_certified": {"status": "out of scope", "evidence": "not a certification tool"}}`

### I2 — Model-form limitations are enumerated and quantified where possible [PASS]

- **Claim:** The report states what the checks do NOT validate, including the mass over-count quantified in F4
- **Method:** Limitations register compiled from PRODUCT_SPEC §7, REPORT §6 and checks A-H
- **Tolerance:** all known major limitations listed
- **Observed:** 11 limitations documented
- **Evidence:** `{"no_experiments": "No physical specimens were tested; nothing here is experimental validation.", "frame_vs_part": "The 2-D plane-frame idealisation omits 3-D load paths, out-of-plane bending/buckling and plate action.", "joints": "Printed node/joint compliance and local stress concentrations are not modelled; rigid joints assumed.", "anisotropy": "Layer-adhesion/road-direction anisotropy is not modelled (measured printed in-plane strength used).", "plasticity": "Linear elasticity only; no yield plateau, strain localisation, or failure criterion beyond first yield.", "time_dependence": "Creep, fatigue, UV and thermal ageing are not modelled.", "spatial_scatter": "Material scatter is batch-uniform, not spatial; print-defect statistics absent.", "buckling_model": "Euler buckling with pinned-pinned effective length; no combined axial-bending interaction.", "material_provenance": "Feedstock distributions are literature-derived priors, not the user's measured lots.", "mass_overcount": "Reported mass double-counts strut overlap (F4): +20.2% at w=1 mm, +28.7% at w=2 mm, +46.6% at w=4 mm; at the shipped robust design the analytic mass is 50.7 g vs printed union ~40.5 g (+25.2%). Reported m …`

## Claim-ladder mapping

| Level | Status | Evidence from this suite |
|---|---|---|
| L0 code verified | achieved | A1-A7 (element benchmarks, rigid body, equilibrium, symmetry, independent assembly, linearity) |
| L1 solution verified | achieved | B (energy-minimisation cross-check), C1-C5 (reliability quadrature/MC convergence), D1-D3 (optimiser vs brute force), E (periodic cell energy/stress consistency), H (counts/determinism) |
| L2 literature calibrated uq | partial | rPETG preset moments/correlation verified internally (G); literature provenance not independently re-derived here |
| L3 literature reproduced | not attempted in v0.2 | planned (research/05 §4.3) |
| L4 component validated | absent | no coupon experiments exist |
| L5 system validated | absent | no full-bracket experiments exist |
| L6 certified | out of scope | not a certification tool |

## Model-form limitations (what this does NOT validate)

- **no experiments:** No physical specimens were tested; nothing here is experimental validation.
- **frame vs part:** The 2-D plane-frame idealisation omits 3-D load paths, out-of-plane bending/buckling and plate action.
- **joints:** Printed node/joint compliance and local stress concentrations are not modelled; rigid joints assumed.
- **anisotropy:** Layer-adhesion/road-direction anisotropy is not modelled (measured printed in-plane strength used).
- **plasticity:** Linear elasticity only; no yield plateau, strain localisation, or failure criterion beyond first yield.
- **time dependence:** Creep, fatigue, UV and thermal ageing are not modelled.
- **spatial scatter:** Material scatter is batch-uniform, not spatial; print-defect statistics absent.
- **buckling model:** Euler buckling with pinned-pinned effective length; no combined axial-bending interaction.
- **material provenance:** Feedstock distributions are literature-derived priors, not the user's measured lots.
- **mass overcount:** Reported mass double-counts strut overlap (F4): +20.2% at w=1 mm, +28.7% at w=2 mm, +46.6% at w=4 mm; at the shipped robust design the analytic mass is 50.7 g vs printed union ~40.5 g (+25.2%). Reported mass is therefore a conservative upper bound, not printed mass.
- **optimiser scope:** D validates a reduced 2-parameter family and checks the shipped 8-parameter result; it does not prove global optimality of the 8-parameter problem.

### What this suite verifies

1. The 2-D frame element and the full 94-element assembly are correct for their idealisation (closed-form benchmarks, rigid-body modes, equilibrium, symmetry, independent energy minimisation).
2. The closed-form reliability is numerically correct against independent quadrature, SciPy's bivariate-normal CDF, and 1e6-sample Monte Carlo, including tails, correlations 0–0.95, quadrature-order convergence and degenerate (zero-variance) limits.
3. The deterministic multi-start optimiser finds a feasible design within 1% of a brute-force optimum on a reduced 2-parameter family, and 200 random designs do not beat it by >2%.
4. The periodic unit cell reproduces the analytical stretching-dominated stiffness within 0.15% and the expected w^1 scaling; the shear response differs from the pin-jointed estimate by a documented 0.4–3.2% (frame action).
5. Mass/volume arithmetic is exact; the STL strut mesh (F2a) and axis-aligned wall pad (F2b) are correct and the signed volume matches the analytic sum (F3). The known node-overlap over-count of the reported mass is quantified (F4) and remains the single documented WARN.
6. Material sampling reproduces declared moments/correlation and the two-level variance split.
7. Python and JavaScript agree on all frozen fixtures and the fixture regenerates byte-identically; the independent JS test suite passes.

### What this suite does NOT verify

It does not validate the model against any physical part. No tensile, lattice-coupon or bracket experiment exists; the 2-D frame idealisation, joint compliance, layer anisotropy, out-of-plane behaviour, plasticity, creep/fatigue, spatial defect statistics and the literature-derived material distributions are outside the scope of these checks. The claim level remains L0–L1 (code/solution verification) with partial L2 (literature-calibrated UQ), **not** L3–L6. No statement here supports certification, production reliability, or compliance with ISO/ASTM/UL/PPWR requirements.

## Figures

- `figures/01_reliability_quadrature_convergence.png`
- `figures/03_optimiser_grid_vs_pattern_search.png`
- `figures/02_unit_cell_stiffness_vs_width.png`
- `figures/04_mass_overlap_vs_width.png`

## Environment and reproducibility

- Python 3.15.2, NumPy 2.5.4, SciPy 1.18.1, Matplotlib 3.11.2, Node v26.12.1
- Engine file SHA-256: `2dee8788602f834219692669a1918483`
- Fixture SHA-256: `58273403702c5086d18138f01f7e39a6`
- Seeds are fixed (20261029, 7, 11, 42, 101, 2027, 5); no network access is used by the suite.

## Defects found by this validation, and their status

| Defect | Found by | Status |
|---|---|---|
| STL wall pad exported as a sheared parallelogram (y=-4.93..64.93 instead of 0..60) | F2b | **FIXED** (Lead, 2026-10-29): `_pad_triangles` now an axis-aligned 10x60x10 box; F2b PASS |
| Fixed 48-point GL loses ~3e-6 in Phi2 at rho=0.99 | C1b | **FIXED** (Lead, 2026-10-29): extreme-rho/|a|>4 now delegates to SciPy's adaptive bivariate CDF; C1b re-validates that path against independent 1-D conditional quadrature |
| Degenerate-marginal combination returned the wrong P_f when the deterministic term fails | C9 (surfaced during fix round) | **FIXED** (Lead, 2026-10-29): failure_probability combination corrected; C9 PASS |
| Fixtures needed regeneration after the fixes | H2 | **CLOSED**: fixtures regenerated; H2 byte-identical PASS |

## Recommended engine changes (not applied — validator scope)

1. **Mass/volume (F4, WARN — the one open item):** compute a unique union volume of overlapping struts (clip/union) or report `nominal_solid_volume` separately from the conservative summed volume; the reported mass is +20% at w=1, +29% at w=2 and +47% at w=4 mm versus the union of the printed geometry, and +25% at the robust design. The app/report should state 'printed mass ~40.5 g vs analytic 50.7 g (conservative)'.
2. **Advisory printability:** the shipped robust design sits at neighbour-width ratio 1.457 (limit 1.5) and slenderness 22.7 (limit 30); keep reporting these in the UI/report rather than silently accepting them, and consider adding them as soft constraints in v0.2.
3. **Reliability claim language:** the engine is numerically verified but remains unvalidated against experiment; ensure every user-facing P_f carries the L-level and the model-form caveats produced by this suite (README paragraph can be reused verbatim).


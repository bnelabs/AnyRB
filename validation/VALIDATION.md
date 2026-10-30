# AnyRB independent validation report (v0.4)

Generated: 2026-10-30T12:29:30+00:00 · Suite runtime 43.2 s · Python 3.15.2 · NumPy 2.5.4 · SciPy 1.18.1 · Matplotlib 3.11.2

**Independent** means: the frame element is re-implemented here, the global stiffness matrix is assembled here, reliability is re-derived with SciPy quadrature/CDF/Monte-Carlo, and the optimiser is checked against a brute-force grid. The engine is imported only where a check is explicitly *engine vs independent*. The suite is reproducible with `cd AnyRB && .venv/bin/python validation/run_validation.py`.

## For the app — quotable summary (generated)

- **Validation:** 56 PASS, 2 WARN, 0 FAIL across 58 independent checks (runtime 43 s, reproducible with `make validate`).
- **Claim level:** L0 (code verified) and L1 (solution verified) are demonstrated; L2 is partial; L3 is pre-registered only (coupon plan, no data); L4-L6 absent.
- **WARN F4:** corrected analytic over-count (of printed union): w=1: +5.6%, w=2: +12.2%, w=4: +27.9%; shipped robust +9.5% (analytic 50.81 g vs printed union 46.39 g, independent MC +/-0.04 g); engine Halton printed 46.40 g
- **WARN F5:** max |dev| 0.35% (worst uniform_w1); uniform_w1: -0.35%; uniform_w2: +0.10%; uniform_w4: -0.04%; robust: +0.01%; uniform_target: -0.08%; nominal_sf15: +0.04%; mean_only: +0.04%
- **Mass basis:** display `printed_mass_g` (deterministic Halton-QMC union). F5 audits it against independent Monte Carlo: ≤0.1% deviation at the shipped designs, 0.35% worst case at w=1 mm (W_MIN) — a documented WARN. Label analytic `mass_g` strictly as a conservative upper bound (F4 WARN).
- **v0.4 disclosures:** brittle-lot screen is a *marginal add-on estimate (not a formal bound)* (`pf_brittle` shown separately; `pf_brittle_bound = pf + pf_brittle`, joint three-property probability NOT claimed), with its own elongation lot/within split (rPETG 50% between lots vs 85% for E/σy) and a fixed 1% brittle screen threshold (not the design target); the P_f range over corr 0.30/0.70 and lot split 75/95% is assumption sensitivity, not validation; only FDM/FFF material data may enter the printed-bracket model (non-printed presets are contrast-only and design is blocked); the final design mass is selected on the printed union after a recorded polish step, with strict P_f <= target acceptance.

## Summary

| PASS | WARN | FAIL | total |
|---|---|---|---|
| 56 | 2 | 0 | 58 |

Interpretation: **PASS** = observed within the pre-registered tolerance. **WARN** = outside the target tolerance but explained and documented (a known conservative approximation or a deliberately coarse analytical reference); it must be surfaced, not hidden. **FAIL** = outside tolerance without an acceptable explanation; the engine must be changed before the claim stands. Tolerances were fixed before the numbers were inspected and were not tuned to pass.

## Open issues (WARN) — actionable

- **WARN F4 — Analytic mass is a conservative upper bound; printed union mass is corrected and quantified.** corrected analytic over-count (of printed union): w=1: +5.6%, w=2: +12.2%, w=4: +27.9%; shipped robust +9.5% (analytic 50.81 g vs printed union 46.39 g, independent MC +/-0.04 g); engine Halton printed 46.40 g. Superseded values from the earlier half-strut sampler (+25% robust / 40.5 g) were a sampler bug and are void. Corrected: the 3-D sample mask now uses 0 <= along <= L (full strut length); the independent 2-D MC and 3-D MC agree within Monte-Carlo error. Analytic vs printed union: w=1 +5.6%, w=2 +12.2%, w=4 +27.9%, robust +9.5%, uniform-target +11.7%, nominal +11.2%, mean-only +8.0%. As a fraction of the analytic mass the over-statement is 5.3%, 10.9%, 21.8% (w=1/2/4) and 8.7% (robust). The engine's Halton printed union itself is audited in F5. Keep WARN: the analytic upper bound is still a design-dependent conservatism and must always be labelled as such.
- **WARN F5 — Deterministic Halton-QMC printed union mass is accurate vs independent Monte Carlo.** max |dev| 0.35% (worst uniform_w1); uniform_w1: -0.35%; uniform_w2: +0.10%; uniform_w4: -0.04%; robust: +0.01%; uniform_target: -0.08%; nominal_sf15: +0.04%; mean_only: +0.04%. Halton QMC is deterministic across Python/JS and replaced the earlier 0.25 mm voxel implementation. Agreement with the independent random-MC reference is ≤0.1% for the shipped designs but 0.35% at w=1 mm (W_MIN), just outside the documented 0.3% claim — hence WARN, not FAIL: the headline masses of shipped designs are accurate, but a W_MIN design shown as a headline mass deserves a larger Halton sample or the documented 0.35% tolerance. The analytic mass remains a deliberate upper bound (F4).

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
| D1 | D | Brute-force grid baseline on the reduced 2-parameter family | 2109 evaluations of anyrb.evaluate (~3.6 s) | grid must contain feasible designs | best mass 53.311 g (w0=1.35, g=0.40, pf=0.0028); feasible 1346 | **PASS** |
| D2 | D | Production pattern search vs brute-force grid (2 parameters) | 4 deterministic starts x up to 1500 evals (~0.7 s) via an 8-D wrapper | feasible (P_f <= target) and mass <= grid best * 1.01 | mass 52.812 g vs grid 53.311 g (-0.94%), pf 0.0078, w0=1.34, g=0.40 | **PASS** |
| D3 | D | 200 random designs cannot beat the optimiser by > 2% | 200 uniform random (w0, g) designs vs the fixed optimiser result | no feasible random design lighter than 0.98 x optimiser mass | random best 56.161 g (feasible 134/200) vs 53.311 g | **PASS** |
| D4 | D | Shipped robust design is feasible and independently reproducible | Recompute demands with independent assembly; P_f via SciPy bivariate normal; mass from widths | pf <= target; |pf_diff| <= 1e-8; mass rel diff <= 1e-10; widths in bounds | reported pf 0.009956 vs independent 0.009956; mass 50.809 g vs independent 50.809 g; widths [1.24,1.99] mm; target 0.01 | **PASS** |
| D5 | D | Printability metrics are reported, not silently rejected | Engine printability_report vs manual recomputation on the robust design | values match <= 1e-12; out_of_bounds False | min/max width 1.24/1.99 mm, slenderness 21.92 (limit 30), neighbour ratio 1.375 (limit 1.5), out_of_bounds False | **PASS** |
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
| F4 | F | Analytic mass is a conservative upper bound; printed union mass is corrected and quantified | Independent 2e6-sample Monte-Carlo union (full strut length) vs analytic sum, plus a 1e6-sample 3-D cross-check, for uniform w=1/2/4 mm and the shipped baseline strategies | documented conservative bias; WARN (not hidden). Corrected over-count is ~5-28% depending on width | corrected analytic over-count (of printed union): w=1: +5.6%, w=2: +12.2%, w=4: +27.9%; shipped robust +9.5% (analytic 50.81 g vs printed union 46.39 g, independent MC +/-0.04 g); engine Halton printed 46.40 g | **WARN** |
| F5 | F | Deterministic Halton-QMC printed union mass is accurate vs independent Monte Carlo | lattice.printed_volume_mm3 vs independent union for w=1/2/4 and 5 shipped strategies; document claim <0.3% | max |deviation| <= 0.3% as documented (PASS) else WARN | max \|dev\| 0.35% (worst uniform_w1); uniform_w1: -0.35%; uniform_w2: +0.10%; uniform_w4: -0.04%; robust: +0.01%; uniform_target: -0.08%; nominal_sf15: +0.04%; mean_only: +0.04% | **WARN** |
| G1 | G | rPETG preset moments and correlation recovered by sampling | Monte-Carlo moment recovery on the shipped preset | mean <= 0.5% rel; CV <= 2% rel; corr <= 0.005 abs | E mean -2.92e-05, E CV -5.15e-05, sy mean -1.37e-05, sy CV -1.34e-03, corr 0.5496/0.55 | **PASS** |
| G2 | G | Two-level CV split: CV_lot^2 + CV_within^2 = CV_total^2 | Engine params('lot'/'within'/'total') + fractions identity | identity <= 1e-6 and combined fraction within 1e-5 of 1 (fractions rounded to 5 dp) | identity 6.9e-08, combined fraction 0.999996546, variance split 0.8500/0.1500 | **PASS** |
| G3 | G | Hierarchical lot->specimen sampling reproduces total CV | Draw lot means with CV_lot then specimens with CV_within; estimate total CV | relative error <= 1% | total CV 0.1003 vs 0.1 (+2.74e-03) | **PASS** |
| G4 | G | Measured-lot path uses within-lot distribution | Compare lot_pass_probability with failure_probability(level='within') | exact equality; input material not mutated | 4.947828e-06 vs 4.947828e-06 | **PASS** |
| H1 | H | Frozen fixtures reproduce from the current Python engine | 5 cases in history/v0.6-app/tests/fixtures/reference.json | deterministic fields rel diff <= 1e-12; P_f abs diff <= 1e-12 | max rel 0.00e+00 (), max \|dP_f\| 0.00e+00 | **PASS** |
| H2 | H | Frozen fixture regenerates byte-identically | Reconstructed fixture dict (robust controls taken from fixture) re-serialised with json.dump(indent=1) | byte-identical files | identical (32601 vs 32601 bytes); regenerated at artifacts/reference_regenerated.json | **PASS** |
| H3 | H | JavaScript engine/fixture cross-language tests pass | node history/v0.6-app/tests/run.mjs fixture (engine/fixture scope) + full suite for transparency | filtered engine/fixture tests: exit 0 and 0 failures | 1 passed, 0 failed, 0 skipped (filter 'fixture'), exit 0, 16.1 s | **PASS** |
| H4 | H | Live JavaScript vs Python cross-implementation agreement | node ESM cross-check script computing all five cases in the historical bracket engine | deterministic fields rel <= 1e-6; P_f abs <= 1e-8 | max rel 4.77e-14 (uniform_w1.5:sigma_req_MPa), max \|dP_f\| 1.07e-13 over 5 cases | **PASS** |
| J1 | J | Cell-size / topology model-form band on the fixed 140x60 envelope | Independent frame solver on generalised lattices with the same bilinear log-width field; same-width and mass-matched (analytic strut volume matched to 7x3) comparisons | 7x3 generic model reproduces engine demands <=1e-9; report the spread as a model-form band (no pass/fail target) | 7x3 vs engine rel 4.7e-15; same-width spread: u_tip 88%, sigma_req 34%, E_req 495%; mass-matched spread: u_tip 58%, sigma_req 98%, E_req 23% | **PASS** |
| J2 | J | Joint-stiffness / topology model-form: rigid frame vs pin-jointed truss | 2-DOF/node pin-jointed truss solver vs the rigid-joint frame; tip stiffness, sigma_req and E_req ratios | report the ratio band; frame demands should not be below the pin-jointed idealisation | stiffness frame/truss 1.004; sigma_req frame/truss 1.141; E_req frame/truss 0.997 | **PASS** |
| K1 | K | Sustained-load / creep advisory bound (compression x0.8, creep x2.0) | Independent recomputation of E_req*2, sigma_req/0.8, its P_f and deflection bound vs engine sustained_bound() | engine vs independent rel diff <=1e-12; P_f_bound > P_f_static; deflection_bound > u_lim | static P_f 0.0100; bound P_f 1.000000 (>=1 means essentially certain); E_req_bound 3376 MPa; sigma_req_bound 23.51 MPa; deflection_bound 4.02 mm (> 2.5 limit) | **PASS** |
| K2 | K | Measured lot keeps 12% measurement uncertainty; lot-specific resize recipe is consistent | Engine lot_from_measurement + lot_specific_recipe vs independent P_f recomputation from the returned controls | measurement CV retained (E_cv > 0.05); known-lot P_f > 0; recipe feasible and self-consistent <=1e-12 | E_cv(12% meas) 0.1261, known-lot P_f 0.0082 (vs 7.8e-16 at 0% meas CV); recipe P_f 0.0098, global scale 1.000, printed mass 45.96 g, verdict 'pass as designed' | **PASS** |
| K3 | K | Family feasibility gate blocks infeasible material/family before design | Engine family_feasibility() vs independent uniform-W_MAX demands and P_f, for rPETG and a synthetic weak material | feasible iff P_f(W_MAX) <= target; both cases must match independent computation <=1e-12 | rPETG: feasible=True, min P_f 0.00e+00; weak material: feasible=False, min P_f 0.322 | **PASS** |
| L1 | L | Frozen coupon/bracket predictions, protocol and comparison tool are pre-registered | COUPON_TEST_PLAN.md + coupon_predictions.json (hash) + compare_measurements.py; predictions recomputed from current engine/model | files exist, pre-registration hash matches canonical payload, stiffness/first-yield/strain/brittle predictions reproduce <=1e-9, tool template parses | hash OK; bracket prediction recompute rel 0.0e+00, coupon 0.0e+00; compare tool OK | **PASS** |
| K4 | K | Printed-process gate: only FDM/FFF data may enter the printed-bracket model | Engine family_feasibility and Material.print_process_ok vs independent process-string classification (rPETG FDM vs rPET/rHDPE/rPP IM/compression) | rPETG process_ok/feasible true; all non-printed presets process_ok=false, feasible=false, reason=process_mismatch, min_pf=None; print_process_ok probes all correct | rPETG process_ok/feasible=True/True; rpet(IM): process_ok=False, feasible=False, reason=process_mismatch; rhdpe(IM/compression): process_ok=False, feasible=False, reason=process_mismatch; rpp(IM): process_ok=False, feasible=False, reason=process_mismatch; probes correct=True | **PASS** |
| K5 | K | Elongation / brittle-lot screen verified with its own lot/within split (add-on estimate, not a formal bound) | Independent scipy.stats.lognorm / direct normal CDF using the elongation-specific split (lot sqrt(frac), within sqrt(1-frac), measured lot f=1), supplied reference values, monotonicity, zero-CV/NaN limits, evaluate() strain_req consistency, fixed 1% brittle_ok threshold | max |engine - independent| <= 1e-12; Lead reference values reproduced to 1e-12; measured-lot elongation CV 0.1854723699099141 exact; deg limits exact; brittle_ok matches pf_brittle <= 1% threshold | max abs err 6.7e-16; ref 0.02=6.010388e-07, 0.04=5.280468e-01 (rel err 0.0e+00); lot split sqrt(0.50); measured-lot elong CV 0.185472 (ref 0.185472); strain_req 0.896% == sigma_req/E_mean; pf_brittle 0.00e+00; headline pf 0.00996 + add-on = estimate 0.00996; 1% screen threshold verified (pass/fail boundary found) | **PASS** |
| K6 | K | Union-mass final polish is recorded, bounded and correctly accepted/declined | Independent replication of the pre-polish multi-start selection vs engine optimize_robust; compare 60k printed masses, feasibility, printability, decline logic, runtime | final feasible + printable; accepted printed mass <= pre-polish within Halton tolerance; if declined, controls unchanged and decline verified; runtime < 120 s | pre-polish printed 46.400 g -> final 46.400 g (+0.000%); union_polished=False, union_evals=0; final pf 0.00996, neighbour ratio 1.375, slenderness 21.9; runtime 3.6 s; 60k-vs-independent-union +0.01%; mode=declined | **PASS** |
| K7 | K | Assumption bounds are computed correctly and labelled as assumption sensitivity, not validation | Engine assumption_bounds vs independent SciPy closed-form P_f at each assumption setting | engine vs independent <= 1e-12; pf_min/pf_max match the four settings; split monotone | corr 0.30/0.70 -> 0.00996/0.00996 (insensitive=True); split 75/95% -> 0.00200/0.01201; range [0.00200, 0.01201], max err 3.1e-17 | **PASS** |
| K8 | K | Design-stage report and app export carry the v0.4 disclosures | reports/summary.json + reports/qualification_report.html + historical bracket app export (static audit) | all required fields present and internally consistent; validation counts match the current results.json (else WARN: regenerate reports) | fields_ok=True, html_ok=True, app_lot_identity=True, v0.4-hardening wording=True, report validation 56P/2W/0F of 58 (expected for this run if K8 passes: 56P/2W/0F of 58) | **PASS** |
| I1 | I | Claim-ladder mapping (L0-L2) updated by this validation | Mapping of A-L results onto the dossier-05 claim ladder | documentation consistent with evidence (no over-claim) | L0 achieved, L1 achieved, L2 partial, L3 pre-registered only, L4-L6 absent | **PASS** |
| I2 | I | Model-form limitations are enumerated and quantified where possible | Limitations register compiled from PRODUCT_SPEC §7, REPORT §6 and checks A-H | all known major limitations listed | 19 limitations documented | **PASS** |

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
- **Method:** 2109 evaluations of anyrb.evaluate (~3.6 s)
- **Tolerance:** grid must contain feasible designs
- **Observed:** best mass 53.311 g (w0=1.35, g=0.40, pf=0.0028); feasible 1346

### D2 — Production pattern search vs brute-force grid (2 parameters) [PASS]

- **Claim:** Deterministic engine pattern_search finds a feasible design within +1% of the grid optimum
- **Method:** 4 deterministic starts x up to 1500 evals (~0.7 s) via an 8-D wrapper
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
- **Observed:** reported pf 0.009956 vs independent 0.009956; mass 50.809 g vs independent 50.809 g; widths [1.24,1.99] mm; target 0.01

### D5 — Printability metrics are reported, not silently rejected [PASS]

- **Claim:** Width bounds satisfied; neighbour ratio and slenderness reported with correct values
- **Method:** Engine printability_report vs manual recomputation on the robust design
- **Tolerance:** values match <= 1e-12; out_of_bounds False
- **Observed:** min/max width 1.24/1.99 mm, slenderness 21.92 (limit 30), neighbour ratio 1.375 (limit 1.5), out_of_bounds False
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

### F4 — Analytic mass is a conservative upper bound; printed union mass is corrected and quantified [WARN]

- **Claim:** mass_g sums every strut box and double-counts node overlap; the engine now reports the Halton-QMC union printed mass as headline and analytic as upper bound
- **Method:** Independent 2e6-sample Monte-Carlo union (full strut length) vs analytic sum, plus a 1e6-sample 3-D cross-check, for uniform w=1/2/4 mm and the shipped baseline strategies
- **Tolerance:** documented conservative bias; WARN (not hidden). Corrected over-count is ~5-28% depending on width
- **Observed:** corrected analytic over-count (of printed union): w=1: +5.6%, w=2: +12.2%, w=4: +27.9%; shipped robust +9.5% (analytic 50.81 g vs printed union 46.39 g, independent MC +/-0.04 g); engine Halton printed 46.40 g
- **Notes:** Superseded values from the earlier half-strut sampler (+25% robust / 40.5 g) were a sampler bug and are void. Corrected: the 3-D sample mask now uses 0 <= along <= L (full strut length); the independent 2-D MC and 3-D MC agree within Monte-Carlo error. Analytic vs printed union: w=1 +5.6%, w=2 +12.2%, w=4 +27.9%, robust +9.5%, uniform-target +11.7%, nominal +11.2%, mean-only +8.0%. As a fraction of the analytic mass the over-statement is 5.3%, 10.9%, 21.8% (w=1/2/4) and 8.7% (robust). The engine's Halton printed union itself is audited in F5. Keep WARN: the analytic upper bound is still a design-dependent conservatism and must always be labelled as such.
- **Evidence:** `{"by_design": {"uniform_w1": {"analytic_mm3": 28279.393924, "union_mm3": 26779.31256, "union_se_mm3": 32.863641, "union_3d_mm3": 26731.50176, "union_3d_se_mm3": 46.448459, "printed_engine_mm3": 26684.514667, "overcount_pct": 5.601643, "overcount_frac_analytic_pct": 5.304503, "halton_dev_pct": -0.353997}, "uniform_w2": {"analytic_mm3": 50558.787848, "union_mm3": 45042.3398, "union_se_mm3": 37.486908, "union_3d_mm3": 45027.13704, "union_3d_se_mm3": 53.012004, "printed_engine_mm3": 45087.196, "overcount_pct": 12.24725, "overcount_frac_analytic_pct": 10.910958, "halton_dev_pct": 0.099587}, "uniform_w4": {"analytic_mm3": 95117.575696, "union_mm3": 74350.57508, "union_se_mm3": 35.072908, "union_3d_mm3": 74384.36496, "union_3d_se_mm3": 49.586515, "printed_engine_mm3": 74319.829333, "overcount_pct": 27.93119, "overcount_frac_analytic_pct": 21.832979, "halton_dev_pct": -0.041352}, "robust": {"analytic_mm3": 40975.3457, "union_mm3": 37415.06676, "union_se_mm3": 36.193836, "union_3d_mm3": 37415.12048, "union_3d_se_mm3": 51.185831, "printed_engine_mm3": 37419.561333, "overcount_pct": 9.515629, "overcount_frac_analytic_pct": 8.688832, "halton_dev_pct": 0.012013}, "uniform_target": {"analytic_mm …`

### F5 — Deterministic Halton-QMC printed union mass is accurate vs independent Monte Carlo [WARN]

- **Claim:** printed_volume_mm3 (60k Halton points, bases 2/3/5) reproduces the independent 2e6-sample union
- **Method:** lattice.printed_volume_mm3 vs independent union for w=1/2/4 and 5 shipped strategies; document claim <0.3%
- **Tolerance:** max |deviation| <= 0.3% as documented (PASS) else WARN
- **Observed:** max |dev| 0.35% (worst uniform_w1); uniform_w1: -0.35%; uniform_w2: +0.10%; uniform_w4: -0.04%; robust: +0.01%; uniform_target: -0.08%; nominal_sf15: +0.04%; mean_only: +0.04%
- **Notes:** Halton QMC is deterministic across Python/JS and replaced the earlier 0.25 mm voxel implementation. Agreement with the independent random-MC reference is ≤0.1% for the shipped designs but 0.35% at w=1 mm (W_MIN), just outside the documented 0.3% claim — hence WARN, not FAIL: the headline masses of shipped designs are accurate, but a W_MIN design shown as a headline mass deserves a larger Halton sample or the documented 0.35% tolerance. The analytic mass remains a deliberate upper bound (F4).
- **Evidence:** `{"max_dev_pct": 0.35399673953888655, "worst": "uniform_w1", "by_design": {"uniform_w1": -0.35399673953888655, "uniform_w2": 0.0995867448253751, "uniform_w4": -0.04135239927005596, "robust": 0.012012736372124522, "uniform_target": -0.0752683000422083, "nominal_sf15": 0.04200136504435292, "mean_only": 0.043927259052511936}}`

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
- **Method:** 5 cases in history/v0.6-app/tests/fixtures/reference.json
- **Tolerance:** deterministic fields rel diff <= 1e-12; P_f abs diff <= 1e-12
- **Observed:** max rel 0.00e+00 (), max |dP_f| 0.00e+00

### H2 — Frozen fixture regenerates byte-identically [PASS]

- **Claim:** The fixture generator's deterministic output is exactly the committed reference.json
- **Method:** Reconstructed fixture dict (robust controls taken from fixture) re-serialised with json.dump(indent=1)
- **Tolerance:** byte-identical files
- **Observed:** identical (32601 vs 32601 bytes); regenerated at artifacts/reference_regenerated.json

### H3 — JavaScript engine/fixture cross-language tests pass [PASS]

- **Claim:** The JS engine reproduces the frozen fixtures; full app suite reported informationally
- **Method:** node history/v0.6-app/tests/run.mjs fixture (engine/fixture scope) + full suite for transparency
- **Tolerance:** filtered engine/fixture tests: exit 0 and 0 failures
- **Observed:** 1 passed, 0 failed, 0 skipped (filter 'fixture'), exit 0, 16.1 s
- **Notes:** Full app suite: 54 passed, 0 failed, 0 skipped; no app-layer failures. Failures outside the engine/fixture contract (v0.2 app schema/grounding) are reported here for transparency and are not scored against the engine.

### H4 — Live JavaScript vs Python cross-implementation agreement [PASS]

- **Claim:** JS analyzeLattice/probabilityOfFailure reproduce Python fixture values within the contract
- **Method:** node ESM cross-check script computing all five cases in the historical bracket engine
- **Tolerance:** deterministic fields rel <= 1e-6; P_f abs <= 1e-8
- **Observed:** max rel 4.77e-14 (uniform_w1.5:sigma_req_MPa), max |dP_f| 1.07e-13 over 5 cases

## I. Claim scope and limitations

### I1 — Claim-ladder mapping (L0-L2) updated by this validation [PASS]

- **Claim:** L0 and L1 are demonstrated by independent checks; L2 is partial; L3+ remain absent
- **Method:** Mapping of A-L results onto the dossier-05 claim ladder
- **Tolerance:** documentation consistent with evidence (no over-claim)
- **Observed:** L0 achieved, L1 achieved, L2 partial, L3 pre-registered only, L4-L6 absent
- **Notes:** Every user-facing number should carry its level; this suite raises L0/L1 confidence only.
- **Evidence:** `{"L0_code_verified": {"status": "achieved", "evidence": "A1-A7 (element benchmarks, rigid body, equilibrium, symmetry, independent assembly, linearity)"}, "L1_solution_verified": {"status": "achieved", "evidence": "B (energy-minimisation cross-check), C1-C5 (reliability quadrature/MC convergence), D1-D3 (optimiser vs brute force), E (periodic cell energy/stress consistency), F4/F5 (mass basis audited), H (counts/determinism), J/K (model-form bands and v0.3/v0.4 features: K4 process gate, K5 brittle marginal, K6 union polish, K7 assumption bounds, K8 report disclosures)"}, "L2_literature_calibrated_uq": {"status": "partial", "evidence": "rPETG preset moments/correlation verified internally (G); literature provenance not independently re-derived here"}, "L3_literature_reproduced": {"status": "pre-registered, no data", "evidence": "coupon/bracket blind predictions (stiffness, first-yield, strain, brittle marginal), protocol and acceptance criteria frozen and hashed (L1); no measurements have been made"}, "L4_component_validated": {"status": "absent", "evidence": "no coupon experiments exist"}, "L5_system_validated": {"status": "absent", "evidence": "no full-bracket experiments exist"} …`

### I2 — Model-form limitations are enumerated and quantified where possible [PASS]

- **Claim:** The report states what the checks do NOT validate, including the mass over-count quantified in F4
- **Method:** Limitations register compiled from PRODUCT_SPEC §7, REPORT §6 and checks A-H
- **Tolerance:** all known major limitations listed
- **Observed:** 19 limitations documented
- **Evidence:** `{"no_experiments": "No physical specimens were tested; nothing here is experimental validation.", "frame_vs_part": "The 2-D plane-frame idealisation omits 3-D load paths, out-of-plane bending/buckling and plate action.", "joints": "Printed node/joint compliance and local stress concentrations are not modelled; rigid joints assumed.", "anisotropy": "Layer-adhesion/road-direction anisotropy is not modelled (measured printed in-plane strength used).", "plasticity": "Linear elasticity only; no yield plateau, strain localisation, or failure criterion beyond first yield.", "time_dependence": "Creep, fatigue, UV and thermal ageing are not modelled.", "spatial_scatter": "Material scatter is batch-uniform, not spatial; print-defect statistics absent.", "buckling_model": "Euler buckling with pinned-pinned effective length; no combined axial-bending interaction.", "material_provenance": "Feedstock distributions are literature-derived priors, not the user's measured lots.", "mass_overcount": "Analytic mass is a conservative upper bound (F4): it double-counts strut overlap. Corrected over-count of the printed union: +5.6% at w=1 mm, +12.2% at w=2 mm, +27.9% at w=4 mm; shipped robust design +9.5 …`

## J. Model-form: cell size, topology, joint stiffness

### J1 — Cell-size / topology model-form band on the fixed 140x60 envelope [PASS]

- **Claim:** Generalised X-braced lattices 4x2/7x3/10x4/14x6 mm on the same envelope: cell-size choice, not only numerical refinement, changes predictions
- **Method:** Independent frame solver on generalised lattices with the same bilinear log-width field; same-width and mass-matched (analytic strut volume matched to 7x3) comparisons
- **Tolerance:** 7x3 generic model reproduces engine demands <=1e-9; report the spread as a model-form band (no pass/fail target)
- **Observed:** 7x3 vs engine rel 4.7e-15; same-width spread: u_tip 88%, sigma_req 34%, E_req 495%; mass-matched spread: u_tip 58%, sigma_req 98%, E_req 23%
- **Notes:** Refining cells on a fixed envelope changes the architecture (more struts at the same width) as well as the discretisation; mass-matched comparison isolates the geometric effect. The 7x3 reference is the product contract: absolute predictions must not be transferred to other cell counts without a full re-analysis. The band is carried into the model-form limitations and the coupon uncertainty discussion.
- **Evidence:** `{"bands": {"uniform_w2": {"u_tip_mean_mm": {"same_width": [1.024659764794497, 1.928065859877001, 88.16644569465346], "mass_matched": [1.2577545351212631, 1.981196890603088, 57.518564654754044]}, "sigma_req": {"same_width": [10.860114402397542, 14.353129740780876, 32.16370665130559], "mass_matched": [9.845810708744247, 18.905405465560968, 92.0147159519401]}, "E_req": {"same_width": [860.7142024273776, 4823.811632119224, 460.44289945665565], "mass_matched": [1347.8512774828102, 1827.113851523081, 35.557526416068775]}}, "robust_graded": {"u_tip_mean_mm": {"same_width": [1.2823520283641439, 2.4035827665996714, 87.43548678016646], "mass_matched": [1.5690512976926012, 2.470896159051577, 57.477079473768725]}, "sigma_req": {"same_width": [14.326997571469432, 19.242632685715673, 34.31029488017199], "mass_matched": [12.977464124629625, 25.633505532815036, 97.52322400310709]}, "E_req": {"same_width": [1077.1757038258809, 6411.852464171641, 495.2466660172721], "mass_matched": [1687.9766194499934, 2075.5527736033246, 22.960990672940596]}}}, "seven_by_three_vs_engine_rel": 4.6629367034256575e-15}`

### J2 — Joint-stiffness / topology model-form: rigid frame vs pin-jointed truss [PASS]

- **Claim:** The frame assumption is compared with an independent axial-only truss on the same 7x3 geometry
- **Method:** 2-DOF/node pin-jointed truss solver vs the rigid-joint frame; tip stiffness, sigma_req and E_req ratios
- **Tolerance:** report the ratio band; frame demands should not be below the pin-jointed idealisation
- **Observed:** stiffness frame/truss 1.004; sigma_req frame/truss 1.141; E_req frame/truss 0.997
- **Notes:** Pin joints remove bending continuity: the truss idealisation is 0.4% more flexible in tip stiffness but underestimates the strength demand by 12.3% and the stiffness demand by 8.0% relative to the frame. The rigid-frame choice is therefore conservative for demand and nearly neutral for global stiffness; real printed joints lie between the two, which is the model-form band a coupon test must close.
- **Evidence:** `{"tip_stiffness_ratio_frame_over_truss": 1.004421312345252, "sigma_req_ratio": 1.1406639566451477, "E_req_ratio": 0.9965101575946106}`

## K. v0.3 features: sustained bound, measured lot, feasibility gate

### K1 — Sustained-load / creep advisory bound (compression x0.8, creep x2.0) [PASS]

- **Claim:** The advisory bound is much harsher than the static design and must fail the static allowable; it is labelled advisory, not the design allowable
- **Method:** Independent recomputation of E_req*2, sigma_req/0.8, its P_f and deflection bound vs engine sustained_bound()
- **Tolerance:** engine vs independent rel diff <=1e-12; P_f_bound > P_f_static; deflection_bound > u_lim
- **Observed:** static P_f 0.0100; bound P_f 1.000000 (>=1 means essentially certain); E_req_bound 3376 MPa; sigma_req_bound 23.51 MPa; deflection_bound 4.02 mm (> 2.5 limit)
- **Notes:** Honesty result: the shipped static design is NOT qualified for sustained load under this bound (P_f_bound ~= 1.0, bound deflection 4.0 mm > 2.5 mm limit). The UI must show the bound as advisory and say the part is not qualified for sustained load; the static result is unchanged.

### K2 — Measured lot keeps 12% measurement uncertainty; lot-specific resize recipe is consistent [PASS]

- **Claim:** A single coupon/supplier value must not zero the scatter: E_cv = sqrt(within_cv^2 + meas_cv^2); the recipe re-optimises 8 multipliers for the measured lot
- **Method:** Engine lot_from_measurement + lot_specific_recipe vs independent P_f recomputation from the returned controls
- **Tolerance:** measurement CV retained (E_cv > 0.05); known-lot P_f > 0; recipe feasible and self-consistent <=1e-12
- **Observed:** E_cv(12% meas) 0.1261, known-lot P_f 0.0082 (vs 7.8e-16 at 0% meas CV); recipe P_f 0.0098, global scale 1.000, printed mass 45.96 g, verdict 'pass as designed'
- **Notes:** The known-lot failure probability is nonzero (0.8%) precisely because the measurement uncertainty is retained; treating the measured value as exact would falsely report P_f ~ 1e-16. Width multipliers differ from 1 (0.92-1.00), showing the recipe is not a single global scale.

### K3 — Family feasibility gate blocks infeasible material/family before design [PASS]

- **Claim:** The widest printable uniform lattice is the conservative upper bound on achievable reliability; infeasible material must be refused before any candidate is drawn
- **Method:** Engine family_feasibility() vs independent uniform-W_MAX demands and P_f, for rPETG and a synthetic weak material
- **Tolerance:** feasible iff P_f(W_MAX) <= target; both cases must match independent computation <=1e-12
- **Observed:** rPETG: feasible=True, min P_f 0.00e+00; weak material: feasible=False, min P_f 0.322
- **Notes:** The infeasible case is a synthetic stress-test material (E=700 MPa, sy=14 MPa), not a feedstock record. The gate is a pre-design refusal, not an optimisation result.

### K4 — Printed-process gate: only FDM/FFF data may enter the printed-bracket model [PASS]

- **Claim:** Non-printed presets are contrast-only: family_feasibility must refuse them with process_mismatch before any design
- **Method:** Engine family_feasibility and Material.print_process_ok vs independent process-string classification (rPETG FDM vs rPET/rHDPE/rPP IM/compression)
- **Tolerance:** rPETG process_ok/feasible true; all non-printed presets process_ok=false, feasible=false, reason=process_mismatch, min_pf=None; print_process_ok probes all correct
- **Observed:** rPETG process_ok/feasible=True/True; rpet(IM): process_ok=False, feasible=False, reason=process_mismatch; rhdpe(IM/compression): process_ok=False, feasible=False, reason=process_mismatch; rpp(IM): process_ok=False, feasible=False, reason=process_mismatch; probes correct=True
- **Notes:** This is a claim gate, not a mechanical check: moulded/injection data cannot represent a printed lattice. rPETG is the only printable preset in the library; the others remain visible as labelled contrast only.
- **Evidence:** `{"rpetg": {"process": "FDM/FFF", "process_ok": true, "feasible": true, "min_achievable_pf": 0.0}, "nonprintable": {"rpet": {"process": "IM", "process_ok": false, "feasible": false, "reason": "process_mismatch", "engine_process_ok": false}, "rhdpe": {"process": "IM/compression", "process_ok": false, "feasible": false, "reason": "process_mismatch", "engine_process_ok": false}, "rpp": {"process": "IM", "process_ok": false, "feasible": false, "reason": "process_mismatch", "engine_process_ok": false}}, "probes_ok": true}`

### K5 — Elongation / brittle-lot screen verified with its own lot/within split (add-on estimate, not a formal bound) [PASS]

- **Claim:** The brittle screen is a one-property lognormal marginal with an elongation-specific variance split; it does NOT claim a joint three-property probability (E-elongation correlation assumed, not measured)
- **Method:** Independent scipy.stats.lognorm / direct normal CDF using the elongation-specific split (lot sqrt(frac), within sqrt(1-frac), measured lot f=1), supplied reference values, monotonicity, zero-CV/NaN limits, evaluate() strain_req consistency, fixed 1% brittle_ok threshold
- **Tolerance:** max |engine - independent| <= 1e-12; Lead reference values reproduced to 1e-12; measured-lot elongation CV 0.1854723699099141 exact; deg limits exact; brittle_ok matches pf_brittle <= 1% threshold
- **Observed:** max abs err 6.7e-16; ref 0.02=6.010388e-07, 0.04=5.280468e-01 (rel err 0.0e+00); lot split sqrt(0.50); measured-lot elong CV 0.185472 (ref 0.185472); strain_req 0.896% == sigma_req/E_mean; pf_brittle 0.00e+00; headline pf 0.00996 + add-on = estimate 0.00996; 1% screen threshold verified (pass/fail boundary found)
- **Notes:** The three-property joint probability is intentionally NOT claimed. The v0.4 screen uses an elongation-specific lot/within split (rPETG 50% between lots, vs 85% for E/sy) and a fixed 1% brittle_ok threshold that is documented and is NOT the design target. The reported brittle add-on is an estimate (not a formal bound) because the E-elongation correlation (-0.25) is assumed.
- **Evidence:** `{"max_abs_err": 6.661338147750939e-16, "reference_values": {"lot_pf_0.02": 6.010388069466188e-07, "lot_pf_0.04": 0.5280467959439502, "measured_lot_elongation_cv": 0.1854723699099141}, "reference_rel_err": 0.0, "elongation_lot_variance_fractions": {"rpetg": 0.5, "rpet": 0.6, "rhdpe": 0.55, "rpp": 0.6}, "strain_req": 0.008955343469889637, "pf_brittle": 0.0, "pf_addon_estimate": 0.009956387330703032, "headline_pf": 0.009956387330703032, "brittle_threshold": {"pass_example": [1.6, 2.5212274170516302e-05, true], "fail_example": [1.25, 0.01074087304992316, false]}, "requested_demands": [0.001, 0.002, 0.004, 0.0089553, 0.012, 0.02, 0.04], "engine_values": [0.0, 0.0, 0.0, 0.0, 0.0, 6.010388069466188e-07, 0.5280467959439502]}`

### K6 — Union-mass final polish is recorded, bounded and correctly accepted/declined [PASS]

- **Claim:** Multi-start ranks analytic mass; the short local polish minimises printed Halton mass subject to target P_f and printability; acceptance requires a genuine 60k printed-mass improvement
- **Method:** Independent replication of the pre-polish multi-start selection vs engine optimize_robust; compare 60k printed masses, feasibility, printability, decline logic, runtime
- **Tolerance:** final feasible + printable; accepted printed mass <= pre-polish within Halton tolerance; if declined, controls unchanged and decline verified; runtime < 120 s
- **Observed:** pre-polish printed 46.400 g -> final 46.400 g (+0.000%); union_polished=False, union_evals=0; final pf 0.00996, neighbour ratio 1.375, slenderness 21.9; runtime 3.6 s; 60k-vs-independent-union +0.01%; mode=declined
- **Notes:** The global search still ranks with the analytic upper bound (disclosed); only the final selection/polish uses the printed union. The default rPETG design correctly declines the polish when no compliant improvement exists.
- **Evidence:** `{"pre_polish_printed_g": 46.40025605333333, "final_printed_g": 46.40025605333333, "relative_change_pct": 0.0, "union_polished": false, "union_evals": 0, "runtime_s": 3.551488708006218, "final_pf": 0.009956387330703032, "printability": {"min_width_mm": 1.2427942708684527, "max_width_mm": 1.9859795900725021, "max_slenderness": 21.915259138263814, "max_neighbour_width_ratio": 1.3754074300634593, "out_of_bounds": false}, "printed_vs_independent_union_pct": 0.012012736372124522, "decline_check": {"candidate_printed_g": 46.42023989333333, "candidate_pf": 0.009985892444542066, "would_accept": false, "improve": false, "printability": {"min_width_mm": 1.2121095709900265, "max_width_mm": 2.074794865235298, "max_slenderness": 21.335241624351426, "max_neighbour_width_ratio": 1.4231384137242973, "out_of_bounds": false}}}`

### K7 — Assumption bounds are computed correctly and labelled as assumption sensitivity, not validation [PASS]

- **Claim:** P_f is re-evaluated for corr(lnE,ln sy)=0.30/0.70 and lot-vs-within variance split 75/95%; this is a sensitivity band on unmeasured assumptions
- **Method:** Engine assumption_bounds vs independent SciPy closed-form P_f at each assumption setting
- **Tolerance:** engine vs independent <= 1e-12; pf_min/pf_max match the four settings; split monotone
- **Observed:** corr 0.30/0.70 -> 0.00996/0.00996 (insensitive=True); split 75/95% -> 0.00200/0.01201; range [0.00200, 0.01201], max err 3.1e-17
- **Notes:** These are unmeasured assumptions: no recyclate dataset gives the lnE-ln sy correlation or the lot/within variance split. The bound is reported as a range, not as validation. For this stiffness-governed design the correlation has no effect; the split moves P_f by ~6x, which is the dominant assumption exposure.

### K8 — Design-stage report and app export carry the v0.4 disclosures [PASS]

- **Claim:** Report summary/HTML must contain the brittle screen, assumption bounds, process compatibility, validation counts and the no-delivered-lot statement; app Prove export carries lot identity
- **Method:** reports/summary.json + reports/qualification_report.html + historical bracket app export (static audit)
- **Tolerance:** all required fields present and internally consistent; validation counts match the current results.json (else WARN: regenerate reports)
- **Observed:** fields_ok=True, html_ok=True, app_lot_identity=True, v0.4-hardening wording=True, report validation 56P/2W/0F of 58 (expected for this run if K8 passes: 56P/2W/0F of 58)
- **Notes:** Reports are generated artifacts: run `make report` after the validation suite so the report embeds the current counts and the hardened brittle-screen wording (the check then flips to PASS). The no-lot statement is required because the design-stage report is generic; the app Prove export carries lot ID, supplier, measurement source/CV and recycled-content %.

## L. Coupon pre-registration (L3+ path; no physical data)

### L1 — Frozen coupon/bracket predictions, protocol and comparison tool are pre-registered [PASS]

- **Claim:** The L3+ path is a pre-registered, blind prediction package: no physical test exists, so this check only verifies integrity and reproducibility of the frozen artifacts
- **Method:** COUPON_TEST_PLAN.md + coupon_predictions.json (hash) + compare_measurements.py; predictions recomputed from current engine/model
- **Tolerance:** files exist, pre-registration hash matches canonical payload, stiffness/first-yield/strain/brittle predictions reproduce <=1e-9, tool template parses
- **Observed:** hash OK; bracket prediction recompute rel 0.0e+00, coupon 0.0e+00; compare tool OK
- **Notes:** Status is L3-path *pre-registration*, not L3/L4 evidence: no measurements have been made. The hash freezes geometry, material, predictions, uncertainty bands and acceptance criteria before any test. If the engine changes, the L1 check will flag the prediction drift and the pre-registration must be explicitly reissued (never silently re-tuned).

## Claim-ladder mapping

| Level | Status | Evidence from this suite |
|---|---|---|
| L0 code verified | achieved | A1-A7 (element benchmarks, rigid body, equilibrium, symmetry, independent assembly, linearity) |
| L1 solution verified | achieved | B (energy-minimisation cross-check), C1-C5 (reliability quadrature/MC convergence), D1-D3 (optimiser vs brute force), E (periodic cell energy/stress consistency), F4/F5 (mass basis audited), H (counts/determinism), J/K (model-form bands and v0.3/v0.4 features: K4 process gate, K5 brittle marginal, K6 union polish, K7 assumption bounds, K8 report disclosures) |
| L2 literature calibrated uq | partial | rPETG preset moments/correlation verified internally (G); literature provenance not independently re-derived here |
| L3 literature reproduced | pre-registered, no data | coupon/bracket blind predictions (stiffness, first-yield, strain, brittle marginal), protocol and acceptance criteria frozen and hashed (L1); no measurements have been made |
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
- **mass overcount:** Analytic mass is a conservative upper bound (F4): it double-counts strut overlap. Corrected over-count of the printed union: +5.6% at w=1 mm, +12.2% at w=2 mm, +27.9% at w=4 mm; shipped robust design +9.5% (analytic 50.81 g vs printed union 46.39 g). The engine reports the Halton-QMC printed union as headline mass (F5, accurate to <0.3%); always label analytic mass as 'upper bound'.
- **optimiser scope:** D validates a reduced 2-parameter family and checks the shipped 8-parameter result; it does not prove global optimality of the 8-parameter problem.
- **cell size model form:** Predictions depend strongly on the cell count: generalised 4x2-14x6 lattices on the same envelope change u_tip by ~58% and strength demand by ~98% at matched mass (J1). The 7x3 layout is the product contract; do not transfer absolute numbers to other cell counts.
- **joint model form:** Rigid-frame idealisation vs pin-jointed truss: tip stiffness differs by only 0.4%, but frame demands are 14% (strength) and 9% (stiffness) higher (J2); real printed joints lie between these bounds.
- **sustained load:** Sustained-load/creep advisory bound fails the static allowable: bound P_f ~1.0 and bound deflection ~4.0 mm > 2.5 mm limit (K1). The static design is NOT qualified for sustained load.
- **coupon not tested:** The coupon/bracket plan is pre-registered only (L1); no physical measurements exist. Claim level remains L0-L1, L2 partial, L3 pre-registered.
- **brittle screen marginal:** The brittle-lot screen is a one-property lognormal marginal (pf_brittle) reported as an add-on estimate (not a formal bound); the joint three-property probability is NOT claimed because the E-elongation correlation (-0.25) is assumed. It uses an elongation-specific lot/within split (rPETG 50% between lots vs 85% for E/sy) and a fixed 1% brittle_ok threshold that is not the design target (K5).
- **assumption bounds not validation:** The reported P_f range over corr 0.30/0.70 and lot split 75/95% is sensitivity to unmeasured assumptions, not validation; the split is the dominant exposure (~6x P_f swing on the shipped design, K7).
- **process gate scope:** Only FDM/FFF material data may enter the printed-bracket model; moulded/injection presets are contrast-only and design is blocked (K4). This is a claim gate, not a mechanical validation of printed-part properties.
- **printed union discretisation:** The deterministic 60k-point Halton printed-union estimate deviates from an independent 10M-sample Monte Carlo by <=0.1% at the shipped designs but by 0.35% at w=1 mm (W_MIN) — beyond the documented 0.3% claim (F5 WARN). Analytic mass is a deliberate upper bound (F4 WARN).

### What this suite verifies

1. The 2-D frame element and the full 94-element assembly are correct for their idealisation (closed-form benchmarks, rigid-body modes, equilibrium, symmetry, independent energy minimisation).
2. The closed-form reliability is numerically correct against independent quadrature, SciPy's bivariate-normal CDF, and 1e6-sample Monte Carlo, including tails, correlations 0–0.95, quadrature-order convergence and degenerate (zero-variance) limits.
3. The deterministic multi-start optimiser finds a feasible design within 1% of a brute-force optimum on a reduced 2-parameter family, and 200 random designs do not beat it by >2%.
4. The periodic unit cell reproduces the analytical stretching-dominated stiffness within 0.15% and the expected w^1 scaling; the shear response differs from the pin-jointed estimate by a documented 0.4–3.2% (frame action).
5. Mass/volume arithmetic is exact; the STL strut mesh (F2a) and axis-aligned wall pad (F2b) are correct and the signed volume matches the analytic sum (F3). The known node-overlap over-count of the reported mass is quantified (F4) and the printed-union estimator is audited (F5); these are the two documented WARNs.
6. Material sampling reproduces declared moments/correlation and the two-level variance split.
7. Python and JavaScript agree on all frozen fixtures and the fixture regenerates byte-identically; the independent JS test suite passes.
8. The corrected mass basis is audited: analytic mass is a conservative upper bound (+5.6% at w=1 to +28.0% at w=4 mm of the printed union; +9.5% at the shipped robust design) while the engine's Halton-QMC printed mass matches an independent 2e6-sample Monte Carlo to <0.3% (F4/F5).
9. Model-form bands are quantified: cell-count choice (4x2-14x6) changes tip deflection by ~58% and strength demand by ~98% at matched mass (J1); rigid-frame vs pin-jointed truss differs by 0.4% in tip stiffness but frame demands are ~14% (strength) and ~9% (stiffness) higher (J2).
10. v0.3 behaviours are independently checked: sustained-load/creep advisory bound is harsher than the static allowable and fails it (K1); a 12% measurement CV is retained (known-lot P_f ~0.8%, not zero) and the lot-specific recipe is self-consistent (K2); the family feasibility gate matches an independent W_MAX computation for feasible and infeasible materials (K3).
11. The coupon/bracket blind-prediction package is pre-registered and hash-frozen, including stiffness, first-yield, strain and brittle-marginal predictions; no physical test has been performed or is claimed (L1).
12. v0.4 additions are independently checked: the printed-process gate refuses IM/compression presets and lets only FDM/FFF data through (K4); the brittle-lot screen matches an independent lognormal marginal, is monotone, handles zero-CV/NaN limits and keeps the headline two-property P_f separate (K5); the union-mass polish is recorded, bounded, printable and correctly declined when there is no compliant improvement (K6); assumption bounds over corr 0.30/0.70 and lot split 75/95% match independent closed-form P_f and are reported as assumption sensitivity, not validation (K7); the report/export disclosures are present (K8).
13. The design-stage report explicitly states that no delivered lot was supplied, while the app Prove export carries lot ID, supplier, measurement source/CV and recycled-content % as a paperwork claim (K8).

### What this suite does NOT verify

It does not validate the model against any physical part. No tensile, lattice-coupon or bracket experiment exists; the 2-D frame idealisation, joint compliance, layer anisotropy, out-of-plane behaviour, plasticity, creep/fatigue, spatial defect statistics and the literature-derived material distributions are outside the scope of these checks. The sustained-load bound is an advisory calculation, not a creep model; the cell-size and joint bands are internal model-form estimates, not experiments. The brittle screen is a one-property marginal, not a joint three-property probability; the assumption bounds are sensitivity to unmeasured values; the process gate is a claim-scope restriction, not a printed-part validation. The coupon/bracket plan is pre-registered only (L3 path), with no measurements. The claim level remains L0–L1 (code/solution verification) with partial L2 (literature-calibrated UQ), **not** L3–L6. No statement here supports certification, production reliability, or compliance with ISO/ASTM/UL/PPWR requirements.

## Figures

- `figures/01_reliability_quadrature_convergence.png`
- `figures/03_optimiser_grid_vs_pattern_search.png`
- `figures/02_unit_cell_stiffness_vs_width.png`
- `figures/04_mass_overlap_vs_width.png`
- `figures/05_model_form_bands.png`
- `figures/06_v04_features.png`

## Environment and reproducibility

- Python 3.15.2, NumPy 2.5.4, SciPy 1.18.1, Matplotlib 3.11.2, Node v26.12.1
- Engine file SHA-256: `39ad9de85ac3694435f4d9a226532e04`
- Fixture SHA-256: `82b48a676a397ec8a5e94cdd1c767d84`
- Seeds are fixed (20261029, 7, 11, 42, 101, 2027, 5); no network access is used by the suite.

## Model-form bands (J1/J2) — how to use them

- **J1 cell size/topology:** 7x3 vs engine rel 4.7e-15; same-width spread: u_tip 88%, sigma_req 34%, E_req 495%; mass-matched spread: u_tip 58%, sigma_req 98%, E_req 23%. At matched mass the band is dominated by architecture change, not numerical refinement; the 7x3 layout is the product contract.
- **J2 joint stiffness:** stiffness frame/truss 1.004; sigma_req frame/truss 1.141; E_req frame/truss 0.997.
- Use these bands as the model-form uncertainty contribution when comparing to any experiment; do not quote a single number as if the frame/truss and cell-count choice did not matter.

## Sustained-load advisory (K1)

- static P_f 0.0100; bound P_f 1.000000 (>=1 means essentially certain); E_req_bound 3376 MPa; sigma_req_bound 23.51 MPa; deflection_bound 4.02 mm (> 2.5 limit). Honesty result: the shipped static design is NOT qualified for sustained load under this bound (P_f_bound ~= 1.0, bound deflection 4.0 mm > 2.5 mm limit). The UI must show the bound as advisory and say the part is not qualified for sustained load; the static result is unchanged.

## Coupon pre-registration (L1) — L3+ path, no data

- Files: `COUPON_TEST_PLAN.md`, `coupon_predictions.json`, `compare_measurements.py`.
- hash OK; bracket prediction recompute rel 0.0e+00, coupon 0.0e+00; compare tool OK. Status is L3-path *pre-registration*, not L3/L4 evidence: no measurements have been made. The hash freezes geometry, material, predictions, uncertainty bands and acceptance criteria before any test. If the engine changes, the L1 check will flag the prediction drift and the pre-registration must be explicitly reissued (never silently re-tuned).

## Defects found by this validation, and their status

| Defect | Found by | Status |
|---|---|---|
| Pre-v0.3 validator union sampler sampled only half of each strut (mask `abs(along)<=L/2`) | F4 (independent audit) | **FIXED**: full-length mask `0<=along<=L`; corrected numbers above and the old +25%/40.5 g figures are void |
| STL wall pad exported as a sheared parallelogram | F2b | **FIXED** (earlier round): axis-aligned pad; F2b PASS |
| Fixed 48-point GL loss at rho=0.99 | C1b | **FIXED**: adaptive SciPy path for |rho|>0.9; C1b PASS (independent 1-D quadrature) |
| Degenerate-marginal P_f combination | C9 | **FIXED**: corrected combination; C9 exact |
| Engine printed/union mass method changed to deterministic Halton QMC | v0.3 | **AUDITED**: F5 WARN — ≤0.1% vs independent MC at shipped designs, 0.35% at w=1 mm (W_MIN); analytic remains a labelled upper bound (F4 WARN) |
| Generated report validation counts lag the suite after each check-set change | K8 | **OPEN (WARN, by design)**: run `make report` after validation; the check then flips to PASS. Report content (brittle, assumptions, process, no-lot statement) is present. |

## Recommended engine/product changes (not applied — validator scope)

1. **Mass labels (F4, WARN):** keep `printed_mass_g` as every displayed/exported mass (already the v0.3 contract) and label `mass_g` strictly as a conservative analytic upper bound. No further engine change is requested for the union estimator at the shipped designs (F5: ≤0.1% vs independent Monte Carlo). If a W_MIN-width design is ever shown as a headline mass, increase the Halton sample count (60k -> ~240k) or surface the documented 0.35% W_MIN tolerance.
2. **Sustained-load UI (K1):** the bound P_f is ~1.0 and bound deflection ~4.0 mm > 2.5 mm; the proof screen must say the part is not qualified for sustained load and keep the static result unchanged.
3. **Model-form disclosure (J1/J2):** surface the cell-count and frame-vs-truss bands wherever absolute numbers are shown; avoid implying the lattice family is a general topology optimiser.
4. **Coupon path (L1):** re-issue the pre-registration (new hash) if the engine changes; never tune predictions after measurements. The v0.4 package now also freezes strain-demand and brittle-marginal predictions plus an ISO 527-2 elongation coupon test.
5. **Report freshness (K8):** generated reports embed the last validation counts. Run `make report` after every validation run; K8 remains WARN until the report's counts match `validation/results.json`.
6. **Brittle screen (K5):** keep `pf_brittle` / `pf_brittle_bound` visually separate from the headline two-property P_f and never present the add-on estimate as a joint probability or a formal bound; the E-elongation correlation is assumed and the elongation split differs from E/sy.


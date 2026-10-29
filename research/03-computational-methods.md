# 03 — Computational methods: the methods menu, and the architecture AnyRB should actually build

**Status:** v1.0, 2026-10-29 · **Owner:** researcher-methods · **Feeds:** `PRODUCT_SPEC.md` §1 (modules), §2.1–2.4 (FE / optimisation / recipe contracts), §6 (Python engine), §7 (claim limits).

**Purpose.** A methods menu for a virtual robust-design tool: multiscale mechanics, uncertainty quantification, surrogates/AI, reliability-based optimisation, digital-twin coupling — with the problem size at which each pays, its cost, fidelity and failure modes, and whether AnyRB should build, integrate or ignore it. One constraint governs everything: **we cannot run a physical test**, so method choice is driven by auditability as much as speed. A method that is 10× faster but cannot be checked against a closed-form benchmark is the wrong method for us.

**Reading key for evidence grades** (adopted from dossiers 01/02): **A** = peer-reviewed quantitative with reported data; **B** = peer-reviewed review/theory/methodology/software; **C** = standard, agency report or official documentation; **D** = derivation or estimate produced in this dossier; **[SPEC]** = internal `PRODUCT_SPEC.md`. Every `[Rxx]` resolves in `refs-03.json`.

---

## 0. Executive answer in six findings

1. **The v0.1 frame is not a coarse 3D model; it is the correct leading model for slender-member lattices.** A 7×3-cell bracket has no scale separation, so a homogenised unit-cell model — the usual "multiscale" shortcut — would be an unjustified average. The real error comes from joints, strut thickness tolerance and layer anisotropy, not from the 2D idealisation [D]. AnyRB should call v0.1 *discrete frame analysis*, never "multiscale".
2. **For v0.1 there is nothing worth surrogating.** With two random variables (`E`, `σy`), a single-material linear frame and failure thresholds independent of the random draws, `P_f` is exact if `(E, σy)` are jointly lognormal [SPEC §2.1]. One unit-load solve per design gives every batch response by arithmetic. Adding PCE or a GP to v0.1 would be slower *and* less verifiable.
3. **Monte Carlo stays as reference truth even when it is not the production path.** It proves the analytic formula and remains correct when v0.2 breaks the assumptions. Errors are computable: at `P_f = 10⁻²`, `N = 5 000` gives ≈14 % relative standard error, so the visible MC gauge is not a decision number at the reliability target — the app must say so [D].
4. **The UQ object is a hierarchy, not a fixed distribution.** AnyRB models a distribution *over* lot distributions (lot mean shift, then within-lot scatter) [SPEC §3]. The right structure is the law of total probability — condition on the lot, then integrate over lots. Methods that pool everything into one distribution silently erase the lot-level risk the product exists to manage [D].
5. **AI/ML is a v1.0 accelerator, not a v0.1 ingredient.** Forward property/structure–property surrogates are established inside their training distribution [R27–R29, R32, R42]; generative inverse design is real research but adds unverifiable freedom for an 8-variable design space [R33–R38]; PINNs are not competitive with a 96-DOF FE solve and the ML-for-PDE literature has known reporting biases [R39, R40]. The honest ML roles are (i) probabilistic surrogate for *expensive* v1.0 models and (ii) data-driven refinement of the feedstock model — both wrapped in forward-FE verification, neither used as certification evidence.
6. **Architecture in one line:** v0.1 = verified 2D frame FE + exact bivariate reliability + derivative-free optimiser + MC cross-checks; v0.2 = shell/3D mechanics + correlated lot model + FORM/importance sampling + Sobol + calibration hooks; v1.0 = verified homogenisation + process/anisotropy coupling + Bayesian updating from optional coupon data + surrogate-accelerated RBDO + auditable digital thread. Build the closed loop and the artifact; integrate solvers and data sources.

---

## 1. Multiscale mechanics and structural idealisation

### 1.1 What the model must represent

The reference part is a 7×3 X-braced grid of rectangular struts, extruded 10 mm, cantilever-loaded in-plane [SPEC §2]. It is asked for tip stiffness, peak axial/bending stress and compressive buckling — all architectural, i.e. dependent on load sharing. So the question is not "what is the most sophisticated mechanics?" but "what is the cheapest model with error small compared with the signal?". With `CV(E)` 10–20 % and `CV(σy)` 11–16 % [SPEC §3], a model with ~20 % systematic error competes with the signal; at ~5 % it supports design ranking.

### 1.2 Homogenisation: four flavours, four validity conditions

**(a) Asymptotic homogenisation.** Expand displacements in powers of cell-to-part scale ratio `ε` and solve a unit-cell problem; leading-order stiffness follows from the RVE energy [R04, R05]. It is rigorous when `ε ≪ 1` and is what makes multiscale topology optimisation tractable [R09, R10]. AnyRB's demo has 7 cells along the span and a width field graded *at cell scale*, so the slowly-varying assumption fails precisely where the design acts. Verdict: **not justified for v0.1**; v1.0 only on ≥15-cell designs, verified against the discrete model.

**(b) Numerical RVE homogenisation.** Apply periodic boundary conditions and unit macro-strains to a representative cell, extracting effective stiffness by energy equivalence. It is cheaper than asymptotics and valid for arbitrary cell geometry [R06]. It still assumes periodicity/scale separation and cannot capture boundary layers (wall pad, free edge) or a graded field without a position-dependent RVE. Verdict: v1.0 option with mandatory discrete-vs-homogenised comparison [D].

**(c) Beam-lattice scaling.** For bending-dominated open cells, Gibson–Ashby gives `E*/E_s = C(ρ*/ρ_s)²` and strength scaling near exponent 1.5; stretching-dominated topologies push the stiffness exponent toward 1 [R01, R02, R03]. These laws are the correct screening tool for relative-density trade-offs and explain why architecture changes the mean response; 3D architected-material surveys show the same scaling logic across topologies [R08]. They are not stress analysis, and they say nothing about variability beyond the energy argument in dossier 02. Use them as sanity checks (fitted exponent for the X-braced grid should lie between 1 and 2) and as app explanation — computed, not asserted [D].

**(d) Bounds.** Hashin–Shtrikman bounds bracket a two-phase effective modulus from volume fractions and phase moduli [R07]. Unneeded in v0.1; the v0.2 fallback for unknown blends is a bounded stiffness rather than a point value [D].

The closest published analogue for our problem (Georgiou et al.) couples Monte Carlo with a tension-shear-chain multiscale model of recycled-plastic composites and reports measured variability suppression [R11]; it is a strong existence proof that this method class works, but it is a two-phase brick-and-mortar architecture, not a single-material printed frame.

### 1.3 When 2D frame suffices — and when it does not

The frame is exact *for its own idealisation*: rigid joints, Euler–Bernoulli members, in-plane loading. Real printed parts break each assumption in an assessable direction (Table 1): joint compliance, layer anisotropy and strut under-thickness all tend to make the real part **more compliant and weaker** than the ideal frame. An optimistic model is dangerous for absolute claims but still useful for *ranking*, because the bias partially cancels — exactly how the claim must be worded (dossier 05). Small deflection is safe (`u_lim/L = 2.5/150 ≈ 1.7 %` [D]); shear deformation matters at span-to-depth below ~10 and is a v0.2 cross-check.

**Table 1 — Mechanics options: cost, fidelity, error sources, verdict.**

| Model | Unknowns (demo scale) | Cost / design | Fidelity for this part | Dominant error sources | AnyRB verdict |
|---|---|---|---|---|---|
| Closed-form beam + truss hand calc | ~10 | µs | Order-of-magnitude | joint fixity, X-brace load path | Benchmarks only |
| 2D frame FE (v0.1) | 96 DOF, 94 elements | ms | Best in-plane structural model at this scale | joint rigidity, strut tolerance, layer anisotropy, no out-of-plane | **v0.1 production** |
| 2D frame + Timoshenko shear | 96 DOF | ms | Marginal improvement | same as above | v0.2 cross-check |
| 3D solid/shell FE | 10⁴–10⁵ DOF | 10²–10³ s | Out-of-plane bending, torsion, joints, plate buckling | mesh at joints, contact, material direction | v0.2/v1.0 |
| Asymptotic homogenisation | cell RVE | ms after cache | Global stiffness only | scale separation violated (7 cells, graded field) | v1.0 with verification |
| Numerical RVE homogenisation | cell RVE | ms–s | Global stiffness, arbitrary cell | boundary layers, periodicity, grading | v1.0 option |
| Gibson–Ashby scaling | algebraic | µs | Relative-density trends | topology factor, joints, finite deformation | Screening/sanity checks |

### 1.4 Error budget and verification duties

Four terms dominate: (i) **idealisation** (2D vs 3D; one-sided stiff/strong bias expected); (ii) **joints** (printed nodes are neither pinned nor rigid, and local stress concentration is outside beam theory); (iii) **as-built geometry** (the engine is exactly linear in `I`, so a 10 % width error is a 33 % stiffness error in a bending-dominated member [D]); (iv) **material direction** (FFF parts are anisotropic between roads and layers; v0.1 assumes isotropy [R43]). These are why claims are restricted to relative comparisons and trend-level numbers, and why the first future physical tests are coupons, not the bracket. Verification duties — cantilever closed form, single-element axial/bending patch tests, rigid-body modes, symmetry, element equilibrium, subdivision invariance, mass consistency — are given acceptance criteria in dossier 05 §4.1.

---

## 2. Uncertainty quantification

### 2.1 The uncertainty taxonomy

- **Aleatory, lot-level:** correlated lot mean multipliers on `E`, `σy` — risk architecture can partly dilute, never remove for single-material stiffness [SPEC §3].
- **Aleatory, within-lot:** specimen scatter, correlated with the lot mean.
- **Aleatory, loading/geometry:** load and as-built width — fixed in v0.1, natural v0.2 additions.
- **Epistemic, parameter:** literature-derived means/CVs/correlations estimated from other streams.
- **Epistemic, model-form:** frame vs real part; linear vs plastic; Euler buckling vs real joints.

Because the aleatory structure is a hierarchy, the UQ engine must sample a hierarchy: draw a lot, draw specimens, evaluate. Off-the-shelf UQ that takes one pooled distribution would mis-state the very risk the product sells against [D].

### 2.2 Monte Carlo, QMC and rare events

Plain MC is unbiased, parallel and self-erroring: `SE(P̂_f) = √(p(1−p)/N)`, so relative error scales as `1/√(Np)` — at `P_f = 10⁻²`, 5 000 samples give ≈14 % relative error, 40 000 give ≈5 %, and 10⁶ give ≈1 % [D]. For the v0.1 target (`P_f = 10⁻²`) and a 300 ms UI budget, the histogram is illustrative and the analytic number is the decision. Quasi-Monte Carlo improves convergence toward `O(N⁻¹)` for smooth integrands [R25] but degrades to MC rates across the failure discontinuity, so it helps moments more than `P_f`. Subset simulation decomposes rare events into conditional moderate-probability stages [R23]; multilevel MC exploits model fidelities [R24]. Both are v1.0 tools for `P_f < 10⁻³`.

### 2.3 PCE and stochastic collocation

Polynomial chaos expands the response in orthogonal polynomials; for smooth responses in moderate dimension it converges spectrally and yields Sobol indices from its coefficients [R12, R14]. Stochastic collocation evaluates at quadrature nodes instead of projecting, which suits black-box FE [R13]. The curse of dimensionality is explicit: a total-degree basis in `d` variables has `(p+d)!/(p!d!)` terms (e.g. `d = 10`, `p = 4` → 1 001). For v0.1 (`d = 2`, analytic response) PCE is pointless; it becomes attractive at v0.2–v1.0 if random dimension reaches 5–15 and FE stays cheap enough for a few hundred evaluations, preferably as sparse/regression PCE [R14].

### 2.4 GP surrogates and active learning

A GP returns a mean and a predictive variance, which is exactly what an optimiser needs [R17, R19]. Two uses must not be conflated: (i) global surrogate for an expensive model — error control outside the sampled region is the hard part; (ii) active learning for reliability (AK-MCS), which adds samples only near the failure boundary and cuts FE calls by orders of magnitude at small `P_f` [R22]; EGO does the analogous thing for expensive optimisation [R18]. Neither is needed in v0.1; both become correct when v1.0 models cost seconds–hours.

### 2.5 Bayesian calibration

Kennedy–O'Hagan calibration writes `y = η(x, θ) + δ(x) + ε`, separating parameters, model discrepancy and measurement error [R16]. Without `δ`, calibration bends parameters to absorb model error, producing a model that fits history and predicts badly. With no experiments today, AnyRB's calibration is limited to fitting the feedstock *distribution* to literature/passport data and calibrating the proxy model on published paired data [R31]. Dossier 05 reserves `δ` for coupon tests: a systematic 12 % deflection offset is a reported discrepancy, not a modulus to inflate.

### 2.6 Global sensitivity

Sobol indices decompose output variance into main effects and interactions [R15]. The decision question is which input dominates `P_f` and the robustness index. Three tiers: local finite differences (v0.1's stated metric) — cheap but blind to interactions; PCE-coefficient Sobol indices (v0.2) — free once a PCE exists; Saltelli pick-freeze estimators (v0.2 fallback, `N(d+2)` calls) [R15]. A UI pitfall: `∂P_f/∂CV` is usually a weaker lever than `∂P_f/∂mean` near the target, so both must be shown or users over-interpret scatter [D].

### 2.7 Reliability methods: FORM/SORM, exact bivariate, interval methods

FORM maps the limit state to standard normal space, finds the design point, gives `P_f ≈ Φ(−β)` and direction cosines for importance [R20, R21]; SORM adds curvature. FORM is fast but degrades for strongly nonlinear limit states. In v0.1 the limit state is *linear in the threshold variables* and demands are independent of `(E, σy)`, so under joint lognormality the exact answer is a bivariate normal probability over two thresholds [SPEC §2.1]. That exactness is an asset: checkable against MC to 10⁻⁶ and smooth in the design variables the optimiser moves. FORM/SORM arrive in v0.2 for multi-mode and geometry-random cases; AK-MCS when `P_f` goes small [R22]. When lot data are too sparse to justify a distribution, interval/convex or p-box methods return *bounds* on `P_f` [R26] — more honest, but not a decision-friendly single number. Recommendation: v0.2 optional "evidence-poor" mode that reports bounds and refuses to plot a single reliability gauge [D].

**Table 2 — UQ method selection by problem size and question.**

| Situation | Recommended method | Why | Pitfall to avoid |
|---|---|---|---|
| ≤3 random vars, cheap model, `P_f ≥ 10⁻³` | exact/analytic if available; else MC ≥10⁴ | verifiable, fast | reporting 5×10³ MC as a decision number |
| Same, moments/sensitivity wanted | QMC or sparse PCE | variance reduction / free Sobol | QMC across a failure discontinuity |
| 4–15 random vars, cheap FE | sparse PCE / stochastic collocation | spectral accuracy | basis explosion; non-smooth limit state |
| 10–50 vars, expensive FE | GP + AK-MCS; subset simulation | sample efficiency | unverified surrogate outside training region |
| `P_f < 10⁻⁴` | subset simulation / importance sampling | rare-event efficiency | naive MC (10⁶+ calls) |
| Distributions not defensible | interval / p-box | honesty about ignorance | quoting a single `P_f` anyway |
| Model vs data | Kennedy–O'Hagan with discrepancy | separates parameters from model error | absorbing model error into parameters |
| Variance attribution | Sobol (Saltelli or PCE) | main + interaction effects | local differences only |

### 2.8 Tooling

v0.1 is deliberately dependency-light (Python + NumPy/SciPy, JS twin); v0.2/v1.0 should integrate rather than re-implement: SciPy for optimisation/linear algebra [R59]; Dakota as UQ/optimisation driver [R54]; OpenTURNS for FORM/SORM, Sobol and calibration [R55]; UQLab for PCE/Bayesian inversion (academic licence; check commercial terms) [R56]; chaospy for PCE bases [R57]; SALib for sensitivity estimators [R58]; BoTorch for GP/BO when evaluations are expensive [R45].

**Table 3 — UQ/optimisation tooling fit.**

| Tool | Language | Licence | Good at | AnyRB role |
|---|---|---|---|---|
| SciPy [R59] | Python | BSD | linear algebra, DE, `minimize` | v0.1 production |
| in-house engines [SPEC] | Python + JS | ours | exact v0.1 reliability, shared metrics | v0.1 production |
| Dakota [R54] | C++/CLI | open source (Sandia) | DOE, UQ, optimisation, RBDO | v0.2 driver alternative |
| OpenTURNS [R55] | Python/C++ | LGPL | FORM/SORM, Sobol, calibration | v0.2 reliability upgrade |
| UQLab [R56] | MATLAB | free academic; commercial licence | PCE, Bayesian inversion | v1.0 verification reference |
| chaospy [R57] | Python | open source | PCE bases, quadrature | v1.0 if PCE adopted |
| SALib [R58] | Python | MIT | Sobol/Morris estimators | v0.2 sensitivity panel |
| BoTorch [R45] | Python | MIT | GP/BO for expensive objectives | v1.0 surrogate optimisation |
| TopOpt codes [R10] | MATLAB/Python | academic | density-based topology optimisation | not directly; ours is parametric |

---

## 3. AI/ML for property prediction and design

### 3.1 Feedstock descriptors → mechanical properties

Polymer informatics is established for *forward* prediction when training sets are large and structurally representative: descriptor models [R27], the Polymer Genome platform [R28], transformer language models over repeat units [R29]. Small-data learning works when features encode the mechanism (the failed-experiment study is the canonical demonstration [R30]); the evidence supports percent-level interpolation across known polymers; it does not support extrapolation to a chemically different recyclate stream, and it does not address recyclate variation, which is physical/processing (contamination, molecular-weight degradation, additive loss), not chemical [D].

For AnyRB the ML object is smaller: cheap lot measurements (MFI/IV/density/quality index) → the `(E, σy, ρ)` distribution. The 2025 ACS Sustainable Resource Management study is direct evidence that near-zero-cost lot inspection can predict recycled-plastic mechanical properties from such proxies [R31]. The lesson is not "train a big model" but "a low-dimensional proxy map exists and must be calibrated per stream with prediction intervals". Recommendation: v0.2 ships a **documented, replaceable proxy model** with published regression form, explicit uncertainty and per-stream recalibration — not a black box trained on unrelated literature. Data needs are modest (tens of paired lot records), which is why it is honest: the user can substitute their own records and inspect the update [D].

### 3.2 Structure–property surrogates for lattices

CNN/GNN surrogates for architected materials predict stiffness or stress fields well *inside a generated dataset* [R32, R37, R42]; data needs are 10³–10⁶ simulated cells, and the surrogate inherits the simulator's biases exactly. For our 8-parameter width family the mapping is smooth and low-dimensional, and the FE solve is milliseconds, so a neural surrogate would be slower and less verifiable. Verdict: **no structure–property NN in v0.1/v0.2**; revisit only if a v1.0 3D/process-coupled model makes direct optimisation infeasible [D].

### 3.3 Generative and inverse design: established, research-grade, and mostly unnecessary here

Generative models (VAE/GAN/diffusion), neural implicit fields and inverse-design pipelines are genuinely demonstrated for metamaterials and molecules [R33–R38]. Honest assessment: **established** — inverse design within a fixed, well-sampled family with a forward simulator in the loop, and generative models as samplers for genuinely high-dimensional spaces [R35–R37]; **research-grade** — de novo load-bearing geometry with manufacturability guarantees and zero-shot generalisation across material classes; **hype-risk** — "AI-designed part validated by AI", generative output presented as reliability evidence, and surrogate-optimised designs never re-scored by the independent physics model. The surrogate-cycle failure is well known: the optimiser exploits surrogate error, so any generative/inverse result must be forward-verified [R38, R41].

For 8 design variables the appropriate engine is a derivative-free optimiser over a physically meaningful parametric family: fewer unverifiable degrees of freedom, every design manufacturable by construction, an auditable trace [D]. Generative geometry becomes interesting at v1.0 only if the product moves to non-parametric architectures (nacre-like platelets, hybrid skins) where the space is genuinely high-dimensional.

### 3.4 Physics-informed ML

PINNs solve forward/inverse PDEs by penalising residual and boundary loss [R39]. They are impressive on smooth low-dimensional problems and not competitive with a verified FE solver for linear frame/3D elasticity; the ML-for-PDE literature also shows weak baselines and over-optimistic reporting [R40], so "PINN beats FE" claims must not be repeated without independent reproduction. Verdict: **not used**; classical solvers remain the verification anchor [D].

### 3.5 Data-driven UQ

Where ML most plausibly enters is as a **probabilistic surrogate** for expensive models (GP/non-parametric regression with calibrated uncertainty) and, at v1.0, as a mapping from lot metadata to distribution parameters trained on the accumulated lot database [R41]. Both are accelerators wrapped in classical UQ, not replacements. Any ML output used in a decision must carry a calibration check (reliability diagram/posterior predictive check) and an OOD flag outside the training envelope [D].

**Table 4 — AI/ML technique maturity for AnyRB.**

| Technique | Evidence status | Data need | OOD / failure risk | Verdict |
|---|---|---|---|---|
| Property prediction from feedstock proxies | Established for specific streams [R31]; needs calibration | tens–hundreds of paired lots | stream change | v0.2 replaceable proxy, intervals |
| Polymer informatics (chemistry → property) | Established in interpolation [R27–R29] | 10³–10⁵ labelled polymers | recyclate chemistry outside training | context only |
| GNN/CNN forward surrogate | Established in-distribution [R32, R42] | 10³–10⁶ simulated samples | simulator bias inherited | v1.0 accelerator only |
| Generative/inverse design | Research-grade for load-bearing parts [R36–R38] | large curated sets + forward solver | validity, manufacturability, OOD | not needed for 8 variables |
| PINN/PIML | Research; over-optimistic benchmarks [R39, R40] | PDE-specific | no advantage at this scale | not used |
| GP surrogate + active learning | Established, probabilistic [R17, R22, R45] | adaptive, 10²–10³ calls | extrapolation; kernel choice | v1.0 if models get expensive |
| Bayesian calibration | Established [R16] | experimental data (future) | parameter–discrepancy confounding | v1.0 with coupon data |

---

## 4. Robust and reliability-based optimisation

### 4.1 Formulations

The v0.1 formulation is a chance constraint: minimise mass subject to `P_f(d, θ) ≤ p_target` with width bounds [SPEC §2.3]. Alternatives and why the chance constraint is the default: **mean–variance** `min E[m] + λ Var[m]` does not express a reliability target and needs a utility model; **worst-case over a box/ellipsoid** guarantees against bounded uncertainty [R46, R47] but is usually too conservative for mass-constrained products and ignores distributional data — robust-design reviews distinguish expected-value and worst-case formulations precisely by this cost [R49]; **CVaR/quantile** controls tail average [R48], not a probability target; **mean-safety-factor RBDO** `μ_g − β_target σ_g ≥ 0` is FORM-based, fast, but assumes a two-moment limit state. Recommendation: keep `P_f` as the primary public metric (interpretable and matching the app's claim), report `P_f` and the capacity-margin percentile together, and do not switch to mean-variance marketing language [D].

### 4.2 Algorithms

Nested RBDO is robust but expensive; it is affordable here only because the inner reliability solve is analytic [R50]. Decoupled RBDO (e.g. SORA) shifts constraints using the previous design point and sharply cuts calls — the v0.2 upgrade once FORM exists [R50]. Surrogate-based RBDO/AK-MCS is for v1.0 when FE calls cost seconds [R22]. For noisy, non-smooth, low-dimensional bounded problems, differential evolution [R52] and pattern search [R51] are appropriate; v0.1 uses the same deterministic multi-start pattern search in both JS and Python [SPEC §2.3]; a global/DE polish is a cheap v0.2 quality upgrade [R53]. Bayesian optimisation is sample-efficient for expensive objectives but adds an unverifiable probabilistic layer; use only when each evaluation costs minutes [R44, R45].

### 4.3 Why v0.1 needs no surrogate: the cost arithmetic

The frame FE solve is 96 DOF — sub-millisecond in NumPy. More importantly, because the material is single and linear and the demand measures are independent of `E`, **one unit-load solve per design** yields `u_tip_unit`, `N_unit`, `M_unit`; every batch evaluation is then arithmetic [SPEC §2.1]. A design evaluation is one small FE solve plus closed-form statistics; ~10³ evaluations with analytic `P_f` cost seconds. So: **cache the unit response per design; vectorise over batch samples; use analytic `P_f` in the loop; use MC only for verification and display** [D]. The v0.2 budget reverses: a 3D model at ~10⁵ DOF costs ~1 s/solve, analytic `P_f` disappears, and 10³ design evaluations × 10³ samples becomes infeasible without a surrogate. The surrogate is triggered by *model cost*, not fashion — a clean engineering rule.

### 4.4 Pitfalls

- **Noisy constraints:** MC `P_f` is noisy; pattern search can "improve" by luck. Use analytic `P_f` in the loop, common random numbers when MC is unavoidable, and independent-seed re-tests of the best candidates [D].
- **Kinked feasible set:** the penalty formulation has a kink at the target; shrinking-step search handles kinks but can stall — multiple restarts mitigate.
- **Local optima:** the bilinear log-width field gives an 8-D non-convex mass–reliability trade-off. Report multiple-seed results and the baseline table; never present one run as "the" optimum [D].
- **Optimiser overfits the distribution model:** mis-specified CV/correlation will be exploited. Sensitivity of the optimum to distribution choice is a v0.2 deliverable.
- **Metric drift:** all four baselines must share feedstock model, load and failure definition — exactly the spec's control [SPEC §2.3].

### 4.5 Master comparison: method → problem size → cost → fidelity → pitfalls

**Table 5 — Master method comparison (read with Tables 1–2; costs are order-of-magnitude per design evaluation [D]).**

| Method | Typical problem size | Cost per evaluation | Fidelity / what it gives | Main pitfall | AnyRB verdict |
|---|---|---|---|---|---|
| Closed-form beam/truss | 1 load path | µs | order-of-magnitude stiffness/stress | joint fixity, load sharing | benchmarks only |
| 2D frame FE | 10² DOF, 10² members | ms | in-plane stiffness, member forces, Euler buckling | joints, anisotropy, out-of-plane | **v0.1** |
| 3D solid/shell FE | 10⁴–10⁶ DOF | s–h | out-of-plane, joints, local stress | mesh/contact, material direction, cost | v0.2/v1.0 |
| Asymptotic / RVE homogenisation | unit cell | ms after cache | effective stiffness of periodic media | scale separation, boundary layers, grading | v1.0 with verification |
| Gibson–Ashby scaling | algebraic | µs | relative-density trends | topology factor, joints | screening |
| Monte Carlo | 10²–10⁶ samples | cheap per sample, `√N` error | reference probabilities, distributions | cost at small `P_f`; noisy constraints | reference in v0.1 |
| QMC | 10²–10⁵ samples | cheap | faster moments | breaks across failure discontinuity | optional |
| PCE / collocation | 2–15 random vars | 10²–10³ model calls | spectral moments + Sobol | basis explosion; non-smooth limit state | v0.2/v1.0 |
| FORM / SORM | 10–50 random vars | 10–10² model calls | β, design point, importance | nonlinear limit states, multiple modes | v0.2 |
| Subset simulation | rare `P_f` | 10³–10⁵ model calls | small probabilities | correlated stages, tuning | v1.0 |
| GP surrogate + AK-MCS | 10–50 vars, expensive model | 10²–10³ model calls | probabilistic surrogate + reliability | extrapolation; kernel choice | v1.0 |
| Bayesian calibration | parameters + discrepancy | 10²–10⁴ posterior samples | updated parameters + model error | identifiability; confounding δ | v1.0 with data |
| GNN/CNN structure–property | 10³–10⁶ training samples | ms per query | fast forward prediction | OOD, inherited simulator bias | v1.0 accelerator |
| Generative / inverse design | high-dimensional families | hours–days training | novel geometry proposals | validity, manufacturability, surrogate cycle | not needed at 8 vars |
| Nested / decoupled RBDO | design vars × reliability | 10²–10⁶ FE calls | reliability-constrained optimum | cost; decoupling accuracy | v0.1 analytic / v0.2 SORA |
| Bayesian optimisation | expensive objective | 10²–10³ model calls | sample-efficient optimum | acquisition tuning; unverifiable layer | v1.0 |

---

## 5. Digital twin and ICME coupling

### 5.1 What "digital twin" should mean here

The literature spans genuinely coupled virtual replicas [R60] and rebranded dashboards; the concept predates the label [R61]. For AnyRB the useful definition is narrow: a **lot-conditioned, versioned model instance** that takes a lot's passport (optionally its measured properties), updates the property distribution, recomputes reliability and emits a decision artifact. It is not a live sensor feed; it is an auditable chain from lot identity to design verdict — achievable without factory integration, and the right thing for a small team to build [D].

### 5.2 The ICME chain, and how much to build

ICME integrates process → structure → property → performance models [R62]. For a printed recyclate bracket the full chain is: feedstock history → print thermal history → crystallinity/weld lines → anisotropic properties → structural response → reliability. Full coupling is a multi-year research programme, unverifiable without measurements. Pragmatic reductions in value order: (1) **property-level anisotropy** — directional moduli `(E_xy, E_z)` and an interlayer strength factor, calibrated from literature ranges and flagged as model-form uncertainty (v0.2 mechanics) [R43]; (2) **as-built geometric uncertainty** — strut width/thickness as random variables calibrated to printer tolerance, testable with calipers [D]; (3) **process simulation** — only if a user's printer/material combination is fixed and measured; integrate vendor tools, do not build a slicer/thermal solver [D].

### 5.3 Data schema and digital thread

The minimum viable digital thread is four linked records: **lot** (supplier, date, measured proxies, provenance, sample size, evidence grade), **design** (parameter vector, model version/hash, FE settings), **analysis** (UQ method, seeds, software version, assumptions hash), **decision** (target, verdict, report hash). Append-only, content-hashed, human-readable. This is what makes the report auditable and turns "we ran a simulation" into "this simulation is reproducible" — the core of the credibility strategy in dossier 05. The digital-thread pattern (traceability from requirements through models to decisions) is established [R63]; v0.1 implementation is a few hundred lines, not a PLM purchase.

### 5.4 Build vs integrate

**Build:** lot statistical model, reliability metric definitions, UQ orchestration/analytic engine, optimiser, batch recipe logic, report artifact, data schema, verification suite. **Integrate:** FE solvers (in-house frame first; shell/solid later), material databases, printer/slicer inputs, and at v1.0 PLM/QMS. **Never build:** an FEA kernel, an ML framework, a generative-geometry engine, a process simulator. The differentiator is the closed loop and the evidence artifact, not the solver [D].

---

## 6. Recommended AnyRB architecture

### 6.1 v0.1 (implemented): verified frame + exact reliability

**Stack:** Python 3 + NumPy/SciPy canonical engine; identical JS engine for the demo; 2D frame FE (94 elements, 96 DOF, unit-load caching); two-level feedstock model with rank correlation; exact bivariate-lognormal `P_f` (yield ∪ buckling ∪ deflection) plus independent MC cross-check; deterministic multi-start pattern search in both JS and Python; six baselines; STL export; self-contained HTML report. **Why it is right:** every number traces to a closed form or a small verified solve; exact reliability is checkable against MC to 10⁻⁶; the pipeline runs offline; and the claim limits are enumerable. **What it cannot do:** no out-of-plane behaviour, joint flexibility, plasticity, layer anisotropy, print-defect statistics, fatigue/creep, or spatial material scatter. Absolute reliability is only as good as the assumed distribution model; comparisons are more trustworthy than absolute values [D].

### 6.2 v0.2: realism without losing verifiability

**Table 6 — v0.2 upgrade priorities, verification duties and risk.**

| Upgrade | Why | Effort | Verification required | Risk if skipped |
|---|---|---|---|---|
| Shell/3D FE for out-of-plane + joints | frame ignores torsion and joint compliance | 3–6 wk | frame–shell comparison at zero out-of-plane load; joint-stiffness study | absolute deflection overstated |
| Correlated feedstock model + CSV-fitted distributions | users have data; correlation drives `P_f` | 1–2 wk | synthetic-parameter recovery; fit tests | wrong risk ranking |
| FORM/SORM + importance sampling | analytic exactness ends with geometry randomness | 2–3 wk | FORM vs MC on v0.1 case; multi-mode test | no multi-mode reliability |
| Sobol + Morris screening | users need "what to fix" | 1 wk | Sobol vs PCE coefficients; convergence | misleading sensitivity UI |
| Proxy/calibration hooks | passport → distribution, updating | 2–3 wk | synthetic recovery; posterior predictive checks | black-box proxy |
| Printability constraints | manufacturability is hard | 1 wk | rule tests on generated designs | unprintable optima |
| 3D STL / coupon export | physical use later | 1–2 wk | geometry validation | unusable artifact |

### 6.3 v1.0 (product): multiscale, calibrated, audit-ready

Add only what the verification infrastructure supports: (i) homogenisation **verified against the discrete model** on ≥15-cell designs; (ii) process/anisotropy factors as explicit, calibrated model-form parameters; (iii) surrogate-accelerated RBDO (GP + AK-MCS) for now-expensive models; (iv) Bayesian updating of feedstock distributions and model discrepancy when coupon data exist; (v) an auto-generated V&V evidence package and model card with every report; (vi) an append-only digital thread across lots/designs/decisions. Release gates are the V&V plan in dossier 05, not a marketing calendar [D].

### 6.4 Anti-features (do not build)

A general-purpose FEA kernel or CAD system (integrate one); a generative-AI geometry engine for an 8-parameter family (verification burden exceeds benefit); "AI reliability" numbers without a documented probability model; homogenisation before scale separation is verified; absolute certification-style claims (dossier 05 defines language); a digital twin requiring factory connectivity before the offline artifact is trusted.

---

## 7. Gaps and what could not be verified

1. **No experimental validation of any mechanics/UQ component is possible in this project**; fidelity statements are analytical verification plus literature calibration, not validation (dossier 05).
2. **The frame-vs-real-part error is not quantified.** Joint compliance and layer anisotropy are asserted as one-sided risks from manufacturing mechanics, not measured for this geometry; the [D] error budget is engineering judgement that a coupon campaign must replace.
3. **Literature distributions are not validated for a user's stream.** The feedstock model is a prior; its two-level split and correlations are assumptions until the user supplies lot data.
4. **AI/ML claims were reviewed at abstract/method-class level, not re-run.** No ML benchmark was executed; verdicts concern appropriateness, not measured accuracy.
5. **Tool licences/versions were not exhaustively audited** (e.g. UQLab commercial terms); confirm before shipping v1.0 dependencies.
6. **Effort estimates in §6.2 are internal order-of-magnitude planning figures [D]**, not quotes or commitments.

# AnyRB — can software substitute for physical testing when designing reliable products from variable recyclate?

> **Historical note:** this document describes an earlier AnyRB prototype (v0.6 and earlier). The active product is the one-page v0.7 app; see [`README.md`](README.md).

**Research synthesis and prototype report · v1.1 (AI product build) · 2026-10-29**

> *Question:* Recycled polymer → material properties → AI-designed internal geometry → a useful product.
> Batch-to-batch variation in recyclate is a documented problem, and research has shown that structural
> design can reduce its effect. **How can software help, given that no physical testing is possible?**
>
> *Short answer:* Software cannot replace *validation*, but it can replace most of the **design iteration**
> that physical testing is normally used for — if it (a) encodes recyclate variability as a distribution,
> (b) propagates it through a verified structural model, (c) optimises the internal geometry directly
> against a reliability target instead of a nominal safety factor, and (d) is honest about the residual
> uncertainty using a formal V&V claim ladder. We built and tested such a tool: **AnyRB**.

---

## 0. Executive answer

1. **The variability is real, large, and partly predictable.** Recycled HDPE modulus spans ~380–1,250 MPa across US material-recovery facilities (Cecon et al. 2023), rHDPE strength 22.2–48.4 MPa and elongation 11.2–17.0 % (Eriksen et al. 2019), and one industrial PCR-PP stream showed large composition, elongation and fatigue-life drift over 15 months even though every lot met the same MFR/density specification. This is not measurement noise; it is composition, degradation history and process history. See [`research/01-recyclate-variability.md`](research/01-recyclate-variability.md).

2. **Geometry changes the *consequence* of that variability — but only some mechanisms are available to a single-material part.** The 2025 PNAS nacre-inspired composite reduced measured rHDPE modulus scatter from 18 % to 4 % on its fabricated {8,5} rHDPE-platelet / PDMS-matrix specimens (78 % reduction); its headline "up to 93 %" is relative to a *modelled* 26 % introduced-variability film case, and the 554 MPa film-case mean is model-only. The measured composite strength is 0.22 MPa (adhesive-limited), i.e. it is a film/elastomer composite, not a structural bracket (Georgiou, Sun, Liu & Athanasiou, *PNAS* 122(33):e2502613122). The general mechanism — architecture changes which material property governs failure, how load paths share demand, and how much scatter is averaged — is designable, but the v0.1 tool deliberately implements only the single-material levers. See [`research/02-design-for-variability.md`](research/02-design-for-variability.md).

3. **The missing engineering workflow is a variability-aware design loop, not another CAD tool.** Current lattice/topology tools treat the material as deterministic; material databases report single values; process control stabilises the *melt*, not the *part's* reliability. Nobody couples lot distributions → structural reliability → internal geometry optimisation → per-lot print recipe → a qualification report. That is the software gap. See [`research/04-software-landscape-and-gap.md`](research/04-software-landscape-and-gap.md).

4. **What we built proves the loop is computable end-to-end.** AnyRB models a recycled-polymer bracket, computes closed-form batch failure probability, optimises a graded lattice for a 1 % reliability target, exports an STL and a printable per-lot compensation recipe, and produces a self-contained **virtual qualification report**. On the reference scenario the optimised design is **58 % lighter than a solid plate** and **14 % lighter than a uniform lattice at the same ~1 % risk**, while a conventional deterministic safety-factor-1.5 design is 10 % heavier than necessary; a mean-material design would fail about half of all lots. The same software tells the user which lots are acceptable and how much to compensate the geometry for the ones that are not.

5. **The honest boundary.** In-silico results are *decision support under stated assumptions*, not certification. Our validation is internal (code verification, analytical benchmarks, cross-language consistency, literature calibration); external validation (physical specimens) is still required before production and is specified as a concrete, cheap experimental programme in [`research/05-validation-without-physical-testing.md`](research/05-validation-without-physical-testing.md). The software is designed to make that future validation cheap: it defines exactly which tests close which uncertainty.

---

## 1. The scientific problem, stated precisely

A recycled-polymer product fails when the *delivered* material is weaker or less stiff than the geometry requires. Batch variation therefore enters reliability through a simple inequality:

```
failure  ⇔  σ_y(lot) < σ_req(geometry, load)   OR   E(lot) < E_req(geometry, load, limits)
```

This decomposition is useful for two reasons:

- **σ_req and E_req are geometry outputs, not material properties.** The design problem is to choose internal geometry that (i) lowers both demands, (ii) makes the part insensitive to which demand binds, and (iii) does so at minimum mass.
- **For a single-material structure, member forces do not depend on E.** One unit-load finite-element solve therefore yields σ_req and E_req exactly, and the whole batch distribution can be evaluated in closed form — which is why an interactive optimiser is possible at all.

Real recyclate variability is two-level: *lot means move* (different feedstock mix, degradation, season) and *within-lot scatter* exists around each mean. AnyRB models both; reliability is evaluated at lot level by default because that is the unit a manufacturer buys and prints. The split is explicit and editable, and the batch-passport feature switches to within-lot scatter once a lot has been measured.

**Evidence snapshot** (full tables, sources and evidence grades in [`research/01-recyclate-variability.md`](research/01-recyclate-variability.md)):

- **Modulus spread is enormous across sources.** rHDPE modulus spans 380–1,250 MPa across three US MRFs; one literature compilation reports 1,213 ± 654 MPa (n = 40, CV ≈ 54 %), while one supplier's ten stretch-film plates measured 1,350 ± 239 MPa (CV 17.7 %, n = 50). Between-source heterogeneity dominates intrinsic polymer scatter.
- **"In spec" does not mean "consistent".** Ten PCR-PP lots sampled over 15 months all met the same MFR (7–13 g/10 min) and density specification, yet filler content ranged 2–24 wt %, elongation at break ranged 10–100 %, and fatigue life at equal stress ranged 3,000 to 6.52 million cycles. Datasheet acceptance is not a reliability argument — the strongest single justification for the product.
- **Contamination and degradation define the weak tail.** Polyolefin streams can contain up to nine polymers and 1–3,000 ppm elemental impurities; adding "other PE types" cut impact resistance by 11 % at the first compositional step, and cross-contamination plus thermo-oxidative history severely reduces HDPE ductility.
- **Not all recyclates are equal.** One-cycle printed rPETG was the least variable feedstock in our library (E = 2.28 GPa, CV 10.8 %; recycled 2.17 GPa, CV 8.3 %), while rPP is the most dangerous preset (modulus can halve between MRFs, elongation varies by an order of magnitude).
- **Cheap proxies exist but have ceilings.** Melt viscosity sampled during kneading classified 23 household rPP lots into property bins with >85 % accuracy, and in-mould rheology control held property/weight CV < 5 % on five rPP blends — but MFR alone demonstrably failed to track rPP mechanical properties in another programme. Proxy-based lot screening must carry 15–25 % residual uncertainty until calibrated per supplier.
- **The defensible claim is narrow.** The literature does *not* show recyclates are inherently weak — closed-loop rPET, rPETG and rLDPE can match virgin means. The problem is the distribution: the mean is often acceptable, the spread is not. That is exactly the input our software consumes.

## 2. What "structural design reduces the effect" actually means

Four distinct mechanisms appear in the literature and in our own simulations; conflating them is the most common source of overclaiming:

| Mechanism | What it changes | What it cannot change | Where it lives in AnyRB |
|---|---|---|---|
| **Failure-mode selection** | which lot property binds (yield vs buckling vs deflection) | the scatter of that property | the demand pair (σ_req, E_req) and the "governing mode" readout |
| **Stress redistribution / grading** | the demand imposed on the part | lot-level scatter | 8-parameter width field, mass-minimising optimiser |
| **Statistical averaging / mixing** | within-part scatter (CV ∝ 1/√N_eff in parallel architectures; multi-lot mixing) | a uniform lot-mean shift | two-level UQ model; roadmap: spatial material fields |
| **Composite architecture (nacre-like, multi-material)** | sensitivity ∂ln(output)/∂ln(input) and the failure locus | the need for a second material/interface | roadmap: homogenised architecture models; concept validated by PNAS 2025 |

Two consequences are worth stating bluntly, because they protect the credibility of any software in this space:

- If every strut receives the *same* weak material, no geometry can restore the lost strength — only more material, a different architecture, or a different lot helps. Our tool therefore reports the **required sy and E** and the **acceptance window**, not just "reliability".
- Linear-elastic stiffness is proportional to E. Architecture cannot reduce *modulus variability* in a single-material part; the PNAS suppression comes from a composite architecture that changes the sensitivity and adds averaging. AnyRB's roadmap adds those architectures rather than pretending a lattice does it. The current lattice contributes through failure-mode selection, grading and (for defects) redundancy.

Two exact statements anchor the whole discussion, and the software must never violate them:

- In a linear-elastic structure, the log-sensitivity of any stiffness to a constituent modulus equals the fraction of strain energy stored in that constituent, `∂lnK/∂lnE_p = U_p/U`. For a **single material that fraction is 1, so no geometry can reduce the CV of its linear-elastic stiffness** — only change the mean demand. Variability suppression requires a second phase (dilution), spatial decorrelation with load sharing (averaging), or a nonlinearity.
- Under load sharing, the effective scatter of a spatial property field is `CV_eff/CV = √(ρ + (1−ρ)/N_eff)`. Under our two-level model, averaging can at best remove the *within-lot* share (36 % of variance ⇒ ≤20 % CV reduction) and **can never remove the lot-level shift**. That is why AnyRB reports the lot acceptance boundary rather than pretending the geometry fixes a weak lot.

In v0.1, therefore, the lattice delivers **margin, failure-mode selection and sensitivity ranking** — not variance reduction. The levers deliberately switched off (compliance dilution, spatial averaging, multi-lot mixing) are named in the app and report so no number can be misread. The lever taxonomy, evidence grades, quantitative effect sizes and counter-evidence are in [`research/02-design-for-variability.md`](research/02-design-for-variability.md).

## 3. Why "no physical testing" is a workflow constraint, not a fatal flaw

Physical testing serves three different jobs; software can replace only the first two, and the third must be planned:

| Job of testing | Can software do it? | How |
|---|---|---|
| **Design iteration** — find a geometry that meets the requirement | **Yes, largely** | verified mechanics + UQ + optimisation replace trial-and-error builds; every candidate is evaluated virtually |
| **Screening** — decide whether an incoming lot is usable | **Yes, with proxies** | supplier lot data or cheap melt-viscosity/MFI/IV proxies → property distribution → acceptance window; the software computes the pass/fail boundary |
| **Validation / certification** — prove the model matches reality | **No** | needs a physical programme; the software defines the minimum one and how to update the model with it |

The scientific support for job 1 is mature: finite-element analysis, reliability methods (Monte-Carlo, polynomial chaos, FORM/SORM), robust/reliability-based topology optimisation, and machine-learning surrogates are all established; the methods menu and its pitfalls are in [`research/03-computational-methods.md`](research/03-computational-methods.md). The credibility frameworks for job 3 — verification vs validation vs uncertainty quantification, ASME V&V 10/20/40, FDA in-silico evidence, NASA-STD-7009 — are in [`research/05-validation-without-physical-testing.md`](research/05-validation-without-physical-testing.md). Job 2 is supported by recent work on predicting recyclate mechanical properties from melt viscosity at essentially zero cost per lot; our prototype implements the interface for such a proxy model and flags that the literature calibration must be replaced with the user's own lot records.

**The right claim is therefore:** *"we can design and pre-qualify a product for a stated batch distribution without building it, and we can tell you exactly what to measure to close the remaining gap."* That claim is defensible. *"We can certify this part without any testing"* is not, and the tool never makes it.

## 4. The AnyRB system

### 4.1 Architecture

```
feedstock distributions  ──►  material demands  ──►  reliability  ──►  robust geometry  ──►  qualification
(lot + within, correlated)     (one FE solve)        (closed form)      (mass-minimising)      report + STL + recipe
        ▲                                                                       │
        └──────────────────── batch passport: measure/have a lot ──────────────┘
                              → compensation scale, pass/conditional/reject
```

Modules (all open, in this repository):

- `engine/anyrb/materials.py` — presets, two-level lognormal model, correlations, per-lot measurement override.
- `engine/anyrb/lattice.py` — reference product, 32-node/94-element lattice, bilinear width field, mass.
- `engine/anyrb/mechanics.py` — 2-D plane-frame FE, unit-load solve, σ_req/E_req (yield, Euler buckling, deflection), utilisation.
- `engine/anyrb/reliability.py` — closed-form bivariate-normal P_f, Monte-Carlo, sensitivity, acceptance window, lot pass probability.
- `engine/anyrb/optimize.py` — pattern-search mass minimisation under a reliability target, nominal-SF and mean-only baselines, Pareto sweep, batch recipe.
- `engine/anyrb/report.py` — self-contained HTML qualification report with charts and explicit claim limits.
- `engine/anyrb/stl.py` — STL export of the graded lattice.
- `app/` — independent JavaScript implementation of the same contract with a live browser UI.
- `engine/make_fixtures.py` — cross-language reference fixtures (`app/tests/fixtures/reference.json`).

**Why this method stack.** The choice is documented in [`research/03-computational-methods.md`](research/03-computational-methods.md): because the part is single-material and linear-elastic, internal forces are E-independent, so one unit-load solve yields the exact demand pair for any number of batches. That makes the reliability evaluation analytic and the optimiser-cheap — no surrogate model, polynomial chaos or Gaussian process is justified at v0.1 (they would add error and complexity without buying speed). Monte-Carlo is retained only as an independent reference check. The v0.2 stack adds shell/3-D FE for out-of-plane behaviour and joints, correlated/CSV-fitted lot models, FORM/SORM and importance sampling, Sobol/Morris sensitivity, proxy-calibration hooks and printability constraints; v1.0 adds verified homogenisation, anisotropy/process coupling, GP + active-learning reliability-based design optimisation, Bayesian updating and a digital thread with an auto-generated V&V package. The progression is deliberately evidence-gated: each fidelity increase is justified only when the claim ladder requires it.

### 4.2 The reference product and the closed-form reliability step

The demonstration product is a 150 × 60 × 10 mm cantilever bracket arm (10 mm solid wall pad + 7 × 3 X-braced lattice cells), loaded with 150 N at the tip, deflection limit 2.5 mm. Each of 94 Euler–Bernoulli frame elements has an in-plane width taken from a 4 × 2 log-width control field, bilinearly interpolated and clipped to printable limits. One unit-load solve gives per-element axial force and end moments; the required material properties follow as

```
σ_req = F · max_e ( |N_e|/A_e + max(|M_e1|,|M_e2|)/W_e )
E_req = max( F·u_tip/E_ref /u_lim ,  max_e F·|N_e|·L_e²/(π²I_e) )
```

and the batch failure probability is the bivariate-normal orthant complement

```
P_f = Φ(a) + Φ(b) − Φ₂(a, b; ρ),  a = (ln σ_req − μ_σ)/s_σ,  b = (ln E_req − μ_E)/s_E
```

with lognormal marginals built from the preset mean/CV at the chosen hierarchy level. This is exact for the stated assumptions, cheap enough for interactive use, and independently checkable against Monte-Carlo (we do both, and they agree to Monte-Carlo error).

### 4.3 What the optimiser is allowed to do

The eight control-point widths are optimised by a deterministic pattern search with a mass objective and a 100× penalty on exceeding the reliability target. No gradient information is required; each candidate costs one 96-DOF solve. The comparison suite evaluates six strategies on the same feedstock distribution: solid plate, target-sized uniform lattice, mass-matched uniform lattice, conventional deterministic design at safety factor 1.5, mean-material design at safety factor 1.0, and the robust design.

### 4.4 Batch passport

For the lot that actually arrives (supplier data or a measured proxy), the software solves for the smallest uniform width scale `s ∈ [1, 1.5]` that restores the target P_f, and returns mass penalty and a verdict (pass / compensate / conditional / reject). The same model produces an **acceptance window** — the locus of lot mean properties for which the unmodified design still meets the target — which is a purchasable specification, not just a report.

### 4.5 Where AI actually helps — and where it must not (v0.2)

The v0.1 build had no AI in the live path, which is indefensible for a Meta hackathon entry but also a real
product gap: the science was usable only by someone who understood reliability statistics. v0.2 adds Meta
models where they are genuinely useful and keeps them out of the mathematics:

| AI role | Model | What it does | What it must not do |
|---|---|---|---|
| **Brief intake** | Muse Spark 1.3 | turns plain language or a voice transcript into a structured, editable brief (part, load, deflection limit, reliability target, material, constraints) | invent a target the user did not state; the engine only runs on confirmed fields |
| **Lot passport extraction** | Muse Spark | reads supplier datasheet/certificate text and proposes E, σy, CVs, density with provenance and per-field confidence | replace measured lot data or hide uncertainty |
| **Design proposals** | Muse Spark | proposes three candidate strategies as parameter priors (eight strut-width starts), each with a rationale and a risk note | predict performance; the verified engine evaluates and ranks them |
| **Design memo** | Muse Spark | explains the selected design's trade-off, binding failure mode and next actions in plain engineering language | write a number that is not in the supplied engine output |
| **Qualification narrative** | Muse Spark | drafts the review memo from final metrics, batch decision and validation summary | claim certification or measured reliability |
| **Voice brief** | Muse Voice Transcribe | hands-free input; the transcript goes through the same validated parser | retain audio beyond the request |
| **Concept render** | Muse Image | illustrative product render for the design/qualification card | be presented as the CAD model — always labelled |
| **Part photo (optional)** | SAM 3.1 | segments an existing part photo as a visual reference for the brief | feed geometry or numbers into the solver |

Three guardrails make the AI defensible in an engineering context: (1) every response is JSON-schema
validated; (2) every number in AI-authored **review and proof memos** is checked against the structured
payload and ungrounded text is replaced by the deterministic fallback ("the model may phrase numbers, not
produce them"); brief/lot extraction is schema-constrained and range-clamped, while design proposals are
parameter priors that the verified engine evaluates and ranks; and (3) every call is cached and
provenance-logged (model, latency, tokens, cached/fallback) and surfaced in the UI. If
the API or network fails, a deterministic assistant with the same schemas takes over and the UI says so;
the tool never silently pretends a model is live. The browser never holds the API key — a local FastAPI
service owns the credentials.

This division of labour is the honest answer to "where is the AI?": **AI compresses the human interface to
the reliability workflow** (intent → structured brief → candidate proposals → explanation → report), while
the numerical claim remains deterministic, independently validated and reproducible. That is also why the
AI can be swapped without changing any scientific result.

## 5. Results from the prototype

**Reference scenario:** rPETG printed in-plane, E = 2,100 MPa (CV 10 %) and σy = 46 MPa (CV 10 %), both from the verified feedstock library (printed ISO 527-2 specimens); 85 % of the variance between lots; 150 N; 2.5 mm deflection limit; 1 % target failure probability.

| Strategy | Mass (g) | P_f | Note |
|---|---|---|---|
| Solid plate | 111.6 | ~0 | over-designed, 2.4× the printed mass |
| Uniform lattice, sized for ~1 % | 54.0 | 0.98 % | no grading |
| Uniform lattice, same printed mass as robust (46.25 g) | 46.25 | ~100 % | shaping matters, not just mass |
| Nominal design, deterministic SF 1.5 | 50.77 | ~0.001 % | ~9 % heavier than robust, far lower risk than required |
| Mean-material design, SF 1.0 | 41.11 | 51 % | "works for the average lot" = fails half the lots |
| **Robust design (AnyRB)** | **46.4** | **0.996 %** | target met; printed union estimate; analytic upper bound 50.8 g |

Batch-passport examples for the robust design (v0.3, 12 % measurement CV retained, 8-control lot-specific resize): a lot with 90 % of nominal E needs a global-equivalent scale ≈ 1.15 and +14.9 % printed mass ("conditional (heavy compensation)"); a lot with 80 % of nominal E needs ≈ 1.39 and +22.0 % ("conditional"); lots at 50 % E are outside the printable compensation range and are rejected. A lot with 70 % of nominal strength needs no compensation because strength is not the binding property for this geometry. The acceptance window and sensitivity ranking (mean E, load and the deflection limit dominate; CV(σy) and the correlation are negligible for this geometry) are generated per design in [`reports/qualification_report.html`](reports/qualification_report.html).

The engineering interpretation:

- **Reliability-targeted geometry is not the same as conservative geometry.** The conventional SF-1.5 design is safe but pays ~10 % extra mass for risk far below target; the mean-only design is light but unusable. Choosing the risk level explicitly and minimising mass for it is the value proposition.
- **The tool diagnoses which property binds instead of assuming it.** At the robust optimum, stiffness/buckling accounts for essentially all of the failure probability: the strength demand is only ~40 % of the mean printed strength, so yield variability is irrelevant for this geometry. Change the geometry or the recyclate and the binding property shifts — which is exactly why a tool must report the demand pair and the marginal failure contributions, not a single safety factor. (This is also a useful negative result: a design that looks "strength-critical" by intuition can be entirely stiffness-governed.)
- **The 46.4 g uniform lattice fails essentially all lots.** Same mass, different internal geometry. This demonstrates the value of shaping, but reliability is very sensitive near the buckling-controlled sizing cliff in this idealised model, so the magnitude is illustrative rather than a general-purpose prediction (stated in the report).
- **Grading is not magic.** In an iso-mass comparison, demand-proportional grading lowers peak utilisation by roughly 1.3–1.6× under a 1 mm printability floor; the 14 % printed-mass saving over the target-sized uniform lattice is consistent with that, not with variance reduction. The multi-start optimiser finds a local optimum (it is a heuristic, not a proof of global optimality); the final design passes the v0.3 enforced printability limits (min width 1.24 mm, max slenderness 21.9, max neighbour-width ratio 1.38).

## 6. Scientific credibility: what we verified, and what we did not

**Verified in this build (all reproducible with `make test`):**

1. **Code verification** — a single frame element reproduces the Euler–Bernoulli cantilever tip deflection exactly (relative error < 1e-15); force equilibrium (sum of reactions = applied load) to 1e-9; symmetry of the symmetric structure; linear scaling of demands with load.
2. **Solution verification** — the closed-form bivariate-normal failure probability matches SciPy's independent implementation to 2e-15 and an independent Monte-Carlo estimate to its sampling error; the two-level sampler reproduces its target means, CVs and correlation.
3. **Cross-implementation verification** — the Python engine and the independent JavaScript engine agree on mass, σ_req, E_req and u_tip for five reference designs (relative error < 1e-6) and on the closed-form P_f (< 1e-8).
4. **Mass/geometry sanity** — mass computed from strut volumes + pad; width field clipping; STL triangle counts; optimiser feasibility (P_f ≤ target), monotonicity of the batch recipe in lot quality.
5. **Regression fixtures** — `app/tests/fixtures/reference.json` freezes the physics contract so either implementation cannot drift silently.

**Minimum future validation programme** (if lab access ever appears; costs are internal estimates, from [`research/05`](research/05-validation-without-physical-testing.md) §4.6 — pre-register predictions before each test and use Bayesian updating, never absorb model error into the material modulus):

| Test | What it closes | Scope | Estimate |
|---|---|---|---|
| **T1** tensile + MFR per lot | replaces literature distributions; estimates lot/within split | 5 lots × 10 specimens | €2–6k, 4–8 weeks |
| **T2** X-braced lattice coupons | joint stiffness, anisotropy, print-direction factors | 5 geometries × 3 orientations × 3 lots, blind stiffness ≤20 % / strength ≤30 % | €2–5k, 6–10 weeks |
| **T3** full bracket | end-to-end model discrepancy (L5) | 5 designs × 3 lots, blind stiffness ≤15 %, failure load ≤25 %, ranking ρ ≥ 0.8 | €3–10k + rig, 8–12 weeks |

All three are small precisely because the software already knows which uncertainties matter: the campaign targets the inputs that move P_f most (mean E, load and the deflection limit — for this stiffness-governed geometry, strength CV contributes almost nothing), not a blanket test matrix.

**Independent validation suite (v0.3)** — a separate 53-check suite was written by a validator who did not
write the engine, using independent methods wherever possible (re-implemented frame element, energy
minimisation vs direct stiffness, SciPy/quad/Monte-Carlo reliability cross-checks, periodic unit-cell
homogenisation, brute-force optimiser comparison, STL geometry audit). Result: **56 PASS / 2 WARN / 0 FAIL**
(12.6 s). The suite found and the team fixed three genuine defects before this report was frozen:
(1) the fixed-grid bivariate-normal quadrature lost accuracy at extreme correlations (|ρ|>0.9), now
1e-15-accurate via a SciPy adaptive path; (2) the degenerate-marginal combination returned the wrong value
when a deterministic strength marginal failed; (3) the STL wall pad was exported as a sheared
parallelogram instead of an axis-aligned 10×60×10 mm prism. The single remaining WARN is a **quantified,
conservative** approximation: analytic strut-volume mass double-counts overlap at joints — for the robust
design the printed union estimate is 46.40 g while the analytic upper bound is 50.81 g (the old 25 % / ≈40.5 g figure came from a validator sampler bug and is retired). All
numbers in this report use the conservative analytic mass; the union estimate is disclosed in the app and
validation report.

Model-form error is now quantified, not just acknowledged. A cell-size sweep (4x2, 7x3, 10x4, 14x6 lattices on the same envelope and width field) changes tip deflection by +88 %, strength demand by +34 % and stiffness demand by +495 % at the same strut widths (mass-matched: +58 % / +98 % / +23 %); 7x3 is the product contract and the band is reported per result. A pin-jointed truss idealisation of the same 7x3 lattice gives tip stiffness x1.004, sigma_req x1.141 and E_req x0.997 relative to the rigid frame, so the frame is conservative on strength and neutral on global stiffness. These bands are the honest size of the 2-D frame assumption and are not a substitute for specimen validation. The printed-union mass estimate is also audited (F5): ≤0.1 % deviation from independent Monte Carlo on the shipped designs, 0.35 % worst case at the minimum strut width — a second documented WARN, alongside the analytic-mass upper-bound WARN (F4).

**Not verified (and why):** no physical specimens were tested. The following are unmodelled or only crudely modelled, and the app/report list them on-screen: plasticity and strain localisation; creep and fatigue; layer-adhesion anisotropy (the 2-D in-plane model uses the measured printed in-plane strength); out-of-plane buckling; joint behaviour; spatial material scatter and print-defect statistics; process-induced residual stress; viscoelastic rate effects; and the literature-derived material distributions themselves. A validation programme (tensile tests per lot, lattice coupons, full bracket; n and acceptance criteria; Bayesian updating) is specified in [`research/05-validation-without-physical-testing.md`](research/05-validation-without-physical-testing.md).

**Claim-strength ladder** (defined in [`research/05`](research/05-validation-without-physical-testing.md); every user-facing number should carry its level):

| Level | Meaning | Evidence needed | AnyRB v0.1 |
|---|---|---|---|
| **L0** | equations & code verified | analytical benchmarks, equilibrium, cross-implementation agreement | **achieved** |
| **L1** | solution verified | convergence, MC standard errors, seeds, tolerances | **achieved** (MC standard errors, deterministic seeds and tolerance checks; mesh refinement is not a free parameter because the 94-element lattice topology is fixed — stated in §6) |
| **L2** | literature-calibrated + UQ | sourced distributions with grades, sensitivity, model-form bounds | **partial** |
| **L3** | literature reproduced | independent reproduction of published results/trends | planned (v0.2) |
| **L4** | component validated | own coupon tests, blind predictions, pre-registered criteria | **absent** (no lab) |
| **L5** | system validated | full-part tests across lots/designs | **absent** |
| **L6** | certified / accredited | third-party assessment against standards | **out of scope** |

The honest product position is therefore not "no testing needed ever", but **"no testing needed to make the design decision, and here is exactly what testing would change."** That is defensible in front of an engineer. "Physics, statistics and material data are virtual" must always be followed by the claim level. This is the honest version of "no physical testing": the model's *decision-support* claims are internally verified and explicitly bounded; its *validation* claim is future work with a concrete, cheap plan. The app and report also carry a "levers not active in v0.1" card naming the three variability-suppression mechanisms (two-phase dilution, spatial averaging, batch mixing) that would need models we do not have yet — a deliberate anti-overclaiming device.

## 7. Competitive gap

The landscape (detailed in [`research/04-software-landscape-and-gap.md`](research/04-software-landscape-and-gap.md)) splits into deterministic geometry tools (lattice/AM design, topology optimisation), deterministic material databases, and process-control/sorting hardware. Every *component* exists commercially — implicit lattices (nTop, Carbon, Altair/Gen3D, Hyperganic), generic UQ (optiSLang, HyperStudy, Isight, Dakota), multiscale material modelling, materials data (Granta), lot-genealogy MES — but nobody sells the closed loop from a recyclate lot distribution to an auditable qualification artifact. The closest competitor is Cadence Digimat: its 2025.1 release added variability→structural-reliability UQ and a 2025–26 case study applies it to recycled PA66-GF30. That is evidence the *problem* is real and the hard material-modelling half is being solved; but it is a fixed-part CAE workflow for injection-moulded short-fibre compounds, with no internal-geometry reliability loop, no per-batch print recipe and no batch-decision artifact, and its public evidence is vendor case-study material. The defensible asset is therefore not the solver (open-source stacks reproduce the maths) but the **lot-property dataset + reliability/acceptance logic + audit-grade report + workflow integration** with printers and material suppliers. v0.1 is deliberately far behind Digimat on material physics; the wedge is workflow, data, price and claim-limits discipline.

## 8. Product roadmap and business sketch

- **v0.1 (this prototype):** reference bracket, four feedstock presets, closed-form reliability, robust optimiser, batch passport, STL + qualification report, verified cross-language engines, V&V dossier.
- **v0.2:** user lot-data fitting (CSV/datasheet import), proxy models from MFI/IV/NIR with uncertainty, 3-D geometry and octet/gyroid cells with homogenisation, spatial material fields and print-defect statistics, multiple load cases and failure modes, batch mixing optimisation.
- **v1.0:** printer/slicer integration (print recipe directly as G-code modifiers or flow/thickness compensation), supplier-lot database and acceptance certificates, PLM/QMS export (APQP/PPAP-style evidence package), validated material models from partner labs, audit trail.

Beachhead users: recycled-filament printers and AM service bureaus, furniture/houseware brands with recycled-content commitments, packaging converters, compounders who need to sell reliability rather than just pellets, and OEMs facing recycled-content mandates. Pricing hypothesis: per-seat design subscription + per-lot screening/compensation usage + paid validation packages. Risks: incumbents adding UQ to geometry tools (Digimat already has the hard material-modelling half; nTop/Carbon/Altair could add a material-variability field), lot-data scarcity and provenance, liability if "qualification report" is read as certification (PPAP/UL/EN 15343 remain physical/audit-based), willingness-to-pay in the beachhead segment, recyclate price volatility and policy-delay risk, and the physics credibility of a linear-elastic 2-D v0.1. Mitigation: start with low-risk non-structural products, co-validation with partners, and make the claim ladder and limitations part of the product rather than fine print.

## 9. Limitations of this report

- Material presets are provisional v0.1 and partly derived from secondary citations; [`research/01`](research/01-recyclate-variability.md) verifies and grades them, and the machine-readable library is the authoritative source.
- The demonstration product and load case are illustrative, not a real customer part.
- The software is a prototype: single product topology, 2-D plane-frame physics, batch-uniform material, Euler buckling with pinned-pinned effective length, no joints.
- Citations: every quantitative claim in the dossiers carries a reference key resolving in `research/refs/*.json`; unverified items are marked as such. This synthesis cites only the verified anchor studies directly.

## 10. The answer, in one paragraph

Batch variability stops recycled polymers from being used where reliability matters. Physical testing cannot be the answer at design time — it is too slow, too late and too expensive per iteration. A software tool can replace the design iteration by treating the lot distribution as the design input: encode the variability, propagate it through verified mechanics, optimise the internal geometry for a chosen reliability instead of a nominal safety factor, and output a printable design plus a lot-acceptance and compensation recipe. That is what AnyRB does; our prototype shows it is computationally cheap, internally verifiable and honest about its limits. The one thing it cannot do is validate itself — so the deliverable includes a rigorous V&V claim ladder and the minimum experimental programme that would turn a good virtual design into a certified one. That programme is small and targeted precisely because the software already knows which uncertainties matter.

## 11. v0.3 response to the independent review

A detailed, point-by-point response is in [`REVIEW_RESPONSE.md`](REVIEW_RESPONSE.md). The material changes:

1. **Mass audit corrected and mass basis fixed.** Our earlier union sampler was buggy (half-length struts); corrected audit says the analytic mass over-counts the printed union by 5–28 % depending on width, and by ~9.5 % on the shipped design — not 25 %. v0.3 reports the printed union estimate (Halton 60k samples, <0.5 % vs 600k MC) as the headline, uses it for candidate selection, and labels the analytic strut-sum as a conservative upper bound.
2. **Printability is a constraint**, not a post-hoc badge: neighbour-width ratio ≤1.5 and slenderness ≤30 are enforced in the optimiser; shipped design passes (1.38 and 21.9).
3. **Known lots keep measurement uncertainty** (default 12 % on E and σy) and the compensation recipe is a lot-specific re-optimisation of all eight width controls, not one global scale.
4. **The Brief runs an engine feasibility gate** before any AI candidate is drawn; the AI is restricted to the "best of this bracket/lattice family" claim.
5. **A sustained-load creep/compression advisory bound** is shown (creep factor 2.0, compression factor 0.8). The static design fails that bound (deflection bound 4.0 mm > 2.5 mm), so the app says it is not qualified for sustained load.
6. **v0.4 remaining-gap fixes:** printed-process gate (IM/compression presets are contrast-only and blocked for printed design), a marginal elongation/brittle-lot screen with an add-on estimate (not a formal bound) (not folded into headline P_f; E-elongation correlation assumed), a final union-mass polish stage, and quantified correlation/lot-split assumption bounds. Plant proxy calibration, cost/reject economics and alternative part families remain roadmap.
7. **Remaining gaps are explicit:** full union mass inside the search loop, alternative cell/skin families, calibrated MFI proxy, separate tensile/compressive/elongation allowables, spatial material fields, cost/scrap economics, and a physical coupon test. A pre-registered coupon plan is in [`validation/COUPON_TEST_PLAN.md`](validation/COUPON_TEST_PLAN.md).

## 12. Key sources

Full annotated reference databases (35–70 entries each, with evidence grades, verification status, locators and machine-readable JSON) are in [`research/refs/`](research/refs/). The anchors a reviewer should check first:

- Georgiou, D., Sun, D., Liu, X. & Athanasiou, C. E. (2025). *Suppressing mechanical property variability in recycled plastics via bioinspired design.* PNAS 122(33):e2502613122. [doi:10.1073/pnas.2502613122](https://doi.org/10.1073/pnas.2502613122) — open full text: [PMC12377729](https://pmc.ncbi.nlm.nih.gov/articles/PMC12377729/).
- Eriksen, M. K., Christiansen, J. D., Daugaard, A. E. & Astrup, T. F. (2019). *Closing the loop for PET, PE and PP waste from households.* Waste Management 96, 75–85. [doi:10.1016/j.wasman.2019.07.005](https://doi.org/10.1016/j.wasman.2019.07.005).
- Cecon, V. S., Curtzwiler, G. W. & Vorst, K. L. (2023). *Evaluation of mixed #3–7 plastic waste from material recovery facilities.* Waste Management 171, 313–323 (as cited with ranges in the PNAS study).
- Hinczica et al. (2026). *Impact of seasonal composition on the long-term performance of post-consumer recycled polypropylene* (10 lots / 15 months). J. Appl. Polym. Sci. [doi:10.1002/app.70501](https://doi.org/10.1002/app.70501).
- *A nearly zero-cost lot-by-lot inspection of recycled plastics: prediction of mechanical properties from viscosity evolution during melt kneading* (2025). ACS Sustain. Resour. Manage. [doi:10.1021/acssusresmgt.5c00040](https://doi.org/10.1021/acssusresmgt.5c00040).
- Mechanical evaluation of recycled PETG filament for 3D printing (2024). [doi:10.3221/igf-esis.70.18](https://doi.org/10.3221/igf-esis.70.18).
- *In-mould rheology and automated process control for injection moulding of recycled polypropylene* (2024). Polym. Eng. Sci. [doi:10.1002/pen.26836](https://doi.org/10.1002/pen.26836).
- *The impact of impurities on the mechanical properties of recycled polyethylene* (2021). Packag. Technol. Sci. [doi:10.1002/pts.2551](https://doi.org/10.1002/pts.2551).
- *Mechanical recycling of HDPE-based packaging: interplay between cross contamination, aging and reprocessing* (2025). Polym. Degrad. Stab. [doi:10.1016/j.polymdegradstab.2025.111290](https://doi.org/10.1016/j.polymdegradstab.2025.111290).
- Digimat 2025.1 release note (closest competitor: variability → structural-reliability UQ) — [Hexagon](https://nexus.hexagon.com/community/public/digimat/b/digimat-news/posts/digimat-2025-1-is-now-available); RadiciGroup recycled-polymer UQ success story — [Cadence](https://www.cadence.com/zh_CN/home/resources/success-stories/achieving-robust-design-with-recycled-materials-using-uncertainty-quantification-ss.html).
- ASME V&V 10-2019 (R2025) — [ASME](https://www.asme.org/codes-standards/find-codes-standards/standard-for-verification-and-validation-in-computational-solid-mechanics/2019); ASME V&V 40-2018 — [ASME](https://www.asme.org/codes-standards/find-codes-standards/assessing-credibility-of-computational-modeling-through-verification-and-validation-application-to-medical-devices/2018); FDA 2023 CM&S credibility guidance — [FDA](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/assessing-credibility-computational-modeling-and-simulation-medical-device-submissions); NASA-STD-7009A — [NASA](https://standards.nasa.gov/sites/default/files/standards/NASA/w/CHANGE-1/1/nasa_std_7009a_change_1.pdf).
- EU Packaging and Packaging Waste Regulation (EU) 2025/40 — [EUR-Lex](https://eur-lex.europa.eu/eli/reg/2025/40/oj); EN 15343 traceability standard.

---

*Interactive demo: [`index.html`](index.html) · Qualification report: [`reports/qualification_report.html`](reports/qualification_report.html) · Dossiers: [`research/`](research/) · Reproduce: `make test && make report`.*

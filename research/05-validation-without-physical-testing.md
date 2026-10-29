# 05 — Making in-silico claims credible with zero physical-testing access

**Status:** v1.0, 2026-10-29 · **Owner:** researcher-methods · **Feeds:** `PRODUCT_SPEC.md` §7 (V&V / credibility, claim limits, validation roadmap), §10 (honesty rules), and the app's "Method & honesty" section.

**Purpose.** AnyRB's commercial sentence is "design reliable recycled-polymer parts without physical testing". That sentence is defensible only if every number carries its evidence level and the product never dresses verification up as validation. This dossier sets out the credibility frameworks we are judged against, defines a claim-strength ladder the software must display, maps the standards that simulation cannot satisfy, specifies the V&V plan we can execute today, and pre-registers the minimum physical campaign that would upgrade claims if lab access ever appears. It ends with the failure modes that destroy in-silico credibility and a checklist to run before any number leaves the building.

**Reading key for evidence grades** (adopted from dossiers 01/02): **A** = peer-reviewed quantitative with reported data; **B** = peer-reviewed review/theory/methodology; **C** = standard, agency guidance or official report; **D** = derivation or estimate produced in this dossier. **[SPEC]** = internal spec cross-reference. Every `[Rxx]` resolves in `refs-05.json`.

---

## 0. Executive answer in six findings

1. **Verification proves the code does what the equations say; validation proves the equations describe reality. AnyRB today can do the first comprehensively and the second only against other people's published data.** That is a real, saleable position — *design-stage decision support with quantified uncertainty* — but it is not certification, and the gap between the two is exactly what this dossier quantifies. Conflating them is the single fastest way to lose engineering credibility [R07, R08].
2. **Credibility is not a property of software; it is a relationship between a model, a use, and a decision.** ASME V&V 40 and the FDA's 2023 guidance both formalise this: credibility evidence must be commensurate with the model's role in the decision and the consequence of getting it wrong [R03, R04]. NASA-STD-7009A supplies the operational checklist via eight credibility factors and five M&S-influence levels [R05]. AnyRB should borrow the structure even though it is not a regulated device.
3. **The claim-strength ladder is the operating instrument.** L0 (equations/code verified) → L6 (certified). Each output must be tagged with its level; forbidden language is attached to each level. Shipping a number without its level is the failure mode — not the existence of low-level numbers.
4. **Recycled-content standards cannot be satisfied by simulation.** ISO 14021, EN 15343 and the EU PPWR govern claims, traceability and calculation of recycled content — documentary chain-of-custody obligations [R16–R19]. Test standards (ASTM D638/D790/D1238, ISO 527/1133) define *measurements* a simulation can consume but not replace [R20–R24]. UL 746 adds long-term, flammability and recycled-material qualification for electrical applications [R26]. AnyRB must never imply conformity with any of them. The distinction is legal as well as technical: recycled-content compliance is evidenced by transaction records and third-party verification, not by an analysis output, and a simulation-generated claim would be an unsubstantiated environmental claim under ISO 14021 [R16].
5. **Pre-registered, blind physical tests are what convert future data into credibility.** A V&V plan with frozen model versions, published acceptance criteria, independent-seed predictions and Bayesian updating turns a small coupon campaign into evidence; post-hoc tuning turns the same money into anecdote [R07, R15].
6. **What cannot be claimed, today and after the minimum campaign:** lot-specific material properties without measurement; production failure rates; certification, UL recognition or PPWR/ISO compliance; fatigue, creep, UV, fire or flammability performance; joint and interface strength; and the word "validated" for the bracket. Dossier 03 lists the mechanics that are absent, and §4.4 here records the model-form omissions — absent, not merely approximate.

---

## 1. The credibility frameworks we are judged against

### 1.1 The three activities, kept separate

- **Code verification:** are the equations solved correctly? Evidence: analytical benchmarks, patch tests, manufactured solutions, convergence/order tests [R07, R12, R34].
- **Solution verification:** how much numerical error remains in *this* calculation? Evidence: discretisation-refinement studies, grid-convergence index (GCI), MC convergence, deterministic reproducibility [R11].
- **Validation:** does the model agree with reality for the intended use? Evidence: comparison against independent experimental data with a specified metric, in the model's context of use [R07, R08, R10].
- **Uncertainty quantification** runs through all three: input uncertainty is propagated, numerical uncertainty is bounded, model-form uncertainty is documented rather than hidden [R13, R14].

A benchmark is not validation: comparing code against a higher-fidelity simulation tests implementation and consistency, not physics [R09]. This distinction appears in every framework below; the fact that it is so often collapsed in marketing is why it is written as finding 1.

### 1.2 Framework comparison

**Table 1 — Credibility frameworks, what each contributes, and how AnyRB uses it.**

| Framework | Scope and status | Core instrument | What it demands | AnyRB use |
|---|---|---|---|---|
| **ASME V&V 10-2019 (R2025)** [R01] | Computational solid mechanics; consensus standard | Common language and process for V&V of CSM models; verification and validation guidance | documented V&V activities, clearly separated | primary vocabulary for our CSM work |
| **ASME V&V 20-2009 (R2021)** [R02] | CFD and heat transfer; consensus standard | validation comparison error and model-form uncertainty; validation metric | quantify the degree of accuracy inferred from solution-vs-data comparison at a specified validation point | template for reporting our comparison error and model-form uncertainty |
| **ASME V&V 40-2018** [R03] | Credibility assessment for medical devices; risk-informed | credibility commensurate with model reliance and decision consequence; subcommittee states it is general enough for other disciplines | risk-informed, context-of-use-driven evidence | our credibility-assessment template and claim-scoping logic |
| **FDA 2023 final guidance** [R04] | Regulatory submissions; physics-based/mechanistic CM&S | risk-informed framework for credibility assessment; docket FDA-2021-D-0980 | credibility evidence proportional to model risk and role in decision | reference model for "what would a reviewer accept" |
| **NASA-STD-7009A w/Change 1** [R05] | NASA models & simulations | M&S influence levels 1–5 (Table 2); eight credibility factors (Table 3): data pedigree, verification, validation, input pedigree, uncertainty characterization, results robustness, M&S history, process/product management | credibility assessed by influence and by factor, not asserted | operational checklist (Table 2 here) |
| **AIAA G-077-1998** [R06] | CFD guide; early consensus document | verification and validation definitions/process | documented V&V | historical baseline; superseded in rigour by R01–R03 |
| **AIAA S-141-2024** [R34] | Code verification standard (CFD) | modern expectations for code-verification evidence | verification evidence for computational codes | inspiration for our code-verification package |

The frameworks converge on one message: **the evidence burden is set by the decision, not by the software's ambition.** AnyRB's decision ("which geometry and which batch recipe should we commit to?") is lower-consequence than a medical implant but higher than a concept sketch, and the software must say which one it is answering.

### 1.3 NASA's credibility factors mapped to AnyRB

NASA-STD-7009A's eight factors are the most actionable checklist we have [R05]. Applied to AnyRB:

**Table 2 — NASA credibility factors applied to AnyRB v0.1.**

| Credibility factor [R05] | AnyRB interpretation | v0.1 status | What would raise it |
|---|---|---|---|
| Data pedigree | feedstock distributions from literature/passports, with grade and provenance | partial: cited sources, grade-labelled, not lot-verified | user lot data; measured coupon campaign |
| Verification | FE implementation, analytic reliability, cross-implementation match | **strong**: closed-form + MC + Python↔JS tests | publish full verification report; formal code-verification standard [R34] |
| Validation | agreement with experiment for the context of use | **absent** (no lab); literature reproduction only | T1–T3 campaign (§4.6) |
| Input pedigree | load, geometry, printer tolerances, material data | partial: loads/limits specified; printer tolerance not calibrated | user metadata capture; tolerance measurements |
| Uncertainty characterization | aleatory + epistemic + numerical | partial: aleatory exact/MC; model-form listed, not quantified | model-form bounds; posterior distributions |
| Results robustness | sensitivity to inputs, seeds, model-form choices | partial: local sensitivities; MC seed tests | Sobol, alternate-model bracketing |
| M&S history | has this model class been used successfully before? | literature analogues exist (lattice mechanics, recycled variability) [R32] | documented reproduction tests |
| M&S process/product management | versioning, review, configuration control | partial: single-version engine; reproducibility via seeds | model card, hashes, review record |

---

## 2. The claim-strength ladder

Every user-facing number gets a level. The ladder is our own construct (grade D, informed by [R01–R08]); it exists so that "what can we honestly say?" has a mechanical answer.

**Table 3 — AnyRB claim-strength ladder.**

| Level | Name | Evidence required | Allowed language | Forbidden language | AnyRB v0.1 |
|---|---|---|---|---|---|
| **L0** | Equations & code verified | analytical benchmarks, patch tests, manufactured solutions, equilibrium/rigid-body checks, cross-implementation agreement [R07, R12, R31, R34] | "the solver reproduces closed-form beam theory to X %"; "code verified" | "the model is correct"; "validated" | **achieved** |
| **L1** | Solution verified | refinement/convergence studies, MC standard errors, deterministic seeds, tolerance report [R11, R14] | "numerical error is bounded at X"; "reproducible" | "accurate" without a bound | **achieved** (to be documented) |
| **L2** | Literature-calibrated + UQ | sourced input distributions with grades; sensitivity; model-form bounds | "literature-calibrated"; "uncertainty-quantified"; "decision-support" | "material properties of your lot"; "production reliability" | **partial** |
| **L3** | Literature reproduced | independent reproduction of published results/trends with a defined agreement metric [R10, R32, R33, R35–R37] | "reproduces published trends/results within X"; "model class externally corroborated" | "validated against experiments" (they are not our experiments) | **planned** (v0.2) |
| **L4** | Component validated | own coupon tests, blind predictions, pre-registered acceptance criteria [R07, R15] | "validated at coupon level for [material/process/geometry]" | "validated part"; "certified" | **absent** |
| **L5** | System validated | full-part tests across lots/designs, blind protocol, posterior predictive checks [R10, R15] | "validated for this context of use" | "certified"; "safe for all lots" | **absent** |
| **L6** | Certified / accredited | third-party assessment against applicable standards/regulations [R16–R30] | "certified/conformant to [standard]" | — | **out of scope** |

### 2.1 What code and solution verification genuinely support (L0–L1)

Verification is where AnyRB is strongest and should be loudest. We can demonstrate: the frame element reproduces Euler–Bernoulli cantilever deflection and rotation; single-element axial/bending patch tests recover exact forces; rigid-body modes produce zero stress; symmetry and equilibrium hold; mass/volume agrees with an independent calculation; the Python and JS engines agree to 1e-9 on deterministic fields and 1e-6 on reliability [SPEC §2.1]; Monte Carlo converges to the analytic bivariate answer within binomial confidence intervals. These are checkable by an auditor in an afternoon. But they say nothing about whether a printed bracket behaves like the frame: **verification bounds the numerical error, not the model-form error.** Saying so explicitly is what distinguishes a credible V&V package from a smoke screen [R07].

### 2.2 What literature calibration supports — and what it does not (L2–L3)

Literature-derived distributions, calibrated against published recyclate variability, can support: plausible ranges, relative design rankings, sensitivity statements, and uncertainty-aware decisions. They cannot support statements about a specific supplier's next lot: distribution shift between published streams and a user's stream is the rule, not the exception [R33, D]. Comparison against published mechanics (lattice scaling [R35], lattice coupon data [R36], AM process effects [R37], recycled-composite variability suppression [R32], proxy-to-property mapping [R33]) is a *model-class* test: if our engine cannot reproduce an independently published trend, that is a red flag; if it can, we have earned L3, not L4. The caveat is correlated error: if our idealisation and the paper's idealisation share the same assumption (e.g. rigid joints), agreement is weaker evidence than it looks [R10, D].

### 2.3 What only experiments can support (L4–L6)

Lot-specific `(E, σy, ρ)` and their scatter; joint behaviour; interlayer strength and anisotropy; the actual failure mode (including ones the model omits); out-of-plane and buckling reality; long-term creep/fatigue/UV; flammability; and any statement that the part is safe. Every unmodelled mode is a potential one-sided error: joints may fail before members, layers may delaminate, out-of-plane buckling may precede the in-plane mode, and creep may govern at service load. No amount of code verification substitutes for this. The honest product position is therefore not "no testing needed ever", but **"no testing needed to make the design decision, and here is exactly what testing would change."** That sentence is defensible in front of an engineer; "physics, statistics and material data are virtual" must always be followed by its claim level.

---

## 3. Standards landscape: what simulation can and cannot satisfy

**Table 4 — Relevant standards, their demand, and simulation's role.**

| Standard / framework | What it demands | Can simulation satisfy it? | AnyRB consequence |
|---|---|---|---|
| **ISO 14021:2016** [R16] | substantiation of self-declared environmental claims, incl. recycled content | **No** — claim substantiation is documentary/evidential | never generate recycled-content claims; only consume stated content data |
| **EN 15343:2007** [R17] | traceability of recycled plastics; basis for recycled-content calculation | **No** — chain-of-custody records | treat recycled-content % as an input with provenance, not a model output |
| **EU PPWR (Reg. 2025/40)** [R18] | recycled-content requirements and verification for packaging | **No** — legal compliance via traceability/verification | out of scope for structural claims; flag if user's product is packaging |
| **ISO 15270:2008** [R19] | guidelines/terminology for plastics recovery and recycling | not a performance standard | use vocabulary; no conformity implication |
| **ASTM D638-22 / ISO 527-1:2019** [R20, R23] | tensile properties measurement (specimens, conditioning, rates) | **No** — defines a measurement | required future calibration data; never cite as "model complies" |
| **ASTM D790-17** [R21] | flexural properties measurement | **No** | future coupon validation reference |
| **ASTM D1238-23 / ISO 1133-1:2022** [R22, R24] | MFR/MVR measurement | **No** — lot measurement | lot proxy inputs; state that proxy-to-property mapping is unvalidated for the user's stream |
| **ISO 12100:2010** [R25] | machinery risk assessment and risk reduction | **partially** — simulation informs risk assessment; cannot replace the process | AnyRB outputs are inputs to the user's risk assessment |
| **UL 746 series (incl. UL 746S)** [R26] | material qualification in electrical equipment: short-term, long-term ageing, flammability; UL 746S specifically for sustainable/recycled polymeric materials | **No** — recognition requires testing by/for UL | if the part is electrical, simulation cannot substitute; say so early |
| **ISO/ASTM 52900:2021 / 52921:2013** [R27, R29] | AM terminology, coordinate systems, build orientation | **No** — convention | any test plan and model metadata must record build orientation consistently |
| **ISO/ASTM 52903-1:2020** [R28] | material-extrusion feedstock requirements | **No** — feedstock qualification | link lot passport to feedstock requirements where relevant |
| **ASTM F2971-13(2021)** [R30] | reporting data for AM test specimens | **No** — reporting practice | adopt its reporting fields in the future coupon campaign |
| **ASME V&V 10/20/40; FDA 2023; NASA-STD-7009A; AIAA G-077/S-141** [R01–R06, R34] | V&V frameworks, not pass/fail product standards | **partially** — they govern the *credibility evidence*, not the product | our V&V package is built to these frameworks; no conformity claim follows |

The pattern is clear: **recycled-content and test standards are about evidence produced physically or documentarily; simulation is at best an input.** The one family that simulation can satisfy is the V&V framework family — and that is precisely what AnyRB should claim: a documented, framework-aligned credibility package, not a compliance certificate.

---

## 4. AnyRB V&V plan

### 4.1 Code verification (L0)

**Table 5 — Code-verification activities and acceptance criteria.**

| ID | Test | Method | Acceptance criterion | Status |
|---|---|---|---|---|
| CV1 | Cantilever tip deflection/rotation | FE vs Euler–Bernoulli closed form [R31] | relative error ≤0.5 % at fine subdivision; documented trend | required for release |
| CV2 | Single-element axial/bending patch | impose exact nodal displacements; recover element forces | force recovery error ≤1e-10 relative | required |
| CV3 | Rigid-body modes | translate/rotate whole mesh | strain energy and stresses ≤1e-10; equilibrium residual ≤1e-10 | required |
| CV4 | Symmetry | mirror geometry/load | mirrored displacement field within 1e-9 | required |
| CV5 | Mass/volume consistency | FE mass vs independent analytic volume | relative error ≤1e-9 | required |
| CV6 | Cross-implementation | Python vs JS deterministic fixtures [SPEC §2.1] | 1e-9 relative on fields; 1e-6 absolute on reliability | required |
| CV7 | Subdivision invariance | split elements; compare nodal results away from joints | convergent, ≤0.5 % change at fine level | required |
| CV8 | Manufactured solution (v0.2 3D) | polynomial displacement field with body force [R07, R12] | observed order of accuracy within 10 % of theoretical | v0.2 gate |

### 4.2 Solution verification (L1)

**Table 6 — Solution-verification activities and acceptance criteria.**

| ID | Test | Acceptance criterion |
|---|---|---|
| SV1 | MC convergence | `P̂_f` within 3 binomial standard errors of analytic `P_f` at N = 10⁴–10⁶; report SE |
| SV2 | Seed robustness | 20 seeds at N = 10⁵: coefficient of variation of `P̂_f` ≤1 %; report seeds |
| SV3 | Optimiser convergence | multi-seed runs; mass improvement monotone; constraint slack ≥−1e-3; no seed-to-seed `P_f` violation |
| SV4 | Model-form bounds | bracket results between alternate mechanics (Euler vs Timoshenko; rigid vs flexible joints) and report the interval as epistemic uncertainty |

### 4.3 Literature reproduction (L3, v0.2)

- **LR1 — Lattice mechanics:** reproduce published lattice stiffness/strength trends and, where data are digitised, coupon values for comparable topologies [R35, R36]; report a validation metric (relative error / area metric [R10]) and the same-metric comparison to the published model.
- **LR2 — Recycled-plastic variability:** reproduce the reported variability-suppression mechanism and range from the PNAS brick-and-mortar study using our own implementation of a tension-shear-chain model [R32]; report qualitative agreement and, if the paper's data permit digitisation, quantitative error.
- **LR3 — Proxy mapping:** reproduce the published lot-property prediction relationships from lot proxies [R33]; report R² and prediction intervals on the published data, not on ours.
- **LR4 — AM process effects:** check that our anisotropy/tolerance factors bracket published extrusion-process effects [R37].

Acceptance is pre-registered: "reproduction counts as passed if our implementation reproduces the published *trend* and lies within the paper's stated uncertainty where data are available; failure is reported, not hidden." This is L3: corroboration of the model class, not validation of AnyRB.

### 4.4 Uncertainty and model-form reporting

Every report carries: (i) an uncertainty budget structured per GUM (Type A from MC/sampling, Type B from literature inputs) [R13]; (ii) Monte Carlo convergence and seed information per JCGM 101 [R14]; (iii) a model-form register (frame vs 3D, isotropy, joints, no plasticity/fatigue/creep, no print defects) with the direction of expected bias where known; (iv) sensitivity ranking; (v) the claim level (Table 3). The report must make it impossible to read a `P_f` without seeing its L-level and its model-form caveats. Where the bias direction is known (frame ignoring joints and layer compliance is expected to over-predict stiffness), the report states it so readers do not treat the number as centred.

### 4.5 External review and model card

Before any external use: (i) an independent computational-mechanics review of the FE formulation and benchmarks; (ii) an independent V&V review of the plan and claim matrix (checklist §5); (iii) a one-page model card per model version (purpose, context of use, inputs/provenance, verification evidence, validation status, known limits, version hash). This is the minimum "M&S process/product management" evidence in Table 2 [R05].

### 4.6 Validation roadmap: the minimum physical campaign if access appears

Costs/times are **internal order-of-magnitude estimates [D]**, not quotes; they assume a university/third-party lab and the user's own printer. Each tier is pre-registered and blind: model version frozen and predictions hashed before testing.

**Table 7 — Minimum validation campaign.**

| Tier | What | Sample plan (n) | Acceptance criteria (proposed, pre-registered) | Rough cost / time [D] | What it updates |
|---|---|---|---|---|---|
| **T1** Lot material | tensile tests per lot (ASTM D638 Type I, or ISO 527-1 general principles) [R20, R23]; MFR/density per lot [R22, R24] | 10 specimens × 5 lots (≥3 suppliers/dates) | measured lot means within prior predictive 90 % interval; per-lot CV estimated with CI; E–σy correlation updated | ≈€2–6k; 4–8 wk | feedstock distribution, lot/within split, correlation; L2→L3/L4 for material model |
| **T2** Lattice coupons | X-braced coupon (3×3 cells), 3 build orientations; compression/bend per ASTM D790-style fixture [R21]; report per F2971/ISO 52921 [R29, R30] | 5 coupons × 3 orientations × 3 lots (45) | blind stiffness error ≤20 %; strength error ≤30 %; ratio trends across orientations reproduced | ≈€2–5k (printing in-house); 6–10 wk | joint stiffness factor, anisotropy factors, model-form bounds; L4 component |
| **T3** Full bracket | bracket loaded to deflection limit and to failure; 3 designs incl. robust vs nominal; multiple lots | 5 brackets × 3 designs × ≥2 lots (30) | blind tip-stiffness error ≤15 %; failure-load error ≤25 %; design ranking Spearman ρ ≥0.8 | ≈€3–10k + rig; 8–12 wk | discrepancy term δ, stiffness/strength knockdowns; L5 system validation for that context |

Notes: acceptance thresholds above are engineering proposals, chosen before data and adjustable only by a new pre-registered protocol; they reflect model-form uncertainty in a first campaign (joints, anisotropy) rather than numerical error. With n = 5, individual-specimen scatter is not tightly estimated; the campaign tests the *mean* response and the *ranking*, and that is what the acceptance criteria must say.

### 4.7 Bayesian updating: how test results change the model

1. **Freeze before test:** model/version hash, predicted distributions and acceptance criteria published (hash + timestamp) before any specimen is tested [R15].
2. **Document measurement uncertainty** per GUM [R13]; do not treat measured values as exact.
3. **Joint calibration:** infer material-distribution parameters (lot mean, within-lot scatter, correlation) and discrepancy term `δ` with informative priors from literature; the likelihood uses the pre-registered observation model.
4. **Posterior predictive checks:** held-out lot means and coupon responses must fall inside the stated predictive intervals; report coverage.
5. **Decision rule:** if `δ` exceeds the pre-registered bound or coverage fails, widen uncertainty and lower the claim level; do not silently retune.
6. **Version the result:** the updated distribution/parameters enter the feedstock preset as a new version with provenance; the old version remains reproducible.
7. **Report the discrepancy explicitly:** a systematic 12 % deflection offset is documented as model-form error, not absorbed into a fictitious modulus [R15].

---

## 5. Failure modes of in-silico claims, and the pre-flight checklist

**Table 8 — Failure modes and mitigations.**

| Failure mode | How it appears | Mitigation |
|---|---|---|
| Overfitting to literature | literature distributions tuned until output looks plausible | grade inputs; hold-out literature reproduction; no silent parameter tuning |
| Correlated errors | sim and benchmark share the same wrong assumption | independent benchmarks; alternate models; model-form register [R10] |
| Distribution shift | published stream ≠ user's stream | per-lot priors, update from user data, OOD flags |
| Unmodelled failure modes | real part fails by a mode absent from the model | explicit omission list; design for inspectability; T2/T3 |
| Non-blind validation | tests used to tune, then called validation | pre-registration, hashes, version bump on any change [R15] |
| Surrogate/generative OOD | optimiser exploits surrogate error | forward-FE re-verification of every candidate |
| Verification–validation confusion | "verified" used as "validated" | claim ladder enforced in UI and report [R07] |
| Precision theatre | 6 significant figures with 20 % model error | significant figures matched to uncertainty; uncertainty always shown [R13] |
| Standards laundering | "ISO/ASTM-based" implying compliance | explicit statement of what was *not* satisfied (Table 4) |
| Extrapolation | geometry/scale/load outside verified range | context-of-use statement; refuse or flag out-of-range queries |
| Stale model/data | results from an old engine or preset | version hashes; reproducibility seeds; digital thread [SPEC] |
| Probability misread as frequency | `P_f = 1 %` read as production failure rate | label as model-based probability under stated assumptions; never a measured frequency |

**Pre-flight checklist (run before any external number):**

1. Is the claim level (L0–L6) displayed next to the number?
2. Is the model version/hash recorded, and are seeds reproducible?
3. Are input sources graded and provenance-labelled?
4. Is code + solution verification current for this version?
5. Is model-form uncertainty listed, with known bias direction?
6. Is the MC/analytic error quantified and consistent with displayed precision?
7. Is the context of use stated (geometry, load, material class, process)?
8. Are distribution-shift and extrapolation risks flagged?
9. Is the standard-compliance question answered explicitly ("not a compliance claim")?
10. Is the word "validated" absent unless L4+ evidence exists?
11. Are omitted physics listed (joints, fatigue, creep, fire, out-of-plane, defects)?
12. Does the report say in-silico only, with a pointer to the validation roadmap?
13. Has an independent reviewer checked the claim matrix?
14. Is the user warned not to use results for production qualification without their own testing?
15. Would the statement survive being read aloud to the user's test engineer?

---

## 6. What we could not verify

1. **ASME V&V 10, V&V 20 and V&V 40 full texts were not read** (paywalled). Titles, editions/reaffirmations and public summaries were verified from ASME's official product pages; clause-level citations should be checked by a purchaser before external use.
2. **FDA 2023 guidance body was not read in full**; the official FDA page (scope, docket, risk-informed framework) was verified. Detailed evidence-element checklists are left to the actual guidance PDF.
3. **NASA-STD-7009A text was read from the official PDF**, including Tables 2 and 3; the mapping in Table 2 is ours, not NASA's.
4. **ISO, ASTM and CEN standards are paywalled.** Only official catalogue scope statements/DOIs were verified; no specimen counts, tolerances or clauses are quoted from them. The `n = 10`/`n = 5` campaign numbers are our design choices, labelled as such.
5. **PPWR legal text could not be fetched** (JS-rendered EUR-Lex page); the citation is to the ELI record and claims are kept general.
6. **No physical experiments exist in this project.** Nothing here is validated; the campaign in §4.6 is a plan.
7. **Cost and duration figures in Table 7 are internal estimates [D]**, not quotes; they must be replaced with real quotes before any budget commitment.
8. **AIAA S-141-2024 and AIAA G-077-1998 were verified bibliographically, not read**; they inform the verification package's ambition, not its wording.
9. **The PRODUCT_SPEC's PNAS attribution should be corrected.** The spec attributes the recycled-plastic variability paper to "Ghosh et al.", but the DOI it cites (10.1073/pnas.2502613122) has first author Georgiou (Georgiou, Sun, Liu, Athanasiou), as confirmed from Crossref metadata on 2026-10-29 [R32]. The citation should read Georgiou et al.; the paper and its claims are unchanged.

---

## 7. Gaps

- **No quantified model-form uncertainty.** The frame-vs-part error is listed, not measured; the campaign's T2/T3 tiers exist to replace it with an estimated discrepancy. Until then, `P_f` is a model-based probability, not a field frequency.
- **No independent reviewer yet.** The plan in §4.5 is a requirement, not an achievement.
- **No user-stream data.** The proxy model and distribution presets are priors; v0.2's CSV-fit and calibration hooks are the mechanism, not evidence.
- **Standards status changes.** EN 15343 and PPWR implementation rules may evolve; the standards table must be re-checked before any commercial claim.
- **Claim ladder semantics are ours.** L0–L6 is not an industry-standard scale; it is defensible because each level cites recognised activities, but it must not be presented as a certified framework.

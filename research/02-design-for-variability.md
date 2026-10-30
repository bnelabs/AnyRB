# 02 — Design for variability: how internal geometry reduces the *effect* of batch-to-batch material scatter, and where it cannot

**Status:** v1.0, 2026-10-29 · **Owner:** researcher-design · **Feeds:** `PRODUCT_SPEC.md` §1.2–1.4 (architecture, uncertainty, optimiser), §2.3–2.4 (baselines, batch-adaptive recipe), §7 (claim limits), §10 (honesty rules).

**Purpose.** The product thesis is that *geometry*, not only material selection, can make a recycled-polymer part reliable despite lot-to-lot variation. Half of that is true and the false half decides the product's credibility. This dossier derives the sensitivity laws bounding what architecture can do, dissects the one paper demonstrating large variability suppression in a recyclate, reviews architected-materials and robust-optimisation evidence, records current practice, and converts it into a **lever taxonomy** with effect sizes, required inputs, evidence grades and software exposure.

**Evidence grades** (as dossier 01): **A** peer-reviewed quantitative with data/statistics; **B** peer-reviewed qualitative/single-number; **C** industry/agency/standard/test-report data; **D** derivation or estimate produced here (reproducible arithmetic, not measured). Grades attach per claim, not per paper.

---

## 0. Executive answer

1. **Exact law:** the log-sensitivity of a linear-elastic structural stiffness to a constituent modulus equals that constituent's strain-energy fraction, `∂lnK/∂lnE_p = U_p/U`** [D]. For a single-material part that fraction is 1, so **no geometry can reduce the CV of a single-material linear-elastic stiffness — only its mean.** Real variability suppression needs (a) a second phase with lower scatter, (b) spatial decorrelation plus load sharing, or (c) a nonlinearity.
2. **The anchor paper is a two-phase (a) mechanism.** Georgiou et al. [R01] take measured rHDPE modulus CV from 18 % to 4 % on the fabricated {8,5} rHDPE-platelet / PDMS-matrix specimens (n = 5; 2–3 % modelled). The paper reports no absolute measured composite E_eff mean; the 554 MPa mean is the **{8,7} stretch-film simulation**, not the fabricated composite. Strength is 0.22 MPa — adhesive-limited, 100–230× below the rHDPE it is made from. It is a **film/elastomer composite** result, not a structural-part result; its mechanism is unavailable to a single-material printed bracket.
3. **Two mechanisms must never be conflated.** *Dilution* works against any scatter, including a uniform lot-level shift, and is bought with stiffness/mass. *Averaging* works only on spatially decorrelated variance: `CV_eff/CV = √(ρ+(1−ρ)/N_eff)` [D]. Under AnyRB's two-level model, architecture can remove at most the within-lot share (36 % of variance ⇒ ≤20 % CV reduction) and **never the lot-level share**; UI text implying otherwise is dishonest.
4. **In the v0.1 single-material frame, architecture reliably delivers *margin*, *mode selection* and *sensitivity ranking* — not variance reduction.** Grading lowers peak demand at iso-mass by up to 2× (1.3–1.6× with the 1 mm floor); mode selection moves the binding constraint onto the lower-log-scatter property; reliability-targeted optimisation beats a deterministic FS 1.5 which, at CV 0.20, is a **P_f ≈ 2 % design** [D].
5. **Strongest portable evidence:** 18 %→4 % measured CV reduction by design [R01, A]; pipe-industry caps of ≈15–20 % post-consumer HDPE with two PCR batches behaving "dramatically different" [R19, C/A]; within-batch CVs 5.6–11 % and a 33 % secant-modulus loss from 1 % to 3 % strain on commercial recycled lumber [R31, C]; 10 % relative CV reduction ≈ 7.8 % margin ≈ 7.8 % mass at margin 2 [D].

---

## 1. Theory: how variability propagates

### 1.1 The universal sensitivity law

For a linear-elastic structure under a fixed load case, with `C = 1/K = 2U/F²` and `U = Σ_e U_e`, the envelope theorem gives

```
∂lnK/∂lnE_p = U_p / U      (exact; U_p = strain energy stored in phase p)      [D]
```

* **Series limit** (uniform force): `U_p/U = C_p/C_tot` — a compliant phase dominates compliance and *dilutes* the stiff phase's scatter: the nacre mechanism [R01].
* **Parallel limit** (uniform strain): `U_p/U = K_p/K_tot` — the stiff phase *transmits* its scatter undiluted.
* **Single-material limit**: `U_p/U = 1` ⇒ `∂lnK/∂lnE = 1` and `CV(K) = CV(E)` identically; geometry changes only the mean and the margin.

Strength obeys a weaker law: series chains are weakest-link (`s = 1`), load-sharing bundles narrow with size (§1.4).

### 1.2 Series vs parallel, worked example

Two-phase composite, variable phase carrying compliance fraction `f₁ = 0.6` with `CV₁ = 20 %`, second phase `f₂ = 0.4` with `CV₂ = 5 %`:

```
CV_Y² ≈ f₁²CV₁² + f₂²CV₂² = 0.36·0.04 + 0.16·0.0025 = 0.0148  →  CV_Y = 12.2 %   [D]
```

20 % input becomes 12 % output at zero mass cost *in this idealisation* — but it needs a second phase. In the parallel case the same arithmetic uses stiffness fractions and inverts the advice: put the variable phase where it stores least energy — the design rule behind [R01].

### 1.3 Averaging: what redundancy can and cannot do

For `N` parallel paths with average pairwise property correlation `ρ` (a spatial-correlation length at part scale):

```
CV_eff / CV_input = √( ρ + (1−ρ)/N_eff )        [D, equicorrelated average]
```

`ρ=1` ⇒ ratio 1 (redundancy buys nothing against material scatter; **AnyRB v0.1's assumption**). `ρ=0.8, N=10` ⇒ 0.906 (9 %). `ρ=0.3, N=8` ⇒ 0.62 (38 %).

So the two-level feedstock model (`PRODUCT_SPEC.md` §3) is the most important statistics in the project: with `CV_lot = 0.8·CV_total` and `CV_within = 0.6·CV_total` the within-lot variance share is 0.36, so **the ceiling of architecture-based averaging is a 20 % total-CV reduction** [D]. Larger claims for a single-material part must be dilution or a second phase.

### 1.4 Weakest link vs bundle

Daniels' bundle [R10]: `N` load-sharing fibres give a strength distribution that narrows with `N`; a series chain is weakest-link, `P_f = 1−(1−p)^N ≈ Np`. Practical translation:

```
N = 10 series elements, each at p = 1e-3  →  P_f,system ≈ 1e-2, β 3.09 → 2.33
recovering β = 3.09 needs +0.76 β, i.e. +12 % margin at CV = 0.15        [D]
```

A long series chain is not reliability-neutral; bundle/redundant topologies convert a min-statistic into a mean-statistic, which is why [R01] reports *strength* CV reduction (13 % measured) as well as modulus reduction.

### 1.5 Mode selection and the margin↔CV exchange rate

For lognormal capacity `R` (median `m_R`, `σ_ln = √ln(1+CV²)`) against deterministic demand `S`, margin `m = m_R/S`:

```
β = ln m / σ_ln,  P_f = Φ(−β)
∂lnP_f/∂ln m = −β²/ln m ,   ∂lnP_f/∂lnCV = +β²          [D]
```

One percent of margin is worth `1/ln m` times one percent of CV (1.44× at `m=2`; 2.47× at `m=1.5`). At `m=2, CV=0.20`, a 10 % relative CV reduction (0.20→0.18) is worth **+7.8 % margin ≈ 7.8 % mass** [D]. This exchange rate should be printed in the report; it is the currency every lever below is priced in.

Reference table for the report [D]:

| margin \ CV | 0.10 | 0.15 | 0.20 | 0.25 |
|---|---|---|---|---|
| 1.25 | 1.3e-2 | 6.7e-2 | 1.3e-1 | 1.8e-1 |
| 1.50 | 2.4e-5 | 3.3e-3 | 2.0e-2 | 5.0e-2 |
| 2.00 | 1.9e-12 | 1.7e-6 | 2.3e-4 | 2.4e-3 |
| 3.00 | <1e-25 | 9e-14 | 1.4e-8 | 4.1e-6 |

Two readings. **A conventional deterministic FS 1.5 on a CV-0.20 material is a 2 % failure-probability design** — the status quo AnyRB replaces. And the table is brutally steep in CV (doubling distribution width takes the same design from 1e-12 to 2e-4): **tail risk is CV-dominated**, so any lever leaving the governing CV untouched has a hard ceiling.

### 1.6 Which property binds

In the v0.1 contract (`PRODUCT_SPEC.md` §2.1): `σ_req` is independent of `E` (single material, force control, linear frame); deflection obeys `∂ln u/∂ln E = −1` exactly; buckling is also `E`-governed. So designs split into an `E`-governed family (deflection, buckling) and a `σy`-governed family (yield). A uniform lot-level drop in `E` has **zero** effect on yield-mode reliability and 1:1 effect on deflection-mode reliability, so mode selection chooses which lot-drift the part is immune to: with `CV(E)=0.20`, `CV(σy)=0.16`, moving the binding mode `E→σy` raises `β` by 1.25× at fixed margin (P_f ×3.7) and adds immunity to `E` drift [D] — free mass-wise, modest in size, but exactly the "which property governs" question.

---

## 2. Anchor paper — Georgiou, Sun, Liu & Athanasiou, *PNAS* 122(33):e2502613122 (2025)

*Verified:* DOI `10.1073/pnas.2502613122`, open full text PMC12377729, CC-BY. **The first author is Georgiou, not "Ghosh" as in the brief**; DOI, title, journal, volume and article number match exactly [R01]. Georgia Tech Aerospace + NJIT.

### 2.1 Mechanism

A nacre-inspired brick-and-mortar composite: stiff **rHDPE platelets** ("bricks", `E_hard`) in a thin **soft virgin polymer** ("mortar"; PDMS used) that takes most of the deformation and redistributes stress. Architecture is a staggered, equal-overlap `{N,M}` network: `N` platelets per layer, `M` layers; `N_CT=(N−1)M` cohesive *tensile* elements within layers, `N_CS=(2N−1)(M−1)` cohesive *shear* elements between layers; `2NM` horizontal DOFs; bilinear traction–separation laws (max traction, elastic and critical separation). Newton iteration, `‖R‖₂ < 1e-6`, incremental displacement loading.

**Why it suppresses variability.** In the linear regime the *tensile cohesive elements dominate `E_eff`*; the platelets are comparatively rigid. That is the series/compliance-sharing limit of §1.1: the variable phase sits in the low-strain-energy position and its scatter is diluted. Their sensitivity study agrees — `E_eff` is most sensitive to `σ_max,CT`, insensitive to platelet height `h`, and decreases toward the serial-chain value as `N` grows. Post-elastic, the shear elements govern `σ_max`, and multi-element connectivity converts weakest-link strength into something between weakest- and strongest-link (a bundle effect, §1.4).

**UATSC structure** (uncertainty-aware tension-shear-chain): MC over `E_hard ~ N(μ,σ²)` (literature + their rHDPE data), `σ_max,CT, τ_max,CS ~ Weibull`, `δ_cr ~ N`; total introduced variability by RSS of component CVs (their Eq. 15); 200 realisations; outputs `E_eff`, `σ_max`, `ε_max` and a conservative `ε_W` (strain limit of model validity).

### 2.2 Reported numbers (verified in full text)

| Quantity | Value | Locator |
|---|---|---|
| rHDPE feedstock modulus (50 specimens, 10 plates, ASTM D638-I, tangent at 500 N) | **1 350 ± 239 MPa, CV 18 %** | Methods |
| Fabricated validation specimen `{8,5}` | platelet volume fraction **70.7 %**, 195×53 mm | Model–Experiment Comparison |
| Measured `CV(E_eff)` | **4 %** (predicted 3 %) from 18 % ⇒ **78 % reduction** | Fig. 5 |
| Measured `σ_max` | **0.22 MPa**, CV 13 % (model 11 %), ≈2× weakest element | ibid. |
| Stretch-film case `{8,7}` | volume fraction **82.4 %**, total introduced variability ≈ **26 %** (RSS) | Fig. 6 |
| `E_eff` (200 sims) | **554 ± 10 MPa** (CV ≈ 2 %), target 550; virgin film 400–700 MPa | Fig. 6B |
| `ε_W` | **0.10 ± 0.01** (CV ≈ 8–10 %), CV ratio 0.32 | Fig. 6C |
| Headline claims | **93 %** `E_eff` variability reduction; **≥68 %** `ε_W` reduction; virgin-matched modulus | Abstract, Discussion |
| Design rules | `K_CT⁺ ≈ 1.5–2×K_CS⁺`, an order of magnitude below `E_hard`; interface traction ≤ ~30 % of polymer yield; adhesive CV <10 % ideal, <15 % near-ideal, >25 % collapses (10–15 % mean loss at 25 %) | Discussion |

### 2.3 Critical reading — what the numbers do and do not mean

1. **The 93 % is relative to a modelled 26 %, not the measured 18 %:** `0.07×26 % ≈ 2 %`. Relative to the feedstock's 18 % the same result is **89 %**; the *measured* validation is **78 %** (18 %→4 %) [D from R01]. "Up to 93 %" is defensible only with its denominator.
2. **Suppression is bought with stiffness.** The 554 MPa figure is the **{8,7} stretch-film simulation** (tuned interfaces, model only), so `554/1350 = 0.41` is not the fabricated composite's ratio. The paper does not report a measured composite mean; a digitised Fig. 5 initial slope is ≈16.5 MPa (sanity band only). The dilution mechanism still costs stiffness and mass; that qualitative point stands, but no 2.4× mass penalty should be quoted as a measured result.
3. **Strength is adhesive-limited at 0.22 MPa**, 100–230× below rHDPE (22–50 MPa). The v0.1 bracket's root bending stress at 150 N is ≈3.75 MPa (`M = 22 500 N·mm`, `W = t·h²/6 = 6 000 mm³`) — 17× the composite's strength. **The nacre composite as built cannot be a bracket.** What generalises is the statistical architecture and design logic, not the material system.
4. **Fabrication and scale.** Platelets cut from 10 sheets, aligned in a 3D-printed mould, PDMS cast/cured 24 h at 60 °C; 5 specimens of 1 geometry tested; the stretch-film result is 200 simulations, **not** a tested film — a lab demonstrator, not a process.
5. **Stated model limits:** linear-elastic platelets, small strain, no plasticity; `ε_max` unpredictable, replaced by a conservative `ε_W`; over-prediction at excessive damage. The variability conclusion survives because it lives in the small-strain regime.
6. **The target was a low-modulus product:** 550 MPa because stretch films live at 400–700 MPa — far easier to match than a bracket benchmarked against the recyclate's own 1 350 MPa.

### 2.4 What generalises to an AnyRB bracket

| PNAS element | Generalises? | AnyRB use |
|---|---|---|
| Constituent distributions → network mechanics → MC → variability metrics | **Yes, 1:1** | Methodological precedent for the pipeline (feedstock → FE → MC) |
| Sensitivity dilution, `s_E = U_p/U` [D] | **Yes, as theory** | "Dilution factor" diagnostic; explains *why* two-phase composites suppress scatter |
| rHDPE bricks + PDMS mortar; interface design rules | **No** for single-material printing; **yes** as v0.2 multi-material feature | Roadmap, priced at ≈2.4× mass for stiffness parity |
| Reported 93 %/68 % | **No** — different product class and denominator | Cite as "the mechanism exists", with denominator; never as an AnyRB prediction |
| `ε_W` as a model-validity strain | **Yes, conceptually** | Mirrors AnyRB's claim limits — report where the linear model is trustworthy |

---

## 3. Architected materials: defect and scatter tolerance evidence

### 3.1 Stretch- vs bending-dominated scaling, and error amplification

Gibson–Ashby [R02]: `E*/E_s ∝ (ρ*/ρ_s)^n`, `n≈1` stretch-dominated (truss/octet), `n≈2` bending-dominated. Stretch-dominated topologies are far stiffer per unit mass — the octet truss reaches `E*/E_s ∝ ρ̄`, an order of magnitude above foams [R03], and [R04] holds nearly constant stiffness per unit mass across three decades of density. **But the exponent also amplifies geometric error:** bending-dominated designs have `u∝w⁻³`-ish (±10 % width error → ±30 % deflection), axial designs `u∝w⁻¹` (±10 % → ±10 %) [D]. AnyRB's X-braced frame is largely axial-braced — the low-sensitivity topology, a cheap robustness lever computable per element from the unit-load solve already performed.

### 3.2 Hierarchical and resilient architectures

[R05] (Meza et al. 2015) reports near-theoretical strength/stiffness scaling with density, **suppression of brittle failure and structural instabilities**, and hollow alumina samples recovering up to 98 % of height after ≥50 % compression; extra hierarchy beyond second order did not help. That is load-redistribution/bundle physics (§1.4), not material-scatter tolerance. [R04] is the cleanest published statement that **architecture, not the constituent, sets specific stiffness**; nacre mechanics [R06] supplies the sliding/crack-bridging precedent used by [R01]. Fleck–Deshpande–Ashby [R07] give the canonical trade-off: stretch-dominated trusses are stiffer and stronger but **more imperfection-sensitive**, bending-dominated foams more defect-tolerant. That trade-off is the key caveat for anyone promising "defect-tolerant architecture".

### 3.3 Defect tolerance: what the evidence actually covers

[R08] quantifies elastic and failure knockdowns of 3D metallic lattices with **geometric SLM defects** (waviness, thickness error); [R09] shows imperfections control tensile ductility of cellular solids; [R33] shows defects dictate brittle-honeycomb strength; [R34] models stochastic geometric defects in AM lattices. Grade **A** that geometric/manufacturing defects degrade lattices; **B** for transfer of quantitative knockdowns to polymer frames.

**Honest boundary: nearly all of this literature concerns geometric defects, not batch-to-batch variation in constituent modulus and strength.** No study we found quantifies lattice-level variability suppression under *recyclate lot* scatter other than [R01] — a composite, not a lattice; "lattices tolerate material scatter" is an extrapolation, not a result. The one supportive result is structural: the averaging identity of §1.3 is exact, and tolerance exists only for the decorrelated part.

---

## 4. Robust design and uncertainty-aware optimisation

| Formulation | Statement | Strength | Pitfall | Refs |
|---|---|---|---|---|
| Expected value | `min E[mass]` s.t. `E[g]≤0` | cheap, smooth | ignores tails — the status quo's failure | [R11] |
| Mean + variance | `min μ_f + kσ_f` | captures dispersion | arbitrary `k`; penalises upside; no reliability claim | [R11] |
| Worst case / convex set | `min max_{θ∈Θ} f(θ)` | no distribution needed | "all bad values at once" is unphysical; over-conservative | [R12] |
| Reliability index / probability | `min mass` s.t. `P_f ≤ target` | tail-aware, directly interpretable | needs a distribution model; sensitive to the tail; expensive without surrogates | [R15] |

* RBTO under material uncertainty for continua embeds a first-order reliability step in the topology loop [R15]; random-matrix representations make it cheaper and avoid independent-element assumptions [R17]. Robust TO of **lattices under material and load uncertainty** [R16] is the closest analogue to AnyRB's optimiser (unit-cell scale, no recyclate distribution). Manufacturing-tolerant TO handles under/over-etch and spatially varying error fields [R13, R14] — AnyRB's width clip and neighbour-ratio limits are a poor-man's version.
* **Spatially varying material uncertainty** in multiscale optimisation [R35] is essential before AnyRB adds per-element material scatter (v0.2) — the case where `ρ` in §1.3 is neither 0 nor 1. **Stochastic homogenisation** [R18] shows RVE scatter shrinks as `1/√N` only above a size threshold, so unit-cell homogenisation cannot represent lot-level scatter: keep the material distribution at part level, homogenise only geometry.

**v0.1 choice:** reliability-target optimisation as the primary formulation (the only one producing the core deliverable), plus the FS 1.5 baseline and a worst-batch envelope as a *report*, not an objective. Mean-variance is diagnostic only: with a two-level distribution its `kσ` term is dominated by the lot-level component design cannot address.

---

## 5. Processing and material levers (inside the feedstock model)

| Lever | Mechanism | Quantified effect | Evidence |
|---|---|---|---|
| Virgin dilution / blending | lower recyclate fraction `φ`; mixture statistics | `CV_blend=√(φ²σ_r²+(1−φ)²σ_v²)/μ_blend`; at `φ=0.5, CV_r=0.20, CV_v=0.05` ⇒ ≈10 % from 20 % [D]. Industrial cap ≈15–20 % PCR HDPE in corrugated pipe (66 blends) | [R19] A/C, [R26] B, [R21] B |
| Batch mixing / batch management | average independent lots; ML composition tool for rPP | lot CV ↓1/√n: 4 lots ⇒ total CV `0.72C` (28 % ↓) under our split [D] | [R20] B |
| Compatibilisers / modifiers | restore ductility/strength in mixed streams | mean recovery documented; **CV effect rarely reported** — evidence gap | [R22] B, [R21] B |
| Sorting purity | remove composition variance at source | affects lot-level shift; no verified mechanical-CV effect size | [R01] intro B |
| Closed-loop process control | compensate process-induced variance | acts only within-lot ⇒ total-CV floor `0.8C` (≤20 % ↓) [D] | [R01] intro B, [R23] A/B |
| **Per-lot adaptation (pillar 2)** | measure per-lot index, scale design | removes lot component: `C→0.6C` (40 % ↓) with perfect proxy; `CV/C=√(0.36+0.64ε²)` ⇒ ε=0.5 leaves 28 %, ε=1 leaves 0 % [D] | logic [R01,R23]; magnitudes D |
| Screening / acceptance window | reject or truncate bad lots | removes tail directly at inspection cost | [R19] C |
| Per-lot proxy (MFI/IV/melt-kneading) | predict mechanicals without tensile tests | supplies the `(E,σy)` input the pipeline needs | [R23] A |

The value-of-measurement curve `CV/C=√(0.36+0.64ε²)` belongs in the UI as a "proxy accuracy" slider: it turns data quality into a reliability number and is one of the few honest *variance* claims available (it removes a known lot-level shift, not material scatter).

---

## 6. Counter-evidence and limits — where architecture cannot help

1. **No geometry reduces the CV of a single-material linear-elastic stiffness** (§1.1, `U_p/U=1`). `u ∝ 1/E` *exactly*, so P95 deflection = mean deflection / 5th-percentile modulus. **Architecture is a margin lever, not a variance lever, in a single-material part.**
2. **A uniform lot-level shift is transmitted 1:1**: to deflection and buckling (both `E`-governed, log-sensitivity −1) and to yield failure via `∂lnP_f/∂lnσy = −1/σ_ln`. No geometry in v0.1 changes those coefficients — only `σ_req` (grading), mode selection, a second phase (2.4× mass) or per-lot compensation change the outcome.
3. **Redundancy is inert against batch-uniform material**: `ρ=1` in §1.3 makes `N_eff` irrelevant, and `PRODUCT_SPEC.md` §2.1 excludes spatial scatter. Without this statement a user will read "lattice = redundancy = robust" and be misled.
4. **Dilution costs stiffness, mass and strength**: `E_eff/E_hard=0.41`, ≈2.4× mass for parity, adhesive-limited 0.22 MPa strength [R01, D].
5. **Defect tolerance ≠ material-scatter tolerance** [R08, R09, R33, R34], and stretch-dominated topologies are *more* imperfection-sensitive [R07]: the efficient topology and the tolerant topology differ.
6. **Everything outside linear elasticity is missing** — creep, fatigue, layer anisotropy, residual stress, warpage, weld lines, print defects, moisture/UV ageing (`PRODUCT_SPEC.md` §7). The 33 % secant-modulus drop from 1 % to 3 % strain (§7.3) shows how fast the idealisation decays; and printed `E`/`σy` depend on raster orientation, so numbers must be *relative* design comparisons.
7. **The literature's effect sizes are often model-derived**: [R01]'s 93 % is a 200-realisation simulation; the measured figure is 78 %. AnyRB must label every number simulated/derived/measured.

---

## 7. Case studies: current practice on recycled-content load-bearing products

**7.1 Corrugated HDPE pipe with post-consumer resin** [R19]. NCHRP 04-32 blended and tested 66 formulations against AASHTO M294. Appendix C, §C.8: maximum mixed-colour PCR meeting 24-h stress-crack resistance is ≈20 %, and **"a conservative number is closer to 15 %"**; at 15 % all AASHTO pipe requirements were met; and **two batches of mixed-colour PCR "behaved dramatically different"**. NCTL stress-crack testing itself has inter-laboratory scatter "higher than 40 %". Lessons: industry's answer to variability is *blend limits and qualification testing*, not design; lot variation flips pass/fail verdicts; **measurement scatter is the same order as material scatter**, and AnyRB's inputs inherit it.

**7.2 Pressure pipe design coefficients** [R29, R32]. Thermoplastic pressure pipe does not design to a distribution: ISO 12162 defines the overall service (design) coefficient `C`, with `HDS = MRS/C` and `C = 1.25` typical for PE100 [R32]. Conservative, single-number, blind to distribution shape — and a useful anchor: `C=1.25` at `CV=0.15` corresponds to `P_f ≈ 6.7 %` (§1.5 table).

**7.3 Recycled polyolefin plastic lumber** [R31]. University tests on commercial product to ASTM D6662 [R30]: compressive strength 1 620 psi (11.2 MPa) CV 5.6 %; compressive modulus 70 600 psi (487 MPa) CV 11 %; flexural strength 2 080 psi (14.3 MPa) CV 6.3 %; **1 % secant modulus 104 000 psi (717 MPa) vs 3 % secant 69 300 psi (478 MPa) — a 33 % apparent-stiffness loss from 1 % to 3 % strain**. Design is serviceability-driven (secant modulus, 1 %-strain stress), so the real design property is already a nonlinear secant with large implicit derating — AnyRB's linear `E` is optimistic and must be labelled so.

**7.4 Recycled filament and automotive compounds.** rPETG/rPET filament shows property loss and scatter after re-extrusion [R24]; [R25] confirms recycled-content AM parts are qualified by per-spool coupons rather than design analysis. Post-industrial recycled PP changes after thermal ageing [R27]; PA6/PP automotive recyclates need per-batch characterisation [R28]. Strategy across sectors is identical: **cap recycled content, qualify each lot, derate** — no distributional design method in routine use.

**7.5 Synthesis.** Four product classes convert variability into one conservative deterministic number (blend limit, design coefficient, allowable stress, coupon pass/fail) — safe, wasteful, blind to distribution shape: at CV 0.20 FS 1.5 is a 2 % failure-probability design, at CV 0.10 the same FS is 2.4e-5 (§1.5). A single safety factor cannot be both economical and reliable across recyclate lots — the product's reason to exist.

---

## 8. Lever taxonomy → software features

Families: **A** transmission-side (make output insensitive to input), **B** demand-side (reduce/reshape demand), **C** material/process (change the input distribution), **D** decision (change how the design is chosen). Sizes are for the v0.1 bracket unless noted; every lever card must state whether it changes the **mean**, the **CV** or the **decision**, its *mechanism* and *denominator*, and its **mass-equivalent exchange rate**.

| # | Lever | Mechanism | Expected effect size | Model input needed | Grade | AnyRB exposure |
|---|---|---|---|---|---|---|
| A1 | **Compliance dilution / 2nd phase** | variable phase in low-energy position; `s_E=U_p/U` | 18→4 % CV measured (78 %), 2 % modelled (89–93 %, denominator-dependent) [R01]; cost `E_eff/E_hard=0.41`, ≈2.4× mass [D] | two-phase FE, interface stiffness distribution, 2nd material `E,σy` | A (1 system) / D | v0.2 multi-material; report dilution factor, mass penalty, strength cap |
| A2 | **Redundancy / spatial averaging** | `CV_eff/CV=√(ρ+(1−ρ)/N_eff)` | 0 % at ρ=1 (v0.1); 9 % at ρ=0.8,N=10; 38 % at ρ=0.3,N=8 [D] | within-lot CV, correlation length `ℓ_c`, per-element scatter | A (theory)/C | v0.2 feedstock "spatial correlation"; disabled + explained in v0.1 |
| A3 | **Bundle vs weakest link** | load sharing converts min→mean statistic | strength CV 18→13 % measured [R01]; 10-link series chain: β −0.76, needs +12 % margin at CV 0.15 [D] | element capacity distribution, load-sharing topology | B | v0.2; v0.1 reports "series-chain penalty" |
| B1 | **Demand-proportional grading** | size struts ∝ demand; lower peak utilisation at iso-mass | peak demand ↓ up to 2× analytic (linear moment field), 1.3–1.6× with 1 mm clip [D]; at CV 0.20 ⇒ Δβ 1.4–3.5 | element demands `σ_req,e`, width field | D / B (TO) | **v0.1 optimiser's main mass lever**; utilisation map + peak/mean |
| B2 | **Failure-mode selection** | choose yield vs deflection vs buckling to control the governing property | β ×1.25 (CV 0.20→0.16), P_f ×3.7 at fixed margin; full immunity to E drift if yield-governed [D] | joint `(E,σy)` + correlation; `E_req`, `σy_req` | B / D | v0.1 report: governing property, per-mode `P_f`, mode-balance bar |
| B3 | **Topology error amplification** | axial (`u∝w⁻¹`) vs bending (`u∝w⁻³`) | ±10 % width error ⇒ ±10 % vs ±30 % deflection [D]; stretch topologies stiffer but more imperfection-sensitive [R07] | `∂ln u/∂ln w_e` per element (from FE) | B | v0.1 printability: width-error sensitivity metric |
| B4 | **Printability constraints** | width clip, ratio ≤1.5, `L/w≤30` | cut B1's gain from 2× to 1.3–1.6× [D] | geometry + process limits | C | v0.1: report violations, never silently reject (spec §2.2) |
| C1 | **Per-lot adaptation** | measure lot index, scale design | total CV `C→0.6C` (40 % ↓) perfect proxy; `CV/C=√(0.36+0.64ε²)` [D]; at m=2, CV 0.25→0.15 ⇒ P_f ×1400 | lot quality index `q`, proxy residual | B / D | **v0.1 pillar 2** (batch passport + acceptance window) |
| C2 | **Batch mixing** | average independent lots | lot CV ↓1/√n; 4 lots ⇒ total CV 0.72C [D] | number of blended lots | B | v0.1 feedstock "lot count" |
| C3 | **Virgin dilution** | mixture statistics; lower `φ` | CV ≈ φ·CV_r (10 % at φ=0.5 from 20 %); cap 15–20 % for pipe compliance [R19] | `φ`, virgin/recyclate moments | A/C | v0.1 preset `φ` with sourced cap |
| C4 | **Compatibilisers** | restore mean ductility/strength | mean effects only; **CV effect unquantified** | additive → property shift | B/C | documentation only; flagged gap |
| C5 | **Sorting + process control** | remove composition/process variance | ≤20 % total-CV reduction (`CV_within=0.6C` floor) [D]; real gains lot-level | variance split | B | v0.1 "what process control cannot fix" note |
| C6 | **Screening / acceptance window** | reject/truncate bad lots | removes tail directly | spec limits, `P_f` surface | C | v0.1 acceptance-window output |
| D1 | **Reliability-target optimisation** | `min mass` s.t. `P_f≤target` vs FS 1.5 | FS 1.5 at CV 0.20 ⇒ **P_f≈2 %** [D] | `P_f` evaluator (MC/analytic) | B / D | **v0.1 core**: robust-opt vs nominal-opt table |
| D2 | **Robust objective** | mean+variance or worst case | formulation-dependent; worst case over-conservative [R11,R12] | uncertainty set / `k` | A | v0.1 diagnostic only |
| D3 | **Global sensitivity ranking** | which input dominates `P_f` | ranks levers; value-of-information | finite differences/Sobol | B | v0.1 sensitivity panel (spec §4) |
| D4 | **Derating / design coefficient** | industry baseline to beat | `C=1.25` ≈ P_f 6.7 % at CV 0.15 [R29,R32,D] | MRS-equivalent mean, `C` | A (standard)/D | v0.1 "current practice" comparison column |


---

## 9. What we could not verify

1. **Author name:** the anchor is **Georgiou, Sun, Liu & Athanasiou**, not "Ghosh et al."; DOI/title/journal/article number verify exactly [R01]. The DOI is authoritative.
2. **`E_hard` sampling granularity in [R01]** (per-platelet vs per-realisation) is not stated in the main text; SI Tables S2–S4 would settle it. It matters: per-realisation sampling means the suppression is *dilution against a uniform shift* (portable to lot drift), per-element sampling mixes in averaging. We take the conservative reading.
3. **The stretch-film result is simulation-only** (200 realisations, no tested film); only the `{8,5}` tensile specimen was physically tested (5 specimens). A minor internal inconsistency: `ε_W=0.10±0.01` implies CV≈10 %, while CV ratio 0.32×26 % implies 8.3 %; both round to "≈8–10 %".
4. **ISO 12162 and ASTM D6662 verified at catalogue/preview level only**; exact per-material coefficients and the D6662 §6.1.4.1 allowable-stress formula require purchase. `C=1.25` for PE100 comes from [R32], not the standard text.
5. **No verified quantitative source for a CV reduction from compatibilisers, sorting or closed-loop process control** — the literature reports mean effects, hence C4–C5 graded B/C; nor for lattice-level variability suppression under recyclate lot scatter ("lattices tolerate material scatter" is an extrapolation). **[R31]** is a manufacturer-commissioned report (C), within-batch CVs for one product; **NCHRP 696** numbers are quoted at Appendix C's level (main body and later field report not read in full).
7. **All [D] magnitudes** are derivations from cited numbers or the v0.1 contract — reproducible, but not measurements.

---

## 10. Requirements this dossier imposes on the product

1. **Label every number** simulated / derived / literature-measured / from user lot data, and **state the denominator** of every variability claim ("CV reduced X→Y", never "cut by Z %").
2. **Report the governing property and mode balance** of every design — the real reason one design beats another under a lot-level shift — plus each lever's mass-equivalent exchange rate (§1.5).
3. **Disable and explain** levers that cannot work in v0.1 (A1–A3): a greyed card with one line ("requires a second material" / "requires spatial scatter, not modelled") is more credible than silence and doubles as the v0.2 roadmap.
4. **Show the conventional-practice comparison** (D4: design coefficient / FS 1.5 ⇒ implied `P_f`) — the most persuasive and honest number in the product.
5. **Never claim** that bracket geometry reduces the CV of the material response, that redundancy helps under batch-uniform material, or that the PNAS 93 % transfers to a single-material printed part.

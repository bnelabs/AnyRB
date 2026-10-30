# 06a — PNAS 2025 (Georgiou et al.) deep read: exact {8,5} parameters, UATSC equations, and what AnyRB can defensibly compute

**Status:** v1.0, 2026-10-30 · **Owner:** researcher-design · **Task:** task-12 · **Write scope:** this file only · **Product:** AnyRB (v0.5)
**Secondary context:** [`research/02-design-for-variability.md`](02-design-for-variability.md) §2 (do not treat as source of truth; corrections in §11 below).

**Primary source (all values below re-read from the primary source, not from dossier 02):**
Georgiou D., Sun D., Liu X., Athanasiou C.E., "Suppressing mechanical property variability in recycled plastics via bioinspired design", *PNAS* **122**(33):e2502613122 (2025).
DOI [10.1073/pnas.2502613122](https://doi.org/10.1073/pnas.2502613122) · PMID 40794839 · PMCID [PMC12377729](https://pmc.ncbi.nlm.nih.gov/articles/PMC12377729/).
Text used: PMC full text HTML, Europe PMC JATS XML (`.../PMC12377729/fullTextXML`, 19 numbered equations, MathML), SI Appendix PDF (20 pages: Figs S1–S10, Tables S1–S5, Movie S1 legend, SI refs), Fig. 5 and Fig. 6 JPEGs (PMC CDN).
In this note the paper is **`[R01]`** (the identifier used in [`refs/refs-02.json`](refs/refs-02.json)); each claim carries an exact section/table/figure locator plus the DOI/PMC links above. Values marked **(D)** are our arithmetic from published numbers — not published values.

---

## 1. Citation, access, and what is actually open

| Item | Value | Source |
|---|---|---|
| Title (article) | "Suppressing mechanical property variability in recycled plastics via bioinspired design" | JATS `article-title` |
| Title (SI cover) | "Suppressing Mechanical Property Variability in Recycled Plastics via Bio-inspired Design" | SI p. 1 |
| Authors | Dimitrios Georgiou¹\*, Danqi Sun¹\*, Xing Liu², Christos E. Athanasiou¹ (¹equal contribution, \*corresponding) | SI p. 1; JATS contrib-group |
| Affiliations | ¹Daniel Guggenheim School of Aerospace Engineering, Georgia Institute of Technology; ²Dept. of Mechanical and Industrial Engineering, New Jersey Institute of Technology | SI p. 1 |
| Journal / volume / article | *PNAS* 122(33):e2502613122 | JATS |
| DOI / PMID / PMCID | 10.1073/pnas.2502613122 / 40794839 / PMC12377729 | JATS article-ids |
| Dates | received 2025-02-03; accepted 2025-07-09; published online 2025-08-12; issue 2025-08-19 | PMC front matter |
| Editor | Markus J. Buehler (MIT) | PMC front matter |
| Funding | NSF CAREER CMMI-2338508 | Acknowledgements |
| Licence | **CC BY 4.0** — open access, reuse with attribution | PMC permissions |
| Data/code availability | "All study data are included in the article and/or supporting information." **No model code, no input decks, no raw data files released.** | Back matter, "Data, Materials, and Software Availability" |
| What is open | Main text (HTML/PDF), SI Appendix PDF (all tables/figures used here), Movie S1 — all CC BY | PMC/PNAS |
| Access caveat | PMC gates direct PDF/SI downloads for scripted clients behind a proof-of-work page; we obtained the JATS XML and the complete SI PDF via the Europe PMC REST endpoints (`.../PMC12377729/supplementaryFiles`). This is an access detail, not a scientific limitation. | our log |

**What the paper claims (abstract, verbatim):** "our design reduced modulus variability by up to 93% and maximum permissible strain variability by at least 68% compared to input rHDPE, while matching the modulus of virgin HDPE film." The Significance statement says "reduces modulus variability by over 90%". Both are **model-based** for the film case (§5) — the measured composite result is 18 % → 4 % (§4).

---

## 2. The fabricated {8,5} specimen — exact parameters

Architecture: staggered brick-and-mortar network with equal overlap; `N` = platelets per layer, `M` = layers; hard elements (platelets), cohesive tensile elements `CT` (within a layer), cohesive shear elements `CS` (between layers). `N_CT = (N−1)·M`, `N_CS = (2N−1)·(M−1)`; degrees of freedom `2·N·M` (horizontal only).

**Table S3 (SI p. 15), verbatim values, with the units the table itself gives:**

| Parameter (as printed) | Value | Meaning / units |
|---|---|---|
| `E_hard` (MPa) | `N(1350, 239²)` | normal; mean 1350 MPa, SD 239 MPa (CV 17.70 %) — this is the **measured** feedstock distribution, not the literature one |
| `{σ_max,CT, δ_e,CT, δ_cr,CT}` (MPa / mm / mm) | `{W(7.00, 0.15), 0.80, N(1.20, 0.18²)}` | CT: Weibull shape m = 7.00, scale s = 0.15 MPa; elastic separation 0.80 mm; critical separation normal(1.20, 0.18²) mm |
| `{τ_max,CS, δ_e,CS, δ_cr,CS}` (MPa / mm / mm) | `{W(7.00, 0.20), 0.40, N(0.80, 0.12²)}` | CS: m = 7.00, s = 0.20 MPa; δ_e = 0.40 mm; δ_cr = normal(0.80, 0.12²) mm |
| `l` (mm) | 20 | platelet length |
| `h` (mm) | 8 | platelet height |
| `w` (mm) | 4.75 | structure width (out-of-plane) — confirmed by validation table where `W = 10` mm matches `w = 10` mm (Table S2) |
| `t` (mm) | 3 | cohesive-element thickness (one value for the whole structure; the validation run instead used t = 0.25 mm CT / 0.5 mm CS, Methods) |

Other stated values: network `{8,5}`; platelet volume fraction `V_plat/V_total = 70.7 %`; overall specimen **195 mm × 53 mm**; 5 specimens tested; ASTM D638-I platelets cut from 10 rHDPE sheets (McMaster-Carr 3762N111); PDMS Sylgard 184, 10:1 base:agent; "cured at 60 °C for 24 h"; lap-shear to ASTM D3163 with 20 × 20 mm bond area.

**Derived counts for {8,5} (D, from the paper's formulas):** hard = 40, `N_CT` = 35, `N_CS` = 60 → **135 elements, 80 DOFs**. For comparison: {8,7} (film) = 56 + 49 + 90 = 195 elements, 112 DOFs; {10,5} (sensitivity) = 50 + 45 + 76 = 171 elements, 100 DOFs.

**Related tables (for the record):**
- **Table S2 (SI p. 14, sensitivity analysis + limit-case validation):** `E_hard = N(1213, 200²)` MPa; `{σ_max,CT, δ_e,CT, δ_cr,CT} = {W(5.00, 4.00), 0.20, 0.50}`; `{τ_max,CS, δ_e,CS, δ_cr,CS} = {W(5.00, 4.00), 0.20, 0.50}`; `l = 15`, `h = 6`, `w = 10`, `t = 0.5`.
- **Table S4 (SI p. 16, stretch-film case study):** `E_hard = N(1350, 239²)`; CT `{W(7.00, 8.00), 0.15, N(1.00, 0.10²)}`; CS `{W(7.00, 8.00), 1.40, N(1.80, 0.18²)}`; `l = 25`, `h = 3`, `w = 1`, `t = 1`.

**What Table S3 does not give (do not invent):** PDMS bulk modulus, Poisson ratio, or density (only the traction–separation law is characterised); the numeric overlap length (only "equal overlap"); a per-family `t` (single value 3 mm); geometric tolerances; platelet surface treatment; specimen gauge length; the `w` of the CT/CS interfaces beyond the single tabulated value.

**Geometry reconciliation (D, approximate):** with `l = 20, h = 8, M = 5, t = 3`: network height `M·h + (M−1)·t = 52 mm` ≈ stated 53 mm; network length `N·l + (N−1)·t = 181 mm` vs stated 195 mm (≈14 mm unaccounted, plausibly grip allowance). Platelet volume fraction from the same unit-cell picture: `(N·l)/(N·l+(N−1)t) × (M·h)/(M·h+(M−1)t) = 88.4 % × 76.9 % = 68.0 %` vs stated **70.7 %** — 2.7 points higher than our reconstruction. The paper does not define the volume-fraction reference volume; the discrepancy is small but unresolved.

---

## 3. The UATSC model — equations needed to specify a reduced calculation

### 3.1 Element laws (main text Eqs. 1–8, exact)

Hard (platelet) element, linear elastic, 1-D:

```
σ_Hard = (E_hard · A / l) · δ                                (Eq. 1)
```
with `l` platelet length, `A` the platelet cross-sectional area. Shear-lag cross-check used by the authors:

```
σ_lag = σ_CT + (l/h) · τ_CS                                  (Eq. 2)
```
CT (cohesive tensile) and CS (cohesive shear) bilinear laws:

```
σ_CT =  K_CT+ · δ                     δ ≤ δ_e,CT
        K_CT− · δ                     δ_e,CT < δ < δ_cr,CT    (Eq. 3)
        0                             δ ≥ δ_cr,CT
τ_CS =  K_CS+ · δ                     δ ≤ δ_e,CS
        K_CS− · δ                     δ_e,CS < δ < δ_cr,CS    (Eq. 4)
        0                             δ ≥ δ_cr,CS
K_CT+ = σ_CT / δ_e,CT      (Eq. 5)        K_CS+ = τ_CS / δ_e,CS      (Eq. 6)
K_CT− = (δ_cr,CT/δ)·[(δ_cr,CT − δ)/(δ_cr,CT − δ_e,CT)]·K_CT+      (Eq. 7)
K_CS− = (δ_cr,CS/δ)·[(δ_cr,CS − δ)/(δ_cr,CS − δ_e,CS)]·K_CS+      (Eq. 8)
```
Note Eq. 5/6 as printed use the *current* traction symbol, not `σ_max`; the text says they are defined as `σ_max/δ_e`. Units of `K±` are therefore MPa/mm = N/mm³ (traction per separation).

### 3.2 Network, boundary conditions, solver

Staggered equal-overlap network; only horizontal displacements; `2NM` DOFs; each element a generally nonlinear spring; boundary conditions: left-boundary nodes fixed horizontally, right-boundary nodes displaced by `Δ` (incremental displacement control); Newton iteration `u_new = u_old − (∇R)⁻¹R` (Eq. 9) with `R = F_ext − F_int` (Eq. 10) until `‖R‖₂ < 1e-6`; outputs per increment: nodal displacements, element stresses, damage state (intact/damaged/unloaded/destroyed), reaction force.

### 3.3 Effective modulus and output metrics

```
E_eff = σ_yield / (Δ_yield / L)                               (Eq. 13)
CV = σ/μ                                                     (Eq. 14)
CV_total = sqrt( Σ_i CV_i² )                                  (Eq. 15)
```
`σ_yield` = stress at the last increment *before* damage is detected (the authors call it yield stress); `Δ_yield` its displacement; `L` = "the cumulative length of the hard elements and CT elements along a single layer, while considering the staggered arrangement" — **L is defined verbally, not by a formula** (see §9.2). `σ_max` = maximum stress; `ε_max` = elongation at break; `ε_W` = "maximum permissible strain": a conservative threshold before the small-strain model loses validity, used instead of `ε_max` in the film case.

### 3.4 Stochastic inputs and Monte Carlo

- `E_hard ~ N(μ, σ²)` (Eq. 11 normal PDF), justified by a central-limit argument; truncated only implicitly (no explicit truncation is stated).
- `σ_max,CT, τ_max,CS ~ Weibull(m, s)` (Eq. 12), shape `m`, scale `s`.
- `δ_cr,CT, δ_cr,CS ~ N(μ, σ²)`; `δ_e` treated as deterministic in every table.
- Sources assumed statistically independent; total introduced variability = RSS of component CVs (Eq. 15).
- Realisations: **200 simulations** for the film case study (Results, Case Study). The convergence study in SI Fig. S2 (SI p. 3) says "10² samples provide a sufficiently converged estimate" for a {10,5} network (the PDF text layer renders the superscript as "102"; we read it as 10²) — i.e. ~100 would suffice; 200 was used. The limit-case validation used **10⁶** Monte Carlo runs (Methods).
- Each realisation randomises constituent properties and re-solves the network; `E_eff`, `σ_max`, `ε_max/ε_W` are then aggregated across realisations.

### 3.5 Closed-form limit cases (Methods, Eqs. 16–19) — and their problems

Serial chain (`{N,1}`, hard + CT in series):

```
1/K_total = Σ_{i=1..N} 1/K̄_HARD,i + Σ_{i=1..N−1} 1/K̄_CT,i+          (Eq. 16)
σ_max,chain = min_i( σ_max,CT,i )                              (Eq. 17)
K̄_HARD,i = E_HARD,i · (w·h/l)                                  (Methods text)
K̄_CS,i+  = K_CS,i+ · (w·l/2)                                   (Methods text, MathML explicit)
K̄_CT,i+  = K_CT,i+ · l                                         (Methods text as printed — see below)
C̄_HARD,i = 1/K̄_HARD,i ;   C̄_CS,i = 1/K̄_CS,i+
```
Alternating column (`{1,5}`, five layers):

```
K_total = (6·C̄_HARD,i + 4·C̄_CS,i) /
          (5 − C̄_HARD,i² + 5·C̄_HARD,i·C̄_CS,i + C̄_CS,i²)          (Eq. 18)
σ = K_total · (L/(w·h)) · (ΔL/L)  ≡ E_eff                        (Eq. 19)
```
**Dimensional/typographic problems we found (important for implementation):**
1. `K̄_CT,i+ = K_CT,i+ · l` is dimensionally N/mm² (because `K+` is N/mm³); the dimensionally consistent form is `K_CT,i+ · (w·l)` [N/mm], and `(w·l)` is the natural CT interface area given the explicit CS area `w·l/2`. Either `w` or the whole area factor appears to be missing in the published expression. **Marked unverified.**
2. Eq. 18 as printed returns a *compliance* (dimension mm/N) when the bracketed compliances are substituted, not a stiffness; `K_total = denominator/numerator` behaves as a stiffness. **Marked unverified.**
3. `A` in Eq. 1 is not defined beyond "cross-sectional area of the platelet".
4. `L` in Eq. 13/19 is verbal (§9.2).

**Our reconstruction test (D, arithmetic only):** we substituted Table S2 values and the published normalisations into Eq. 16/19 to try to reproduce Table S5's serial-chain mean. Matching the published 294 MPa requires a CT area factor of ≈0.4·w·l (0.41 if the Weibull *scale* is used as the traction, 0.44 if the Weibull *mean* is used); with that factor the series model then predicts CV(E_eff) ≈ 1.5 % (low-variability input) and ≈ 4.0 % (high-variability input), against the published 1 % and 2 %. Inverting the argument, matching the published 1 % CV instead would require a much softer CT interface and would drop the mean to ≈199 MPa.  **No single area factor reproduces both the mean and the CV of Table S5.** This is the decisive reason not to treat Eqs. 16–19 as an absolute calculator (see §10).

---

## 4. Measured vs modelled evidence (every number flagged)

| # | Quantity | Value | Status | n | Locator |
|---|---|---|---|---|---|
| 1 | rHDPE tangent modulus, feedstock | **1350 ± 239 MPa**, CV 18 % (exact 17.70 %) | **experiment** | 50 specimens / 10 plates (5 per plate), ASTM D638-I, tangent at 500 N | Methods, "Characterization of Platelet and Interface Properties" |
| 2 | Feedstock strength / elongation | not measured in this paper (cites Eriksen: 22–50 MPa, 11–18 %) | literature, not measured here | — | Introduction |
| 3 | Lap-shear interface | `τ_max,CS = 0.25 MPa`, Weibull m = 7.00, s = 0.20 MPa; `δ_e,CS = 0.80 mm`; `δ_cr,CS = N(1.20, 0.18²)` mm | **experiment** (fitted) | 5 specimens, ASTM D3163, 20×20 mm bond | Methods, same section |
| 4 | Composite `E_eff` CV | **4 %** measured vs 3 % modelled, from 18 % feedstock ⇒ **78 % reduction** | **experiment (n = 5)** + model | 5 specimens, {8,5} | Results, "Model–Experiment Comparison"; Fig. 5 |
| 5 | Composite `E_eff` mean | **not reported numerically anywhere** — only "matched … within an 8 % deficit" | — | — | same; our digitization §8 |
| 6 | Composite `σ_max` | **0.22 MPa**, CV 13 % measured (model CV 11 %); "2 times higher than that of the weakest element" (SD ≈ 0.029 MPa by D) | experiment + model | 5 | same |
| 7 | Composite `ε_max` | not reportable (model overestimates at excessive damage) | — | — | same + Discussion |
| 8 | Film-case `E_eff` | **554 ± 10 MPa** (CV 2 %) | **model only** (200 sims) | 0 tested films | Results, Case Study; Fig. 6B |
| 9 | Film-case `ε_W` | **0.10 ± 0.01** (CV ratio 0.32 vs `CV_total` ⇒ 68 % reduction) | **model only** | 0 tested films | same; Fig. 6C |
| 10 | Film-case "total introduced variability" | ≈ **26 %** (Eq. 15) | **model assumption**; term-by-term decomposition not published | — | Results, Case Study |
| 11 | Film-case volume fraction | 82.4 % | model geometry | — | Results, Case Study |
| 12 | Film-case "93 % reduction" | `1 − 2 %/26 % = 92.3 %` (93.1 % if the unrounded 1.8 % is used) | **derived from model numbers** | — | our arithmetic (D) |

**Sample-size summary:** feedstock 50; lap-shear 5; composite tensile 5; film case 0 physical specimens (200 model realisations); limit cases 10⁶ model runs. Every suppression claim about a *product* is simulation-only.

---

## 5. The {8,7} stretch-film case — what it is and what it is not

- **No film was made or tested.** The entire case study is a 200-realisation Monte Carlo of the {8,7} network. The abstract's "reduced … by up to 93 %" and the Significance's "over 90 %" are model outputs.
- **Interfaces were tuned, not measured.** The text says `σ_max,CT, τ_max,CS, δ_cr,CT, δ_cr,CS` "were tuned so that the composite's predicted stress–strain curve matched the target behavior". Table S4 gives `W(7.00, 8.00)` for both traction families — a Weibull scale of **8.00 MPa**, i.e. a mean traction of ≈7.48 MPa (D, `s·Γ(1+1/7)`), **≈40–50× the measured PDMS/rHDPE traction** (Table S3: mean ≈0.14–0.19 MPa). AnyRB must not present these as material data.
- **The 26 % denominator.** `CV_total = √(Σ CV_i²)` is stated to give ≈26 %, but the term-by-term decomposition is not published. Our check (D): the four interface sources alone give `√(2·16.8 %² + 2·10 %²) = 27.7 %` (Weibull m = 7 ⇒ CV = 16.8 %; δ_cr CV = 10 % as stated in the Case Study); adding `E_hard`'s 17.70 % gives 32.8 %. The published 26 % is closest to an interface-only RSS but is **not exactly reproducible** from the stated parameters.
- **What it does demonstrate:** the *method* (MC over constituent distributions + network mechanics + CV metrics) and a design direction. **What it does not demonstrate:** any measured property of any product, any structural part, or a transferable set of interface parameters.

---

## 6. What the paper does not cover

| Class | Covered? | Evidence / implication |
|---|---|---|
| Structural products (brackets, beams, plates in bending/compression/buckling) | **No** | Only uniaxial tension on a 195×53 mm coupon; no bending, shear, compression, buckling, joints, fasteners. The measured composite strength (0.22 MPa) is 100–230× below rHDPE bulk strength and far below structural stress levels. |
| Sheet acoustics / sound insulation | **No** | No acoustic, damping, impedance or transmission measurement or model anywhere in the paper. |
| Counterweights / mass properties | **No** | No density measured (PDMS density not given); volume fraction only; no stability/mass calculations. |
| Other polymers (rPET, rPP, rPETG, mixed polyolefins) | **No** | Experiments: rHDPE only. Framework is claimed "chemistry-agnostic" but only one polymer/adhesive pair was measured. |
| Printed / AM parts | **No** | Mould-assisted manual assembly of waterjet-cut platelets + cast PDMS; no FFF/SLA, no layer adhesion, no anisotropy. |
| Long-term/environmental performance | **No** | No UV, moisture, thermal cycling, creep or fatigue tests; ageing is only cited from literature. |
| 3-D geometry | **No** | 2-D network with horizontal DOFs only. |
| Scale-up | **No** | 5 lab coupons; no process, cost or tolerance study. |
| Model code / raw data | **No** | "All study data are included in the article and/or supporting information" — no repository, no code. |

---

## 7. Numbers that moved — internal inconsistencies found in the primary source

These are reported so that AnyRB never has to silently choose one value; they are not claims that the science is wrong, only that the published record is not internally reproducible in these places.

| # | Item | Conflict | Status |
|---|---|---|---|
| 1 | Feedstock CV | "CV of 18 %" vs 239/1350 = 17.70 % | rounding (18 % is fine; use 17.7 % when precise) |
| 2 | Composite `ε_W` variability | "0.10 ± 0.01" (CV 10 %) vs "CV ratio 0.32" × 26 % = 8.3 % | unresolved |
| 3 | Tensile crosshead speed | Methods: **15 mm/min**; SI Fig. S8 caption: **5 mm/min** | unresolved |
| 4 | Lap-shear rate and machine | Methods: **3 mm/min**, Instron 68SC-1; SI Fig. S9: **1 mm/min**, Instron 3365 | unresolved |
| 5 | PDMS cure | Methods: **60 °C for 24 h**; SI Fig. S9: "curing for **8 h**" | unresolved |
| 6 | Which element family owns `δ_e = 0.80`, `δ_cr = N(1.20, 0.18²)` | Methods assigns them to **CS**; Table S3 assigns them to **CT** (CS gets 0.40 and N(0.80, 0.12²)) | unresolved — Table S3 is the only complete parameter set, so any implementation must choose and say so |
| 7 | Measured `τ_max,CS` vs Table S3 | Methods: "0.25 MPa, m = 7.00, s = 0.20 MPa"; Table S3 CS scale 0.20 MPa ⇒ mean 0.19 MPa (D) | the 0.25 MPa is the measured peak mean; the Weibull fit's mean is lower |
| 8 | Literature `E_hard` | Methods: literature mean 1213 MPa **SD 654 MPa (n = 40)** but "we set σ = 200 MPa corresponding to CV 16 %" | the 654 MPa (CV 54 %) is not used; validation runs at a reduced CV — state this if citing Table S5 |
| 9 | Validation specimen extent | `{L,H,W} = {152.5, 32.5, 10}` mm with `l = 15, h = 6, N = 10, M = 5` ⇒ `N·l + (N−1)·t_CT = 152.25` mm (with t_CT = 0.25) and `M·h + (M−1)·t_CS = 32` mm (with t_CS = 0.5) — both within 0.5 mm of the stated 152.5 × 32.5 mm | broadly consistent; `L` in Eq. 13 still verbal |
| 10 | Monte Carlo count | Main text: **200** simulations selected; SI Fig. S2: "10² samples … sufficiently converged" | use 200 (as used) and cite convergence ~100 |
| 11 | Convergence/Table S5 "low vs high variability" | Table S5 shows the *same* material `std = 200`, CV 16 % in both cases, while Fig. S7 defines low as `E_hard = 1213 ± 75 MPa` and high as ±200 MPa | unresolved |
| 12 | Design rule vs table ratios | Discussion: `K_CT+` "1.5 to 2 times larger than `K_CS+`"; Table S3 gives `K_CT+/K_CS+ = (0.15/0.80)/(0.20/0.40) = 0.375`; Table S4 gives `(8.00/0.15)/(8.00/1.40) = 9.3` (D) | unresolved; also "an order of magnitude lower than `E_hard`" compares K (MPa/mm) with E (MPa) — dimensionally inconsistent |
| 13 | Case-study interface level | Table S4 Weibull scale 8.00 MPa vs Table S3 0.20 MPa ⇒ ≈40× (D) | "tuned", not measured — no reconciliation given |
| 14 | Volume fractions | 70.7 % ({8,5}) vs our unit-cell reconstruction ≈68 %; 82.4 % ({8,7}) vs ≈75–78 % (D) | reference volume not defined |
| 15 | Abstract denominator | Abstract says "compared to input rHDPE"; the 93 % uses the modelled 26 % `CV_total`, not the measured 17.7 % | ambiguity survives in the abstract; always state the denominator |
| 16 | Composite `E_eff` mean | never stated numerically (see §8) | missing, not conflicting |
| 17 | Eq. 16/18 forms | §3.5 items 1–2 | typographic/dimensional |
| 18 | PDMS bulk properties | not stated anywhere | missing |

---

## 8. (a) Is the measured composite `E_eff` mean stated anywhere? — **No.**

**Checked:** main text (Results, Methods, Discussion, abstract, significance), SI text, Tables S1–S5, figure captions, back matter. The only statements are relational: "The mean value of the experimentally observed `E_eff` matched the corresponding simulated mean value **within an 8 % deficit**" (Results, "Model–Experiment Comparison") and "CV of the fabricated specimens' `E_eff` (0.005 strain point), was reduced to **4 %**" — a CV, not a mean. No table or annotation prints the mean. **Therefore AnyRB must not carry a measured composite `E_eff` mean.**

**Transparent digitization of Fig. 5 (approximate; NOT a reported value).** Because the Lead asked for it and it can be done transparently, we digitized the initial slope of the stress–strain plot in Fig. 5 (left panel; the only measured `E_eff` evidence in the paper).

- Image: `pnas.2502613122fig05.jpg` from the PMC CDN (764 × 333 px, JPEG). Left panel plot box: rows 13–14 (top) to 281–282 (bottom), columns 62–63 (left) to 464 (right).
- Axis calibration from label-text centres (not from box edges — the right edge extends past the last labelled tick): x labels 0.01…0.05 centre at columns 128, 195, 261.5, 328, 394 ⇒ **66.5 px per 0.01 strain**, `strain = (col − 61.5)·0.01/66.5`; y labels 0.0…0.4 centre at rows 280, 213, 146.5, 79.5, 12.5 ⇒ **268 px per 0.4 MPa**, `stress = (281 − row)·0.4/268`. Calibration sensitivity: ±1 px in origin ⇒ ∓1.5 % on slope; ±0.5 px vertical ⇒ ±0.2 %.
- Curve masks: experiment = blue, sampled colour ≈ (85, 170, 225) ± 30; model = near-black. The experiment traces form a band ~7–10 px thick (six curves + JPEG smear); the black model line is partly overdrawn, so only the experiment band can be traced robustly.
- Fit: per-column band centre (median band thickness 7 px) for `strain ∈ [0.0015, 0.0075]`, slope through the origin. Window sensitivity: 16.45–16.65 MPa across three fit windows; per-column slope median 16.67 MPa, p10–p90 16.30–17.08, sd 0.31 MPa; residual RMS ≈ 0.0011 MPa (R² ≈ 0.998).
- **Result: initial-slope estimate `E_eff ≈ 16.5 MPa` (per-column 16.3–17.1 MPa; calibration adds ±1.5 %, so treat as ±10 % overall).** As a fraction of the feedstock: **≈1.2 % of `E_hard`**. A secant to the visible bend/damage onset (strain ≈0.012–0.02, stress ≈0.17–0.25 MPa) gives ≈13–17 MPa, i.e. the same order.
- **Status: figure-derived estimate (grade D), approximate, not a published number.** Reasons it cannot be treated as a baseline: axis reading from a 764-px JPEG; six overlapping traces; the paper's `E_eff` (Eq. 13) is a secant at damage onset, not necessarily the initial tangent; no error bars or annotations. AnyRB should use it at most as a **sanity band (~10–20 MPa)** and must never label it "measured".

**Consequence for the product:** the paper cannot supply an absolute measured mean for the {8,5} composite. Any absolute calculation must therefore either (i) be labelled a model reconstruction, or (ii) be anchored to a **user-supplied measured baseline** for the user's own product (§10).

---

## 9. (b) K definitions/areas and whether Eq. 16 or Eq. 18 applies to {8,5}

### 9.1 Exact definitions as published

| Quantity | Published definition | Units if `K+` = traction/separation | Comment |
|---|---|---|---|
| `K_HARD,i` | Eq. 1: `σ_Hard = (E_hard·A/l)·δ`; Methods: `K̄_HARD,i = E_HARD,i·(w·h/l)` | MPa·mm²/mm = **N/mm** | uses area `w·h`, length `l`. `A` itself is undefined in text; `w·h` is the natural reading and is what the Methods normalization uses. |
| `K_CT,i+` | Eq. 5: `K_CT+ = σ_CT/δ_e,CT` | MPa/mm = **N/mm³** | traction–separation stiffness, not a force/displacement stiffness |
| `K_CS,i+` | Eq. 6: `K_CS+ = τ_CS/δ_e,CS` | **N/mm³** | same |
| `K̄_CT,i+` | Methods: printed as `K_CT,i+ · l` | N/mm² if taken literally | **dimensionally inconsistent**; consistent form needs area `w·l` (or `w·l/2`), which the printed expression appears to omit |
| `K̄_CS,i+` | Methods: `K_CS,i+ · (w·l/2)` (MathML explicit: fraction `wl/2`) | **N/mm** | consistent; CS area = half the platelet-side area `w·l` |
| `C̄_HARD,i`, `C̄_CS,i` | `1/K̄_HARD,i`, `1/K̄_CS,i+` | mm/N | compliances |

**Interface areas implied by the published normalisations:** CT: `w·l` (inferred); CS: `w·l/2` (explicit). Hard element: cross-section `w·h`, length `l`. Because the CT expression is the only one that is not dimensionally closed, **the CT area factor is the one free choice in any reimplementation** — and it materially changes both the predicted mean and CV (§3.5).

### 9.2 Which closed form applies to {8,5}?

- **Eq. 16 is the serial-chain limit** (`{N,1}`: hard + CT only, single layer). It is a *lower bound* on stiffness for any network with additional shear paths, and it is the exact formula for the `{5,1}` validation case — **not** for {8,5}.
- **Eq. 18 is the alternating-column limit** (`{1,5}`, five layers, hard + CS only). It is exact only for the `{1,5}` validation case; the paper introduces it as "for a network consisting of five layers". {8,5} happens to have `M = 5`, but with `N = 8` its connectivity is far richer (35 CT + 60 CS elements, not 0 + 4), so Eq. 18 is **not** the {8,5} formula.
- **Neither closed form is the {8,5} model.** The paper's {8,5} result comes from the full 135-element network solved by Newton iteration; the closed forms are used only to validate the model in limiting cases (SI Figs S5–S7; Table S5).
- `L` in Eq. 13/19 remains verbal. For the validation coupon a consistent reading is `L = N·l + (N−1)·t` (= 152.25 mm for {10,5} with t_CT = 0.25 mm), close to the stated 152.5 mm; for the {8,5} coupon it gives 181 mm against a stated 195 mm overall length. **Any implementation must state its `L` convention.**

**Recommendation:** for {8,5}, implement the full spring network (135 elements / 80 DOFs is trivial in JS or Python) and use Eqs. 16 and 18 only as bracketing checks. The paper itself provides the acceptance targets: Table S5 (SI p. 17) gives analytical-vs-model agreement for the serial and alternating-column limits — means 294/294 and 201/201 MPa, CVs 1 %/1 % and 2 %/2 % (low-variability), 292/292 and 199/199, 2 %/2 % and 5 %/4 % (high-variability).

---

## 10. (c) Proposed reduced calculation for AnyRB, and what must be blocked

### 10.1 Design principle: two modes, never mixed

1. **Relative (variance) mode — defensible from the paper.** The paper's transferable result is a *ratio*: a two-phase architectured composite can reduce the CV of the effective modulus by a factor that depends on how much compliance the variable phase carries, and the network converts worst-link behaviour into a narrower distribution. AnyRB can compute a **simulated CV ratio** for a user-declared composite, with no absolute claim.
2. **Absolute (mean) mode — requires a measured baseline.** Because (i) the paper reports no measured composite `E_eff` mean, (ii) the closed forms are not uniquely instantiable (§3.5), and (iii) the film case used tuned interfaces (§5), AnyRB may only produce an absolute value if the user supplies **their own measured baseline** (`E_eff` for their product/architecture), or if the number is explicitly labelled "model reconstruction with stated assumptions".

### 10.2 Inputs AnyRB may ask for (all user-supplied or literature-distribution, never invented)

| Input | Required? | Why / source shape |
|---|---|---|
| Product class + loading mode | required | the reduced model is valid for **uniaxial tension of a platelet network** only; anything else is blocked (bending, compression, acoustics, mass/counterweight) |
| Second (soft) phase present? interface type | required | no second phase ⇒ block: the paper's mechanism is a two-phase composite |
| `E_hard` distribution: mean, SD, n, test method, lot scope | required | paper uses `N(1350, 239²)` measured with 50 ASTM D638-I specimens; user values replace these |
| `σ_max,CT` Weibull `(m, s)`; `τ_max,CS` Weibull `(m, s)` | required | paper: `W(7.00, 0.15)` and `W(7.00, 0.20)` MPa for the measured coupon (Table S3). If user has no lap-shear data ⇒ block (paper's own caution: interface CV >25 % breaks the mechanism; <10 % ideal) |
| `δ_e,CT`, `δ_e,CS`, `δ_cr` distributions | required | Table S3 values; must also state which family owns `δ_e = 0.80`/`δ_cr = N(1.20,0.18²)` because the paper conflicts (§7-6) |
| Geometry: `l, h, w, t, N, M` | required | Table S3 pattern; `t` per family if known, else one value with a flag |
| Realisations, seed, `L` convention | required (config) | 200 realisations (paper); ~100 suffices per SI Fig. S2; `L = N·l+(N−1)·t` must be declared |
| Measured baseline `E_eff` (mean, n, method) for absolute mode | **required for absolute outputs** | paper has none (§8) |

### 10.3 Outputs (each with a mandatory label)

| Output | Mode | Label |
|---|---|---|
| Simulated `CV(E_eff)` and `CV(σ_max)` | relative | "simulated, model reconstruction — not measured" |
| `CV ratio = CV(E_eff)/CV_total` and "variability reduction %" | relative | must print the denominator (`CV_total` = RSS of the inputs actually used) |
| Sensitivity: fractional compliance carried by the variable phase; `E_eff` vs `E_hard` log-sensitivity | relative | the honest mechanism statement (why suppression scales with the interface compliance) |
| `E_eff` mean (absolute) | absolute | only with user baseline; otherwise blank |
| `σ_max` absolute | absolute | only with user baseline; otherwise blank |
| `ε_W` / `ε_max` | not offered | the paper explicitly cannot predict `ε_max`; `ε_W` is a model-validity strain, not a product limit |
| Element/dof counts, `N_CT`, `N_CS`, `V_plat/V_total` | computed | check values against Table S3/S4 as a sanity gate |

### 10.4 Hard gates (block, never estimate)

1. **No interface measurement** (no lap-shear or equivalent for the user's pair) → block all outputs; the paper's interface parameters are specific to rHDPE/PDMS and the film case used tuned values ~40× higher.
2. **No `E_hard` distribution** → block; a point mean cannot produce a variability statement.
3. **No second phase** → block "nacre/brick-and-mortar" mode; do not substitute a lattice.
4. **Product class outside uniaxial tension** (structural bracket, plate bending, sound sheet, counterweight) → block: the paper measured none of these (§6). For a bracket, the measured composite's 0.22 MPa strength is 1–2 orders of magnitude below structural demand.
5. **Absolute mean requested without a measured baseline** → block; return relative calculation or ask for a baseline (the paper's own measured mean is not published — §8).
6. **`CV` of interface > 25 %** → warn/soft-block with the paper's own statement that homogenisation breaks down (Discussion).
7. **No measured link for the user's result** → keep the AnyRB v0.5 record rule: result stays blank and the record names the test still needed.

### 10.5 Suggested validation of any implementation (so the app can defend itself)

Reproduce, in order: (i) element counts (135/80 for {8,5}); (ii) the serial and alternating-column limit cases against **Table S5** (means 294/201 MPa, CVs 1–2 % at 16 % input CV) — calibrate the CT area factor there; (iii) the reported measured CV reduction (18 % → 4 %) and σ_max CV (13 %) as order-of-magnitude checks; (iv) the digitized Fig. 5 initial slope (~16.5 MPa, §8) only as a sanity band. If (ii) cannot be matched within tolerance, the absolute mode stays blocked and only relative mode ships.

---

## 11. Corrections to what the repo currently says (for the Lead / dossier files)

These are small but worth fixing in `research/02-design-for-variability.md` §2, `research/refs/refs-02.json` (R01), and `REPORT.md`:

1. **"the composite's effective modulus is 41 % of the platelet modulus (554 vs 1 350 MPa)"** — 554 MPa is the **{8,7} stretch-film simulation**, not the fabricated {8,5} composite. The fabricated composite's `E_eff` mean is not published; our digitization gives ≈16.5 MPa ≈ 1.2 % of `E_hard` (approximate). Fix the sentence to name the {8,7} model case, or drop it.
2. **"Measured CV 18 % → 4 %"** — correct, but state n: 50 feedstock specimens, 5 composite specimens, one batch, and that the 4 % is the CV of `E_eff` evaluated at 0.005 strain.
3. **Feedstock CV**: use 17.70 % when precise; "18 %" is the paper's rounding (239/1350).
4. **"93 %" denominator**: 2 %/26 % = 92.3 % (93.1 % with the unrounded 1.8 %). The Discussion's "compared to the input rHDPE properties" is the ambiguity; always write "93 % relative to a modelled 26 % `CV_total`".
5. **`ε_W` variability**: the paper gives both "0.10 ± 0.01" (CV 10 %) and "CV ratio 0.32" ⇒ 8.3 %; quote the range, not a single number.
6. **`refs-02.json` R01 locator** should be extended to: "SI Appendix Tables S2–S4 (pp. 14–16); Table S5 (p. 17); SI Fig. S2 (p. 3); Methods 'Characterization…' and 'Examination of UATSC Model Performance…'; PMID 40794839; CC BY 4.0", plus the fact that no code/data were released.
7. **Design rule** "`K_CT+` ≈ 1.5–2× `K_CS+`" — the tabulated parameter ratios do not satisfy it (Table S3: 0.375; Table S4: 9.3). If the rule is quoted, say it is a *design guideline in normalised stiffness*, not a property of the tables.

---

## 12. Locators and reproducibility pack

- Main text: PMC12377729 → Results ("UATSC Network Model"; "Platelet and Interfacial Mechanical Property Variability"; "Model–Experiment Comparison"; "Case Study…"); Discussion; Methods ("Examination of UATSC Model Performance in Limiting Cases and Model Validation"; "Characterization of Platelet and Interface Properties"; "Fabrication and Testing of Bio-Inspired Composite Structure"); Back matter ("Data, Materials, and Software Availability: All study data are included in the article and/or supporting information").
- SI Appendix PDF (20 pp.): p. 3 Fig. S2 (convergence); p. 6 Fig. S5 (Y–Δ transformations); p. 8 Fig. S7 (low/high `E_hard` variability: ±75 / ±200 MPa, deterministic interfaces); p. 12–13 Table S1; **p. 14 Table S2; p. 15 Table S3; p. 16 Table S4; p. 17 Table S5**; p. 19–20 SI references.
- Figures used: `pnas.2502613122fig05.jpg` (PMC CDN blob `1613/12377729/9974859d53f8/…`, 764×333) and `fig06.jpg` (`e020c38854bb`).
- Access route used: Europe PMC REST (`/PMC12377729/fullTextXML`; `/PMC12377729/supplementaryFiles` → complete SI PDF extracted from the streamed ZIP). The PMC direct-download pages are behind a proof-of-work gate for scripted clients.
- Everything marked **(D)** is our own arithmetic from the published numbers, reproducible from the formulae given in this note; it is not a published value and must not be cited as one.

**One-line bottom line:** the paper gives exact geometry and equations, a measured CV reduction of 18 % → 4 % (n = 5) and a measured strength of 0.22 MPa, but **no measured `E_eff` mean, no code, and a stretch-film headline that is simulation-only with tuned interfaces** — so AnyRB should ship a *relative* (CV-ratio) calculation, gate every absolute number behind a user-supplied measured baseline, and never attach the 93 % to any other product.

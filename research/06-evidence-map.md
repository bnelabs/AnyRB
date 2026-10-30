# 06 — Evidence map: recycled-plastic input → finished-product result

**Status:** v0.6 evidence map, 2026-10-30. **Read this before relying on any calculation in the app.**
**Purpose:** state exactly which links between a recycled-plastic input and a finished-product result are
**measured on that product class**, which are **model only**, and which are **absent**. A literature mean,
an assumed coefficient of variation, a new model, or the bracket solver is not a measured link.

**Sources read for this map:**

- Existing dossiers `research/00–05`, `data/feedstock_library.json`, `research/refs/refs-01…05.json`.
- Georgiou, D., Sun, D., Liu, X. & Athanasiou, C. E. (2025). *Suppressing mechanical property variability
  in recycled plastics via bioinspired design.* PNAS 122(33):e2502613122.
  DOI [10.1073/pnas.2502613122](https://doi.org/10.1073/pnas.2502613122), PMID
  [40794839](https://pubmed.ncbi.nlm.nih.gov/40794839/), PMC
  [PMC12377729](https://pmc.ncbi.nlm.nih.gov/articles/PMC12377729/), including the SI Appendix
  (`pnas.2502613122.sapp.pdf`, Tables S2–S5).
- Primary product-class papers found in the new search: Oliveros-Gaviria et al. 2024 (WPC profile,
  [10.3390/polym16223136](https://doi.org/10.3390/polym16223136)); Bal 2022 (WPC boards,
  [10.15376/biores.17.4.6569-6577](https://doi.org/10.15376/biores.17.4.6569-6577)); Alrubaie,
  Lopez-Anido & Gardner 2020 (full-size recycled-HDPE lumber,
  [10.3390/polym12020262](https://doi.org/10.3390/polym12020262)).
- Supporting primary coupon evidence, used only to show why it is *not* a product link: Eriksen et al.
  2019 ([10.1016/j.wasman.2019.07.005](https://doi.org/10.1016/j.wasman.2019.07.005)); Hinczica et al.
  2026 ([10.1002/app.70501](https://doi.org/10.1002/app.70501)); Cecon et al. 2023
  ([10.1016/j.wasman.2023.09.002](https://doi.org/10.1016/j.wasman.2023.09.002)); minor-contamination
  coupon study 2024 ([10.3390/polym16162301](https://doi.org/10.3390/polym16162301)).

**Full search notes:** [`06b-primary-links.md`](06b-primary-links.md). **App data:**
[`../history/v0.6-app/evidence.js`](../history/v0.6-app/evidence.js) (only the rows the app may use are encoded there).

---

## 1. The three grades, exactly

| Grade | Meaning | What the app may do |
|---|---|---|
| **measured_on_product_class** | A physical test of the **same product class and result** exists, and the input was varied across states. The paper reports the number that moved. | May be cited in the UI. A calculation is allowed only if the app also has the row-specific required input, and it is labelled simulation unless the test was of the user's same product. |
| **model_only** | The result is predicted or fitted; no physical test of that product/result is reported. | Cite only as a model. Never fill a measured result. |
| **absent** | No qualifying primary study found for that product class/result/input. | Leave the result blank. Name the test. Do not import a coupon, literature mean or another product's number. |

**A product-class measurement is not automatically a batch link.** Rows 3–5 below are real product-class
measurements, but the input that varied was **formulation, filler, ageing or product type** — not a
delivered recyclate lot/batch. They can inform test design and effect size, but they cannot populate the
v0.5 open record's "measured link" for a varying batch.

**The headline search result:** no primary paper found in this search measures a **finished-product-class
result against a varying recyclate lot/batch**, and reports the product-level result distribution. The
closest product-class evidence varies formulation/filler. The v0.5 rule — no same-product measured link
means the result stays blank — is therefore the scientifically correct default.

---

## 2. Measured on that product class

### Row 1 — PNAS 2025, `{8,5}` rHDPE-platelet / PDMS matrix composite (modulus)

| Field | Record |
|---|---|
| Product class | Nacre-inspired brick-and-mortar composite: stiff rHDPE platelets in a soft PDMS matrix, fabricated `{N=8, M=5}` tensile specimen, 195 × 53 mm, platelet volume fraction 70.7 % |
| Result | Effective tensile modulus, `E_eff`; its specimen-to-specimen CV |
| Input that varied | rHDPE platelet modulus `E_hard`: 50 ASTM D638-I specimens cut from **10 plates**; measured mean 1,350 MPa, SD 239 MPa, CV 17.7 % |
| What was physically measured | Quasi-static uniaxial tension of the fabricated composite; `E_eff` from the initial linear stress–strain slope (0.005 strain point for CV). Feedstock modulus from tensile tests; interface parameters from lap-shear tests (PDMS/rHDPE, ASTM D3163) |
| Sample size | Composite **n = 5** specimens. Feedstock **n = 50** specimens from 10 plates; interface n = 5 per plate (per Methods) |
| Number that moved | Input platelet CV **18 %** → measured composite `E_eff` CV **4 %**; the paper's UATSC model predicted **3 %** for the same `{8,5}` case. The paper reports the measured mean as matching the simulated mean within an 8 % deficit, but does **not** tabulate the measured `E_eff` mean in the main text; Fig. 5's initial slope is approximately **16.5 MPa** (digitised; a 10–20 MPa sanity band, not a tabulated mean; do not treat it as measured). Strength: measured σmax mean **0.22 MPa**, CV **13 %**; model 11 %. |
| Experiment or model | **Experiment** for the input distribution (50 specimens/10 plates), the `{8,5}` composite modulus CV (n=5), and strength. The paper's `{8,5}` simulation is a model prediction (CV 3 %). |
| What the paper does not cover | Structural products, sheet acoustics, counterweights, other polymers, other architectures as measured results; batch/lot variation of a delivered recyclate stream; full 3-D, large-strain, damage/failure prediction; long-term creep/fatigue; a user's product. The paper's own model is linear-elastic for platelets, small strain, and over-predicts the damage regime. |
| Source | PNAS 2025, DOI 10.1073/pnas.2502613122, PMC12377729; main text “Model–Experiment Comparison”; Fig. 5; SI Tables S2–S5. |

**What the 93 % means — do not copy it.** The paper's **93 %** is from the **stretch-film model case**
`{8,7}`: 200 simulations, input total introduced variability **≈26 %** (RSS of component CVs), output
`E_eff = 554 ± 10 MPa` with CV **2 %**, i.e. `1 − 2/26 ≈ 93 %`. It is **model only**; no stretch film was
fabricated or tested. The measured `{8,5}` result is **18 % → 4 % CV** (a 78 % reduction), not 93 %. Neither
number is a result on the user's batch or product.

**Architecture and interface parameters actually used (SI Tables S2–S4):**

- `{8,5}` measured composite: N=8 platelets/layer, M=5 layers, platelet length l=20 mm, height h=8 mm,
  width w=4.75 mm, thickness t=3 mm; specimen 195 × 53 mm; platelet volume fraction Vpl/Vtotal = 70.7 %.
- Hard phase: `E_hard ~ N(1350, 239²)` MPa (measured rHDPE plates).
- CT interface: `σmax,CT ~ Weibull(7.00, 0.15)`; `δe,CT = 0.80 mm`; `δcr,CT ~ N(1.20, 0.18²) mm`.
- CS interface: `τmax,CS ~ Weibull(7.00, 0.20)`; `δe,CS = 0.40 mm`; `δcr,CS ~ N(0.80, 0.12²) mm`.
- The paper's model uses 200 realisations for the stretch-film case; the measured composite is 5 specimens.

**Calculation status:** this is the **only row in v0.6 for which the app may run a calculation**. It is a
reduced-order case calculation — see §5. The app must require the recyclate stiffness distribution and the
case architecture, must not run if either is missing, and must label every number **simulation** because
the physical test was of the paper's composite, not the user's product.

### Row 2 — WPC extruded profile (rHDPE + sawdust), formulation link

| Field | Record |
|---|---|
| Product class | Extruded wood-plastic composite profile for pergolas/decking-class use (“plastic wood”) |
| Result | Tensile strength, tensile modulus, density, impact, 24 h water absorption |
| Input that varied | Formulation: sawdust 55–70 wt %, rHDPE 25–40 wt %, grafted-PE coupling agent 1–3 %; single recyclate source |
| What was physically measured | ASTM D638 Type IV tensile specimens **machined from the finished extruded profile**; ASTM D570 water absorption; helium pycnometry density; ASTM D1822 impact; ASTM D2240 Shore D |
| Sample size | n = 5 tensile specimens per formulation; 13 design runs + initial formulation |
| Number that moved | Tensile strength **19.37 ± 1.68 → 15.73 ± 1.69 → 12.53 ± 1.88 MPa**; E **1,427.5 ± 127.2 → 2,206.7 ± 304.6 → 1,782.1 ± 119.3 MPa**; density **1.20–1.34 g/cm³**; impact **4.30 ± 0.68 → 8.18 ± 2.25 → 6.46 ± 0.73 kJ/m²**; water absorption **1.83–2.41 %** |
| Experiment or model | Experiment |
| What the paper does not cover | Full-size profile/deck-board flexural or span-load test; **no recyclate batch variation** (one rHDPE source); no lot-to-lot distribution; no sound insulation; no counterweight |
| Grade | **measured_on_product_class** — but **formulation link, not a batch link** |
| Source | Oliveros-Gaviria et al., *Polymers* 2024, 16(22):3136. DOI 10.3390/polym16223136, §3.1, Tables 9–13. |

**App use:** cite as product-class evidence; do **not** use it to fill a batch-varying record. No calculation
in v0.6.

### Row 3 — WPC boards (recycled PE + Tetra Pak + pine wood flour), formulation link

| Field | Record |
|---|---|
| Product class | Extruded/flat-pressed WPC boards for decking-timber/outdoor-parquet use; 4 × 180 × 220 mm |
| Result | Flexural strength and modulus, tensile strength/modulus, elongation at break, density, Shore D |
| Input that varied | Filler type/ratio: Tetra Pak box vs pine wood flour at 0/10/20/30/40 % in a recycled-PE matrix; 6 groups |
| What was physically measured | ASTM D790 3-point bending on specimens from actual boards; ASTM D638 Type I tensile; ASTM D2240; density |
| Sample size | 4 boards/group, 4 specimens/board/test = **16 specimens per test**, 24 boards |
| Number that moved | Density **942–1,017 kg/m³**; flexural strength **13.5–19.8 MPa**; flexural modulus up to **999 MPa**; tensile strength and elongation decrease with wood-flour content; Shore D 51.3–57.4 |
| Experiment or model | Experiment |
| What the paper does not cover | Full-size deck-board span/load test; **one recycled-PE source, no batch variation**; flat-pressed boards, not extruded deck profiles; no acoustic result; no counterweight |
| Grade | **measured_on_product_class** — formulation link, not a batch link |
| Source | Bal, *BioResources* 2022, 17(4):6569–6577. DOI 10.15376/biores.17.4.6569-6577, Experimental, Tables 2–4. |

**App use:** cite; do not fill a batch-varying record. No calculation in v0.6.

### Row 4 — Full-size commercial recycled-HDPE lumber, product test

| Field | Record |
|---|---|
| Product class | Full-size recycled-HDPE plastic lumber, 140 × 38 mm |
| Result | Flexural modulus, flexural strength, 180-day flexural creep deflection |
| Input that varied | Product formulation/type: recycled-HDPE lumber vs WPC lumber. **Not a recyclate batch or mix.** |
| What was physically measured | ASTM D6109 4-point bending, L=620/545 mm (L/h≈20/22); 180-day flexural creep at 7.5/15/30 % Fb; ASTM D6815 fractional-deflection criterion |
| Sample size | n = 5 per group; 30 specimens total; 5 per creep stress group |
| Number that moved | HDPE lumber **E = 0.93 ± 0.03 GPa, Fb = 14.1 ± 0.70 MPa**; WPC lumber E = 4.34 ± 0.26 GPa, Fb = 41.2 ± 4.53 MPa; 180-day fractional deflection **2.71/3.88/5.11** (HDPE) vs 1.22/1.33/1.28 (WPC) at 7.5/15/30 % Fb |
| Experiment or model | Experiment for E, Fb and 180-day deflection. The 1.5-year / 150-year creep-life extrapolations are **model only**. |
| What the paper does not cover | No variation of recyclate source/batch within the HDPE lumber; one commercial product; no sound insulation, no counterweight; no user product |
| Grade | **measured_on_product_class** — but the input varied is product type, not recyclate; not a batch link |
| Source | Alrubaie, Lopez-Anido & Gardner, *Polymers* 2020, 12(2):262. DOI 10.3390/polym12020262, Table 1, Tables 2–3, §3.3. |

**App use:** cite as product-class evidence; no calculation in v0.6.

---

## 3. Model only

### Row 5 — PNAS 2025 stretch-film case `{8,7}` (modulus and permissible strain)

| Field | Record |
|---|---|
| Product class | Industrial HDPE stretch film, modelled brick-and-mortar `{8,7}` architecture; no film was fabricated or tested |
| Result | `E_eff` and maximum permissible strain `ε_W` distributions |
| Input that varied | Modelled constituent distributions: `E_hard ~ N(1350, 239²)` MPa; interface Weibull/normal assumptions; total introduced variability ≈ **26 %** (RSS); `Vpl/Vtotal = 82.4 %` |
| What was physically measured | Nothing on a stretch film. The input rHDPE distribution comes from the measured feedstock (50 specimens/10 plates); interface parameters are calibrated assumptions; 200 simulations |
| Sample size | 200 simulations; no film specimens |
| Number that moved | `E_eff = 554 ± 10 MPa`, CV **2 %**; `ε_W = 0.10 ± 0.01`, CV ratio 0.32; `1 − 2/26 ≈ 93 %` modulus-variability reduction vs 26 % total introduced; ≥68 % `ε_W` reduction |
| Experiment or model | **Model only** |
| What the paper does not cover | No tested stretch film; no product measurement; no user product; no structural/sheet product class; no acoustic result; no counterweight |
| Grade | **model_only** |
| Source | PNAS 2025, Case Study; Fig. 6; SI Table S4. |

**App use:** cite only as a model. Never use 554 MPa, 2 %, 93 % or 68 % as a measured result on a user's
product or as a target for another product. Do **not** copy “up to 93 %” to a sheet, counterweight or any
other product.

### Row 6 — Creep-life extrapolation of recycled-HDPE lumber

The 1.5-year and 150-year failure-time statements in the full-size lumber paper are power-law
extrapolations from 180-day data. **Model only.** The measured 180-day deflections are in Row 4.

### Row 7 — Pipe-compound coupon study as a pipe claim

The double-wall corrugated-pipe paper tested injection-moulded coupons of a pipe compound; it did **not**
make or test a pipe. Ring stiffness / pipe impact is **absent**. The paper's “capable of being
commercialized” statement is an inference, not a product measurement.

---

## 4. Absent

| Product class / result | Input | Status | Why |
|---|---|---|---|
| **Counterweight mass** | Recyclate type/batch/mix/contamination | **Absent** | No primary study measures a counterweight product's mass against a varying recyclate input. Mass requires measured density **and** measured volume; the feedstock library's densities are literature stand-ins, not that measurement. No counterweight geometry exists. |
| **Sound insulation / acoustic sheet** | Polymer, batch, mix, filler, contamination | **Absent** | A primary paper exists on recycled EVA/PVC/PS/PP granule mixtures measured in an impedance tube (DOI 10.2478/sjce-2021-0003), but only the abstract was retrievable and the α numbers could not be verified. No transmission-loss (Rw) result was found for a recycled-plastic sheet. A structural model is not an acoustic result. |
| **Finished recycled-plastic pipe ring stiffness** | Recyclate type/batch/mix | **Absent** | Coupon studies only; no ISO 9969 pipe-level test linked to recycled input. |
| **Finished recycled sheet/panel mechanical result vs batch** | Recyclate batch/mix | **Absent** | Only film/coupon studies found; no finished sheet/panel product test vs recyclate. |
| **Any finished product vs a varying recyclate lot/batch** | Recyclate lot/batch | **Absent** | No primary study found. WPC/lumber studies vary formulation, filler, ageing or product type; not lot. |
| **Another plastic / mix / minor contamination → finished product result** | PP, mixed polyolefins, PET/PS/ABS contamination | **Absent at product class** | Coupon-level evidence exists: 10 % PET in PP raised tensile modulus +41.2 % and cut elongation −46.8 %; 10 % ABS/PS with a weld line cut strength −17.5 % and >80 % elongation; even 3 % contamination lowered strength (DOI 10.3390/polym16162301). That is a **material coupon**, not a finished-product result. |
| **Full-size WPC deck-board span/load vs recyclate** | Recyclate batch | **Absent** | Formulation coupons and profile ageing only. |
| **Panel transmission loss (Rw)** | Recyclate/filler | **Absent** | No verified primary data found. |

**Do not route any absent row through the bracket solver, a new 3-D model, or a library density.**

---

## 5. The one allowed calculation: PNAS `{8,5}` reduced case

**Row:** 1. **Product class match:** the user must explicitly select the PNAS `{8,5}` platelet–matrix
composite case. The product name remains free text. **Result match:** the result must be effective modulus
/ stiffness in **MPa** with a numeric target range. No other result kind is accepted.

**Inputs required (all must be present; otherwise no run):**

1. Case architecture: fixed to the paper's measured `{8,5}` parameters:
   `N=8, M=5, l=20 mm, h=8 mm, w=4.75 mm, t=3 mm`, specimen `195 × 53 mm`, `Vpl/Vtotal=70.7 %`;
   CT/CS interface parameters from SI Table S3.
2. Recyclate stiffness distribution, either:
   - the paper's measured rHDPE platelets: mean 1,350 MPa, SD 239 MPa, CV 17.7 %, n=50/10 plates; or
   - a **measured** user distribution: mean > 0 MPa, SD/CV > 0, source named, `n ≥ 3` specimens/lots.
3. **A measured effective-modulus baseline for the actual platelet–matrix product/architecture**: input
   mean at which it was measured, output mean, n ≥ 3, source named. This is required because the paper
   reports no measured absolute `E_eff` mean (only the 18 %→4 % CV ratio).
4. A target modulus range in the matching result.
5. The user's explicit confirmation that the product class is the PNAS platelet–matrix composite kind.

**If a required input is missing:** do not run. Name the test needed (measure the recyclate modulus
distribution on at least 3 specimens/lots with source; measure the composite's effective modulus at a known
recyclate mean, n ≥ 3, source; set the target; select the case). The result stays blank.

**Calculation (reduced-order, transparent, baseline-anchored):**

The paper's measured `{8,5}` result is a **CV reduction from 18 % to 4 %** (n=5 composite; n=50 feedstock).
The paper does **not** tabulate the measured `E_eff` mean. An absolute MPa range therefore cannot be
honestly produced from the paper alone. The app uses the user's measured baseline and a case-scaled
simulation:

```
E_eff_mean = baseline_output_mean * (selected_recyclate_mean / baseline_input_mean)
CV_eff     = selected_recyclate_cv * (0.04 / 0.18)     # measured CV ratio from the {8,5} case
E_eff P5/P95 = normal quantiles from (E_eff_mean, CV_eff)
```

This is deliberately a **case-scaled simulation**, not a prediction of the user's product and not the
paper's full UATSC model. It must be labelled **simulation**; the measured links are the paper's CV ratio
and the user's own baseline, not a physical test of the target build at the target batch.

**Why not use Eq. 16/18 directly?** The paper's full tension-shear-chain network is nonlinear, needs
interface calibration, and its absolute modulus for the fabricated `{8,5}` composite is not tabulated; the
closed forms are limit cases, not the `{8,5}` model. A baseline-anchored case scaling is more honest than
pretending to rerun the paper's model. The app may show the architecture parameters and the measured
18 %→4 % result, but must not report the stretch-film 554 MPa or 93 % as this case.

**Output:** mean, CV, P5–P95 range, target inside/outside, and a **simulation** label. No physical test of
the user's product exists, so the output is not a measured result. The paper citation is not a result on
the user's batch.

**Blocked values:** no counterweight mass, no acoustic insulation, no other plastic/mix/contamination
result, no structural 3-D result, no bracket result.

---

## 6. What the app must never do with this map

1. Treat a citation, literature mean, assumed CV or the bracket solver as a measured link.
2. Copy PNAS 93 % (stretch-film model, denominator 26 %) or 554 MPa (model) onto another product.
3. Report the measured `{8,5}` 18 %→4 % CV as a measured result on the user's batch.
4. Fill counterweight mass from the feedstock library density, or invent a 3-D counterweight.
5. Turn sound insulation into a structural 3-D result.
6. Fill a WPC/lumber result from a formulation study when the user's input is a batch/mix.
7. Use a coupon result as a finished-product result.
8. Run the PNAS calculation without the measured recyclate distribution, target, case selection and
   product-class confirmation.
9. Present the PNAS simulation as a pass/fail seal for an unmeasured product.
10. Present the historical 2-D bracket as proof for any other product.

# Dossier 01 — Recyclate variability: quantified evidence, measurement proxies, and the machine-readable feedstock library

**AnyRB research dossier · owner: researcher-variability · date: 2026-10-29 · status: v1.0**
**Companion files:** `research/refs/refs-01.json` (references, evidence grades, locators, status) · `data/feedstock_library.json` (machine-readable presets, proxy models, gaps).

**How to read this.** Every factual claim ends with `[Rxx]`, resolving in `refs-01.json` (DOI/URL, grade, locator, status). "A" = peer-reviewed quantitative; "B" = peer-reviewed partial/qualitative; "C" = agency/industry/standard. Engineering assumptions are marked **ASSUMPTION** and recorded as `"basis": "assumption"` in the JSON. Nothing here is a measured reliability claim for AnyRB parts.

---

## 0. Executive summary

### 0.1 Recommended AnyRB feedstock presets (v0.1, literature-derived)

| Preset | E mean (MPa) | CV(E) | σ_y mean (MPa) | CV(σ_y) | ε_b mean (%) | CV(ε_b) | ρ (g/cm³) | corr(lnE, lnσ_y) | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| **rPETG** (printed/regrind) | 2,100 | 0.10 | 46 | 0.10 | 4.0 | 0.20 | 1.24 | 0.5* | B [R07] |
| **rPET** (bottle-grade) | 2,500 | 0.12 | 45 | 0.15 | 3.5 | 0.25 | 1.34 | 0.6* | B/C [R01,R04,R08,R22] |
| **rHDPE** (PCR rigid, MRF-mixed) | 950 | 0.22 | 28 | 0.17 | 14 | 0.30 | 0.950 | 0.55* | B [R01,R02,R03,R04] |
| **rPP** (PCR rigid) | 1,100 | 0.18 | 27 | 0.13 | 25 | 0.45 | 0.94 | 0.50* | B [R02,R03,R04,R05,R06] |
| rLDPE (PCR film) | 250 | 0.25 | 10 | 0.20 | 300 | 0.40 | 0.920 | 0.50* | C/D [R01,R04,R33] |
| mixed polyolefins (#3–7) | 800 | 0.30 | 18 | 0.25 | 50 | 0.50 | 0.930 | 0.50* | D [R01,R02,R12,R17] |

\* All correlation coefficients are **ASSUMPTIONS** — no verified recyclate source in this dossier reports an E–σ_y correlation coefficient. See §6.2.

**Recommended lot-vs-within split:** for E and σ_y put **85 % of variance between lots, 15 % within lot** (`cv_lot = 0.92·cv_total`, `cv_within = 0.39·cv_total`); for elongation/impact use **60/40** (specimen scatter is large there: PP impact SD 12–15 on 19–33 kJ/m² [R04]). This replaces the v0.1 split (0.8/0.6 → 64/36), which over-weights within-lot scatter for E/σ_y. Basis: §6.1.

### 0.2 Ten findings that matter for the product

1. **Lot-to-lot spread can break a deterministic design.** rHDPE modulus spans **380–1,250 MPa across three US MRFs** (3.3×) [R02 via R01]; literature-compiled rHDPE modulus is **1,213 ± 654 MPa (n = 40, CV ≈ 54 %)**, while one supplier's stretch-film plates measured **1,350 ± 239 MPa (CV 17.7 %, n = 50 from 10 plates)** [R01]. Between-source heterogeneity dominates, not intrinsic polymer scatter.
2. **Specification compliance does not imply property consistency.** Ten PCR-PP batches sampled over 15 months all met the same MFR (7–13 g/10 min) and density (0.97 ± 0.03 g/cm³) specification, yet **filler content ranged 2–24 wt %, elongation at break ranged 10–100 %, and fatigue life at equal stress ranged 3,000–6.52 million cycles** [R05]. This is the strongest argument that datasheet acceptance is insufficient.
3. **The weakest batches are defined by contamination and degradation, not polymer type.** Streams can contain **up to nine polymers** and elemental impurities at **1–3,000 ppm** [R17]; adding "other PE types" to rPE cut impact resistance **11 %** at the first step [R36]; cross-contamination plus thermo-oxidative history severely degrades HDPE ductility [R19].
4. **Variance decomposition supports a two-level model, but not the v0.1 split.** Specimen-level SDs for rPE/rPP strength are **0.1–1.8 / 0.3–0.7 MPa** — a few percent of the mean [R04] — while between-sample spreads are 20–50 %, so the lot share should be ~85 % of variance for E and σ_y (§6.1).
5. **rPET can be "in spec" and still risky.** Across **20 commercial rPET recyclates from 14 suppliers**, properties lie *inside* the virgin literature range — but the lowest flexural modulus was **1,860 MPa** and Charpy notched impact **1.3–2.8 kJ/m² (mean 1.9)** vs a virgin 2–3 kJ/m² [R08]. The risk is not being out of range; it is not knowing where in the range you are.
6. **Cheap proxies exist, with accuracy ceilings that must be exposed.** Melt viscosity during kneading classified tensile/impact class for **23 household rPP lots at >85 % accuracy** (RNN) [R06]; in-mould rheology control held property and part-weight **CV < 5 %** on five rPP blends [R14]. Yet MFR alone failed to track rPP mechanics in another programme [R02]. NIR composition correlated strongly with rPE impact [R36], and NIR+PLS predicts polyolefin density/crystallinity/branching [R31] — with no extractable accuracy figure.
7. **rPETG is the *least* variable recyclate in our library** — at least for one cycle: printed ISO 527-2 specimens showed E = **2.28 GPa (CV 10.8 %)** new vs **2.17 GPa (CV 8.3 %)** recycled-once, peak stress 46.5 vs 48.6 MPa [R07]; multi-cycle studies report only minor knockdown [R09,R10,R11].
8. **rPP is the least trustworthy preset.** Its modulus can halve between MRFs (~650 MPa vs roughly double) [R02], its density is a filler proxy (filled lots sold at 0.97 ± 0.03 g/cm³) [R05], and elongation at break varies by an order of magnitude [R05].
9. **Recycling economics now has a regulatory floor.** EU PPWR (Regulation (EU) 2025/40) sets recycled-content obligations from 2030 (e.g. 30 % for PET-major-component contact-sensitive packaging and single-use plastic beverage bottles) [R28], verified via EN 15343 [R29]. R-HDPE pellets trade **≥ €347/t above** pre-2022 virgin levels and R-PP **≥ €567/t above** 2021 [R25] — recyclate price is now a compliance input, not a disposal-avoidance story.
10. **A directly contradictory framing must be acknowledged.** The literature does *not* show recyclates are inherently weak: 11-loop rPET with SSP [R22], rLDPE [R33] and one-cycle rPETG [R07] all match virgin. The defensible claim is narrower: **the distribution, not the mean, is the problem** — and this dossier quantifies it.

---

## 1. Definitions and why variation is inherent

**Recyclate.** A polymer that has passed through at least one post-use collection → sorting → size reduction → washing/drying → melt reprocessing sequence and is sold as feedstock for new parts. **PCR** comes from household/commercial end-of-life products; **PIR** from manufacturing scrap. PCR has the wider property distribution because service history, contamination and product mix vary in ways the recycler cannot observe [R01,R04,R17]. **Lot/batch** here means one supplier delivery certified by one datasheet; AnyRB treats the lot as the decision unit (accept/adapt/reject) and individual printed specimens as within-lot draws. This dossier covers **mechanical recycling only** — re-melting that preserves but degrades the chain — because that is where lot-to-lot variation originates; chemical recycling produces a more uniform feedstock and is out of scope except as a strategic alternative (§5).

**Why variation is inherent.** Mechanical recycling is a *mixing and downgrading* operation on an uncontrolled input: bale composition is heterogeneous, service degradation is unobserved, separation cannot be perfect (NIR sorting struggles with film, multilayer and blended items [R15]), and reprocessing adds degradation proportional to temperature history and cycle count [R19,R04]. Each is a *distribution over lots*, so lot-to-lot SD is a genuine property of the supply chain — and the input a design-for-variability tool must consume. Recycled-content mandates make it unavoidable [R28].

**Evidence grades.** A: peer-reviewed, numbers extractable; B: peer-reviewed partial/qualitative; C: agency/industry/standard; D: assumption with no direct source (rLDPE/mixed presets). Grades are carried per property in the JSON.

---

## 2. Per-polymer quantitative evidence

All numbers below are as published. Where the test standard was reported it is listed; where not, it is marked "n/r". Sample sizes (n) refer to independent specimens, not lots, unless noted.

### 2.1 Recycled HDPE (rHDPE) and recycled LDPE (rLDPE)

| Property | Value range / distribution | Standard / conditions | n | Source | Grade |
|---|---|---|---|---|---|
| E (rHDPE, across 3 US MRFs) | **380–1,250 MPa** (≈3.3× range) | n/r (injection-moulded specimens) | 3 MRFs | R02 via R01 | A (via secondary quote) |
| E (rHDPE, industrial stretch film) | **1,350 ± 239 MPa, CV 17.7 %** | ASTM D638 Type I, tangent modulus at 500 N | **50 specimens / 10 plates** | R01 | A |
| E (rHDPE, literature compilation) | **1,213 ± 654 MPa, CV ≈ 54 %** | mixed methods | 40 | R01 | A |
| E (rHDPE IM grades, process-sorted) | **255–395 MPa** vs virgin control 396 MPa | n/r; note protocol differs from most published data | 2 MRFs + virgin | R03 | A |
| σ_y (rHDPE-rich reprocessed) | **41.6–48.4 MPa** (SD 0.2–1.8 MPa) | ISO 3167 / ISO 527-2, 50 mm/min | 5 per sample | R04 | A |
| σ_y (externally sourced mixed PE) | **22.2–38.3 MPa** | same | 5 per sample | R04 | A |
| Strain at yield (PE, HDPE-rich / mixed) | **11.2–15.2 % / 13.3–17.0 %** | same | 5 | R04 | A |
| Izod impact (unnotched, PE) | "no break" (all PE samples) | ISO 180 | 5 | R04 | A |
| Density (rHDPE) | **≈0.94–0.96 g/cm³**, virgin control 0.946 g/cm³ | ISO 1183 class | — | R12 | B |
| E (rLDPE) / performance | ≈150–350 MPa (approx. reading of figure axes); "satisfactory" static + cyclic tensile after reprocessing, no significant FTIR change | mixed / 1 regranulate | — | R01 Fig. 1A, R33 | C |

**Note on the anchor range.** PNAS summarises Eriksen's PE data as 22–50 MPa strength and 11–18 % strain [R01]; the specimen values extracted from the primary table are 22.2–48.4 MPa and 11.2–17.0 %, consistent within rounding.

**Interpretation.** The three rHDPE "E" numbers describe different populations: mixed rigid MRF stream (380–1,250 MPa), single-source film stream (1,350 ± 239 MPa) and a literature compilation across methods/grades (1,213 ± 654 MPa). The recommended preset (950 MPa, CV 0.22) sits between the first two, with both sub-cases in §6. R03's values (E ≈ 255–395 MPa) are 3–4× lower than other HDPE data and are evidence of *relative* spread only [R03]. **The LDPE problem:** weak "rHDPE" is usually LDPE contamination, hard to separate (both floaters) and offered by Eriksen et al. to explain reduced strength in mixed-PE samples [R04] — so a model that does not ask "bottle-grade or mixed rigid stream?" is mis-specified.

### 2.2 Recycled polypropylene (rPP)

| Property | Value range / distribution | Standard / conditions | n | Source | Grade |
|---|---|---|---|---|---|
| MFR (10 PCR-PP lots, 15 months) | **3–79 g/10 min** across studies; the 10 "spec-compliant" lots were all inside **7–13 g/10 min** | ISO 1133 | 10 lots | R04, R05 | A |
| Filler content | **2–24 wt %** while all lots met the same MFR & density spec | TGA/ash | 10 lots | R05 | A |
| σ_y | **24.9–28.7 MPa** at yield (11 reprocessed PP samples) | ISO 527-2, 50 mm/min | 5 per sample | R04 | A |
| σ_y (process-sorted IM grades) | **12.1–13.3 MPa** (protocol-dependent) | n/r | MRF 1–3 + virgin | R03 | A |
| Strain at yield | **6.6–11.9 %** | ISO 527-2 | 5 | R04 | A |
| Elongation at break (10 lots) | **10–100 %** — order-of-magnitude spread | n/r | 10 lots | R05 | A |
| Fatigue life at equal stress | **3,000 – 6,520,000 cycles** | crack-growth test | 10 lots | R05 | A |
| Unnotched Izod impact | **19.4–33.3 kJ/m²** (one external sample 59), within-sample SD 12.4–14.6 | ISO 180 | 5 | R04 | A |
| E (across MRFs) | **~650 MPa** in one MRF vs ~2× that in the other two | n/r | 3 MRFs | R02 | A |
| E (process-sorted IM) | **434–472 MPa**, virgin control 376 MPa | n/r | 3 MRFs + virgin | R03 | A |
| Density | Spec **0.97 ± 0.03 g/cm³** for a filled PCR-PP; virgin PP 0.900 g/cm³ | ISO 1183 | 10 lots | R05, R12 | B |

**Interpretation.** rPP is the clearest case that **specification compliance ≠ performance consistency**: ten lots met MFR and density specs yet differed enormously in filler, elongation and fatigue life [R05]. Filler 2–24 wt % raises stiffness and cuts ductility — so **filler content should be a first-class lot parameter in the UI** — and the MFR-to-mechanical link is explicitly documented as unreliable [R02], so the proxy must be trained per supplier.

### 2.3 Recycled PET (rPET) and recycled PETG (rPETG)

| Property | Value range / distribution | Standard / conditions | n | Source | Grade |
|---|---|---|---|---|---|
| rPET flexural modulus (20 commercial recyclates, 14 suppliers) | **as low as 1,860 MPa**; generally at lower end of vPET literature range | ISO 178, 2 mm/min | 5 per sample | R08 | A |
| rPET elongation at flexural strength | **4.8–5.2 %** (vPET 3.5–8 %) | ISO 178 | 5 | R08 | A |
| rPET Charpy notched impact | **1.3–2.8 kJ/m² (mean 1.9)** vs vPET 2–3 kJ/m² | ISO 179, 23 °C | 10 per sample | R08 | A |
| rPET tensile strength (lab reprocessed, undried) | **22.1–36.3 MPa** at break | ISO 527-2, 50 mm/min | 5 per sample | R04 | A |
| rPET strain at break (lab, undried) | **2.1–3.4 %** | ISO 527-2 | 5 | R04 | A |
| rPET impact (lab, undried) | **2.2–10.5 kJ/m²** | ISO 180 | 5 | R04 | A |
| rPET IV, 11 loops | quality including IV "not adversely affected" with SSP + 75 % rPET | industrial replica | 11 cycles | R22 | B |
| rPETG E (printed) | **2.28 GPa (CV 10.8 %) new filament; 2.17 GPa (CV 8.3 %) recycled-once** | ISO 527-2:2012, 5 mm/min | 6 + 6 | R07 | A |
| rPETG peak stress (printed) | **46.5 MPa (SD 0.66) vs 48.6 MPa (SD 1.54)** | ISO 527-2:2012 | 6 + 6 | R07 | A |
| rPETG strain at peak stress | **3.15–3.51 %** | ISO 527-2:2012 | 12 | R07 | A |
| rPETG density | **1.23 g/cm³** (vendor spec; common range 1.23–1.27) | — | — | R07 | B |
| rPETG multi-cycle | 5–6 cycles: comparable after 3 cycles, minor knockdown; viscosity/elasticity decrease | — | 1 study each | R09,R10 | B |
| PETG one cycle | minor decrease in tensile strength and E; blends can compensate | — | 1 | R11 | B |

**Interpretation.** rPET is where *supplier process route* matters most: with SSP the chain is rebuilt and 11 cycles were tolerated [R22], whereas lab PET without dedicated drying was far weaker and erratic [R04]; a single rPET preset is therefore dishonest and the JSON notes a "process route" switch. For rPETG the evidence is better than expected — one print-and-recycle cycle did **not** degrade properties (peak stress rose, probably via crystallinity) [R07] — hence its low CVs (0.08–0.11), although all are printed-part values with n = 6, i.e. one process and one lot.

### 2.4 Mixed polyolefins

| Property | Value | Source | Grade |
|---|---|---|---|
| Composition of #3–7 bales | PP up to **79 wt %** of a bale; PET and HDPE contamination present and variable by MRF | R02 | A |
| Modulus spread across MRFs | "significant variability … highest for HDPE, 380–1,250 MPa" | R02 via R01 | A |
| PP/PE blend properties | Recycled PP-HDPE blends lower E and σ_y, higher elongation at break than virgin; immiscible morphology | R12 | B |
| Composition range | Waste streams with **up to 9 polymers**; elemental impurities **1–3,000 ppm** (Ca, Al, Na, Zn, Fe, Cl, F) | R17 | A |
| Density | PE/PP mixture 0.90–0.96 g/cm³ depending on PP fraction | R12 (endpoints) | B |

**Interpretation.** Mixed polyolefins are a **composition-driven** feedstock: the right lot descriptor is the composition vector (PP wt %, filler/ash, PET/PS contamination) and the preset is deliberately wide (CV 0.30). Least defensible preset in the library; grade D in the JSON.

---

## 3. Origin of variation — mechanisms and where the numbers come from

| Mechanism | What varies | Quantified evidence | Design consequence |
|---|---|---|---|
| **Feedstock mix / product mix** | Polymer types, grades, molecular weight of the same polymer | Up to **9 polymers** in one packaging stream [R17]; mixing "other PE types" into rPE cut impact resistance **11 %** at the first step [R36]; MRF rHDPE E 380–1,250 MPa [R02] | Lot-level shift is the dominant term; model as log-normal lot multiplier |
| **Degradation history** | Chain scission, oxidation, crystallinity, embrittlement | Photo-oxidised HDPE embrittles; thermo-oxidative reprocessing plus cross-contamination severely reduces ductility [R19]; PET chain damage is recoverable only with SSP [R22] | Correlate E↑/elongation↓ |
| **Contaminants and additives** | Filler (CaCO₃, talc, TiO₂), metals, halogens, residual product | Filler **2–24 wt %** in spec-compliant PP lots [R05]; metals **1–3,000 ppm** [R17]; metals influence reprocessed quality [R16]; PP contamination in rHDPE bottles [R34] | Add "filler/ash %" as a lot parameter; density becomes a filler proxy |
| **Moisture** | Hydrolysis of PET/PA during melt processing | Lab PET processed without dedicated drying gave 22–36 MPa strength and "erratic" behaviour — explicitly not industrial-representative [R04] | rPET preset must assume dried, SSP-grade material; expose a "drying route" switch |
| **Sorting efficiency** | Cross-polymer contamination, film/multilayer losses | Commercial sorters handle single-component items; film, multilayer and blended items remain problematic [R15]; NIR flake analysis strongly predicts rPE impact [R36] | Accept that purity is a distribution, not a spec; use NIR fingerprint lots |
| **Reprocessing cycles** | Cumulative thermomechanical degradation | Extensively recycled HDPE processability/mechanics change with cycles [R23, title-level]; PP/HDPE blends degrade [R12]; rPETG and rPET(SSP) tolerate 5–11 cycles [R09,R22] | Expose "cycles since virgin" if supplier data allows |
| **Seasonality / source** | Composition drift over months | 10 PCR-PP batches over **15 months**: filler 2–24 %, elongation 10–100 %, fatigue 3,000–6.52 M cycles [R05] | Time-varying lot distribution; do not assume stationarity across a year |
| **MRF / technology** | Different sorting equipment → different bale quality | MRF-to-MRF differences in HDPE modulus and PP modulus (~2× in one MRF) [R02,R03]; OIT/stabiliser differences [R02] | "Supplier/MRF" is a random effect; allow supplier-specific presets |

**What this means for design.** The mechanisms are coupled: filler raises E, lowers elongation and raises density; degradation stiffens then brittles; contamination lowers impact. A *joint* distribution (copula) over (E, σ_y, ε, ρ) is therefore more honest than four independent histograms, even when the correlation is an assumption.

---

## 4. Measurable proxies — what a user can know *before* producing

The product's promise is that a user need not test every lot. The literature supports *classification-grade* proxies, not deterministic predictions.

| Proxy | Measured when | Predicts | Documented accuracy / limits | Source | Grade |
|---|---|---|---|---|---|
| **Melt viscosity during kneading** | already measured during pelletising (near-zero marginal cost) | tensile properties, Charpy impact class | **23 rPP lots, RNN classification >85 %** | R06 | A |
| **In-mould pressure/viscosity (closed-loop control)** | during moulding | reduces *processing* variation | mechanical-property and part-weight **CV < 5 %** across 5 rPP blends | R14 | A |
| **MFR alone** | datasheet | **not sufficient** for rPP mechanical properties | MFR did not follow mechanical-property trends; "MFR could not be considered alone" | R02 | A |
| **NIR / flake analysis** | sorting / incoming | composition, **impact resistance** | strongest composition method; strong rPE-impact correlation; +other PE → −11 % | R36 | A |
| **NIR + PLS/ML** | sorting | **density, crystallinity, short-chain branching** | "high prediction accuracy" with PLS; R²/RMSE not extractable here | R31 | A (qualitative) |
| **Ash / filler content (TGA)** | lab, cheap | density, E (↑), elongation (↓) | filler 2–24 wt % explains much rPP spread | R05 | A |
| **Density** | standard QC | filler content proxy for PP; polymer identity for PE | spec density 0.97 ± 0.03 tolerated huge composition changes | R05 | B |
| **IV (PET)** | lab | molecular weight, but **no quantitative mapping to strength recovered** | IV is restorable by SSP | R22 | B |
| **Colour** | visual | contamination indicator | no quantitative source | — | gap |

**Proxy models in `feedstock_library.json`:** (1) `proxy_melt_viscosity_to_strength` — classification/first-order map with **residual CV 0.15–0.25 assumed**, labelled "proxy, calibrate with own lot data"; (2) `proxy_nir_composition_to_impact` — composition fingerprint → impact class, no numeric accuracy claimed. IV → rPET strength is *not* implemented (mapping unverified) and is recorded as a gap.

**What the software must display.** A proxy-derived batch passport should show (a) the proxy value, (b) the predicted **distribution** with the proxy residual uncertainty inflated, and (c) calibration provenance ("literature prior / user-calibrated / supplier datasheet"). A single point prediction from MFI would be a defensible-looking lie.

---

## 5. Economics and regulation in brief — why reliability blocks adoption

| Fact | Number | Source | Grade |
|---|---|---|---|
| EU PPWR recycled-content obligation, plastic packaging from 2030 | **30 %** for PET-major-component contact-sensitive packaging and for single-use plastic beverage bottles; higher 2040 targets (e.g. 50 % PET contact-sensitive) | R28 (Art. 7), cross-checked via EUR-Lex search results | A (regulatory primary, automated fetch blocked) |
| Verification/traceability standard | **EN 15343:2018** — recycled-content traceability and conformity assessment | R29 | A |
| Claim substantiation | **ISO 14021:2016** (Type II self-declared environmental claims) | R30 (URL unverified — see §7) | A (standard exists; URL bot-blocked) |
| Price spreads vs virgin | R-HDPE **≥ €347/t above** pre-2022 average every year from 2022; natural PCR R-PP **≥ €567/t above** 2021 levels | R25 | C |
| vPET spot vs flake vs pellet structure | vPET ≈ **€1,470–1,600/t**; flake discount ≈ **€300/t**; pellet premium **0–50 €/t** | R26 (sample report; date not pinned) | C |
| Packaging PET market level | ≈ **€1,105–1,110/t** (Nov–Dec 2024) | R27 | C |
| Recycled content policy landscape | OECD review: mandates strengthen markets but implementation/verification challenges remain | R24 | C |

**Why this blocks adoption (argument).** Mandates create demand [R28], but a recyclate's technical substitutability is application-specific [R18]. A converter buying on datasheet risks a batch that meets MFR/density yet fails in the part [R05], and the converting cost is borne by the converter, not the recycler. That mismatch — obligation at brand level, variance at converter level — is the space for a tool that makes a *distribution* usable: robust geometry plus lot-level adaptation converts "recyclate is risky" into "recyclate is specified".

**Caveat.** R25–R27 are grade-C market sources with different dates/scopes; use them for *direction and order of magnitude*, never as current spot prices.

---

## 6. Implications for the software

### 6.1 Two-level distribution: recommended parameters

AnyRB's v0.1 model has a lot mean multiplier `m ~ LogNormal(1, CV_lot)` and a within-lot specimen multiplier `s ~ LogNormal(1, CV_within)` with `CV_total² ≈ CV_lot² + CV_within²`. The evidence supports the *structure* but changes the *split*:

- **Within-lot scatter is small for strength/modulus.** rPE strength SDs are 0.1–1.8 MPa on means of 22–48 MPa (≈ 0.3–4 %); rPP 0.3–0.7 MPa on 25–29 MPa (≈ 1–3 %). Impact is the exception: within-sample SD 12–15 on means of 19–33 kJ/m² (≈ 40–50 %) [R04].
- **Between-lot/source scatter is large.** rHDPE E: 17.7 % across ten plates from one supplier, 54 % across the literature [R01], 380–1,250 MPa across MRFs [R02]; rPP elongation 10–100 % across ten spec-identical lots [R05].
- **Recommended split:** `cv_lot = 0.92·cv_total`, `cv_within = 0.39·cv_total` (85/15 variance) for E and σ_y; `cv_lot = 0.77·cv_total`, `cv_within = 0.63·cv_total` (60/40) for elongation and impact. **Status: evidenced inference, recorded as ASSUMPTION in JSON** because no nested-design variance decomposition for a single recyclate population was found.
- **Why not 0.8/0.6:** it assigns 36 % of variance to within-lot scatter, inconsistent with the few-percent specimen SDs for strength/modulus [R04]; it would understate the risk of a bad lot — the exact failure mode the product prevents.

### 6.2 Correlations

No verified source reports a recyclate-specific correlation between E and σ_y or E and elongation. The recommended values (0.5–0.6 for lnE–lnσ_y; −0.2 to −0.4 for lnE–ε_b) are **ASSUMPTIONS** based on polymer physics and the filler/degradation pathways in R05/R19. The PNAS model treated modulus and interface strength as independent [R01], so *including* positive correlation is an improvement only if the user can see and change it. Correlation is a **second-order** effect compared with the CV magnitudes.

### 6.3 What the library should enable

1. **Preset selection by material + route** (rPET with/without SSP; rHDPE bottle-grade vs mixed rigid; rPP filled vs unfilled) — the route shifts the mean more than polymer identity in several sources [R04,R08,R22].
2. **Lot passport input:** supplier datasheet (MFR, density, filler/ash, IV, tensile) → log-normal property distributions with proxy residual inflation (§4) and "ASSUMPTION" labels where calibration is literature-only.
3. **CSV fit of user lots:** with ≥5–10 lots, fit lot means and within-lot SDs directly; literature priors then regularise only.
4. **Acceptance window / compensation recipe:** express the window in *measurable* lot parameters (MFR/q-index, filler %, density) — a converter cannot cheaply measure (E, σ_y), but MFR and density are on every datasheet [R05,R06].
5. **Honesty surfaces:** every preset shows evidence grade, source ids and "literature-derived distribution, not measured reliability"; the two-level split is visible and editable, never hard-coded.

### 6.4 Recommended preset values (final, for the engine)

Use the values in §0.1 table. In addition:

- **rHDPE sub-cases:** film-grade rHDPE → E = 1,350 MPa, CV 0.18 [R01]; MRF-mixed rigid → E = 800 MPa, CV 0.27, σ_y = 25 MPa, CV 0.20 (lower end of R02/R04 ranges).
- **rPP filled lots:** density 0.96–1.00 g/cm³, E +20 %, elongation −50 % vs unfilled — direction from R05's filler 2–24 wt %; **magnitude assumed**.
- **rPET without SSP:** drop σ_y to ~35 MPa, raise CV(σ_y) to 0.20 (lab-undried material showed 22–36 MPa [R04]); with SSP use the preset as given.
- E, σ_y, ε_b are log-normal and density normal — a modelling choice, not a literature claim; the JSON marks distributions explicitly.

---

## 7. What we could not verify / gaps / contradictions

**Could not verify (recorded, not guessed):**

1. **E–σ_y correlation coefficient for any recyclate.** No source found. All correlations are assumptions (§6.2).
2. **A nested variance decomposition (lots × specimens) for a single recyclate population.** The 85/15 and 60/40 splits are inferences from specimen SDs and cross-source spreads [R01,R04], not direct measurements.
3. **rPET tensile modulus and yield strength from a multi-supplier dataset.** Only flexural/impact data from 20 commercial recyclates [R08] and lab-scale undried tensile data [R04] were recoverable; the rPET σ_y preset (45 MPa) is deliberately conservative and grade C.
4. **rPETG long-run (≥5 cycle) quantitative property tables.** The multi-cycle papers report qualitative conclusions only in the accessible abstracts [R09,R10,R11]; only the one-cycle paper [R07] had extractable numbers.
5. **Calibrated proxy accuracy.** R06 gives classification accuracy (>85 %) but no regression error; R31's NIR R²/RMSE could not be extracted. Proxy residual uncertainty (0.15–0.25 CV) is therefore an assumption; IV→strength stays unimplemented.
6. **Seasonality of rHDPE composition.** Only rPP was studied across 15 months [R05]; no equivalent rHDPE time series verified.
7. **Exact PPWR 2040 percentages / delegated acts.** EUR-Lex blocked automated retrieval, so R28 is `verified_secondary`: existence and CELEX id confirmed via the EU Publications Office Cellar work record and search-result quotations, but the legal numbers should be checked against the OJ text.
8. **ISO 14021 URL.** iso.org returns HTTP 403 to automated checks; R30 is marked `unverified` and is not used for any headline claim.
9. **Several full texts.** R05, R06, R14, R22, R31 (Wiley/ACS/MDPI) were paywalled/bot-blocked; their numbers are abstract-level only (`abstract_only` in JSON).
10. **Cecon et al. 2023 per-MRF modulus values.** The 380–1,250 MPa range is verified via the PNAS quotation [R01]; exact per-MRF figures were not re-extracted.

**Direct contradictions / corrections to our premise:**

- **Author attribution error in the spec:** `PRODUCT_SPEC.md` attributes PNAS 122(33):e2502613122 to "Ghosh et al."; the verified authors are **D. Georgiou, D. Sun, X. Liu, C. E. Athanasiou** [R01]. All other claims about that paper's numbers check out. Correct the attribution everywhere.
- **Year error:** `J. Appl. Polym. Sci.` doi 10.1002/app.70501 is published **2026** (issue 15), not 2025 [R05].
- **The premise "recyclates are weak" is not supported.** rPET with SSP survived 11 loops without quality loss [R22]; rPETG after one recycle matched commercial filament [R07]; rLDPE performed "satisfactorily" [R33]; commercial rPET properties fall inside the virgin range [R08]. The defensible thesis is narrower and stronger: **the mean is often acceptable, the distribution is not**, and design/adaptation can absorb distribution width.
- **No source contradicts the value of variability-aware design.** Closest published alternatives are batch-management/formulation approaches (ML composition tool for rPP [R32], closed-loop process control [R14]) — complementary, not competing.

---

## 8. Reference index (compact)

Full records (DOI, all authors, venue, grade, used-for, locator, status, notes) are in `research/refs/refs-01.json`; do not treat this list as the citation source of truth.

- **Variability anchors:** R01 Georgiou 2025 (PNAS; rHDPE E, MRF range); R02 Cecon 2023 (US MRFs); R03 Cecon 2024 (process grades); R04 Eriksen 2019 (full property table); R05 Hinczica 2026 (10 rPP lots/15 months); R07 Dohan 2024 (rPETG); R08 Celik 2022 (20 rPET recyclates); R12 Jones 2023 (PP/HDPE blends); R19 Gnoffo 2025 (cross-contamination).
- **Proxies / methods:** R06 Hibi 2025 (viscosity→properties, 23 lots); R14 Krantz 2024 (in-mould rheology); R31 Li 2026 (NIR+ML); R36 Ulphard Thoden van Velzen 2021 (impurities → rPE impact, NIR).
- **Context / economics / regulation:** R17 Roosen 2020 (stream composition); R18 Demets 2021 (substitutability); R15 Lubongo 2022 (sorting); R16 Eriksen 2018 (metals); R22 Pinter 2021 (11-loop rPET); R23 Oblak 2015 (extensively recycled HDPE); R24 OECD 2024; R25–R27 market data; R28 PPWR; R29 EN 15343; R30 ISO 14021; R32 Teruel 2024 (ML batch management); R33–R35 rLDPE / rHDPE bottles / rHDPE root causes; R09–R11 rPETG multi-cycle; R13, R20, R21 supporting datasets (R21 = open PE-blend dataset, §6.3).

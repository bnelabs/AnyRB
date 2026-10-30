# AnyRB — Product & Engineering Specification (v0.1, 2026-10-29)

> **Historical note:** this document describes an earlier AnyRB prototype (v0.6 and earlier). The active product is the one-page v0.7 app; see [`README.md`](README.md).

**One line:** Design software that makes a recycled-polymer product behave reliably *despite* batch-to-batch variation — by designing the internal geometry for the batch distribution, and by adapting the print recipe to the batch you actually received. No physical testing required to use it; the physics, statistics and material data are virtual.

**Why this project exists (evidence anchors, to be expanded in research/):**
- Recyclate properties vary enormously between lots: e.g. recycled HDPE modulus 380–1,250 MPa across US MRFs (Cecon et al., *Waste Manage.* 2023); rHDPE tensile strength 22–50 MPa and elongation 11–18 % (Eriksen et al., *Waste Manage.* 2019); one industrial PCR-PP lot series showed large composition/mechanical drift over 15 months (*J. Appl. Polym. Sci.* 2026, doi:10.1002/app.70501).
- Architecture can suppress the consequence of that variation: a nacre-inspired brick-and-mortar composite reduced *measured* recycled-HDPE modulus variability from 18 % to 4 % (78 % reduction) and strain-at-break variability by ≥68 %; its headline "up to 93 %" is relative to a modelled 26 % introduced variability, and the composite is adhesive-limited (strength 0.22 MPa), so it is a film/elastomer result rather than a structural-part one (Georgiou, Sun, Liu & Athanasiou, *PNAS* 122(33):e2502613122, 2025, doi:10.1073/pnas.2502613122). What generalises is the uncertainty-aware modelling method (feedstock distribution → mesoscale mechanics → Monte Carlo → variability metrics) and the design-lever taxonomy, not the raw number. See research/02 for the critical appraisal.
- Cheap per-lot proxies exist (melt viscosity/MFI/IV) that predict mechanical properties without specimen testing (e.g. "A Nearly Zero-Cost Lot-by-Lot Inspection of Recycled Plastics", *ACS Sustain. Resour. Manage.* 2025) — these are the inputs a real user would have.
- Industry practice still assumes deterministic material; topology/lattice tools assume it too. That gap is the product.

---

## 1. What AnyRB does

A virtual studio with four coupled modules:

1. **Feedstock model** — a library of literature-derived property distributions per recyclate (rPET/rPETG, rHDPE, rPP, mixed polyolefins), plus a two-level statistical model: *lot-to-lot* mean shift + *within-lot* scatter, with correlations between E, yield strength, elongation, density. Users can edit CVs, means, correlations, or fit from a CSV of their own lot data. Supplier "lot passports" (MFI/IV/density/tensile data) are converted to a property distribution through documented proxy models (clearly labelled; replaceable with user calibration).
2. **Architecture generator + mechanics** — generates the internal geometry of a product (parametric graded lattice; later: nacre-like platelet architectures, hybrid skins) and computes its response with a verified 2D frame finite-element model (Python canonical engine; identical JS implementation for the interactive demo). Multiscale option for unit-cell homogenisation lives in Python.
3. **Uncertainty & reliability** — Monte-Carlo/analytic propagation of the batch distribution through the mechanics; reports probability of failure, safety-factor distribution, worst-batch envelope, and sensitivity (which material parameter/geometry feature dominates). Metrics are defined once and shared by both implementations (see §5).
4. **Robust design optimizer + virtual qualification report** — optimises the geometry for minimum mass subject to a reliability target across the batch distribution; compares against nominal-material design and uniform lattice; produces (a) an STL of the internal geometry, (b) a printable per-batch compensation recipe, (c) a batch acceptance window for incoming material, (d) a self-contained HTML qualification report. Everything is in-silico; a V&V package (§9) states what the numbers do and do not support.

## 2. Reference product for the demo (fixed contract)

**Cantilever bracket arm** ("shelf bracket"), loaded in-plane, 2D plane-frame idealisation, rectangular section struts extruded to depth `t`:

| Parameter | Value |
|---|---|
| Overall length `Lx` | 150 mm (solid wall pad 10 mm + 7 lattice cells × 20 mm) |
| Height `Ly` | 60 mm (3 cells × 20 mm) |
| Out-of-plane depth `t` | 10 mm |
| Grid | 7 × 3 square cells, X-braced (both diagonals per cell) |
| Boundary conditions | All DOF fixed at the 4 nodes on `x = 10 mm` (wall pad face) |
| Load | Total `F = 150 N` downward (−y), applied at the 4 nodes on `x = 150 mm` (F/4 each) |
| Deflection limit | `u_lim = 2.5 mm` (max |v| at tip nodes) |
| Strut in-plane width `w_e` | graded field, clipped to `[1.0, 4.0] mm` |
| Material density | from feedstock preset (g/cm³) |
| Wall pad volume | 10 × 60 × 10 = 6,000 mm³, solid |

*These defaults are provisional; the Lead calibrates them after the canonical FE is running so the demo shows an interesting design trade-off. All values must live in `app/config.js` + engine presets, never hard-coded in UI.*

### 2.1 Finite-element contract (both implementations MUST match)

Nodes: `x_i = 10 + 20 i`, `i = 0..7`; `y_j = 20 j`, `j = 0..3`. Node id `n = j*8 + i`. DOF per node: `[u, v, θ]`, global id `3n + k`.

Elements (94 total):
- horizontal: `(i,j)-(i+1,j)` for i=0..6, j=0..3 (28)
- vertical: `(i,j)-(i,j+1)` for i=0..7, j=0..2 (24)
- diagonals: per cell `(i,j)`, both `(i,j)-(i+1,j+1)` and `(i+1,j)-(i,j+1)` (42)

Element properties from its midpoint `(xm, ym)`: width `w = clip(W(xm,ym), 1.0, 4.0)`;
`A = t w`, `I = t w³ / 12`, `W_section = t w² / 6`, `E_ref = 1` for unit solves (forces independent of E for a single material).

2D frame local stiffness (DOF `[u1,v1,θ1,u2,v2,θ2]`), with `EA/L`, `a = 12EI/L³`, `b = 6EI/L²`, `c = 4EI/L`, `d = 2EI/L`:

```
[ EA/L   0    0   -EA/L   0    0  ]
[  0     a    b     0    -a    b  ]
[  0     b    c     0    -b    d  ]
[-EA/L   0    0    EA/L   0    0  ]
[  0    -a   -b     0     a   -b  ]
[  0     b    d     0    -b    c  ]
```

with `c=cos α`, `s=sin α` (α = element direction), transformation
`T = [[c,s,0,0,0,0],[-s,c,0,0,0,0],[0,0,1,0,0,0],[0,0,0,c,s,0],[0,0,0,-s,c,0],[0,0,0,0,0,1]]`,
`k = Tᵀ k_local T`, `f_local = k_local T u_global`.

Forces: axial `N = 0.5*(f_local[3] - f_local[0])` (tension positive);
end moments `M1 = f_local[2]`, `M2 = f_local[5]`.

Unit-load solve (`F = 1 N` total, `E = E_ref`): get `u_tip_unit` and per-element `N_unit`, `M_unit`.
For a design and batch `(E, σy)`:
- tip deflection `u = F * u_tip_unit * E_ref / E` (linear in 1/E; exact for single material)
- axial/bending stress demand `σ_req = F * max_e [ |N_unit_e|/A_e + max(|M_unit_e1|,|M_unit_e2|)/W_e ]` (MPa; independent of E)
- buckling demand `E_req_buck = max over N_unit_e<0 of [ F |N_unit_e| L_e² / (π² I_e) ]` (MPa; k=1.0 pinned-pinned)
- stiffness demand `E_req_def = F * u_tip_unit * E_ref / u_lim` (MPa)
- `σy_req = σ_req`, `E_req = max(E_req_def, E_req_buck)`
- failure event: `σy_batch < σy_req OR E_batch < E_req` (batch-uniform material; conservative, no spatial scatter in v0.1)
- mass `m = ρ * (Σ_e A_e L_e + 6000 mm³)` [g with ρ in g/cm³ and mm³/1000]

The same formulas must be implemented in Python (`engine/anyrb/mechanics.py`) and JS (`app/engine.js`). Cross-check fixtures: Python writes `app/tests/fixtures/reference.json`; JS tests must match deterministic fields to 1e-9 relative and reliability to 1e-6 absolute.

### 2.2 Design parameterisation

Width field: 4 × 2 control points at `x_norm ∈ {0, 1/3, 2/3, 1}`, `y_norm ∈ {0, 1}` (i.e. x-position and bottom/top edge), values in **log-width** space; bilinear interpolation to element midpoint; `w = exp(interp)`, clipped `[1,4]`. Eight design variables (log widths at control points). Optional printability checks: neighbour width ratio ≤ 1.5, `L/w_e ≤ 30`; report violations, do not silently reject.

### 2.3 Optimisation contract

`minimise mass(design)` subject to `P_f(design) ≤ target` (target default 0.01) and width bounds. Penalty formulation: `score = mass * (1 + 100 * max(0, P_f - target)/target)`. Deterministic pattern search (coordinate descent with shrinking step) in JS; deterministic multi-start cohort/pattern search in Python (mirrors the JS optimiser). Baselines for comparison (all evaluated on the same feedstock distribution):
1. `solid` — monolithic 150×60×10 mm plate with wall pad (no lattice cells), same material.
2. `uniform` — lattice with all control-point widths equal, sized to meet the reliability target.
3. `uniform_match` — uniform lattice whose mass equals the robust optimum's mass (same-mass comparison).
4. `nominal-sf15` — geometry minimised for the **mean** material with a deterministic factor of safety 1.5, then evaluated on the batch distribution.
5. `mean-only` — geometry that just passes for the mean material (SF 1.0), then evaluated on the batch distribution.
6. `robust-opt` — geometry optimised with the reliability target on the batch distribution.

### 2.4 Batch-adaptive recipe (second product pillar)

Given a new lot's measured/supplier proxy (a "quality index" `q = mean σy / reference mean σy`, and optionally mean E), compute a uniform width scale `s ∈ [1, 1.5]` such that the part meets the same reliability target for that lot: smallest `s` with `P_f(design*s, lot) ≤ target`. Report: required scale, added mass %, pass (≤1.15), conditional pass (≤1.5), reject/reroute. Also export a batch acceptance window: ranges of `(E, σy)` (or proxy `q`) for which the baseline design meets the target. Clearly labelled *illustrative v0.1 logic* (exact per-lot properties would be entered from supplier data).

## 3. Feedstock presets (provisional v0.1 — research team replaces with sourced values)

| Preset | E mean (MPa) | CV(E) | σy mean (MPa) | CV(σy) | ρ (g/cm³) | corr(lnE, lnσy) | Source basis |
|---|---|---|---|---|---|---|---|
| rPETG printed (default) | 2100 | 0.10 | 46.0 | 0.10 | 1.24 | 0.55 | `data/feedstock_library.json` R07: printed rPETG, ISO 527-2, E 2.28 GPa CV 10.8 %, peak stress 46.5 MPa |
| rPET (bottle, IM) | 2500 | 0.12 | 45.0 | 0.15 | 1.34 | 0.60 | library (20 commercial recyclates, 14 suppliers) |
| rHDPE (PCR) | 950 | 0.22 | 28.0 | 0.17 | 0.95 | 0.55 | library; Cecon 2023, Eriksen 2019, PNAS 2025 |
| rPP (PCR) | 1100 | 0.18 | 27.0 | 0.13 | 0.94 | 0.50 | library; 10-lot / 15-month PCR-PP study |

**Important:** the rPETG preset uses the *printed in-plane* strength measured on ISO 527-2 specimens (46 MPa). Do **not** apply an additional layer-adhesion knockdown: that would double-count anisotropy, because the measurement is already a printed-part value and the 2-D frame model is loaded in-plane. Out-of-plane / layer-normal loading is not modelled in v0.1 (listed as a limitation). Consequence: in the reference bracket the strength demand is only ~40 % of the mean strength, so stiffness/buckling drives failure; AnyRB reports this instead of assuming which property binds.

Two-level model: lot mean multiplier `m ~ LogNormal(1, CV_lot)`; within-lot specimen multiplier `s_i ~ LogNormal(1, CV_within)`; `CV_total² ≈ CV_lot² + CV_within²`. Default split follows research/01: **85 % of variance between lots** → `CV_lot = 0.92195·CV_total`, `CV_within = 0.38730·CV_total` (replaces the earlier 0.8/0.6 draft). Reliability is evaluated at lot level unless a measured lot is supplied (then within level).

## 4. Metrics (single definitions, used by Python, JS and report)

- `P_f` — probability over the batch distribution that the part fails (yield or buckling or deflection limit).
- `reliability = 1 - P_f`.
- `capacity margin` — `min(σy_batch/σy_req, E_batch/E_req)` distribution; report mean, 5th percentile, and `P5/mean` as a **robustness index** (1.0 = no scatter consequence).
- `mass` — grams.
- `batch acceptance window` — set of `(E, σy)` (or `q`) where `P_f ≤ target`; report as curves/table.
- `sensitivity` — ∂P_f/∂θ for `CV(E)`, `CV(σy)`, `corr`, `F`, and design widths (finite differences, same MC seed).
- `design comparison` — table of the four baselines from §2.3.
- `worst-case batch` — the percentile point `(E, σy)` on the failure boundary; report as "the weakest 1 % of expected batches".

## 5. Interactive app requirements (`app/`, owner: demo-engineer)

Single-page, dependency-free, network-free, opens by double-click (`file://`), works in current Chrome/Safari. Vanilla HTML/CSS/JS (ES modules are fine for dev; final build inlines everything into `app/index.html` or `anyrb/index.html`). Dark, clean engineering aesthetic; readable typography; no external fonts/CDNs.

Sections (single scroll page or tabs):
1. **Header** — AnyRB name, one-line thesis, "all numbers in-silico" badge.
2. **Feedstock panel** — preset selector + sliders for mean/CV of E and σy, correlation, lot-count; live distribution preview (two histograms + scatter with failure boundary).
3. **Design studio** — canvas rendering of the bracket/lattice (struts coloured by utilisation, width-coded), load/deflection inputs, reliability target; "Monte-Carlo" runs live (<300 ms at 5,000 samples); gauges: reliability, mass, tip deflection mean/P95; safety-factor histogram.
4. **Design comparison** — one-click "Compare strategies" runs solid/uniform/nominal-opt/robust-opt and shows bars: mass vs P_f, plus Pareto plot (mass vs reliability).
5. **Robust optimise** — button runs the optimizer (~1–3 s) with progress; before/after geometry + metrics; explanation of what changed (root vs tip density).
6. **Batch passport / compensation** — input a lot quality index (or supplier values), get required density scale, added mass, pass/conditional/reject verdict, acceptance-window chart.
7. **Export** — STL download (boxes per strut, binary or ASCII; note: overlapping boxes, slicer unions them), design JSON, and a "copy qualification summary" text.
8. **Method & honesty** — equations used, assumptions, what is NOT validated, V&V summary, citation links (a few key DOIs), "v0.1 prototype" disclaimer.

Interactions must be robust: no unhandled errors, debounced sliders, deterministic seeded RNG (seed shown), reset button. Every computed number traceable to §2–§5 formulas. Mobile layout not required but must not break below 1000 px.

## 6. Python engine requirements (`engine/`, owner: Lead)

Package `anyrb/engine/anyrb/` with modules: `materials.py` (presets, copula sampling, two-level, CSV fit, proxy model stub), `lattice.py` (nodes/elements/width field/mass), `mechanics.py` (FE solve, demands, checks), `reliability.py` (analytic bivariate-normal P_f + MC, metrics), `optimize.py` (robust + nominal + baselines), `stl.py` (STL export), `report.py` (self-contained HTML qualification report with SVG charts), `cli.py` (`python -m anyrb.cli demo|optimize|report|export-fixtures|serve?`). Tests in `engine/tests/` (pytest-style but runnable with unittest): analytical beam checks, element force equilibrium, width-field bounds, P_f vs brute-force MC, optimisation monotonicity, fixture generation. Python 3.15 venv at `anyrb/.venv` (numpy/scipy/matplotlib installed); no network needed at run time.

## 7. V&V / credibility (must be visible in app + report)

- **Code verification:** cantilever tip deflection vs Euler-Bernoulli; single element pure axial/tension; rigid-body modes; symmetry; mesh/refinement trend; mass consistency.
- **Solution verification:** Monte-Carlo convergence (std error vs N); analytic bivariate-normal P_f vs MC.
- **Calibration:** literature-derived material distributions only; no experimental validation available in this project — stated explicitly.
- **Claim limits:** v0.1 is a linear-elastic plane-frame idealisation; no plasticity, creep, fatigue, layer-adhesion anisotropy (the measured printed in-plane strength is used), out-of-plane buckling, residual stress, or print-defect statistics. Buckling uses pure axial Euler with pinned-pinned effective length (no combined axial-bending interaction); rigid joints are not modelled explicitly; mass sums strut volumes without subtracting node overlap (conservative). Numbers are *decision-support*, not certification.
- **Validation roadmap (no hardware needed today → future):** described in research/05.

## 8. Research dossier (`research/`, owners: 3–4 researchers)

| File | Scope |
|---|---|
| `00-executive-evidence-map.md` | Lead synthesis: one-page evidence map → software requirements |
| `01-recyclate-variability.md` | Quantified variability, origin, proxies, datasets, standards; per-polymer tables |
| `02-design-for-variability.md` | How architecture/design reduces the *effect* of variability; PNAS nacre deep-dive; lattice/hierarchy/redundancy/grading/robust-TO evidence; limits; levers → software features |
| `03-computational-methods.md` | Homogenisation, UQ, surrogates/ML, robust optimisation, digital twins; method selection for AnyRB |
| `04-software-landscape-and-gap.md` | Existing tools (nTop, Carbon, Autodesk, Altair, Ansys, Digimat, Hyperganic, open source, MES/QMS), feature matrix, gap, product position, pricing/business sketch |
| `05-validation-without-physical-testing.md` | How to make in-silico claims credible: ASME V&V 10/20/40, FDA in-silico, calibration hierarchy, benchmarks, standards, exact validation plan + tests + cost if/when lab access appears |
| `refs/*.json` | Machine-readable references per file: `{id, title, authors, year, venue, doi, url, type, evidence_grade, used_for, quote_or_locator}` |

Citation standard: every factual claim carries `[Rxx]`; each `Rxx` resolves in `refs/*.json` with DOI/URL; no reference may be invented; mark unverified ones `status: "unverified"` and exclude from headline claims. Prefer peer-reviewed + standards + official datasets; grade evidence (A = peer-reviewed quantitative + data, B = peer-reviewed qualitative, C = industry/agency report). Include a "gaps / could not verify" section per file.

## 9. Team scopes (no overlapping writes)

- Lead: `engine/**`, `app/tests/fixtures/reference.json`, `REPORT.md`, `README.md`, `demo/**`, `reports/**`, `research/00-*`.
- demo-engineer: `app/**` except `app/tests/fixtures/reference.json`.
- researcher-variability: `research/01-*`, `research/refs/refs-01.json`, `data/feedstock_library.json`.
- researcher-design: `research/02-*`, `research/refs/refs-02.json`.
- researcher-methods: `research/03-*`, `research/05-*`, `research/refs/refs-03.json`, `refs-05.json`.
- researcher-landscape: `research/04-*`, `research/refs/refs-04.json`.
- auditor (later): `audit/**` only; reports findings to Lead, never edits source.

## 10. Honesty rules for the app and report

Always state: in-silico only; literature-derived distributions; simplifications listed; "not a certification tool"; user must validate with their own lot data and physical tests before production. Never present simulated reliability as measured reliability. Never hide the model assumptions behind a single number.

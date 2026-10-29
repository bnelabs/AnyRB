# AnyRB v0.3 — response to the independent review

This document answers the review point by point. Status values are honest: **fixed** (code + tests + UI/docs),
**partial** (implemented but with a stated gap), **roadmap** (not implemented; named as a limitation).

## First: the 25 % mass figure was our error

The reviewer repeated our own published claim that the analytic mass over-counted overlap by ~25 %
(46.4 g versus ≈40.5 g). That figure came from a bug in the validation script's union sampler: it tested
`|rel·u| ≤ L/2` relative to the strut *start*, so each box was sampled over only half of its length and shifted.
The sampler now covers `0 ≤ rel·u ≤ L` along the full strut. Corrected independent result:

| Design | analytic | printed/union | analytic over-count |
|---|---|---|---|
| uniform w=1 mm | — | — | **+5.6 %** |
| uniform w=2 mm | — | — | **+12.2 %** |
| uniform w=4 mm | — | — | **+27.9 %** |
| shipped robust design | **50.81 g** | **46.40 g** | **+9.5 %** (corrected validator MC; engine Halton 46.40 g, 0.01 % deviation) |

The mass bias is real and design-dependent (~5–28 %), but it is **not 25 % on the shipped design**. The validator also audits the Halton printed estimate itself (F5): ≤0.1 % deviation on shipped designs, worst 0.35 % at w=1 mm — a second, documented WARN. The old
"≈40.5 g / 25 %" statement has been retired from the app, README, reports and validation register.

## Logic

| Review point | Status | What changed |
|---|---|---|
| Optimizer minimizes biased mass; union should be the objective | **partial** | Every displayed/exported mass is now the deterministic union-volume estimate (Halton 60k union, <0.5 % error vs 600k-sample MC). Candidate ranking, multi-start final selection and all comparisons use printed union mass; analytic strut-sum is shown only as a conservative upper bound. The *inner search* still ranks with the analytic bound for speed (the union estimate costs ~0.1 s/eval), so a full union objective in the loop remains roadmap. |
| Compensation is one global width scale | **fixed** | `lot_specific_recipe` re-optimises all 8 width controls on the measured lot and returns 8 width multipliers + global-equivalent scale + printed mass delta + verdict. A slicer's extrusion multiplier is derived from the global equivalent; per-strut multipliers are in the app passport. |
| Printability reported after the fact | **fixed** | Neighbour-ratio ≤1.5 and slenderness ≤30 are now in the robust/nominal/mean-only objective as constraints; the selected design must pass. Shipped design: neighbour ratio 1.38, slenderness 21.9. |
| Known lot drops measurement uncertainty | **fixed** | Known-lot passport retains a measurement CV (default 12 %): `E_cv = sqrt(within_cv² + measurement_cv²)`, same for σy. A single coupon is no longer treated as the true lot mean; P_f and mass reflect it. |
| Search local in one topology | **partial** | The product now says "best of this bracket/lattice family" in UI, report and claims. No alternative cell/skin/catalog comparison exists yet; full topology search is roadmap. |
| Single OR of two thresholds; no combined/compression/elongation/creep | **partial** | The frame check already sums axial + bending (`|N|/A + M/W`) and includes Euler buckling, but separate tensile/compressive allowables, elongation and fatigue/creep design allowables are not modelled. v0.3 adds an explicit **sustained-load bound** (creep factor 2.0, compression factor 0.8) shown as an advisory; it currently fails for the shipped static design (deflection bound 4.0 mm > 2.5 mm), so the part is labelled not qualified for sustained load. Orthotropic/creep allowables are roadmap. |

## Science

| Review point | Status | What changed |
|---|---|---|
| Code verification ≠ printed-part physics; L3–L6 absent | **partial** | Claim ladder unchanged and explicit (L0–L1 verified, L2 partial, L3–L6 absent). Added `validation/COUPON_TEST_PLAN.md` + frozen `coupon_predictions.json` (geometry, predicted tip stiffness/first-yield load, protocol, pre-registration hash) so the L3 comparison is pre-registered and executable when lab access exists. No specimen was tested. |
| Anisotropy, layer bonds, joints, out-of-plane buckling, creep omitted | **partial** | Documented; sustained-load advisory bound added. Orthotropic strut allowables, joint compliance, and out-of-plane buckling are roadmap. |
| Feedstock model thinner than literature | **partial** | Still E and σy as correlated lognormal; adds measurement CV but not filler fraction, elongation, density, moisture, contamination, spatial voids/cold welds, or non-lognormal tails. These are named limitations and roadmap inputs. |
| Model-form error listed, not sized | **partial** | Validation additions (cell-size refinement, pin-jointed truss vs frame, compression/creep bound) quantify the model-form band; results in `validation/VALIDATION.md` and the report. |
| Mass/mesh/provenance leaks into the claim | **fixed/partial** | Mass basis corrected and disclosed (union estimate headline, analytic bound labelled); mesh/cell-size check added; feedstock moments are still literature presets and labelled provisional. |

## Use case

| Review point | Status | What changed |
|---|---|---|
| One part/process/load; arbitrary CAD not supported | **partial** | Family scope is now explicit everywhere; catalog expansion (bracket, clip, panel, cage strut each with its own load case) is roadmap. |
| Plant input is MFI/density/grade, not E/CV; proxy is the product | **partial** | Measurement CV + optional lot identity/source are captured; the lot quality index remains a documented proxy (no calibrated MFI→E relation yet). A calibrated proxy with its own error bar is roadmap. |
| Output should be printer instruction + quality decision | **partial** | Proof now exposes 8 width multipliers, global-equivalent extrusion multiplier, re-slice note, pass/compensate/reject verdict, added mass %, and a QC record (lot ID, supplier, measurement used + CV, recycled-content % marked paperwork claim). Scrap cost / accept-thicken-reject economics are roadmap. |
| Business trade next to reliability | **roadmap** | Not implemented; cost-per-accepted-kg, rejection cost, virgin-blend comparison are listed as the next product step. |
| Keep recycled-content compliance out of solver, in record | **fixed** | QC/record fields carry lot identity, supplier and measurement; report states recycled-content % is a paperwork claim, not something the solver can satisfy. |
| Constrain AI to decisions the engine can refuse | **fixed/partial** | Brief now runs an engine feasibility gate before Design (widest printable lattice vs target; if infeasible the Design button is blocked and no plan call is made). Prompts and memos scoped to family and measured-lot uncertainty; proof memos stay number-grounded. The AI is never allowed to override the engine's pass/reject decision. |

## Highest-leverage sequence from the review

1. **Fix mass so rankings are honest** — union estimate is now the reported/selection mass; full union objective in the inner loop is roadmap.
2. **Printability and measurement error inside the constraint** — done (enforced printability; measurement CV retained).
3. **Replace uniform compensation with lot-specific resize** — done (8 control multipliers).
4. **One physical coupon comparison and one real incoming-inspection input** — coupon pre-registration done; physical test and calibrated MFI proxy remain roadmap (no lab access).

Until the roadmap items exist, AnyRB is a **design-stage calculator and virtual qualification aid for one bracket/lattice family**, not a general qualification method for upcycled products.

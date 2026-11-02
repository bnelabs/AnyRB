# AnyRB v0.4 — remaining-gaps release (from second external review)

Second review inspected commit 793c1bd (18:03), before v0.3. Many claims are already fixed at HEAD:
union mass/selection, measurement CV, 8-control lot-specific resize, enforced printability,
53-check validation with mesh/pin-joint model-form checks, coupon pre-registration, feasibility gate.
v0.4 fixes the genuinely remaining open items.

## 1. Printed-process gate
- `Material.print_process_ok` true only for FDM/FFF data.
- `family_feasibility` returns `{process_ok:false, feasible:false, reason:"process_mismatch"}` for IM/compression presets.
- App blocks Design for non-printed presets; presets remain visible only as contrast, clearly labelled.
- rPETG default is FDM/printed.

## 2. Elongation / brittle-lot screen
- Material carries printed elongation-at-break mean/CV (from data/feedstock_library.json):
  rPETG 4.0%/0.20; rPET 3.5/0.25; rHDPE 14/0.30; rPP 25/0.45.
- `evaluate()` returns `strain_req` (peak tensile strain at mean E), `pf_brittle`, `pf_brittle_bound`.
- `failure_probability_elongation` is a marginal lognormal screen. It is reported as a
  **conservative add-on**, not folded into the headline two-property P_f yet (E–elongation
  correlation is assumed -0.25); app/report must label this explicitly and flag brittle lots.

## 3. Union-mass final polish
- Global multi-start search still uses analytic mass (disclosed).
- A short local pattern search then minimises the printed Halton union mass (10k samples)
  subject to target P_f + printability; accepts only if final 60k printed mass improves.
- DesignResult exposes `union_polished` / `union_evals`.

## 4. Assumption bounds
- `assumption_bounds`: varies corr(lnE,ln sy) 0.30/0.70 and lot-vs-within split 75/95%,
  reports P_f range. Label as assumption sensitivity, not validation.
- Report shows the range; app shows a compact band.

## 5. Lot identity / QC record
- App Prove/export already carries lot ID, supplier, measurement source/CV, recycled-content
  paperwork claim; report states design-stage report has no delivered lot and points to export.

## Non-goals / roadmap (unchanged)
Plant MFI/density→E/σy proxy calibration, scrap/reject cost economics, alternative cell/skin
topologies, general CAD/part family, separate tensile/compressive allowables, physical coupon test.

# AnyRB — coupon / bracket blind-validation plan (L3+ path)

**Status: PRE-REGISTERED. No physical test has been performed. No measured data exists in this repository.**
Every number below is a *model prediction* frozen before testing; the machine-readable package is
[`coupon_predictions.json`](coupon_predictions.json) with pre-registration hash
`sha256:641825c85beec59c147e258c89ee9e373e99b036c83edeeedd9aad7a0abe51e5`
(over the canonical payload without the hash field; verified by check L1 in `run_validation.py`).

## Why this plan exists

AnyRB's claim level is **L0–L1 (code and solution verification) with partial L2**. The only path to L3/L4
is blind comparison with physical specimens, made under a protocol that cannot be quietly retuned after
the data arrive. This plan freezes the geometry, material model, predictions, uncertainty bands, test
protocol and acceptance criteria *before* any test. It is the concrete form of the stance in
[`research/05`](../research/05-validation-without-physical-testing.md): *"no testing needed to make the
design decision, and here is exactly what testing would change."*

## Specimens (two families, both frozen)

| | **Coupon 3×2** | **Bracket 7×3 (shipped robust design)** |
|---|---|---|
| Geometry | 3 × 2 cells of the 20 mm X-braced family, uniform 2.0 mm struts, 10 mm clamp pad; envelope 70 × 40 × 10 mm | 7 × 3 cells, 150 × 60 × 10 mm lattice + 10 mm pad; width-field controls frozen in `coupon_predictions.json` (`bracket_7x3_robust.controls`) |
| Material | rPETG preset (printed in-plane: E = 2100 MPa, CV 0.10; σy = 46 MPa, CV 0.10; ρ = 1.24 g/cm³; log-correlation 0.55; lot/within variance 85/15) | same |
| Predicted tip stiffness | **349.4 N/mm** (tip deflection 0.43 mm at 150 N, E = 2100 MPa) | **74.6 N/mm** (tip deflection 2.01 mm at 150 N) |
| Predicted first-yield load | **689.7 N** (σy = 46 MPa) | **366.9 N** |
| Mass basis | printed union 22.0 g (analytic upper bound 24.3 g) | printed union 46.4 g (analytic upper bound 50.81 g) |
| Predicted peak tensile strain / brittle screen | **0.476%** strain demand at 150 N vs elongation 4.0% CV 0.20 → marginal `pf_brittle` ≈ 0 | **0.896%** strain demand at 150 N, marginal `pf_brittle` ≈ 3e-16 (add-on bound 0.00996; joint three-property probability not claimed) |
| 90% material prediction interval | stiffness ×[0.86, 1.16]; first-yield ×[0.86, 1.16]; elongation 4.0% ×[0.86, 1.16] | same factors |
| Model-form band | cell-size band from J1 (not transferred blindly) | frame vs pin-jointed truss: tip stiffness ×1.004; strength demand ×1.14 (J2) |

Uncertainty sources are separated deliberately: **material lot-to-lot** (90% lognormal prediction
interval from the preset CV) and **model form** (cell-size J1, joint stiffness J2). They are not collapsed
into a single fudge factor.

## Test protocol (informed by, but not certified to, the named standards)

1. **Specimens:** coupon n = 5 per build orientation × 3 lots; bracket n = 5 per lot × 3 lots. Record
   build orientation and process parameters (ISO/ASTM 52921; reporting per ASTM F2971); record lot ID,
   supplier, measured proxies and the measurement CV used by the passport.
2. **Conditioning:** 23 ± 2 °C, 50 ± 10 % RH, ≥ 48 h (ISO 291 practice).
3. **Fixture:** cantilever — clamp the 10 mm pad face, distribute the load over the tip nodes, measure
   tip deflection with an LVDT and load with a calibrated load cell. Measure and subtract fixture
   compliance.
4. **Loading:** quasi-static, 1 mm/min; load to 150 N (design load) for stiffness, then continue to
   first yield (load–deflection slope break). Do not exceed the fixture range.
5. **Elongation / brittle screen:** printed tensile coupons per ISO 527-2 practice (n = 5 per lot,
   same build orientation matrix) to measure elongation at break. This tests the brittle-lot prior
   (rPETG 4.0% mean, CV 0.20); a brittle lot must be shown with the marginal `pf_brittle` add-on,
   never folded silently into the headline two-property P_f.
5. **Calibration:** load cell to ISO 7500-1 class 1 or better; displacement reference calibrated.
6. **Blinding:** this plan and `coupon_predictions.json` (hash above) are frozen before testing; no model
   tuning is permitted between testing and the first comparison report.
7. **Standards note:** this is *not* a standardised test for a bespoke lattice geometry. ASTM D790-style
   flexural practice, ISO 291 conditioning, ISO 7500-1 calibration and ISO/ASTM 52921 + ASTM F2971
   reporting are used as practice references, not as certification.

## Acceptance criteria (pre-registered; a failure is a finding, not a fudge)

| Criterion | Threshold |
|---|---|
| Tip stiffness per specimen | within **±25%** of the frozen prediction for ≥ 4/5 specimens per lot; lot mean within ±15% |
| First-yield load per specimen | within **−25% / +35%** of the frozen prediction for ≥ 4/5 specimens per lot |
| Elongation / brittle | measured elongation at break within the printed-elongation prior band (rPETG 4.0% ×[0.86, 1.16]); lot-to-lot spread comparable to the assumed CV 0.20 |
| Interval coverage | the 90% material prediction interval contains ≥ 80% of specimen values across lots |
| Ranking | coupon vs bracket rank order preserved |
| Failure action | report the discrepancy and calibrate an explicit model-discrepancy term; **never** absorb it into the material modulus or edit the pre-registration |

## What passing would and would not establish

Passing would also test the brittle-screen prior and give the first measured elongation distribution for
this printed recyclate. Passing would support **L4 (component validation)** for this geometry, process and material class only,
and would justify L2→L3 evidence for the material model. It would **not** certify the product, establish
production reliability, qualify sustained/creep loading (the K1 advisory bound fails the static allowable),
or satisfy ISO/ASTM/UL/PPWR compliance requirements. Failing would be equally informative: it converts the
model-form bands in `VALIDATION.md` into a measured discrepancy and sets the next iteration.

## Files

- [`coupon_predictions.json`](coupon_predictions.json) — frozen predictions, uncertainty bands, protocol,
  acceptance criteria, SHA-256 pre-registration hash.
- [`compare_measurements.py`](compare_measurements.py) — ingests the measurement CSV and reports errors vs
  the frozen predictions (`--template` writes a blank CSV; no data is fabricated).
- [`VALIDATION.md`](VALIDATION.md) — independent verification report (claim ladder, model-form bands).
- Regenerate predictions only by re-issuing the pre-registration:
  `.venv/bin/python validation/generate_coupon_prereg.py` (check L1 then flags the hash/prediction change).

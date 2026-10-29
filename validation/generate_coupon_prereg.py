#!/usr/bin/env python3
"""Generate the AnyRB pre-registered coupon/bracket blind-prediction package.

This is the L3+ path: predictions, uncertainty bands, test protocol and
acceptance criteria are FROZEN (SHA-256 pre-registration hash) before any
physical test exists.  No measured data is created or implied.  Re-running this
script intentionally re-issues the pre-registration; if only the engine changed,
the L1 check in run_validation.py will flag the prediction drift.

    cd anyrb && .venv/bin/python validation/generate_coupon_prereg.py
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT / "engine"))

# Load the validation suite's own independent models (module has a __main__ guard).
_spec = importlib.util.spec_from_file_location("rv", HERE / "run_validation.py")
rv = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rv)

from anyrb.lattice import (build_lattice, mass_g, printed_mass_g,
                           widths_from_controls)
from anyrb.materials import PRESETS
from anyrb.mechanics import evaluate
from anyrb.reliability import failure_probability_elongation

F_DESIGN = 150.0


def material_interval(mat, cv_total: float, confidence: float = 0.90) -> list:
    """Arithmetic-value 90% prediction interval for a lognormal property whose
    lot-to-lot scatter is cv_total (log-space sigma)."""
    sig = np.sqrt(np.log1p(cv_total ** 2))
    z = 1.6448536269514722 if confidence == 0.90 else 1.959963984540054
    return [float(np.exp(-z * sig)), float(np.exp(z * sig))]


def build_payload() -> dict:
    mat = PRESETS["rpetg"]
    summary = json.loads((ROOT / "reports" / "summary.json").read_text())
    ctl = np.asarray(summary["robust"]["controls"], float)
    lat = build_lattice()
    wd = widths_from_controls(ctl, lat.midpoints)

    # --- bracket specimen: frozen robust design ---------------------------
    r = evaluate(mat, ctl, printed=False)
    d = r["demands"]
    k_b = mat.E_mean / d.u_tip_unit                     # N/mm
    fy_b = mat.sy_mean / (d.sigma_req / F_DESIGN)       # N
    printed_b = printed_mass_g(lat, wd, mat.rho)
    analytic_b = mass_g(lat, wd, mat.rho)
    cv_lot_E = mat.E_cv * mat.lot_fraction
    cv_lot_s = mat.sy_cv * mat.lot_fraction
    band_e = material_interval(mat, cv_lot_E)
    band_s = material_interval(mat, cv_lot_s)

    # --- coupon specimen: 3x2 X-braced coupon, uniform 2.0 mm -------------
    gen = rv.generic_lattice(3, 2, pad=10.0, wide=70.0, tall=40.0)
    wc = widths_from_controls(rv.uniform_controls(2.0), gen.midpoints)
    gc = rv.generic_demands(gen, wc, 3, 2)
    k_c = mat.E_mean / gc["u_tip_unit"]
    fy_c = mat.sy_mean / (gc["sigma_req"] / F_DESIGN)
    printed_c = printed_mass_g(gen, wc, mat.rho)

    # --- model-form bands from the independent J2 (frame vs truss) --------
    gen7 = rv.generic_lattice(7, 3)
    w7 = widths_from_controls(ctl, gen7.midpoints)
    fr = rv.generic_demands(gen7, w7, 7, 3)
    tr = rv.truss_demands(gen7, w7, 7, 3)
    k_ratio = fr["u_tip_unit"] / tr["u_tip_unit"]        # frame is stiffer if <1
    strength_ratio = fr["sigma_req"] / tr["sigma_req"]
    k_ratio_value = (1.0 / k_ratio)                      # stiffness frame/truss

    payload = {
        "suite": "AnyRB coupon / bracket pre-registration (L3+ path)",
        "brand": "AnyRB",
        "version": "v0.3",
        "created_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "status": "PRE-REGISTERED BLIND PREDICTIONS. No physical test has been performed; "
                  "no measured data is included or implied.",
        "engine": {
            "reference": "engine/anyrb (Python reference implementation)",
            "fixture_note": "predictions frozen from the v0.3 engine; if the engine changes, "
                            "re-issue this pre-registration and update the hash",
        },
        "material": {
            "preset": "rpetg",
            "name": mat.name,
            "process": mat.process,
            "E_mean_MPa": mat.E_mean, "E_cv": mat.E_cv,
            "sy_mean_MPa": mat.sy_mean, "sy_cv": mat.sy_cv,
            "rho_g_cm3": mat.rho, "corr_log": mat.corr,
            "lot_fraction": mat.lot_fraction,
            "within_fraction": mat.within_fraction,
            "elongation_mean_pct": mat.elongation_mean,
            "elongation_cv": mat.elongation_cv,
            "corr_E_elong": mat.corr_E_elong,
            "provenance": list(mat.sources),
        },
        "specimens": {
            "coupon_3x2": {
                "description": "3 x 2 cell X-braced lattice coupon cut from the same 20 mm cell "
                               "family, uniform 2.0 mm struts, 10 mm solid clamp pad",
                "geometry": {"cells_x": 3, "cells_y": 2, "cell_mm": 20.0,
                             "envelope_mm": [70.0, 40.0, 10.0],
                             "nominal_width_mm": 2.0,
                             "topology": "X-braced, both diagonals per cell, rigid nodes"},
                "predicted": {
                    "tip_stiffness_N_per_mm": float(k_c),
                    "tip_deflection_at_150N_mm": float(gc["u_tip_mean_mm"]),
                    "first_yield_load_N": float(fy_c),
                    "sigma_req_at_150N_MPa": float(gc["sigma_req"]),
                    "E_req_at_150N_MPa": float(gc["E_req"]),
                    "printed_mass_g": float(printed_c),
                    "analytic_mass_g": float(gc["volume_mm3"] * mat.rho / 1000.0),
                    "strain_req_pct": float(100.0 * gc["sigma_req"] / mat.E_mean),
                    "pf_brittle": float(failure_probability_elongation(
                        mat, gc["sigma_req"] / mat.E_mean, level="lot")),
                    "elongation_mean_pct": float(mat.elongation_mean),
                },
                "uncertainty": {
                    "material_90pct_interval_tip_stiffness_N_per_mm":
                        [k_c * band_e[0], k_c * band_e[1]],
                    "material_90pct_interval_first_yield_load_N":
                        [fy_c * band_s[0], fy_c * band_s[1]],
                    "model_form_note": "coupon is the reference 7x3 family scaled to 3x2 cells; "
                                       "cell-size band (J1) does not transfer blindly",
                },
            },
            "bracket_7x3_robust": {
                "description": "shipped v0.3 robust design, frozen width-field controls",
                "controls": [float(c) for c in ctl],
                "widths_mm": [float(w) for w in wd],
                "printability": rv.printability_report(lat, wd),
                "predicted": {
                    "tip_stiffness_N_per_mm": float(k_b),
                    "tip_deflection_at_150N_mm": float(r["u_tip_mean_mm"]),
                    "first_yield_load_N": float(fy_b),
                    "sigma_req_at_150N_MPa": float(d.sigma_req),
                    "E_req_at_150N_MPa": float(d.E_req),
                    "printed_mass_g": float(printed_b),
                    "analytic_mass_g": float(analytic_b),
                    "static_Pf_rpetg_lot": float(r["pf"]),
                    "strain_req_pct": float(100.0 * r["strain_req"]),
                    "pf_brittle": float(r["pf_brittle"]),
                    "pf_brittle_bound": float(r["pf_brittle_bound"]),
                    "elongation_mean_pct": float(mat.elongation_mean),
                    "brittle_note": "marginal brittle screen; joint 3-property probability not claimed "
                                    "(E-elongation correlation assumed -0.25)",
                },
                "uncertainty": {
                    "material_90pct_interval_tip_stiffness_N_per_mm":
                        [k_b * band_e[0], k_b * band_e[1]],
                    "material_90pct_interval_first_yield_load_N":
                        [fy_b * band_s[0], fy_b * band_s[1]],
                    "model_form_band": {
                        "tip_stiffness_frame_over_truss": float(k_ratio_value),
                        "strength_demand_frame_over_truss": float(strength_ratio),
                        "source": "independent J2 pin-jointed truss vs rigid frame (validation suite)",
                    },
                    "acceptance_band": {
                        "tip_stiffness_relative": [-0.25, 0.25],
                        "first_yield_load_relative": [-0.25, 0.35],
                        "rationale": "first campaign: material 90% PI (~±16%) plus joint/model-form band "
                                     "(frame may over-predict strength demand by up to 14%)",
                    },
                },
            },
        },
        "test_protocol": {
            "specimen_count": {"coupon_3x2": "n=5 per build orientation x 3 lots",
                               "bracket_7x3_robust": "n=5 per lot x 3 lots"},
            "fixture": "cantilever: clamp the 10 mm pad face; distribute load over the tip nodes; "
                       "measure tip deflection with an LVDT and load with a calibrated load cell",
            "loading": "quasi-static, 1 mm/min, load to the 150 N design load then to first yield "
                       "(load-deflection slope break); do not exceed the fixture range",
            "conditioning": "23 +/- 2 C, 50 +/- 10 % RH, >= 48 h (ISO 291)",
            "calibration": "load cell calibrated per ISO 7500-1 class 1 or better; fixture compliance "
                           "measured and subtracted",
            "reporting": "record build orientation and process parameters (ISO/ASTM 52921, ASTM F2971), "
                         "lot ID, supplier, measured proxy values and measurement CV",
            "elongation": "extrusion-printed tensile coupons per ISO 527-2 (n=5 per lot) to measure "
                          "elongation at break and test the brittle-lot screen; record strain at peak",
            "blindness": "predictions and acceptance criteria are frozen (this file's hash) before testing; "
                         "no post-hoc model tuning before the comparison report is written",
            "standards_note": "protocol is informed by ASTM D790-style flexural practice, ISO 291 conditioning, "
                              "ISO 7500-1 calibration and ISO/ASTM 52921 / ASTM F2971 reporting; it is not a "
                              "certified test method for this bespoke lattice geometry",
        },
        "acceptance_criteria": {
            "stiffness": "measured tip stiffness within [-25%, +25%] of the frozen predicted value for "
                         ">= 4/5 specimens per lot; mean within [-15%, +15%]",
            "first_yield": "measured first-yield load within [-25%, +35%] of the frozen predicted value "
                           "for >= 4/5 specimens per lot",
            "coverage": "the 90% material prediction interval should contain >= 80% of specimen values "
                        "across lots; failure to cover widens the feedstock prior, it does not justify a "
                        "point prediction",
            "brittle": "measured elongation at break within the printed-elongation prior band "
                       "(4.0% x[0.86,1.16] for rPETG); if the lot is brittle, the marginal brittle P_f "
                       "must be reported as an add-on, never silently folded into the headline P_f",
            "trend": "rank order of the two specimen families (coupon vs bracket) must be preserved",
            "failure_action": "a criterion failure is reported as a validation finding with the discrepancy, "
                              "not absorbed into a fudge factor; model discrepancy is calibrated explicitly",
        },
        "decision_and_updating": {
            "procedure": "pre-registered blind comparison -> disconfirmation review -> Bayesian model updating "
                         "with an explicit discrepancy term -> re-issued prediction package",
            "claim_effect": "passing this campaign would support L4 (component validation) for this geometry, "
                            "process and material class only; it would not certify the product",
            "data_handling": "measured CSV is ingested with validation/compare_measurements.py and appended to "
                             "the comparison record; the pre-registration hash is never edited",
        },
    }
    return payload


def main() -> int:
    payload = build_payload()
    canon = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    digest = "sha256:" + hashlib.sha256(canon).hexdigest()
    payload["pre_registration_hash"] = digest
    out = HERE / "coupon_predictions.json"
    out.write_text(json.dumps(payload, indent=1))
    print(f"wrote {out} ({out.stat().st_size} bytes)")
    print(f"pre_registration_hash = {digest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

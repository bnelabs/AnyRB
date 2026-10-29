"""Generate cross-language reference fixtures for the JS demo engine.

Writes app/tests/fixtures/reference.json.  The JS implementation of the FE
model + reliability must reproduce the deterministic fields to ~1e-6 relative in the test
(and P_f ~1e-8 absolute, because it solves the same closed form).
"""
from __future__ import annotations

import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from anyrb.lattice import (build_lattice, widths_from_controls, uniform_controls, printability_report,
                              NX, NY, PAD_LEN, CELL, DEPTH, HEIGHT, LENGTH,
                              W_MIN, W_MAX, U_LIMIT, F_DESIGN)
from anyrb.materials import PRESETS
from anyrb.mechanics import evaluate, demands
from anyrb.reliability import phi2, failure_probability
from anyrb.optimize import optimize_robust

OUT = os.path.join(HERE, "..", "app", "tests", "fixtures", "reference.json")
os.makedirs(os.path.dirname(OUT), exist_ok=True)

lat = build_lattice()

# deterministic designs ------------------------------------------------------
designs = [
    ("uniform_w2.0", "rpetg", uniform_controls(2.0)),
    ("uniform_w1.5", "rpetg", uniform_controls(1.5)),
    ("uniform_w2.5", "rpet", uniform_controls(2.5)),
    ("graded_custom", "rpetg",
     np.log(np.array([[2.4, 1.9, 1.5, 1.2],
                      [2.2, 1.8, 1.4, 1.15]])).ravel()),
]

cases = []
for name, mat_key, controls in designs:
    mat = PRESETS[mat_key]
    r = evaluate(mat, controls)
    d = r["demands"]
    sol = None
    case = {
        "name": name,
        "material": mat_key,
        "controls": np.asarray(controls, float).tolist(),
        "widths_mm": r["widths"].tolist(),
        "mass_g": r["mass_g"],
        "mass_analytic_g": r["mass_analytic_g"],
        "printed_mass_g": r["printed_mass_g"],
        "printability": printability_report(lat, r["widths"]),
        "sigma_req_MPa": r["sigma_req_MPa"],
        "E_req_MPa": r["E_req_MPa"],
        "E_req_def_MPa": r["E_req_def_MPa"],
        "E_req_buck_MPa": r["E_req_buck_MPa"],
        "u_tip_unit_mm": r["u_tip_unit_mm"],
        "u_tip_mean_mm": r["u_tip_mean_mm"],
        "pf": r["pf"],
        "reliability": 1.0 - r["pf"],
    }
    if name == "uniform_w2.0":
        from anyrb.mechanics import solve_unit
        sol = solve_unit(lat, r["widths"], F_total=1.0, E=1.0)
        case["member_forces_unit_load"] = {
            "N": sol["N"].tolist(),
            "M1": sol["M1"].tolist(),
            "M2": sol["M2"].tolist(),
            "u_tip": sol["u_tip"],
        }
    cases.append(case)

# add a robust-optimised design for the default preset -----------------------
robust = optimize_robust(PRESETS["rpetg"], 0.01)
r = evaluate(PRESETS["rpetg"], robust.controls)
cases.append({
    "name": "robust_optimised",
    "material": "rpetg",
    "controls": np.asarray(robust.controls, float).tolist(),
    "widths_mm": r["widths"].tolist(),
    "mass_g": r["mass_g"],
    "mass_analytic_g": r["mass_analytic_g"],
    "printed_mass_g": r["printed_mass_g"],
    "printability": printability_report(lat, r["widths"]),
    "sigma_req_MPa": r["sigma_req_MPa"],
    "E_req_MPa": r["E_req_MPa"],
    "E_req_def_MPa": r["E_req_def_MPa"],
    "E_req_buck_MPa": r["E_req_buck_MPa"],
    "u_tip_unit_mm": r["u_tip_unit_mm"],
    "u_tip_mean_mm": r["u_tip_mean_mm"],
    "pf": r["pf"],
    "reliability": 1.0 - r["pf"],
})

# reliability closed-form checks -------------------------------------------
phi2_checks = []
for a, b, rho in [(-2.5, 1.2, 0.6), (0.3, -1.1, 0.0), (1.9, 2.2, 0.9),
                  (-0.5, -0.5, 0.3), (-6.0, -1.0, 0.55), (0.0, 0.0, 0.4)]:
    phi2_checks.append({"a": a, "b": b, "rho": rho, "value": phi2(a, b, rho)})

# material table ------------------------------------------------------------
materials = {}
for k, m in PRESETS.items():
    materials[k] = {
        "id": m.id, "name": m.name, "process": m.process,
        "E_mean": m.E_mean, "E_cv": m.E_cv,
        "sy_mean": m.sy_mean, "sy_cv": m.sy_cv,
        "rho": m.rho, "corr": m.corr,
        "lot_fraction": m.lot_fraction, "within_fraction": m.within_fraction,
        "sources": list(m.sources),
    }

fixture = {
    "generated_by": "anyrb/engine/make_fixtures.py",
    "engine_version": "0.1",
    "geometry": {
        "LENGTH": LENGTH, "HEIGHT": HEIGHT, "DEPTH": DEPTH,
        "PAD_LEN": PAD_LEN, "CELL": CELL, "NX": NX, "NY": NY,
        "W_MIN": W_MIN, "W_MAX": W_MAX, "U_LIMIT": U_LIMIT, "F_DESIGN": F_DESIGN,
        "ctrl_x": [0.0, 1 / 3, 2 / 3, 1.0], "ctrl_y": [0.0, 1.0],
        "nodes": lat.nodes.tolist(),
        "elements": lat.elements.tolist(),
        "lengths": lat.lengths.tolist(),
        "angles": lat.angles.tolist(),
        "midpoints": lat.midpoints.tolist(),
        "pad_volume_mm3": 6000.0,
    },
    "materials": materials,
    "default_material": "rpetg",
    "default_design": "uniform_w2.0",
    "cases": cases,
    "phi2_checks": phi2_checks,
    "notes": [
        "pf is the closed-form P(sy < sigma_req OR E < E_req) using 'lot' level.",
        "All stresses MPa, modulus MPa, lengths mm, mass g, forces N.",
        "Forces are independent of E for a single-material frame; the JS unit solve must match.",
    ],
}

with open(OUT, "w") as f:
    json.dump(fixture, f, indent=1)
print(f"wrote {OUT} ({os.path.getsize(OUT)} bytes), {len(cases)} cases")
for c in cases:
    print(f"  {c['name']:18s} mat={c['material']:6s} mass={c['mass_g']:7.2f}g "
          f"pf={c['pf']:.6f} sigma_req={c['sigma_req_MPa']:6.3f} E_req={c['E_req_MPa']:8.2f}")

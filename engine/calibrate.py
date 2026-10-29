"""Scratch calibration: check FE against analytical beam, then sweep widths."""
import sys
import numpy as np

sys.path.insert(0, "engine")

from anyrb.lattice import (build_lattice, widths_from_controls, uniform_controls,
                              mass_g, W_MIN, W_MAX, DEPTH, U_LIMIT, F_DESIGN)
from anyrb.mechanics import (demands, solid_demands, _local_stiffness, _transform,
                                N_DOF, evaluate, solve_unit)
from anyrb.materials import PRESETS
from anyrb.reliability import failure_probability, monte_carlo

# --- 1. single-element cantilever vs Euler-Bernoulli -----------------------
E, L, w, t = 2000.0, 100.0, 2.0, 10.0
A, I = t * w, t * w ** 3 / 12
kl = _local_stiffness(E, A, I, L)
T = _transform(1.0, 0.0)
kg = T.T @ kl @ T
K = kg[3:, 3:]  # free node dofs (u,v,theta)
f = np.array([0.0, -1.0, 0.0])
u = np.linalg.solve(K, f)
u_exact = -1.0 * L ** 3 / (3 * E * I)
print(f"single element cantilever: FE {u[1]:.9f} mm vs exact {u_exact:.9f} mm  "
      f"rel err {abs(u[1]-u_exact)/abs(u_exact):.2e}")

# --- 2. bracket sweep ------------------------------------------------------
lat = build_lattice()
print(f"\nnodes={lat.nodes.shape[0]} elements={lat.elements.shape[0]} "
      f"DOF={N_DOF} pad_volume={None}")
print("\nuniform width sweep (rPETG, F=150 N, u_lim=2.5 mm):")
print(" w    mass_g   sigma_req  E_req   u_tip_mean  pf(lot)  pf(within)")
p = PRESETS["rpetg"]
for w in (1.0, 1.5, 2.0, 2.5, 3.0, 4.0):
    c = uniform_controls(w)
    r = evaluate(p, c)
    print(f"{w:4.1f} {r['mass_g']:8.1f} {r['sigma_req_MPa']:9.2f} "
          f"{r['E_req_MPa']:9.1f} {r['u_tip_mean_mm']:9.3f}  "
          f"{r['pf']:8.4f} {failure_probability(p, r['sigma_req_MPa'], r['E_req_MPa'], level='within'):8.4f}")

print("\nelement counts by kind:", np.bincount(lat.kind))

d = demands(lat, widths_from_controls(uniform_controls(2.0), lat.midpoints))
print(f"\nE_req_def={d.E_req_def:.1f} E_req_buck={d.E_req_buck:.1f} "
      f"u_tip_unit={d.u_tip_unit:.6f}")
print(f"sigma unit max {d.sigma_unit.max():.6f} MPa/N -> {d.sigma_req:.2f} MPa at 150 N")

# solid baseline
sd = solid_demands(p.rho)
print(f"\nsolid: mass={sd.mass_g:.1f} g sigma_req={sd.sigma_req:.2f} MPa "
      f"E_req={sd.E_req:.1f} MPa pf={failure_probability(p, sd.sigma_req, sd.E_req):.3e}")

# --- 3. reliability cross-checks ------------------------------------------
print("\nreliability analytic vs MC:")
for w in (1.5, 2.0, 2.5, 3.0):
    r = evaluate(p, uniform_controls(w))
    mc = monte_carlo(p, r['sigma_req_MPa'], r['E_req_MPa'], n=200000, seed=7)
    print(f" w={w:.1f} analytic={r['pf']:.5f}  MC={mc.pf:.5f} +/- {mc.pf_stderr:.5f}  "
          f"margin P5/mean={mc.robustness_index:.3f}")

# --- 4. preset comparison at w=2.5 ---------------------------------------
print("\npresets, uniform w=2.5:")
for key, mat in PRESETS.items():
    r = evaluate(mat, uniform_controls(2.5))
    print(f"{key:6s} mass={r['mass_g']:6.1f}g sigma_req={r['sigma_req_MPa']:6.2f} "
          f"E_req={r['E_req_MPa']:7.1f} u={r['u_tip_mean_mm']:.3f} pf={r['pf']:.4f}")

# --- 5. gradient design quick check --------------------------------------
c = np.log(np.array([[3.5, 2.5, 2.0, 1.4],
                     [3.5, 2.5, 2.0, 1.4]]))
r = evaluate(p, c.ravel())
print(f"\ngraded design mass={r['mass_g']:.1f}g sigma_req={r['sigma_req_MPa']:.2f} "
      f"E_req={r['E_req_MPa']:.1f} pf={r['pf']:.4f}")

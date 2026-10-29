"""2D plane-frame finite element model of the reference bracket.

Model
-----
32 nodes, 3 DOF per node, 94 Euler-Bernoulli frame elements (7x3 X-braced
cells + solid wall-pad face at x = 10 mm).  A unit total tip load is applied
(0.25 N per tip node); because the part is a single material, internal forces
are independent of E and displacements scale as 1/E.  That lets us evaluate a
design once and then compute the material demands of any batch analytically.

All units: mm, N, MPa.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .lattice import (DEPTH, F_DESIGN, HEIGHT, LENGTH, NX, NODES_X, NODES_Y,
                      PAD_LEN, PAD_VOLUME, U_LIMIT, Lattice, build_lattice,
                      mass_g, widths_from_controls)

N_DOF = 3 * (NODES_X * NODES_Y)


@dataclass
class Demands:
    """Material requirements imposed by one geometry at a given load."""
    sigma_req: float      # required yield stress (MPa) for the design load
    E_req: float          # required Young's modulus (MPa), max of deflection/buckling
    E_req_def: float      # stiffness requirement from tip deflection limit
    E_req_buck: float     # stiffness requirement from Euler buckling of struts
    u_tip_unit: float     # tip deflection for F=1 N and E=1 MPa (mm)
    sigma_unit: np.ndarray  # per-element stress demand per unit load (MPa/N)
    N_unit: np.ndarray    # per-element axial force per unit load (N/N)
    M_unit: np.ndarray    # per-element max end moment per unit load (N*mm/N)
    util_y: np.ndarray    # per-element |sigma| / sigma_req (0..1)
    util_b: np.ndarray    # per-element buckling utilisation at E=E_req
    widths: np.ndarray


def _local_stiffness(E: float, A: float, I: float, L: float) -> np.ndarray:
    ea = E * A / L
    a = 12.0 * E * I / L ** 3
    b = 6.0 * E * I / L ** 2
    c = 4.0 * E * I / L
    d = 2.0 * E * I / L
    return np.array([
        [ea, 0.0, 0.0, -ea, 0.0, 0.0],
        [0.0, a, b, 0.0, -a, b],
        [0.0, b, c, 0.0, -b, d],
        [-ea, 0.0, 0.0, ea, 0.0, 0.0],
        [0.0, -a, -b, 0.0, a, -b],
        [0.0, b, d, 0.0, -b, c],
    ])


def _transform(c: float, s: float) -> np.ndarray:
    return np.array([
        [c, s, 0.0, 0.0, 0.0, 0.0],
        [-s, c, 0.0, 0.0, 0.0, 0.0],
        [0.0, 0.0, 1.0, 0.0, 0.0, 0.0],
        [0.0, 0.0, 0.0, c, s, 0.0],
        [0.0, 0.0, 0.0, -s, c, 0.0],
        [0.0, 0.0, 0.0, 0.0, 0.0, 1.0],
    ])


def solve_unit(lattice: Lattice, widths: np.ndarray,
               F_total: float = 1.0, E: float = 1.0) -> dict:
    """Solve the frame for a total downward tip load F_total (E may be 1)."""
    n = lattice.nodes.shape[0]
    K = np.zeros((N_DOF, N_DOF))
    A = DEPTH * widths
    I = DEPTH * widths ** 3 / 12.0
    kl_list = []
    T_list = []
    for e in range(lattice.elements.shape[0]):
        kl = _local_stiffness(E, A[e], I[e], lattice.lengths[e])
        T = _transform(np.cos(lattice.angles[e]), np.sin(lattice.angles[e]))
        kg = T.T @ kl @ T
        n1, n2 = lattice.elements[e]
        dofs = np.array([3 * n1, 3 * n1 + 1, 3 * n1 + 2,
                         3 * n2, 3 * n2 + 1, 3 * n2 + 2])
        K[np.ix_(dofs, dofs)] += kg
        kl_list.append(kl)
        T_list.append(T)

    fixed_nodes = [j * NODES_X for j in range(NODES_Y)]        # x = PAD_LEN
    tip_nodes = [j * NODES_X + NX for j in range(NODES_Y)]     # x = LENGTH
    fixed = np.array([3 * n + k for n in fixed_nodes for k in range(3)], dtype=int)
    free = np.setdiff1d(np.arange(N_DOF), fixed)

    f = np.zeros(N_DOF)
    for n in tip_nodes:
        f[3 * n + 1] -= F_total / len(tip_nodes)

    u = np.zeros(N_DOF)
    u[free] = np.linalg.solve(K[np.ix_(free, free)], f[free])

    N = np.empty(lattice.elements.shape[0])
    M1 = np.empty_like(N)
    M2 = np.empty_like(N)
    for e, (n1, n2) in enumerate(lattice.elements):
        dofs = np.array([3 * n1, 3 * n1 + 1, 3 * n1 + 2,
                         3 * n2, 3 * n2 + 1, 3 * n2 + 2])
        fl = kl_list[e] @ (T_list[e] @ u[dofs])
        N[e] = 0.5 * (fl[3] - fl[0])
        M1[e] = fl[2]
        M2[e] = fl[5]

    v_tip = np.array([u[3 * n + 1] for n in tip_nodes])
    return {"u": u, "N": N, "M1": M1, "M2": M2,
            "u_tip": float(np.max(np.abs(v_tip))),
            "fixed_nodes": fixed_nodes, "tip_nodes": tip_nodes}


def demands(lattice: Lattice, widths: np.ndarray,
            F: float = F_DESIGN, u_lim: float = U_LIMIT) -> Demands:
    """Material demands of a geometry under load F; E-independent by construction."""
    if not np.isfinite(F) or F <= 0:
        raise ValueError("F must be a positive finite number")
    if not np.isfinite(u_lim) or u_lim <= 0:
        raise ValueError("u_lim must be a positive finite number")
    if widths.shape != (lattice.elements.shape[0],) or not np.all(np.isfinite(widths)):
        raise ValueError("widths must be finite and match the element count")
    sol = solve_unit(lattice, widths, F_total=1.0, E=1.0)
    A = DEPTH * widths
    I = DEPTH * widths ** 3 / 12.0
    W = DEPTH * widths ** 2 / 6.0
    Mmax = np.maximum(np.abs(sol["M1"]), np.abs(sol["M2"]))
    sigma_unit = np.abs(sol["N"]) / A + Mmax / W
    sigma_req = float(F * np.max(sigma_unit))

    E_req_def = float(F * sol["u_tip"] / u_lim)
    comp = sol["N"] < 0.0
    if np.any(comp):
        E_req_buck = float(np.max(
            F * np.abs(sol["N"][comp]) * lattice.lengths[comp] ** 2
            / (np.pi ** 2 * I[comp])))
    else:
        E_req_buck = 0.0
    E_req = max(E_req_def, E_req_buck, 1e-9)
    sigma_req = max(sigma_req, 1e-9)

    util_y = sigma_unit / sigma_req if sigma_req > 0 else sigma_unit
    util_b = np.where(
        sol["N"] < 0.0,
        F * np.abs(sol["N"]) * lattice.lengths ** 2 /
        (np.pi ** 2 * I * max(E_req, 1e-9)),
        0.0)
    return Demands(sigma_req=sigma_req, E_req=E_req, E_req_def=E_req_def,
                   E_req_buck=E_req_buck, u_tip_unit=float(sol["u_tip"]),
                   sigma_unit=sigma_unit, N_unit=sol["N"],
                   M_unit=Mmax, util_y=util_y, util_b=util_b, widths=widths)


@dataclass
class SolidDemands:
    sigma_req: float
    E_req: float
    u_tip_unit: float
    mass_g: float


def solid_demands(rho_g_cm3: float, F: float = F_DESIGN,
                  u_lim: float = U_LIMIT) -> SolidDemands:
    """Analytical cantilever plate baseline (monolithic 150x60x10 mm)."""
    L = LENGTH - PAD_LEN
    I = DEPTH * HEIGHT ** 3 / 12.0
    c = HEIGHT / 2.0
    sigma_req = F * L * c / I
    E_req = F * L ** 3 / (3.0 * I * u_lim)
    u_tip_unit = L ** 3 / (3.0 * I)  # for F=1 N, E=1 MPa
    mass = rho_g_cm3 * (LENGTH * HEIGHT * DEPTH) / 1000.0
    return SolidDemands(sigma_req=float(sigma_req), E_req=float(E_req),
                        u_tip_unit=float(u_tip_unit), mass_g=float(mass))


def element_utilisation(lattice: Lattice, widths: np.ndarray,
                        E: float, sy: float,
                        F: float = F_DESIGN) -> dict:
    """Per-element utilisation at a given material state (for visualisation)."""
    sol = solve_unit(lattice, widths, F_total=1.0, E=1.0)
    A = DEPTH * widths
    I = DEPTH * widths ** 3 / 12.0
    W = DEPTH * widths ** 2 / 6.0
    Mmax = np.maximum(np.abs(sol["M1"]), np.abs(sol["M2"]))
    sigma = F * (np.abs(sol["N"]) / A + Mmax / W)
    N = F * sol["N"]
    N_cr = np.pi ** 2 * E * I / np.maximum(lattice.lengths, 1e-9) ** 2
    util_y = sigma / sy
    util_b = np.where(N < 0, np.abs(N) / N_cr, 0.0)
    util = np.maximum(util_y, util_b)
    return {"sigma_MPa": sigma, "util_yield": util_y,
            "util_buckling": util_b, "util_max": util, "N_N": N}


def evaluate(mat, control_logw: np.ndarray, F: float = F_DESIGN,
             u_lim: float = U_LIMIT, lattice: Lattice | None = None,
             use_within: bool = False) -> dict:
    """Full evaluation of a design against a feedstock distribution."""
    from .reliability import failure_probability, mode_split

    lattice = lattice or build_lattice()
    widths = widths_from_controls(control_logw, lattice.midpoints)
    d = demands(lattice, widths, F=F, u_lim=u_lim)
    level = "within" if use_within else "lot"
    pf = failure_probability(mat, d.sigma_req, d.E_req, level=level)
    modes = mode_split(mat, d.sigma_req, d.E_req, level=level)
    m = mass_g(lattice, widths, mat.rho)
    return {
        "widths": widths,
        "mass_g": m,
        "sigma_req_MPa": d.sigma_req,
        "E_req_MPa": d.E_req,
        "E_req_def_MPa": d.E_req_def,
        "E_req_buck_MPa": d.E_req_buck,
        "u_tip_unit_mm": d.u_tip_unit,
        "u_tip_mean_mm": F * d.u_tip_unit / mat.E_mean,
        "pf": pf,
        "reliability": 1.0 - pf,
        "pf_yield_marginal": modes["pf_yield_marginal"],
        "pf_stiffness_marginal": modes["pf_stiffness_marginal"],
        "governing_property": modes["governing"],
        "dominant_failure": modes["dominant_failure"],
        "closest_demand": modes["closest_demand"],
        "demand_ratio_strength": modes["demand_ratio_strength"],
        "demand_ratio_stiffness": modes["demand_ratio_stiffness"],
        "demands": d,
        "capacity_ratio_sy": mat.sy_mean / d.sigma_req,
        "capacity_ratio_E": mat.E_mean / d.E_req,
    }

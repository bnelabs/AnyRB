"""Design optimisation and baseline strategies.

The product is a single material, so internal forces are E-independent: one FE
solve per candidate geometry gives the material demands (sigma_req, E_req).
Reliability is then a closed-form bivariate-normal probability, which makes
large design searches cheap.

Strategies compared in the report / app
---------------------------------------
solid          monolithic plate (analytical)
uniform        lattice with one uniform strut width sized to the target
uniform_match  uniform lattice whose *mass* equals the robust optimum's mass
nominal_sf15   geometry minimised for the mean material with safety factor 1.5
mean_only      geometry that just passes for the mean material (SF = 1.0)
robust         geometry minimised with P_f <= target on the batch distribution
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from .lattice import (W_MAX, W_MIN, build_lattice, mass_g, uniform_controls,
                      widths_from_controls)
from .materials import Material
from .mechanics import demands, evaluate, solid_demands
from .reliability import failure_probability

LOG_LO, LOG_HI = np.log(W_MIN), np.log(W_MAX)


@dataclass
class DesignResult:
    name: str
    controls: np.ndarray
    mass_g: float
    pf: float
    sigma_req_MPa: float
    E_req_MPa: float
    u_tip_mean_mm: float
    widths: np.ndarray | None = None
    reliability: float = field(init=False)
    strategy: str = ""

    def __post_init__(self):
        self.reliability = 1.0 - self.pf

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "strategy": self.strategy,
            "controls": np.asarray(self.controls, float).tolist(),
            "mass_g": self.mass_g,
            "pf": self.pf,
            "reliability": self.reliability,
            "sigma_req_MPa": self.sigma_req_MPa,
            "E_req_MPa": self.E_req_MPa,
            "u_tip_mean_mm": self.u_tip_mean_mm,
        }


# ---------------------------------------------------------------------------
# pattern search (derivative-free, deterministic)
# ---------------------------------------------------------------------------
PATTERN_MOVES = (
    np.ones(8),
    -np.ones(8),
    np.array([1, 1, 1, 1, -1, -1, -1, -1], float),   # root heavier / tip lighter
    np.array([-1, -1, -1, -1, 1, 1, 1, 1], float),
    np.array([1, -1, 1, -1, 1, -1, 1, -1], float),   # alternating
)

# Geometric step schedule mirrored in app/optimize.js (config OPTIMIZER).
STEP_SCHEDULE = (0.35, 0.175, 0.0875, 0.04375, 0.021875, 0.0109375)


def pattern_search(objective, x0: np.ndarray, steps=STEP_SCHEDULE,
                   min_step: float = 0.008, max_evals: int = 2400):
    """Deterministic coordinate + pattern search (mirrors the JS implementation).

    At each step size, sweep the 8 coordinates; if a full coordinate sweep
    fails, try five diagonal pattern moves; when nothing improves, shrink the
    step.  Returns (best_x, best_value, evals).
    """
    x = np.clip(np.asarray(x0, float), LOG_LO, LOG_HI)
    cur = float(objective(x))
    best_x, best_val = x.copy(), cur
    evals = 1
    for step in steps:
        if step < min_step or evals >= max_evals:
            break
        improved = True
        sweeps = 0
        while improved and evals < max_evals:
            improved = False
            sweeps += 1
            for i in range(8):
                for d in (1.0, -1.0):
                    trial = x.copy()
                    trial[i] = np.clip(trial[i] + d * step, LOG_LO, LOG_HI)
                    if abs(trial[i] - x[i]) < 1e-12:
                        continue
                    v = float(objective(trial))
                    evals += 1
                    if v < cur - 1e-12:
                        x, cur = trial, v
                        improved = True
                        if v < best_val:
                            best_x, best_val = x.copy(), v
                        break
            if not improved:
                for dirs in PATTERN_MOVES:
                    trial = np.clip(x + dirs * step, LOG_LO, LOG_HI)
                    if np.all(np.abs(trial - x) < 1e-12):
                        continue
                    v = float(objective(trial))
                    evals += 1
                    if v < cur - 1e-12:
                        x, cur = trial, v
                        improved = True
                        if v < best_val:
                            best_x, best_val = x.copy(), v
                        break
            if sweeps > 25:
                break
    return best_x, best_val, evals


def _starts(mat: Material, target_pf: float,
            widths=(None, 2.0, 2.2, 2.5, 3.0, 3.6)) -> list[np.ndarray]:
    """Deterministic multi-start set: smallest feasible uniform + fixed widths."""
    out: list[np.ndarray] = []
    seen: list[float] = []
    w0 = minimum_uniform_width(mat, target_pf)
    for w in widths:
        ww = w if w is not None else w0
        if ww is None:
            continue
        if any(abs(ww - s) < 1e-3 for s in seen):
            continue
        seen.append(ww)
        out.append(uniform_controls(ww))
    return out


def _run_multistart(objective, starts: list[np.ndarray]) -> tuple[np.ndarray, float, int]:
    best = None
    total = 0
    for x0 in starts:
        x, v, e = pattern_search(objective, x0)
        total += e
        if best is None or v < best[1]:
            best = (x, v, total)
    assert best is not None
    return best[0], best[1], total


def _result(name: str, strategy: str, mat: Material, controls: np.ndarray) -> DesignResult:
    r = evaluate(mat, controls)
    return DesignResult(name=name, strategy=strategy, controls=np.asarray(controls, float),
                        mass_g=r["mass_g"], pf=r["pf"],
                        sigma_req_MPa=r["sigma_req_MPa"], E_req_MPa=r["E_req_MPa"],
                        u_tip_mean_mm=r["u_tip_mean_mm"], widths=r["widths"])


# ---------------------------------------------------------------------------
# sizing helpers
# ---------------------------------------------------------------------------
def minimum_uniform_width(mat: Material, target_pf: float) -> float | None:
    """Smallest uniform width whose P_f meets the target (monotone in width)."""
    def pf(w):
        return evaluate(mat, uniform_controls(w))["pf"]

    if pf(W_MAX) > target_pf:
        return None
    if pf(W_MIN) <= target_pf:
        return W_MIN
    lo, hi = W_MIN, W_MAX
    for _ in range(40):
        mid = 0.5 * (lo + hi)
        if pf(mid) <= target_pf:
            hi = mid
        else:
            lo = mid
        if hi - lo < 0.005:
            break
    return hi


def uniform_width_for_mass(mat: Material, mass_target: float) -> float:
    """Uniform width whose lattice mass equals mass_target (search)."""
    def m(w):
        return evaluate(mat, uniform_controls(w))["mass_g"]

    lo, hi = W_MIN, W_MAX
    for _ in range(50):
        mid = 0.5 * (lo + hi)
        if m(mid) < mass_target:
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi)


# ---------------------------------------------------------------------------
# optimisers
# ---------------------------------------------------------------------------
def optimize_robust(mat: Material, target_pf: float = 0.01,
                    x0: np.ndarray | None = None, max_evals: int = 1200,
                    name: str = "Robust optimisation") -> DesignResult:
    def objective(x):
        r = evaluate(mat, x)
        excess = max(0.0, r["pf"] - target_pf) / target_pf
        return r["mass_g"] * (1.0 + 100.0 * excess)

    if x0 is not None:
        x, _, _ = pattern_search(objective, x0, max_evals=max_evals)
    else:
        x, _, _ = _run_multistart(objective, _starts(mat, target_pf))
    return _result(name, "robust", mat, x)


def optimize_deterministic(mat: Material, safety_factor: float = 1.5,
                           name: str | None = None) -> DesignResult:
    """Mass-minimal geometry that passes for the *mean* material with SF."""
    def feasible(w):
        d = demands(build_lattice(), widths_from_controls(uniform_controls(w),
                                                          build_lattice().midpoints))
        return (safety_factor * d.sigma_req <= mat.sy_mean
                and safety_factor * d.E_req <= mat.E_mean)

    w0 = W_MAX
    if not feasible(W_MAX):
        w0 = W_MAX
    else:
        lo, hi = W_MIN, W_MAX
        for _ in range(40):
            mid = 0.5 * (lo + hi)
            if feasible(mid):
                hi = mid
            else:
                lo = mid
            if hi - lo < 0.005:
                break
        w0 = hi
    x0 = uniform_controls(w0)

    def objective(x):
        r = evaluate(mat, x)
        d = r["demands"]
        v = max(0.0, safety_factor * d.sigma_req / mat.sy_mean - 1.0) \
            + max(0.0, safety_factor * d.E_req / mat.E_mean - 1.0)
        return r["mass_g"] * (1.0 + 200.0 * v)

    x, _, _ = _run_multistart(objective, _starts(mat, 0.01))
    label = name or f"Nominal optimisation (SF {safety_factor:g})"
    return _result(label, f"nominal_sf{safety_factor:g}", mat, x)


# ---------------------------------------------------------------------------
# strategy comparison
# ---------------------------------------------------------------------------
def compare_strategies(mat: Material, target_pf: float = 0.01) -> dict:
    lattice = build_lattice()
    robust = optimize_robust(mat, target_pf, name="Robust optimisation")
    nominal = optimize_deterministic(mat, 1.5)
    mean_only = optimize_deterministic(mat, 1.0, name="Mean-material design (SF 1.0)")

    w_uniform = minimum_uniform_width(mat, target_pf)
    uniform = (_result("Uniform lattice (target)", "uniform", mat,
                       uniform_controls(w_uniform))
               if w_uniform is not None else None)

    w_match = uniform_width_for_mass(mat, robust.mass_g)
    uniform_match = _result("Uniform lattice (mass-matched)", "uniform_match", mat,
                            uniform_controls(w_match))

    sd = solid_demands(mat.rho)
    solid = DesignResult(name="Solid plate", strategy="solid",
                         controls=uniform_controls(W_MAX),
                         mass_g=sd.mass_g,
                         pf=failure_probability(mat, sd.sigma_req, sd.E_req),
                         sigma_req_MPa=sd.sigma_req, E_req_MPa=sd.E_req,
                         u_tip_mean_mm=150.0 * sd.u_tip_unit / mat.E_mean)

    return {
        "solid": solid,
        "uniform": uniform,
        "uniform_match": uniform_match,
        "robust": robust,
        "nominal_sf15": nominal,
        "mean_only": mean_only,
        "target_pf": target_pf,
        "lattice": lattice,
    }


def pareto_curve(mat: Material, targets: list[float] | None = None,
                 x0: np.ndarray | None = None) -> list[dict]:
    """Mass-optimal design at several reliability targets (warm-started)."""
    targets = targets or [1e-4, 1e-3, 5e-3, 1e-2, 2e-2, 5e-2, 0.1, 0.2]
    out = []
    x = x0
    for t in targets:
        r = optimize_robust(mat, target_pf=t, x0=x, max_evals=900,
                            name=f"target {t:g}")
        out.append({"target_pf": t, "achieved_pf": r.pf, "mass_g": r.mass_g,
                    "controls": r.controls.tolist()})
        x = r.controls
    return out


# ---------------------------------------------------------------------------
# batch-adaptive recipe & acceptance window
# ---------------------------------------------------------------------------
def batch_recipe(mat: Material, controls: np.ndarray, target_pf: float = 0.01,
                 lot_E: float | None = None, lot_sy: float | None = None,
                 max_scale: float = 1.5) -> dict:
    """Required uniform width scale for a delivered lot (measured or random lot)."""
    lattice = build_lattice()
    known = lot_E is not None or lot_sy is not None
    if known:
        m = mat.lot_from_measurement(lot_E, lot_sy)
        level = "within"
    else:
        m = mat
        level = "lot"

    def eval_scale(s: float):
        c = np.clip(np.asarray(controls) + np.log(s), LOG_LO, LOG_HI)
        widths = widths_from_controls(c, lattice.midpoints)
        d = demands(lattice, widths)
        pf = failure_probability(m, d.sigma_req, d.E_req, level=level)
        return pf, mass_g(lattice, widths, mat.rho)

    pf0, mass0 = eval_scale(1.0)
    if pf0 <= target_pf:
        s_req = 1.0
    else:
        lo, hi = 1.0, max_scale
        p_hi, _ = eval_scale(hi)
        if p_hi > target_pf:
            s_req = None
        else:
            for _ in range(50):
                mid = 0.5 * (lo + hi)
                p, _ = eval_scale(mid)
                if p <= target_pf:
                    hi = mid
                else:
                    lo = mid
                if hi - lo < 0.002:
                    break
            s_req = hi
    _, mass_req = (eval_scale(s_req) if s_req is not None else (None, None))
    if s_req is None:
        verdict = "reject / reroute"
    elif s_req <= 1.001:
        verdict = "pass as designed"
    elif s_req <= 1.15:
        verdict = "pass with compensation"
    elif s_req <= 1.5:
        verdict = "conditional (heavy compensation)"
    else:
        verdict = "reject / reroute"
    return {
        "scale_required": s_req,
        "pf_as_designed": pf0,
        "mass_as_designed_g": mass0,
        "mass_required_g": mass_req,
        "added_mass_pct": (100.0 * (mass_req / mass0 - 1.0)) if mass_req else None,
        "verdict": verdict,
        "level": level,
    }


def acceptance_window(mat: Material, controls: np.ndarray,
                      target_pf: float = 0.01, n_grid: int = 41) -> dict:
    """Grid of lot-mean multipliers (mE, m_sy) where a known lot would pass."""
    from .reliability import lot_pass_probability

    lattice = build_lattice()
    widths = widths_from_controls(controls, lattice.midpoints)
    d = demands(lattice, widths)
    mE = np.linspace(0.55, 1.25, n_grid)
    msy = np.linspace(0.55, 1.25, n_grid)
    pass_grid = np.zeros((n_grid, n_grid), dtype=bool)
    for i, e in enumerate(mE):
        for j, s in enumerate(msy):
            p = lot_pass_probability(mat, d.sigma_req, d.E_req,
                                     e * mat.E_mean, s * mat.sy_mean)
            pass_grid[j, i] = p <= target_pf
    return {"mE": mE, "msy": msy, "pass": pass_grid,
            "sigma_req_MPa": d.sigma_req, "E_req_MPa": d.E_req,
            "n_pass": int(pass_grid.sum()), "n_total": int(pass_grid.size)}

"""Reliability / uncertainty quantification utilities.

A part is safe for a batch (E, sy) if
    sy >= sigma_req   AND   E >= E_req
with demands from mechanics.demands().  Both quantities are lognormal and
correlated on the log scale, so the failure probability has a closed form:

    P_f = 1 - Phi2( a, b ; rho ),
    a = (ln sigma_req - mu_s) / sig_s,   b = (ln E_req - mu_E) / sig_E

`Phi2` is the standard bivariate normal CDF. For |rho| <= 0.9 and moderate
thresholds it uses a 48-point Gauss-Legendre quadrature (no SciPy needed); near
|rho| -> 1 or in deep tails it delegates to SciPy's adaptive bivariate CDF, and
the JS engine keeps an independent implementation verified in the tests.

All functions use the *lot* level of the material hierarchy unless the caller
passes level="within" (a single known lot) or level="total".
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .materials import Material, _lognormal_params

# Gauss-Legendre nodes/weights for Phi2 (fixed, deterministic)
_GL_X, _GL_W = np.polynomial.legendre.leggauss(48)


def _phi(x: float) -> float:
    return float(np.exp(-0.5 * x * x) / np.sqrt(2.0 * np.pi))


def _ndtr(x):
    """Standard normal CDF without scipy (scalar or array input)."""
    import math
    arr = np.asarray(x, dtype=float)
    if arr.ndim == 0:
        return 0.5 * (1.0 + math.erf(float(arr) / np.sqrt(2.0)))
    flat = arr.ravel()
    out = np.empty(flat.shape)
    for i, v in enumerate(flat):
        out[i] = 0.5 * (1.0 + math.erf(float(v) / np.sqrt(2.0)))
    return out.reshape(arr.shape)


def phi2(a: float, b: float, rho: float) -> float:
    """P(X <= a, Y <= b) for standard bivariate normal with correlation rho.

    Gauss-Legendre (48 pt) is exact to ~1e-15 for |rho| <= 0.9 and moderate
    thresholds; near |rho| -> 1 or deep tails the conditional integrand becomes
    too sharp for a fixed grid, so we fall back to SciPy's adaptive reference
    (SciPy is already a project dependency; the JS engine keeps its own
    independent implementation).
    """
    if abs(rho) >= 1.0 - 1e-12:
        raise ValueError("rho must be strictly inside (-1, 1)")
    if abs(rho) > 0.9 or abs(a) > 4.0 or abs(b) > 4.0:
        try:
            from scipy.stats import multivariate_normal
            val = float(multivariate_normal.cdf([a, b], mean=[0.0, 0.0],
                                                cov=[[1.0, rho], [rho, 1.0]]))
            if np.isfinite(val):
                return float(min(max(val, 0.0), 1.0))
        except Exception:  # pragma: no cover - fall back to quadrature
            pass
    # integrate over t in (-inf, a]:  phi(t) * Phi((b - rho t)/sqrt(1-rho^2))
    lo = min(a - 10.0, -10.0)
    hi = a
    if hi <= lo:
        return 0.0
    t = 0.5 * (hi - lo) * _GL_X + 0.5 * (hi + lo)
    w = 0.5 * (hi - lo) * _GL_W
    arg = (b - rho * t) / np.sqrt(1.0 - rho * rho)
    vals = np.exp(-0.5 * t * t) / np.sqrt(2.0 * np.pi) * _ndtr(arg)
    p = float(np.sum(w * vals))
    return min(max(p, 0.0), 1.0)


def failure_probability(mat: Material, sigma_req: float, E_req: float,
                        level: str = "lot") -> float:
    """P(sy < sigma_req or E < E_req) over the chosen variability level.

    Handles degenerate (zero-variance) marginals, which occur when a measured
    lot is queried at lot level or when a user sets a CV to zero.
    """
    p = mat.params(level)
    degenerate_s = p["sig_s"] < 1e-12
    degenerate_E = p["sig_E"] < 1e-12
    py = (1.0 if sigma_req >= mat.sy_mean else 0.0) if degenerate_s else \
        float(_ndtr((np.log(max(sigma_req, 1e-12)) - p["mu_s"]) / p["sig_s"]))
    pe = (1.0 if E_req >= mat.E_mean else 0.0) if degenerate_E else \
        float(_ndtr((np.log(max(E_req, 1e-12)) - p["mu_E"]) / p["sig_E"]))
    if degenerate_s and degenerate_E:
        return float(1.0 if (py or pe) else 0.0)
    if degenerate_s:                      # strength is deterministic
        return float(1.0 if py else pe)   # if strength fails -> 1; else only stiffness can fail
    if degenerate_E:                      # stiffness is deterministic
        return float(1.0 if pe else py)   # if stiffness fails -> 1; else only strength can fail
    # P(X < a or Y < b) = Phi(a) + Phi(b) - Phi2(a, b; rho)
    a = (np.log(max(sigma_req, 1e-12)) - p["mu_s"]) / p["sig_s"]
    b = (np.log(max(E_req, 1e-12)) - p["mu_E"]) / p["sig_E"]
    pf = py + pe - phi2(a, b, p["rho"])
    return float(min(max(pf, 0.0), 1.0))


def failure_probability_elongation(mat: Material, strain_demand: float,
                                  level: str = "lot") -> float:
    """Marginal P(elongation_at_break < strain_demand).

    This is the brittle-lot screen, deliberately reported *separately* from the
    headline two-property P_f: the library's elongation-vs-E correlation
    (-0.25) is an assumption, so a joint three-property probability is not
    claimed.  The app/report shows this as a add-on estimate (not a formal bound).
    """
    if not np.isfinite(mat.elongation_mean) or mat.elongation_mean <= 0:
        return float("nan")
    if level == "total":
        f = 1.0
    elif mat.lot_fraction <= 1e-12:          # measured lot: cv_already=within+measurement
        f = 1.0
    elif level == "lot":
        f = float(np.sqrt(max(mat.elongation_lot_variance_fraction, 0.0)))
    else:                                    # within
        f = float(np.sqrt(max(1.0 - mat.elongation_lot_variance_fraction, 0.0)))
    cv = float(mat.elongation_cv) * f
    mean = float(mat.elongation_mean) / 100.0
    if cv <= 0:
        return 1.0 if strain_demand >= mean else 0.0
    mu, sig = _lognormal_params(mean, cv)
    return float(_ndtr((np.log(max(strain_demand, 1e-12)) - mu) / sig))


def assumption_bounds(mat: Material, sigma_req: float, E_req: float,
                      level: str = "lot") -> dict:
    """How much do the two unmeasured assumptions move P_f?

    - ln E / ln sy correlation (assumed 0.55, no measured recyclate source)
    - lot-vs-within variance split (inferred 85/15, not a measured population)
    Returns a range, not a claim of validation.
    """
    import dataclasses
    out = {"corr_range": [], "split_range": []}
    for corr in (0.30, 0.70):
        m = dataclasses.replace(mat, corr=corr)
        out["corr_range"].append({"corr": corr, "pf": failure_probability(m, sigma_req, E_req, level=level)})
    for frac in (0.75, 0.95):
        within = float(np.sqrt(max(1.0 - frac ** 2, 0.0)))
        m = dataclasses.replace(mat, lot_fraction=frac, within_fraction=within)
        out["split_range"].append({"lot_fraction": frac, "pf": failure_probability(m, sigma_req, E_req, level=level)})
    vals = [x["pf"] for x in out["corr_range"] + out["split_range"]]
    out["pf_min"] = float(min(vals)); out["pf_max"] = float(max(vals))
    return out


def mode_split(mat: Material, sigma_req: float, E_req: float,
               level: str = "lot") -> dict:
    """Marginal and joint failure contributions per governing material property.

    The marginals Phi(a) and Phi(b) are *not* additive (they overlap in the
    joint orthant), so this returns both marginals and the exact joint P_f.
    Used by the report/app to show which property is actually binding.
    """
    p = mat.params(level)
    a = (np.log(max(sigma_req, 1e-12)) - p["mu_s"]) / p["sig_s"]
    b = (np.log(max(E_req, 1e-12)) - p["mu_E"]) / p["sig_E"]
    p_y = float(_ndtr(a))
    p_e = float(_ndtr(b))
    joint = failure_probability(mat, sigma_req, E_req, level=level)
    overlap = p_y + p_e - joint
    # Two different (both useful) notions of "governing":
    #  * dominant_failure  = property contributing the larger marginal P_f
    #  * closest_demand    = property whose mean demand sits closer to capacity
    dominant = "yield_strength" if p_y >= p_e else "stiffness_buckling"
    ratio_s = sigma_req / mat.sy_mean
    ratio_e = E_req / mat.E_mean
    closest = "yield_strength" if ratio_s >= ratio_e else "stiffness_buckling"
    return {"pf_yield_marginal": p_y, "pf_stiffness_marginal": p_e,
            "pf_joint": joint, "overlap": overlap,
            "governing": dominant, "dominant_failure": dominant,
            "closest_demand": closest,
            "demand_ratio_strength": float(ratio_s),
            "demand_ratio_stiffness": float(ratio_e)}


def safety_margin(batch_E: np.ndarray, batch_sy: np.ndarray,
                  sigma_req: float, E_req: float) -> np.ndarray:
    return np.minimum(batch_sy / sigma_req, batch_E / E_req)


@dataclass
class MCResult:
    pf: float
    pf_stderr: float
    margin: np.ndarray
    failed: np.ndarray
    E: np.ndarray
    sy: np.ndarray
    p5_margin: float
    p50_margin: float
    robustness_index: float      # P5(margin) / mean(margin); 1 = no scatter consequence
    u_tip: np.ndarray | None = None


def monte_carlo(mat: Material, sigma_req: float, E_req: float,
                n: int = 20000, seed: int = 20261029,
                level: str = "lot") -> MCResult:
    rng = np.random.default_rng(seed)
    E, sy = mat.sample(n, rng, level=level)
    margin = safety_margin(E, sy, sigma_req, E_req)
    failed = margin < 1.0
    p = float(failed.mean())
    se = float(np.sqrt(max(p * (1 - p), 1e-12) / n))
    return MCResult(pf=p, pf_stderr=se, margin=margin, failed=failed,
                    E=E, sy=sy, p5_margin=float(np.percentile(margin, 5)),
                    p50_margin=float(np.percentile(margin, 50)),
                    robustness_index=float(np.percentile(margin, 5) / np.mean(margin)))


def sensitivity(mat: Material, sigma_req: float, E_req: float,
                level: str = "lot", rel_step: float = 0.25) -> dict:
    """Finite-difference sensitivity of P_f to feedstock assumptions and load.

    Each entry is the change in P_f for the stated perturbation (positive = worse).
    """
    import dataclasses

    base = failure_probability(mat, sigma_req, E_req, level=level)

    def pf_with(**kw):
        return failure_probability(dataclasses.replace(mat, **kw),
                                   sigma_req, E_req, level=level)

    return {
        "base": base,
        "cv_E": pf_with(E_cv=mat.E_cv * (1 + rel_step)) - base,
        "cv_sy": pf_with(sy_cv=mat.sy_cv * (1 + rel_step)) - base,
        "corr": pf_with(corr=max(-0.99, min(0.99, mat.corr * (1 + rel_step)))) - base,
        "load": failure_probability(mat, sigma_req * (1 + rel_step),
                                    E_req * (1 + rel_step), level=level) - base,
        "mean_E": pf_with(E_mean=mat.E_mean * (1 - rel_step)) - base,
        "mean_sy": pf_with(sy_mean=mat.sy_mean * (1 - rel_step)) - base,
        "u_limit": failure_probability(mat, sigma_req,
                                       E_req * (1 + rel_step), level=level) - base,
    }


def lot_pass_probability(mat: Material, sigma_req: float, E_req: float,
                         E_lot: float, sy_lot: float) -> float:
    """P_f for a *known* lot with measured mean properties (within-lot scatter)."""
    m = mat.lot_from_measurement(E_measured=E_lot, sy_measured=sy_lot)
    return failure_probability(m, sigma_req, E_req, level="within")


def acceptance_window(mat: Material, sigma_req: float, E_req: float,
                      target_pf: float = 0.01, n_grid: int = 61) -> dict:
    """Lot-mean multipliers (mE, msy) for which a known lot meets target_pf."""
    mE = np.linspace(0.5, 1.3, n_grid)
    msy = np.linspace(0.5, 1.3, n_grid)
    pass_grid = np.zeros((n_grid, n_grid))
    for i, e in enumerate(mE):
        for j, s in enumerate(msy):
            pass_grid[j, i] = lot_pass_probability(
                mat, sigma_req, E_req, e * mat.E_mean, s * mat.sy_mean) <= target_pf
    return {"mE": mE, "msy": msy, "pass": pass_grid}

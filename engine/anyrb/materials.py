"""Feedstock / material variability model.

Two-level model
---------------
A recyclate is described by a grand mean and coefficient of variation (CV) for
Young's modulus E and yield stress sy, plus a correlation on the log scale.
Variation is split into a *lot-to-lot* part (the mean of a delivered lot moves)
and a *within-lot* part (specimens inside the lot scatter around its mean):

    CV_total^2 = CV_lot^2 + CV_within^2

Reliability of a product that is made from one delivered lot is governed by the
lot-level distribution; a *known* lot (measured proxy / supplier data) is
governed by the within-lot distribution.  Both are exposed here.

The numerical defaults are provisional v0.1 values informed by the literature
anchors in PRODUCT_SPEC.md; research/01 and data/feedstock_library.json will
replace them with verified values and sources.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np


def _lognormal_params(mean: float, cv: float) -> tuple[float, float]:
    """Return (mu, sigma) of ln(X) for a lognormal with given arithmetic mean/CV."""
    if mean <= 0:
        raise ValueError("mean must be positive")
    if cv < 0:
        raise ValueError("cv must be non-negative")
    sigma2 = np.log1p(cv * cv)
    return float(np.log(mean) - 0.5 * sigma2), float(np.sqrt(sigma2))


@dataclass(frozen=True)
class Material:
    id: str
    name: str
    process: str
    E_mean: float          # MPa
    E_cv: float            # total CV (0..1)
    sy_mean: float         # MPa
    sy_cv: float
    rho: float             # g/cm^3
    corr: float = 0.55     # correlation of ln E and ln sy
    # CV multipliers (not variance fractions): cv_lot = lot_fraction * cv_total;
    # cv_within = within_fraction * cv_total; lot_fraction^2 + within_fraction^2 = 1.
    # 0.922/0.387 == 85%/15% of the variance between/within lots (research/01 §6.1).
    lot_fraction: float = 0.92195
    within_fraction: float = 0.38730
    sources: tuple[str, ...] = ()
    confidence: str = "provisional v0.1"
    # Printed-part elongation at break (percent).  Kept separate from the
    # headline stiffness/strength failure probability in v0.4; see
    # failure_probability_elongation and the report's brittle-lot screen.
    elongation_mean: float = float("nan")
    elongation_cv: float = 0.0
    corr_E_elong: float = -0.25

    def __post_init__(self) -> None:
        if not (-0.99 <= self.corr <= 0.99):
            raise ValueError("corr must be strictly inside (-1, 1)")
        if self.lot_fraction ** 2 + self.within_fraction ** 2 > 1.0 + 1e-6:
            raise ValueError("lot^2 + within^2 must be <= 1 (CV_total^2 = sum of squares)")
        if self.E_cv < 0 or self.sy_cv < 0:
            raise ValueError("CVs must be non-negative (0 = deterministic marginal)")
        if self.elongation_cv < 0:
            raise ValueError("elongation_cv must be non-negative")

    @property
    def print_process_ok(self) -> bool:
        """Only FDM/FFF material data belongs in the printed-bracket model."""
        p = str(self.process).upper()
        return ("FDM" in p) or ("FFF" in p)

    # -- lognormal descriptors -------------------------------------------------
    def params(self, level: str = "lot") -> dict:
        """Lognormal parameters and correlation for 'lot' or 'within' variation."""
        if level == "lot":
            f = self.lot_fraction
        elif level == "within":
            f = self.within_fraction
        elif level == "total":
            f = 1.0
        else:
            raise ValueError("level must be 'lot', 'within' or 'total'")
        muE, sigE = _lognormal_params(self.E_mean, f * self.E_cv)
        mus, sigs = _lognormal_params(self.sy_mean, f * self.sy_cv)
        return {"mu_E": muE, "sig_E": sigE, "mu_s": mus, "sig_s": sigs,
                "rho": float(self.corr), "cv_E": f * self.E_cv, "cv_s": f * self.sy_cv}

    # -- sampling --------------------------------------------------------------
    def sample(self, n: int, rng: np.random.Generator | None = None,
               level: str = "lot") -> tuple[np.ndarray, np.ndarray]:
        """Draw n correlated (E, sy) batches from the given hierarchy level."""
        rng = rng or np.random.default_rng(0)
        p = self.params(level)
        z1 = rng.standard_normal(n)
        z2 = rng.standard_normal(n)
        zE = z1
        zs = p["rho"] * z1 + np.sqrt(max(0.0, 1.0 - p["rho"] ** 2)) * z2
        E = np.exp(p["mu_E"] + p["sig_E"] * zE)
        sy = np.exp(p["mu_s"] + p["sig_s"] * zs)
        return E, sy

    def lot_from_measurement(self, E_measured: float | None = None,
                             sy_measured: float | None = None,
                             measurement_cv: float = 0.0) -> "Material":
        """Return a material whose *lot* level is replaced by measured values.

        The within-lot CVs are kept from this material; the returned Material's
        E_mean/sy_mean are the measured lot means and the lot CV is set to zero.
        """
        # A single supplier value / coupon is not the true lot mean: keep the
        # measurement uncertainty in the distribution instead of pretending the
        # lot has only within-lot scatter.  Variances add in log space.
        e_within = self.E_cv * self.within_fraction
        s_within = self.sy_cv * self.within_fraction
        e_cv = float(np.sqrt(max(e_within ** 2 + measurement_cv ** 2, 1e-12)))
        s_cv = float(np.sqrt(max(s_within ** 2 + measurement_cv ** 2, 1e-12)))
        return Material(
            id=self.id + "-measured",
            name=self.name + " (measured lot)",
            process=self.process,
            E_mean=float(E_measured if E_measured is not None else self.E_mean),
            E_cv=e_cv,
            sy_mean=float(sy_measured if sy_measured is not None else self.sy_mean),
            sy_cv=s_cv,
            rho=self.rho,
            corr=self.corr,
            elongation_mean=self.elongation_mean,
            elongation_cv=float(np.sqrt(max(
                (self.elongation_cv * self.within_fraction) ** 2 + measurement_cv ** 2, 1e-12))) if np.isfinite(self.elongation_mean) else self.elongation_cv,
            corr_E_elong=self.corr_E_elong,
            lot_fraction=0.0,
            within_fraction=1.0,
            sources=self.sources,
            confidence="user/supplier lot data",
        )


# ---------------------------------------------------------------------------
# Provisional presets (to be replaced by verified library from research/01)
#
# NOTE ON ORIENTATION: the reference bracket is loaded in-plane and the model
# is 2-D.  The rPETG preset therefore uses the *printed in-plane* measured
# strength (46 MPa from R07), NOT a further layer-adhesion knockdown: applying a
# knockdown to an already-printed-part measurement would double-count the
# anisotropy.  Out-of-plane / layer-normal loading is not modelled in v0.1 and
# is listed as a limitation; users with such load paths must not use this preset
# without coupon data.
# ---------------------------------------------------------------------------
PRESETS: dict[str, Material] = {
    # Values adopted verbatim from data/feedstock_library.json (research/01).
    # rPETG strength is the measured *printed in-plane* value (46 MPa, CV 0.10,
    # ISO 527-2, R07).  No layer-adhesion knockdown is applied: the measurement
    # is already a printed-part value and this 2-D model is loaded in-plane.
    "rpetg": Material(
        id="rpetg", name="rPETG (recycled PETG, printed parts)",
        process="FDM/FFF", E_mean=2100.0, E_cv=0.10, sy_mean=46.0, sy_cv=0.10,
        rho=1.24, corr=0.55,
        elongation_mean=4.0, elongation_cv=0.20, corr_E_elong=-0.25,
        sources=("research/01 R07 (printed rPETG, ISO 527-2: E 2.28 GPa CV 10.8%, peak stress 46.5 MPa; strain at peak 3.15-3.51%)",),
    ),
    "rpet": Material(
        id="rpet", name="rPET (bottle-grade recyclate; injection/compression data — contrast only for printed bracket)",
        process="IM", E_mean=2500.0, E_cv=0.12, sy_mean=45.0, sy_cv=0.15,
        rho=1.34, corr=0.60,
        elongation_mean=3.5, elongation_cv=0.25, corr_E_elong=-0.25,
        sources=("research/01 R01,R04,R08,R22; elongation from data/feedstock_library.json",),
    ),
    "rhdpe": Material(
        id="rhdpe", name="rHDPE (post-consumer recyclate; injection/compression data — contrast only for printed bracket)",
        process="IM/compression", E_mean=950.0, E_cv=0.22, sy_mean=28.0, sy_cv=0.17,
        rho=0.95, corr=0.55,
        elongation_mean=14.0, elongation_cv=0.30, corr_E_elong=-0.25,
        sources=("research/01 R01,R02,R03,R04 (Cecon 2023; Eriksen 2019; PNAS 2025); elongation from library",),
    ),
    "rpp": Material(
        id="rpp", name="rPP (post-consumer recyclate; injection data — contrast only for printed bracket)",
        process="IM", E_mean=1100.0, E_cv=0.18, sy_mean=27.0, sy_cv=0.13,
        rho=0.94, corr=0.50,
        elongation_mean=25.0, elongation_cv=0.45, corr_E_elong=-0.25,
        sources=("research/01 R02,R03,R04,R05,R06; elongation from library (10 PCR-PP lots 10-100%)",),
    ),
}


def get_material(key: str, **overrides) -> Material:
    """Look up a preset and optionally override fields (used by the CLI/app)."""
    if key not in PRESETS:
        raise KeyError(f"unknown material preset {key!r}; choose from {list(PRESETS)}")
    import dataclasses
    return dataclasses.replace(PRESETS[key], **overrides)


def material_from_dict(d: dict) -> Material:
    return Material(**d)

"""AnyRB v0.3 — server-side AI payload contract.

The reviewer asked us to constrain the AI to decisions the verified engine can
refuse, surface family scope, and carry measurement uncertainty. This module is
the single place where request payloads (old v0.2 and new v0.3 shapes) are
normalised into one canonical, *grounded* payload that is:

  1. sent to the Muse Spark prompt,
  2. used by the number-grounding gate (every number in a memo must exist here),
  3. consumed by the deterministic fallbacks.

New v0.3 fields are optional everywhere: an old v0.2 payload (no printed mass,
no lot recipe, no sustained bound) still works. The canonical payload only
contains numbers that came from the caller or from the verified engine outputs
the caller supplied — this module never invents a performance number.

Canonical keys
--------------
``family_scope``, ``brief``, ``design``, ``printability``,
``printability_limits``, ``lot_recipe``, ``measurement``,
``sustained_bound``, ``feasibility``, ``comparison``, ``material``,
``sensitivity``, ``validation``.
"""
from __future__ import annotations

import math
from typing import Any, Optional

# ---------------------------------------------------------------------------
# constants (single source of truth for app.py, prompts.py and the docs)
# ---------------------------------------------------------------------------
FAMILY_SCOPE = (
    "best of this bracket/lattice family (7x3 X-braced cantilever bracket, "
    "8 log-width control points) — not a general topology optimiser"
)
PRINTABILITY_LIMITS = {
    "max_neighbour_width_ratio": 1.5,   # advisory manufacturing cap
    "max_slenderness": 30.0,
}
DEFAULT_MEASUREMENT_CV = 0.12
MASS_BASIS = (
    "printed_mass_g is the reported mass (deterministic Halton-union estimate); "
    "mass_analytic_g is an upper bound (strut volumes before unioning)"
)
ADVISORY_SUSTAINED_NOTE = (
    "Sustained-load / creep bound is advisory only; the static design allowables are unchanged."
)
SUSTAINED_FAIL_NOTE = (
    "not qualified for sustained load (advisory bound fails; static result unchanged)"
)

_MATERIAL_KEYS = ("rpetg", "rpet", "rhdpe", "rpp")


# ---------------------------------------------------------------------------
# small numeric helpers
# ---------------------------------------------------------------------------
def num(x: Any) -> Optional[float]:
    """Finite float or None (booleans are not numbers here)."""
    if isinstance(x, bool) or x is None:
        return None
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(v):
        return None
    return v


def first_num(*values: Any) -> Optional[float]:
    for v in values:
        got = num(v)
        if got is not None:
            return got
    return None


def first_list(*values: Any) -> Optional[list]:
    for v in values:
        if isinstance(v, list) and v:
            return v
    return None


def text(x: Any, limit: int = 160) -> str:
    if x is None:
        return ""
    return " ".join(str(x).split())[:limit]


def normalise_material_key(x: Any) -> Optional[str]:
    k = text(x, 24).lower()
    if k in _MATERIAL_KEYS:
        return k
    for key in _MATERIAL_KEYS:  # tolerate "rPETG (printed)" etc.
        if key in k:
            return key
    return None


# ---------------------------------------------------------------------------
# block normalisers
# ---------------------------------------------------------------------------
def normalize_brief(raw: Any, fallback: Any = None) -> dict:
    """Accept the server's snake_case brief, the app's camelCase brief, or legacy fields."""
    b = dict(raw or {}) if isinstance(raw, dict) else {}
    f = dict(fallback or {}) if isinstance(fallback, dict) else {}
    get = lambda *keys: next((b[k] for k in keys if b.get(k) is not None), None)  # noqa: E731
    cg = lambda *keys: next((f[k] for k in keys if f.get(k) is not None), None)  # noqa: E731
    out = {
        "part_label": text(get("part_label", "partType", "part") or cg("part_label"), 80)
        or "cantilever bracket",
        "load_N": first_num(get("load_N", "loadN"), cg("load_N")),
        "deflection_limit_mm": first_num(get("deflection_limit_mm", "deflLimitMm"),
                                         cg("deflection_limit_mm")),
        "target_pf": first_num(get("target_pf", "targetPf"), cg("target_pf")),
        "mass_cap_g": first_num(get("mass_cap_g", "massCapG"), cg("mass_cap_g")),
        "material_key": normalise_material_key(
            get("material_key", "preset", "materialKey") or cg("material_key")),
        "process": text(get("process") or cg("process"), 40),
        "constraints": [text(x, 90) for x in (b.get("constraints") or f.get("constraints") or [])
                        if str(x).strip()][:6],
        "rationale": text(get("rationale", "notes") or cg("rationale"), 240),
    }
    return {k: v for k, v in out.items() if v not in (None, "", [])}


def normalize_printability(raw: Any) -> dict:
    """Accept v0.3 snake_case or the JS app's camelCase printability report."""
    p = dict(raw or {}) if isinstance(raw, dict) else {}
    ratio = first_num(p.get("max_neighbour_width_ratio"), p.get("maxNeighbourRatio"),
                      p.get("neighbour_ratio"), p.get("neighbourRatio"),
                      p.get("max_neighbour_ratio"))
    slender = first_num(p.get("max_slenderness"), p.get("maxSlenderness"),
                        p.get("slenderness"))
    min_w = first_num(p.get("min_width_mm"), p.get("minWidth"), p.get("min_width"))
    max_w = first_num(p.get("max_width_mm"), p.get("maxWidth"), p.get("max_width"))
    out: dict[str, Any] = {}
    if ratio is not None:
        out["max_neighbour_width_ratio"] = round(ratio, 3)
    if slender is not None:
        out["max_slenderness"] = round(slender, 2)
    if min_w is not None:
        out["min_width_mm"] = round(min_w, 3)
    if max_w is not None:
        out["max_width_mm"] = round(max_w, 3)
    if ratio is not None or slender is not None:
        out["limits"] = dict(PRINTABILITY_LIMITS)
        out["passes"] = bool(
            (ratio is None or ratio <= PRINTABILITY_LIMITS["max_neighbour_width_ratio"] + 1e-9)
            and (slender is None or slender <= PRINTABILITY_LIMITS["max_slenderness"] + 1e-9))
    return out


def normalize_design(facts: Any = None, design: Any = None, selected: Any = None,
                     engine: Any = None, extra: Any = None) -> dict:
    """Merge the v0.2 fields (`selected`, `design`, `facts`) into one design block."""
    fs = dict(facts or {}) if isinstance(facts, dict) else {}
    ds = dict(design or {}) if isinstance(design, dict) else {}
    sel = dict(selected or {}) if isinstance(selected, dict) else {}
    en = dict(engine or {}) if isinstance(engine, dict) else {}
    ex = dict(extra or {}) if isinstance(extra, dict) else {}
    pick = lambda *keys: next((src[k] for src in (fs, ds, sel, en, ex)  # noqa: E731
                               for k in keys if isinstance(src, dict) and src.get(k) is not None), None)
    printed = first_num(pick("printed_mass_g", "printedMassG", "mass_union_g",
                             "massUnionG", "union_mass_g"))
    analytic = first_num(pick("mass_analytic_g", "massAnalyticG", "analytic_mass_g",
                              "mass_g", "massG"))
    pf = first_num(pick("pf"), sel.get("pf"))
    out: dict[str, Any] = {
        "name": text(pick("name", "design_name", "label"), 80),
        "strategy": text(pick("strategy", "tagline"), 60),
        "printed_mass_g": round(printed, 2) if printed is not None else None,
        "mass_analytic_g": round(analytic, 2) if analytic is not None else None,
        "mass_basis": MASS_BASIS,
        "pf": pf,
        "target_pf": first_num(pick("target_pf", "targetPf"), ex.get("target_pf")),
        "governing_mode": text(pick("governing_mode", "governing", "binding_mode"), 80),
        "sigma_req_MPa": first_num(pick("sigma_req_MPa", "sigma_y_req_mpa", "sigma_req_mpa")),
        "E_req_MPa": first_num(pick("E_req_MPa", "E_req_mpa")),
        "deflection_mm": first_num(pick("deflection_mm", "u_tip_mean_mm", "u_tip_mm")),
        "feasible": pick("feasible", "within_target"),
        "control_widths_mm": first_list(pick("control_widths_mm", "widths_mm", "controlWidthsMm")),
    }
    candidates = [pick("printability"), sel.get("printability"),
                  fs.get("printability"), en.get("printability"), ex.get("printability")]
    print_raw = next((c for c in candidates if isinstance(c, dict)), None)
    if print_raw is None:
        # the browser payload flattens printability into facts (min/max width, slenderness…)
        flat = {}
        for key in ("min_width_mm", "max_width_mm", "max_slenderness",
                    "max_neighbour_width_ratio"):
            v = pick(key)
            if v is not None:
                flat[key] = v
        v = pick("neighbour_ratio", "neighbourRatio", "max_neighbour_width_ratio")
        if v is not None:
            flat["max_neighbour_width_ratio"] = v
        v = pick("slenderness")
        if v is not None and "max_slenderness" not in flat:
            flat["max_slenderness"] = v
        print_raw = flat or None
    p = normalize_printability(print_raw)
    if p:
        out["printability"] = p
    return {k: v for k, v in out.items() if v not in (None, "", [])}


def normalize_lot_recipe(raw: Any, passport: Any = None) -> Optional[dict]:
    """Normalise the lot-specific resize recipe (v0.3) or the old batch passport."""
    r = dict(raw or {}) if isinstance(raw, dict) else {}
    pp = dict(passport or {}) if isinstance(passport, dict) else {}
    m = r or pp
    mult = first_list(m.get("width_multipliers"), m.get("widthMultipliers"),
                      m.get("multipliers"))
    scale = first_num(m.get("global_equivalent_scale"), m.get("globalEquivalentScale"),
                      m.get("global_scale"), m.get("scale"), m.get("scale_required"))
    printed = first_num(m.get("printed_mass_g"), m.get("printedMassG"))
    base_printed = first_num(m.get("base_printed_mass_g"), m.get("basePrintedMassG"))
    added = first_num(m.get("added_mass_pct"), m.get("addedMassPct"),
                      m.get("added_mass_percent"))
    if added is None and printed is not None and base_printed:
        added = 100.0 * (printed / base_printed - 1.0)
    out: dict[str, Any] = {
        "verdict": text(m.get("verdict"), 80),
        "global_equivalent_scale": round(scale, 4) if scale is not None else None,
        "added_mass_pct": round(added, 2) if added is not None else None,
        "printed_mass_g": round(printed, 2) if printed is not None else None,
        "base_printed_mass_g": round(base_printed, 2) if base_printed is not None else None,
        "pf": first_num(m.get("pf")),
        "measurement_cv": first_num(m.get("measurement_cv"), m.get("measurementCv")),
        "lot_E": first_num(m.get("lot_E"), m.get("lotE")),
        "lot_sy": first_num(m.get("lot_sy"), m.get("lotSy")),
        "lot_id": text(m.get("lot_id"), 60),
        "supplier": text(m.get("supplier"), 80),
        "measurement_source": text(m.get("measurement_source"), 40),
        "width_multipliers": [round(float(v), 4) for v in mult[:8]] if mult else None,
    }
    p = normalize_printability(m.get("printability"))
    if p:
        out["printability"] = p
    return {k: v for k, v in out.items() if v not in (None, "", [])} or None


def normalize_measurement(raw: Any = None, brief: Any = None, lot: Any = None) -> dict:
    """Measurement uncertainty carried into the lot reliability (v0.3, default 12 %)."""
    m = dict(raw or {}) if isinstance(raw, dict) else {}
    b = dict(brief or {}) if isinstance(brief, dict) else {}
    lo = dict(lot or {}) if isinstance(lot, dict) else {}
    cv = first_num(m.get("cv"), m.get("measurement_cv"), m.get("measurementCv"),
                   b.get("measurement_cv"), b.get("measurementCv"),
                   lo.get("measurement_cv"), lo.get("measurementCv"))
    stated = cv is not None
    if cv is None:
        cv = DEFAULT_MEASUREMENT_CV
    out = {
        "cv": round(cv, 4),
        "cv_pct": round(100.0 * cv, 2),
        "stated": stated,
        "defaulted": not stated,
        "lot_id": text(m.get("lot_id") or b.get("lot_id") or lo.get("lot_id"), 60),
        "supplier": text(m.get("supplier") or b.get("supplier") or lo.get("supplier"), 80),
        "measurement_source": text(
            m.get("measurement_source") or b.get("measurement_source")
            or lo.get("measurement_source"), 40),
        "note": ("measurement_cv retained in the lot-level P_f; a single coupon or "
                 "supplier value does not zero the uncertainty"),
    }
    return out


def normalize_sustained(raw: Any, target_pf: Any = None) -> Optional[dict]:
    """Advisory sustained-load / creep bound (never the static allowable)."""
    s = dict(raw or {}) if isinstance(raw, dict) else {}
    if not s:
        return None
    pf_bound = first_num(s.get("pf_bound"), s.get("pfBound"))
    target = first_num(s.get("target_pf"), s.get("targetPf"), target_pf)
    out: dict[str, Any] = {
        "pf_bound": pf_bound,
        "deflection_bound_mm": first_num(s.get("deflection_bound_mm"),
                                         s.get("deflectionBoundMm")),
        "E_req_bound_MPa": first_num(s.get("E_req_bound_MPa"), s.get("E_req_bound_mpa")),
        "sigma_req_bound_MPa": first_num(s.get("sigma_req_bound_MPa"),
                                         s.get("sigma_req_bound_mpa")),
        "creep_factor": first_num(s.get("creep_factor"), s.get("creepFactor")),
        "compression_factor": first_num(s.get("compression_factor"),
                                        s.get("compressionFactor")),
        "advisory": True,
        "note": ADVISORY_SUSTAINED_NOTE,
    }
    if pf_bound is not None and target is not None:
        out["target_pf"] = target
        out["passes"] = bool(pf_bound <= target)
        out["advisory_note"] = (ADVISORY_SUSTAINED_NOTE if out["passes"]
                                else SUSTAINED_FAIL_NOTE)
    return {k: v for k, v in out.items() if v is not None}


def normalize_feasibility(raw: Any, target_pf: Any = None) -> Optional[dict]:
    """Engine feasibility gate result (``family_feasibility`` in the engine)."""
    f = dict(raw or {}) if isinstance(raw, dict) else {}
    if not f:
        return None
    feasible = f.get("feasible")
    min_pf = first_num(f.get("min_achievable_pf"), f.get("minAchievablePf"),
                       f.get("min_achievable_P_f"))
    target = first_num(f.get("target_pf"), f.get("targetPf"), target_pf)
    out: dict[str, Any] = {
        "feasible": bool(feasible) if feasible is not None else None,
        "min_achievable_pf": min_pf,
        "target_pf": target,
        "max_width_mm": first_num(f.get("max_width_mm"), f.get("maxWidthMm")),
        "note": ("engine gate: the widest printable uniform lattice is checked before any "
                 "AI candidate is proposed"),
    }
    return {k: v for k, v in out.items() if v is not None}


# ---------------------------------------------------------------------------
# canonical payload builders
# ---------------------------------------------------------------------------
def _get(body: Any, key: str, default: Any = None) -> Any:
    if isinstance(body, dict):
        return body.get(key, default)
    return getattr(body, key, default)


def build_plan_payload(body: Any) -> dict:
    """Canonical payload for POST /api/design/plan."""
    brief = normalize_brief(_get(body, "brief"), _get(body, "defaults"))
    baseline = dict(_get(body, "baseline") or {})
    first_pass = dict(_get(body, "first_pass") or {})
    material = dict(_get(body, "material") or {})
    if not baseline.get("uniform_width_mm") and first_pass.get("feasible_uniform_width_mm"):
        baseline["uniform_width_mm"] = first_pass["feasible_uniform_width_mm"]
    if not material and isinstance(first_pass.get("material"), dict):
        material = dict(first_pass["material"])
    feasibility = normalize_feasibility(_get(body, "feasibility") or
                                        first_pass.get("feasibility"),
                                        brief.get("target_pf"))
    payload = {
        "family_scope": text(_get(body, "family_scope"), 240) or FAMILY_SCOPE,
        "brief": brief,
        "baseline": baseline,
        "material": material,
        "printability_limits": dict(PRINTABILITY_LIMITS),
        "printability_rule": ("candidates must respect the printability limits "
                              "(neighbour width ratio <= 1.5, slenderness <= 30) and the "
                              "engine feasibility gate"),
    }
    if feasibility:
        payload["feasibility"] = feasibility
    return payload


def _shared_blocks(body: Any) -> dict:
    facts = dict(_get(body, "facts") or {})
    design_raw = dict(_get(body, "design") or {})
    selected = dict(_get(body, "selected") or {})
    engine = dict(_get(body, "engine") or {})
    brief = normalize_brief(_get(body, "brief"), _get(body, "defaults"))
    design = normalize_design(facts, design_raw, selected, engine, body)
    printability = design.get("printability") or normalize_printability(
        _get(body, "printability"))
    measurement = normalize_measurement(_get(body, "measurement"), brief, _get(body, "lot"))
    feasibility = normalize_feasibility(
        _get(body, "feasibility") or design.get("feasibility") or facts.get("feasibility"),
        brief.get("target_pf") or design.get("target_pf"))
    if feasibility and feasibility.get("feasible") is True and design.get("feasible") is None:
        design["feasible"] = True
    proof_block = _get(body, "proof")
    proof_block = proof_block if isinstance(proof_block, dict) else {}
    lot_recipe = normalize_lot_recipe(
        _get(body, "lot_recipe") or _get(body, "recipe") or proof_block.get("lot_recipe"),
        _get(body, "batch_passport") or proof_block.get("passport"))
    sustained_raw = (_get(body, "sustained_bound") or proof_block.get("sustained_bound")
                     or facts.get("sustained_bound"))
    sustained = normalize_sustained(sustained_raw,
                                    brief.get("target_pf") or design.get("target_pf"))
    payload: dict[str, Any] = {
        "family_scope": text(_get(body, "family_scope"), 240) or FAMILY_SCOPE,
        "brief": brief,
        "design": design,
        "measurement": measurement,
        "printability_limits": dict(PRINTABILITY_LIMITS),
        "mass_basis": MASS_BASIS,
    }
    if printability:
        payload["printability"] = printability
    if lot_recipe:
        payload["lot_recipe"] = lot_recipe
    if sustained:
        payload["sustained_bound"] = sustained
    if feasibility:
        payload["feasibility"] = feasibility
    comparison = _get(body, "comparison")
    if comparison:
        payload["comparison"] = comparison
    material = _get(body, "material")
    if material:
        payload["material"] = material
    sensitivity = _get(body, "sensitivity")
    if sensitivity:
        payload["sensitivity"] = sensitivity
    validation = _get(body, "validation")
    if validation:
        payload["validation"] = validation
    return payload


def build_review_payload(body: Any) -> dict:
    """Canonical payload for POST /api/design/review (v0.2 and v0.3 request shapes)."""
    payload = _shared_blocks(body)
    if _get(body, "target_pf") is not None:
        payload["target_pf"] = first_num(_get(body, "target_pf"))
    return payload


def build_proof_payload(body: Any) -> dict:
    """Canonical payload for POST /api/proof/memo (v0.2 and v0.3 request shapes)."""
    payload = _shared_blocks(body)
    proof = _get(body, "proof")
    if isinstance(proof, dict):
        extra = {k: v for k, v in proof.items()
                 if k not in ("passport", "lot_recipe", "sustained_bound")}
        if extra:
            payload.setdefault("proof", extra)
    if _get(body, "target_pf") is not None:
        payload["target_pf"] = first_num(_get(body, "target_pf"))
    return payload

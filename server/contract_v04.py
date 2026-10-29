"""AnyRB v0.4 — server-side AI payload contract additions.

Responds to the second external review's remaining gaps:

* **printed-process gate** — only FDM/FFF material data is valid for the printed
  bracket family; IM/compression presets may never feed the printed-lattice AI path.
* **elongation / brittle-lot screen** — surfaced as a *conservative add-on*, never
  folded into the headline two-property P_f.
* **union-mass polish** — exposed as an engine capability (the AI never computes mass).
* **assumption bounds** — correlation / lot-split sensitivity, labelled *sensitivity,
  not validation*.
* **lot identity / QC record** — lot id, supplier, measurement source/CV are a record;
  recycled-content % is a paperwork claim, not a simulated property.

This module builds on :mod:`server.contract_v03`: every v0.2/v0.3 request payload stays
valid, v0.4 blocks are optional, and the canonical payload is still the single list of
numbers the AI may cite (the number-grounding gate checks against it).
"""
from __future__ import annotations

from typing import Any, Optional

from . import contract_v03 as V3

# ---------------------------------------------------------------------------
# wording constants (also used by prompts/fallbacks/docs)
# ---------------------------------------------------------------------------
FAMILY_SCOPE = V3.FAMILY_SCOPE
PROCESS_RULE = ("only FDM/FFF material data is valid for the printed bracket family; "
                "IM/compression presets are contrast data, never printed-lattice input")
PROCESS_MISMATCH_NOTE = ("the selected material preset is IM/compression data and cannot be used "
                         "for a printed lattice — design is blocked; choose an FDM/FFF preset "
                         "(e.g. rPETG)")
BRITTLE_NOTE = "conservative add-on, not folded into the headline two-property P_f"
BRITTLE_HEADLINE = "not in the headline P_f"
ASSUMPTIONS_NOTE = "unmeasured assumption sensitivity, not validation"
QC_RECYCLED_NOTE = "paperwork claim (not simulated)"

_PRINTED_TOKENS = ("fdm", "fff", "material extrusion", "printed")
_UNPRINTED_TOKENS = ("im", "injection", "compression", "mould", "mold", "sla", "resin",
                     "powder", "sls", "mjf", "polyjet", "photopolymer")


def is_printed_process(process: Any) -> Optional[bool]:
    """True for FDM/FFF-style printed data, False for moulded/resin, None if unknown."""
    p = V3.text(process, 60).lower()
    if not p:
        return None
    if any(tok in p for tok in _PRINTED_TOKENS):
        return True
    if any(tok in p for tok in _UNPRINTED_TOKENS):
        return False
    return None


# ---------------------------------------------------------------------------
# v0.4 block normalisers
# ---------------------------------------------------------------------------
def normalize_brittle(raw: Any) -> Optional[dict]:
    """Elongation / brittle-lot screen (engine ``evaluate()`` brittle fields)."""
    b = dict(raw or {}) if isinstance(raw, dict) else {}
    if not b:
        return None
    strain_pct = V3.first_num(b.get("strain_req_pct"), b.get("strainReqPct"),
                              b.get("strain_req_percent"))
    strain_raw = V3.first_num(b.get("strain_req"), b.get("strainReq"))
    if strain_pct is None and strain_raw is not None:
        strain_pct = strain_raw * 100.0 if strain_raw <= 0.5 else strain_raw
    pf = V3.first_num(b.get("pf_brittle"), b.get("pfBrittle"))
    bound = V3.first_num(b.get("pf_bound"), b.get("pf_brittle_bound"), b.get("pfBound"))
    out: dict[str, Any] = {
        "strain_req_pct": round(strain_pct, 3) if strain_pct is not None else None,
        "elongation_mean_pct": V3.first_num(b.get("elongation_mean_pct"),
                                            b.get("elongationMeanPct")),
        "elongation_cv": V3.first_num(b.get("elongation_cv"), b.get("elongationCv")),
        "pf_brittle": pf,
        "pf_brittle_pct": round(100.0 * pf, 3) if pf is not None else None,
        "pf_bound": bound,
        "pf_bound_pct": round(100.0 * bound, 3) if bound is not None else None,
        "label": BRITTLE_NOTE,
        "headline": False,
        "note": V3.text(b.get("note"), 240),
    }
    return {k: v for k, v in out.items() if v not in (None, "", [])} or None


def _pf_list(raw: Any, key: str) -> list[dict]:
    out: list[dict] = []
    if isinstance(raw, list):
        for item in raw:
            if not isinstance(item, dict):
                continue
            entry: dict[str, Any] = {}
            for k in (key, "pf"):
                v = V3.num(item.get(k))
                if v is not None:
                    entry[k] = round(v, 6)
            if "pf" in entry:
                out.append(entry)
    return out


def normalize_assumptions(raw: Any) -> Optional[dict]:
    """Assumption bounds: correlation + lot/within split sensitivity (not validation)."""
    a = dict(raw or {}) if isinstance(raw, dict) else {}
    if not a:
        return None
    corr_range = _pf_list(a.get("corr_range") or a.get("corrRange"), "corr")
    split_range = _pf_list(a.get("split_range") or a.get("splitRange"), "lot_fraction")
    pf_min = V3.first_num(a.get("pf_min"), a.get("pfMin"))
    pf_max = V3.first_num(a.get("pf_max"), a.get("pfMax"))
    if pf_min is None and corr_range:
        vals = [e["pf"] for e in corr_range]
        pf_min = min(vals)
    if pf_max is None and split_range:
        vals = [e["pf"] for e in split_range] + ([e["pf"] for e in corr_range] if corr_range else [])
        pf_max = max(vals) if vals else None
    out: dict[str, Any] = {
        "pf_min": pf_min, "pf_max": pf_max,
        "pf_min_pct": round(100.0 * pf_min, 3) if pf_min is not None else None,
        "pf_max_pct": round(100.0 * pf_max, 3) if pf_max is not None else None,
        "corr_range": corr_range,
        "split_range": split_range,
        "split_range_pct": [{"lot_fraction_pct": round(100.0 * e["lot_fraction"], 2),
                             "pf": e["pf"]} for e in split_range if "lot_fraction" in e],
        "label": ASSUMPTIONS_NOTE,
        "is_validation": False,
    }
    return {k: v for k, v in out.items() if v not in (None, "", [])} or None


def normalize_process(raw: Any = None, material: Any = None,
                      feasibility: Any = None) -> Optional[dict]:
    """Printed-process gate result: {ok, process, reason, rule}."""
    r = dict(raw or {}) if isinstance(raw, dict) else {}
    m = dict(material or {}) if isinstance(material, dict) else {}
    f = dict(feasibility or {}) if isinstance(feasibility, dict) else {}
    process = V3.text(m.get("process") or r.get("process") or f.get("process"), 60)
    ok = None
    for v in (r.get("ok"), r.get("process_ok"), r.get("processOk"),
              f.get("process_ok"), f.get("processOk")):
        if isinstance(v, bool):
            ok = v
            break
    reason = V3.text(r.get("reason") or f.get("reason"), 80)
    if ok is None and process:
        printed = is_printed_process(process)
        if printed is not None:
            ok = printed
            if not printed and not reason:
                reason = "process_mismatch"
    if ok is None and reason == "process_mismatch":
        ok = False
    if ok is None and not process and not reason:
        return None
    out = {
        "ok": ok,
        "process": process,
        "reason": reason or (None if ok is None else ""),
        "rule": PROCESS_RULE,
    }
    return {k: v for k, v in out.items() if v not in (None, "")} | {"ok": ok}


def normalize_qc(raw: Any = None, brief: Any = None, lot: Any = None,
                 measurement: Any = None) -> Optional[dict]:
    """Lot identity / QC record (record, not a simulated property)."""
    q = dict(raw or {}) if isinstance(raw, dict) else {}
    b = dict(brief or {}) if isinstance(brief, dict) else {}
    lo = dict(lot or {}) if isinstance(lot, dict) else {}
    me = dict(measurement or {}) if isinstance(measurement, dict) else {}
    lot_id = V3.text(q.get("lot_id") or q.get("lotId") or me.get("lot_id")
                     or b.get("lot_id") or lo.get("lot_id"), 64)
    supplier = V3.text(q.get("supplier") or q.get("vendor") or me.get("supplier")
                       or b.get("supplier") or lo.get("supplier"), 80)
    source = V3.text(q.get("measurement_source") or q.get("measurementSource")
                     or me.get("measurement_source") or lo.get("measurement_source"), 40)
    # Precedence: an explicit QC measurement CV > an explicitly stated measurement block
    # > the measurement block's default (0.12). The QC panel of the app sends percent.
    mcv = V3.first_num(q.get("measurement_cv"), q.get("measurementCv"))
    if mcv is None:
        legacy = V3.first_num(q.get("cv"))
        if legacy is not None:
            mcv = legacy / 100.0 if legacy > 0.5 else legacy
    mcv_explicit = mcv is not None
    if mcv is None and me.get("stated"):
        mcv = V3.first_num(me.get("cv"))
    # never turn the measurement block's *default* (0.12) into a QC record

    recycled = V3.first_num(q.get("recycled_content_pct"), q.get("recycledPct"),
                            q.get("recycled_content"))
    if recycled is not None and recycled <= 1.0:
        recycled = 100.0 * recycled
    lot_e = V3.first_num(q.get("lot_E"), q.get("lotE"), b.get("lot_E"))
    lot_sy = V3.first_num(q.get("lot_sy"), q.get("lotSy"), b.get("lot_sy"))
    out: dict[str, Any] = {
        "lot_id": lot_id, "supplier": supplier, "measurement_source": source,
        "measurement_cv": mcv,
        "measurement_cv_pct": round(100.0 * mcv, 2) if mcv is not None else None,
        "measurement_cv_stated": bool(mcv_explicit),
        "recycled_content_pct": round(recycled, 1) if recycled is not None else None,
        "recycled_content_note": QC_RECYCLED_NOTE,
        "lot_E": lot_e, "lot_sy": lot_sy,
    }
    meaningful = ("lot_id", "supplier", "measurement_source", "measurement_cv",
                  "recycled_content_pct", "lot_E", "lot_sy")
    if not any(out.get(k) not in (None, "") for k in meaningful):
        return None
    return {k: v for k, v in out.items() if v not in (None, "")}


def _sustained_from_app(body: Any, proof_block: dict, facts: dict) -> Optional[dict]:
    """Pick up the app's sustained-bound keys (v0.3 app sends proof.sustained/facts.*)."""
    for raw in (V3._get(body, "sustained_bound"), V3._get(body, "sustained"),
                proof_block.get("sustained_bound"), proof_block.get("sustained")):
        got = V3.normalize_sustained(raw, facts.get("target_pf"))
        if got:
            return got
    flat = {
        "pf_bound": V3.first_num(facts.get("sustained_pf_bound"),
                                 facts.get("pf_bound")),
        "deflection_bound_mm": V3.first_num(facts.get("sustained_deflection_bound_mm"),
                                            facts.get("deflection_bound_mm")),
        "target_pf": V3.first_num(facts.get("target_pf")),
    }
    if flat["pf_bound"] is not None or flat["deflection_bound_mm"] is not None:
        return V3.normalize_sustained(flat, facts.get("target_pf"))
    return None


def _recipe_from_sources(body: Any, proof_block: dict) -> Optional[dict]:
    for raw in (V3._get(body, "lot_recipe"), V3._get(body, "recipe"),
                proof_block.get("lot_recipe"), proof_block.get("recipe")):
        got = V3.normalize_lot_recipe(raw, V3._get(body, "batch_passport")
                                      or proof_block.get("passport"))
        if got:
            return got
    return None


# ---------------------------------------------------------------------------
# payload builders (v0.3 builders + v0.4 blocks)
# ---------------------------------------------------------------------------
def build_plan_payload(body: Any) -> dict:
    payload = V3.build_plan_payload(body)
    material = dict(V3._get(body, "material") or {})
    first_pass = dict(V3._get(body, "first_pass") or {})
    feasibility_raw = dict(V3._get(body, "feasibility") or
                           first_pass.get("feasibility") or {})
    process = normalize_process(V3._get(body, "process"), material, feasibility_raw) or {}
    payload["process"] = process or None
    payload["process_rule"] = PROCESS_RULE
    if process.get("ok") is False:
        payload["process_blocked"] = True
        payload["process_mismatch_note"] = PROCESS_MISMATCH_NOTE
    feasibility = dict(payload.get("feasibility") or {})
    for k in ("process_ok", "processOk", "reason", "detail"):
        if feasibility_raw.get(k) is not None:
            feasibility[{"processOk": "process_ok"}.get(k, k)] = feasibility_raw[k]
    if process.get("ok") is False:
        feasibility.setdefault("feasible", False)
        feasibility.setdefault("process_ok", False)
        feasibility.setdefault("reason", "process_mismatch")
    payload["feasibility"] = feasibility or None
    return payload


def _enrich_design(payload: dict, body: Any, facts: dict) -> None:
    """Fix the app's analytic-upper-bound key and printability fields (v0.3 app shape)."""
    design = payload.get("design")
    if not isinstance(design, dict):
        return
    analytic = V3.first_num(facts.get("mass_analytic_upper_bound_g"),
                            facts.get("mass_analytic_g"),
                            facts.get("massAnalyticG"),
                            facts.get("mass_g") if facts.get("printed_mass_g") is not None else None)
    if analytic is not None:
        design["mass_analytic_g"] = round(analytic, 2)
    printed = V3.first_num(facts.get("printed_mass_g"), facts.get("printedMassG"))
    if printed is not None:
        design["printed_mass_g"] = round(printed, 2)


def _v04_blocks(body: Any, payload: dict) -> dict:
    facts = dict(V3._get(body, "facts") or {})
    proof_block = V3._get(body, "proof")
    proof_block = proof_block if isinstance(proof_block, dict) else {}
    selected = dict(V3._get(body, "selected") or {})
    engine = dict(V3._get(body, "engine") or {})
    design = dict(V3._get(body, "design") or {})

    def pick_block(key: str) -> Any:
        for src in (V3._get(body, key), facts.get(key), selected.get(key),
                    design.get(key), engine.get(key), proof_block.get(key)):
            if isinstance(src, dict) and src:
                return src
        return None

    brittle = normalize_brittle(pick_block("brittle")
                                or pick_block("brittle_screen")
                                or ({"strain_req_pct": facts.get("strain_req_pct"),
                                     "elongation_mean_pct": facts.get("elongation_mean_pct"),
                                     "elongation_cv": facts.get("elongation_cv"),
                                     "pf_brittle": facts.get("pf_brittle"),
                                     "pf_brittle_bound": facts.get("pf_brittle_bound")}
                                    if facts.get("pf_brittle") is not None else None))
    assumptions = normalize_assumptions(pick_block("assumptions")
                                        or pick_block("assumption_bounds"))
    process = normalize_process(V3._get(body, "process"),
                                V3._get(body, "material") or {},
                                V3._get(body, "feasibility") or facts.get("feasibility") or {})
    qc = normalize_qc(V3._get(body, "qc"), payload.get("brief"),
                      V3._get(body, "lot"), payload.get("measurement"))
    if brittle:
        payload["brittle"] = brittle
    if assumptions:
        payload["assumptions"] = assumptions
    if qc:
        payload["qc"] = qc
        if qc.get("measurement_cv_stated") and qc.get("measurement_cv") is not None:
            meas = dict(payload.get("measurement") or {})
            meas.update({"cv": qc["measurement_cv"],
                         "cv_pct": qc.get("measurement_cv_pct"),
                         "stated": True, "defaulted": False})
            payload["measurement"] = meas
    payload["process"] = process
    payload["process_rule"] = PROCESS_RULE
    if brittle:
        payload["brittle_note"] = BRITTLE_NOTE
    if assumptions:
        payload["assumptions_note"] = ASSUMPTIONS_NOTE
    sustained = _sustained_from_app(body, proof_block, facts)
    if sustained:
        payload["sustained_bound"] = sustained
    recipe = _recipe_from_sources(body, proof_block)
    if recipe:
        payload["lot_recipe"] = recipe
    return payload


def build_review_payload(body: Any) -> dict:
    payload = V3.build_review_payload(body)
    facts = dict(V3._get(body, "facts") or {})
    _enrich_design(payload, body, facts)
    return _v04_blocks(body, payload)


def build_proof_payload(body: Any) -> dict:
    payload = V3.build_proof_payload(body)
    facts = dict(V3._get(body, "facts") or {})
    _enrich_design(payload, body, facts)
    return _v04_blocks(body, payload)

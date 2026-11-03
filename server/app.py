"""AnyRB AI backend — live Meta models in the design loop.

Run:
    cd AnyRB
    .venv/bin/python -m server.app          # http://127.0.0.1:8787
    # or: .venv/bin/uvicorn server.app:app --port 8787
    # mock mode (no key / no network): ANYRB_MOCK=1 .venv/bin/python -m server.app
    #   (or run live and add ?mock=1 to any AI endpoint to force the fallback path)

The browser never receives the API key. Every AI endpoint returns a schema-valid
object (`server/schemas.py`) with `_meta` = {model, latency_s, cached, fallback,
tokens}; deterministic fallbacks keep the demo alive if the network/API is
unavailable. Requests and responses are logged to server/provenance.jsonl.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import time
from collections import defaultdict, deque
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import ValidationError

from . import contract_v03, contract_v04, meta_client, prompts, schemas, product_ai

PROJECT = Path(__file__).resolve().parent.parent
INDEX = PROJECT / "index.html"
ASSETS = PROJECT / "demo" / "assets"
VALIDATION_JSON = PROJECT / "validation" / "results.json"

MAX_BODY_MB = float(os.environ.get("ANYRB_MAX_BODY_MB", "16"))
MAX_BODY_BYTES = int(MAX_BODY_MB * 1024 * 1024)
MAX_TEXT = schemas.MAX_TEXT
MAX_UPLOAD = schemas.MAX_UPLOAD
RATE_LIMIT = int(os.environ.get("ANYRB_RATE_LIMIT_RPM", "120"))

APP_VERSION = "0.4"

app = FastAPI(title="AnyRB AI", version=APP_VERSION,
              description="Local FastAPI backend putting Meta AI models in the AnyRB design loop. "
                          "The browser never sees the API key.")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

_requests: dict[str, deque] = defaultdict(lambda: deque(maxlen=RATE_LIMIT))


# ---------------------------------------------------------------------------
# request guards (size + rate)
# ---------------------------------------------------------------------------
@app.middleware("http")
async def body_size_limit(request: Request, call_next):  # noqa: ANN001
    cl = request.headers.get("content-length")
    if cl and cl.isdigit() and int(cl) > MAX_BODY_BYTES:
        return JSONResponse({"ok": False, "error": "payload_too_large",
                             "message": f"request body exceeds {MAX_BODY_MB:g} MB"},
                            status_code=413)
    return await call_next(request)


def _rate_limit(request: Request) -> None:
    ip = (request.client.host if request.client else "local") or "local"
    now = time.time()
    q = _requests[ip]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= RATE_LIMIT:
        raise HTTPException(429, f"Too many requests ({RATE_LIMIT}/min); wait a moment.")
    q.append(now)


def _user_meta_scope(request: Request):
    """The page's Settings may supply the user's own provider/endpoint/model/key per request.

    Read from headers only, used for this request only, never stored or logged.
    """
    key = (request.headers.get("x-user-meta-key") or "").strip()[:512] or None
    model = (request.headers.get("x-user-meta-model") or "").strip() or None
    provider = (request.headers.get("x-user-provider") or "").strip().lower() or None
    base_url = (request.headers.get("x-user-base-url") or "").strip() or None
    return meta_client.request_scope(key=key, model=model, provider=provider, base_url=base_url)


def _want_mock(request: Request) -> bool | None:
    """Per-request mock override: ?mock=1 / ?mock=0 or X-AnyRB-Mock header.

    Returns None when the caller did not override (process-wide MOCK / missing
    key rules still apply inside meta_client).
    """
    for value in (request.query_params.get("mock"), request.headers.get("x-anyrb-mock")):
        if value is not None:
            return value.strip().lower() in ("1", "true", "yes", "on")
    return None


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, float(x)))


def _num(x, default=None):
    try:
        v = float(x)
        if v != v:  # NaN
            return default
        return v
    except (TypeError, ValueError):
        return default


def _clean_text(s, max_len: int = 400) -> str:
    s = re.sub(r"<[^>]+>", " ", str(s or ""))
    s = re.sub(r"\s+", " ", s).strip()
    return s[:max_len]


def _respond(model_cls, data: dict) -> dict:
    """Validate a handler response through its pydantic model, then serialise.

    If validation ever fails (it should not: coercers sanitise first) we return
    the payload with an explicit fallback marker instead of a 500, so the demo
    never dies. `_model`/`_cached` mirror `_meta.model`/`_meta.cached`.
    """
    payload = dict(data)
    meta = payload.get("_meta")
    if not isinstance(meta, dict):
        meta = {}
        payload["_meta"] = meta
    payload["_model"] = meta.get("model", "fallback")
    payload["_cached"] = bool(meta.get("cached", False))
    try:
        out = model_cls.model_validate(payload).model_dump(by_alias=True)
    except ValidationError as exc:  # pragma: no cover - defensive
        meta["fallback"] = True
        meta["schema_error"] = f"{exc.error_count()} validation error(s)"
        payload["_meta"] = meta
        return payload
    out["_model"] = out.get("_meta", {}).get("model", "fallback")
    out["_cached"] = bool(out.get("_meta", {}).get("cached", False))
    return out


def _validation_summary() -> dict | None:
    if not VALIDATION_JSON.exists():
        return None
    try:
        data = json.loads(VALIDATION_JSON.read_text())
        checks = data.get("checks", data if isinstance(data, list) else [])
        counts = {"PASS": 0, "WARN": 0, "FAIL": 0}
        for c in checks:
            st = str(c.get("status", "")).upper()
            if st in counts:
                counts[st] += 1
        return {"counts": counts, "total": len(checks),
                "generated": (data.get("generated_utc") or data.get("generated")) if isinstance(data, dict) else None,
                "report": "server/tests"}
    except Exception:
        return None


def _grounded_or_fallback(kind: str, out: dict, payload: dict, fallback: dict) -> dict:
    """Every number the model writes must exist in the payload it was given."""
    text_fields = []
    for k in ("memo", "key_risk", "claim_level"):
        if isinstance(out.get(k), str):
            text_fields.append(out[k])
    for k in ("next_actions", "what_would_change_answer", "recommended_tests", "caveats"):
        if isinstance(out.get(k), list):
            text_fields.extend(str(x) for x in out[k] if isinstance(x, str))
    report = prompts.grounding_report(" ".join(text_fields), payload)
    meta = dict(out.get("_meta") or {})
    if not report["ok"]:
        fb = dict(fallback)
        fb["_meta"] = {**meta, "fallback": True,
                       "model": meta.get("model") or "fallback",
                       "grounding": report}
        return fb
    out["_meta"] = {**meta, "grounding": report}
    return out


# ---------------------------------------------------------------------------
# coercion + validation (first line of defence; schemas are the hard gate)
# ---------------------------------------------------------------------------
_PRESET_LABELS = {"rpetg": "rPETG", "rpet": "rPET", "rhdpe": "rHDPE", "rpp": "rPP"}


def _brief_compat(brief: dict) -> dict:
    """Camel-case mirror consumed by the browser client (identical values)."""
    return {
        "partType": brief["part_label"],
        "loadN": brief["load_N"],
        "deflLimitMm": brief["deflection_limit_mm"],
        "targetPf": brief["target_pf"],
        "process": brief.get("process") or "FDM/FFF",
        "preset": _PRESET_LABELS.get(brief.get("material_key")),
        "material_key": brief.get("material_key"),
        "constraints": brief.get("constraints", []),
        "notes": brief.get("rationale", ""),
        "massCapG": brief.get("mass_cap_g"),
        "measurementCv": brief.get("measurement_cv"),
    }


def _coerce_brief(raw: dict, text: str, defaults: dict | None) -> dict:
    fb = prompts.fallback_brief(text, defaults)
    out = dict(fb)
    if isinstance(raw, dict):
        for k in ("part_label", "process", "rationale", "confidence"):
            if isinstance(raw.get(k), str) and raw[k].strip():
                out[k] = _clean_text(raw[k], 200)
        load = _num(raw.get("load_N"))
        if load is not None and 0 < load <= 20000:
            out["load_N"] = round(load, 2)
        ul = _num(raw.get("deflection_limit_mm"))
        if ul is not None and 0.05 <= ul <= 50:
            out["deflection_limit_mm"] = round(ul, 3)
        pf = _num(raw.get("target_pf"))
        if pf is not None and 0 < pf <= 0.5:
            out["target_pf"] = round(pf, 4)
        mc = _num(raw.get("mass_cap_g"))
        if mc is not None and 0 < mc <= 100000:
            out["mass_cap_g"] = round(mc, 1)
        mk = raw.get("material_key")
        if isinstance(mk, str) and mk.lower() in prompts.MATERIAL_KEYS:
            out["material_key"] = mk.lower()
        if isinstance(raw.get("constraints"), list):
            out["constraints"] = [_clean_text(c, 80) for c in raw["constraints"][:6] if str(c).strip()]
        if isinstance(raw.get("missing"), list):
            out["missing"] = [_clean_text(m, 40) for m in raw["missing"][:10]]
        if raw.get("confidence") in ("high", "medium", "low"):
            out["confidence"] = raw["confidence"]
        mcv = _num(raw.get("measurement_cv", raw.get("measurementCv")))
        if mcv is not None and 0.0 <= mcv <= 0.5:
            out["measurement_cv"] = round(mcv, 4)
            stated_flag = raw.get("measurement_cv_stated")
            if isinstance(stated_flag, bool):
                out["measurement_cv_stated"] = stated_flag
            else:
                fb_cv = float(fb.get("measurement_cv", contract_v03.DEFAULT_MEASUREMENT_CV))
                out["measurement_cv_stated"] = abs(mcv - fb_cv) > 1e-9
    if isinstance(defaults, dict):
        mcv = _num(defaults.get("measurement_cv"))
        if mcv is not None and 0.0 <= mcv <= 0.5 and "measurement_cv" not in out:
            out["measurement_cv"] = round(mcv, 4)
            out["measurement_cv_stated"] = True
    out.setdefault("measurement_cv", contract_v03.DEFAULT_MEASUREMENT_CV)
    out["measurement_cv"] = _clamp(out["measurement_cv"], 0.0, 0.5)
    out.setdefault("measurement_cv_stated", False)
    out["load_N"] = _clamp(out["load_N"] or 150.0, 1.0, 20000.0)
    out["deflection_limit_mm"] = _clamp(out["deflection_limit_mm"] or 2.5, 0.1, 25.0)
    out["target_pf"] = _clamp(out["target_pf"] or 0.01, 0.0001, 0.5)
    if out.get("material_key") not in prompts.MATERIAL_KEYS:
        out["material_key"] = "rpetg"
    return out


def _coerce_lot(raw: dict, text: str) -> dict:
    fb = prompts.fallback_lot(text)
    out = dict(fb)
    if isinstance(raw, dict):
        for k in ("material_key", "source_label", "confidence"):
            if isinstance(raw.get(k), str) and raw[k].strip():
                out[k] = _clean_text(raw[k], 160)
        for k, lo, hi in (("E_mean", 1, 20000), ("sy_mean", 0.1, 2000),
                          ("rho", 0.5, 2.5), ("corr", -0.99, 0.99)):
            v = _num(raw.get(k))
            if v is not None and lo <= v <= hi:
                out[k] = round(v, 3)
        for k in ("E_cv", "sy_cv"):
            v = _num(raw.get(k))
            if v is not None and 0 < v <= 0.9:
                out[k] = round(v, 4)
        for k in ("fields_found", "assumptions"):
            if isinstance(raw.get(k), list):
                out[k] = [_clean_text(x, 120) for x in raw[k][:8] if str(x).strip()]
        if raw.get("confidence") in ("high", "medium", "low"):
            out["confidence"] = raw["confidence"]
        for k, limit in (("lot_id", 60), ("supplier", 80)):
            v = raw.get(k)
            if isinstance(v, str) and v.strip():
                out[k] = _clean_text(v, limit)
        src = raw.get("measurement_source")
        if isinstance(src, str):
            src = src.strip().lower()
            if src in ("datasheet", "certificate", "email", "measurement", "unknown"):
                out["measurement_source"] = src
        mcv = _num(raw.get("measurement_cv", raw.get("measurementCv")))
        if mcv is not None and 0.0 < mcv <= 0.5:
            out["measurement_cv"] = round(mcv, 4)
            stated_flag = raw.get("measurement_cv_stated")
            if isinstance(stated_flag, bool):
                out["measurement_cv_stated"] = stated_flag
            else:
                fb_cv = float(fb.get("measurement_cv", contract_v03.DEFAULT_MEASUREMENT_CV))
                out["measurement_cv_stated"] = abs(mcv - fb_cv) > 1e-9
    out.setdefault("lot_id", None)
    out.setdefault("supplier", None)
    out.setdefault("measurement_source", "unknown")
    out.setdefault("measurement_cv", contract_v03.DEFAULT_MEASUREMENT_CV)
    out["measurement_cv"] = _clamp(out["measurement_cv"], 0.0, 0.5)
    out.setdefault("measurement_cv_stated", False)
    if out.get("material_key") not in prompts.MATERIAL_KEYS:
        out["material_key"] = "unknown"
    return out


def _coerce_plan(raw: dict, payload: dict) -> dict:
    fb = prompts.fallback_plan(payload)
    cands = raw.get("candidates") if isinstance(raw, dict) else None
    if not isinstance(cands, list) or len(cands) < 3:
        return fb
    cleaned = []
    for i, c in enumerate(cands[:3]):
        if not isinstance(c, dict):
            return fb
        widths = c.get("width_priors_mm")
        if not isinstance(widths, list) or len(widths) != 8:
            return fb
        try:
            ws = [round(_clamp(float(w), 1.0, 4.0), 3) for w in widths]
        except (TypeError, ValueError):
            return fb
        cleaned.append({
            "id": chr(65 + i),
            "name": _clean_text(c.get("name") or fb["candidates"][i]["name"], 30),
            "strategy": _clean_text(c.get("strategy") or "", 60),
            "width_priors_mm": ws,
            "why": _clean_text(c.get("why") or "", 120),
            "risk": _clean_text(c.get("risk") or "", 80),
        })
    # Require genuine diversity (avoid three identical proposals)
    uniq = {tuple(c["width_priors_mm"]) for c in cleaned}
    if len(uniq) < 2:
        return fb
    return {"candidates": cleaned}


def _coerce_review(raw: dict, payload: dict) -> dict:
    fb = prompts.fallback_review(payload)
    if not isinstance(raw, dict) or not isinstance(raw.get("memo"), str):
        return fb
    out = {
        "memo": _clean_text(raw.get("memo"), 900),
        "key_risk": _clean_text(raw.get("key_risk") or fb["key_risk"], 240),
        "next_actions": [_clean_text(x, 160) for x in (raw.get("next_actions") or [])[:3]],
        "caveats": [_clean_text(x, 160) for x in (raw.get("caveats") or [])[:3]],
    }
    if len(out["memo"].split()) < 8:
        return fb
    if not out["next_actions"]:
        out["next_actions"] = fb["next_actions"]
    for k in ("family_scope", "mass_basis", "sustained_advisory"):
        if k in fb:
            out.setdefault(k, fb[k])
    return out


def _coerce_proof(raw: dict, payload: dict) -> dict:
    fb = prompts.fallback_proof(payload)
    if not isinstance(raw, dict) or not isinstance(raw.get("memo"), str):
        return fb
    out = {
        "memo": _clean_text(raw.get("memo"), 1100),
        "what_would_change_answer": [_clean_text(x, 180) for x in
                                     (raw.get("what_would_change_answer") or [])[:4]],
        "recommended_tests": [_clean_text(x, 180) for x in (raw.get("recommended_tests") or [])[:4]],
        "claim_level": _clean_text(raw.get("claim_level") or fb["claim_level"], 200),
    }
    if len(out["memo"].split()) < 8:
        return fb
    if not out["what_would_change_answer"]:
        out["what_would_change_answer"] = fb["what_would_change_answer"]
    if not out["recommended_tests"]:
        out["recommended_tests"] = fb["recommended_tests"]
    for k in ("family_scope", "mass_basis", "sustained_advisory"):
        if k in fb:
            out.setdefault(k, fb[k])
    return out


# ---------------------------------------------------------------------------
# endpoints
# ---------------------------------------------------------------------------
@app.get("/api/health", response_model=schemas.HealthResponse)
def health() -> dict:
    cfg = meta_client.configured()
    calls = meta_client.session_calls()
    live_calls = [c for c in calls if not c.get("fallback") and not c.get("cached")]
    if cfg["live"]:
        mode = "live"
    elif cfg["key_present"]:
        mode = "mock"          # key present but mock mode forced
    else:
        mode = "offline"       # no key: fallbacks/cache only
    payload = {
        "ok": True,
        "mode": mode,
        "ai": {**cfg,
               "calls_logged": len(calls),
               "live_calls_logged": len(live_calls),
               "last_latency_s": (live_calls[-1].get("latency_s") if live_calls else None),
               "model_latencies": meta_client.model_latencies(),
               "cache": meta_client.cache_stats()},
        "version": "v0.4",
        "contract_version": "v0.4",
        "active_app": {
            "name": "AnyRB",
            "version": "0.8.1",
            "endpoints": ["/api/product/brief", "/api/product/proposals", "/api/product/advice"],
            "front_door": "natural-language brief",
        },
        "family_scope": contract_v04.FAMILY_SCOPE,
        "printability_limits": dict(contract_v03.PRINTABILITY_LIMITS),
        "process_rule": contract_v04.PROCESS_RULE,
        "validation": _validation_summary(),
        "engine": {"version": "0.4",
                   "canonical": "python engine 0.4 + JS engine 0.4",
                   "design_target_pf": 0.01,
                   "printed_mass": True,
                   "mass_analytic_upper_bound": True,
                   "family_feasibility": True,
                   "lot_specific_recipe": True,
                   "sustained_bound": True,
                   "measurement_cv_default": contract_v03.DEFAULT_MEASUREMENT_CV,
                   "printed_process_gate": True,
                   "elongation_brittle_screen": True,
                   "union_mass_polish": True,
                   "assumption_bounds": True},
        "service": {"name": "anyrb-ai", "version": "0.4",
                    "port": int(os.environ.get("ANYRB_PORT", "8787"))},
        "cache": meta_client.cache_stats(),
        "session": {"id": meta_client.SESSION_ID, "calls": len(calls),
                    "uptime_s": round(time.time() - meta_client.STARTED_AT, 1)},
        "endpoints": schemas.AI_ENDPOINTS,
        "uptime_s": round(time.time() - meta_client.STARTED_AT, 1),
    }
    return schemas.HealthResponse.model_validate(payload).model_dump()


@app.post("/api/brief/parse")
def brief_parse(body: schemas.BriefIn, request: Request) -> dict:
    _rate_limit(request)
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(422, "text is required")
    payload = prompts.brief_user_payload(text, body.source, body.defaults)
    out = meta_client.spark_json(
        "brief", prompts.BRIEF_SYSTEM, payload,
        fallback=lambda: prompts.fallback_brief(text, body.defaults),
        mock=_want_mock(request))
    brief = _coerce_brief(out, text, body.defaults)
    brief["_meta"] = out.get("_meta")
    brief["interpretation"] = [
        f"load treated as {brief['load_N']} N",
        f"reliability target {100 * brief['target_pf']:.2f}%",
        f"material preset: {brief['material_key']}",
        f"measurement CV {100 * brief['measurement_cv']:.1f}%"
        + (" (stated)" if brief.get("measurement_cv_stated") else " (default, editable)"),
    ]
    brief["brief"] = _brief_compat(brief)
    return _respond(schemas.BriefResponse, brief)


@app.post("/api/lot/parse")
def lot_parse(body: schemas.LotIn, request: Request) -> dict:
    _rate_limit(request)
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(422, "text is required")
    payload = prompts.lot_user_payload(text)
    out = meta_client.spark_json("lot", prompts.LOT_SYSTEM, payload,
                                 fallback=lambda: prompts.fallback_lot(text),
                                 mock=_want_mock(request))
    lot = _coerce_lot(out, text)
    lot["_meta"] = out.get("_meta")
    return _respond(schemas.LotResponse, lot)


@app.post("/api/design/plan")
def design_plan(body: schemas.PlanIn, request: Request) -> dict:
    _rate_limit(request)
    if not isinstance(body.brief, dict) or not isinstance(body.baseline, dict):
        raise HTTPException(422, "brief and baseline are required objects")
    payload = contract_v04.build_plan_payload(body.model_dump())
    process = payload.get("process") or {}
    if process.get("ok") is False:
        # Printed-process gate: IM/compression data cannot feed the printed-lattice AI path.
        plan = _coerce_plan({}, payload)
        plan["_meta"] = meta_client.local_meta("plan", "process_mismatch")
        plan["blocked"] = True
        plan["process"] = process
        plan["feasibility"] = payload.get("feasibility")
        plan["note"] = contract_v04.PROCESS_MISMATCH_NOTE
        return _respond(schemas.PlanResponse, plan)
    feasibility = payload.get("feasibility") or {}
    if feasibility.get("feasible") is False:
        # The engine gate already refuses this family: the AI must not draw candidates.
        plan = _coerce_plan({}, payload)
        plan["_meta"] = meta_client.local_meta("plan", "family_infeasible")
        plan["blocked"] = True
        plan["feasibility"] = feasibility
        plan["note"] = ("engine feasibility gate fails: the widest printable uniform lattice "
                        "cannot meet the target; no AI candidates were proposed (placeholders "
                        "are returned only for schema compatibility)")
        return _respond(schemas.PlanResponse, plan)
    out = meta_client.spark_json("plan", prompts.PLAN_SYSTEM, payload,
                                 fallback=lambda: prompts.fallback_plan(payload),
                                 mock=_want_mock(request))
    plan = _coerce_plan(out, payload)
    plan["_meta"] = out.get("_meta")
    plan["family_scope"] = payload.get("family_scope", "")
    plan["printability_limits"] = payload.get("printability_limits") or {}
    plan["feasibility"] = feasibility or None
    plan["process"] = payload.get("process")
    plan["blocked"] = False
    plan["note"] = ("" if not out.get("_meta", {}).get("fallback")
                    else "deterministic priors (AI unavailable); engineering evaluation by the verified engine")
    return _respond(schemas.PlanResponse, plan)


@app.post("/api/design/review")
def design_review(body: schemas.ReviewIn, request: Request) -> dict:
    _rate_limit(request)
    payload = contract_v04.build_review_payload(body.model_dump())
    out = meta_client.spark_json("review", prompts.REVIEW_SYSTEM, payload,
                                 fallback=lambda: prompts.fallback_review(payload),
                                 mock=_want_mock(request))
    review = _coerce_review(out, payload)
    review["_meta"] = out.get("_meta")
    review.setdefault("feasibility", payload.get("feasibility"))
    for _block in ("brittle", "assumptions", "process", "qc"):
        if payload.get(_block):
            review.setdefault(_block, payload[_block])
    review = _grounded_or_fallback("review", review, payload,
                                   prompts.fallback_review(payload))
    return _respond(schemas.ReviewResponse, review)


@app.post("/api/proof/memo")
def proof_memo(body: schemas.ProofIn, request: Request) -> dict:
    _rate_limit(request)
    payload = contract_v04.build_proof_payload(body.model_dump())
    out = meta_client.spark_json("proof", prompts.PROOF_SYSTEM, payload,
                                 fallback=lambda: prompts.fallback_proof(payload),
                                 mock=_want_mock(request))
    proof = _coerce_proof(out, payload)
    proof["_meta"] = out.get("_meta")
    proof.setdefault("feasibility", payload.get("feasibility"))
    proof.setdefault("lot_recipe", payload.get("lot_recipe"))
    proof.setdefault("measurement", payload.get("measurement"))
    for _block in ("brittle", "assumptions", "process", "qc"):
        if payload.get(_block):
            proof.setdefault(_block, payload[_block])
    proof = _grounded_or_fallback("proof", proof, payload,
                                  prompts.fallback_proof(payload))
    return _respond(schemas.ProofResponse, proof)


@app.post("/api/product/proposals")
def product_proposals(body: product_ai.ProductProposalRequest, request: Request) -> dict:
    """Meta-proposed MOVE parameters only; the browser scores them deterministically."""
    _rate_limit(request)
    with _user_meta_scope(request):
        return product_ai.propose(body, mock=_want_mock(request))


@app.post("/api/product/advice")
def product_advice(body: product_ai.ProductAdviceRequest, request: Request) -> dict:
    """Meta batch-help advice with practical actions; only supplied numbers are allowed."""
    _rate_limit(request)
    with _user_meta_scope(request):
        return product_ai.advise(body, mock=_want_mock(request))


@app.post("/api/product/brief")
def product_brief(body: product_ai.ProductBriefRequest, request: Request) -> dict:
    """Meta natural-language shop request -> editable brief (extract-only, never invented)."""
    _rate_limit(request)
    with _user_meta_scope(request):
        return product_ai.parse_product_brief(body, mock=_want_mock(request))


@app.post("/api/voice/transcribe")
async def voice_transcribe(request: Request, audio: UploadFile = File(...)) -> dict:
    _rate_limit(request)
    data = await audio.read()
    if not data or len(data) > MAX_UPLOAD:
        raise HTTPException(413, "audio missing or too large")
    with _user_meta_scope(request):
        out = meta_client.transcribe(data, filename=audio.filename or "brief.wav",
                                     mock=_want_mock(request))
    return _respond(schemas.VoiceResponse, {
        "transcript": out.get("transcript", ""),
        "duration_s": out.get("duration_s"),
        "_meta": out.get("_meta")})


@app.post("/api/image/render")
def image_render(body: schemas.ImageIn, request: Request) -> dict:
    _rate_limit(request)
    design = body.design or {}
    base = ("Industrial product render of a 3D-printed recycled-polymer cantilever bracket "
            "with a visible graded X-braced lattice interior, matte off-white material, "
            "studio lighting, warm paper background, three-quarter view, photorealistic, "
            "no text, no people, no logos")
    mass = design.get("mass_g")
    if isinstance(mass, (int, float)) and 0 < mass < 10000:
        base += f", approximately {round(float(mass))} grams"
    prompt = (body.prompt or base)[:schemas.MAX_IMAGE_PROMPT]
    out = meta_client.generate_image(prompt, mock=_want_mock(request))
    return _respond(schemas.ImageResponse, {
        "image_data_url": out.get("image_data_url"),
        "illustrative": True,
        "label": "AI illustration — not the CAD model",
        "prompt": prompt,
        "mime": out.get("mime"),
        "width": out.get("width"),
        "height": out.get("height"),
        "_meta": out.get("_meta")})


@app.post("/api/photo/segment")
async def photo_segment(request: Request, concept: str = Form("part"),
                        image: UploadFile = File(...)) -> dict:
    _rate_limit(request)
    data = await image.read()
    if not data or len(data) > MAX_UPLOAD:
        raise HTTPException(413, "image missing or too large")
    out = meta_client.sam_segment(data, _clean_text(concept, 60) or "part",
                                  mock=_want_mock(request))
    return _respond(schemas.SegmentResponse, out)


@app.get("/api/provenance")
def provenance(n: int = 50, session_only: bool = False) -> dict:
    """Append-only AI call log. `session_only=1` filters to the current server session."""
    n = max(1, min(500, int(n)))
    calls = meta_client.provenance_tail(n, session_only=session_only)
    session = meta_client.session_calls()
    aggregate: dict[str, dict] = {}
    for c in session:
        key = c.get("model") or "unknown"
        a = aggregate.setdefault(key, {"calls": 0, "cached": 0, "fallback": 0})
        a["calls"] += 1
        a["cached"] += int(bool(c.get("cached")))
        a["fallback"] += int(bool(c.get("fallback")))
    payload = {"calls": calls, "count": len(calls),
               "live_mode": meta_client.configured()["live"],
               "session_id": meta_client.SESSION_ID,
               "aggregate": aggregate,
               "cache": meta_client.cache_stats()}
    return schemas.ProvenanceResponse.model_validate(payload).model_dump()


@app.get("/api/validation")
def validation() -> dict:
    summary = _validation_summary()
    if summary is None:
        raise HTTPException(404, "validation results not generated yet")
    return summary


# ---------------------------------------------------------------------------
# static app (same-origin demo)
# ---------------------------------------------------------------------------
SAFE_STATIC_DIRS = {
    "app": PROJECT / "app",
    "data": PROJECT / "data",
    "design": PROJECT / "design",
    "validation": PROJECT / "validation",
    "reports": PROJECT / "reports",
    "research": PROJECT / "research",
    "audit": PROJECT / "audit",
    "demo": PROJECT / "demo",
}


def _safe_file(base: Path, rel: str) -> Path | None:
    if not rel or ".." in rel.split("/") or rel.startswith("/"):
        return None
    try:
        target = (base / rel).resolve()
        base_r = base.resolve()
        if base_r != target and base_r not in target.parents:
            return None
        if target.is_file() and target.name != ".env" and not target.name.startswith("."):
            return target
    except Exception:
        return None
    return None


def _static_response(base: Path, rel: str):
    path = _safe_file(base, rel)
    if path is None:
        raise HTTPException(404, "not found")
    return FileResponse(path)


@app.get("/")
def index():
    if INDEX.exists():
        return FileResponse(INDEX)
    fallback = PROJECT / "app" / "index.html"
    if fallback.exists():
        return FileResponse(fallback)
    return JSONResponse({"detail": "app not built yet — run python app/build.py"}, status_code=503)


@app.get("/index.html")
def index_html():
    return index()


@app.get("/assets/{path:path}")
def asset(path: str):
    return _static_response(ASSETS, path)


@app.get("/favicon.ico")
def favicon():
    return JSONResponse({}, status_code=204)


def _make_static_route(name: str):
    base = SAFE_STATIC_DIRS[name]

    @app.get(f"/{name}/{{path:path}}")
    def _route(path: str):  # noqa: ANN202
        return _static_response(base, path)

    return _route


for _name in SAFE_STATIC_DIRS:
    _make_static_route(_name)


# ---------------------------------------------------------------------------
# error handlers — always JSON, never leak the key
# ---------------------------------------------------------------------------
_ERROR_NAMES = {400: "bad_request", 401: "unauthorized", 404: "not_found",
                413: "payload_too_large", 422: "validation_error",
                429: "rate_limited", 500: "internal_error", 503: "unavailable"}


@app.exception_handler(HTTPException)
async def http_exception_handler(_, exc: HTTPException):  # noqa: ANN001
    name = _ERROR_NAMES.get(exc.status_code, "error")
    return JSONResponse({"ok": False, "error": name,
                         "message": meta_client.redact(exc.detail, 400),
                         "detail": exc.detail if not isinstance(exc.detail, str) else None},
                        status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_, exc: RequestValidationError):  # noqa: ANN001
    return JSONResponse({"ok": False, "error": "validation_error",
                         "message": "request body failed validation",
                         "detail": jsonable_encoder(exc.errors())[:5]},
                        status_code=422)


@app.exception_handler(Exception)
async def unhandled(_, exc: Exception):  # noqa: ANN001
    return JSONResponse({"ok": False, "error": type(exc).__name__,
                         "message": meta_client.redact(str(exc), 300)}, status_code=500)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="AnyRB Meta AI backend")
    parser.add_argument("--host", default=os.environ.get("ANYRB_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("ANYRB_PORT", "8787")))
    parser.add_argument("--mock", action="store_true",
                        help="force deterministic mock mode (no network, no key needed)")
    parser.add_argument("--reload", action="store_true")
    args = parser.parse_args(argv)
    if args.mock:
        meta_client.MOCK = True
    import uvicorn
    state = "mock" if meta_client.MOCK else ("live" if meta_client.KEY else "offline")
    print(f"AnyRB AI backend → http://{args.host}:{args.port}  "
          f"(mode={state}; key {'present' if meta_client.KEY else 'absent'})")
    uvicorn.run("server.app:app", host=args.host, port=args.port,
                reload=args.reload, log_level="info")


if __name__ == "__main__":
    main()

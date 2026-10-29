"""Pydantic schemas for the AnyRB Meta AI backend.

Every request body and every AI response is described here. The API layer
(`server/app.py`) validates each handler's output through these models before
serialising it (`_respond` in app.py), so a malformed model output can never
reach the browser: the coercers in app.py sanitise first, and these models are
the hard type/shape gate. Deterministic fallbacks are validated by the same
models as live output.

Notes
-----
* `_meta` is the provenance envelope kept by `meta_client` (model, latency,
  cached, fallback, tokens). It is exposed under its wire name via an alias.
* AI responses additionally carry the convenience aliases `_model` and
  `_cached`, which mirror `_meta.model` / `_meta.cached`.
* `extra="allow"` is deliberate on response models: handlers may add helpful
  fields (e.g. `interpretation`) without breaking the client contract.
"""
from __future__ import annotations

import math
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .contract_v03 import (DEFAULT_MEASUREMENT_CV, FAMILY_SCOPE, MASS_BASIS,
                           PRINTABILITY_LIMITS)

MAX_TEXT = 6000
MAX_UPLOAD = 12 * 1024 * 1024
MAX_IMAGE_PROMPT = 1500
W_MIN, W_MAX = 1.0, 4.0
LOG_W_MIN, LOG_W_MAX = math.log(W_MIN), math.log(W_MAX)
MATERIAL_KEYS = ("rpetg", "rpet", "rhdpe", "rpp")


# ---------------------------------------------------------------------------
# provenance envelope
# ---------------------------------------------------------------------------
class CallMeta(BaseModel):
    model_config = ConfigDict(extra="allow")
    kind: Optional[str] = None
    model: str = "fallback"
    latency_s: float = 0.0
    cached: bool = False
    fallback: bool = True
    usage: dict[str, Any] = Field(default_factory=dict)
    tokens: dict[str, Any] = Field(default_factory=dict)
    mock: bool = False
    session_id: Optional[str] = None
    error: Optional[str] = None
    grounding: Optional[dict[str, Any]] = None
    generated_at: Optional[str] = None


class AIResponse(BaseModel):
    """Base for every AI endpoint response."""

    model_config = ConfigDict(extra="allow", populate_by_name=True)
    meta: CallMeta = Field(alias="_meta")
    model_name: Optional[str] = Field(default=None, alias="_model")
    cached_flag: Optional[bool] = Field(default=None, alias="_cached")


# ---------------------------------------------------------------------------
# requests
# ---------------------------------------------------------------------------
class BriefIn(BaseModel):
    text: str = Field(default="", max_length=MAX_TEXT)
    source: str = Field(default="text", max_length=20)
    defaults: Optional[dict[str, Any]] = None


class LotIn(BaseModel):
    text: str = Field(default="", max_length=MAX_TEXT)


class PlanIn(BaseModel):
    brief: dict[str, Any] = Field(default_factory=dict)
    baseline: dict[str, Any] = Field(default_factory=dict)
    material: dict[str, Any] = Field(default_factory=dict)
    # v0.3 (all optional; v0.2 payloads still validate)
    first_pass: dict[str, Any] = Field(default_factory=dict)
    feasibility: dict[str, Any] = Field(default_factory=dict)
    printability_limits: dict[str, Any] = Field(default_factory=dict)
    family_scope: str = Field(default="", max_length=400)
    engine: dict[str, Any] = Field(default_factory=dict)
    # v0.4: printed-process gate block (optional; material.process is also accepted)
    process: dict[str, Any] = Field(default_factory=dict)


class ReviewIn(BaseModel):
    # v0.2 shape (still accepted)
    brief: dict[str, Any] = Field(default_factory=dict)
    selected: dict[str, Any] = Field(default_factory=dict)
    comparison: Any = Field(default_factory=dict)
    material: dict[str, Any] = Field(default_factory=dict)
    sensitivity: dict[str, Any] = Field(default_factory=dict)
    # v0.3 shape (all optional); engine-computed facts promoted by the caller
    facts: dict[str, Any] = Field(default_factory=dict)
    design: dict[str, Any] = Field(default_factory=dict)
    engine: dict[str, Any] = Field(default_factory=dict)
    lot_recipe: dict[str, Any] = Field(default_factory=dict)
    recipe: dict[str, Any] = Field(default_factory=dict)
    measurement: dict[str, Any] = Field(default_factory=dict)
    lot: dict[str, Any] = Field(default_factory=dict)
    sustained_bound: dict[str, Any] = Field(default_factory=dict)
    feasibility: dict[str, Any] = Field(default_factory=dict)
    family_scope: str = Field(default="", max_length=400)
    target_pf: Optional[float] = None
    # v0.4 blocks (all optional; absent => v0.2/v0.3 behaviour)
    brittle: dict[str, Any] = Field(default_factory=dict)
    assumptions: dict[str, Any] = Field(default_factory=dict)
    assumption_bounds: dict[str, Any] = Field(default_factory=dict)
    process: dict[str, Any] = Field(default_factory=dict)
    qc: dict[str, Any] = Field(default_factory=dict)


class ProofIn(BaseModel):
    # v0.2 shape (still accepted)
    brief: dict[str, Any] = Field(default_factory=dict)
    design: dict[str, Any] = Field(default_factory=dict)
    batch_passport: dict[str, Any] = Field(default_factory=dict)
    comparison: Any = Field(default_factory=dict)
    validation: dict[str, Any] = Field(default_factory=dict)
    # v0.3 shape (all optional)
    facts: dict[str, Any] = Field(default_factory=dict)
    selected: dict[str, Any] = Field(default_factory=dict)
    engine: dict[str, Any] = Field(default_factory=dict)
    proof: dict[str, Any] = Field(default_factory=dict)
    lot_recipe: dict[str, Any] = Field(default_factory=dict)
    recipe: dict[str, Any] = Field(default_factory=dict)
    measurement: dict[str, Any] = Field(default_factory=dict)
    lot: dict[str, Any] = Field(default_factory=dict)
    sustained_bound: dict[str, Any] = Field(default_factory=dict)
    feasibility: dict[str, Any] = Field(default_factory=dict)
    family_scope: str = Field(default="", max_length=400)
    target_pf: Optional[float] = None
    # v0.4 blocks (all optional; absent => v0.2/v0.3 behaviour)
    brittle: dict[str, Any] = Field(default_factory=dict)
    assumptions: dict[str, Any] = Field(default_factory=dict)
    assumption_bounds: dict[str, Any] = Field(default_factory=dict)
    process: dict[str, Any] = Field(default_factory=dict)
    qc: dict[str, Any] = Field(default_factory=dict)


class ImageIn(BaseModel):
    prompt: str = Field(default="", max_length=MAX_IMAGE_PROMPT)
    design: dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# responses
# ---------------------------------------------------------------------------
class BriefTargets(BaseModel):
    model_config = ConfigDict(extra="allow")
    part_label: str = "cantilever bracket"
    load_N: float = Field(gt=0, le=20000)
    deflection_limit_mm: float = Field(gt=0, le=100)
    target_pf: float = Field(gt=0, lt=1)
    mass_cap_g: Optional[float] = Field(default=None, gt=0, le=100000)
    material_key: Literal["rpetg", "rpet", "rhdpe", "rpp"] = "rpetg"
    process: Optional[str] = None
    # v0.3: measurement uncertainty of the lot data (not the material CV)
    measurement_cv: float = Field(default=DEFAULT_MEASUREMENT_CV, ge=0.0, le=0.5)
    measurement_cv_stated: bool = False
    constraints: list[str] = Field(default_factory=list)
    missing: list[str] = Field(default_factory=list)
    confidence: Literal["high", "medium", "low", "unknown", "low/medium"] = "medium"
    rationale: str = ""


class BriefCompat(BaseModel):
    """Camel-case brief mirror for the browser client (same values, no new information)."""

    model_config = ConfigDict(extra="allow")
    partType: str = "cantilever bracket"
    loadN: float
    deflLimitMm: float
    targetPf: float
    process: Optional[str] = None
    preset: Optional[str] = None
    material_key: Optional[str] = None
    constraints: list[str] = Field(default_factory=list)
    notes: str = ""
    massCapG: Optional[float] = None
    measurementCv: float = DEFAULT_MEASUREMENT_CV


class BriefResponse(AIResponse):
    part_label: str
    load_N: float
    deflection_limit_mm: float
    target_pf: float
    mass_cap_g: Optional[float] = None
    material_key: str
    process: Optional[str] = None
    measurement_cv: float = DEFAULT_MEASUREMENT_CV
    measurement_cv_stated: bool = False
    constraints: list[str] = Field(default_factory=list)
    missing: list[str] = Field(default_factory=list)
    confidence: str
    rationale: str
    interpretation: list[str] = Field(default_factory=list)
    brief: Optional[BriefCompat] = None


class LotFields(BaseModel):
    model_config = ConfigDict(extra="allow")
    material_key: str = "unknown"
    E_mean: Optional[float] = None
    E_cv: Optional[float] = None
    sy_mean: Optional[float] = None
    sy_cv: Optional[float] = None
    rho: Optional[float] = None
    corr: Optional[float] = None


class LotResponse(AIResponse):
    material_key: str
    E_mean: Optional[float] = None
    E_cv: Optional[float] = None
    sy_mean: Optional[float] = None
    sy_cv: Optional[float] = None
    rho: Optional[float] = None
    corr: Optional[float] = None
    source_label: str = ""
    fields_found: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    confidence: str = "low"
    # v0.3: lot identity + measurement provenance/uncertainty
    lot_id: Optional[str] = None
    supplier: Optional[str] = None
    measurement_source: Optional[str] = None
    measurement_cv: float = DEFAULT_MEASUREMENT_CV
    measurement_cv_stated: bool = False


class Candidate(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str = Field(min_length=1, max_length=4)
    name: str = Field(min_length=1, max_length=40)
    strategy: str = Field(default="", max_length=80)
    # authoritative, app-facing: strut widths in mm (1..4)
    width_priors_mm: list[float] = Field(min_length=8, max_length=8)
    # engine-ready: natural-log widths, derived server-side from width_priors_mm
    width_priors: list[float] = Field(default_factory=list, min_length=0, max_length=8)
    why: str = Field(default="", max_length=200)
    risk: str = Field(default="", max_length=160)

    @field_validator("width_priors_mm")
    @classmethod
    def _bounds_mm(cls, v: list[float]) -> list[float]:
        return [round(min(W_MAX, max(W_MIN, float(w))), 3) for w in v]

    @model_validator(mode="after")
    def _derive_log_widths(self) -> "Candidate":
        logs = [round(math.log(w), 4) for w in self.width_priors_mm]
        if len(self.width_priors) == 8:
            # keep model/server-supplied log widths only if sane, else derive
            if all(LOG_W_MIN - 1e-6 <= w <= LOG_W_MAX + 1e-6 for w in self.width_priors):
                return self
        self.width_priors = logs
        return self


class PlanResponse(AIResponse):
    candidates: list[Candidate]
    family_scope: str = FAMILY_SCOPE
    printability_limits: dict[str, Any] = Field(default_factory=lambda: dict(PRINTABILITY_LIMITS))
    feasibility: Optional[dict[str, Any]] = None
    process: Optional[dict[str, Any]] = None
    blocked: bool = False
    note: str = ""

    @field_validator("candidates")
    @classmethod
    def _exactly_three(cls, v: list[Candidate]) -> list[Candidate]:
        if len(v) != 3:
            raise ValueError(f"design plan must return exactly 3 candidates, got {len(v)}")
        return v


class ReviewResponse(AIResponse):
    memo: str = Field(min_length=1, max_length=1200)
    key_risk: str = Field(default="", max_length=300)
    next_actions: list[str] = Field(min_length=1, max_length=3)
    caveats: list[str] = Field(default_factory=list, max_length=5)
    family_scope: str = FAMILY_SCOPE
    mass_basis: str = MASS_BASIS
    sustained_advisory: str = ""
    feasibility: Optional[dict[str, Any]] = None
    brittle: Optional[dict[str, Any]] = None
    assumptions: Optional[dict[str, Any]] = None
    process: Optional[dict[str, Any]] = None
    qc: Optional[dict[str, Any]] = None


class ProofResponse(AIResponse):
    memo: str = Field(min_length=1, max_length=1500)
    what_would_change_answer: list[str] = Field(default_factory=list, max_length=5)
    recommended_tests: list[str] = Field(default_factory=list, max_length=5)
    claim_level: str = Field(default="", max_length=240)
    family_scope: str = FAMILY_SCOPE
    mass_basis: str = MASS_BASIS
    sustained_advisory: str = ""
    feasibility: Optional[dict[str, Any]] = None
    lot_recipe: Optional[dict[str, Any]] = None
    measurement: Optional[dict[str, Any]] = None
    brittle: Optional[dict[str, Any]] = None
    assumptions: Optional[dict[str, Any]] = None
    process: Optional[dict[str, Any]] = None
    qc: Optional[dict[str, Any]] = None


class VoiceResponse(AIResponse):
    transcript: str = ""
    duration_s: Optional[float] = None


class ImageResponse(AIResponse):
    image_data_url: Optional[str] = None
    illustrative: bool = True
    label: str = "AI illustration — not the CAD model"
    prompt: str = ""
    mime: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None


class SegmentBox(BaseModel):
    model_config = ConfigDict(extra="allow")
    x1: int
    y1: int
    x2: int
    y2: int
    w: int
    h: int


class SegmentResponse(AIResponse):
    concept: str = "part"
    boxes: list[SegmentBox] = Field(default_factory=list)
    count: int = 0
    area_share: float = 0.0
    mocked: bool = False


class CacheStats(BaseModel):
    model_config = ConfigDict(extra="allow")
    entries: int = 0
    bytes: int = 0
    dir: str = ""


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="allow")
    ok: bool = True
    version: str = "v0.4"
    contract_version: str = "v0.4"
    family_scope: str = FAMILY_SCOPE
    printability_limits: dict[str, Any] = Field(default_factory=lambda: dict(PRINTABILITY_LIMITS))
    mode: Literal["live", "mock", "offline"] = "mock"
    ai: dict[str, Any] = Field(default_factory=dict)
    validation: Optional[dict[str, Any]] = None
    engine: dict[str, Any] = Field(default_factory=dict)
    service: dict[str, Any] = Field(default_factory=dict)
    cache: dict[str, Any] = Field(default_factory=dict)
    session: dict[str, Any] = Field(default_factory=dict)
    endpoints: list[str] = Field(default_factory=list)
    uptime_s: float = 0.0


class ProvenanceResponse(BaseModel):
    model_config = ConfigDict(extra="allow")
    calls: list[dict[str, Any]] = Field(default_factory=list)
    count: int = 0
    live_mode: bool = False
    session_id: str = ""
    aggregate: dict[str, Any] = Field(default_factory=dict)
    cache: dict[str, Any] = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    ok: bool = False
    error: str = "error"
    message: str = ""
    detail: Any = None


# endpoint list used by /api/health and docs
AI_ENDPOINTS = [
    "/api/brief/parse", "/api/lot/parse", "/api/design/plan", "/api/design/review",
    "/api/proof/memo", "/api/voice/transcribe", "/api/image/render", "/api/photo/segment",
    "/api/health", "/api/provenance",
]

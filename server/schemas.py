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

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

MAX_UPLOAD = 12 * 1024 * 1024
MAX_IMAGE_PROMPT = 1500

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


class ImageIn(BaseModel):
    prompt: str = Field(default="", max_length=MAX_IMAGE_PROMPT)
    design: dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# responses
# ---------------------------------------------------------------------------


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
    version: str = "1.0"
    mode: Literal["live", "mock", "offline"] = "mock"
    ai: dict[str, Any] = Field(default_factory=dict)
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
    "/api/product/brief", "/api/product/proposals", "/api/product/advice",
    "/api/image/render", "/api/photo/segment",
    "/api/health", "/api/provenance",
]

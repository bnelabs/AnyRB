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

from . import meta_client, schemas, product_ai

PROJECT = Path(__file__).resolve().parent.parent
INDEX = PROJECT / "index.html"
ASSETS = PROJECT / "demo" / "assets"

MAX_BODY_MB = float(os.environ.get("ANYRB_MAX_BODY_MB", "16"))
MAX_BODY_BYTES = int(MAX_BODY_MB * 1024 * 1024)
MAX_UPLOAD = schemas.MAX_UPLOAD
RATE_LIMIT = int(os.environ.get("ANYRB_RATE_LIMIT_RPM", "120"))

APP_VERSION = "1.0"

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
    # `X-User-Cache-Bust: 1` forces a live re-call instead of a saved (cached)
    # answer for this request only; the fresh result is still cached.
    cache_bust = (request.headers.get("x-user-cache-bust") or "").strip().lower() in (
        "1", "true", "yes", "on")
    return meta_client.request_scope(key=key, model=model, provider=provider,
                                     base_url=base_url, cache_bust=cache_bust)


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
def _clean_text(s, max_len: int = 400) -> str:
    s = re.sub(r"<[^>]+>", " ", str(s or ""))
    s = re.sub(r"\s+", " ", s).strip()
    return s[:max_len]


def _respond(model_cls, data: dict) -> dict:
    """Validate a handler response through its pydantic model, then serialise.

    If validation ever fails (it should not) we return the payload with an
    explicit fallback marker instead of a 500, so the demo never dies.
    `_model`/`_cached` mirror `_meta.model`/`_meta.cached`.
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
        "version": "1.0",
        "active_app": {
            "name": "AnyRB",
            "version": "1.0",
            "endpoints": ["/api/product/brief", "/api/product/proposals", "/api/product/advice"],
            "front_door": "natural-language brief",
        },
        "service": {"name": "anyrb-ai", "version": "1.0",
                    "port": int(os.environ.get("ANYRB_PORT", "8787"))},
        "cache": meta_client.cache_stats(),
        "session": {"id": meta_client.SESSION_ID, "calls": len(calls),
                    "uptime_s": round(time.time() - meta_client.STARTED_AT, 1)},
        "endpoints": schemas.AI_ENDPOINTS,
        "uptime_s": round(time.time() - meta_client.STARTED_AT, 1),
    }
    return schemas.HealthResponse.model_validate(payload).model_dump()


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

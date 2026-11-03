"""Backend tests — deterministic mock mode, no live API calls, no key usage.

Run:
    cd AnyRB
    AI_MOCK=1 .venv/bin/python -m pytest server/tests -q

The suite forces `META_API_KEY=""` and an isolated cache/provenance directory
*before* importing the app, so it can never spend the real key or pollute the
demo cache.
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
import time
from pathlib import Path

# --- isolation must happen before server modules are imported -----------------
PROJECT = Path(__file__).resolve().parents[2]
if str(PROJECT) not in sys.path:
    sys.path.insert(0, str(PROJECT))
_TMP = tempfile.mkdtemp(prefix="anyrb_server_test_")
os.environ["AI_MOCK"] = "1"
os.environ.pop("ANYRB_MOCK", None)
os.environ["META_API_KEY"] = ""            # present-but-empty => never read the real key
os.environ["ANYRB_CACHE_DIR"] = str(Path(_TMP) / "cache")
os.environ["ANYRB_PROVENANCE_FILE"] = str(Path(_TMP) / "provenance.jsonl")
os.environ["ANYRB_MAX_BODY_MB"] = "1"   # makes the 413 size-limit test cheap
os.environ["ANYRB_RATE_LIMIT_RPM"] = "100000"

from fastapi.testclient import TestClient  # noqa: E402

from server import app as app_module  # noqa: E402
from server import meta_client, schemas  # noqa: E402
from server.app import app  # noqa: E402

client = TestClient(app)
BRIEF_TEXT = "Shelf bracket for 15 kg, 1% failure risk, under 60 grams, recycled PETG"
def _json_text(resp) -> str:
    return json.dumps(resp.json(), ensure_ascii=False)


# ---------------------------------------------------------------------------
# health
# ---------------------------------------------------------------------------
def test_health_contract_and_schema():
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    schemas.HealthResponse.model_validate(body)  # hard schema gate
    assert body["ok"] is True
    assert body["mode"] in ("live", "mock", "offline")
    ai = body["ai"]
    for k in ("live", "mock", "key_present", "models", "base_url", "session_id"):
        assert k in ai, k
    assert set(ai["models"]) >= {"spark", "spark_standard", "image", "sam"}
    assert "asr" not in set(ai["models"])
    # richer health fields required by the demo UI
    assert isinstance(body["cache"]["entries"], int)
    assert body["session"]["id"]
    assert body["session"]["calls"] >= 0  # grows as the suite exercises endpoints
    assert isinstance(ai["model_latencies"], dict)
    assert body["version"] == "1.0"
    assert "/api/product/brief" in body["endpoints"]
    assert "/api/product/proposals" in body["endpoints"]
    assert "/api/product/advice" in body["endpoints"]
    for retired in ("/api/brief/parse", "/api/lot/parse", "/api/design/plan",
                    "/api/design/review", "/api/proof/memo", "/api/validation"):
        assert retired not in body["endpoints"]
        assert client.get(retired).status_code in (404, 405), retired
        assert client.post(retired, json={}).status_code in (404, 405, 422), retired
    assert body["uptime_s"] >= 0


def test_health_never_leaks_key():
    r = client.get("/api/health")
    text = _json_text(r)
    key = os.environ.get("META_API_KEY", "")
    assert key == "" or key not in text
    assert "Authorization" not in text
    assert "Bearer " not in text
    assert "LLM_" not in text  # real Meta keys start with LLM_


# ---------------------------------------------------------------------------
# retired v0.4 routes stay gone (brief/lot/plan/review/proof/validation)
# ---------------------------------------------------------------------------
# image / segment
# ---------------------------------------------------------------------------
def test_voice_endpoint_is_gone():
    r = client.post("/api/voice/transcribe", files={"audio": ("brief.wav", b"data", "audio/wav")})
    assert r.status_code in (404, 405)


def test_image_render_mock_is_illustrative_and_labelled():
    r = client.post("/api/image/render", json={"design": {"mass_g": 50.73}})
    assert r.status_code == 200
    body = r.json()
    schemas.ImageResponse.model_validate(body)
    assert body["illustrative"] is True
    assert "AI illustration" in body["label"]
    assert body["image_data_url"] is None  # mock mode
    assert body["_meta"]["fallback"] is True


def test_photo_segment_mock():
    r = client.post("/api/photo/segment",
                    files={"image": ("part.png", b"\x89PNG\r\n\x1a\n", "image/png")},
                    data={"concept": "bracket"})
    assert r.status_code == 200
    body = r.json()
    schemas.SegmentResponse.model_validate(body)
    assert body["concept"] == "bracket"
    assert body["mocked"] is True
    assert body["count"] == 0


# ---------------------------------------------------------------------------
# mock override
# ---------------------------------------------------------------------------
def test_per_request_mock_override_is_honest():
    body = {"text": "Make a crate side from this delivery."}
    r = client.post("/api/product/brief?mock=1", json=body)
    assert r.status_code == 200
    assert r.json()["available"] is False
    meta = r.json()["_meta"]
    assert meta["mock"] is True and meta["fallback"] is True
    assert meta["model"] == "fallback"
    # header form
    r2 = client.post("/api/product/brief", json=body,
                     headers={"X-AnyRB-Mock": "1"})
    assert r2.json()["_meta"]["mock"] is True
    # forced mock never reports cached/live
    assert r2.json()["_cached"] is False


# ---------------------------------------------------------------------------
# cache
# ---------------------------------------------------------------------------
def test_cache_hit_on_second_live_call(monkeypatch):
    """Simulate a live Spark call: first call hits the API, second is a disk cache hit."""
    sent = {"calls": 0}
    content = json.dumps({"part_label": "cache bracket", "load_N": 140.0,
                          "deflection_limit_mm": 2.0, "target_pf": 0.02,
                          "material_key": "rpetg",
                          "constraints": [], "missing": [], "confidence": "high",
                          "rationale": "live test"})

    class FakeResponse:
        status_code = 200

        def raise_for_status(self):
            return None

        def json(self):
            return {"choices": [{"message": {"content": content}, "finish_reason": "stop"}],
                    "usage": {"prompt_tokens": 120, "completion_tokens": 80, "total_tokens": 200}}

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def post(self, *a, **k):
            sent["calls"] += 1
            return FakeResponse()

    monkeypatch.setattr(meta_client.httpx, "Client", FakeClient)
    monkeypatch.setattr(meta_client, "KEY", "unit-test-only-key")
    monkeypatch.setattr(meta_client, "MOCK", False)
    unique = f"cache probe payload {time.time_ns()}"
    fallback = lambda: {"part_label": "fallback"}
    out1 = meta_client.spark_json("brief", "system", {"untrusted_brief_text": unique},
                                  fallback=fallback, mock=False)
    assert out1["_meta"]["fallback"] is False and out1["_meta"]["cached"] is False
    assert out1["_meta"]["usage"]["total_tokens"] == 200
    assert out1["part_label"] == "cache bracket"
    out2 = meta_client.spark_json("brief", "system", {"untrusted_brief_text": unique},
                                  fallback=fallback, mock=False)
    assert out2["_meta"]["cached"] is True and out2["_meta"]["fallback"] is False
    assert sent["calls"] == 1  # second call served from disk cache
    assert any(p.name.startswith("spark_brief_") for p in Path(meta_client.CACHE_DIR).glob("*.json"))


# ---------------------------------------------------------------------------
# provenance
# ---------------------------------------------------------------------------
def test_provenance_shape_and_session_filter():
    r = client.get("/api/provenance?n=20&session_only=true")
    assert r.status_code == 200
    body = r.json()
    schemas.ProvenanceResponse.model_validate(body)
    assert body["count"] >= 1
    assert body["session_id"] == meta_client.SESSION_ID
    assert isinstance(body["aggregate"], dict) and body["aggregate"]
    for call in body["calls"]:
        assert call["session_id"] == meta_client.SESSION_ID
        for k in ("ts", "kind", "model", "latency_s", "cached", "fallback"):
            assert k in call, k
        assert "key" not in call and "api_key" not in call
    # unfiltered tail also works and is JSON-serialisable
    assert client.get("/api/provenance?n=5").status_code == 200


# ---------------------------------------------------------------------------
# security: no key leakage anywhere
# ---------------------------------------------------------------------------
def test_no_key_leakage_anywhere(monkeypatch):
    sentinel = "LLM_SUPERSECRET_SENTINEL_1234567890"
    monkeypatch.setattr(meta_client, "KEY", sentinel)
    bodies = []
    bodies.append(_json_text(client.get("/api/health")))
    bodies.append(_json_text(client.post("/api/product/brief", json={"text": BRIEF_TEXT})))
    bodies.append(_json_text(client.post("/api/product/advice", json={"text": "x" * 7000})))
    bodies.append(_json_text(client.get("/api/provenance?session_only=true")))
    for text in bodies:
        assert sentinel not in text
    # provenance file on disk must never contain the key either
    prov = Path(os.environ["ANYRB_PROVENANCE_FILE"]).read_text()
    assert sentinel not in prov
    # defence-in-depth helper
    assert sentinel not in meta_client.redact("Authorization: Bearer " + sentinel, 500)
    assert "[redacted-key]" in meta_client.redact("x " + sentinel)


# ---------------------------------------------------------------------------
# limits / errors / static
# ---------------------------------------------------------------------------
def test_oversize_body_rejected_before_parse():
    assert os.environ["ANYRB_MAX_BODY_MB"] == "1"
    r = client.post("/api/product/brief", content=b"x" * (1200 * 1024),
                    headers={"content-type": "application/json"})
    assert r.status_code == 413
    assert r.json()["error"] == "payload_too_large"


def test_rate_limit_returns_429(monkeypatch):
    monkeypatch.setattr(app_module, "RATE_LIMIT", 2)
    app_module._requests.clear()
    try:
        assert client.post("/api/product/brief", json={"text": "ok"}).status_code == 200
        assert client.post("/api/product/brief", json={"text": "ok"}).status_code == 200
        r = client.post("/api/product/brief", json={"text": "ok"})
        assert r.status_code == 429
        assert r.json()["error"] == "rate_limited"
    finally:
        app_module._requests.clear()
        monkeypatch.setattr(app_module, "RATE_LIMIT", int(os.environ["ANYRB_RATE_LIMIT_RPM"]))


def test_error_shapes_are_json():
    r = client.post("/api/product/advice", json={"text": 42})
    assert r.status_code == 422
    body = r.json()
    assert body["ok"] is False and body["error"] == "validation_error"
    assert client.get("/api/does-not-exist").status_code == 404


def test_static_serving_is_safe(tmp_path):
    r = client.get("/")
    assert r.status_code == 200
    assert "AnyRB" in r.text[:5000]
    # frontend source + data are served
    assert client.get("/app/product.js").status_code == 200
    assert client.get("/app/main.js").status_code == 200
    assert client.get("/app/styles.css").status_code == 200
    assert client.get("/data/feedstock_library.json").status_code == 200
    # secrets/venv/source server must never be served
    for path in ("/server/.env", "/server/app.py", "/.venv/pyvenv.cfg", "/.env.example",
                 "/app/%2e%2e/%2e%2e/server/.env"):
        assert client.get(path).status_code == 404, path
    # path-traversal helper directly
    for rel in ("../server/.env", "../../etc/passwd", "/etc/passwd", "", ".env"):
        assert app_module._safe_file(PROJECT / "app", rel) is None


# ===========================================================================
# end of server tests

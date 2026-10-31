"""Tests for POST /api/product/brief — natural-language shop request -> editable brief.

Mock mode for unavailable paths (no live model calls, no key). The "live" path is
exercised with a simulated Spark transport (monkeypatched httpx client), never the
network.

Rules under test:
* extract-only: numbers the model returns must have been stated in the text,
  missing fields stay null/""/[] and nothing is invented;
* unknown target properties / unknown modes are dropped; targets limited to 5;
  dimensions/density/ranges clamped;
* model unavailable or empty parse -> `brief` empty, `available:false`, no local
  fallback parse;
* no result/property keys beyond extracted inputs; key never leaks; malformed
  bodies return the JSON 422 shape.
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[2]
if str(PROJECT) not in sys.path:
    sys.path.insert(0, str(PROJECT))

_TMP = tempfile.mkdtemp(prefix="anyrb_brief_test_")
os.environ.setdefault("AI_MOCK", "1")
os.environ.setdefault("META_API_KEY", "")
os.environ.setdefault("ANYRB_CACHE_DIR", str(Path(_TMP) / "cache"))
os.environ.setdefault("ANYRB_PROVENANCE_FILE", str(Path(_TMP) / "provenance.jsonl"))
os.environ.setdefault("ANYRB_RATE_LIMIT_RPM", "100000")

import pytest  # noqa: E402

ENDPOINT = "/api/product/brief"
BRIEF_KEYS = {"product", "mode", "span_mm", "width_mm", "thickness_mm",
              "targets", "plastic", "steady"}
PLASTIC_KEYS = {"type", "batch", "mix", "dirt", "dirt_level", "stiffness_min_mpa",
                "stiffness_max_mpa", "strength_min_mpa", "strength_max_mpa",
                "density_g_cm3"}
STEADY_KEYS = {"available", "type", "stiffness_mpa", "strength_mpa"}

TEXT = ("Make a compression pallet block, 800 mm span, 120 mm wide and 90 mm thick, from "
        "rPETG batch LOT-2026-014 with density 1.24 g/cm3 and virgin PETG at 2300 MPa; "
        "it needs strength 38-50 MPa and a weight under 35 kg.")
LIVE_PAYLOAD = {
    "product": "pallet block", "mode": "compression",
    "span_mm": 800, "width_mm": 120, "thickness_mm": 90,
    "targets": [
        {"property": "strength", "min": 38, "max": 50},
        {"property": "weight", "min": None, "max": 35},
    ],
    "plastic": {"type": "rPETG", "batch": "LOT-2026-014", "density_g_cm3": 1.24},
    "steady": {"available": True, "type": "virgin PETG", "stiffness_mpa": 2300},
}


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient
    from server.app import app
    return TestClient(app)


@pytest.fixture(scope="module")
def product_ai():
    from server import product_ai as module
    return module


def _empty(product_ai) -> dict:
    return product_ai.empty_product_brief()


def _fake_spark_transport(payload: dict, calls: dict):
    class FakeResponse:
        status_code = 200

        def raise_for_status(self):
            return None

        def json(self):
            return {"choices": [{"message": {"content": json.dumps(payload)},
                                 "finish_reason": "stop"}],
                    "usage": {"prompt_tokens": 250, "completion_tokens": 90,
                              "total_tokens": 340}}

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def post(self, *a, **k):
            calls["n"] += 1
            return FakeResponse()

    return FakeClient


def _use_fake_live(monkeypatch, payload: dict) -> dict:
    from server import meta_client
    calls = {"n": 0}
    monkeypatch.setattr(meta_client.httpx, "Client", _fake_spark_transport(payload, calls))
    monkeypatch.setattr(meta_client, "MOCK", False)
    monkeypatch.setattr(meta_client, "KEY", "unit-test-key")
    return calls


# ---------------------------------------------------------------------------
# model unavailable -> empty brief, available:false, no fallback parse
# ---------------------------------------------------------------------------
def test_no_model_returns_unavailable_empty_brief(client, product_ai):
    r = client.post(ENDPOINT, json={"text": TEXT})
    assert r.status_code == 200
    data = r.json()
    assert data["available"] is False
    assert data["brief"] == _empty(product_ai)
    assert data["_meta"]["fallback"] is True
    assert data["_meta"]["error"]
    assert data["_meta"]["reason_code"] == "model_unavailable"
    # no invented text of any kind
    text = json.dumps(data["brief"]).lower()
    for leak in ("pallet", "rpetg", "800", "38", "1.24"):
        assert leak not in text, leak


def test_no_model_response_is_deterministic(client):
    first = client.post(ENDPOINT, json={"text": TEXT}).json()
    second = client.post(ENDPOINT, json={"text": TEXT}).json()
    assert first["brief"] == second["brief"]
    assert first["available"] is second["available"] is False


def test_explicit_mock_override_unavailable(client):
    data = client.post(f"{ENDPOINT}?mock=1", json={"text": TEXT}).json()
    assert data["available"] is False and data["_meta"]["mock"] is True


# ---------------------------------------------------------------------------
# request validation
# ---------------------------------------------------------------------------
def test_malformed_requests_return_json_422(client):
    for body in ({}, {"text": ""}, {"text": "   "}, {"text": 42},
                 {"text": "x" * 1300}, {"text": None, "other": 1}):
        r = client.post(ENDPOINT, json=body)
        assert r.status_code == 422, (body if not isinstance(body, dict) else list(body), r.status_code)
        payload = r.json()
        assert payload["ok"] is False
        assert payload["error"] == "validation_error"
        assert "detail" in payload


# ---------------------------------------------------------------------------
# simulated live parse
# ---------------------------------------------------------------------------
def test_live_parse_with_two_targets_and_batch(client, monkeypatch):
    _use_fake_live(monkeypatch, {"brief": LIVE_PAYLOAD})          # wrapped form accepted
    data = client.post(ENDPOINT, json={"text": TEXT}).json()
    assert data["available"] is True
    assert data["_meta"]["fallback"] is False
    brief = data["brief"]
    assert set(brief) == BRIEF_KEYS
    assert set(brief["plastic"]) == PLASTIC_KEYS
    assert set(brief["steady"]) == STEADY_KEYS
    assert brief["product"] == "pallet block"
    assert brief["mode"] == "compression"
    assert (brief["span_mm"], brief["width_mm"], brief["thickness_mm"]) == (800.0, 120.0, 90.0)
    assert [(t["property"], t["min"], t["max"]) for t in brief["targets"]] == [
        ("strength", 38.0, 50.0), ("weight", None, 35.0)]
    assert brief["plastic"]["type"] == "rPETG"
    assert brief["plastic"]["batch"] == "LOT-2026-014"
    assert brief["plastic"]["density_g_cm3"] == 1.24
    assert brief["steady"] == {"available": True, "type": "virgin PETG",
                               "stiffness_mpa": 2300.0, "strength_mpa": None}
    # no result/property keys beyond extracted inputs
    assert set(data) <= {"brief", "available", "_meta", "_model", "_cached"}
    assert "result" not in json.dumps(data["brief"]).lower()
    assert "certif" not in json.dumps(data["brief"]).lower()


def test_missing_fields_remain_empty(client, monkeypatch):
    _use_fake_live(monkeypatch, {"product": "slat"})
    data = client.post(ENDPOINT, json={"text": "make me a slat please"}).json()
    assert data["available"] is True
    assert data["brief"]["product"] == "slat"
    for key in ("mode", "span_mm", "width_mm", "thickness_mm"):
        assert data["brief"][key] is None
    assert data["brief"]["targets"] == []
    assert all(v is None for v in data["brief"]["plastic"].values())
    assert data["brief"]["steady"] == {"available": False, "type": None,
                                       "stiffness_mpa": None, "strength_mpa": None}


def test_invented_and_unknown_target_properties_are_dropped(client, monkeypatch):
    _use_fake_live(monkeypatch, {
        "product": "slat",
        "targets": [
            {"property": "strength", "min": 38, "max": 50},
            {"property": "impact", "min": 1, "max": 2},          # unknown -> dropped
            {"property": "cost", "min": 3, "max": 4},            # unknown -> dropped
            {"property": "strength", "min": 10, "max": 20},      # duplicate -> dropped
            {"property": "weight", "min": None, "max": 35},
            {"property": "stiffness", "min": 1800, "max": 2400},
            {"property": "weight", "min": 20, "max": 30},        # 6th/dup -> dropped
        ],
    })
    text = "slat with strength 38-50 MPa, weight under 35 kg, stiffness 1800-2400 MPa"
    data = client.post(ENDPOINT, json={"text": text}).json()
    targets = data["brief"]["targets"]
    assert [t["property"] for t in targets] == ["strength", "weight", "stiffness"]
    assert len(targets) <= 5


def test_invented_numbers_are_dropped_not_kept(client, monkeypatch):
    # text states only the span (900 mm); the model invents dims/density/strength
    _use_fake_live(monkeypatch, {
        "product": "slat",
        "span_mm": 900,
        "width_mm": 1234,                                  # invented -> dropped
        "thickness_mm": 77,                                # invented -> dropped
        "targets": [{"property": "strength", "min": 99, "max": 120}],  # invented
        "plastic": {"density_g_cm3": 1.24},                # invented
    })
    data = client.post(ENDPOINT, json={"text": "make a slat 900 mm long"}).json()
    brief = data["brief"]
    assert brief["span_mm"] == 900.0
    assert brief["width_mm"] is None and brief["thickness_mm"] is None
    assert brief["targets"] == []
    assert brief["plastic"]["density_g_cm3"] is None
    assert data["available"] is True                       # product "slat" extracted
    assert data["_meta"]["extraction"]["dropped_ungrounded_fields"]
    for field in ("width_mm", "thickness_mm", "targets[0].min",
                  "targets[0].max", "plastic.density_g_cm3"):
        assert field in data["_meta"]["extraction"]["dropped_ungrounded_fields"]


def test_out_of_range_values_are_clamped(client, monkeypatch):
    _use_fake_live(monkeypatch, {
        "product": "crate",
        "span_mm": 9000, "width_mm": 900, "thickness_mm": 0.5,
        "plastic": {"density_g_cm3": 9.9},
    })
    text = "crate with span 9000 mm, width 900 mm, thickness 0.5 mm and density 9.9 g/cm3"
    brief = client.post(ENDPOINT, json={"text": text}).json()["brief"]
    assert brief["span_mm"] == 5000.0
    assert brief["width_mm"] == 500.0
    assert brief["thickness_mm"] == 2.0
    assert brief["plastic"]["density_g_cm3"] == 3.0


def test_unit_conversion_accepted_but_numbers_must_be_stated(client, monkeypatch):
    _use_fake_live(monkeypatch, {"product": "slat", "span_mm": 900})
    # "0.9 m" explicitly stated -> 900 mm is an allowed unit conversion
    data = client.post(ENDPOINT, json={"text": "make a slat 0.9 m long"}).json()
    assert data["brief"]["span_mm"] == 900.0
    # 900 mm was NOT stated in this text -> dropped
    _use_fake_live(monkeypatch, {"product": "slat", "span_mm": 900})
    data2 = client.post(ENDPOINT, json={"text": "make a slat"}).json()
    assert data2["brief"]["span_mm"] is None


def test_mode_mapping_and_unknown_modes_dropped(client, monkeypatch):
    _use_fake_live(monkeypatch, {"product": "panel", "mode": "simply supported"})
    data = client.post(ENDPOINT, json={"text": "make a simply supported panel"}).json()
    assert data["brief"]["mode"] == "simple"
    _use_fake_live(monkeypatch, {"product": "panel", "mode": "truss"})
    data2 = client.post(ENDPOINT, json={"text": "make a panel"}).json()
    assert data2["brief"]["mode"] is None


def test_empty_parse_returns_unavailable(client, monkeypatch):
    _use_fake_live(monkeypatch, {"brief": {}})
    data = client.post(ENDPOINT, json={"text": "hmm"}).json()
    assert data["available"] is False
    assert data["_meta"]["reason_code"] == "nothing_extracted"
    assert data["_meta"]["fallback"] is True
    assert data["brief"]["product"] is None and data["brief"]["targets"] == []


def test_cache_hit_on_repeat(client, monkeypatch):
    calls = _use_fake_live(monkeypatch, {"brief": LIVE_PAYLOAD})
    body = {"text": TEXT + " (cache probe " + os.urandom(4).hex() + ")"}
    # note: extra text tokens don't invalidate grounded numbers, and make the key unique
    first = client.post(ENDPOINT, json=body).json()
    assert first["available"] is True
    second = client.post(ENDPOINT, json=body).json()
    assert second["_cached"] is True
    assert second["brief"] == first["brief"]
    assert calls["n"] == 1


# ---------------------------------------------------------------------------
# security
# ---------------------------------------------------------------------------
def test_key_never_in_response(client, monkeypatch):
    from server import meta_client
    sentinel = "LLM_BRIEF_TEST_SENTINEL_1234567890"
    monkeypatch.setattr(meta_client, "KEY", sentinel)
    r = client.post(ENDPOINT, json={"text": TEXT})
    assert r.status_code == 200
    assert sentinel not in r.text
    assert "Authorization" not in r.text


# ---------------------------------------------------------------------------
# prompt contract
# ---------------------------------------------------------------------------
def test_prompt_is_extract_only(product_ai):
    system = product_ai.PRODUCT_BRIEF_SYSTEM
    lowered = system.lower()
    assert "extract-only rules" in lowered
    assert "only values that are explicitly stated" in lowered
    assert "never infer" in lowered
    assert "missing information" in lowered and "null" in lowered
    assert "strength, stiffness and weight" in lowered
    assert "maximum 5" in lowered or "maximum five" in lowered
    assert "never output strength/stiffness/weight results" in lowered
    assert "<<<user_brief_text>>>" in lowered
    assert "json only" in lowered
    payload = product_ai.build_product_brief_payload("make a slat 900 mm long")
    assert payload["extract_only"] is True
    assert payload["allowed_target_properties"] == ["strength", "stiffness", "weight"]
    assert payload["allowed_modes"] == ["cantilever", "simple", "compression"]
    assert payload["max_targets"] == 5
    assert payload["untrusted_brief_text"].startswith("<<<USER_BRIEF_TEXT>>>")

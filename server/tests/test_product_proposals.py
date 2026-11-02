"""Tests for POST /api/product/proposals — Meta MOVE-parameter proposals.

Mock mode only for the default paths (no live model calls, no key). The
"live" path is exercised with a simulated Spark transport (monkeypatched
httpx client), never the network.

Critical rule under test: when the model is unavailable or returns no valid
parameter proposals, the endpoint returns an EMPTY proposals list with
`_meta.fallback=true` and an error. It must never invent, pad or fill move
suggestions from a local fixed list — the browser scores the user's current
build locally instead.

Isolation note: this module deliberately avoids importing `server.app` /
`server.meta_client` at import time. When the whole suite runs, `test_server.py`
sets its own temp cache/provenance env and imports the app first; importing
server modules here would lock those paths earlier and could break that module's
isolation. Imports happen inside fixtures/functions instead. Running this file
alone still works because the env is prepared below before the first import.
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

# Safe defaults; setdefault so a sibling test module's setup is never overwritten.
_TMP = tempfile.mkdtemp(prefix="anyrb_product_test_")
os.environ.setdefault("AI_MOCK", "1")
os.environ.setdefault("META_API_KEY", "")
os.environ.setdefault("ANYRB_CACHE_DIR", str(Path(_TMP) / "cache"))
os.environ.setdefault("ANYRB_PROVENANCE_FILE", str(Path(_TMP) / "provenance.jsonl"))
os.environ.setdefault("ANYRB_RATE_LIMIT_RPM", "100000")

import pytest  # noqa: E402

ENDPOINT = "/api/product/proposals"
REQUIRED_MOVES = ("thickness", "section", "span", "other_product")
LIMITS = {"thickness_mm": (2.0, 200.0), "width_mm": (5.0, 500.0),
          "span_mm": (50.0, 5000.0), "fraction": (0.15, 0.75)}
ALLOWED_MOVE_KEYS = {
    "thickness": {"move", "thickness_mm"},
    "section": {"move", "width_mm", "thickness_mm"},
    "span": {"move", "span_mm", "mode"},
    "other_product": {"move"},
    "blend": {"move", "fraction"},
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


def _body(steady: bool = False, **overrides) -> dict:
    body = {
        "product": {"name": "shelf bracket", "mode": "cantilever", "span_mm": 700,
                    "load_kg": 0, "width_mm": 40, "thickness_mm": 12},
        "target": {"property": "stiffness", "min": 1500, "max": 2600},
        "plastic": {"type": "rPETG", "batch": "LOT-2026-014", "mix": "single-stream",
                    "dirt": "low", "stiffness_min_mpa": 1800, "stiffness_max_mpa": 2400,
                    "strength_min_mpa": 38, "strength_max_mpa": 50, "density_g_cm3": 1.24},
        "other_product": {"name": "planter panel", "mode": "simple", "span_mm": 400,
                          "load_kg": 0, "width_mm": 80, "thickness_mm": 6},
        "steady_available": steady,
    }
    body.update(overrides)
    return body


def _moves(response_json: dict) -> list[str]:
    return [p.get("move") for p in response_json.get("proposals", [])]


def _assert_parameter_only(response_json: dict) -> None:
    """The response may contain parameters only — never property results."""
    assert set(response_json) <= {"proposals", "_meta", "_model", "_cached"}
    for proposal in response_json["proposals"]:
        move = proposal["move"]
        assert move in ALLOWED_MOVE_KEYS
        assert set(proposal) <= ALLOWED_MOVE_KEYS[move], (move, proposal)
        for key, value in proposal.items():
            if key == "move":
                continue
            if key == "mode":
                assert value in ("cantilever", "simple", "compression")
                continue
            assert isinstance(value, (int, float)) and not isinstance(value, bool)
            lo, hi = LIMITS[key]
            assert lo <= value <= hi, (key, value)
    proposals_text = json.dumps(response_json.get("proposals", [])).lower()
    for forbidden in ('"strength', '"stiffness', '"weight', "result", "property",
                      "certif", "expected", "pass_fail", "passfail"):
        assert forbidden not in proposals_text, forbidden


# ---------------------------------------------------------------------------
# no local fixed proposal generator
# ---------------------------------------------------------------------------
def test_no_local_fixed_proposal_generator(product_ai):
    assert not hasattr(product_ai, "fallback_proposals")
    assert not hasattr(product_ai, "_fallback_by_move")
    source = Path(product_ai.__file__).read_text()
    for name in ("fallback_proposals", "_fallback_by_move", "proposals_fallback"):
        assert name not in source


# ---------------------------------------------------------------------------
# model unavailable -> empty proposals + honest meta (the retracted behaviour)
# ---------------------------------------------------------------------------
def test_unavailable_model_returns_no_invented_proposals(client):
    r = client.post(ENDPOINT, json=_body(steady=True))
    assert r.status_code == 200
    data = r.json()
    assert data["proposals"] == []                      # nothing invented
    assert data["_meta"]["fallback"] is True
    assert data["_meta"]["error"]                        # explains why
    assert data["_model"] == "fallback"
    assert data["_cached"] is False
    text = json.dumps(data).lower()
    for invented in ("thickness", "section", "span", "other_product", "blend"):
        assert invented not in text
    _assert_parameter_only(data)


def test_unavailable_response_is_deterministic(client):
    first = client.post(ENDPOINT, json=_body()).json()
    second = client.post(ENDPOINT, json=_body()).json()
    assert first["proposals"] == second["proposals"] == []
    assert first["_meta"]["fallback"] is True
    assert first["_meta"]["error"] == second["_meta"]["error"]


def test_explicit_mock_override_returns_empty_proposals(client):
    data = client.post(f"{ENDPOINT}?mock=1", json=_body()).json()
    assert data["proposals"] == []
    assert data["_meta"]["fallback"] is True and data["_meta"]["mock"] is True


def test_minimal_body_is_accepted_but_proposes_nothing_offline(client):
    r = client.post(ENDPOINT, json={"product": {"name": "post", "mode": "compression",
                                                "span_mm": 300, "width_mm": 50,
                                                "thickness_mm": 20}})
    assert r.status_code == 200
    data = r.json()
    assert data["proposals"] == []
    assert data["_meta"]["fallback"] is True


def test_load_kg_is_optional_and_may_be_zero(client, product_ai):
    # The frontend drops the separate working-load field and sends 0 (or omits it).
    for value in (0, 0.0, None):
        body = _body()
        body["product"]["load_kg"] = value
        if value is None:
            body["product"].pop("load_kg")
        r = client.post(ENDPOINT, json=body)
        assert r.status_code == 200, (value, r.text[:200])
    state = product_ai.sanitize_request(product_ai.ProductProposalRequest(
        product={"name": "x", "mode": "cantilever", "span_mm": 600,
                 "width_mm": 40, "thickness_mm": 10, "load_kg": 0}))
    assert state["product"]["load_kg"] == 0.0
    assert state["other_product"]["load_kg"] == 0.0


# ---------------------------------------------------------------------------
# sanitising real model output (clamps/drops, never pads)
# ---------------------------------------------------------------------------
def test_sanitizer_clamps_and_drops_without_inventing(product_ai):
    state = product_ai.sanitize_request(product_ai.ProductProposalRequest(
        **_body(steady=False)))
    raw = [
        {"move": "thickness", "thickness_mm": 999, "strength_mpa": 9999},
        {"move": "section", "width_mm": 1, "thickness_mm": 0.5, "weight_kg": 3},
        {"move": "span", "span_mm": 10, "mode": "truss", "result": "pass"},
        {"move": "blend", "fraction": 0.99},                 # not steady -> dropped
        {"move": "nonsense", "thickness_mm": 10},            # unknown move -> dropped
        "not-a-dict",
        {"move": "other_product", "strength_mpa": 40, "note": "invented"},
    ]
    out = product_ai.sanitize_proposals(raw, state)
    assert [p["move"] for p in out] == list(REQUIRED_MOVES)
    thickness = next(p for p in out if p["move"] == "thickness")
    section = next(p for p in out if p["move"] == "section")
    span = next(p for p in out if p["move"] == "span")
    other = next(p for p in out if p["move"] == "other_product")
    assert thickness == {"move": "thickness", "thickness_mm": 200.0}
    assert section["width_mm"] == 5.0 and section["thickness_mm"] == 2.0
    assert span["span_mm"] == 50.0 and "mode" not in span  # invalid mode dropped
    assert other == {"move": "other_product"}             # invented keys stripped
    for proposal in out:
        assert set(proposal) <= ALLOWED_MOVE_KEYS[proposal["move"]]


def test_sanitizer_never_pads_missing_move_types(product_ai):
    state = product_ai.sanitize_request(product_ai.ProductProposalRequest(**_body()))
    out = product_ai.sanitize_proposals([{"move": "thickness", "thickness_mm": 13}], state)
    assert out == [{"move": "thickness", "thickness_mm": 13.0}]
    assert product_ai.sanitize_proposals([], state) == []
    assert product_ai.sanitize_proposals(None, state) == []
    assert product_ai.sanitize_proposals([{"move": "thickness", "thickness_mm": "abc"}],
                                         state) == []


def test_sanitizer_keeps_blend_clamped_when_steady(product_ai):
    state = product_ai.sanitize_request(product_ai.ProductProposalRequest(
        **_body(steady=True)))
    out = product_ai.sanitize_proposals([{"move": "blend", "fraction": 99}], state)
    assert out == [{"move": "blend", "fraction": 0.75}]   # clamped, nothing else added


def test_sanitizer_handles_garbage_model_output(product_ai):
    state = product_ai.sanitize_request(product_ai.ProductProposalRequest(**_body()))
    for raw in (None, "nope", 42, {}, [None, 1, "x"],
                [{"move": "thickness", "thickness_mm": "abc"},
                 {"move": "span", "span_mm": float("nan")}]):
        assert product_ai.sanitize_proposals(raw, state) == []


# ---------------------------------------------------------------------------
# request clamping / malformed bodies
# ---------------------------------------------------------------------------
def test_absurd_request_values_are_clamped_not_crashing(client, product_ai):
    body = _body()
    body["product"].update({"span_mm": -5, "thickness_mm": 9999, "width_mm": -1,
                            "mode": "banana", "load_kg": 0})
    body["target"] = {"property": "banana", "min": 500, "max": 10}
    body["plastic"].update({"stiffness_min_mpa": 9999, "stiffness_max_mpa": -3,
                            "density_g_cm3": 99})
    r = client.post(ENDPOINT, json=body)
    assert r.status_code == 200
    assert r.json()["proposals"] == []                    # no invented suggestions
    state = product_ai.sanitize_request(product_ai.ProductProposalRequest(**body))
    assert state["product"]["mode"] == "cantilever"
    assert state["product"]["span_mm"] == LIMITS["span_mm"][0]
    assert state["product"]["thickness_mm"] == LIMITS["thickness_mm"][1]
    assert state["target"]["property"] == "strength"
    assert state["target"]["min"] <= state["target"]["max"]
    assert 0.5 <= state["plastic"]["density_g_cm3"] <= 3.0


def test_malformed_bodies_rejected_with_json_error(client):
    for body in ({"product": "nope"}, {}, {"product": {"span_mm": "abc"}},
                 {"product": {"name": "x"}, "steady_available": "not-a-bool",
                  "target": "bad"}):
        r = client.post(ENDPOINT, json=body)
        assert r.status_code == 422, (body, r.status_code)
        payload = r.json()
        assert payload["ok"] is False
        assert payload["error"] == "validation_error"
        assert "detail" in payload


# ---------------------------------------------------------------------------
# security
# ---------------------------------------------------------------------------
def test_no_key_leak_in_response(client, monkeypatch):
    from server import meta_client
    sentinel = "LLM_PRODUCT_TEST_SENTINEL_1234567890"
    monkeypatch.setattr(meta_client, "KEY", sentinel)
    r = client.post(ENDPOINT, json=_body())
    assert r.status_code == 200
    assert sentinel not in r.text
    assert "Authorization" not in r.text


# ---------------------------------------------------------------------------
# live-model path: simulated Spark transport, no network, no key spend
# ---------------------------------------------------------------------------
def _fake_spark_transport(proposals: list, calls: dict):
    class FakeResponse:
        status_code = 200

        def raise_for_status(self):
            return None

        def json(self):
            return {"choices": [{"message": {"content": json.dumps({"proposals": proposals})},
                                 "finish_reason": "stop"}],
                    "usage": {"prompt_tokens": 200, "completion_tokens": 80,
                              "total_tokens": 280}}

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


def _use_fake_live(monkeypatch, proposals: list) -> dict:
    from server import meta_client
    calls = {"n": 0}
    monkeypatch.setattr(meta_client.httpx, "Client", _fake_spark_transport(proposals, calls))
    monkeypatch.setattr(meta_client, "MOCK", False)
    monkeypatch.setattr(meta_client, "KEY", "unit-test-key")
    return calls


def _unique_body(prefix: str, steady: bool = False) -> dict:
    body = _body(steady=steady)
    body["product"]["name"] = f"{prefix}-{os.urandom(4).hex()}"   # unique cache key
    return body


def test_live_model_proposals_are_sanitised_not_padded(client, monkeypatch):
    calls = _use_fake_live(monkeypatch, [
        {"move": "thickness", "thickness_mm": 999, "strength_mpa": 46},   # clamped + stripped
        {"move": "section", "width_mm": 46, "thickness_mm": 13.2},
        {"move": "span", "span_mm": 10, "mode": "banana"},                # clamped, mode dropped
        {"move": "other_product", "stiffness_mpa": 2100},                 # invented stripped
    ])
    body = _unique_body("live-sanitise")
    r1 = client.post(ENDPOINT, json=body)
    assert r1.status_code == 200
    data = r1.json()
    assert data["_meta"]["fallback"] is False
    assert data["_meta"]["model"] != "fallback"
    assert set(_moves(data)) == set(REQUIRED_MOVES)                  # model supplied all four
    thickness = next(p for p in data["proposals"] if p["move"] == "thickness")
    assert thickness["thickness_mm"] == 200.0                        # clamped
    assert "strength_mpa" not in json.dumps(data)
    assert "stiffness_mpa" not in json.dumps(data)
    _assert_parameter_only(data)
    r2 = client.post(ENDPOINT, json=body)
    assert r2.status_code == 200
    assert r2.json()["_cached"] is True
    assert r2.json()["proposals"] == data["proposals"]
    assert calls["n"] == 1


def test_live_model_partial_output_is_not_padded(client, monkeypatch):
    _use_fake_live(monkeypatch, [
        {"move": "thickness", "thickness_mm": 14.4},
        {"move": "span", "span_mm": 630, "mode": "cantilever"},
    ])
    data = client.post(ENDPOINT, json=_unique_body("live-partial")).json()
    assert data["_meta"]["fallback"] is False
    assert _moves(data) == ["thickness", "span"]          # no section/other_product invented


def test_live_model_invalid_output_returns_empty_with_fallback(client, monkeypatch):
    _use_fake_live(monkeypatch, [
        {"move": "thickness", "thickness_mm": "abc"},
        {"move": "result", "strength_mpa": 46},
        {"move": "nonsense"},
    ])
    r = client.post(ENDPOINT, json=_unique_body("live-invalid"))
    assert r.status_code == 200
    data = r.json()
    assert data["proposals"] == []
    assert data["_meta"]["fallback"] is True
    assert data["_meta"]["error"]
    _assert_parameter_only(data)


def test_live_model_blend_dropped_when_not_steady(client, monkeypatch):
    _use_fake_live(monkeypatch, [{"move": "blend", "fraction": 0.3}])
    data = client.post(ENDPOINT, json=_unique_body("live-blend", steady=False)).json()
    assert data["proposals"] == []                        # blend invalid; nothing filled in
    assert data["_meta"]["fallback"] is True
    _use_fake_live(monkeypatch, [{"move": "blend", "fraction": 0.3}])
    data2 = client.post(ENDPOINT, json=_unique_body("live-blend-steady", steady=True)).json()
    assert data2["proposals"] == [{"move": "blend", "fraction": 0.3}]
    assert data2["_meta"]["fallback"] is False


# ---------------------------------------------------------------------------
# prompt contract
# ---------------------------------------------------------------------------
def test_prompt_forbids_property_results_invented_numbers_and_padding(product_ai):
    system = product_ai.PRODUCT_SYSTEM
    lowered = system.lower()
    assert "parameters only" in lowered
    assert "never return strength, stiffness, weight" in lowered
    assert "do not invent measured numbers" in lowered
    assert "never invent or pad" in lowered
    assert "certification" in lowered
    assert "untrusted" in lowered
    assert '"move":"thickness"' in system and '"move":"blend"' in system
    payload = product_ai.build_model_payload(product_ai.sanitize_request(
        product_ai.ProductProposalRequest(**_body(steady=True))))
    assert payload["moves_required"] == list(REQUIRED_MOVES) + ["blend"]
    assert payload["property_ranges_are_context_only"] is True
    assert "strength" in payload["forbidden_output"]
    assert "<<<USER_SHOP_STATE>>>" in payload["untrusted_shop_text"]


# ---------------------------------------------------------------------------
# multi-target support (optional `targets` array; legacy `target` still works)
# ---------------------------------------------------------------------------
MULTI_TARGETS = [
    {"property": "strength", "min": 38, "max": 50},
    {"property": "stiffness", "min": 1800, "max": 2400},
    {"property": "weight", "min": 20, "max": 35},
]


def _proposal_request(**overrides):
    data = {"product": {"name": "slat", "mode": "simple", "span_mm": 900,
                        "width_mm": 60, "thickness_mm": 8},
            "target": {"property": "strength", "min": 38, "max": 50}}
    data.update(overrides)
    return data


def test_multi_target_proposal_prompt_sees_all_target_ranges(product_ai):
    req = product_ai.ProductProposalRequest(**_proposal_request(targets=MULTI_TARGETS))
    state = product_ai.sanitize_request(req)
    assert [t["property"] for t in state["targets"]] == ["strength", "stiffness", "weight"]
    assert state["targets"] == MULTI_TARGETS
    payload = product_ai.build_model_payload(state)
    assert payload["targets"] == MULTI_TARGETS                     # ALL ranges reach the model
    assert payload["target_properties"] == ["strength", "stiffness", "weight"]
    assert payload["all_targets_must_be_satisfied_simultaneously"] is True
    # legacy mirror keeps the first requirement
    assert payload["target"] == MULTI_TARGETS[0]
    system = product_ai.PRODUCT_SYSTEM.lower()
    assert "targets" in system
    assert "all of them simultaneously" in system


def test_legacy_single_target_still_works(product_ai):
    req = product_ai.ProductProposalRequest(**_proposal_request())
    state = product_ai.sanitize_request(req)
    assert state["targets"] == [{"property": "strength", "min": 38.0, "max": 50.0}]
    assert state["target"] == state["targets"][0]
    payload = product_ai.build_model_payload(state)
    assert len(payload["targets"]) == 1 and payload["targets"][0]["property"] == "strength"


def test_targets_override_legacy_target(product_ai):
    req = product_ai.ProductProposalRequest(**_proposal_request(
        targets=[{"property": "stiffness", "min": 2000, "max": 2500},
                 {"property": "weight", "min": 15, "max": 25}]))
    state = product_ai.sanitize_request(req)
    assert [t["property"] for t in state["targets"]] == ["stiffness", "weight"]
    assert state["target"]["property"] == "stiffness"            # legacy mirror = first target


def test_multi_target_proposal_endpoint_accepts_targets(client):
    body = _proposal_request(targets=MULTI_TARGETS, steady_available=True)
    r = client.post(ENDPOINT, json=body)
    assert r.status_code == 200
    # mock/offline: no invented proposals, but the multi-target request is valid
    assert r.json()["proposals"] == []
    assert r.json()["_meta"]["fallback"] is True


def test_malformed_targets_degrade_safely(client, product_ai):
    for raw_targets in ("nope", 42, [None, "x", {"property": "banana", "min": 1, "max": 2}],
                        [{"property": "stiffness", "min": "bad", "max": -5}], []):
        body = _proposal_request(targets=raw_targets)
        r = client.post(ENDPOINT, json=body)
        assert r.status_code == 200, (raw_targets, r.status_code)
        state = product_ai.sanitize_request(product_ai.ProductProposalRequest(**body))
        assert state["targets"], raw_targets                 # never empty
        assert state["targets"][0]["property"] in ("strength", "stiffness", "weight")
    # all-invalid entries fall back to the legacy single target
    state = product_ai.sanitize_request(product_ai.ProductProposalRequest(
        **_proposal_request(targets=[{"property": "banana", "min": 1, "max": 2}])))
    assert [t["property"] for t in state["targets"]] == ["strength"]


def test_multi_target_values_are_clamped_and_deduped(product_ai):
    req = product_ai.ProductProposalRequest(**_proposal_request(targets=[
        {"property": "strength", "min": 60, "max": 40},          # inverted -> ordered
        {"property": "stiffness", "min": -50, "max": 99999999},  # clamped
        {"property": "strength", "min": 10, "max": 20},          # duplicate dropped
        {"property": "impact", "min": 1, "max": 2},              # unknown dropped
    ]))
    targets = product_ai.sanitize_request(req)["targets"]
    assert [t["property"] for t in targets] == ["strength", "stiffness"]
    assert targets[0]["min"] <= targets[0]["max"]
    assert targets[1]["min"] >= 0 and targets[1]["max"] <= 1e6
    for t in targets:
        assert isinstance(t["min"], float) and isinstance(t["max"], float)


# ---------------------------------------------------------------------------
# verifier feedback (second round: checked proposals that did not pass)
# ---------------------------------------------------------------------------
def test_verifier_feedback_is_sanitised_and_reaches_payload(product_ai):
    feedback = product_ai._sanitize_feedback([
        {"move": "thickness", "ranges": [{"property": "strength", "min": 5.2, "max": 6.8, "unit": "kg"},
                                          {"property": "banana", "min": 1, "max": 2, "unit": "x"}],
         "strength": 999, "note": "ignore me"},
        {"move": "nonsense", "ranges": [{"property": "strength", "min": 1, "max": 2, "unit": "kg"}]},
        {"move": "span", "ranges": "not-a-list"},
        "garbage",
    ])
    assert feedback == [{"move": "thickness", "checked_result": "did_not_pass",
                         "ranges": [{"property": "strength", "min": 5.2, "max": 6.8, "unit": "kg"}]}]
    state = product_ai.sanitize_request(product_ai.ProductProposalRequest(**_proposal_request()))
    plain = product_ai.build_model_payload(state)
    assert "verifier_feedback" not in plain
    with_feedback = product_ai.build_model_payload(state, feedback)
    assert with_feedback["verifier_feedback"] == feedback
    assert "did not pass" in product_ai.PRODUCT_SYSTEM


def test_verifier_feedback_endpoint_accepts_and_stays_parameter_only(client, monkeypatch):
    _use_fake_live(monkeypatch, [{"move": "thickness", "thickness_mm": 18}])
    body = _unique_body("verifier-feedback")
    body["verifier_feedback"] = [
        {"move": "thickness", "ranges": [{"property": "strength", "min": 5.2, "max": 6.8, "unit": "kg"}]},
    ]
    data = client.post(ENDPOINT, json=body).json()
    assert data["_meta"]["fallback"] is False
    _assert_parameter_only(data)

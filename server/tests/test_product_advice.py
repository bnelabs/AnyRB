"""Tests for POST /api/product/advice — grounded batch-alchemy advice.

Mock mode for unavailable paths (no live model calls, no key). The "live" path is
exercised with a simulated Spark transport (monkeypatched httpx client), never the
network.

Rules under test:
* model unavailable / unusable output -> `available:false`, `answer:""`, `actions:[]`
  (no fixed advice fallback is invented);
* text may only contain numbers present in the request payload (rounding/percent
  conversions allowed); otherwise `available:false` with a grounding reason;
* certification claims are rejected;
* actions are 1-5 short strings, answer <= 1200 chars;
* key never appears in the response; malformed bodies return the JSON 422 shape.

Isolation note: imports of server modules happen lazily inside fixtures/functions so
`sibling test_server.py` keeps owning the app import (and its temp cache paths).
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

_TMP = tempfile.mkdtemp(prefix="anyrb_advice_test_")
os.environ.setdefault("AI_MOCK", "1")
os.environ.setdefault("META_API_KEY", "")
os.environ.setdefault("ANYRB_CACHE_DIR", str(Path(_TMP) / "cache"))
os.environ.setdefault("ANYRB_PROVENANCE_FILE", str(Path(_TMP) / "provenance.jsonl"))
os.environ.setdefault("ANYRB_RATE_LIMIT_RPM", "100000")

import pytest  # noqa: E402

ENDPOINT = "/api/product/advice"


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient
    from server.app import app
    return TestClient(app)


@pytest.fixture(scope="module")
def product_ai():
    from server import product_ai as module
    return module


def _body(question: str = "What can I do with this batch to make the shelf bracket?") -> dict:
    return {
        "question": question,
        "product": {"name": "shelf bracket", "mode": "cantilever", "span_mm": 700,
                    "width_mm": 40, "thickness_mm": 12},
        "target": {"property": "strength", "min": 38, "max": 50},
        "plastic": {"type": "rPETG", "batch": "LOT-2026-014", "mix": "single-stream",
                    "dirt": "medium", "dirt_level": "medium",
                    "stiffness_min_mpa": 1800, "stiffness_max_mpa": 2400,
                    "strength_min_mpa": 30, "strength_max_mpa": 44,
                    "density_g_cm3": 1.24},
        "steady": {"available": True, "type": "virgin PETG",
                   "stiffness_mpa": 2300, "strength_mpa": 48},
        "other_product": {"name": "planter panel", "mode": "simple", "span_mm": 400,
                          "width_mm": 80, "thickness_mm": 6},
        "plan": {
            "headline": "Current build is just short on strength",
            "support": "Current build 30-44 MPa vs target 38-50 MPa",
            "current": {"property_range": {"min": 30, "max": 44, "unit": "MPa"},
                        "pass": False},
            "winner": {"product": "shelf bracket", "size": "thicker section",
                       "property_range": {"min": 38, "max": 50, "unit": "MPa"},
                       "added_material": 18, "move": "section"},
            "gap": {"property": "strength", "unit": "MPa",
                    "needed_min": 38, "needed_max": 50,
                    "batch_min": 30, "batch_max": 44,
                    "short_low": 8, "over_high": 0,
                    "required_action": "blend or sort for a stronger stream"},
            "builds": [{"move": "section", "size": "+18% material",
                        "property_range": {"min": 38, "max": 50, "unit": "MPa"},
                        "added_material": 18}],
            "blend": {"available": True, "type": "virgin PETG", "fraction": 0.30,
                      "property_range": {"min": 38, "max": 50, "unit": "MPa"}},
        },
    }


def _unique_body(prefix: str) -> dict:
    return _body(f"{prefix} {os.urandom(4).hex()} — what should I do with this batch?")


GROUNDED_ANSWER = ("Your batch spans 30-44 MPa against a 38-50 MPa target, so blend about 30 % "
                   "of the virgin PETG stream and dry the flakes before extrusion; the thicker "
                   "section build adds about 18 % material.")
GROUNDED_ACTIONS = [
    "Blend 30 % virgin PETG with this batch",
    "Sort, wash and dry the flakes before extrusion",
    "Use the thicker section build (+18 % material)",
]


# ---------------------------------------------------------------------------
# model unavailable -> empty, available:false (no fixed advice fallback)
# ---------------------------------------------------------------------------
def test_no_model_returns_unavailable_empty_advice(client):
    r = client.post(ENDPOINT, json=_body())
    assert r.status_code == 200
    data = r.json()
    assert data["answer"] == ""
    assert data["actions"] == []
    assert data["available"] is False
    assert data["_meta"]["fallback"] is True
    assert data["_meta"]["error"] and data["_meta"]["reason"]
    assert data["_meta"]["reason_code"] == "model_unavailable"
    assert data["_model"] == "fallback"
    # nothing that looks like invented advice
    assert data["_meta"]["fallback"] is True
    assert "blend" not in json.dumps(data).lower()


def test_no_model_response_is_deterministic(client):
    first = client.post(ENDPOINT, json=_body()).json()
    second = client.post(ENDPOINT, json=_body()).json()
    assert first["answer"] == second["answer"] == ""
    assert first["actions"] == second["actions"] == []
    assert first["available"] is second["available"] is False


def test_explicit_mock_override_unavailable(client):
    data = client.post(f"{ENDPOINT}?mock=1", json=_body()).json()
    assert data["available"] is False and data["actions"] == []
    assert data["_meta"]["mock"] is True


# ---------------------------------------------------------------------------
# request validation
# ---------------------------------------------------------------------------
def test_malformed_request_returns_json_422(client):
    for body in ({}, {"question": ""}, {"question": "   "},
                 {"question": 42}, {"question": "x", "product": "nope"},
                 {"question": "x" * 900}, {"question": "ok", "plan": {"builds": "nope"}}):
        r = client.post(ENDPOINT, json=body)
        assert r.status_code == 422, (body, r.status_code)
        payload = r.json()
        assert payload["ok"] is False
        assert payload["error"] == "validation_error"
        assert "detail" in payload


def test_minimal_request_is_accepted(client):
    r = client.post(ENDPOINT, json={"question": "What can I do with this batch?"})
    assert r.status_code == 200
    assert r.json()["available"] is False       # no model in mock mode


# ---------------------------------------------------------------------------
# simulated live path
# ---------------------------------------------------------------------------
def _fake_spark_transport(payload: dict, calls: dict):
    class FakeResponse:
        status_code = 200

        def raise_for_status(self):
            return None

        def json(self):
            return {"choices": [{"message": {"content": json.dumps(payload)},
                                 "finish_reason": "stop"}],
                    "usage": {"prompt_tokens": 300, "completion_tokens": 120,
                              "total_tokens": 420}}

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


def test_grounded_live_advice_is_returned(client, monkeypatch):
    calls = _use_fake_live(monkeypatch, {"answer": GROUNDED_ANSWER,
                                         "actions": GROUNDED_ACTIONS})
    body = _unique_body("grounded")
    r = client.post(ENDPOINT, json=body)
    assert r.status_code == 200
    data = r.json()
    assert data["available"] is True
    assert data["answer"] == GROUNDED_ANSWER
    assert 1 <= len(data["actions"]) <= 5
    assert data["actions"] == GROUNDED_ACTIONS
    assert data["_meta"]["fallback"] is False
    assert data["_meta"]["grounding"]["ok"] is True
    # every number in the text exists in the supplied request (rounding/percent allowed)
    from server import prompts
    assert prompts.grounded(data["answer"] + " " + " ".join(data["actions"]), body)[0]
    # cached repeat -> same advice, one model call
    r2 = client.post(ENDPOINT, json=body)
    assert r2.json()["available"] is True
    assert r2.json()["answer"] == data["answer"]
    assert r2.json()["_cached"] is True
    assert calls["n"] == 1


def test_grounded_rounding_and_percent_forms_are_allowed(client, monkeypatch):
    body = _unique_body("rounding")
    body["plan"]["gap"]["needed_min"] = 1234.5
    _use_fake_live(monkeypatch, {"answer": "You need about 1234 to clear the gap; blend 30 %.",
                                 "actions": ["Blend 30 % of the steadier stream"]})
    # note: 0.30 exists as plan.blend.fraction -> "30 %" is the percent form
    data = client.post(ENDPOINT, json=body).json()
    assert data["available"] is True
    assert "1234" in data["answer"]


def test_ungrounded_numbers_reject_the_advice(client, monkeypatch):
    _use_fake_live(monkeypatch, {
        "answer": "Add a 4200 MPa grade and blend 55 % of it into this batch.",
        "actions": ["Source 4200 MPa resin", "Blend 55 % of it"],
    })
    r = client.post(ENDPOINT, json=_unique_body("ungrounded"))
    assert r.status_code == 200
    data = r.json()
    assert data["available"] is False
    assert data["answer"] == "" and data["actions"] == []
    assert data["_meta"]["reason_code"] == "grounding_failed"
    assert data["_meta"]["grounding"]["ok"] is False
    bad = data["_meta"]["grounding"]["ungrounded_numbers"]
    assert 4200.0 in bad
    assert "4200" not in data["answer"]


def test_certification_claim_rejects_the_advice(client, monkeypatch):
    _use_fake_live(monkeypatch, {
        "answer": "This batch is certified for structural use; use it as-is.",
        "actions": ["Use the batch without changes"],
    })
    data = client.post(ENDPOINT, json=_unique_body("certified")).json()
    assert data["available"] is False
    assert data["_meta"]["reason_code"] == "certification_claim"
    assert data["answer"] == ""


def test_missing_actions_means_unavailable(client, monkeypatch):
    _use_fake_live(monkeypatch, {"answer": "Blend 30 % of the virgin stream.", "actions": []})
    data = client.post(ENDPOINT, json=_unique_body("no-actions")).json()
    assert data["available"] is False
    assert data["_meta"]["reason_code"] == "invalid_output"


def test_actions_and_answer_are_sanitised(client, monkeypatch):
    long_action = "x" * 300
    actions = ["  Blend 30 % of the steady stream  ", "Sort and dry the flakes", long_action,
               "Move the batch to the planter panel", "Use the thicker section build",
               "Duplicate action", "Duplicate action"]
    _use_fake_live(monkeypatch, {
        "answer": GROUNDED_ANSWER + " " + ("padding " * 400),   # >1200 chars
        "actions": actions,
    })
    data = client.post(ENDPOINT, json=_unique_body("sanitise")).json()
    assert data["available"] is True
    assert len(data["answer"]) <= 1200
    assert 1 <= len(data["actions"]) <= 5
    assert all(isinstance(a, str) and 0 < len(a) <= 140 for a in data["actions"])
    assert "Blend 30 % of the steady stream" in data["actions"]


def test_live_invalid_json_shape_returns_unavailable(client, monkeypatch):
    _use_fake_live(monkeypatch, {"advice": "Blend 30 %.", "next": ["do it"]})
    data = client.post(ENDPOINT, json=_unique_body("wrong-shape")).json()
    assert data["available"] is False
    assert data["answer"] == "" and data["actions"] == []
    assert data["_meta"]["fallback"] is True


# ---------------------------------------------------------------------------
# security
# ---------------------------------------------------------------------------
def test_key_never_in_response(client, monkeypatch):
    from server import meta_client
    sentinel = "LLM_ADVICE_TEST_SENTINEL_1234567890"
    monkeypatch.setattr(meta_client, "KEY", sentinel)
    r = client.post(ENDPOINT, json=_body())
    assert r.status_code == 200
    assert sentinel not in r.text
    assert "Authorization" not in r.text


# ---------------------------------------------------------------------------
# prompt contract
# ---------------------------------------------------------------------------
def test_prompt_contract(product_ai):
    system = product_ai.ADVICE_SYSTEM
    lowered = system.lower()
    for lever in ("blend", "sort", "wash", "dry", "section", "span", "other product"):
        assert lever in lowered, lever
    assert "never simply reject" in lowered
    assert "only the numbers present in the request" in lowered
    assert "do not compute new numbers" in lowered
    assert "no certification" in lowered
    assert "untrusted" in lowered
    # no safety margin is added, so a physical check of one piece is honest advice
    assert "make one piece first and check it" in lowered
    assert "no safety margin added" in lowered
    # multi-target support: all supplied requirements and gaps must be addressed
    assert "targets" in lowered
    assert "every supplied requirement" in lowered
    assert "plan.gaps" in lowered
    assert '"answer"' in system and '"actions"' in system
    payload = product_ai.build_advice_payload(product_ai.sanitize_advice_request(
        product_ai.ProductAdviceRequest(**_body())))
    assert payload["rules"]["numbers_only_from_request"] is True
    assert payload["rules"]["never_simply_reject_batch"] is True
    assert "<<<USER_PLAN_TEXT>>>" in payload["untrusted_user_text"]


# ---------------------------------------------------------------------------
# numeric ranges use dashes — they are separators, not negative signs
# ---------------------------------------------------------------------------
def test_range_dashes_are_grounded_as_ranges(client, monkeypatch):
    """Regression: '14–18 MPa' / '211.8–238.3 MPa' must not be read as -18 / -238.3."""
    variants = [
        ("en-dash", "Your batch spans 14–18 MPa while the target needs 211.8–238.3 MPa; "
                    "blend the steadier stream to close the gap."),
        ("em-dash", "Your batch spans 14—18 MPa while the target needs 211.8—238.3 MPa; "
                    "blend the steadier stream to close the gap."),
        ("hyphen", "Your batch spans 14-18 MPa while the target needs 211.8-238.3 MPa; "
                   "blend the steadier stream to close the gap."),
    ]
    for label, answer in variants:
        _use_fake_live(monkeypatch, {"answer": answer,
                                     "actions": ["Blend the steadier stream with this batch"]})
        body = _unique_body(f"range-{label}")
        body["plan"]["gap"].update({"needed_min": 211.8, "needed_max": 238.3,
                                    "short_low": 14, "batch_max": 18})
        data = client.post(ENDPOINT, json=body).json()
        assert data["available"] is True, (label, data["_meta"].get("grounding"))
        assert data["_meta"]["grounding"] == {"ok": True, "ungrounded_numbers": [],
                                              "numbers_checked": data["_meta"]["grounding"]["numbers_checked"]}
        assert data["answer"] == answer


def test_range_button_in_payload_strings_is_grounded(client, monkeypatch):
    """Ranges inside supplied plan *strings* are normalised too (payload side)."""
    body = _unique_body("payload-range")
    body["plan"]["headline"] = "Batch runs 14-18 MPa"
    # remove the numeric 18/21 elsewhere so 18 only appears in the headline string
    body["plan"]["winner"]["added_material"] = 21
    body["plan"]["builds"][0]["added_material"] = 21
    body["plan"]["builds"][0]["size"] = "+21% material"
    body["plan"]["gap"].update({"needed_min": 211.8, "needed_max": 238.3,
                                "short_low": 14, "batch_max": 18})
    _use_fake_live(monkeypatch, {
        "answer": "Batch runs 14–18 MPa; the thicker build adds 21 % material.",
        "actions": ["Use the thicker section build (+21 % material)"],
    })
    data = client.post(ENDPOINT, json=body).json()
    assert data["available"] is True, data["_meta"].get("grounding")


def test_range_helper_rejects_invented_range_values(product_ai):
    payload = {"gap": {"short_low": 14, "batch_max": 18,
                       "needed_min": 211.8, "needed_max": 238.3}}
    ok, bad, checked = product_ai.advice_grounding("14–18 MPa and 211.8–238.3 MPa", payload)
    assert ok is True and bad == [] and checked == 4
    ok2, bad2, _ = product_ai.advice_grounding("14–19 MPa", payload)   # 19 not supplied
    assert ok2 is False and 19.0 in bad2
    ok3, bad3, _ = product_ai.advice_grounding("211.8–250.0 MPa", payload)
    assert ok3 is False and 250.0 in bad3


def test_range_normalizer_preserves_real_minus_signs(product_ai):
    norm = product_ai.normalize_range_separators
    assert norm("14–18 MPa") == "14 18 MPa"
    assert norm("14—18 MPa") == "14 18 MPa"
    assert norm("14-18 MPa") == "14 18 MPa"
    assert norm("14 - 18 MPa") == "14 18 MPa"
    assert norm("211.8–238.3 MPa") == "211.8 238.3 MPa"
    # leading minus signs are not range separators
    assert norm("about -18 MPa and -238.3 MPa") == "about -18 MPa and -238.3 MPa"
    # scientific notation is untouched (dash is not between two digits)
    assert norm("6.4e-06") == "6.4e-06"


def test_negative_values_still_grounded_and_rejected(client, monkeypatch):
    # a genuinely negative number that IS supplied is accepted
    body = _unique_body("negative-ok")
    body["plan"]["gap"].update({"over_high": -4, "short_low": -6})
    body["plan"]["winner"]["added_material"] = -6
    body["plan"]["builds"][0]["added_material"] = -6
    _use_fake_live(monkeypatch, {
        "answer": "The batch overshoots by -4 MPa and the lighter build removes -6 % material.",
        "actions": ["Use the lighter -6 % material build"],
    })
    data = client.post(ENDPOINT, json=body).json()
    assert data["available"] is True, data["_meta"].get("grounding")

    # a genuinely negative number that is NOT supplied is still rejected
    body2 = _unique_body("negative-bad")
    _use_fake_live(monkeypatch, {
        "answer": "You need -99 MPa to make this work.",
        "actions": ["Target -99 MPa"],
    })
    data2 = client.post(ENDPOINT, json=body2).json()
    assert data2["available"] is False
    assert data2["_meta"]["reason_code"] == "grounding_failed"
    assert -99.0 in data2["_meta"]["grounding"]["ungrounded_numbers"]


def test_ordinary_process_advice_is_accepted(client, monkeypatch):
    """Wash/sort/dry/blend/section/route/split process advice must be accepted."""
    _use_fake_live(monkeypatch, {
        "answer": ("Your batch spans 30-44 MPa against a 38-50 MPa target, so blend about "
                   "30 % of the virgin PETG stream, wash and dry the flakes, use the thicker "
                   "section build and split the delivery between both products."),
        "actions": [
            "Blend 30 % of the virgin PETG stream into this batch",
            "Sort, wash and dry the flakes before extrusion",
            "Use the thicker section build (+18 % material)",
            "Route the weaker half of the delivery to the planter panel",
            "Split the delivery between the two products",
        ],
    })
    data = client.post(ENDPOINT, json=_unique_body("process-advice")).json()
    assert data["available"] is True, data["_meta"].get("reason_code")
    assert data["_meta"]["grounding"]["ok"] is True
    assert len(data["actions"]) == 5


# ---------------------------------------------------------------------------
# advice may tell the user to make one piece and check it first
# ---------------------------------------------------------------------------
def test_make_one_and_check_advice_is_accepted(client, monkeypatch):
    """Ranges are checked as entered with no safety margin: a physical check
    of one piece is honest advice, not a banned instruction."""
    _use_fake_live(monkeypatch, {
        "answer": "Blend 30 % of the virgin PETG stream and use the thicker section build.",
        "actions": ["Make one piece first and check it against the requirement before a run"],
    })
    data = client.post(ENDPOINT, json=_unique_body("make-one-check")).json()
    assert data["available"] is True, data["_meta"].get("reason_code")
    assert data["_meta"]["grounding"]["ok"] is True


def test_process_and_check_actions_can_coexist(client, monkeypatch):
    _use_fake_live(monkeypatch, {
        "answer": "Blend 30 % of the virgin PETG stream, wash and dry the flakes, and use the thicker section build.",
        "actions": [
            "Blend 30 % of the virgin PETG stream into this batch",
            "Make one piece first and check it before a run",
        ],
    })
    data = client.post(ENDPOINT, json=_unique_body("process-and-check")).json()
    assert data["available"] is True, data["_meta"].get("reason_code")
    assert len(data["actions"]) == 2


# ---------------------------------------------------------------------------
# multi-target support (optional `targets` array + multi-gap plans)
# ---------------------------------------------------------------------------
MULTI_ADVICE_TARGETS = [
    {"property": "strength", "min": 38, "max": 50},
    {"property": "weight", "min": 20, "max": 35},
]


def _multi_gap_plan() -> dict:
    return {
        "headline": "Two requirements are short",
        "support": "Strength 30-44 MPa vs 38-50 MPa; weight 50-60 kg vs 20-35 kg",
        "current": {"property_range": {"min": 30, "max": 44, "unit": "MPa"}, "pass": False},
        "winner": {"product": "slat", "size": "lighter section",
                   "property_range": {"min": 38, "max": 50, "unit": "MPa"},
                   "added_material": -12, "move": "section"},
        "gap": {"property": "strength", "unit": "MPa", "needed_min": 38, "needed_max": 50,
                "batch_min": 30, "batch_max": 44, "short_low": 8, "over_high": 0,
                "required_action": "blend a steadier stream"},
        "gaps": [
            {"property": "strength", "unit": "MPa", "needed_min": 38, "needed_max": 50,
             "batch_min": 30, "batch_max": 44, "short_low": 8, "over_high": 0,
             "required_action": "blend a steadier stream"},
            {"property": "weight", "unit": "kg", "needed_min": 20, "needed_max": 35,
             "batch_min": 50, "batch_max": 60, "short_low": 0, "over_high": 25,
             "required_action": "split the delivery and use the lighter section build"},
        ],
        "builds": [{"move": "section", "size": "-12% material",
                    "property_range": {"min": 38, "max": 50, "unit": "MPa"},
                    "added_material": -12}],
        "blend": {"available": True, "type": "virgin PETG", "fraction": 0.30,
                  "property_range": {"min": 38, "max": 50, "unit": "MPa"}},
    }


def test_multi_target_advice_prompt_sees_all_requirements(product_ai):
    req = product_ai.ProductAdviceRequest(
        question="what should I do with this batch?",
        targets=MULTI_ADVICE_TARGETS,
        plan=_multi_gap_plan())
    state = product_ai.sanitize_advice_request(req)
    assert [t["property"] for t in state["targets"]] == ["strength", "weight"]
    payload = product_ai.build_advice_payload(state)
    assert payload["targets"] == MULTI_ADVICE_TARGETS
    assert payload["rules"]["target_count"] == 2
    assert payload["rules"]["all_requirements_must_be_addressed"] is True
    assert payload["rules"]["all_gaps_must_be_addressed"] is True
    assert len(payload["plan"]["gaps"]) == 2
    # both requirement ranges and both required actions are visible to the model
    text = payload["untrusted_user_text"]
    assert "strength 38.0-50.0" in text and "weight 20.0-35.0" in text
    assert "blend a steadier stream" in text
    assert "split the delivery and use the lighter section build" in text


def test_two_target_plan_with_multiple_gaps_can_be_answered(client, monkeypatch):
    answer = ("Strength: your batch spans 30-44 MPa against a 38-50 MPa target, so blend about "
              "30 % of the virgin PETG stream. Weight: the current 50-60 kg range is over the "
              "20-35 kg target, so split the delivery and use the lighter section build.")
    _use_fake_live(monkeypatch, {
        "answer": answer,
        "actions": ["Blend 30 % of the virgin PETG stream into this batch",
                    "Split the delivery and use the lighter section build",
                    "Sort, wash and dry the flakes before extrusion"],
    })
    body = _unique_body("multi-target")
    body["targets"] = MULTI_ADVICE_TARGETS
    body["plan"] = _multi_gap_plan()
    data = client.post(ENDPOINT, json=body).json()
    assert data["available"] is True, data["_meta"].get("reason_code")
    assert data["_meta"]["grounding"]["ok"] is True
    assert len(data["actions"]) == 3
    from server import product_ai
    payload = product_ai.build_advice_payload(product_ai.sanitize_advice_request(
        product_ai.ProductAdviceRequest(**body)))
    assert payload["rules"]["target_count"] == 2
    assert len(payload["plan"]["gaps"]) == 2


def test_multi_target_advice_grounding_uses_target_numbers(client, monkeypatch):
    # only numbers supplied through `targets` are cited -> grounded
    _use_fake_live(monkeypatch, {
        "answer": "The weight target is 20-35 kg; split the delivery and use the lighter build.",
        "actions": ["Split the delivery between the two products"],
    })
    body = _unique_body("target-numbers")
    body["targets"] = MULTI_ADVICE_TARGETS
    data = client.post(ENDPOINT, json=body).json()
    assert data["available"] is True, data["_meta"].get("grounding")
    # an invented number in a multi-target answer is still rejected
    _use_fake_live(monkeypatch, {
        "answer": "The weight target is 42-35 kg; split the delivery.",
        "actions": ["Split the delivery between the two products"],
    })
    data2 = client.post(ENDPOINT, json=_unique_body("target-numbers-bad")).json()
    assert data2["available"] is False
    assert data2["_meta"]["reason_code"] == "grounding_failed"
    assert 42.0 in data2["_meta"]["grounding"]["ungrounded_numbers"]


def test_legacy_single_target_advice_still_works(product_ai):
    req = product_ai.ProductAdviceRequest(question="what now?")
    state = product_ai.sanitize_advice_request(req)
    assert state["targets"] == [{"property": "strength", "min": 0.0, "max": 1000000.0}]
    assert state["target"] == state["targets"][0]


def test_malformed_advice_targets_degrade_safely(client, product_ai):
    for raw_targets in ("nope", 42, [None, "x", {"property": "banana", "min": 1, "max": 2}],
                        [{"property": "weight", "min": "bad", "max": -5}], []):
        body = {"question": "what can I do with this batch?", "targets": raw_targets}
        r = client.post(ENDPOINT, json=body)
        assert r.status_code == 200, (raw_targets, r.status_code)
        assert r.json()["available"] is False          # no model in mock mode — safely empty
        state = product_ai.sanitize_advice_request(
            product_ai.ProductAdviceRequest(**body))
        assert state["targets"], raw_targets
        assert state["targets"][0]["property"] in ("strength", "stiffness", "weight")


def test_multi_target_values_clamped_and_deduped_advice(product_ai):
    req = product_ai.ProductAdviceRequest(question="what now?", targets=[
        {"property": "strength", "min": 60, "max": 40},
        {"property": "stiffness", "min": -5, "max": 99999999},
        {"property": "strength", "min": 10, "max": 20},
        {"property": "banana", "min": 1, "max": 2},
    ])
    targets = product_ai.sanitize_advice_request(req)["targets"]
    assert [t["property"] for t in targets] == ["strength", "stiffness"]
    assert targets[0]["min"] <= targets[0]["max"]
    assert 0 <= targets[1]["min"] <= targets[1]["max"] <= 1e6

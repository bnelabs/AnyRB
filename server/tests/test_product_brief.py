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
    assert brief["span_mm"] == 6000.0
    assert brief["width_mm"] == 800.0
    assert brief["thickness_mm"] == 1.0
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


# ---------------------------------------------------------------------------
# comma thousands ("1,250 MPa") must ground like 1250 — regression for the demo
# ---------------------------------------------------------------------------
def test_comma_thousands_in_plastic_ranges_are_grounded(client, monkeypatch):
    """Live demo regression: stiffness maximum 1,250 was dropped as ungrounded."""
    text = ("Make a recycled-PETG slat: stiffness minimum 380 MPa and maximum 1,250 MPa; "
            "strength minimum 41.6 MPa and maximum 48.4 MPa.")
    _use_fake_live(monkeypatch, {
        "product": "slat",
        "plastic": {"type": "recycled PETG",
                    "stiffness_min_mpa": 380, "stiffness_max_mpa": 1250,
                    "strength_min_mpa": 41.6, "strength_max_mpa": 48.4},
    })
    data = client.post(ENDPOINT, json={"text": text}).json()
    assert data["available"] is True
    plastic = data["brief"]["plastic"]
    assert plastic["stiffness_min_mpa"] == 380.0
    assert plastic["stiffness_max_mpa"] == 1250.0            # previously dropped
    assert plastic["strength_min_mpa"] == 41.6
    assert plastic["strength_max_mpa"] == 48.4
    assert "extraction" not in data["_meta"]                 # nothing was dropped


def test_comma_thousands_ground_targets_and_dimensions(client, monkeypatch):
    text = ("Make a bench 1,500 mm span, 20 mm thick, strength 1,200-2,000 MPa and a "
            "weight under 1,000 kg.")
    _use_fake_live(monkeypatch, {
        "product": "bench", "span_mm": 1500, "thickness_mm": 20,
        "targets": [{"property": "strength", "min": 1200, "max": 2000},
                    {"property": "weight", "min": None, "max": 1000}],
    })
    data = client.post(ENDPOINT, json={"text": text}).json()
    brief = data["brief"]
    assert data["available"] is True
    assert brief["span_mm"] == 1500.0 and brief["thickness_mm"] == 20.0
    assert [(t["property"], t["min"], t["max"]) for t in brief["targets"]] == [
        ("strength", 1200.0, 2000.0), ("weight", None, 1000.0)]
    assert "extraction" not in data["_meta"]


def test_model_comma_formatted_strings_are_accepted(client, monkeypatch):
    # numbers may arrive as formatted strings from the model as well
    text = "Make a slat 1,500 mm span with stiffness up to 1,250 MPa"
    _use_fake_live(monkeypatch, {
        "product": "slat",
        "span_mm": "1,500",
        "plastic": {"stiffness_max_mpa": "1,250"},
    })
    data = client.post(ENDPOINT, json={"text": text}).json()
    assert data["brief"]["span_mm"] == 1500.0
    assert data["brief"]["plastic"]["stiffness_max_mpa"] == 1250.0


def test_invented_comma_value_is_still_dropped(client, monkeypatch):
    text = "Make a slat with stiffness maximum 1,250 MPa"
    _use_fake_live(monkeypatch, {
        "product": "slat",
        "plastic": {"stiffness_max_mpa": 1350},                 # invented
    })
    data = client.post(ENDPOINT, json={"text": text}).json()
    assert data["brief"]["plastic"]["stiffness_max_mpa"] is None
    assert "plastic.stiffness_max_mpa" in data["_meta"]["extraction"]["dropped_ungrounded_fields"]


def test_comma_normalizer_and_dash_ranges(product_ai):
    norm = product_ai.normalize_comma_thousands
    assert norm("1,250") == "1250"
    assert norm("12,500") == "12500"
    assert norm("1,234,567") == "1234567"
    assert norm("1,250.5") == "1250.5"
    assert norm("1,250 MPa") == "1250 MPa"
    assert norm("12,34") == "12,34"            # not a thousands group
    assert norm("1, 2 and 3") == "1, 2 and 3"  # ordinary prose commas untouched
    assert norm("LOT-2026-014") == "LOT-2026-014"
    nums = product_ai._stated_numbers(
        "stiffness 800-1,250 MPa; strength 38–50 MPa; span 1,500 mm")
    for value in (800.0, 1250.0, 38.0, 50.0, 1500.0):
        assert product_ai._number_was_stated(value, nums), value
    assert not product_ai._number_was_stated(1350.0, nums)


def test_brief_prompt_maps_load_to_strength_and_mass_to_weight():
    from server import product_ai
    system = product_ai.PRODUCT_BRIEF_SYSTEM
    assert "load capacity" in system
    assert "**strength** target" in system
    assert "**weight** target" in system
    assert "two targets" in system


def test_stated_600mm_width_is_not_silently_cut(client, monkeypatch):
    _use_fake_live(monkeypatch, {
        "product": "insulation panels", "mode": "simple",
        "span_mm": 1200, "width_mm": 600, "thickness_mm": 15,
    })
    text = ("I make insulation panels, 1200 mm long, 600 mm wide and 15 mm thick, "
            "supported at both ends.")
    brief = client.post(ENDPOINT, json={"text": text}).json()["brief"]
    assert (brief["span_mm"], brief["width_mm"], brief["thickness_mm"]) == (1200.0, 600.0, 15.0)


def test_zero_top_target_is_dropped_not_filled(client, monkeypatch):
    _use_fake_live(monkeypatch, {
        "product": "crate side", "mode": "simple",
        "targets": [{"property": "strength", "min": 0, "max": 0}],
    })
    data = client.post(ENDPOINT, json={"text": "crate side, carry 0 to 0 kg"}).json()
    assert data["brief"]["targets"] == []


# ---------------------------------------------------------------------------
# adversarial shop briefs (tricky wording)
#
# Division of labour under test, exactly as the code is built: the prompt
# (PRODUCT_BRIEF_SYSTEM) governs the *semantic* mapping (load capacity ->
# strength, part mass -> weight, N/mm -> stiffness, named plastic -> type),
# and the sanitiser governs *numeric grounding* (a number the brief never
# stated is dropped, field by field). Each test therefore feeds the
# prompt-compliant extraction plus an invented extra with unstated numbers,
# and asserts the stated mapping is kept while the extra is dropped. No
# stronger guarantee is claimed: the sanitiser does not re-map a target
# whose numbers *were* stated, and it never selects a published range —
# published ranges live in the browser; here plastic numbers must stay
# null unless the brief itself stated them.
# ---------------------------------------------------------------------------
def test_adversarial_load_capacity_kg_is_strength_never_weight(client, monkeypatch):
    # (a) "load capacity 95 to 115 kg" is a strength target. The prompt maps
    # it (see test_brief_prompt_maps_load_to_strength_and_mass_to_weight);
    # a weight target with numbers this brief never stated is dropped.
    _use_fake_live(monkeypatch, {
        "product": "crate side", "mode": "simple",
        "targets": [
            {"property": "strength", "min": 95, "max": 115},
            {"property": "weight", "min": 320, "max": 360},      # unstated -> dropped
        ],
    })
    text = ("Make a crate side, supported at both ends. Each side has a "
            "load capacity 95 to 115 kg.")
    data = client.post(ENDPOINT, json={"text": text}).json()
    assert data["available"] is True
    targets = data["brief"]["targets"]
    assert [(t["property"], t["min"], t["max"]) for t in targets] == [
        ("strength", 95.0, 115.0)]
    assert "weight" not in [t["property"] for t in targets]
    dropped = data["_meta"]["extraction"]["dropped_ungrounded_fields"]
    assert "targets[1].min" in dropped and "targets[1].max" in dropped


def test_adversarial_tonnes_a_week_invents_no_strength_target(client, monkeypatch):
    # (b) "1.8 tonnes of crates a week" is production throughput, not a part
    # load, so the prompt-compliant extraction has no target at all. An
    # invented strength window whose numbers were never stated is dropped,
    # leaving no strength target.
    _use_fake_live(monkeypatch, {
        "product": "crates",
        "targets": [{"property": "strength", "min": 95, "max": 115}],  # unstated
    })
    text = "We make crates here - we get through 1.8 tonnes of crates a week."
    data = client.post(ENDPOINT, json={"text": text}).json()
    assert data["brief"]["product"] == "crates"
    assert data["brief"]["targets"] == []
    assert "strength" not in json.dumps(data["brief"]["targets"])
    dropped = data["_meta"]["extraction"]["dropped_ungrounded_fields"]
    assert "targets[0].min" in dropped and "targets[0].max" in dropped


def test_adversarial_sag_invents_no_stiffness_numbers(client, monkeypatch):
    # (c) "sags about 10 mm under a person" states no stiffness number: the
    # prompt's stiffness mapping is stiffness / spring rate / deflection in
    # N/mm, and the brief gives neither a rate nor a load in numbers. What
    # the code guarantees - and only this - is that invented stiffness
    # numbers (target or plastic) are dropped as ungrounded.
    _use_fake_live(monkeypatch, {
        "product": "shelf board",
        "targets": [{"property": "stiffness", "min": 25, "max": 40}],   # unstated
        "plastic": {"stiffness_min_mpa": 900, "stiffness_max_mpa": 1200},  # unstated
    })
    text = "Make a shelf board - it sags about 10 mm under a person in the middle."
    data = client.post(ENDPOINT, json={"text": text}).json()
    assert data["brief"]["product"] == "shelf board"
    assert data["brief"]["targets"] == []                     # no stiffness target invented
    plastic = data["brief"]["plastic"]
    assert plastic["stiffness_min_mpa"] is None and plastic["stiffness_max_mpa"] is None
    dropped = data["_meta"]["extraction"]["dropped_ungrounded_fields"]
    for field in ("targets[0].min", "targets[0].max",
                  "plastic.stiffness_min_mpa", "plastic.stiffness_max_mpa"):
        assert field in dropped, field
    # the stated mapping rule itself is the N/mm one, nothing broader
    from server import product_ai
    assert "deflection in N/mm is a **stiffness** target" in product_ai.PRODUCT_BRIEF_SYSTEM


def test_adversarial_not_hdpe_its_pp_selects_no_hdpe_range(client, monkeypatch):
    # (d) "not HDPE, it's PP": the extracted plastic type is PP, and none of
    # the HDPE published-range numbers (app/product.js: stiffness 1111-1589 /
    # 741-1159, strength 41.6-48.4, density 0.94) may appear - the brief
    # stated no plastic numbers at all, so every one is dropped. The server
    # brief itself selects no published range; it only keeps the type.
    _use_fake_live(monkeypatch, {
        "product": "panel",
        "plastic": {"type": "PP",
                    "stiffness_min_mpa": 1111, "stiffness_max_mpa": 1589,
                    "strength_min_mpa": 41.6, "strength_max_mpa": 48.4,
                    "density_g_cm3": 0.94},                     # all unstated
    })
    text = "Make a panel from this delivery - not HDPE, it's PP."
    data = client.post(ENDPOINT, json={"text": text}).json()
    plastic = data["brief"]["plastic"]
    assert plastic["type"] == "PP"
    assert "hdpe" not in json.dumps(data["brief"]).lower()
    for key in ("stiffness_min_mpa", "stiffness_max_mpa", "strength_min_mpa",
                "strength_max_mpa", "density_g_cm3"):
        assert plastic[key] is None, key
    dropped = data["_meta"]["extraction"]["dropped_ungrounded_fields"]
    assert "plastic.stiffness_min_mpa" in dropped
    assert "plastic.density_g_cm3" in dropped


def test_adversarial_three_plastics_keep_all_names_for_mixed_range(client, monkeypatch):
    # (e) "HDPE, ABS and PP" names three plastics. Downstream (browser) maps
    # two-or-more named kinds to the mixed published range, so the server
    # must keep all three names in plastic.type, and must not attach any
    # single-plastic or mixed published numbers (560-1040 / 14-22 / 0.93 in
    # app/product.js) - the brief stated no numbers.
    _use_fake_live(monkeypatch, {
        "product": "board",
        "plastic": {"type": "HDPE, ABS and PP",
                    "stiffness_min_mpa": 560, "stiffness_max_mpa": 1040,
                    "strength_min_mpa": 14, "strength_max_mpa": 22,
                    "density_g_cm3": 0.93},                     # all unstated
    })
    text = "Make a board from this mixed delivery: HDPE, ABS and PP all in together."
    data = client.post(ENDPOINT, json={"text": text}).json()
    plastic = data["brief"]["plastic"]
    assert plastic["type"] == "HDPE, ABS and PP"
    for name in ("HDPE", "ABS", "PP"):
        assert name in plastic["type"], name
    for key in ("stiffness_min_mpa", "stiffness_max_mpa", "strength_min_mpa",
                "strength_max_mpa", "density_g_cm3"):
        assert plastic[key] is None, key
    dropped = data["_meta"]["extraction"]["dropped_ungrounded_fields"]
    assert "plastic.stiffness_max_mpa" in dropped
    assert "plastic.strength_min_mpa" in dropped

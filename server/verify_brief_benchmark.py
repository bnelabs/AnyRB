"""Live brief-extraction benchmark for AnyRB (Muse Spark via /api/product/brief).

Scores the live model's extraction of ~18 short shop-language briefs against
the fields a correct extraction must produce:

  * product keywords (the named part),
  * mode (cantilever / simple / compression, or null when not stated),
  * dimensions (span / width / thickness in mm; null when not stated),
  * target properties + windows (strength / stiffness / weight only),
  * plastic kind (the named plastic(s); a negated or single kind must not
    turn into another kind, and several named kinds must all survive).

Each brief is scored pass/fail *per field group* (product, mode, dimensions,
targets, plastic). Calls are made in-process (TestClient) with the
browser-shaped headers the page sends, plus `X-User-Cache-Bust: 1` so every
score is a live re-call, never a saved (cached) answer. The real key comes
from `server/.env` (loaded by `server.meta_client`); it is asserted to
never enter the evidence file.

Writes `server/evidence/model_benchmark.json` with per-brief results,
totals, the model, and latencies.

Run (live, spends real model calls):
    .venv/bin/python server/verify_brief_benchmark.py

Run (no network, exercises the scoring code against the deterministic
fallback and reports the resulting failures honestly):
    AI_MOCK=1 .venv/bin/python server/verify_brief_benchmark.py --mock
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent
if str(PROJECT) not in sys.path:
    sys.path.insert(0, str(PROJECT))

_parser = argparse.ArgumentParser(description="AnyRB live brief-extraction benchmark")
_parser.add_argument("--mock", action="store_true",
                     help="force mock mode: score the deterministic fallback, no network")
_ARGS = _parser.parse_args()

if _ARGS.mock:
    # Must be set before server.meta_client is imported (it reads the
    # process-wide mock flag at import time).
    os.environ["AI_MOCK"] = "1"
    os.environ["ANYRB_MOCK"] = "1"
else:
    # Live run: a caller's mock env must not silently turn this into a
    # fallback run (same guard as verify_product_live.py).
    for _var in ("AI_MOCK", "ANYRB_MOCK"):
        os.environ.pop(_var, None)

from fastapi.testclient import TestClient  # noqa: E402

from server import meta_client  # noqa: E402
from server.app import app  # noqa: E402

EVIDENCE = Path(__file__).resolve().parent / "evidence" / "model_benchmark.json"
ENDPOINT = "/api/product/brief"

# The exact headers the page sends (Settings defaults to Meta), plus the
# cache-bust header the page sends to force a live re-call instead of a
# saved answer (see meta_client.request_scope / spark_json).
BROWSER_HEADERS = {"X-User-Provider": "meta",
                   "X-User-Base-Url": "https://api.meta.ai/v1",
                   "X-User-Meta-Model": "muse-spark-1.3-contributor",
                   "X-User-Cache-Bust": "1"}

GROUPS = ("product", "mode", "dimensions", "targets", "plastic")

# ---------------------------------------------------------------------------
# benchmark briefs
#
# `plastic_kinds` is a list of kind groups; each group is a list of accepted
# spellings and passes when ANY spelling appears in the extracted plastic
# type. `plastic_forbidden` spellings must NOT appear. An empty
# `plastic_kinds` means no plastic was named, so the type must stay empty.
# Dimensions/targets list every field: null means "not stated, must stay
# null / absent" — inventing it fails that group.
# ---------------------------------------------------------------------------
CASES: list[dict] = [
    {
        "id": "crate-side-strength-and-weight",
        "text": ("I make crate sides, 400 mm long, 60 mm wide and 15 mm thick, "
                 "supported at both ends. Each side has to carry 95 to 115 kg, "
                 "and one side should weigh 320 to 360 g. This delivery is "
                 "recycled HDPE from one supplier, fairly clean."),
        "product_any": ["crate"],
        "mode": "simple",
        "dimensions": {"span_mm": 400, "width_mm": 60, "thickness_mm": 15},
        "targets": [{"property": "strength", "min": 95, "max": 115},
                    {"property": "weight", "min": 320, "max": 360}],
        "plastic_kinds": [["hdpe"]],
        "plastic_forbidden": ["abs", "petg"],
    },
    {
        "id": "shelf-bracket-cantilever-stiffness",
        "text": ("Make a shelf bracket, cantilever, 700 mm long, 40 mm wide and "
                 "12 mm thick. It needs to carry 18 to 22 kg and stiffness "
                 "4 to 6 N/mm. The plastic is recycled PETG."),
        "product_any": ["bracket"],
        "mode": "cantilever",
        "dimensions": {"span_mm": 700, "width_mm": 40, "thickness_mm": 12},
        "targets": [{"property": "strength", "min": 18, "max": 22},
                    {"property": "stiffness", "min": 4, "max": 6}],
        "plastic_kinds": [["petg"]],
        "plastic_forbidden": ["hdpe"],
    },
    {
        "id": "pallet-block-compression",
        "text": ("Make a compression pallet block, 800 mm span, 120 mm wide and "
                 "90 mm thick, from rPETG. It needs strength 38-50 MPa and a "
                 "weight under 35 kg."),
        "product_any": ["pallet", "block"],
        "mode": "compression",
        "dimensions": {"span_mm": 800, "width_mm": 120, "thickness_mm": 90},
        "targets": [{"property": "strength", "min": 38, "max": 50},
                    {"property": "weight", "min": None, "max": 35}],
        "plastic_kinds": [["petg"]],
        "plastic_forbidden": ["hdpe"],
    },
    {
        "id": "load-capacity-is-strength-not-weight",
        "text": ("Make a crate side, supported at both ends, 500 mm long, "
                 "50 mm wide and 10 mm thick, with a load capacity 95 to "
                 "115 kg, made from PP."),
        "product_any": ["crate"],
        "mode": "simple",
        "dimensions": {"span_mm": 500, "width_mm": 50, "thickness_mm": 10},
        "targets": [{"property": "strength", "min": 95, "max": 115}],
        "plastic_kinds": [["pp", "polypropylene"]],
        "plastic_forbidden": ["hdpe"],
    },
    {
        "id": "tonnes-a-week-is-not-a-part-load",
        "text": ("We make crates here - we get through 1.8 tonnes of crates a "
                 "week. Make a crate panel 600 mm long, 80 mm wide and 12 mm "
                 "thick from recycled PP."),
        "product_any": ["crate", "panel"],
        "mode": None,
        "dimensions": {"span_mm": 600, "width_mm": 80, "thickness_mm": 12},
        "targets": [],
        "plastic_kinds": [["pp", "polypropylene"]],
        "plastic_forbidden": ["hdpe"],
    },
    {
        "id": "sag-states-no-stiffness-number",
        "text": ("Make a shelf board 900 mm long, 200 mm wide and 18 mm thick, "
                 "supported at both ends. It sags about 10 mm under a person "
                 "in the middle. Made from recycled HDPE."),
        "product_any": ["shelf", "board"],
        "mode": "simple",
        "dimensions": {"span_mm": 900, "width_mm": 200, "thickness_mm": 18},
        "targets": [],
        "plastic_kinds": [["hdpe"]],
        "plastic_forbidden": ["petg"],
    },
    {
        "id": "not-hdpe-its-pp",
        "text": ("Make a storage bin panel, 450 mm long, 100 mm wide and 8 mm "
                 "thick, cantilever. This delivery is not HDPE, it's PP. It "
                 "has to carry 12 to 15 kg."),
        "product_any": ["panel", "bin"],
        "mode": "cantilever",
        "dimensions": {"span_mm": 450, "width_mm": 100, "thickness_mm": 8},
        "targets": [{"property": "strength", "min": 12, "max": 15}],
        "plastic_kinds": [["pp", "polypropylene"]],
        "plastic_forbidden": ["hdpe"],
    },
    {
        "id": "three-plastics-mixed",
        "text": ("Make a garden board, 1000 mm long, 150 mm wide and 20 mm "
                 "thick, supported at both ends, from HDPE, ABS and PP mixed "
                 "together. Each board should weigh 900 to 1100 g."),
        "product_any": ["board"],
        "mode": "simple",
        "dimensions": {"span_mm": 1000, "width_mm": 150, "thickness_mm": 20},
        "targets": [{"property": "weight", "min": 900, "max": 1100}],
        "plastic_kinds": [["hdpe"], ["abs"], ["pp", "polypropylene"]],
        "plastic_forbidden": [],
    },
    {
        "id": "bench-slat-simply-supported-ldpe",
        "text": ("A bench slat, simply supported, 1500 mm span, 90 mm wide and "
                 "25 mm thick, needs stiffness 3.5 to 5.5 N/mm. Made from "
                 "recycled LDPE."),
        "product_any": ["slat", "bench"],
        "mode": "simple",
        "dimensions": {"span_mm": 1500, "width_mm": 90, "thickness_mm": 25},
        "targets": [{"property": "stiffness", "min": 3.5, "max": 5.5}],
        "plastic_kinds": [["ldpe", "low-density polyethylene", "low density polyethylene"]],
        "plastic_forbidden": ["hdpe"],
    },
    {
        "id": "compression-post-pet-not-petg",
        "text": ("Make a compression post, 300 mm long, 60 mm wide and 60 mm "
                 "thick. It must weigh under 500 g. The plastic is recycled PET."),
        "product_any": ["post"],
        "mode": "compression",
        "dimensions": {"span_mm": 300, "width_mm": 60, "thickness_mm": 60},
        "targets": [{"property": "weight", "min": None, "max": 500}],
        "plastic_kinds": [["pet", "polyethylene terephthalate"]],
        "plastic_forbidden": ["petg"],
    },
    {
        "id": "spacer-strip-no-mode-no-plastic",
        "text": "Make a spacer strip 250 mm long, 30 mm wide and 5 mm thick. It should weigh 40 to 55 g.",
        "product_any": ["spacer", "strip"],
        "mode": None,
        "dimensions": {"span_mm": 250, "width_mm": 30, "thickness_mm": 5},
        "targets": [{"property": "weight", "min": 40, "max": 55}],
        "plastic_kinds": [],
        "plastic_forbidden": [],
    },
    {
        "id": "hook-metres-converted-to-mm",
        "text": ("Make a hook, cantilever, 0.9 m long, 35 mm wide and 9 mm "
                 "thick. It has to hold 8 to 10 kg. Recycled HDPE."),
        "product_any": ["hook"],
        "mode": "cantilever",
        "dimensions": {"span_mm": 900, "width_mm": 35, "thickness_mm": 9},
        "targets": [{"property": "strength", "min": 8, "max": 10}],
        "plastic_kinds": [["hdpe"]],
        "plastic_forbidden": ["pp", "polypropylene"],
    },
    {
        "id": "wide-panel-600mm",
        "text": ("I make insulation panels, 1200 mm long, 600 mm wide and "
                 "15 mm thick, supported at both ends, from recycled PP. Each "
                 "panel should weigh 2 to 3 kg."),
        "product_any": ["panel"],
        "mode": "simple",
        "dimensions": {"span_mm": 1200, "width_mm": 600, "thickness_mm": 15},
        "targets": [{"property": "weight", "min": 2, "max": 3}],
        "plastic_kinds": [["pp", "polypropylene"]],
        "plastic_forbidden": ["hdpe"],
    },
    {
        "id": "tray-side-load-and-own-weight",
        "text": ("Make a wheelbarrow tray side, supported at both ends, 650 mm "
                 "long, 110 mm wide and 14 mm thick. It carries 45 to 60 kg "
                 "and one side weighs 700 to 850 g. This delivery is recycled ABS."),
        "product_any": ["tray", "side"],
        "mode": "simple",
        "dimensions": {"span_mm": 650, "width_mm": 110, "thickness_mm": 14},
        "targets": [{"property": "strength", "min": 45, "max": 60},
                    {"property": "weight", "min": 700, "max": 850}],
        "plastic_kinds": [["abs"]],
        "plastic_forbidden": ["hdpe"],
    },
    {
        "id": "supplier-sheet-numbers-are-plastic-not-targets",
        "text": ("Make a tool tray, cantilever, 350 mm long, 90 mm wide and "
                 "7 mm thick, from recycled PP. The supplier sheet says "
                 "stiffness 900 to 1200 MPa and strength 30 to 40 MPa."),
        "product_any": ["tray"],
        "mode": "cantilever",
        "dimensions": {"span_mm": 350, "width_mm": 90, "thickness_mm": 7},
        "targets": [],
        "plastic_kinds": [["pp", "polypropylene"]],
        "plastic_forbidden": ["hdpe"],
    },
    {
        "id": "washer-plate-thickness-only",
        "text": ("Make a washer plate in compression, 6 mm thick, from "
                 "recycled PP. It needs to carry 200 to 250 kg."),
        "product_any": ["washer", "plate"],
        "mode": "compression",
        "dimensions": {"span_mm": None, "width_mm": None, "thickness_mm": 6},
        "targets": [{"property": "strength", "min": 200, "max": 250}],
        "plastic_kinds": [["pp", "polypropylene"]],
        "plastic_forbidden": ["hdpe"],
    },
    {
        "id": "edging-strip-weight-under",
        "text": ("Make a garden edging strip, 2000 mm long, 100 mm wide and "
                 "10 mm thick, simply supported, weighing under 1200 g, from "
                 "recycled LDPE."),
        "product_any": ["edging", "strip"],
        "mode": "simple",
        "dimensions": {"span_mm": 2000, "width_mm": 100, "thickness_mm": 10},
        "targets": [{"property": "weight", "min": None, "max": 1200}],
        "plastic_kinds": [["ldpe", "low-density polyethylene", "low density polyethylene"]],
        "plastic_forbidden": ["hdpe"],
    },
    {
        "id": "trailer-slat-strength-and-stiffness",
        "text": ("Make a trailer floor slat, supported at both ends, 1100 mm "
                 "long, 120 mm wide and 22 mm thick. It must carry 70 to "
                 "85 kg with stiffness 8 to 11 N/mm. Recycled PETG delivery."),
        "product_any": ["slat", "trailer"],
        "mode": "simple",
        "dimensions": {"span_mm": 1100, "width_mm": 120, "thickness_mm": 22},
        "targets": [{"property": "strength", "min": 70, "max": 85},
                    {"property": "stiffness", "min": 8, "max": 11}],
        "plastic_kinds": [["petg"]],
        "plastic_forbidden": ["hdpe"],
    },
]


# ---------------------------------------------------------------------------
# scoring (pure functions of expected vs actual brief — also exercised by
# the --mock run against the deterministic fallback)
# ---------------------------------------------------------------------------
def _close(actual, expected) -> bool:
    """One number: null must stay null; numbers match within 3% (the same
    tolerance the server-side grounding uses) or 0.51 absolute."""
    if expected is None:
        return actual is None
    if not isinstance(actual, (int, float)) or isinstance(actual, bool):
        return False
    return abs(float(actual) - float(expected)) <= max(0.51, 0.03 * abs(float(expected)))


def score_case(case: dict, brief: dict) -> dict:
    """Pass/fail per field group for one extracted brief."""
    brief = brief if isinstance(brief, dict) else {}
    scores: dict[str, dict] = {}

    product = str(brief.get("product") or "").lower()
    scores["product"] = {
        "pass": bool(product) and any(k in product for k in case["product_any"]),
        "expected_any_of": list(case["product_any"]),
        "actual": brief.get("product"),
    }

    scores["mode"] = {
        "pass": brief.get("mode") == case["mode"],
        "expected": case["mode"],
        "actual": brief.get("mode"),
    }

    dim_actual = {k: brief.get(k) for k in ("span_mm", "width_mm", "thickness_mm")}
    scores["dimensions"] = {
        "pass": all(_close(dim_actual[k], v) for k, v in case["dimensions"].items()),
        "expected": dict(case["dimensions"]),
        "actual": dim_actual,
    }

    actual_targets = [t for t in (brief.get("targets") or []) if isinstance(t, dict)]
    by_property: dict[str, dict] = {}
    for t in actual_targets:
        by_property.setdefault(str(t.get("property")), t)
    expected_props = [t["property"] for t in case["targets"]]
    targets_pass = (
        len(actual_targets) == len(case["targets"])
        and set(by_property) == set(expected_props)
        and all(prop in by_property
                and _close(by_property[prop].get("min"), t["min"])
                and _close(by_property[prop].get("max"), t["max"])
                for t in case["targets"] for prop in [t["property"]])
    )
    scores["targets"] = {
        "pass": bool(targets_pass),
        "expected": case["targets"],
        "actual": actual_targets,
    }

    plastic = brief.get("plastic") if isinstance(brief.get("plastic"), dict) else {}
    plastic_type = str(plastic.get("type") or "").lower()
    if case["plastic_kinds"]:
        plastic_pass = bool(plastic_type) and all(
            any(spelling in plastic_type for spelling in group)
            for group in case["plastic_kinds"])
    else:
        plastic_pass = not plastic_type
    if any(bad in plastic_type for bad in case["plastic_forbidden"]):
        plastic_pass = False
    scores["plastic"] = {
        "pass": bool(plastic_pass),
        "expected_kinds": case["plastic_kinds"],
        "forbidden": case["plastic_forbidden"],
        "actual": plastic.get("type"),
    }
    return scores


def meta_of(data: dict) -> dict:
    meta = data.get("_meta") or {}
    return {"model": data.get("_model") or meta.get("model"),
            "cached": bool(data.get("_cached", meta.get("cached", False))),
            "fallback": bool(meta.get("fallback", False)),
            "latency_s": meta.get("latency_s"),
            "tokens": meta.get("usage") or meta.get("tokens") or {}}


def main() -> int:
    mock = bool(_ARGS.mock or meta_client.MOCK)
    if not mock and not meta_client.KEY:
        print("META_API_KEY is not set (server/.env) - no live calls made. "
              "Use --mock to exercise the scoring code against the fallback.")
        return 1

    client = TestClient(app)
    results: list[dict] = []
    group_totals = {g: {"pass": 0, "total": 0} for g in GROUPS}
    latencies: list[float] = []
    wall_latencies: list[float] = []
    observed_models: set[str] = set()

    for case in CASES:
        t0 = time.time()
        try:
            resp = client.post(ENDPOINT, json={"text": case["text"]},
                               headers=BROWSER_HEADERS)
            data = resp.json()
            status = resp.status_code
        except Exception as exc:  # noqa: BLE001 - record honestly, keep scoring
            data, status = {}, 0
            print(f"{case['id']}: request failed: {type(exc).__name__}: {exc}")
        wall_s = round(time.time() - t0, 3)
        info = meta_of(data) if isinstance(data, dict) else meta_of({})
        if info.get("model"):
            observed_models.add(str(info["model"]))
        if isinstance(info.get("latency_s"), (int, float)):
            latencies.append(float(info["latency_s"]))
        wall_latencies.append(wall_s)

        brief = data.get("brief") if isinstance(data, dict) else None
        scores = score_case(case, brief if isinstance(brief, dict) else {})
        if status != 200:
            for group in scores.values():
                group["pass"] = False
        for name, group in scores.items():
            group_totals[name]["total"] += 1
            group_totals[name]["pass"] += int(bool(group["pass"]))
        passed = sum(1 for g in scores.values() if g["pass"])
        results.append({
            "id": case["id"],
            "text": case["text"],
            "http_status": status,
            "available": bool(data.get("available")) if isinstance(data, dict) else False,
            "scores": scores,
            "groups_passed": passed,
            "groups_total": len(GROUPS),
            "all_pass": passed == len(GROUPS),
            "brief": brief,
            "model": info.get("model"),
            "cached": info.get("cached"),
            "fallback": info.get("fallback"),
            "latency_s": info.get("latency_s"),
            "wall_s": wall_s,
            "tokens": info.get("tokens"),
        })
        print(f"{case['id']}: {passed}/{len(GROUPS)} groups "
              f"({', '.join(g for g, s in scores.items() if s['pass']) or 'none'}) "
              f"model={info.get('model')} cached={info.get('cached')} "
              f"latency_s={info.get('latency_s')} wall_s={wall_s}")

    def _latency_summary(values: list[float]) -> dict:
        if not values:
            return {"calls": 0, "mean_s": None, "max_s": None, "total_s": 0.0}
        return {"calls": len(values),
                "mean_s": round(sum(values) / len(values), 3),
                "max_s": round(max(values), 3),
                "total_s": round(sum(values), 3)}

    out: dict = {
        "generated": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "mock": mock,
        "note": (
            "Mock run (AI_MOCK/--mock): no live model was called. Every brief "
            "is the deterministic fallback, so extraction groups are expected "
            "to fail; this run only exercises the scoring code and reports "
            "those failures honestly. Re-run without --mock for live scores."
            if mock else
            "Live brief-extraction benchmark: every brief was sent with "
            "X-User-Cache-Bust: 1, so each score is a live Spark re-call, "
            "never a saved (cached) answer. Key server-side, never recorded."),
        "endpoint": ENDPOINT,
        "requested_model": BROWSER_HEADERS["X-User-Meta-Model"],
        "observed_models": sorted(observed_models),
        "model": (sorted(observed_models)[0] if len(observed_models) == 1
                  else sorted(observed_models)),
        "headers_sent": sorted(BROWSER_HEADERS),
        "totals": {
            "briefs": len(results),
            "briefs_all_groups_pass": sum(1 for r in results if r["all_pass"]),
            "groups": group_totals,
            "groups_passed": sum(g["pass"] for g in group_totals.values()),
            "groups_total": sum(g["total"] for g in group_totals.values()),
        },
        "latencies": {"model_meta": _latency_summary(latencies),
                      "wall": _latency_summary(wall_latencies)},
        "results": results,
    }

    text = json.dumps(out)
    if meta_client.KEY:
        assert meta_client.KEY not in text, "key leaked into evidence"
    EVIDENCE.parent.mkdir(parents=True, exist_ok=True)
    EVIDENCE.write_text(json.dumps(out, indent=2))
    print(EVIDENCE)
    print(json.dumps(out["totals"], indent=2))
    if mock:
        print("Mock run: scores above are fallback scores, not live model scores.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

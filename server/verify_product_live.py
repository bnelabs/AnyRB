"""Live verification of the AnyRB product endpoints (the judged surface).

Calls the product endpoints in-process (TestClient) with the real key from
`server/.env`: a novel typed brief, move proposals, the verifier-feedback
second round, and grounded advice. Records model / latency / cached / token
usage in `server/evidence/product_live_calls.json`.

The brief wording carries a unique marker so the first pass cannot be a
warm cache hit. The key is never written to the evidence file (asserted).

Run:
    .venv/bin/python server/verify_product_live.py
"""
from __future__ import annotations

import json
import os
import sys
import time
import uuid
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent
if str(PROJECT) not in sys.path:
    sys.path.insert(0, str(PROJECT))
for _var in ("AI_MOCK", "ANYRB_MOCK"):
    os.environ.pop(_var, None)

from fastapi.testclient import TestClient  # noqa: E402

from server import meta_client  # noqa: E402
from server.app import app  # noqa: E402

EVIDENCE = Path(__file__).resolve().parent / "evidence" / "product_live_calls.json"
client = TestClient(app)
MARKER = uuid.uuid4().hex[:8]
# The exact headers the page sends (Settings defaults to Meta): the evidence
# must prove the request shape the browser actually makes, key included.
BROWSER_HEADERS = {"X-User-Provider": "meta",
                   "X-User-Base-Url": "https://api.meta.ai/v1",
                   "X-User-Meta-Model": "muse-spark-1.3-contributor"}

STATE = {
    "product": {"name": "crate side", "mode": "simple", "span_mm": 400,
                "load_kg": 0, "width_mm": 60, "thickness_mm": 15},
    "target": {"property": "strength", "min": 95, "max": 115},
    "targets": [{"property": "strength", "min": 95, "max": 115},
                {"property": "weight", "min": 320, "max": 360}],
    "plastic": {"type": "published measured rHDPE", "batch": "single-supplier stretch-film lot",
                "mix": "", "dirt": "", "dirt_level": "none",
                "stiffness_min_mpa": 1111, "stiffness_max_mpa": 1589,
                "strength_min_mpa": 41.6, "strength_max_mpa": 48.4,
                "density_g_cm3": 0.94},
    "other_product": {"name": "", "mode": "simple", "span_mm": 0,
                      "load_kg": 0, "width_mm": 0, "thickness_mm": 0},
    "steady_available": False,
}


def meta_of(data: dict) -> dict:
    meta = data.get("_meta") or {}
    return {"model": data.get("_model") or meta.get("model"),
            "cached": bool(data.get("_cached", meta.get("cached", False))),
            "fallback": bool(meta.get("fallback", False)),
            "latency_s": meta.get("latency_s"),
            "tokens": meta.get("usage") or meta.get("tokens") or {}}


def main() -> int:
    if not meta_client.KEY:
        print("META_API_KEY is not set (server/.env) — no live calls made.")
        return 1
    out: dict = {"generated": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                 "note": (f"Live check of the product endpoints against the local server. "
                          f"Novel brief marker {MARKER} forces a live first brief call. "
                          "Key server-side, never recorded."), "calls": {}}

    brief_text = (f"I make crate sides for the {MARKER} market run, 400 mm long, 60 mm wide and "
                  "15 mm thick, supported at both ends. Each side has to carry 95 to 115 kg, "
                  "and one side should weigh 320 to 360 g. This delivery is recycled HDPE "
                  "from one supplier, fairly clean, with paper labels on some of it.")
    STATE["plastic"]["batch"] = f"single-supplier stretch-film lot ({MARKER})"
    brief = client.post("/api/product/brief", json={"text": brief_text}, headers=BROWSER_HEADERS).json()
    out["calls"]["brief"] = {"available": brief.get("available"), **meta_of(brief),
                             "brief_keys": sorted((brief.get("brief") or {}).keys())}

    proposals = client.post("/api/product/proposals", json=STATE, headers=BROWSER_HEADERS).json()
    out["calls"]["proposals"] = {"moves": [p.get("move") for p in proposals.get("proposals", [])],
                                 **meta_of(proposals)}

    feedback = [{"move": "thickness", "ranges": [
        {"property": "strength", "min": 80.0, "max": 92.0, "unit": "kg"},
        {"property": "weight", "min": 338.4, "max": 338.4, "unit": "g"}]}]
    second = client.post("/api/product/proposals",
                         json={**STATE, "verifier_feedback": feedback}, headers=BROWSER_HEADERS).json()
    out["calls"]["proposals_feedback_round"] = {
        "moves": [p.get("move") for p in second.get("proposals", [])], **meta_of(second)}

    advice = client.post("/api/product/advice", headers=BROWSER_HEADERS, json={
        "question": "What should I change if this delivery is not strong enough?",
        **STATE,
        "steady": {"available": False, "type": "", "stiffness_mpa": 0, "strength_mpa": 0},
        "plan": {"headline": "Make the 400 mm crate side, 60 x 15 mm",
                 "support": "carries 95.4-111 kg, weighs 338.4 g; strength 95-115 kg, weight 320-360 g",
                 "current": {"property_range": {"min": 95.4, "max": 111.0, "unit": "kg"}, "pass": True},
                 "winner": None, "gap": None, "gaps": [],
                 "builds": []},
    }).json()
    out["calls"]["advice"] = {"available": advice.get("available"), **meta_of(advice)}

    text = json.dumps(out)
    assert meta_client.KEY not in text, "key leaked into evidence"
    EVIDENCE.write_text(json.dumps(out, indent=2))
    print(EVIDENCE)
    print(json.dumps(out["calls"], indent=2)[:2000])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Live verification of the AnyRB Meta backend.

Calls every endpoint in-process (TestClient) with the real API key from
`server/.env`, records model / latency / token usage / hashes in
`server/evidence/live_calls.json`, and pre-warms the disk cache so the demo is
instant. A second pass then proves the cache serves the same content.

Run:
    cd AnyRB
    .venv/bin/python server/verify_live.py          # fresh key from server/.env
    .venv/bin/python server/verify_live.py --keep-cache   # do not clear cache first

The key is never written to the evidence file (asserted in `main`).
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import subprocess
import sys
import time
import wave
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent
if str(PROJECT) not in sys.path:
    sys.path.insert(0, str(PROJECT))
# never inherit a mock flag from the shell
for _var in ("AI_MOCK", "ANYRB_MOCK"):
    os.environ.pop(_var, None)

from fastapi.testclient import TestClient  # noqa: E402

from server import meta_client  # noqa: E402
from server.app import app  # noqa: E402

ROOT = Path(__file__).resolve().parent
EVIDENCE = ROOT / "evidence" / "live_calls.json"
client = TestClient(app)

BRIEF_TEXT = ("Design a wall-mounted shelf bracket for a 15 kg load, with a 1% failure risk, "
              "under 60 grams, printed from recycled PETG. Deflection must stay under 2.5 mm.")
LOT_TEXT = ("Recycled rHDPE lot 2026-31 from MRF North. Young's modulus 950 MPa, "
            "yield strength 28 MPa, density 0.95 g/cm3, measured CV 15% on tensile properties.")
BRIEF = {"part_label": "shelf bracket", "load_N": 147.15, "deflection_limit_mm": 2.5,
         "target_pf": 0.01, "mass_cap_g": 60, "material_key": "rpetg", "process": "FDM/FFF",
         "constraints": ["under 60 g", "1% failure risk"]}
BASELINE = {"uniform_width_mm": 2.0, "mass_g": 62.69, "pf": 0.0000822,
            "sigma_req_MPa": 13.92, "E_req_MPa": 1478.5, "u_tip_mm": 1.61}
MATERIAL = {"E_mean": 2100, "E_cv": 0.10, "sy_mean": 46, "sy_cv": 0.10, "rho": 1.24}
SELECTED = {"mass_g": 50.73, "pf": 0.00997, "sigma_req_MPa": 18.34, "E_req_MPa": 1688.1,
            "binding_mode": "stiffness/buckling", "p5_margin": 1.215, "mass_cap_g": 60,
            "printability": {"min_width_mm": 1.18, "max_slenderness": 22.7,
                             "neighbour_ratio": 1.45}}
COMPARISON = [{"strategy": "solid", "mass_g": 111.6, "pf": 0.0},
              {"strategy": "uniform", "mass_g": 60.31, "pf": 0.01},
              {"strategy": "nominal_sf15", "mass_g": 56.41, "pf": 0.0000064},
              {"strategy": "robust", "mass_g": 50.73, "pf": 0.00997}]
PASSPORT = {"verdict": "pass with compensation", "scale_required": 1.0994,
            "added_mass_pct": 8.5, "lot_E": 1680.0, "lot_sy": 46.0}
VALIDATION = {"counts": {"PASS": 24, "WARN": 2, "FAIL": 0}, "total": 26}


def _hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:16]


def _wav_from_say(text: str) -> bytes:
    out = "/tmp/anyrb_brief.wav"
    subprocess.run(["say", "-o", out, "--data-format=LEI16@16000", text], check=False,
                   capture_output=True)
    if Path(out).exists():
        return Path(out).read_bytes()
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000)
        w.writeframes(b"\x00\x00" * 16000)
    return buf.getvalue()


def _png_bytes() -> bytes:
    from PIL import Image, ImageDraw
    import random
    im = Image.new("RGB", (640, 480), (247, 245, 240))
    d = ImageDraw.Draw(im)
    for i in range(0, 640, 40):
        d.line((i, 80, i + 20, 400), fill=(21, 23, 26), width=3)
    for j in range(0, 480, 40):
        d.line((0, j, 640, j), fill=(255, 90, 54), width=2)
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return buf.getvalue()


def _summary(body: dict) -> dict:
    """Small, key-free summary of a response for the evidence file."""
    if not isinstance(body, dict):
        return {"type": type(body).__name__}
    keep = ("part_label", "load_N", "deflection_limit_mm", "target_pf", "material_key",
            "mass_cap_g", "process", "constraints", "confidence", "E_mean", "E_cv", "sy_mean",
            "sy_cv", "rho", "source_label", "fields_found", "assumptions",
            "memo", "key_risk", "claim_level", "verdict", "transcript", "count", "mocked",
            "illustrative", "label", "area_share")
    out = {k: body[k] for k in keep if k in body and not isinstance(body[k], (list, dict))}
    if isinstance(body.get("candidates"), list):
        out["candidates"] = [{"id": c.get("id"), "name": c.get("name"),
                              "widths_mm": c.get("width_priors_mm")} for c in body["candidates"]]
    if body.get("image_data_url"):
        out["image_data_url_len"] = len(body["image_data_url"])
        out["image_mime"] = body.get("mime")
        out["image_size"] = [body.get("width"), body.get("height")]
    for k in ("memo", "key_risk", "claim_level", "part_label"):
        if isinstance(out.get(k), str):
            out[k] = out[k][:180]
    body_hash = hashlib.sha256(
        json.dumps({k: v for k, v in body.items() if k != "_meta"}, sort_keys=True,
                   default=str).encode()).hexdigest()[:16]
    return {"summary": out, "response_hash": body_hash}


def _call(name: str, fn, *, required: bool = True) -> dict:
    t0 = time.time()
    try:
        r = fn()
        wall = time.time() - t0
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        meta = body.get("_meta", {}) if isinstance(body, dict) else {}
        entry = {"endpoint": name, "status": r.status_code, "ok": r.status_code < 400,
                 "required": required, "wall_s": round(wall, 2),
                 "model": meta.get("model"), "latency_s": meta.get("latency_s"),
                 "cached": meta.get("cached"), "fallback": meta.get("fallback"),
                 "mock": meta.get("mock"),
                 "tokens": meta.get("usage") or meta.get("tokens") or {},
                 "grounding": (meta.get("grounding") or {}).get("ok"),
                 **_summary(body)}
        print(f"{name:22s} {r.status_code}  wall={entry['wall_s']:6.2f}s  "
              f"model={entry['model']}  fallback={entry['fallback']}  cached={entry['cached']}")
        return entry
    except Exception as e:  # noqa: BLE001
        entry = {"endpoint": name, "ok": False, "required": required,
                 "error": f"{type(e).__name__}: {meta_client.redact(e)}"}
        print(f"{name:22s} ERROR {type(e).__name__}: {e}")
        return entry


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Live-verify the AnyRB AI backend")
    parser.add_argument("--keep-cache", action="store_true",
                        help="reuse existing cache entries instead of clearing first")
    parser.add_argument("--skip-sam", action="store_true", help="skip the optional SAM 3.1 call")
    args = parser.parse_args(argv)

    if not meta_client.KEY:
        print("ERROR: META_API_KEY is not set (server/.env). Cannot run live verification.")
        return 2
    if meta_client.MOCK:
        print("ERROR: mock mode is active; refusing to claim live evidence.")
        return 2
    if not args.keep_cache:
        removed = 0
        for p in meta_client.CACHE_DIR.glob("*.json"):
            try:
                p.unlink(); removed += 1
            except OSError:
                pass
        print(f"cleared {removed} cache entries for a fresh live pass")

    health = client.get("/api/health").json()
    print(f"health: mode={health.get('mode')} key_present={health.get('ai', {}).get('key_present')} "
          f"session={health.get('session', {}).get('id')}")
    if health.get("mode") != "live":
        print("ERROR: server reports non-live mode; aborting (would not be live evidence).")
        return 2

    wav = _wav_from_say("Design a wall mounted shelf bracket for recycled PETG that carries "
                        "fifteen kilograms with one percent failure risk and stays under sixty grams.")
    calls = [
        _call("GET /api/health", lambda: client.get("/api/health")),
        _call("POST /api/brief/parse", lambda: client.post("/api/brief/parse",
                                                           json={"text": BRIEF_TEXT})),
        _call("POST /api/lot/parse", lambda: client.post("/api/lot/parse",
                                                         json={"text": LOT_TEXT})),
        _call("POST /api/design/plan", lambda: client.post("/api/design/plan",
                                                           json={"brief": BRIEF, "baseline": BASELINE,
                                                                 "material": MATERIAL})),
        _call("POST /api/design/review", lambda: client.post(
            "/api/design/review",
            json={"brief": BRIEF, "selected": SELECTED, "comparison": COMPARISON,
                  "material": MATERIAL, "sensitivity": {"mean_E": 0.78, "load": 0.53}})),
        _call("POST /api/proof/memo", lambda: client.post(
            "/api/proof/memo",
            json={"brief": BRIEF, "design": SELECTED, "batch_passport": PASSPORT,
                  "comparison": COMPARISON, "validation": VALIDATION})),
        _call("POST /api/voice/transcribe", lambda: client.post(
            "/api/voice/transcribe", files={"audio": ("brief.wav", wav, "audio/wav")})),
        _call("POST /api/image/render", lambda: client.post(
            "/api/image/render", json={"design": {"mass_g": 50.73}})),
    ]
    if not args.skip_sam:
        calls.append(_call("POST /api/photo/segment", lambda: client.post(
            "/api/photo/segment",
            files={"image": ("part.png", _png_bytes(), "image/png")},
            data={"concept": "lattice bracket"}), required=False))

    # second pass: proves the disk cache serves identical content instantly
    cache_check = []
    for name, fn in [
        ("brief/parse", lambda: client.post("/api/brief/parse", json={"text": BRIEF_TEXT})),
        ("lot/parse", lambda: client.post("/api/lot/parse", json={"text": LOT_TEXT})),
        ("design/plan", lambda: client.post("/api/design/plan",
                                            json={"brief": BRIEF, "baseline": BASELINE,
                                                  "material": MATERIAL})),
        ("image/render", lambda: client.post("/api/image/render",
                                             json={"design": {"mass_g": 50.73}})),
        ("voice/transcribe", lambda: client.post(
            "/api/voice/transcribe", files={"audio": ("brief.wav", wav, "audio/wav")})),
    ]:
        entry = _call(f"cached {name}", fn, required=False)
        cache_check.append(entry)

    prov = client.get("/api/provenance?n=100&session_only=true").json()
    evidence = {
        "generated": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "base_url": health.get("ai", {}).get("base_url"),
        "models": health.get("ai", {}).get("models"),
        "reasoning_effort": health.get("ai", {}).get("reasoning_effort"),
        "mode": health.get("mode"),
        "session_id": health.get("session", {}).get("id"),
        "engine": health.get("engine"),
        "calls": calls,
        "cache_check": cache_check,
        "provenance": {"count": prov.get("count"), "aggregate": prov.get("aggregate"),
                       "cache": prov.get("cache")},
        "totals": {
            "live_calls": sum(1 for c in calls
                              if c.get("ok") and not c.get("fallback") and not c.get("cached")
                              and c["endpoint"] != "GET /api/health"),
            "fallbacks": sum(1 for c in calls if c.get("fallback")),
            "cached": sum(1 for c in calls if c.get("cached")),
            "cache_hits_on_second_pass": sum(1 for c in cache_check if c.get("cached")),
            "wall_s": round(sum(c.get("wall_s") or 0 for c in calls), 2),
        },
        "notes": ("Live calls executed in-process with the real Meta key from server/.env; "
                  "the key is never included here. `cache_check` entries are the identical "
                  "requests replayed after cache warm-up. Evidence file generated by "
                  "server/verify_live.py."),
    }
    text = json.dumps(evidence, indent=1)
    assert meta_client.KEY not in text, "refusing to write evidence containing the API key"
    EVIDENCE.parent.mkdir(parents=True, exist_ok=True)
    EVIDENCE.write_text(text)

    print(f"\nevidence -> {EVIDENCE}")
    required_ok = all(c.get("ok") and not c.get("fallback") for c in calls if c.get("required"))
    print("ALL REQUIRED LIVE CALLS OK" if required_ok else "SOME REQUIRED CALLS FAILED/FELL BACK")
    print(f"cache hits on second pass: {evidence['totals']['cache_hits_on_second_pass']}/"
          f"{len(cache_check)}")
    return 0 if required_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

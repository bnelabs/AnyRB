"""Meta model clients for AnyRB — cache-first, failure-proof, provenance-logged.

Verified live against https://api.meta.ai/v1 (2026-10-29):
  Muse Spark 1.3 Contributor  POST /chat/completions  (reasoning model: max_tokens>=3000, reasoning_effort=low)
  Muse Image 1.0              POST /images/generations  -> b64 WebP 1600x1600
  Muse Voice Transcribe 1.0   POST /asr/transcribe      multipart request JSON + mono 16k s16le WAV
  SAM 3.1                     POST /responses           input_text + input_image (optional)

Design rules:
  * the browser never sees the API key;
  * every successful live call is cached on disk (sha256 of kind+model+payload) and
    appended to provenance.jsonl (never containing the key);
  * forced mock mode / no key / failure -> deterministic fallback with `_meta.fallback=true`;
  * responses are returned as dicts and validated by the API layer (`server/schemas.py`).
"""
from __future__ import annotations

import base64
import hashlib
import io
import json
import os
import re
import time
import uuid
import wave
from pathlib import Path
from typing import Any, Callable

import httpx

SERVER_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SERVER_DIR.parent
CACHE_DIR = Path(os.environ.get("ANYRB_CACHE_DIR", SERVER_DIR / "cache"))
EVIDENCE_DIR = Path(os.environ.get("ANYRB_EVIDENCE_DIR", SERVER_DIR / "evidence"))
PROVENANCE = Path(os.environ.get("ANYRB_PROVENANCE_FILE", SERVER_DIR / "provenance.jsonl"))
CACHE_DIR.mkdir(parents=True, exist_ok=True)
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)

SESSION_ID = uuid.uuid4().hex[:12]
STARTED_AT = time.time()


# ---------------------------------------------------------------------------
# environment
# ---------------------------------------------------------------------------
def _read_env(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


def load_env() -> None:
    """server/.env first; only fall back to the legacy dev env if the key is unset.

    A *present but empty* META_API_KEY is respected (tests use that to force offline).
    """
    _read_env(SERVER_DIR / ".env")
    if "META_API_KEY" not in os.environ:
        _read_env(PROJECT_DIR.parent / "sprint" / "backend" / ".env")


load_env()

BASE = os.environ.get("META_BASE_URL", "https://api.meta.ai/v1").rstrip("/")
KEY = os.environ.get("META_API_KEY", "")
MODEL_SPARK = os.environ.get("META_MODEL_SPARK", "muse-spark-1.3-contributor")
MODEL_SPARK_STANDARD = os.environ.get("META_MODEL_SPARK_STANDARD", "muse-spark-1.3")
MODEL_IMAGE = os.environ.get("META_MODEL_IMAGE", "muse-image-1.0")
MODEL_ASR = os.environ.get("META_MODEL_ASR", "muse-voice-transcribe-1.0")
MODEL_SAM = os.environ.get("META_MODEL_SAM", "sam-3.1")
REASONING_EFFORT = os.environ.get("META_REASONING_EFFORT", "low")
MAX_TOKENS = int(os.environ.get("META_MAX_TOKENS", "4000"))
# Process-wide mock override; per-request `mock=True` overrides this (see functions).
MOCK = os.environ.get("ANYRB_MOCK", os.environ.get("AI_MOCK", "0")).lower() in ("1", "true", "yes", "on")
TIMEOUT = httpx.Timeout(connect=10.0, read=240.0, write=120.0, pool=10.0)

CONTRIBUTOR_NOTE = (
    "Contributor mode: Meta may train on inputs/outputs. Fine for the hackathon demo; "
    "switch to Standard mode for real customer data."
)


def configured() -> dict:
    return {
        "live": bool(KEY) and not MOCK,
        "mock": MOCK,
        "base_url": BASE,
        "key_present": bool(KEY),
        "models": {"spark": MODEL_SPARK, "spark_standard": MODEL_SPARK_STANDARD,
                   "image": MODEL_IMAGE, "asr": MODEL_ASR, "sam": MODEL_SAM},
        "reasoning_effort": REASONING_EFFORT,
        "max_tokens": MAX_TOKENS,
        "contributor_note": CONTRIBUTOR_NOTE,
        "cache_dir": str(CACHE_DIR),
        "session_id": SESSION_ID,
    }


def redact(text: Any, limit: int = 240) -> str:
    """Strip the API key from any string before it is logged or returned."""
    s = str(text)
    if KEY:
        s = s.replace(KEY, "[redacted-key]")
        # also catch a partially-printed key
        if len(KEY) > 12:
            s = s.replace(KEY[:12], "[redacted-key]")
            s = s.replace(KEY[-8:], "[redacted-tail]")
    return s[:limit]


# ---------------------------------------------------------------------------
# cache / provenance
# ---------------------------------------------------------------------------
def _hash(*parts: Any) -> str:
    h = hashlib.sha256()
    for p in parts:
        h.update(p if isinstance(p, bytes) else json.dumps(p, sort_keys=True, default=str).encode())
    return h.hexdigest()[:32]


def _cache_get(key: str) -> dict | None:
    p = CACHE_DIR / key
    if p.exists():
        try:
            entry = json.loads(p.read_text())
            return entry if isinstance(entry, dict) else None
        except Exception:
            return None
    return None


def _cache_put(key: str, payload: dict, meta: dict) -> dict:
    try:
        entry = {"created_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                 "payload": payload, "meta": meta}
        (CACHE_DIR / key).write_text(json.dumps(entry))
        return entry
    except Exception:
        return {"payload": payload, "meta": meta}


def cache_stats() -> dict:
    entries, size = 0, 0
    try:
        for p in CACHE_DIR.glob("*.json"):
            entries += 1
            try:
                size += p.stat().st_size
            except OSError:
                pass
    except Exception:
        pass
    return {"entries": entries, "bytes": size, "dir": str(CACHE_DIR)}


def log_call(entry: dict) -> None:
    entry = {"ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
             "session_id": SESSION_ID, **entry}
    entry.pop("key", None)
    line = json.dumps(entry)
    if KEY and KEY in line:  # defence in depth — never write the key
        line = line.replace(KEY, "[redacted-key]")
    try:
        with PROVENANCE.open("a") as f:
            f.write(line + "\n")
    except Exception:
        pass


def provenance_tail(n: int = 50, session_only: bool = False) -> list[dict]:
    if not PROVENANCE.exists():
        return []
    try:
        lines = PROVENANCE.read_text().splitlines()
    except Exception:
        return []
    if session_only:
        lines = [ln for ln in lines if f'"session_id": "{SESSION_ID}"' in ln]
    out = []
    for line in lines[-n:]:
        try:
            out.append(json.loads(line))
        except Exception:
            continue
    return out


def session_calls() -> list[dict]:
    return provenance_tail(1000, session_only=True)


def model_latencies() -> dict:
    """Per-model live-call latency summary for this server session (excludes cache hits)."""
    agg: dict[str, dict] = {}
    for c in session_calls():
        if c.get("cached") or c.get("fallback") or not isinstance(c.get("latency_s"), (int, float)):
            continue
        model = c.get("model") or "unknown"
        a = agg.setdefault(model, {"calls": 0, "total_s": 0.0, "max_s": 0.0})
        a["calls"] += 1
        a["total_s"] += float(c["latency_s"])
        a["max_s"] = max(a["max_s"], float(c["latency_s"]))
    return {m: {"calls": a["calls"], "mean_s": round(a["total_s"] / a["calls"], 2),
                "max_s": round(a["max_s"], 2)} for m, a in agg.items()}


def _meta(kind: str, model: str, latency: float, cached: bool, fallback: bool,
          usage: dict | None = None, mock: bool = False, error: str | None = None) -> dict:
    usage = usage or {}
    return {"kind": kind, "model": model, "latency_s": round(latency, 3),
            "cached": cached, "fallback": fallback, "usage": usage,
            "tokens": usage, "mock": mock,
            "session_id": SESSION_ID,
            "error": redact(error) if error else None,
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z")}


def _response_hash(payload: dict) -> str:
    try:
        return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()[:16]
    except Exception:
        return ""


def _headers() -> dict:
    return {"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}


# ---------------------------------------------------------------------------
# JSON helpers
# ---------------------------------------------------------------------------
def _parse_json(text: str) -> dict | None:
    if not text:
        return None
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        obj = json.loads(text)
        return obj if isinstance(obj, dict) else None
    except Exception:
        m = re.search(r"\{.*\}", text, re.S)
        if not m:
            return None
        try:
            obj = json.loads(m.group(0))
            return obj if isinstance(obj, dict) else None
        except Exception:
            return None


def _cached_result(kind: str, entry: dict) -> dict:
    payload = dict(entry.get("payload") or {})
    old_meta = dict(entry.get("meta") or {})
    meta = {**old_meta, "kind": kind, "cached": True, "fallback": False,
            "latency_s": 0.001, "mock": False,
            "original_latency_s": old_meta.get("latency_s"),
            "cached_at": entry.get("created_at")}
    payload["_meta"] = meta
    log_call({"kind": kind, "model": meta.get("model"), "latency_s": 0.001,
              "cached": True, "fallback": False, "mock": False,
              "usage": meta.get("usage", {}),
              "response_hash": _response_hash({k: v for k, v in payload.items() if k != "_meta"})})
    return payload


def _fallback_result(kind: str, fallback: Callable[[], dict], latency: float,
                     mock: bool, error: str | None, mock_reason: str = "mock") -> dict:
    out = fallback()
    meta = _meta(kind, "fallback", latency, False, True, {}, mock=mock, error=error)
    meta["mock_reason"] = mock_reason
    out["_meta"] = meta
    log_call({"kind": kind, "model": "fallback", "latency_s": round(latency, 3),
              "cached": False, "fallback": True, "mock": mock,
              "error": redact(error) if error else None,
              "mock_reason": mock_reason,
              "response_hash": _response_hash({k: v for k, v in out.items() if k != "_meta"})})
    return out


def _effective_mock(mock: bool | None) -> bool:
    return MOCK if mock is None else bool(mock)


def _mock_payload(kind: str, payload: dict, reason: str) -> dict:
    """Deterministic mock/fallback payload + provenance log (never calls the network)."""
    payload = dict(payload)
    payload["_meta"] = _meta(kind, "fallback", 0.0, False, True, mock=True, error=reason)
    payload["_meta"]["mock_reason"] = "mock"
    log_call({"kind": kind, "model": "fallback", "latency_s": 0.0, "cached": False,
              "fallback": True, "mock": True, "error": reason,
              "response_hash": _response_hash({k: v for k, v in payload.items() if k != "_meta"})})
    return payload


# ---------------------------------------------------------------------------
# Muse Spark
# ---------------------------------------------------------------------------
def _spark_http(system: str, payload: dict, model: str) -> tuple[dict | None, dict, str | None]:
    """One model attempt with a single transient retry. Returns (parsed, usage, error)."""
    body = {
        "model": model,
        "messages": [{"role": "system", "content": system},
                     {"role": "user", "content": json.dumps(payload, ensure_ascii=False, default=str)}],
        "temperature": 0.2,
        "max_tokens": MAX_TOKENS,
        "reasoning_effort": REASONING_EFFORT,
        "response_format": {"type": "json_object"},
    }
    last_err = None
    for attempt in (1, 2):
        try:
            with httpx.Client(timeout=TIMEOUT) as c:
                r = c.post(f"{BASE}/chat/completions", headers=_headers(), json=body)
                if r.status_code in (429, 500, 502, 503, 504) and attempt == 1:
                    last_err = f"HTTP {r.status_code}"
                    time.sleep(1.0)
                    continue
                r.raise_for_status()
                j = r.json()
            choice = (j.get("choices") or [{}])[0]
            content = (choice.get("message") or {}).get("content") or ""
            usage = j.get("usage") or {}
            parsed = _parse_json(content)
            if parsed is None:
                return None, usage, f"unparseable content (finish={choice.get('finish_reason')})"
            return parsed, usage, None
        except Exception as e:  # noqa: BLE001
            last_err = f"{type(e).__name__}: {e}"
            if attempt == 1:
                time.sleep(0.8)
    return None, {}, redact(last_err or "unknown error")


def spark_json(kind: str, system: str, payload: dict,
               fallback: Callable[[], dict],
               cache_name: str | None = None,
               mock: bool | None = None) -> dict:
    """Call Muse Spark and return a JSON dict. Never raises.

    Resolution order: explicit mock (bypasses cache) -> disk cache -> live network ->
    deterministic fallback. `_meta` describes what actually happened.
    """
    mock_flag = _effective_mock(mock)
    cache_key = f"spark_{cache_name or kind}_{_hash('spark', MODEL_SPARK, kind, payload)}.json"
    if mock_flag:
        return _fallback_result(kind, fallback, 0.0, True, "forced mock mode", "mock")
    cached = _cache_get(cache_key)
    if cached:
        return _cached_result(kind, cached)
    if not KEY:
        return _fallback_result(kind, fallback, 0.0, True, "META_API_KEY not set", "offline")

    t0 = time.time()
    last_err = None
    for model in (MODEL_SPARK, MODEL_SPARK_STANDARD):
        parsed, usage, err = _spark_http(system, payload, model)
        if parsed is None:
            last_err = err
            continue
        latency = time.time() - t0
        meta = _meta(kind, model, latency, False, False, usage)
        payload_out = {k: v for k, v in parsed.items() if k != "_meta"}
        payload_out["_meta"] = meta
        _cache_put(cache_key, payload_out, meta)
        log_call({"kind": kind, "model": model, "latency_s": round(latency, 3),
                  "cached": False, "fallback": False, "mock": False,
                  "tokens": usage, "usage": usage,
                  "response_hash": _response_hash(payload_out)})
        return payload_out
    return _fallback_result(kind, fallback, time.time() - t0, False,
                            last_err or "all models failed", "api_error")


# ---------------------------------------------------------------------------
# Muse Image
# ---------------------------------------------------------------------------
def _image_data_url(raw: bytes) -> tuple[str, str, int, int]:
    """Convert the API's WebP to a browser-friendly, compact data URL."""
    from PIL import Image
    im = Image.open(io.BytesIO(raw))
    if im.mode not in ("RGB", "RGBA"):
        im = im.convert("RGB")
    im.thumbnail((1280, 1280))
    w, h = im.size
    buf = io.BytesIO()
    if im.mode == "RGBA":
        im.save(buf, format="PNG", optimize=True)
        mime = "image/png"
    else:
        im.save(buf, format="JPEG", quality=88, optimize=True)
        mime = "image/jpeg"
    return "data:" + mime + ";base64," + base64.b64encode(buf.getvalue()).decode(), mime, w, h


def generate_image(prompt: str, mock: bool | None = None) -> dict:
    kind = "image"
    mock_flag = _effective_mock(mock)
    cache_key = f"image_{_hash('image', MODEL_IMAGE, prompt)}.json"
    if mock_flag:
        return _mock_payload(kind, {"image_data_url": None, "illustrative": True,
                                    "prompt": prompt}, "forced mock mode")
    cached = _cache_get(cache_key)
    if cached:
        return _cached_result(kind, cached)
    if not KEY:
        return _mock_payload(kind, {"image_data_url": None, "illustrative": True,
                                    "prompt": prompt}, "META_API_KEY not set")
    t0 = time.time()
    body = {"model": MODEL_IMAGE, "prompt": prompt, "n": 1,
            "size": "1024x1024", "response_format": "b64_json"}
    try:
        with httpx.Client(timeout=TIMEOUT) as c:
            r = c.post(f"{BASE}/images/generations", headers=_headers(), json=body)
            r.raise_for_status()
            j = r.json()
        item = (j.get("data") or [{}])[0]
        b64 = item.get("b64_json") or ""
        data_url, mime, w, h = _image_data_url(base64.b64decode(b64)) if b64 else (None, None, None, None)
        meta = _meta(kind, MODEL_IMAGE, time.time() - t0, False, not bool(data_url))
        payload = {"image_data_url": data_url, "mime": mime, "width": w, "height": h,
                   "illustrative": True, "prompt": prompt,
                   "revised_prompt": item.get("revised_prompt") or ""}
        if data_url:
            _cache_put(cache_key, payload, meta)
            log_call({"kind": kind, "model": MODEL_IMAGE, "latency_s": meta["latency_s"],
                      "cached": False, "fallback": False, "mock": False,
                      "response_hash": _response_hash(payload)})
        payload["_meta"] = meta
        return payload
    except Exception as e:  # noqa: BLE001
        err = f"{type(e).__name__}: {e}"
        log_call({"kind": kind, "model": MODEL_IMAGE, "cached": False, "fallback": True,
                  "error": redact(err), "response_hash": ""})
        return {"image_data_url": None, "illustrative": True, "prompt": prompt,
                "_meta": _meta(kind, MODEL_IMAGE, time.time() - t0, False, True, error=err)}


# ---------------------------------------------------------------------------
# Muse Voice Transcribe
# ---------------------------------------------------------------------------
def _to_asr_wav(audio: bytes) -> bytes:
    """Normalise WAV input to mono s16le 16 kHz (the API requires this)."""
    with wave.open(io.BytesIO(audio), "rb") as w:
        fs, ch, sw = w.getframerate(), w.getnchannels(), w.getsampwidth()
        frames = w.readframes(w.getnframes())
    if sw != 2:
        raise ValueError(f"expected 16-bit PCM, got sample width {sw}")
    import numpy as np
    x = np.frombuffer(frames, dtype="<i2").astype(np.float64)
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)
    target = 16000
    if fs != target:
        from math import gcd
        g = gcd(fs, target)
        try:
            from scipy.signal import resample_poly
            x = resample_poly(x, target // g, fs // g)
        except Exception:  # numpy-only linear fallback
            n_out = int(round(len(x) * target / fs))
            x = np.interp(np.linspace(0, len(x) - 1, n_out), np.arange(len(x)), x)
    pcm = np.clip(x, -32768, 32767).astype("<i2").tobytes()
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(target)
        w.writeframes(pcm)
    return buf.getvalue()


def transcribe(audio: bytes, filename: str = "brief.wav", mock: bool | None = None) -> dict:
    kind = "asr"
    mock_flag = _effective_mock(mock)
    cache_key = f"asr_{_hash('asr', MODEL_ASR, audio)}.json"
    if mock_flag:
        return _mock_payload(kind, {"transcript": "", "duration_s": None}, "forced mock mode")
    cached = _cache_get(cache_key)
    if cached:
        return _cached_result(kind, cached)
    if not KEY:
        return _mock_payload(kind, {"transcript": "", "duration_s": None}, "META_API_KEY not set")
    t0 = time.time()
    try:
        wav = _to_asr_wav(audio)
        req = json.dumps({"model": MODEL_ASR, "audioEncoding": "WAV", "mode": "PUSH_TO_TALK"})
        files = {"request": (None, req, "application/json"),
                 "audio": (filename, wav, "audio/wav")}
        with httpx.Client(timeout=TIMEOUT) as c:
            r = c.post(f"{BASE}/asr/transcribe",
                       headers={"Authorization": f"Bearer {KEY}", "Accept": "application/json"},
                       files=files)
            r.raise_for_status()
            j = r.json()
        payload = {"transcript": j.get("transcript", ""),
                   "duration_s": (j.get("audioDurationMs") or 0) / 1000.0}
        meta = _meta(kind, MODEL_ASR, time.time() - t0, False, False,
                     {"audio_s": payload["duration_s"]})
        if payload["transcript"]:
            _cache_put(cache_key, payload, meta)
        log_call({"kind": kind, "model": MODEL_ASR, "latency_s": meta["latency_s"],
                  "cached": False, "fallback": False, "mock": False,
                  "response_hash": _response_hash(payload)})
        payload["_meta"] = meta
        return payload
    except Exception as e:  # noqa: BLE001
        err = f"{type(e).__name__}: {e}"
        log_call({"kind": kind, "model": MODEL_ASR, "cached": False, "fallback": True,
                  "error": redact(err)})
        return {"transcript": "", "duration_s": None,
                "_meta": _meta(kind, MODEL_ASR, time.time() - t0, False, True, error=err)}


# ---------------------------------------------------------------------------
# SAM 3.1 (optional, for part photos)
# ---------------------------------------------------------------------------
BOX_RE = re.compile(r"<\|box;x1=(-?\d+);y1=(-?\d+);x2=(-?\d+);y2=(-?\d+);w=(-?\d+);h=(-?\d+)\|>")


def _normalise_photo(image: bytes, max_side: int = 1024) -> tuple[bytes, str]:
    """Downscale/convert an uploaded photo so the SAM payload stays small."""
    try:
        from PIL import Image
        im = Image.open(io.BytesIO(image))
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGB")
        im.thumbnail((max_side, max_side))
        buf = io.BytesIO()
        im.save(buf, format="JPEG", quality=88, optimize=True)
        return buf.getvalue(), "image/jpeg"
    except Exception:
        return image, "image/jpeg"


def sam_segment(image: bytes, concept: str, mime: str = "image/jpeg",
                mock: bool | None = None) -> dict:
    kind = "sam"
    mock_flag = _effective_mock(mock)
    photo, mime = _normalise_photo(image)
    cache_key = f"sam_{_hash('sam', MODEL_SAM, concept, photo)}.json"
    if mock_flag:
        return _mock_payload(kind, {"concept": concept, "boxes": [], "count": 0,
                                    "mocked": True}, "forced mock mode")
    cached = _cache_get(cache_key)
    if cached:
        return _cached_result(kind, cached)
    if not KEY:
        return _mock_payload(kind, {"concept": concept, "boxes": [], "count": 0,
                                    "mocked": True}, "META_API_KEY not set")
    t0 = time.time()
    try:
        b64 = base64.b64encode(photo).decode()
        body = {"model": MODEL_SAM, "stream": False, "input": [{
            "type": "message", "role": "user", "content": [
                {"type": "input_text", "text": concept},
                {"type": "input_image", "image_url": f"data:{mime};base64,{b64}"}]}]}
        with httpx.Client(timeout=TIMEOUT) as c:
            r = c.post(f"{BASE}/responses", headers=_headers(), json=body)
            r.raise_for_status()
            data = r.json()
        text = ""
        for item in data.get("output", []):
            for part in item.get("content", []):
                if part.get("type") == "output_text":
                    text += part.get("text", "")
        boxes = [dict(zip(("x1", "y1", "x2", "y2", "w", "h"), map(int, m)))
                 for m in BOX_RE.findall(text)]
        areas = [max(0, b["x2"] - b["x1"]) * max(0, b["y2"] - b["y1"]) for b in boxes]
        img_px = boxes[0]["w"] * boxes[0]["h"] if boxes else 0
        payload = {"concept": concept, "boxes": boxes[:8], "count": len(boxes),
                   "area_share": round(sum(areas) / img_px, 3) if img_px else 0.0,
                   "mocked": False}
        meta = _meta(kind, MODEL_SAM, time.time() - t0, False, False)
        _cache_put(cache_key, payload, meta)
        log_call({"kind": kind, "model": MODEL_SAM, "latency_s": meta["latency_s"],
                  "cached": False, "fallback": False, "mock": False,
                  "response_hash": _response_hash(payload)})
        payload["_meta"] = meta
        return payload
    except Exception as e:  # noqa: BLE001
        err = f"{type(e).__name__}: {e}"
        log_call({"kind": kind, "model": MODEL_SAM, "cached": False, "fallback": True,
                  "error": redact(err)})
        return {"concept": concept, "boxes": [], "count": 0, "mocked": True,
                "_meta": _meta(kind, MODEL_SAM, time.time() - t0, False, True, error=err)}

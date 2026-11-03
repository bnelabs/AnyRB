"""Shared text utilities for AnyRB AI endpoints.

Every model response is JSON-validated by the API layer. Free user text is
wrapped in explicit data delimiters so it is DATA, never instructions, and
numbers in free-text outputs must be grounded in the structured payload the
app supplied (the app re-checks this too).
"""
from __future__ import annotations

import json
import re

# ---------------------------------------------------------------------------
# untrusted-data delimiters (prompt-injection guard)
# ---------------------------------------------------------------------------
UNTRUSTED_OPEN = "<<<USER_DATA>>>"
UNTRUSTED_CLOSE = "<<<END_USER_DATA>>>"


def wrap_untrusted(text: str, tag: str = "USER_DATA") -> str:
    """Wrap free user text in explicit data delimiters for the model.

    The system prompt states that everything between the delimiters is DATA,
    never instructions. The API additionally validates the JSON schema, so an
    injected instruction cannot change response shape or field ranges.
    """
    import re as _re
    body = str(text or "")
    # neutralise every fence the data could use to escape its delimiters
    body = _re.sub(r"<<<[^>\n]{0,60}>>>", "[delimiter removed]", body)
    body = body.replace("<<<", "[delimiter removed]")
    if tag == "USER_DATA":
        return f"{UNTRUSTED_OPEN}\n{body}\n{UNTRUSTED_CLOSE}"
    return f"<<<{tag}>>>\n{body}\n<<<END_{tag}>>>"


# ---------------------------------------------------------------------------
# numeric grounding
# ---------------------------------------------------------------------------
_NUM_RE = re.compile(r"-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?")


def extract_numbers(text: str) -> list[float]:
    out = []
    for m in _NUM_RE.findall(text or ""):
        try:
            out.append(float(m))
        except ValueError:
            continue
    return out


def _payload_numbers(obj, acc: list[float]) -> None:
    if isinstance(obj, dict):
        for v in obj.values():
            _payload_numbers(v, acc)
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            _payload_numbers(v, acc)
    elif isinstance(obj, bool):
        return
    elif isinstance(obj, (int, float)):
        acc.append(float(obj))
    elif isinstance(obj, str):
        # pick numbers embedded in strings too (e.g. "50.7 g")
        acc.extend(extract_numbers(obj))


def _close(x: float, a: float, rel_tol: float) -> bool:
    if a == 0 and x == 0:
        return True
    denom = max(abs(a), 1e-9)
    return abs(x - a) / denom <= rel_tol


def grounded(text: str, payload: dict, rel_tol: float = 0.03) -> tuple[bool, list[float]]:
    """True if every substantive number in `text` exists in `payload`.

    Accepts ordinary rounding, unit-free percent forms of fractions
    (payload 0.0098 -> text "0.98%"), and small integers 0..12 as counts/labels.
    Returns (ok, ungrounded_numbers).
    """
    allowed: list[float] = []
    _payload_numbers(payload, allowed)
    bad: list[float] = []
    for x in extract_numbers(text):
        if abs(x) <= 12 and float(x).is_integer():
            continue
        ok = False
        for a in allowed:
            if _close(x, a, rel_tol) or _close(x, a * 100.0, rel_tol) or _close(x * 100.0, a, rel_tol):
                ok = True
                break
        if not ok:
            bad.append(x)
    return (len(bad) == 0, bad)


# ---------------------------------------------------------------------------
# number grounding (used by the product advice/brief guards)
# ---------------------------------------------------------------------------



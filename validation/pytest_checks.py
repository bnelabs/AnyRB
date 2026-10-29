"""pytest wrappers for the AnyRB independent validation suite.

The authoritative, standalone runner is `validation/run_validation.py`. These wrappers are for CI:
they reuse its `results.json` (running the suite once if absent) and assert that no *unexplained*
FAIL exists. Known engine defects are listed explicitly in `KNOWN_OPEN` so that CI stays green
while the defect is tracked — deleting an entry from `KNOWN_OPEN` without fixing the engine makes
the test fail, which is the intended ratchet.

Run:
    cd AnyRB && .venv/bin/python -m pytest validation/pytest_checks.py -q
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
RESULTS = HERE / "results.json"

# Open engine defects found by this validation. Remove an entry only when the engine is fixed.
KNOWN_OPEN: dict[str, str] = {}  # F2b fixed & re-verified (2026-10-29); add new tracked defects here
# Documented WARNs that are acceptable as long as they are reported (not silently passing).
EXPECTED_WARNS = {"F4"}


@pytest.fixture(scope="session")
def results() -> dict:
    if not RESULTS.exists():
        subprocess.run([sys.executable, str(HERE / "run_validation.py")],
                       cwd=str(HERE.parent), check=False)
    if not RESULTS.exists():
        pytest.skip("validation/results.json could not be produced")
    return json.loads(RESULTS.read_text())


def _by_id(results: dict) -> dict:
    return {c["id"]: c for c in results["checks"]}


def test_suite_size(results):
    assert results["summary"]["total"] >= 40, "validation suite unexpectedly small"


def test_no_unexplained_failures(results):
    bad = [c for c in results["checks"] if c["status"] == "FAIL" and c["id"] not in KNOWN_OPEN]
    assert not bad, "unexplained FAIL(s): " + ", ".join(f"{c['id']} ({c['observed']})" for c in bad)


def test_known_open_defects_still_fail(results):
    """Ratchet: if a known defect is fixed, remove it from KNOWN_OPEN (and celebrate)."""
    by_id = _by_id(results)
    for cid in KNOWN_OPEN:
        status = by_id[cid]["status"] if cid in by_id else "MISSING"
        assert status == "FAIL", (
            f"{cid} is listed as a known-open defect but now reports {status}; "
            "update KNOWN_OPEN and re-run the suite")


def test_warns_are_documented(results):
    warns = {c["id"] for c in results["checks"] if c["status"] == "WARN"}
    assert warns <= EXPECTED_WARNS, f"unexpected WARN(s): {sorted(warns - EXPECTED_WARNS)}"


def test_core_code_verification_passes(results):
    by_id = _by_id(results)
    core = ["A1", "A2", "A4", "A5", "A6", "B-uniform", "B-graded",
            "C1", "C2", "C3", "C5", "D2", "E1", "E4", "H2", "H3", "H4"]
    bad = [cid for cid in core if cid not in by_id or by_id[cid]["status"] != "PASS"]
    assert not bad, f"core verification checks not PASS: {bad}"


def test_fixture_is_byte_identical(results):
    assert _by_id(results)["H2"]["status"] == "PASS"


def test_exit_code_matches_status(results):
    expected = 0 if results["summary"]["FAIL"] == 0 else 1
    assert results["summary"]["exit_code"] == expected

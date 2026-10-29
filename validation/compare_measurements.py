#!/usr/bin/env python3
"""Compare measured coupon/bracket test data against the frozen AnyRB predictions.

The predictions and acceptance criteria live in `coupon_predictions.json` and are
pre-registered (SHA-256) before any test.  This utility is intentionally simple:
it reads a measurement CSV, reports prediction errors and pass/fail against the
pre-registered acceptance criteria, and never edits the pre-registration.

Usage
-----
    # write a blank CSV template for the test engineer
    python validation/compare_measurements.py --template measurements_template.csv

    # compare measured data
    python validation/compare_measurements.py measurements.csv --out comparison.json

CSV columns (header required, order irrelevant):
    specimen_id,specimen_type,lot_id,build_orientation,measured_tip_stiffness_N_per_mm,measured_first_yield_load_N,notes

`specimen_type` must be one of the specimen keys in coupon_predictions.json
(e.g. coupon_3x2, bracket_7x3_robust).  Missing measurements are allowed (blank)
and are reported as SKIP for that metric.  No measured data are bundled here; the
template is blank by design.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_PREDICTIONS = HERE / "coupon_predictions.json"
TEMPLATE_COLUMNS = ["specimen_id", "specimen_type", "lot_id", "build_orientation",
                    "measured_tip_stiffness_N_per_mm", "measured_first_yield_load_N", "notes"]


def load_predictions(path: Path) -> dict:
    pred = json.loads(path.read_text())
    if "pre_registration_hash" not in pred:
        raise SystemExit(f"{path} has no pre_registration_hash; is it a pre-registration file?")
    return pred


def write_template(path: Path) -> None:
    with path.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(TEMPLATE_COLUMNS)
        for stype in ("coupon_3x2", "bracket_7x3_robust"):
            w.writerow([f"{stype}-000", stype, "LOT-000", "XY", "", "", "replace with measured values"])
    print(f"wrote blank template {path} (no data fabricated: fill from the test record)")


def _rel(got: float, exp: float) -> float:
    return (got - exp) / exp if exp else float("nan")


def compare(pred_path: Path, csv_path: Path) -> dict:
    pred = load_predictions(pred_path)
    specimens = pred["specimens"]
    rows = []
    with csv_path.open(newline="") as f:
        reader = csv.DictReader(f)
        missing = [c for c in TEMPLATE_COLUMNS if c not in reader.fieldnames]
        if missing:
            raise SystemExit(f"CSV is missing columns: {missing}")
        for raw in reader:
            rows.append(raw)
    out_rows = []
    for raw in rows:
        stype = raw["specimen_type"].strip()
        if stype not in specimens:
            out_rows.append({**{k: raw.get(k) for k in TEMPLATE_COLUMNS}, "status": "FAIL",
                             "detail": f"unknown specimen_type {stype!r}"})
            continue
        spec = specimens[stype]
        predicted = spec["predicted"]
        acc = spec.get("uncertainty", {}).get("acceptance_band", {})
        k_band = acc.get("tip_stiffness_relative", [-0.25, 0.25])
        f_band = acc.get("first_yield_load_relative", [-0.25, 0.35])
        detail = []
        status = "PASS"
        rec = {"specimen_id": raw["specimen_id"], "specimen_type": stype,
               "lot_id": raw["lot_id"], "build_orientation": raw["build_orientation"]}
        k_meas = raw["measured_tip_stiffness_N_per_mm"].strip()
        f_meas = raw["measured_first_yield_load_N"].strip()
        if k_meas:
            k_p = predicted["tip_stiffness_N_per_mm"]
            e = _rel(float(k_meas), k_p)
            ok = (k_band[0] <= e <= k_band[1])
            rec.update({"measured_tip_stiffness_N_per_mm": float(k_meas),
                        "predicted_tip_stiffness_N_per_mm": k_p,
                        "tip_stiffness_rel_error": e,
                        "tip_stiffness_status": "PASS" if ok else "FAIL"})
            detail.append(f"stiffness rel err {e:+.1%} (band {k_band[0]:+.0%}..{k_band[1]:+.0%})")
            if not ok:
                status = "FAIL"
        else:
            rec["tip_stiffness_status"] = "SKIP"; detail.append("stiffness: no measurement")
        if f_meas:
            f_p = predicted["first_yield_load_N"]
            e = _rel(float(f_meas), f_p)
            ok = (f_band[0] <= e <= f_band[1])
            rec.update({"measured_first_yield_load_N": float(f_meas),
                        "predicted_first_yield_load_N": f_p,
                        "first_yield_rel_error": e,
                        "first_yield_status": "PASS" if ok else "FAIL"})
            detail.append(f"first-yield rel err {e:+.1%} (band {f_band[0]:+.0%}..{f_band[1]:+.0%})")
            if not ok:
                status = "FAIL"
        else:
            rec["first_yield_status"] = "SKIP"; detail.append("first-yield: no measurement")
        if status == "PASS" and rec.get("tip_stiffness_status") == "SKIP" and rec.get("first_yield_status") == "SKIP":
            status = "WARN"
        rec["status"] = status
        rec["detail"] = "; ".join(detail)
        out_rows.append(rec)
    counts = {s: sum(1 for r in out_rows if r["status"] == s) for s in ("PASS", "WARN", "FAIL")}
    return {
        "pre_registration_hash": pred["pre_registration_hash"],
        "suite": pred.get("suite", "AnyRB pre-registration"),
        "csv": str(csv_path),
        "summary": {"n": len(out_rows), **counts},
        "acceptance_bands": {s: {"tip_stiffness_relative": s2.get("uncertainty", {}).get("acceptance_band", {}).get("tip_stiffness_relative"),
                                 "first_yield_load_relative": s2.get("uncertainty", {}).get("acceptance_band", {}).get("first_yield_load_relative")}
                             for s, s2 in specimens.items()},
        "rows": out_rows,
        "note": "Comparison against a pre-registered blind prediction. A FAIL is a validation finding "
                "to be reported with its discrepancy; do not edit the pre-registration or the frozen "
                "predictions after seeing measurements.",
    }


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("csv", nargs="?", help="measurement CSV (see --template)")
    ap.add_argument("--predictions", default=str(DEFAULT_PREDICTIONS))
    ap.add_argument("--template", metavar="PATH", help="write a blank measurement CSV template and exit")
    ap.add_argument("--out", metavar="PATH", help="write comparison JSON to PATH")
    args = ap.parse_args(argv)
    if args.template:
        write_template(Path(args.template)); return 0
    if not args.csv:
        ap.error("provide a measurement CSV or --template PATH")
    result = compare(Path(args.predictions), Path(args.csv))
    print(f"pre-registration: {result['pre_registration_hash']}")
    print(f"rows: {result['summary']['n']}  PASS {result['summary']['PASS']}  "
          f"WARN {result['summary']['WARN']}  FAIL {result['summary']['FAIL']}")
    for r in result["rows"]:
        print(f"  [{r['status']:4s}] {r.get('specimen_id','?')} ({r.get('specimen_type','?')}): {r.get('detail','')}")
    if args.out:
        Path(args.out).write_text(json.dumps(result, indent=1))
        print(f"wrote {args.out}")
    return 0 if result["summary"]["FAIL"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())

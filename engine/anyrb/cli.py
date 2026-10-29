"""AnyRB command line interface.

Usage
-----
    python -m anyrb.cli compare  --material rpetg --target 0.01
    python -m anyrb.cli demo     --material rpetg --target 0.01 --out ../reports
    python -m anyrb.cli fixtures
    python -m anyrb.cli sweep    --material rpetg
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys

from .materials import PRESETS, get_material
from .optimize import compare_strategies, batch_recipe, pareto_curve
from .report import build_report
from .reliability import sensitivity
from .mechanics import evaluate


def _print_comparison(res: dict) -> None:
    print(f"{'strategy':<26}{'mass (g)':>10}{'P_f':>12}{'sigma_req':>12}"
          f"{'E_req':>10}{'u_tip':>9}")
    print("-" * 79)
    for k in ("solid", "uniform", "uniform_match", "nominal_sf15",
              "mean_only", "robust"):
        r = res.get(k)
        if r is None:
            continue
        print(f"{k:<26}{r.mass_g:>10.2f}{r.pf:>12.5f}{r.sigma_req_MPa:>12.2f}"
              f"{r.E_req_MPa:>10.1f}{r.u_tip_mean_mm:>9.3f}")
    print(f"\ntarget P_f = {res['target_pf']:.3g}")


def cmd_compare(args) -> int:
    mat = get_material(args.material)
    res = compare_strategies(mat, args.target)
    _print_comparison(res)
    return 0


def cmd_demo(args) -> int:
    mat = get_material(args.material)
    out = args.out or os.path.join(os.path.dirname(__file__), "..", "..", "..", "reports")
    summary = build_report(mat, target_pf=args.target, out_dir=os.path.abspath(out),
                           n_mc=args.mc, make_pareto=not args.fast)
    print(json.dumps({k: summary[k] for k in
                      ("target_pf", "pf_mc", "robust", "stl")}, indent=2)[:2000])
    return 0


def cmd_fixtures(args) -> int:
    here = os.path.dirname(os.path.abspath(__file__))
    script = os.path.join(here, "..", "make_fixtures.py")
    print(f"running {os.path.normpath(script)}")
    return subprocess.call([sys.executable, script])


def cmd_sweep(args) -> int:
    mat = get_material(args.material)
    print("material CV sweep (uniform 2.0 mm design):")
    base = evaluate(mat, [0.6931] * 8)
    print(f"  base: mass {base['mass_g']:.1f} g  P_f {base['pf']:.4f}  "
          f"sigma_req {base['sigma_req_MPa']:.2f}  E_req {base['E_req_MPa']:.1f}")
    import dataclasses
    for f in (0.5, 0.75, 1.0, 1.5, 2.0):
        m = dataclasses.replace(mat, E_cv=mat.E_cv * f, sy_cv=mat.sy_cv * f)
        r = evaluate(m, [0.6931] * 8)
        print(f"  CV x{f:<4}: P_f {r['pf']:.4f}  (E_req {r['E_req_MPa']:.0f})")
    s = sensitivity(mat, base["sigma_req_MPa"], base["E_req_MPa"])
    print("\nsensitivity:", {k: round(v, 4) for k, v in s.items()})
    return 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="anyrb", description=__doc__)
    sub = p.add_subparsers(dest="cmd", required=True)

    pc = sub.add_parser("compare", help="compare design strategies")
    pc.add_argument("--material", default="rpetg", choices=list(PRESETS))
    pc.add_argument("--target", type=float, default=0.01)
    pc.set_defaults(func=cmd_compare)

    pd = sub.add_parser("demo", help="build the virtual qualification report + STL")
    pd.add_argument("--material", default="rpetg", choices=list(PRESETS))
    pd.add_argument("--target", type=float, default=0.01)
    pd.add_argument("--mc", type=int, default=60000)
    pd.add_argument("--out", default=None)
    pd.add_argument("--fast", action="store_true", help="skip the Pareto sweep")
    pd.set_defaults(func=cmd_demo)

    pf = sub.add_parser("fixtures", help="regenerate JS reference fixtures")
    pf.set_defaults(func=cmd_fixtures)

    ps = sub.add_parser("sweep", help="feedstock CV sensitivity sweep")
    ps.add_argument("--material", default="rpetg", choices=list(PRESETS))
    ps.set_defaults(func=cmd_sweep)

    args = p.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())

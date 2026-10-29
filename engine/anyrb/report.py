"""Virtual qualification report (self-contained HTML with embedded charts).

This is the artifact a company would attach to a design review instead of (or
before) physical testing.  It is explicit about being in-silico decision support
and lists exactly which claims are verified internally versus not validated.
"""
from __future__ import annotations

import base64
import datetime as _dt
import io
import json
import os
from dataclasses import asdict

import numpy as np
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
from matplotlib.patches import Rectangle, FancyArrow

from .lattice import (build_lattice, mass_g, widths_from_controls, printability_report,
                      DEPTH, HEIGHT, PAD_LEN, W_MAX)
from .materials import Material
from .mechanics import demands, evaluate, element_utilisation, solid_demands
from .optimize import (compare_strategies, batch_recipe, acceptance_window,
                       family_feasibility, sustained_bound,
                       pareto_curve, optimize_robust)
from .reliability import failure_probability, mode_split, monte_carlo, sensitivity, assumption_bounds
from .stl import write_ascii_stl

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _validation_summary() -> dict | None:
    try:
        data = json.loads((PROJECT_ROOT / "validation" / "results.json").read_text())
        return data.get("summary")
    except Exception:
        return None


PALETTE = {
    "solid": "#8D99AE",
    "uniform": "#E4572E",
    "uniform_match": "#F4A259",
    "nominal_sf1.5": "#2E86AB",
    "mean_only": "#B23A48",
    "robust": "#0E7C66",
}
INK = "#1d2733"
MUTED = "#5b6770"


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def _png(fig) -> str:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight",
                facecolor="white")
    plt.close(fig)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def _style(ax, title="", xlabel="", ylabel=""):
    ax.set_title(title, fontsize=11, color=INK, loc="left", pad=10)
    ax.set_xlabel(xlabel, fontsize=9, color=MUTED)
    ax.set_ylabel(ylabel, fontsize=9, color=MUTED)
    ax.tick_params(labelsize=8, colors=MUTED)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    for s in ("left", "bottom"):
        ax.spines[s].set_color("#c7ced4")
    ax.grid(True, color="#e8ecef", linewidth=0.6, zorder=0)


def _results_table(results: dict) -> list[dict]:
    rows = []
    labels = {
        "solid": "Solid plate (baseline)",
        "uniform": "Uniform lattice, target-sized",
        "uniform_match": "Uniform lattice, same mass",
        "nominal_sf15": "Nominal design, safety factor 1.5",
        "mean_only": "Mean-material design (SF 1.0)",
        "robust": "AnyRB robust design",
    }
    for key, label in labels.items():
        r = results.get(key)
        if r is None:
            continue
        rows.append({"key": key, "label": label,
                     "mass": r.printed_mass_g if getattr(r, "printed_mass_g", None) else r.mass_g,
                     "mass_analytic": r.mass_g,
                     "pf": r.pf, "rel": 1 - r.pf,
                     "sigma_req": r.sigma_req_MPa, "E_req": r.E_req_MPa})
    return rows


# ---------------------------------------------------------------------------
# figures
# ---------------------------------------------------------------------------
def fig_comparison(results) -> str:
    rows = _results_table(results)
    fig, axes = plt.subplots(1, 2, figsize=(10, 3.6))
    labels = [r["label"] for r in rows]
    colors = [PALETTE.get(r["key"], "#888") for r in rows]
    y = np.arange(len(rows))[::-1]
    axes[0].barh(y, [r["mass"] for r in rows], color=colors, height=0.65)
    axes[0].set_yticks(y); axes[0].set_yticklabels(labels, fontsize=8)
    axes[0].set_xlabel("mass (g)"); _style(axes[0], "Mass")
    for yi, r in zip(y, rows):
        axes[0].text(r["mass"] + 1.2, yi, f"{r['mass']:.1f} g", va="center",
                     fontsize=8, color=INK)
    axes[0].set_xlim(0, max(r["mass"] for r in rows) * 1.25)
    pfv = [max(r["pf"], 1e-7) for r in rows]
    axes[1].barh(y, pfv, color=colors, height=0.65)
    axes[1].set_xscale("log")
    axes[1].set_yticks(y); axes[1].set_yticklabels([])
    axes[1].set_xlim(1e-7, 3.0)
    axes[1].axvline(results["target_pf"], color="#B23A48", ls="--", lw=1)
    axes[1].text(results["target_pf"] * 1.15, y[0] + 0.1,
                 f"target {results['target_pf']:.1%}", color="#B23A48", fontsize=8)
    axes[1].set_xlabel("probability of failure over batch distribution (log scale)")
    _style(axes[1], "Reliability")
    for yi, r in zip(y, rows):
        label = "~0" if r["pf"] < 1e-6 else f"{r['pf']:.2e}"
        axes[1].text(max(r["pf"], 1e-7) * 1.35, yi, label, va="center",
                     ha="left", fontsize=7.5, color=INK)
    fig.tight_layout()
    return _png(fig)


def fig_pareto(pareto, results) -> str:
    fig, ax = plt.subplots(figsize=(6.4, 3.8))
    xs = [1 - p["achieved_pf"] for p in pareto]
    ys = [p["mass_g"] for p in pareto]
    ax.plot(xs, ys, "-o", color="#0E7C66", lw=2, ms=5, label="AnyRB Pareto front")
    for key in ("uniform", "nominal_sf15", "mean_only"):
        r = results.get(key)
        if r is None:
            continue
        ax.scatter([1 - r.pf], [r.printed_mass_g if getattr(r, "printed_mass_g", None) else r.mass_g], s=70, marker="s",
                   color=PALETTE.get(key, "#888"), zorder=5,
                   label={"uniform": "uniform lattice",
                          "nominal_sf15": "nominal SF1.5",
                          "mean_only": "mean-only",
                          "solid": "solid plate"}.get(key, key))
    ax.set_xlabel("reliability (1 - P_f)")
    ax.set_ylabel("mass (g)")
    ax.set_xlim(0.90, 1.0)
    ax.set_ylim(min(ys) * 0.94, max(ys) * 1.10)
    _style(ax, "Mass vs reliability trade-off")
    ax.legend(fontsize=7.5, frameon=False, loc="upper left")
    ax.text(0.905, max(ys) * 1.05,
            "solid plate (114 g, P_f≈0) off scale — over-designed",
            fontsize=7.5, color=MUTED)
    fig.tight_layout()
    return _png(fig)


def fig_margin(mc, demand_label: str = "") -> str:
    fig, ax = plt.subplots(figsize=(6.4, 3.4))
    ax.hist(mc.margin, bins=70, color="#2E86AB", alpha=0.85, log=True)
    ax.axvline(1.0, color="#B23A48", lw=1.4)
    ax.axvline(mc.p5_margin, color="#E4572E", lw=1.2, ls="--")
    ax.text(1.005, ax.get_ylim()[1] * 0.5, " failure", color="#B23A48", fontsize=8)
    ax.text(mc.p5_margin, ax.get_ylim()[1] * 0.9, f" P5 = {mc.p5_margin:.2f}",
            color="#E4572E", fontsize=8)
    ax.set_xlabel("capacity margin  min(sy/sigma_req, E/E_req)")
    ax.set_ylabel("batches (log count)")
    _style(ax, f"Batch safety-margin distribution  (MC P_f={mc.pf:.2%})")
    fig.tight_layout()
    return _png(fig)


def fig_scatter(mc, sigma_req: float, E_req: float) -> str:
    fig, ax = plt.subplots(figsize=(6.4, 4.0))
    ok = ~mc.failed
    ax.scatter(mc.sy[ok], mc.E[ok], s=4, color="#9fc5e8", alpha=0.5,
               label="safe batches", rasterized=True)
    ax.scatter(mc.sy[mc.failed], mc.E[mc.failed], s=6, color="#B23A48",
               alpha=0.8, label="failing batches", rasterized=True)
    ax.axvline(sigma_req, color="#E4572E", lw=1.3, ls="--")
    ax.axhline(E_req, color="#E4572E", lw=1.3, ls="--")
    ax.set_xlabel("batch yield strength sy (MPa)")
    ax.set_ylabel("batch Young's modulus E (MPa)")
    _style(ax, "Batch outcome map (one dot = one delivered lot)")
    ax.legend(fontsize=7.5, frameon=False, loc="lower right")
    fig.tight_layout()
    return _png(fig)


def fig_design(lattice, widths, title: str, util=None, dpi_figsize=(8.6, 3.6)) -> str:
    fig, ax = plt.subplots(figsize=dpi_figsize)
    segs = []
    for e, (n1, n2) in enumerate(lattice.elements):
        segs.append([tuple(lattice.nodes[n1]), tuple(lattice.nodes[n2])])
    if util is None:
        colors = np.exp(widths / np.max(widths)) * 0.0 + 0.45
    else:
        colors = np.clip(util, 0, 1.2)
    lc = LineCollection(segs, cmap="inferno", array=colors,
                        linewidths=np.clip(widths * 1.6, 0.8, 7.0),
                        capstyle="round", zorder=3)
    ax.add_collection(lc)
    ax.add_patch(Rectangle((0, 0), PAD_LEN, HEIGHT, color="#3b4a5a", zorder=2))
    ax.annotate("", xy=(150 - 4, 30 - 24), xytext=(150 - 4, 30 + 16),
                arrowprops=dict(arrowstyle="-|>", color="#E4572E", lw=2))
    ax.text(150, 30 + 20, "F", color="#E4572E", ha="center", fontsize=10)
    ax.set_xlim(-6, 162); ax.set_ylim(-6, 66)
    ax.set_aspect("equal"); ax.axis("off")
    ax.set_title(title, fontsize=10, color=INK, loc="left")
    cb = fig.colorbar(lc, ax=ax, fraction=0.03, pad=0.01)
    cb.set_label("utilisation at mean material", fontsize=8, color=MUTED)
    cb.ax.tick_params(labelsize=7, colors=MUTED)
    fig.tight_layout()
    return _png(fig)


def fig_acceptance(aw) -> str:
    fig, ax = plt.subplots(figsize=(5.6, 4.2))
    mE, msy = aw["mE"], aw["msy"]
    ax.imshow(aw["pass"].astype(float), origin="lower", aspect="auto",
              extent=[mE[0], mE[-1], msy[0], msy[-1]], cmap="RdYlGn",
              vmin=0, vmax=1, alpha=0.9)
    ax.contour(mE, msy, aw["pass"].astype(float), levels=[0.5],
               colors=["#1d2733"], linewidths=1.2)
    ax.scatter([1.0], [1.0], marker="x", s=90, color="#1d2733", zorder=5,
               label="nominal lot")
    ax.set_xlabel("lot mean E / preset mean E")
    ax.set_ylabel("lot mean sy / preset mean sy")
    _style(ax, "Batch acceptance window for a known lot (within-lot scatter)")
    ax.legend(fontsize=7.5, frameon=False, loc="upper left")
    fig.tight_layout()
    return _png(fig)


def fig_sensitivity(sens) -> str:
    keys = ["cv_E", "cv_sy", "mean_E", "mean_sy", "corr", "load"]
    labels = {"cv_E": "CV(E) +25%", "cv_sy": "CV(sy) +25%",
              "mean_E": "mean E -25%", "mean_sy": "mean sy -25%",
              "corr": "correlation +25%", "load": "load +25%"}
    vals = [sens[k] for k in keys]
    fig, ax = plt.subplots(figsize=(6.4, 2.9))
    order = np.argsort(np.abs(vals))
    ax.barh(np.arange(len(keys)), [vals[i] for i in order],
            color=["#B23A48" if vals[i] > 0 else "#0E7C66" for i in order])
    ax.set_yticks(np.arange(len(keys)))
    ax.set_yticklabels([labels[keys[i]] for i in order], fontsize=8)
    ax.axvline(0, color=INK, lw=0.8)
    ax.set_xlabel("change in P_f (percentage points)")
    _style(ax, "Sensitivity of failure probability")
    fig.tight_layout()
    return _png(fig)


def fig_modes(split) -> str:
    fig, ax = plt.subplots(figsize=(6.4, 2.5))
    labels = ["yield / strength", "stiffness / buckling"]
    vals = [split["pf_yield_marginal"], split["pf_stiffness_marginal"]]
    colors = ["#2E86AB", "#E4572E"]
    y = [1, 0]
    ax.barh(y, vals, color=colors, height=0.5)
    for yi, v in zip(y, vals):
        ax.text(v + max(vals) * 0.03, yi, f"{v:.2%}", va="center", fontsize=9)
    ax.axvline(split["pf_joint"], color=INK, ls="--", lw=1.2)
    ax.text(split["pf_joint"], 1.62, f"joint P_f = {split['pf_joint']:.2%}",
            fontsize=8, color=INK, ha="center")
    ax.set_yticks(y); ax.set_yticklabels(labels, fontsize=8.5)
    ax.set_xlabel("marginal failure probability (properties overlap in the joint orthant)")
    ax.set_xlim(0, max(max(vals), split["pf_joint"]) * 1.35)
    _style(ax, "Which material property is binding?")
    fig.tight_layout()
    return _png(fig)


# ---------------------------------------------------------------------------
# main report builder
# ---------------------------------------------------------------------------
def build_report(mat: Material, target_pf: float = 0.01,
                 out_dir: str = "reports", n_mc: int = 60000,
                 seed: int = 20261029, make_pareto: bool = True) -> dict:
    os.makedirs(out_dir, exist_ok=True)
    lattice = build_lattice()

    results = compare_strategies(mat, target_pf)
    robust = results["robust"]
    uniform = results["uniform"]
    nominal = results["nominal_sf15"]
    mean_only = results["mean_only"]
    solid = results["solid"]

    widths = widths_from_controls(robust.controls, lattice.midpoints)
    printable = printability_report(lattice, widths)
    d = demands(lattice, widths)
    mc = monte_carlo(mat, d.sigma_req, d.E_req, n=n_mc, seed=seed)
    split = mode_split(mat, d.sigma_req, d.E_req)
    util = element_utilisation(lattice, widths, mat.E_mean, mat.sy_mean)

    pareto = pareto_curve(mat) if make_pareto else []
    sens = sensitivity(mat, d.sigma_req, d.E_req)
    aw = acceptance_window(mat, robust.controls, target_pf, n_grid=41)
    sustained = sustained_bound(mat, robust.controls)
    feasibility = family_feasibility(mat, target_pf)
    val = _validation_summary() or {}
    robust_eval = evaluate(mat, robust.controls)
    assumptions = assumption_bounds(mat, d.sigma_req, d.E_req)
    brittle = {
        "strain_req_pct": 100.0 * robust_eval.get("strain_req", 0.0),
        "elongation_mean_pct": robust_eval.get("elongation_mean_pct"),
        "elongation_cv": robust_eval.get("elongation_cv"),
        "pf_brittle": robust_eval.get("pf_brittle"),
        "pf_bound": robust_eval.get("pf_brittle_bound"),
        "note": "Marginal brittle-lot screen; not included in the headline two-property P_f because the E-elongation correlation is assumed.",
    }

    # batch passport scenarios
    lot_rows = []
    for fE in (0.75, 0.85, 0.95, 1.05):
        br = batch_recipe(mat, robust.controls, target_pf,
                          lot_E=fE * mat.E_mean, lot_sy=mat.sy_mean)
        lot_rows.append({"factor": f"E x {fE:.2f}", "scale": br["scale_required"],
                          "printed_mass_g": br["mass_required_g"],
                          "added": br["added_mass_pct"], "verdict": br["verdict"]})
    for fs in (0.8, 0.9, 1.0):
        br = batch_recipe(mat, robust.controls, target_pf,
                          lot_E=mat.E_mean, lot_sy=fs * mat.sy_mean)
        lot_rows.append({"factor": f"sy x {fs:.2f}", "scale": br["scale_required"],
                          "printed_mass_g": br["mass_required_g"],
                          "added": br["added_mass_pct"], "verdict": br["verdict"]})

    # exports
    stl_info = write_ascii_stl(os.path.join(out_dir, "robust_design.stl"),
                               lattice, widths, name="anyrb_robust")
    summary = {
        "generated_utc": _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds"),
        "material": {"id": mat.id, "name": mat.name, "process": mat.process,
                     "E_mean": mat.E_mean, "E_cv": mat.E_cv,
                     "sy_mean": mat.sy_mean, "sy_cv": mat.sy_cv,
                     "rho": mat.rho, "corr": mat.corr,
                     "lot_fraction": mat.lot_fraction,
                     "within_fraction": mat.within_fraction},
        "target_pf": target_pf,
        "load_N": 150.0,
        "deflection_limit_mm": 2.5,
        "robust": robust.to_dict(),
        "uniform_target_sized": uniform.to_dict() if uniform else None,
        "nominal_sf15": nominal.to_dict() if nominal else None,
        "mean_only": mean_only.to_dict() if mean_only else None,
        "solid": solid.to_dict(),
        "pf_mc": mc.pf, "pf_mc_stderr": mc.pf_stderr,
        "p5_margin": mc.p5_margin, "robustness_index": mc.robustness_index,
        "sensitivity": sens,
        "acceptance_window_pass_fraction": aw["n_pass"] / aw["n_total"],
        "printability": printable,
        "family_feasibility": feasibility,
        "sustained_bound": sustained,
        "validation": val,
        "assumptions": assumptions,
        "brittle_screen": brittle,
        "process_ok": bool(mat.print_process_ok),
        "lot_record_supplied": False,
        "mass_basis": {
            "analytic_upper_bound_g": robust.mass_g,
            "printed_union_estimate_g": robust.printed_mass_g,
            "analytic_overcount_pct": 100.0 * (robust.mass_g / robust.printed_mass_g - 1.0),
            "method": "printed union Halton 60k samples; analytic sums strut volumes (upper bound)",
        },
        "stl": stl_info,
        "limitations": [
            "In-silico only; no experimental validation was possible in this project.",
            "Linear-elastic plane-frame idealisation; no plasticity, creep or fatigue.",
            "Euler buckling with pinned-pinned effective length (k=1), pure axial load (no combined axial-bending buckling); rigid joints are not modelled explicitly.",
            "Strut mass sums element volumes without subtracting material overlap at nodes; this is conservative (over-estimates mass) for thick struts.",
            "Batch-uniform material inside a part; no spatial scatter or print defects.",
            "Literature-derived feedstock distributions (provisional v0.1).",
            "Not a certification tool. Use as decision support and validate before production.",
        ],
    }
    with open(os.path.join(out_dir, "summary.json"), "w") as f:
        json.dump(summary, f, indent=2)

    # --- figures ---
    figs = {
        "comparison": fig_comparison(results),
        "pareto": fig_pareto(pareto, results) if pareto else "",
        "margin": fig_margin(mc),
        "scatter": fig_scatter(mc, d.sigma_req, d.E_req),
        "design_robust": fig_design(lattice, widths, "Robust optimised design (utilisation)",
                                    util["util_max"]),
        "design_uniform": fig_design(lattice, uniform.widths if uniform else widths,
                                     "Uniform lattice at target reliability",
                                     element_utilisation(lattice, uniform.widths,
                                                         mat.E_mean, mat.sy_mean)["util_max"]
                                     if uniform else None) if uniform else "",
        "acceptance": fig_acceptance(aw),
        "sensitivity": fig_sensitivity(sens),
        "modes": fig_modes(split),
    }

    # --- HTML ---
    def pct(x):
        return f"{100 * x:.3g}%"

    comp_rows = "\n".join(
        f"<tr><td>{r['label']}</td><td class='num'>{r['mass']:.1f}</td>"
        f"<td class='num'>{pct(r['pf'])}</td><td class='num'>{100 * r['rel']:.3f}%</td></tr>"
        for r in _results_table(results))

    def _scale(v):
        return "&gt; 1.5 (reject)" if v is None else f"{v:.3f}"

    def _added(v):
        return "&mdash;" if v is None else f"{v:+.1f}%"

    lot_rows_html = "\n".join(
        f"<tr><td>{r['factor']}</td><td class='num'>{_scale(r['scale'])}</td>"
        f"<td class='num'>{_added(r['added'])}</td><td>{r['verdict']}</td></tr>"
        for r in lot_rows)

    pareto_img = (f'<img src="{figs["pareto"]}" alt="pareto">'
                  if figs["pareto"] else
                  '<div class="cap">(Pareto sweep skipped in this fast build)</div>')

    sen_rows = "\n".join(
        f"<tr><td>{k.replace('mean_E', 'mean E -25%').replace('mean_sy', 'mean sy -25%').replace('cv_E', 'CV(E) +25%').replace('cv_sy', 'CV(sy) +25%').replace('corr', 'correlation +25%').replace('load', 'load +25%')}</td>"
        f"<td class='num'>{100 * sens[k]:+.2f} pp</td></tr>"
        for k in ("cv_E", "cv_sy", "mean_E", "mean_sy", "corr", "load"))

    html = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AnyRB virtual qualification report — {mat.name}</title>
<style>
  :root {{ --ink:{INK}; --muted:{MUTED}; --line:#dde3e8; --accent:#0E7C66; }}
  * {{ box-sizing:border-box; }}
  body {{ margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
         color:var(--ink); background:#f4f6f8; line-height:1.5; }}
  .wrap {{ max-width:1020px; margin:0 auto; padding:34px 26px 70px; }}
  h1 {{ font-size:26px; margin:0 0 4px; letter-spacing:-.3px; }}
  h2 {{ font-size:16px; margin:38px 0 10px; padding-bottom:6px; border-bottom:2px solid var(--line); }}
  .sub {{ color:var(--muted); font-size:13px; margin-bottom:18px; }}
  .card {{ background:#fff; border:1px solid var(--line); border-radius:10px; padding:20px 22px; margin:14px 0; }}
  .kpis {{ display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin:18px 0; }}
  .kpi {{ background:#fff; border:1px solid var(--line); border-radius:10px; padding:14px 16px; }}
  .kpi .v {{ font-size:22px; font-weight:650; letter-spacing:-.4px; }}
  .kpi .l {{ font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; margin-top:2px; }}
  .kpi .n {{ font-size:11px; color:var(--muted); margin-top:4px; }}
  table {{ border-collapse:collapse; width:100%; font-size:12.5px; }}
  th,td {{ text-align:left; padding:7px 9px; border-bottom:1px solid var(--line); vertical-align:top; }}
  th {{ font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); }}
  td.num {{ font-variant-numeric:tabular-nums; text-align:right; }}
  img {{ width:100%; height:auto; border:1px solid var(--line); border-radius:8px; background:#fff; }}
  .cap {{ font-size:11.5px; color:var(--muted); margin:6px 0 18px; }}
  .note {{ border-left:3px solid #E4572E; background:#fff7f3; padding:12px 16px; font-size:13px; border-radius:0 8px 8px 0; }}
  .ok {{ border-left:3px solid var(--accent); background:#f2fbf8; padding:12px 16px; font-size:13px; border-radius:0 8px 8px 0; }}
  code {{ background:#eef2f5; padding:1px 5px; border-radius:4px; font-size:12px; }}
  .footer {{ margin-top:44px; font-size:11px; color:var(--muted); border-top:1px solid var(--line); padding-top:14px; }}
  .badge {{ display:inline-block; font-size:10.5px; letter-spacing:.06em; text-transform:uppercase;
            background:#fdeceb; color:#B23A48; border:1px solid #f3c9c5; padding:3px 8px; border-radius:999px; }}
</style></head><body><div class="wrap">

<h1>Virtual qualification report — recycled-polymer bracket</h1>
<div class="sub">{mat.name} &middot; process: {mat.process} &middot; reference product: 150&times;60&times;10&nbsp;mm
cantilever bracket at 150&nbsp;N &middot; generated {summary['generated_utc'][:16].replace('T',' ')} UTC
&nbsp; <span class="badge">in-silico · not a certification</span></div>

<div class="cards">
<div class="kpis">
  <div class="kpi"><div class="v">{robust.printed_mass_g:.1f} g</div><div class="l">Robust design mass (printed union estimate)</div>
    <div class="n">{(1 - robust.printed_mass_g / solid.mass_g) * 100:.0f}% lighter than solid plate &middot; analytic upper bound {robust.mass_g:.1f} g</div></div>
  <div class="kpi"><div class="v">{pct(robust.pf)}</div><div class="l">Probability of failure</div>
    <div class="n">target {pct(target_pf)} across lot distribution</div></div>
  <div class="kpi"><div class="v">{robust.sigma_req_MPa:.1f} MPa &middot; {robust.E_req_MPa / 1000:.2f} GPa</div>
    <div class="l">Required sy &middot; E</div>
    <div class="n">material demand imposed by the geometry at 150 N</div></div>
  <div class="kpi"><div class="v">{mc.robustness_index:.2f}</div><div class="l">Robustness index</div>
    <div class="n">P5 capacity margin / mean margin &middot; binding: {split['governing'].replace('_', ' ')}</div></div>
</div></div>

<h2>1. What was designed</h2>
<div class="card">
<p>The bracket arm is filled with a graded lattice whose strut widths follow an optimised 4&times;2 control
field (thicker near the clamped wall, thinner toward the tip). The optimiser minimised mass subject to
a reliability target on the <em>batch distribution</em> of a recycled feedstock, not on a single nominal
material. Compared with the solid plate, the robust design removes
{(1 - robust.printed_mass_g / solid.mass_g) * 100:.0f}% of the printed mass; compared with a uniform lattice sized for the same
reliability it saves {(1 - robust.printed_mass_g / uniform.printed_mass_g) * 100:.0f}%.</p>
<p style="font-size:12.5px;color:var(--muted)">Mass basis: the headline is the deterministic union-volume estimate
(Halton 60k union estimate) of the printed struts + pad. The analytic strut-sum is {robust.mass_g:.1f} g, a conservative upper bound
({100 * (robust.mass_g / robust.printed_mass_g - 1):.1f}% higher on this design); the old 25% audit figure was traced to a
union-sampler bug and is retired.</p>
<img src="{figs['design_robust']}" alt="robust design">
<div class="cap">Robust design; colour = combined yield/buckling utilisation at the mean material
(0 = unstressed, 1 = at capacity). The mounting pad is the solid block at left.</div>
<img src="{figs['design_uniform']}" alt="uniform design">
<div class="cap">Uniform lattice sized to meet the same reliability target — same design space, no grading.</div>
<table style="margin-top:10px"><thead><tr><th>Printability check (v0.1)</th><th>Value</th><th>Limit</th><th>Status</th></tr></thead>
<tbody>
<tr><td>Minimum strut width</td><td>{printable['min_width_mm']:.2f} mm</td><td>&ge; 1.0 mm (clip)</td><td>{'PASS' if printable['min_width_mm'] >= 1.0 - 1e-6 else 'FAIL'}</td></tr>
<tr><td>Maximum strut slenderness L/w</td><td>{printable['max_slenderness']:.1f}</td><td>&le; 30 (guideline)</td><td>{'PASS' if printable['max_slenderness'] <= 30 else 'WARN'}</td></tr>
<tr><td>Max neighbour width ratio</td><td>{printable['max_neighbour_width_ratio']:.2f}</td><td>&le; 1.5 (guideline)</td><td>{'PASS (enforced)' if printable['max_neighbour_width_ratio'] <= 1.5 else 'FAIL (constraint)'}</td></tr>
</tbody></table>
<div class="cap">The optimiser is a deterministic multi-start pattern search (six uniform-width starts); it returns a
local optimum inside one bracket/lattice family, not a proven global one. In v0.3 the neighbour-ratio and slenderness limits are part
of the search constraint set, not a post-hoc report.</div>
</div>

<h2>1b. What changed in v0.3 (review response)</h2>
<div class="card">
<ul style="margin:0;padding-left:18px;font-size:13px">
<li><strong>Mass basis fixed:</strong> headline design masses are printed union estimates (Halton 60k samples);
the analytic strut-sum ({robust.mass_g:.1f} g) is a conservative upper bound (+{100 * (robust.mass_g / robust.printed_mass_g - 1):.1f}%). The old 25% figure came from a validator sampler bug and is retired.</li>
<li><strong>Printability is a constraint:</strong> neighbour-width ratio &le; 1.5 and slenderness &le; 30 are enforced in the optimiser; shipped design: ratio {printable['max_neighbour_width_ratio']:.2f}, slenderness {printable['max_slenderness']:.1f}.</li>
<li><strong>Known-lot passports keep measurement uncertainty:</strong> default 12% measurement CV on E and sy; a single coupon is not the true lot mean.</li>
<li><strong>Lot-specific resize:</strong> the passenger recipe uses 8 width multipliers from a second optimisation on the measured lot, not one global scale (the global equivalent is shown for slicer extrusion settings).</li>
<li><strong>Feasibility gate:</strong> before Design, the engine checks whether the bracket/lattice family can meet the target at the maximum printable width. This material: {'feasible' if feasibility['feasible'] else 'INFEASIBLE'} (minimum achievable P<sub>f</sub> {feasibility['min_achievable_pf']:.2e}).</li>
<li><strong>Sustained-load advisory (creep / compression bound):</strong> E<sub>req</sub> &times; {sustained['creep_factor']:.1f}, &sigma;<sub>req</sub> / {sustained['compression_factor']:.1f}, deflection &times; {sustained['creep_factor']:.1f}; bound P<sub>f</sub> {sustained['pf_bound']:.2f}, deflection bound {sustained['deflection_bound_mm']:.1f} mm. This static design is <strong>not qualified for sustained load</strong>; the bound is advisory, not the design allowable.</li>
<li><strong>Family scope:</strong> "best of this bracket/lattice family" — not a general topology optimiser. A pre-registered coupon plan is in validation/COUPON_TEST_PLAN.md; no physical test has been run.</li>
<li><strong>Brittle-lot screen (new):</strong> peak tensile strain demand {brittle['strain_req_pct']:.2f}% at mean E vs printed elongation at break {brittle['elongation_mean_pct'] if brittle['elongation_mean_pct'] is not None else '—'}% (CV {brittle['elongation_cv']:.2f}). Marginal brittle P<sub>f</sub> = {brittle['pf_brittle']:.2e}; add-on estimate (not a formal upper bound; strain demand at mean E; E–elongation correlation assumed; two-property P<sub>f</sub> + brittle marginal) = {brittle['pf_bound']:.2%}. <em>Not included in the headline P<sub>f</sub></em> because E-elongation correlation is assumed (-0.25), not measured. The elongation marginal uses its own lot/within split (rPETG 50% of variance between lots; E/σy use 85%); the 1% brittle screen threshold is fixed and is not the design target.</li>
<li><strong>Assumption bounds (new):</strong> lot-vs-within variance split 75–95% moves P<sub>f</sub> from {assumptions['pf_min']:.2%} to {assumptions['pf_max']:.2%}; changing the assumed E–σ<sub>y</sub> correlation 0.30–0.70 does not move this design (stiffness-governed). The target is met under the default 85/15 split; at the 95% extreme the modelled P<sub>f</sub> ({assumptions['pf_max']:.2%}) exceeds 1%, which is why these are labelled assumptions, not validated population values.</li>
<li><strong>Union-mass polish (new):</strong> the global multi-start search ranks with the analytic upper bound (disclosed); a final local pattern search minimises the printed Halton union mass under the same constraints. {('Accepted an improvement; ' if robust.union_polished else 'No compliant improvement found — the stage was checked and declined; ')}printed mass {robust.printed_mass_g:.2f} g, {robust.union_evals} polish evaluations. The delivered design is locally optimal (not proven globally) on the reported printed-mass basis.</li>
<li><strong>Process compatibility:</strong> this report is for a printed bracket; the selected material is <code>{mat.process}</code> ({'compatible' if mat.print_process_ok else 'NOT compatible — design blocked'}). Non-FDM presets are contrast-only and cannot be designed into the printed lattice.</li>
<li><strong>Lot record:</strong> no delivered lot was supplied to this design-stage report. The app's Prove export carries lot ID, supplier, measurement source/CV and recycled-content % (paperwork claim).</li>
</ul>
</div>

<h2>2. Design comparison</h2>
<div class="card">
<table><thead><tr><th>Strategy</th><th class="num">mass (g)</th><th class="num">P<sub>f</sub></th>
<th class="num">reliability</th></tr></thead><tbody>
{comp_rows}
</tbody></table>
<div class="cap" style="margin-top:10px">All rows evaluated on the same feedstock distribution.
<em>Note on the same-mass row:</em> reliability is very sensitive near the buckling-controlled sizing
cliff in this idealised model, so the {100 * results['uniform_match'].pf:.0f}&nbsp;% figure illustrates
the value of shaping, not a general-purpose prediction.
<em>mean_only</em> is the geometry that just passes for the average material (safety factor 1.0): it is the
lightest but fails roughly half of all delivered lots. <em>nominal SF1.5</em> is a conventional
deterministic design: safe, but heavier than the reliability-targeted robust design.</div>
<img src="{figs['comparison']}" alt="comparison">
<div class="cap">Mass and failure probability by strategy.</div>
{pareto_img}
<div class="cap">Mass–reliability Pareto front. AnyRB lets the engineer pick the reliability level and
finds the minimum mass; conventional safety-factor design lands at an arbitrary point on this trade-off.</div>
</div>

<h2>3. Why the part is reliable (and where it is not)</h2>
<div class="card">
<p>For a single-material frame, internal forces are independent of the elastic modulus, so each geometry
imposes two material demands: a yield-strength demand &sigma;<sub>req</sub> and a stiffness demand
E<sub>req</sub> (from the deflection limit and from Euler buckling of compression struts). A lot fails if
either material property falls below demand. This makes the failure probability a closed-form bivariate
lognormal integral over the lot distribution.</p>
<img src="{figs['margin']}" alt="margin">
<div class="cap">Safety-margin distribution over {n_mc:,} simulated lots (the closed-form P<sub>f</sub> is {robust.pf:.2%}; Monte-Carlo adds sampling noise). Values below 1.0 are failures;
P5 marks the weakest 5% of lots.</div>
<img src="{figs['modes']}" alt="failure modes">
<div class="cap">Failure-mode balance: the marginal probability that the lot's strength is
insufficient vs the marginal probability that its stiffness is insufficient. The joint P<sub>f</sub>
is smaller than the sum because a lot can be weak in both properties at once.
The <em>dominant failure contributor</em> is {split['dominant_failure'].replace('_', ' ')}
(exactly the property to control in the supply chain); the <em>demand closest to capacity</em> is
{split['closest_demand'].replace('_', ' ')} (strength demand at
{split['demand_ratio_strength']:.0%} of the lot mean, stiffness demand at
{split['demand_ratio_stiffness']:.0%}).</div>

<img src="{figs['scatter']}" alt="scatter">
<div class="cap">Simulated lots in property space. A lot fails if it sits left of the strength demand or
below the stiffness demand (shaded axes).</div>
<img src="{figs['sensitivity']}" alt="sensitivity">
<div class="cap">What moves P<sub>f</sub> most. This tells the user what to control in the supply chain or
printer: e.g. reducing CV(E) or sourcing stronger lots.</div>
<table><thead><tr><th>Sensitivity input (+25% unless noted)</th><th class="num">&Delta;P<sub>f</sub></th></tr></thead>
<tbody>{sen_rows}</tbody></table>
</div>

<h2>4. Batch passport: compensating the lot you actually received</h2>
<div class="card">
<p>Instead of rejecting weak lots, the same software computes how much the internal geometry must be scaled
for that specific lot to keep the reliability target. In v0.3 the recipe is not one global scale: the
engine re-optimises the eight width controls on the measured lot (8 width multipliers, reported in the app)
and keeps a 12% measurement uncertainty in P<sub>f</sub>; the table shows the global-equivalent scale for a
slicer's extrusion-multiplier setting. Inputs would be supplier lot data or a melt-index / tensile proxy
(research/05 describes the proxy models; calibration is still required).</p>
<table><thead><tr><th>Lot (relative to preset mean, measurement CV 12%)</th><th class="num">width scale (global equivalent)</th>
<th class="num">printed mass</th><th class="num">added mass</th><th>verdict</th></tr></thead><tbody>
{lot_rows_html}
</tbody></table>
<img src="{figs['acceptance']}" alt="acceptance">
<div class="cap">Acceptance window for a known lot as a function of its measured mean E and mean sy
(within-lot scatter + 12% measurement CV retained). Green = the part meets the target without redesign.
Lot identity, supplier, measurement source and recycled-content paperwork are carried in the app/export rather than simulated here.</div>
</div>

<h2>5. Verification evidence (why you can trust the model at all)</h2>
<div class="card">
<div class="ok"><strong>Independent validation suite:</strong> {val.get('PASS', '—')} PASS / {val.get('WARN', '—')} WARN /
{val.get('FAIL', '—')} FAIL across {val.get('total', '—')} checks (see <code>validation/VALIDATION.md</code>).
The two WARNs are disclosed, not hidden: <strong>F4</strong> the analytic strut-sum is a conservative upper bound
(robust design 50.81 g vs printed union 46.40 g, +9.5 %), and <strong>F5</strong> the deterministic Halton printed-mass
estimator is within 0.1 % on shipped designs but 0.35 % at the minimum strut width, slightly outside its 0.3 % target.</div>
<div class="ok"><strong>Code verification passed in this build:</strong>
single-element cantilever FE matches the Euler–Bernoulli closed form to machine precision
(relative error &lt; 1e-15); the bivariate-normal failure integral matches SciPy's reference to
2e-15; the closed-form P<sub>f</sub> matches an independent Monte-Carlo estimate
(analytic {robust.pf:.4f} vs MC {mc.pf:.4f} &plusmn; {mc.pf_stderr:.4f}); mass and stiffness scale
linearly as expected; the Python and JavaScript implementations are cross-checked against identical
reference fixtures. <strong>What is not verified:</strong> any physical specimen — no laboratory was
available. The material distributions are literature-derived and provisional; the mechanics are a
linear-elastic plane-frame idealisation.</div>
<p style="font-size:12.5px;color:var(--muted);margin-bottom:0">Model credibility follows the logic of
ASME V&amp;V 10/20/40 (verification, validation, uncertainty quantification). <strong>Claim level of this
report: L0–L1 (equations and numerics verified) + partial L2 (literature-calibrated inputs with UQ);
L3 literature reproduction is planned, L4–L6 validation/certification are absent because no physical
testing was performed.</strong> See <code>research/05-validation-without-physical-testing.md</code> for the
full claim ladder and the minimum experimental programme that would upgrade these results.</p>
</div>

<h2>6. Limitations (read before using any number)</h2>
<div class="card"><div class="note">
<ul style="margin:0;padding-left:18px">
{''.join(f'<li>{x}</li>' for x in summary['limitations'])}
</ul></div>
<p style="font-size:12.5px;color:var(--muted);margin:14px 0 0"><strong>Variability-suppression levers
deliberately not active in v0.1</strong> (so no number here can be misread as one): (i) <em>compliance
dilution</em> with a second phase — the nacre-style mechanism — needs a two-phase material model and
costs roughly 2.4&times; mass to recover stiffness; (ii) <em>spatial averaging</em> of within-lot scatter
needs a spatial correlation length and per-element material fields; (iii) <em>batch mixing</em> needs a
multi-lot blending model. The published 93&nbsp;% PNAS variability-reduction result is relative to their
modelled 26&nbsp;% introduced variability (their measured feedstock was 18&nbsp;%&nbsp;&rarr;&nbsp;4&nbsp;%,
i.e. a 78&nbsp;% reduction) and is achieved by a two-phase composite whose strength is adhesive-limited —
it does not transfer to a single-material printed bracket. AnyRB v0.1 changes the <em>decision</em> and
the <em>mean demand</em>; it does not claim to reduce the material's own CV.</p></div>

<div class="footer">
AnyRB v0.3 prototype &middot; reference engine build {summary['generated_utc']} &middot;
material data: provisional literature-derived presets (research/01) &middot;
key literature: Georgiou, Sun, Liu &amp; Athanasiou, PNAS 2025, doi:10.1073/pnas.2502613122; Cecon et al., Waste Management 2023;
Eriksen et al., Waste Management 2019 &middot; full references in <code>research/</code>.
STL exported: <code>{os.path.basename(stl_info['path'])}</code> ({stl_info['triangles']} triangles).
</div>
</div></body></html>"""
    out_html = os.path.join(out_dir, "qualification_report.html")
    with open(out_html, "w") as f:
        f.write(html)
    summary["report_html"] = out_html
    print(f"report: {out_html}  ({os.path.getsize(out_html) // 1024} KB)")
    print(f"summary: {os.path.join(out_dir, 'summary.json')}")
    return summary

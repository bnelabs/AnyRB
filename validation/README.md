# AnyRB — independent validation package (v0.2, post-fix run)

This directory is the **independent scientific validation** of the AnyRB engine. It is
deliberately separate from `engine/tests/` and `app/tests/`: the frame element is re-implemented
from the specification, the global system is assembled independently, reliability is re-derived
with SciPy quadrature / bivariate-normal CDF / \(10^6\)-sample Monte Carlo, the optimiser is
compared against a brute-force grid, and the STL export is audited geometrically. The engine is
imported only where a check is explicitly *engine vs independent reference*.

The goal is credibility, not a green tick: every check has a **pre-registered tolerance**, a
reported **observed number** and a **PASS / WARN / FAIL** status. Statuses were not tuned after
seeing the numbers. The first run found two real engine defects; both were fixed by the Lead and
re-verified here (see *Defects found and fixed*).

**Current result: 45 PASS · 1 WARN · 0 FAIL (46 independent checks, ~17 s).**

---

## Run

```bash
cd AnyRB
make validate                                   # wrapper for the standalone runner
.venv/bin/python validation/run_validation.py   # standalone, no network, ~17 s
node app/tests/run.mjs                          # full JS app suite (includes v0.2 app-layer tests)
.venv/bin/python -m pytest validation/pytest_checks.py -q   # optional CI wrappers
```

The standalone script exits **0** when there is no `FAIL` and **1** otherwise (currently 0:
one documented WARN remains). It writes:

| Output | Contents |
|---|---|
| `validation/results.json` | machine-readable results: one record per check with id, category, claim, method, tolerance, observed value, status, notes, evidence |
| `validation/VALIDATION.md` | human report: *generated* quotable summary for the app, results table, per-check evidence, claim-ladder mapping, model-form limitations, defect status, recommended engine changes |
| `validation/figures/*.png` | four figures (reliability convergence, unit-cell stiffness vs width, optimiser grid vs pattern search, mass over-count vs width) |
| `validation/artifacts/` | regenerated fixture JSON (byte-identical check) and the JS cross-check script |
| `validation/pytest_checks.py` | pytest wrappers (reads `results.json`; ratchet on known-open defects) |

## How to read a status

- **PASS** — observed within the pre-registered tolerance; the claimed property is verified by an
  independent method.
- **WARN** — outside the target tolerance but explained and documented: a known conservative
  approximation (mass over-count) or a deliberately coarse analytical reference. A WARN is visible
  on purpose and must be surfaced in the product, not silently converted to PASS.
- **FAIL** — outside tolerance with no acceptable explanation; the engine must be changed before the
  corresponding claim stands. The suite exits non-zero.

Tolerances were fixed before results were inspected. Changing a tolerance to turn a FAIL into a PASS
is a validation regression, not a fix. `pytest_checks.py` contains a ratchet: a known defect that is
listed there must still be FAIL, so removing it from the list without fixing the engine breaks CI.

---

## What was verified (45 PASS)

| Category | What the independent checks establish |
|---|---|
| **A. Code verification** | Frame element reproduces the axial-bar and Euler–Bernoulli cantilever formulas (≤2e-16); rigid-body translation/rotation produce zero internal force; engine 94-element solve matches an independent assembly (≤1.7e-14); reactions balance force and moment (≤1e-13); bracket symmetry and load-reversal symmetry hold exactly; demands scale linearly with load. |
| **B. Independent solver** | The same assembled system, solved by minimising potential energy with L-BFGS-B, reproduces the direct-stiffness displacements to 2e-7 relative (uniform and graded designs). |
| **C. Reliability** | Closed-form \(\Phi_2\) matches SciPy's bivariate-normal CDF (max 1.5e-13 for \(\rho\le0.95\)) and independent double quadrature (3e-15); extreme correlation (\(\rho=0.99/0.999\)) and deep tails are verified against an independent conditional 1-D quadrature (max abs err 2.2e-16; the engine delegates to SciPy for |ρ|>0.9, so this check does not compare SciPy with itself); analytic \(P_f\) agrees with \(10^6\)-sample Monte Carlo (max \|z\| = 1.0) and with \(10^6\) samples from the engine sampler (z = 0.4); Gauss–Legendre order convergence 12→96 points is clean (2e-4 → 2e-15); lognormal moments/CV/correlation recovered; two-level variance split and measured-lot override behave as documented; degenerate zero-variance limits exact. |
| **D. Optimiser** | A 57×37 brute-force grid of the reduced uniform-width + root-gradient family gives a 53.311 g reference optimum; the production pattern search finds 52.812 g (0.9% better), feasible; 200 random designs cannot beat it by >2%; the shipped 8-parameter robust design is feasible (\(P_f=9.834\times10^{-3}\le10^{-2}\)) and its reported \(P_f\)/mass reproduce independently (≤1e-8 / 1e-10); printability metrics (max neighbour ratio 1.457, slenderness 22.7) are reported, not hidden. |
| **E. Homogenisation** | Periodic/affine unit-cell frame FE reproduces the analytical pin-jointed X-lattice axial stiffness \(C_{11}=E_s(w/L)(2+1/\sqrt2)\) to 0.15%, is isotropic (\(C_{11}=C_{22}\)), scales as \(w^1\) (fitted exponent 1.000), satisfies Maxwell–Betti symmetry, and is energy/stress consistent; shear stiffness matches the truss estimate within 3.2% (frame action, documented). |
| **F. Mass/STL** | Independent bilinear width interpolation reproduces the engine widths/mass to machine precision; the 1140-triangle export has a correct strut mesh (F2a) and a correct axis-aligned 10×60×10 wall pad (F2b); signed volume equals the analytic strut+pad sum (2e-11 relative); node-overlap over-count is quantified (F4, the one WARN). |
| **G. Material model** | rPETG preset moments and log-correlation recovered from 2×10⁶ samples; lot/within/total split identity holds to the rounding of the stored fractions; hierarchical lot→specimen sampling reproduces the total CV; measured-lot path uses the within-lot distribution and does not mutate the preset. |
| **H. Cross-implementation** | All frozen fixture cases recompute from current engine (≤1e-12); the fixture **regenerates byte-identically**; the JavaScript fixture/engine cross-language tests pass; a live JS cross-check reproduces mass, demands, deflection and \(P_f\) on all five cases (≤1e-6 relative, ≤1e-8 absolute). |
| **I. Claim scope** | L0 (code verified) and L1 (solution verified) are demonstrated by A–H; L2 is partial (literature-calibrated inputs, not re-derived); L3–L6 remain absent. |

## Defects found and fixed during validation

| Defect | Found by | Status |
|---|---|---|
| STL wall pad exported as a sheared parallelogram spanning y = −4.93…64.93 mm instead of 0…60 mm | F2b (first run, FAIL) | **FIXED** by Lead: `_pad_triangles` now an axis-aligned 10×60×10 box; F2b re-verified PASS |
| Fixed 48-point Gauss–Legendre \(\Phi_2\) lost ~3×10⁻⁶ at \(\rho=0.99\) | C1b (first run, WARN) | **FIXED**: SciPy adaptive bivariate CDF for \|ρ\|>0.9 (48-point GL retained for normal ranges); C1b now PASS |
| Degenerate-marginal combination returned the wrong \(P_f\) when the deterministic term fails | C9 (surfaced during the fix round) | **FIXED**: `failure_probability` combination corrected; C9 exact on all indicator rows |
| Fixtures needed regeneration after the fixes | H2 | **CLOSED**: fixtures regenerated; H2 byte-identical PASS |

## The one open WARN — must be surfaced in the product

**F4 — reported mass double-counts strut overlap.** `mass_g` sums strut volumes without subtracting
node overlap (documented as conservative). Monte-Carlo union volume of the actual box geometry gives
**+20.2% at w=1 mm, +28.7% at w=2 mm (default), +46.6% at w=4 mm, and +25.2% at the shipped robust
design**. For the robust design: analytic **40,921 mm³ ≙ 50.7 g** vs printed union
**32,692 ± 72 mm³ ≙ 40.5 g**. The bias is design-dependent, so absolute mass and mass-based rankings
shift. The app/report must say *"printed mass ≈ 40.5 g vs analytic 50.7 g (conservative)"* and/or the
engine should compute a unique union volume (clip overlapping struts) or report
`nominal_solid_volume` separately. This WARN is kept deliberately until the engine change lands.

*(Transparency note: `app/tests/run.mjs` currently also contains mid-work v0.2 app-layer tests; during
handover the full suite reported one failing app-layer schema test unrelated to the engine. The H3
check is scoped to the JavaScript engine/fixture contract and records the full-suite status in its
notes.)*

## The one-paragraph scientific statement (reusable in the hackathon README)

> **What we verified.** The AnyRB engine is independently code- and solution-verified: its 2-D
> frame element and 94-element assembly reproduce closed-form beam theory, rigid-body conditions,
> equilibrium and symmetry; the closed-form bivariate-lognormal \(P_f\) agrees with independent
> quadrature, SciPy's bivariate-normal CDF and \(10^6\)-sample Monte Carlo across correlations 0–0.99
> (including tails and degenerate limits); the deterministic optimiser finds a feasible design
> within 1% of a brute-force optimum on a reduced problem and its shipped design independently
> reproduces; the periodic unit cell reproduces the analytical stretch-dominated stiffness scaling;
> and Python/JavaScript agree on all frozen fixtures, which regenerate byte-identically. Two real
> defects found by the first validation run (a malformed STL wall pad and a degenerate-marginal
> \(P_f\) bug) were fixed and re-verified. **What we did not verify:** nothing here is experimental
> validation. The 2-D frame idealisation, joint compliance, layer anisotropy, out-of-plane behaviour,
> plasticity, creep/fatigue, spatial defect statistics and the literature-derived material
> distributions are untested against physical parts. The one open item is the documented mass
> over-count: reported mass is a **conservative analytic upper bound** (+25% at the shipped design;
> ~50.7 g analytic vs ~40.5 g printed union), so it must not be presented as printed mass. The claim
> level is **L0–L1 (code and solution verification) with partial L2**, not L3–L6; these results are
> decision-support evidence for a design tool, not certification, production reliability, or
> compliance with ISO/ASTM/UL/PPWR requirements.

## For the demo / UI engineer — fields to read from `results.json`

| UI need | Field |
|---|---|
| Headline counts + runtime | `summary` → `{total, PASS, WARN, FAIL, runtime_s, exit_code}` |
| "Verified at level L0/L1" badge | `claim_ladder.L0_code_verified.status`, `claim_ladder.L1_solution_verified.status`, `claim_ladder.L2_literature_calibrated_uq.status` |
| Mass disclosure | `checks[]` where `id == "F4"` → `observed`, `notes`, `evidence.robust.{analytic_mm3, union_mm3, overcount_pct}`, `evidence.by_width` |
| Model-form limitations list | `model_form_limitations` (11 keys; render in "Method & honesty") |
| Reproducibility/audit line | `environment.engine_files` (SHA-256 of engine sources), `environment.fixture_sha256` |
| Figures | `figures` (4 relative paths) |

## Reproducibility

- Runtime ≈17 s; no network access.
- Fixed seeds: 20261029, 7, 11, 42, 101, 2027, 5; deterministic optimiser and fixture.
- `results.json` records Python/NumPy/SciPy/Matplotlib/Node versions, the SHA-256 of all engine
  `.py` files and the fixture SHA-256, so a future engine change is detectable.
- Environment: `anyrb/.venv` (Python 3.15, NumPy 2.5, SciPy 1.18); Node ≥ 20 for the JS checks.

## Files

```
validation/
├── run_validation.py        # the whole suite (standalone)
├── pytest_checks.py         # optional pytest wrappers (CI ratchet)
├── README.md                # this file
├── results.json             # generated
├── VALIDATION.md            # generated report (quotable app summary at top)
├── figures/                 # generated: 4 PNGs
└── artifacts/               # generated: regenerated fixture, JS cross-check script
```

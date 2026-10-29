# AnyRB v0.3 — response-to-review spec (shared contract)

This release responds to the independent review. Scope: the five highest-leverage items plus honesty fixes.
The Python engine is the reference implementation; the JS app must match its numbers/behaviour.

## 1. Mass: analytic upper bound + printed union estimate

The old validator union sampler was buggy (half-strut boxes); F4 is fixed.
Correct results: analytic mass over-counts union volume by:
- w=1 mm: +5.6 %; w=2 mm: +12.2 %; w=4 mm: +27.9 %
- shipped robust design: +9.5 % (analytic 50.81 g vs printed union 46.40 g)

New engine:
- `mass_g` remains the analytic upper bound (fast).
- `printed_mass_g` = deterministic Halton quasi-Monte-Carlo union (60k samples,
  bases 2/3/5), margin 4 mm, pad [0,10]×[0,60]×[-5,5]; struts tested over their
  full length. Error ≤0.1 % on shipped designs vs independent 2e6-sample MC, worst 0.35 % at
  w=1 mm (documented F5 WARN); cost ~0.1 s in Python (final designs/selection only).
- Optimiser search still ranks with analytic mass (speed), but **final selection
  among multi-start solutions and candidate cards uses printed_mass_g**.
- Every displayed/exported design mass is printed_mass_g; analytic is shown as
  "upper bound" only. Comparison bars use printed mass (solid = exact).

## 2. Printability is a constraint, not a report

Robust / nominal / mean-only objectives add a penalty for:
- neighbour width ratio > 1.5 (advisory manufacturing cap)
- slenderness > 30
- final selected design must pass both; expose `printability` on every design.
The shipped design should have `max_neighbour_width_ratio <= 1.5` and
`max_slenderness <= 30`.

## 3. Known lot keeps measurement uncertainty

`Material.lot_from_measurement(E, sy, measurement_cv=0.12)`:
E_cv = sqrt(within_cv² + measurement_cv²), same for sy; lot fraction = 0.
A single coupon / supplier value must not zero the uncertainty. Passport shows
the measurement CV input (default 12 %) and the resulting P_f.

## 4. Lot-specific resize (not one global scale)

`lot_specific_recipe(mat, controls, target_pf, lot_E, lot_sy, measurement_cv)`:
- material = measured lot with measurement CV
- seed = current controls; optimise all 8 width controls for the measured lot
- returns: controls, `width_multipliers` (8), `global_equivalent_scale`,
  `printed_mass_g`, `added_mass_pct`, `pf`, `verdict` ∈
  ["pass as designed", "pass with compensation", "conditional (heavy
  compensation)", "reject / reroute"], printability.
UI: replace single scale with the 8 multipliers + mass delta; keep global
equivalent for a slicer's extrusion multiplier.

## 5. Feasibility gate before Design

`family_feasibility(mat, target_pf, F, u_lim)` evaluates the widest printable
uniform lattice. If P_f > target: Brief UI shows "infeasible for this bracket
family" with min achievable P_f, and Design is blocked (button disabled and
server plan not called). No AI candidate is drawn.

## 6. Sustained-load / creep bound (advisory, labelled)

`sustained_bound(mat, controls, creep_factor=2.0, compression_factor=0.8)`:
E_req_bound = E_req*creep_factor, sigma_req_bound = sigma_req/compression_factor,
deflection_bound = u_mean*creep_factor. Report P_f bound and deflection bound as
an ADVISORY for long-term loads, never as the static design allowable. If the
bound fails, the proof screen must say the part is not qualified for sustained
load (static result unchanged).

## 7. Family scope and claims

All UI/docs say: "best of this bracket/lattice family" — not a general topology
optimiser. Coupon test plan documents the L3+ path; no physical test has been
run. The report carries: lot ID, supplier, measurement used + measurement CV,
recycled-content % marked "paperwork claim (not simulated)".

## 8. Data contract / fixtures

`evaluate()` adds `printed_mass_g`, `mass_analytic_g`; `DesignResult` adds
`printed_mass_g`, `mass_analytic_g`, `printability`.
`fixtures/reference.json` must include both masses and printability; JS tests
compare printed mass to Python within 0.5 % (Halton implementation must match
the definition above).

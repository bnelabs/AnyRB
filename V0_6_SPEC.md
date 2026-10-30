# AnyRB v0.6 — evidence map + one allowed calculation

**Status:** implementation contract. The v0.5 outcome rules remain the commit-`822c342`
behaviour in `app/consistency.js`; v0.6 only adds an evidence gate, an additive calculation state
and a separate simulation.
**Evidence map:** [`research/06-evidence-map.md`](research/06-evidence-map.md) ·
[`research/evidence_map.json`](research/evidence_map.json) ·
deep read [`research/06a-pnas-deep-read.md`](research/06a-pnas-deep-read.md) ·
primary search [`research/06b-primary-links.md`](research/06b-primary-links.md).

---

## 1. What v0.6 preserves

The v0.5 open record is not weakened:

- any product name, any result name/unit, any numeric target range;
- free-text plastic type, batch, mix and minor contamination;
- outcomes remain exclusive per result: **measured link**, **one batch only**, **missing**;
- a measured link needs ≥2 usable measurements, ≥2 distinct input levels, named sources and
  what varied;
- no measurement → result blank + the test still needed; no chart, score or overall pass/fail;
- no product catalog, general optimizer, generic 3-D simulator, material preset link or bracket
  solver filling a missing result.

The v0.5 tests remain unchanged.

---

## 2. Evidence map first

`research/06-evidence-map.md` was written before new product code. It records for every candidate
link:

- product class; result; input that varied; what was physically measured; sample size;
- the number that moved; whether it is an experiment or a model; what the paper does not cover;
- one of three grades: **measured on that product class**, **model only**, **absent**.

Facts the map establishes:

- The **only** measured product-class link found for a varying recyclate input and a product-class
  result is the PNAS 2025 `{8,5}` rHDPE-platelet / PDMS-matrix composite modulus result:
  **18 % → 4 % CV**, n = 5 composite specimens, n = 50/10 plates feedstock. The paper does **not**
  report the absolute measured composite `E_eff` mean.
- The paper's **93 %** is the **model-only {8,7} stretch-film case**, relative to a modelled ≈26 %
  total introduced variability (554 ± 10 MPa, CV 2 %). It is not copied to any product.
- WPC profile/board and recycled-HDPE lumber are real product-class measurements, but they vary
  **formulation, filler, ageing or product type**, not delivered recyclate lot/batch. They are not
  batch links and have no app calculation.
- Pipe ring stiffness, counterweight mass, sound-insulation sheet, finished recycled sheet/panel,
  another plastic/mix/contamination and any product-vs-batch link are **absent** at product class.
  Coupon-level contamination data remains coupon-level.
- The PNAS close-out: measured composite = rHDPE-platelet / soft PDMS-matrix `{8,5}`; modulus
  scatter 18 %→4 % on those specimens. This is the only number quoted for that case.

**A citation, literature mean, assumed CV, coupon result, another product's result, model or the
historical bracket is not a measured link.**

---

## 3. One allowed calculation

### 3.1 Match

The app may run **one** calculation, only when:

- the user explicitly selects the **PNAS 2025 `{8,5}` platelet–matrix composite** evidence case;
- the user explicitly confirms that the product is that composite kind (the free-text product name
  alone is not evidence);
- the matching record result is a **modulus/stiffness** result, unit **MPa**, with a valid target
  range;
- a **measured recyclate stiffness distribution** is supplied or the paper's measured rHDPE
  distribution is selected;
- a **measured effective-modulus baseline** of the actual composite is supplied: recyclate mean at
  baseline, measured composite modulus, n ≥ 3, named source.

The baseline is required because the PNAS paper reports the measured CV ratio but no absolute
measured composite mean. This is the v0.6 safety gate; no invented mean is used.

### 3.2 Fixed case parameters

The paper's measured `{8,5}` case (SI Table S3):

- N = 8, M = 5, l = 20 mm, h = 8 mm, w = 4.75 mm, t = 3 mm; specimen 195 × 53 mm;
  platelet volume fraction 70.7 %.
- hard phase `E_hard ~ N(1350, 239²)` MPa (measured rHDPE feedstock);
- CT: σmax,CT `W(7.00, 0.15)` MPa; δe 0.80 mm; δcr `N(1.20, 0.18²)` mm;
- CS: τmax,CS `W(7.00, 0.20)` MPa; δe 0.40 mm; δcr `N(0.80, 0.12²)` mm.

### 3.3 Calculation

A **baseline-anchored, case-scaled simulation**:

```
E_eff_mean = baseline_output_mean × (selected_recyclate_mean / baseline_input_mean)
CV_eff     = selected_recyclate_cv × (0.04 / 0.18)
P5/P95     = normal quantiles of (E_eff_mean, CV_eff)
```

The measured 18 %→4 % CV ratio supplies the variability suppression; the user's measured baseline
supplies the absolute MPa level. The app labels this **simulation** and says it is the PNAS
case, not a physical test of the product. The stretch-film 554 MPa/93 % model is not used.

### 3.4 Blocked states (no calculation, no estimate)

- no selected case / product-class confirmation;
- no modulus/stiffness result, unit not MPa, or invalid target;
- no measured recyclate distribution (mean, CV, n ≥ 3, source);
- no measured baseline (input mean, output mean, n ≥ 3, source);
- result kind not modulus; product outside the PNAS case.

If blocked, the app names the missing test and the result remains blank. It never substitutes the
bracket, a literature mean, or a library density.

---

## 4. Default path and demotion

- **Default screen:** the v0.5 consistency record plus the optional evidence case card.
- **Evidence map** is a second top-bar reading screen. It has no AI and no calculation.
- **Historical bracket studio, voice brief and concept image** are removed from the default path.
  The bracket studio remains reachable from the record's small historical link; voice/image remain
  inside it. The bracket validation stays in the repo as historical evidence for that one 2-D
  part, not proof for another product.
- No global optimizer, general 3-D simulator, product catalog or pass/fail seal is added.

---

## 5. Tests and done criteria

- Map integrity: exactly one calculation case; PNAS measured grade; stretch film model-only;
  counterweight/sound/other/mix/batch absent; 93 % carries its 26 % denominator.
- Calculation: blocked without baseline/distribution/source/target/product class; runs with the
  paper distribution + measured baseline; P5/P95 and inside/outside; simulation flag; 554/93 % not
  used; own measured distribution scales; non-modulus and non-MPa blocked.
- Record: v0.5 outcomes unchanged; calculation cannot fill a missing result; JSON round-trip.
- Keep passing: 48 v0.5 JS tests, engine tests, server tests, independent validation.

Done = evidence map committed; record refuses to invent; PNAS case runs only with required inputs
and is labelled simulation; counterweight mass, sheet acoustics, other plastic/mix/contamination
still stop with the missing test named.

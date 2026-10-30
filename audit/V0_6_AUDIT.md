# AnyRB v0.6 — evidence-map audit and implementation checks

**Scope:** evolution of AnyRB from the v0.5 open record to an evidence-gated system with one
allowed PNAS calculation. **Research was written before the product code:** evidence map,
primary search and PNAS deep read are in `research/06-evidence-map.md`,
`research/evidence_map.json`, `research/06a-pnas-deep-read.md` and
`research/06b-primary-links.md`. **Status:** PASS for the stated scope, with the limits in §5.

---

## 1. Research performed before code

- Read all existing dossiers `research/00–05`, the reference JSON files and the feedstock library.
- Read Georgiou, Sun, Liu & Athanasiou, *PNAS* 122(33):e2502613122 (2025), DOI
  `10.1073/pnas.2502613122`, PMID 40794839, PMCID PMC12377729; obtained the JATS XML and the
  20-page SI Appendix (Tables S2–S5) and re-read the equations, measured values and Fig. 5/6.
- Searched primary literature for quantitative links from recycled input (polymer, batch, mix,
  filler, contamination) to finished-product-class results; wrote
  `research/06b-primary-links.md` with DOI, sample size, the number that moved and what each paper
  does not cover.
- Wrote the evidence map before changing app behaviour. It records, for every candidate link:
  product class, result, input varied, what was physically measured, sample size, the number that
  moved, experiment/model, coverage gap, and grade **measured on that product class / model only /
  absent**.

**Key findings now encoded in the app**

- The PNAS **measured** result is the fabricated `{8,5}` **rHDPE-platelet / PDMS-matrix composite**:
  modulus scatter **18 % → 4 %** on those specimens (n=5 composite; n=50/10 plates feedstock).
  The paper reports **no absolute measured composite E_eff mean**.
- The PNAS **93 %** is the **model-only `{8,7}` stretch-film case** relative to a modelled ≈26 %
  total introduced variability (554 ± 10 MPa, CV 2 %). It is never copied.
- WPC profile/board and recycled-HDPE lumber are measured on product classes but vary
  formulation/filler/ageing/product type, not recyclate lot/batch. They are not batch links and
  have no app calculation.
- Counterweight mass, sheet acoustics, finished recycled pipe/sheet, another plastic/mix/
  contamination, and any finished product vs recyclate batch are **absent at product class**.
  Coupon-only evidence is marked coupon-only.

---

## 2. What changed in the app

- `app/evidence.js`: evidence-map data, grade semantics, PNAS case parameters and the
  baseline-anchored calculation gate.
- `app/evidence_ui.js`: the Evidence map screen; no AI, no result creation.
- `app/consistency_ui.js`: one optional PNAS calculation card; requires product-class confirmation,
  modulus result in MPa with a target, measured recyclate distribution, and measured composite
  baseline. No output until complete.
- `app/consistency.js`: additive `calculation` state; v0.5 outcomes and link rules untouched.
- `app/ui.js`/`app/index.html`: default is the consistency record; Evidence map is the second
  top-bar surface; bracket studio is off the top bar and reachable only from a historical link;
  AI/voice/image controls are hidden on the default and evidence surfaces.
- `app/styles.css`: evidence and calculation layouts; no 3-D rendering.
- `V0_6_SPEC.md`, README/HACKATHON/demo docs and v0.6 screenshots.
- Historical bracket engine, 2-D FE, validation and reports were not changed.

---

## 3. Brief-to-implementation checks

| Requirement | Evidence |
|---|---|
| Research before new product code | evidence map + primary search + PNAS deep read committed before app code; §1. |
| Product/result/input free text and v0.5 outcomes unchanged | 48 v0.5 tests still pass; `outcomeFor` untouched. |
| One calculation only for an evidence-map row | `CALC_CASE` is the only `calcEligible` row; test asserts exactly one. |
| PNAS product class and result match | explicit case selection + product-class checkbox + modulus/stiffness result in MPa; non-modulus/non-MPa blocked. |
| User supplies/selects recyclate distribution and paper architecture | paper measured rHDPE or measured user distribution; fixed `{8,5}` architecture and Table S3 interface parameters displayed. |
| Shows modulus range and target check | baseline-anchored P5–P95; inside/outside target; labels **simulation**. |
| Blocked without required measurement | no measured recyclate distribution and/or no measured composite baseline → no run, test named. |
| No absolute mean invented | the paper has no absolute measured composite mean; a measured baseline is required; 16.5 MPa digitisation exists only as a sanity band in research, not as app input. |
| 93 %/554 MPa not copied | model-only row; source note says not used; tests assert no 554 result and `93 %` only in model context. |
| Counterweight mass blank | no calculation; absent row; v0.5 record leaves mass blank and names density/volume test. |
| Sound insulation blank / not structural 3-D | absent row; no calc; v0.5 3-D line remains not applicable. |
| Other plastic/mix/contamination blank | absent product-class row; coupon evidence only, no calc. |
| No 3-D simulator/optimizer/catalog | no such modules; evidence/case only. |
| Default path demoted | top bar: Consistency + Evidence map; bracket studio only via historical link; voice/image inside it. |
| Bracket validation historical, not proof for others | scope note; no engine import in evidence/record path. |
| Every computed number simulation | calc output has `SIMULATION` badge; note says not a physical test of user's product. |

---

## 4. Verification

| Check | Result |
|---|---|
| JS suite | **54/54 passed** (37 bracket + 11 v0.5 record + 6 v0.6 evidence/calculation) |
| Engine tests | **33/33 passed** |
| Server tests (mock) | **51 passed, 1 skipped** |
| Independent validation | **56 PASS / 2 WARN / 0 FAIL** |
| Standalone build | `python3 app/build.py` → v0.6 bundle; `node --check` pass |
| Browser: file:// | boots, 10 evidence rows, evidence↔record, PNAS calc simulation, record stays blank |
| Browser: served 8787 | same, no page errors |
| Browser: historical studio smoke | `?smoke=1` reaches Prove, workspace studio |
| Mobile 390 px | no horizontal overflow on record/evidence |
| Persistence | case, confirmation, baseline and source survive reload; calculation cannot fill a missing measured result |
| Export/import | calculation state and baseline source round-trip; v0.5 outcomes unchanged |

---

## 5. Remaining limitations (honest)

1. The PNAS measured row supports the **CV ratio**, not an absolute mean; absolute MPa output needs
   the user's measured composite baseline. This is deliberate.
2. The calculation is **case-scaled**, not the paper's full UATSC network; it uses the measured
   18 %→4 % CV ratio and linear mean scaling. It is not a predictive model for other architectures.
3. The paper's 93 % and 554 MPa remain model-only and are not used.
4. WPC/lumber product measurements are real but formulation/product-type links, not batch links;
   they have no app calculation.
5. Counterweight mass, sheet acoustics, pipe ring stiffness, finished sheet/panel, other plastics/
   mixes/contamination and any product-vs-batch link are absent. They stay blank with the test named.
6. No generic 3-D simulator was added. The historical bracket remains a 2-D simulation only.
7. The evidence search was not a systematic review; no subscription-only full texts were available
   for every candidate, and abstracts-only candidates were marked, not graded measured.

All limitations are visible in the app or the evidence map.

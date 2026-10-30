# AnyRB demo pack (v0.6 — consistency record + evidence map + historical bracket studio)

Everything a reviewer needs to see the product in under five minutes.

## 1. Open the app

### Live AI mode (Meta models in the live path)
```bash
cd AnyRB
cp server/.env.example server/.env      # add your Meta API key (never commit)
.venv/bin/python -m server.app          # http://127.0.0.1:8787
```
Open **http://127.0.0.1:8787** in Chrome. The **consistency record** opens by default and uses no AI.
The **Evidence map** is a second reading screen. Open the **historical bracket studio** from the record's
bottom link for the Meta path: only there the AI pill shows **Live · Meta models**, and the AI activity drawer
lists every call with model, latency, tokens and cached/live status.

### Offline mode (no key, no network)
Double-click **`../index.html`**. The consistency record and evidence map work with no AI and no network.
In the **historical bracket studio**, the pill shows **Offline · fallback on** and every AI card is badged
`offline-assistant`; the 3-step flow, verified engine, exports and validation card all still work.

## 2. Three-minute walkthrough

1. **Consistency record (new default)** — name a product (counterweight, sheet, pedal, anything). Type a
   result and target range, and describe the recycled input. With no measurement, show the **blank result
   and the test still needed**. Add one batch → **one batch only**, with no next-batch prediction. Add a
   second input level with source and "what varied" → **measured range** plus the measured product choice
   inside the target. Point at the 3D line: **not applicable** (or not used), with the reason. No preset,
   library density or bracket model is involved.
2. **Evidence map** — open the **Evidence map** tab. Show the three grades: measured on a product class,
   model only, absent. Point at the PNAS measured row: **18 %→4 % modulus scatter on the rHDPE-platelet /
   PDMS-matrix composite**; point at the **93 % / 26 % model-only** stretch-film row and say it is not
   copied. Counterweight mass and sound insulation are **absent**. Back in the record, select the PNAS
   `{8,5}` case and show that it **does not run** until the measured recyclate distribution and measured
   composite baseline are present; then show the simulated P5–P95 and the **simulation** badge.
3. **01 · Brief (historical studio)** — open the historical bracket studio from the record's bottom link.
   The prompt is pre-filled ("A wall bracket for a recycled PETG shelf unit…"). Click **Design with AI**.
   Muse Spark parses the brief into the editable *What the studio understood* card; the lot passport shows
   the published rPETG distribution (E 2,100 MPa / CV 10 %, σy 46 MPa / CV 10 %, 85 % of variance between
   lots). *Optional:* click the mic and speak the brief (Muse Voice Transcribe).
4. **02 · Design** — the engine draws the graded lattice and the AI proposes three candidate strategies
   (purely as parameter priors; the verified FE engine evaluates and ranks them). Pick **Balanced**:
   ~46.4 g at ~1 % simulated batch failure probability, binding failure mode Euler buckling. The AI
   design memo explains the trade-off; every number in it comes from the engine. Show the mass footnote:
   printed Halton union estimate 46.4 g vs analytic upper bound 50.81 g (+9.5%).
5. **03 · Prove** — reliability gauge, batch acceptance window, batch passport (try E ×0.85 → 8-control resize, global-equivalent
   ×1.28, +19.6 % printed mass, conditional; E ×0.5 → reject). The scientific-validation card reads
   **56 PASS / 2 WARN / 0 FAIL (58 independent checks)** with the two known WARNs labelled. Muse Spark
   writes the qualification narrative; Muse Image provides the labelled concept render. Export the
   qualification report/STL/JSON; open the AI activity drawer.
6. **Method & honesty** — claims ladder L0–L1 verified / L2 partial / L4–L6 absent; the bracket studio is
   one simulated product; the consistency record is measurement-only; the PNAS case is a simulation; no
   physical testing was performed.

## 3. What is real vs illustrative

| Real | Illustrative / labelled |
|---|---|
| 2-D frame FE, mass, P_f, optimiser, batch passport, acceptance window | printed mass union estimate (validator Halton union; analytic mass is conservative) |
| Meta Spark/Image/Voice/SAM calls in live mode (see `server/evidence/live_calls.json`) | AI-written prose (grounded in engine numbers; may round) |
| Validation checklist (from `validation/results.json`) | concept render (Muse Image; "not the CAD model") |
| Offline deterministic assistant (same schemas) | batch acceptance chart is engine-computed; the chart annotation is illustrative |
| Consistency-record measurements and sources (entered by the user) | any result without a measured link is blank; no 3-D simulation is generated |
| Evidence map rows (paper citations, measured/model/absent grades) | PNAS measured 18→4 % is the composite specimen result; 93 % is the model-only film case and is never copied; absent rows are not calculated |

## 4. Reproduce

```bash
cd AnyRB
make test            # 33 engine tests
make test-server     # 51 backend tests, 1 skipped (mock mode)
node app/tests/run.mjs   # 54 JS engine/UI/record/evidence tests
make validate        # independent validation: 56 PASS / 2 WARN / 0 FAIL (58 checks)
make verify-live     # real Meta calls → server/evidence/live_calls.json (needs server/.env)
make report && make pdf
python3 app/build.py # rebuild single-file index.html
```

## 5. Claims and limitations (also shown in-app)

In-silico decision support, **not certification**: no physical testing; linear-elastic 2-D frame
idealisation (no plasticity, creep, fatigue, layer anisotropy, out-of-plane behaviour, joint detail or
print defects); literature-derived feedstock distributions must be replaced by the user's lot data;
optimiser is a deterministic multi-start local search (not a global-optimality proof); reported mass is a
conservative analytic figure (~20 % above the union estimate at the robust design); AI is explanatory and
never the source of a number; recycled-content/ISO/UL compliance cannot be inferred.

## 6. Older screenshots

`demo/screenshots/v2/live/` and `demo/screenshots/v2/offline/` — the final v0.2 captures
(brief / design / prove / provenance), plus v0.1 history. The design target is
`design/prototype.html` (open directly in a browser).


## 7. v0.5 screenshots (archive)

- `screenshots/v5/01-consistency-no-measurement.png` — counterweight with no measured mass; result blank.
- `screenshots/v5/02-consistency-one-batch.png` — one batch only; inside target, no next-batch prediction.
- `screenshots/v5/03-consistency-measured-link.png` — measured range and measured product choice.
- `screenshots/v5/03b-consistency-measured-link-panel.png` — close-up of the answer panel.
- `screenshots/v5/04-consistency-sheet-no-measurement.png` — sound insulation, thickness and weight all blank without measurements.
- `screenshots/v5/05-bracket-studio.png` — the separate 2-D bracket studio.


## 8. v0.6 screenshots

- `screenshots/v6/01-consistency-record.png` — default open record + evidence calculation card.
- `screenshots/v6/02-evidence-map.png` — measured / model-only / absent map.
- `screenshots/v6/03-pnas-calculation.png` — PNAS case with measured baseline, simulated P5–P95 and simulation badge.
- `screenshots/v6/04-pnas-blocked.png` — PNAS case **not run** because the measured baseline is missing; test named.
- `screenshots/v6/05-historical-bracket-studio.png` — historical 2-D bracket studio, off the default path.

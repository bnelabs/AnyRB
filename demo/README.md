# AnyRB demo pack (v0.2 — Meta AI hackathon build)

Everything a reviewer needs to see the product in under five minutes.

## 1. Open the app

### Live AI mode (Meta models in the live path)
```bash
cd AnyRB
cp server/.env.example server/.env      # add your Meta API key (never commit)
.venv/bin/python -m server.app          # http://127.0.0.1:8787
```
Open **http://127.0.0.1:8787** in Chrome. The AI pill shows **Live · Meta models**; the AI provenance
drawer (bottom right) lists every call with model, latency, tokens and cached/live status.

### Offline mode (no key, no network)
Double-click **`../index.html`**. The pill shows **Offline · fallback on** and every AI card is badged
`offline-assistant`; the 3-step flow, verified engine, exports and validation card all still work.

## 2. Three-minute walkthrough

1. **01 · Brief** — the prompt is pre-filled ("A wall bracket for a recycled PETG shelf unit…"). Click
   **Design with AI**. Muse Spark parses the brief into the editable *What the studio understood* card;
   the lot passport shows the verified rPETG distribution (E 2,100 MPa / CV 10 %, σy 46 MPa / CV 10 %,
   85 % of variance between lots). *Optional:* click the mic and speak the brief (Muse Voice Transcribe).
2. **02 · Design** — the engine draws the graded lattice and the AI proposes three candidate strategies
   (purely as parameter priors; the verified FE engine evaluates and ranks them). Pick **Balanced**:
   ~46.4 g at ~1 % simulated batch failure probability, binding failure mode Euler buckling. The AI
   design memo explains the trade-off; every number in it comes from the engine. Show the mass footnote:
   printed Halton union estimate 46.4 g vs analytic upper bound 50.81 g (+9.5%).
3. **03 · Prove** — reliability gauge, batch acceptance window, batch passport (try E ×0.85 → 8-control resize, global-equivalent
   ×1.28, +19.6 % printed mass, conditional; E ×0.5 → reject). The scientific-validation card reads
   **56 PASS / 2 WARN / 0 FAIL (58 independent checks)** with the two known WARNs labelled. Muse Spark
   writes the qualification narrative; Muse Image provides the labelled concept render. Export the
   qualification report/STL/JSON; open the AI provenance drawer.
4. **Method & honesty** — claims ladder L0–L1 verified / L2 partial / L4–L6 absent, the "what v0.1 cannot
   do" levers, and the explicit statement that no physical testing was performed.

## 3. What is real vs illustrative

| Real | Illustrative / labelled |
|---|---|
| 2-D frame FE, mass, P_f, optimiser, batch passport, acceptance window | printed mass union estimate (validator Halton union; analytic mass is conservative) |
| Meta Spark/Image/Voice/SAM calls in live mode (see `server/evidence/live_calls.json`) | AI-written prose (grounded in engine numbers; may round) |
| Validation checklist (from `validation/results.json`) | concept render (Muse Image; "not the CAD model") |
| Offline deterministic assistant (same schemas) | batch acceptance chart is engine-computed; the chart annotation is illustrative |

## 4. Reproduce

```bash
cd AnyRB
make test            # 29 engine tests
make test-server     # 51 backend tests, 1 skipped (mock mode)
node app/tests/run.mjs   # 37 JS engine/UI tests
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

## 6. Screenshots

`demo/screenshots/v2/live/` and `demo/screenshots/v2/offline/` — the final v0.2 captures
(brief / design / prove / provenance), plus v0.1 history. The design target is
`design/prototype.html` (open directly in a browser).

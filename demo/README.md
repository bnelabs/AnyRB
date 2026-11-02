# AnyRB demo pack (v0.9, current)

The judged demo is the single-page app at the repo root (`index.html`, built from `app/`).

## Run it

```bash
.venv/bin/python -m server.app   # http://127.0.0.1:8787
```

`META_API_KEY` stays server-side (see `server/.env.example`). Without a key the app still
calculates the current build, the minimum build and any declared blend from the user's own
numbers, and says plainly when Meta is unavailable instead of inventing alternatives.

## The checked screens (`screenshots/v10/`)

1. `first-open-blank.png` — first open. The page asks “What do you want to make?” Every field is
   empty: no assumed product, load path, dimensions, ranges, batch or blend. Three readiness
   steps show what the decision needs.
2. `decision-range.png` — the sourced rHDPE crate case after an example click: the decision
   headline, the pinned decision bar, and the band-and-bar range view with the closest margin.
3. `failure-gap.png` — the same crate held to 130–150 kg: no build passes, the current build's
   own range is shown against the requirement, and the gap states the material range needed.
4. `brief-verifier.png` — the Meta front door and verifier trace on the crate case.
5. `mobile-first.png` — first open at 390 px, one column, no horizontal overflow.
   (`first-open.png` and `mobile.png` are the earlier 31 Oct captures, kept for history.)

## The reference cut (`anyrb-demo-draft.mp4`)

Screen recording of the same flow with synthetic narration. It is a pacing reference only:
replace the voice with the founder's before submitting, and re-record with a real batch
if one becomes available.

## Reproduce

```bash
python3 app/build.py
node app/tests/model.test.mjs   # 32 app tests
AI_MOCK=1 .venv/bin/python -m pytest server/tests -q   # 138 product/backend tests
```

The screenshots are captured from the served app with headless Chrome at 1440 px and 390 px.

## History

Older screenshot sets (`screenshots/v4`–`v8`) and the retired v0.4–v0.7 apps in `../history/`
are not part of the judged demo. Research notes are in `../research/`; they document
published variability ranges, not this app's claims.

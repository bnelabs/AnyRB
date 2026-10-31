# AnyRB — Meta Global AI Developer Hackathon submission

**Track:** Indie Developer · **Problem statement:** Build for Your World
**Solo builder:** Baris Nacierzeren
**One line:** AnyRB turns a measured recycled-plastic delivery into a makeable part — Meta reads the shop's ask and proposes moves; a deterministic verifier proves which build stays inside every target.

## The problem

A small shop buys recycled plastic by the delivery. The stiffness and strength swing from batch to
batch, and dirt, mixed polymer and moisture move the low end further. A conventional workflow either
over-designs the part or rejects the delivery. The shop needs to know **what can I make from this
batch, at what size, and what do I add if the batch alone is not enough** — not a verdict on the batch.

## What AnyRB does

1. **Ask in shop language.** The brief bar takes a natural-language request, typed or spoken, such as: *"I make a 400 mm crate side, 60 mm wide and 15 mm thick, simply supported. It must have a load
   capacity of 95–115 kg (strength requirement) and a weight of 320–360 g (weight requirement). My
   batch is a published measured rHDPE range: 380–1,250 MPa stiffness, 41.6–48.4 MPa strength, density
   0.94."*
   Muse Spark parses it into a product, load path, dimensions, any number of target requirements and
   a batch description. The shop can edit every field. The same brief can be spoken; Muse Voice
   Transcribe supplies the transcript.
2. **Engineering.** The mechanics evaluates every candidate against **all** requirements at once. A
   build is shown only when its full property range stays inside every target. The winner uses the
   least added build mass. The UI starts with no product and no decision; examples are optional.
3. **Batch.** The delivery's measured swing and dirt are shown against what the build needs. The app
   gives the material gap, a declared steadier-stream blend when it closes the gap, and a place to ask
   Meta what to change or add. It never ends at "don't use this delivery."
4. **Verification.** Meta proposes moves; a deterministic verifier scores the exact proposal and then
   searches the passing size in the accepted direction. The UI shows what Meta proposed, what the
   verifier rejected, and what was accepted. The browser never receives a model-authored result,
   strength, stiffness or weight.

## Meta models in the live path

| Model | Role | Endpoint |
|---|---|---|
| **Muse Spark 1.3 Contributor** | parse the natural-language shop brief into structured product/target/batch state | `/api/product/brief` (new) |
| **Muse Spark 1.3 Contributor** | propose engineering and batch moves | `/api/product/proposals` |
| **Muse Spark 1.3 Contributor** | answer the shop's batch question with grounded, number-only-from-input actions | `/api/product/advice` |
| **Muse Voice Transcribe 1.0** | transcribe a spoken brief before Spark parses it | `/api/voice/transcribe` |

The browser never sees the API key. The server sanitises every model output, strips property/result
keys, clamps parameter values, grounds advice numbers to the request, and rejects test/trial/certification
instructions. If Meta is unavailable, the local mechanics still calculates the current build, the
minimum build and any declared blend; it does not invent alternatives or advice.

## The demo case

The active demo is an **explicit loadable case**, not a default product: a 400 mm simply supported
crate side, 60 × 15 mm, with **strength 95–115 kg** and **weight 320–360 g**. The batch is a
**published measured rHDPE range** compiled in the project research: stiffness 380–1,250 MPa (US MRF
range, R02 via R01), strength 41.6–48.4 MPa (R04), density 0.94 g/cm³ (R12). The mechanics reports
**95.4–111.0 kg and 338.4 g** for the current build — inside both targets.

The planter case is an illustrative second example. The user can type any other part and add or
remove requirements. Sources and the honesty label are in
[`data/CASE_STUDY.md`](data/CASE_STUDY.md).

## What was built during the hackathon

See [`HACKATHON_WORK.md`](HACKATHON_WORK.md) for the commit/file map. The judged surface is:

- `app/` — the product-first, multi-requirement page and mechanics
- `server/product_ai.py`, `server/app.py` — Meta brief/proposals/advice endpoints and tests
- `V0_8_SPEC.md` — the current contract
- `demo/screenshots/v10/` — checked screens
- `SUBMISSION.md`, `HACKATHON.md`, `DEMO_SCRIPT.md` — submission pack

The v0.4–v0.7 bracket engine, validation, reports and research are in the repository as
**pre-product history**; they are not part of the active demo and their validation scores are not
claimed for AnyRB v0.8.1. The old `history/` folder is not built or linked from the active page.

## Run it

```bash
cp server/.env.example server/.env   # add a Meta Model API key; never commit it
.venv/bin/python -m server.app       # http://127.0.0.1:8787
python3 app/build.py                 # rebuild standalone root index from app/
node app/tests/model.test.mjs
AI_MOCK=1 .venv/bin/python -m pytest server/tests -q
```

For a public demo, use the deployment path in `SUBMISSION.md`; the key stays in the server
environment with a spend limit.

## Verification

- `node app/tests/model.test.mjs` — 26 app tests (mechanics, empty start, multi-requirement selection,
  exact model trace, gap/blend, source guards).
- `AI_MOCK=1 .venv/bin/python -m pytest server/tests -q` — 135 server tests, 1 skipped (brief/proposals/
  advice contracts, extraction grounding, no-key, no-test, no-fallback).
- Browser smoke: first open makes no API call; sample brief parses (cached in the demo); exact Meta
  proposals show accepted/rejected in the trace; 1440 px and 390 px have no overflow/errors.

## Honest limits

- The mechanics is a rectangular-section model for loaded parts (bracket/slat/crate/planter/pallet
  block); it is not a general 3-D structural solver.
- The sample batch values are a labeled example, not a laboratory certificate. The shop's own
  measured ranges are what the app uses.
- The blend is a mixture-rule recommendation from the declared steadier stream; it is not a claim
  that a physical blend was tested.
- No certification, food-contact or structural qualification is claimed.

## Why this can win

The hackathon asks for a real-world use of Meta models, not a generic chatbot. AnyRB has a specific
shop problem, a visually quiet one-page product, a verifiable model loop, and a refusal to let a model
invent a physical number. The demo shows a batch that would be rejected and a makeable plan that uses
it.

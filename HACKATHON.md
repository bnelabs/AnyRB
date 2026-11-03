# AnyRB — Meta Global AI Developer Hackathon submission

**Track:** Indie Developer · **Problem statement:** Build for Your World
**Solo builder:** Baris Nacierzeren
**One line:** AnyRB turns a measured recycled-plastic delivery into a makeable part — Meta reads the shop's ask and proposes moves; a deterministic checker proves which build stays inside every target.

## The problem

A small shop buys recycled plastic by the delivery. The swing is measured, not guessed: one
supplier's rHDPE plates came in at 1,350 ± 239 MPa (n=50), while a literature compilation sits at
1,213 ± 654 MPa and modulus spans 380–1,250 MPa across three US recyclers (research dossier 01,
sources R01/R02). Ten recycled-PP lots that all met the same specification still ranged 2–24 wt%
in filler content (R05). A single datasheet number cannot describe that delivery. A conventional
workflow either over-designs the part or rejects the delivery. The shop needs to know **what can I
make from this delivery, at what size, and what do I add if the delivery alone is not enough** — not a
verdict on the delivery.

The beneficiary is stated plainly: AnyRB is built for Konverta's own planned use in its
recycled-plastic work — the builder's company is the intended first user, and that planned
internal use is the use case claimed here. It has not been run on a production order yet, and
no customer, saving or market figure is claimed. The wider small-shop framing comes from the
segment research in `research/`. We claim *Build for Your World*; the checker-verified model
loop is the method, not a claim of new mechanics.

## What AnyRB does

1. **Ask in shop language.** The brief bar takes a natural-language typed request, such as: *"I make crate sides, 400 mm long, 60 mm wide and 15 mm thick, supported at both ends.
   Each side has to carry 95 to 115 kg, and one side should weigh 320 to 360 g. This delivery is
   recycled HDPE from one supplier, fairly clean."* No engineering units are needed in the ask:
   the delivery is set to the published range for the plastic named, labelled as published.
   Muse Spark parses it into a product, load path, dimensions, any number of target requirements and
   a batch description. The shop can edit every field; Muse Spark parses the typed text.
2. **Engineering.** The mechanics evaluates every candidate against **all** requirements at once. A
   build is shown only when its full property range stays inside every target. The winner brings in
   the least material per part — added section, or the steadier stream a blend would use in every
   part. A band-and-bar view shows, per requirement, what is needed against what the build gives
   across the swing, with the closest margin in numbers. The decision stays pinned at the top of
   the page while the shop edits below it. The UI starts with no product and no decision; examples
   are optional.
3. **Batch.** The delivery's measured swing and dirt are shown against what the build needs. The app
   gives the material gap, a declared steadier-stream blend when it closes the gap, and a place to ask
   Meta what to change or add. It never ends at "don't use this delivery."
4. **Verification.** Meta proposes moves; a deterministic verifier scores the exact proposal at the
   size proposed. Moves that do not pass are sent back to Muse Spark once, with the calculated
   ranges, for a different proposal. The mechanics then searches the passing size in the accepted
   direction. The UI shows what Meta proposed and what passed, labels local calculations as local,
   and says whether a Meta answer was a live call or a saved one. The browser never receives a
   model-authored result, strength, stiffness or weight.

## Meta models in the live path

| Model | Role | Endpoint |
|---|---|---|
| **Muse Spark 1.3 Contributor** | parse the natural-language shop brief into structured product/target/batch state | `/api/product/brief` (new) |
| **Muse Spark 1.3 Contributor** | propose engineering and batch moves | `/api/product/proposals` |
| **Muse Spark 1.3 Contributor** | answer the shop's batch question with grounded, number-only-from-input actions | `/api/product/advice` |

The browser never sees the API key. The server sanitises every model output, strips property/result
keys, clamps parameter values, grounds advice numbers to the request, and rejects certification claims; with no safety margin added, advice may honestly say to make one piece and check it first
instructions. If Meta is unavailable, the local mechanics still calculates the current build, the
minimum build and any declared blend; it does not invent alternatives or advice.

## The demo case

The active demo is an **explicit loadable case**, not a default product: a 400 mm simply supported
crate side, 60 × 15 mm, with **strength 95–115 kg** and **weight 320–360 g**. The delivery is a
**assembled published-data example, not one measured delivery**: stiffness 1,111–1,589 MPa
from a single supplier's stretch-film lot (measured 1,350 ± 239 MPa across 10 plates, n=50, R01 via
Georgiou 2025), strength 41.6–48.4 MPa from a full rHDPE property table (R04, Eriksen 2019), density
0.94 g/cm³ (R12). It stands in for a shop's own measured lot, which is what production use requires. The mechanics reports
**95.4–111.0 kg and 338.4 g** for the current build — inside both targets.

The planter case is an illustrative second example. The user can type any other part and add or
remove requirements. Sources and the honesty label are in
[`data/CASE_STUDY.md`](data/CASE_STUDY.md).

## What was built during the hackathon

See [`HACKATHON_WORK.md`](HACKATHON_WORK.md) for the commit/file map. The judged surface is:

- `app/` — the product-first, multi-requirement page and mechanics
- `server/product_ai.py`, `server/app.py` — Meta brief/proposals/advice endpoints and tests
- `V0_8_SPEC.md` — the current contract
- `demo/screenshots/v10/`, `demo/slides/` — checked screens and architecture slide
- `SUBMISSION.md`, `HACKATHON.md`, `DEMO_SCRIPT.md`, `DEPLOY.md` — submission pack

The retired v0.4–v0.7 bracket engine, its contracts, routes, prompts, tests and the legacy
verify script were deleted from the repository (the v1.0 server exposes only the three
product endpoints plus image/segment/provenance/health) — there is no pre-product history
left in the tree, and no old validation score is claimed for AnyRB.

## Run it

```bash
make setup                            # one-off: creates .venv, installs requirements
cp server/.env.example server/.env   # add a Meta Model API key; never commit it
.venv/bin/python -m server.app       # http://127.0.0.1:8787
python3 app/build.py                 # rebuild standalone root index from app/
node app/tests/model.test.mjs
node app/tests/page-wiring.test.mjs
node app/tests/combinations.test.mjs
AI_MOCK=1 .venv/bin/python -m pytest server/tests -q
```

For a public demo, use the deployment path in `SUBMISSION.md`; the key stays in the server
environment with a spend limit.

## Verification

- `node app/tests/model.test.mjs` — 70 checker tests (mechanics including weak-axis compression
  buckling, blank first open, multi-requirement selection, exact model trace, gap/blend ranking,
  source guards, family-constrained sort outcomes).
- `node app/tests/page-wiring.test.mjs` — 11 page-wiring tests; `combinations.test.mjs` — a
  13,200-case matrix (9 tests).
- `AI_MOCK=1 .venv/bin/python -m pytest server/tests -q` — 117 server tests (brief/
  proposals/advice contracts, verifier-feedback round, unit-aware extraction grounding,
  cache/provenance guards, retired-route tombstones, no-key, no-fallback).
- Browser smoke: first open makes no API call; exact Meta proposals show whether they pass in the
  trace; Meta answers are labelled live or saved; 1440 px and 390 px checked with the refreshed
  screens in `demo/screenshots/v10/`.

## Honest limits

- The mechanics is a rectangular-section model for loaded parts (bracket/slat/crate/planter/pallet
  block); it is not a general 3-D structural solver.
- The sample batch values are a labeled example, not a laboratory certificate. The shop's own
  measured ranges are what the app uses.
- The blend is a mixture-rule recommendation from the declared steadier stream — the optimistic
  end of blend behaviour; it is not a claim that a physical blend was tested. A blend is ranked by
  the steadier-stream grams it uses in every part, on the same axis as added section material.
- Compression uses weak-axis buckling with pinned ends (effective-length factor 1), stated here
  because the page does not ask about end fixing. No safety factor is added: the ranges the shop
  enters are the ranges checked, and the Engineering panel says so.
- No certification, food-contact or structural qualification is claimed.

## Why this can win

The hackathon asks for a real-world use of Meta models, not a generic chatbot. AnyRB has a specific
shop problem, a visually quiet one-page product, a verifiable model loop, and a refusal to let a model
invent a physical number. The demo shows a batch that would be rejected and a makeable plan that uses
it.

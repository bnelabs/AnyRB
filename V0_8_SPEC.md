# AnyRB v0.8 — the delivery-to-build plan

## The job

The shop has a recycled-plastic delivery whose properties swing. The shop needs a named part — a
bracket, a slat, a crate, a planter, a pallet block, or another loaded part — to stay inside a
physical-property range across that swing.

AnyRB answers with a build, a material recipe, or both. It never ends at “don’t use the delivery.”

## Audience

A small shop that knows its part and its target range, has measured its delivery, and can change the
section, span, load path, product, or material feed. The app is not a certification tool and does not
require a lab.

## The start

The first view asks **What do you want to make?** There is no default part and no default decision.
The user can type any part or start from a short example row: bracket, slat, crate, planter, pallet
block. They set the load path, dimensions and **one or more output requirements** (strength, stiffness,
weight). Every requirement must hold at once. Adding a second or third property is a normal state, not
an advanced mode.

## The decision

Once the part and the requirements are valid, the first view gives one answer:

- `Make the 180 mm shelf bracket, 40 × 15 mm.` — a passing build from the current delivery.
- `Blend 65% of stiffer bottle stream, then make the 180 mm shelf bracket, 40 × 10 mm.` — a passing
  build that needs the declared steadier stream.
- `Narrow the strength swing.` or `Lift the strength low end by 27.0 MPa.` — no build passes yet; the
  required material range and the delivery's gaps are stated as the next action. The Batch section
  gives the levers.

The support line states every required property range and every gap. The black pill copies the build
or, when there is no build, becomes **Ask Meta** and asks the batch question.

## Engineering

Inputs: product name, load path (fixed at one end / supported at both ends / compression), span,
width, thickness, one or more target properties with low/high ranges, other product. The user can add
and remove requirements; a build must satisfy all of them simultaneously.

The mechanics:

- cantilever capacity `σ·b·t²/(6L)`, stiffness `3EI/L³`;
- simply supported capacity `2σ·b·t²/(3L)`, stiffness `48EI/L³`;
- compression capacity `min(σA, π²EI_weak/L²)`, stiffness `EA/L`;
- mass `ρ·b·t·L/1000` g.

Every range is evaluated across the delivery's full stiffness and strength swing. A proposal is shown
only when the whole range sits inside the target. The winner is the passing build with the least added
build mass.

Meta proposes move types (thickness, section, span/load path, other product, blend). The mechanics
searches the passing size in the proposed direction. When Meta is unavailable, the app still
calculates the current build, a minimum thickness and any declared blend; it does not substitute a
fixed list of four moves.

## Batch

Inputs: plastic type, batch, mix, dirt level and what is in it, measured stiffness low/high, measured
strength low/high, density, and an optional steadier stream with its type, stiffness and strength.

The Batch section shows:

- what the chosen build needs as a material range;
- what the delivery gives;
- the short end or over-range, in the property's own unit;
- a blend recipe when the steadier stream is declared and the mixture closes the gap;
- **Ask Meta about this batch** — a plain-language question answered by the grounded advice endpoint.

If no build passes, the gap is the answer: add a stream that reaches the required range, sort/wash/dry
the soft fraction, change the section or span, use the other product, or split the delivery. Never
“don’t use this batch.”

## Meta boundary

- `POST /api/product/proposals` returns parameter-only move proposals for the user's part and all
  targets. The server sanitises allow-listed keys, clamps values and strips property/result keys.
  Unavailable → empty list.
- `POST /api/product/advice` returns a short answer and up to five actions addressing every supplied
  requirement/gap. The answer is number-grounded to the request. Unavailable, ungrounded,
  certification or test-instruction output → empty `available:false`; no fixed advice fallback.
- The API key is server-only. The browser sends no key.
- The model is not allowed to invent strength, stiffness, weight or measured results.

## Copy

`Copy build` writes the headline, plastic and batch, mix/dirt, blend percentage when relevant, property
range, added material and move. It is the shop's build ticket.

## Tests

- `node app/tests/model.test.mjs` — mechanics, empty start, case presets, multi-requirement pass,
  minimum build, blend rule, model move search, no fixed-fallback, no rejection copy, advice payload
  shape, source guards.
- `AI_MOCK=1 python3 -m pytest server/tests -q` — server contract, mock/empty behavior, grounding,
  test-instruction guard, key safety.

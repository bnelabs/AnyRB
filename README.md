# AnyRB

**Turn a changing recycled-plastic delivery into a build that still hits the range.**

You name the part. You set the strength, stiffness or weight range it has to hold. You describe what
this delivery actually measures and what is in it. AnyRB finds the build and the material recipe that
keeps the part inside the range — and shows the next thing to do when the delivery alone is not enough.

It does not reject the delivery. A dirty, soft or mixed batch is an input, not an ending.

## The page

The page does not begin with a bracket. It begins with the question **What do you want to make?**
The product, load path, dimensions and every output requirement belong to the user. There is no
default part and no default decision. A short row of examples — bracket, slat, crate, planter, pallet
block — can fill a starter case, but every field stays editable.

One page, four quiet parts:

1. **The brief.** The shop can type a natural-language request — the part, several property ranges
   and the delivery. Muse Spark extracts it into editable fields; missing fields stay empty. The
   sample brief is optional; the product is not preset.
2. **The decision.** What to make, at what size, and with what blend or material change. One line of
   support. One black button: copy the build or ask Meta when there is no build yet.
3. **Engineering.** The named product, load path, span and section, and **one or more** property
   requirements. The user can add strength, stiffness and weight ranges together; every requirement
   has to hold at once. The mechanics calculates each property range from the plastic swing. A
   proposal appears only when its full set of ranges stays inside every target. The winner uses the
   least added build mass.
4. **Batch.** The delivery's measured stiffness and strength swing, dirt level and what is in it; what
   the chosen build needs for every requirement; the gaps; the declared steadier stream; and a place
   to ask Meta what to do with this batch.

The first open asks for the product and the first property. Choose an example or type a different part;
add more properties when the part has more than one requirement. Change any number and the decision
updates in place.

## What the app will never do

- It will not say **“don’t use this delivery.”** If no build passes, it states the material range the
  build needs, the gap, and the available levers: add a steadier stream, sort/wash/dry, change section
  or span, move the delivery to another product, or split it.
- It will not invent strength, stiffness, weight, measured results, certification or a property value.
  All mechanics numbers are calculated from the shop's inputs. Meta may propose moves and explain
  tradeoffs, but it is grounded to the supplied numbers.
- It will not fall back to a fixed list of four moves when Meta is unavailable. With no model, the
  local mechanics still shows the current build, the calculated minimum, the declared blend recipe
  and the material gap; it shows no invented alternatives and no invented advice.
- It will not tell the user to go test a piece or trial a prototype. The answer is a build or a
  material action, not a test assignment.
- It will not assume a shelf bracket, a cantilever, or a single output property. Those are examples
  the user can choose, not defaults.

## The model boundary

The browser never receives an API key. Meta calls go through the local FastAPI server:

- `POST /api/product/brief` — Muse Spark extracts a product, load path, dimensions, any number of
  target requirements and a batch description from the shop's natural-language brief. Extract-only:
  unstated numbers stay empty. Unavailable → no parse, manual fields.
- `POST /api/product/proposals` — Meta proposes move types and optional parameters for the user's part
  and **all** target properties. The browser scores the mechanics; the server sanitises parameters
  and never returns strength/stiffness/weight results. If Meta is unavailable it returns an empty
  proposal list; there is no fixed-list fallback.
- `POST /api/product/advice` — the user asks a plain-language batch question. The app sends its
  calculated plan, all requirements and the gaps. Meta returns practical actions addressing every
  supplied requirement, using only the supplied numbers, or an empty `available:false` response.
  There is no fixed advice fallback.

The app works without the server for the local mechanics. The AI sections need the server.

## Open it

```bash
# 1. Start the local AI server (Meta key stays in server/.env on this machine only)
.venv/bin/python -m server.app
# -> http://127.0.0.1:8787

# 2. Open the built page
open http://127.0.0.1:8787/
```

A direct `file://` open also works for the local mechanics; it calls the same local server at
`127.0.0.1:8787` for Meta.

For a public judge demo, use [`DEPLOY.md`](DEPLOY.md) (`Dockerfile` + `render.yaml`); the key stays in the
server environment. The hackathon pack is [`HACKATHON.md`](HACKATHON.md), with a 3-minute script in
[`DEMO_SCRIPT.md`](DEMO_SCRIPT.md) and submission checklist in [`SUBMISSION.md`](SUBMISSION.md).

## Build and test

```bash
python3 app/build.py               # app sources -> index.html + app/standalone.html
node app/tests/model.test.mjs      # mechanics, material gap, blend, model-boundary and UI guards
AI_MOCK=1 python3 -m pytest server/tests -q
```

The working repo also has the historical bracket-engine tests and a `make verify` target. They are not
part of the judged surface and their validation scores are not claimed for this app. The clean
submission tree removes them (see [`SUBMISSION_REPO.md`](SUBMISSION_REPO.md)).

The active app has no browser runtime dependencies.

## Files

```
anyrb/
├── app/
│   ├── index.html      the one page: product question, Engineering, Batch, Ask Meta
│   ├── styles.css      quiet white page, one system sans, one black pill
│   ├── product.js      pure mechanics, multi-requirement gap/blend/selection logic
│   ├── main.js         DOM layer, case presets, local scoring, model calls
│   ├── build.py        inlines the sources into one standalone page
│   ├── tests/          mechanics, gap, blend and app-source tests
│   └── README.md
├── server/             FastAPI backend; Meta Spark proposals and batch advice
├── index.html          built standalone page (open this)
├── V0_8_SPEC.md        the current product contract
├── history/v0.7-app/   retired v0.7 app; not built or linked
├── engine/             historical bracket engine
├── validation/         historical validation suite
└── demo/screenshots/   checked screens
```

The v0.7 measured-piece app is history. The research notes and the bracket engine are outside the
active page.

## What this does not claim

AnyRB is a design and material-blending aid, not a certification or a prediction of a measured part.
The mechanics uses a rectangular-section model and the ranges the shop supplies. It does not claim
food contact, structural certification, or that a blend has been physically tested. The blend recipe
is a mixture-rule recommendation from the declared stream values; the shop still owns the processing.

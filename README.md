# AnyRB

**Tell it what you want to make and what plastic just arrived. AnyRB tells you the size to make it, whether that delivery can hold it, and what to change when it can't.**

A small shop buys recycled plastic by the delivery, and no two deliveries bend or break the same
way. AnyRB turns one delivery into a decision: a build that holds, a blend that closes the gap, or
the exact change — thicker section, a mix-in plastic, different part — that makes the delivery
usable. If a delivery cannot hold the part as entered, the result is the material range the part
needs and the changes that could close the gap.

## Why this exists

Recycled plastic's swing is measured, not guessed. One supplier's recycled-HDPE plates measured
1,350 ± 239 MPa across 50 samples; measured across three US recycling facilities the same
material runs from 380 to 1,250 MPa, and ten recycled-polypropylene lots that all passed the
same specification still ranged from 2% to 24% filler (sources in
[data/SOURCES.md](data/SOURCES.md)).
A part designed to one datasheet number is over-built for most deliveries and under-built for the
weak one. The usual answers are to reject the odd delivery or to make everything heavier.
AnyRB is the third answer: design to the delivery you actually have.

## How you use it

The page asks one question — **What do you want to make?** — and needs three things, in any order:

1. **The part.** Type it or say it: *"I make crate sides, 400 mm long, 60 mm wide and 15 mm thick,
   supported at both ends. Each side has to carry 95 to 115 kg, and one side should weigh 320 to
   360 g."* Muse Spark (or Muse Voice Transcribe first, if you speak) turns that into editable
   fields. It only writes down what you said.
2. **This delivery.** Pick the kind of plastic and start from its **published range** — recycled
   HDPE, polypropylene, mixed plastics, PET, PETG, LDPE — or, if your supplier gave you numbers,
   enter those instead. You are not expected to know stiffness and strength values; the published
   range is labelled as published wherever it is used, and your own numbers replace it the moment
   you type them. Two of those bands (mixed plastics and LDPE) rest on thin published evidence —
   the library behind them grades it D and says not to use it for load-bearing claims — and the
   page repeats that warning when you check a load on them.
3. **The decision.** The headline at the top becomes the answer and stays pinned there while you
   edit: the size to make, what it carries and weighs across the whole swing of this delivery,
   and — under it — a bar for each requirement showing what you need against what the build
   gives, with the closest margin in plain numbers. One button copies the build for the shop
   floor. If nothing passes, the headline names the change instead, the bars show what your
   current build actually does, and the page states what the plastic would need to be.

Change any number and the answer updates in place. Add a second or third requirement — strength
and weight and stiffness together — and every one of them has to hold at once. State how many
parts are in the run and grams become kilograms.

A **Progress** list under the question shows where you are at all times: the part, what must
hold, this delivery, the Meta check, and the decision — each marked done or not, with one line
naming the single next thing to do. **Results live on the page** (decision at the top, builds and
range view below) and can be taken away as a build ticket (.txt, for the shop floor), a table
(.csv, for a spreadsheet), or the same results as data (.json, in metric with the units named in
the file).

**Units** switch between metric and imperial from the top of the page. Fields, requirements,
ranges, margins and the build ticket all convert; the checker itself always calculates in metric.

## Sixty seconds, with the numbers the app gives

- Open the page, choose **Crate**. The build carries **95.4–111.0 kg** and weighs **338.4 g** —
  inside the 95–115 kg and 320–360 g requirements. The strength bar shows why this is a close
  call: **closest margin 0.4 kg at the low end**. A slightly weaker delivery would fail it.
- Tighten the requirement to **130–150 kg**. Now no build passes, and the app says so in the
  part's own terms first: as it stands it carries 95.4–111.0 kg, and thickening the part can't
  fix a delivery that varies this much — so the levers are mixing in another plastic, sorting
  the weakest pieces out, a different size, or a different part for this delivery. (The worked
  case in [data/CASE_STUDY.md](data/CASE_STUDY.md) also gives the supplier-sheet numbers behind
  that verdict, for anyone who has them.)

Both cases are written out in [data/CASE_STUDY.md](data/CASE_STUDY.md).

## What Meta does here

Four jobs, all through the local server — the browser never holds an API key:

| Job | Model | What you see |
|---|---|---|
| Read the typed or spoken brief into fields | Muse Spark 1.3 Contributor, Muse Voice Transcribe | Editable fields; anything you didn't say stays empty |
| Propose sizes and delivery moves | Muse Spark 1.3 Contributor | Each proposal checked at the exact size proposed; what doesn't pass is shown, then sent back to Muse Spark once with the checked ranges |
| Answer "what should I add or change?" | Muse Spark 1.3 Contributor | Actions using only your numbers, or nothing when it has nothing grounded to say |
| — | — | Every model answer — brief, proposals, advice and voice — names the model that answered, whether it is live or a saved answer, and how long it took |

The model proposes; a deterministic checker disposes. No strength, stiffness or weight on the
page is written by a model — every one is calculated from the part size and the delivery range,
and the page labels each build "proposed by the model," "direction from the model, size
calculated here," or "calculated here." Without the server, the checker still runs on your
numbers; with no model available the page shows the calculated build and the material gap, and no suggested moves.

### Using another provider

Meta is the built-in provider and the one this app is built around. **Settings** (top right) can
instead use a different provider — OpenRouter, OpenAI, Anthropic, Google, NVIDIA, DeepSeek, a
custom endpoint that works like OpenAI, or no model at all — behind an explicit "use a different
provider" step. Each takes its endpoint, model name and your own key; only Meta can use the
server's key, and a request naming another provider without your key sends no key anywhere.
Other providers are exercised with simulated transports in the tests, not with live keys. A key
stays in the browser tab, is sent only to the server on this machine when the model is called,
and is gone when the tab closes. Voice is only available with Meta.

## Where the numbers come from, and the edges of the checker

Mechanics: standard beam and column formulas for a solid rectangular section — fixed at one end,
supported at both ends, or standing in compression, where a thin part is checked for buckling
about its weak axis rather than credited with load it can't carry. Requirements are checked
across the delivery's full range, all at once; the winning build is the one that brings in the
least material per part. The ranges you enter are checked as entered — no hidden safety factor —
and the Engineering panel says so on the page. It is a rectangular-section checker, not a general
structural solver, and it certifies nothing.

Delivery ranges: yours if you enter them; otherwise the published bands in
`data/feedstock_library.json` and [data/CASE_STUDY.md](data/CASE_STUDY.md), each labelled with its
source at the point of use.

## Run it

```bash
cp server/.env.example server/.env   # add a Meta Model API key (gitignored)
.venv/bin/python -m server.app       # http://127.0.0.1:8787
```

Open http://127.0.0.1:8787. Opening the built `index.html` directly also works for the checker;
it calls the same local server for Meta. `Dockerfile` and `render.yaml` describe a one-process
deployment; the API key stays in the server environment, never in the page.

## Test it

```bash
python3 app/build.py                                    # rebuild index.html from app/
node app/tests/model.test.mjs                           # 61 app tests
node app/tests/combinations.test.mjs                    # 13,200-case combination matrix
AI_MOCK=1 .venv/bin/python -m pytest server/tests -q    # 137 server tests (1 live smoke skipped)
```

## What's in this repository

| Path | What it is |
|---|---|
| `app/` | The page: `product.js` (checker), `main.js` (page), `index.html`, `styles.css`, tests |
| `server/` | FastAPI server: Meta calls, sanitising, grounding (`product_ai.py`, `meta_client.py`) |
| `data/` | The worked cases, their sources, and the published feedstock ranges the delivery picker uses |
| `demo/` | Product screenshots, architecture slide, reference video |
| `LICENSE` | MIT |


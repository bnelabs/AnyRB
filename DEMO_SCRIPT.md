# AnyRB — 3-minute demo script

> No draft cut ships in the repo — record the final video fresh from a clean state using this script. Keep the narration in your own voice, and re-record the failure case if you want a full 3:00 cut.

**Track:** Build for Your World · Indie Developer
**Tone:** quiet, specific, no feature tour. One shop, one batch, one failure, one makeable plan.

## Before recording

- Server live on a public URL (or localhost) with `META_API_KEY`; `/api/health` shows live.
- Clear the brief field, reset the page. Do not show `.env`, keys, browser devtools, or the old bracket
  studio.
- Have the sample brief ready but do not auto-fill before the recording.
- Record at 1440×900 or 1920×1080; phone shot optional at 390 px.

## Script

### 0:00–0:15 — The problem

**Say:** “A small shop makes crate sides from recycled HDPE. Same part, same mould — but every
delivery swings, and rejecting the odd one is expensive. This demo uses one published stretch-film lot
for stiffness and a published full property table for strength, standing in for the shop's own measured
lot. AnyRB tries to make a plan from the delivery instead.”

### 0:15–0:30 — Open on the question

Show the first screen: **What do you want to make?** Product and property empty; no bracket default.
Point at the examples row but do not choose one yet.

**Say:** “The shop names the part and the properties that have to hold. No preset product.”

### 0:30–0:55 — Meta reads the brief

Click **Try an example** (or type it and press **Fill in the form**):

> “I make crate sides, 400 mm long, 60 mm wide and 15 mm thick, supported at both ends. Each side
> has to carry 95 to 115 kg, and one side should weigh 320 to 360 g. This delivery is recycled HDPE
> from one supplier, fairly clean, with paper labels on some of it.”

Note what this brief does **not** contain: no stiffness, no strength, no MPa. The shop should never
have to speak in supplier-sheet units. Show the status while the form is filled in (say
out loud that a live read takes about ten seconds), then the parsed fields, and the delivery line:
the delivery has been set to the **published measured lot for one supplier's recycled HDPE**,
labelled as a published range, not a measurement of this delivery.

**Say:** “Muse Spark turns the shop language into editable state. It only writes down what was
said. Because the shop named the plastic, the delivery starts from its published range — and the
page says that's what it is.”

### 0:55–1:20 — See the range, then the checker

Show the result under **Builds that work**: for each requirement, the pale band is what the shop
needs, the dark bar is what the build gives from the weakest to the strongest end of this delivery.
Point at the strength margin — **0.4 kg to spare**. That thin margin is the whole problem in
one picture, and it is why a single datasheet number is not enough. The decision itself says so:
“no safety margin added — make one and check it before a run.”

Open the checked-proposals list under the builds. Note the line naming the model and whether
the answer is live or a saved one — say which one this is.

**Say:** “Muse Spark proposed sizes. The checker scores each one at the exact size proposed,
against every requirement across the delivery's whole range. What does not pass is shown, and
goes back to Muse Spark once with the checked ranges. The model cannot invent a strength or
a weight.”

### 1:20–1:55 — A batch that doesn't fit (worked case, exact numbers in `data/CASE_STUDY.md`)

Keep the crate case and change only the strength requirement to **130–150 kg**. The headline becomes
**“This delivery varies too much in strength.”** The result now shows the current build's own bar: it carries
**95.4–111.0 kg**, 34.6 kg short at the low end. “What this delivery would need” states, in plain
actions, why thickening cannot fix a delivery that varies this much. Scroll as little as possible: the
decision stays pinned at the top of the page while you edit.

**Say:** “This is the important case. The app does not say ‘don’t use the batch.’ It shows what the
part actually carries today, what range the build needs, how far the delivery is from it, and what
to add or change.”

Click **Ask about this delivery**. Show the grounded answer with concrete actions — mix in
another plastic, sort the weakest pieces out, change the size, or route the delivery. If it
says make one piece and check it first, keep that in: no safety margin is added, so that is
honest advice, not a gap in the product.

### 1:55–2:25 — One makeable plan

Go back to the passing crate case. Point at:

- the build: `400 mm crate side, 60 × 15 mm`
- the two ranges it satisfies: 95.4–111.0 kg and 338.4 g
- the sourced delivery: a published measured rHDPE lot, named on the page
- the **Copy build** button

**Say:** “The shop leaves with a build that holds and a margin it can see, not a rejected
delivery. The model proposed; the checker decided; the screen shows both.”

### 2:25–2:45 — Under the hood

Cut to a simple architecture overlay or the README:

- `app/product.js` — rectangular-section checker, full delivery range, least added material
- `/api/product/brief` — Muse Spark extracts the shop ask
- `/api/product/proposals` — Muse Spark proposes moves; server sanitises parameters
- `/api/product/advice` — grounded actions, all requirements, no invented numbers
- 81 app tests, a 13,200-case combination matrix (9 tests), 117 server tests; browser never receives the key

**Say:** “The model is in the front door and in the explanation; a deterministic checker owns
every physical number, and every answer names the model and whether it was live or saved.”

### 2:45–3:00 — Close

Show the title, public repo URL and live URL.

**Say:** “Recycled plastic is not a datasheet. It is a distribution. AnyRB makes the distribution
makeable. The live demo and code are at …”

## Do not show

- Settings, the provider list, units switching, cost fields, Share, or the .json download. The story is one decision, not the feature list.

- The v0.4–v0.7 bracket studio, the old 56-pass validation, the old four-model claims, or the
  old `HACKATHON.md` script.
- A fake measured batch. Say “example batch” on screen if it is one.

## Shot list

1. First open, no product.
2. Example brief + “Filling in the form…”
3. Parsed fields with two requirements.
4. Decision + build list.
5. Checked model proposals.
6. What this delivery would need + Ask about this delivery answer.
7. A failing delivery + the change that could close it.
8. Architecture overlay.
9. Public URL + close.

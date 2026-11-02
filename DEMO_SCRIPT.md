# AnyRB — 3-minute demo script

> A **draft screen recording with synthetic narration** is at [`demo/anyrb-demo-draft.mp4`](demo/anyrb-demo-draft.mp4). It is a pacing/reference cut, not the final submission video. Replace the narration with your own voice, and re-record the failure case if you want a full 3:00 cut.

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
lot. AnyRB tries to make a plan from the batch instead.”

### 0:15–0:30 — Open on the question

Show the first screen: **What do you want to make?** Product and property empty; no bracket default.
Point at the examples row but do not choose one yet.

**Say:** “The shop names the part and the properties that have to hold. No preset product.”

### 0:30–0:55 — Meta reads the brief

Click **Use a sample brief** (or press **Speak** and say the same brief, or paste it):

> “I make crate sides, 400 mm long, 60 mm wide and 15 mm thick, supported at both ends. Each side
> has to carry 95 to 115 kg, and one side should weigh 320 to 360 g. This delivery is recycled HDPE
> from one supplier, fairly clean, with paper labels on some of it.”

Note what this brief does **not** contain: no stiffness, no strength, no MPa. The shop should never
have to speak in supplier-sheet units. Show the status **Muse Spark is reading the brief…** (say
out loud that a live read takes about ten seconds), then the parsed fields, and the Batch line:
the delivery has been set to the **published measured lot for one supplier's recycled HDPE**,
labelled as a published range, not a measurement of this delivery.

**Say:** “Muse Spark turns the shop language into editable state. It only writes down what was
said. Because the shop named the plastic, the delivery starts from its published range — and the
page says that's what it is.”

### 0:55–1:20 — See the swing, then the verifier

Show the range view under **Builds that pass**: for each requirement, the pale band is what the shop
needs, the solid bar is what the build gives across the full delivery swing. Point at the strength
margin line — **closest margin 0.4 kg at the low end**. That thin margin is the whole problem in
one picture, and it is why a single datasheet number is not enough.

Open the **Meta → verifier** trace under the list. Note whether the page labels the Meta answer
live or saved — say which one this is.

**Say:** “Muse Spark proposed moves. The verifier checks each one at the exact size proposed,
against every range across the full plastic swing. What does not pass is shown, and is sent back
to Muse Spark once with the checked ranges. Then the mechanics searches the passing size in the
accepted direction. The model cannot invent a strength or a weight.”

### 1:20–1:55 — A batch that doesn't fit (worked case, exact numbers in `data/CASE_STUDY.md`)

Keep the crate case and change only the strength requirement to **130–150 kg**. The headline becomes
**“Narrow the strength swing.”** The range view now shows the current build's own bar: it carries
**95.4–111.0 kg**, 34.6 kg short at the low end. The Batch gap states what this build needs —
**56.7–65.4 MPa** — against the delivery's **41.6–48.4 MPa**. Scroll as little as possible: the
decision stays pinned at the top of the page while you edit.

**Say:** “This is the important case. The app does not say ‘don’t use the batch.’ It shows what the
part actually carries today, what range the build needs, how far the delivery is from it, and what
to add or change.”

Click **Ask Meta about this batch**. Show the grounded answer with concrete actions — wash/sort,
add the steadier stream, change the section, or route the batch. No test instructions.

### 1:55–2:25 — One makeable plan

Go back to the passing crate case. Point at:

- the build: `400 mm crate side, 60 × 15 mm`
- the two ranges it satisfies: 95.4–111.0 kg and 338.4 g
- the sourced batch: 1,111–1,589 MPa stiffness, 41.6–48.4 MPa strength
- the **Copy build** button

**Say:** “The shop leaves with a build and a batch recipe, not a rejected delivery. The model proposed;
the mechanics disposed; the screen shows both.”

### 2:25–2:45 — Under the hood

Cut to a simple architecture overlay or the README:

- `app/product.js` — rectangular-section mechanics, full-swing range, least material
- `/api/product/brief` — Muse Spark extracts the shop ask
- `/api/product/proposals` — Muse Spark proposes moves; server sanitises parameters
- `/api/product/advice` — grounded actions, all requirements, no invented numbers
- 32 app tests + 138 server tests; browser never receives the key

**Say:** “This is a verifiable agent for a physical workflow. The model is in the front door and in
the explanation; the deterministic verifier owns every physical number.”

### 2:45–3:00 — Close

Show the title, public repo URL and live URL.

**Say:** “Recycled plastic is not a datasheet. It is a distribution. AnyRB makes the distribution
makeable. The live demo and code are at …”

## Do not show

- The v0.4–v0.7 bracket studio, the old 56-pass validation, the old four-model claims, or the
  old `HACKATHON.md` script.
- Any test/trial/prototype instruction.
- A fake measured batch. Say “example batch” on screen if it is one.

## Shot list

1. First open, no product.
2. Sample brief + “Meta is reading…”
3. Parsed fields with two requirements.
4. Decision + build list.
5. Meta → verifier trace.
6. Batch gap and Ask Meta answer.
7. A failing batch + material action.
8. Architecture overlay.
9. Public URL + close.

# AnyRB — 3-minute demo script

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

**Say:** “A small shop makes crate sides from recycled HDPE. Same part, same mould — but this delivery
is a mixed-rigid MRF stream, and its stiffness can swing from 380 to 1,250 MPa. The usual choice is
over-design the part or reject the batch. AnyRB tries to make a plan from the batch instead.”

### 0:15–0:30 — Open on the question

Show the first screen: **What do you want to make?** Product and property empty; no bracket default.
Point at the examples row but do not choose one yet.

**Say:** “The shop names the part and the properties that have to hold. No preset product.”

### 0:30–0:55 — Meta reads the brief

Click **Use a sample brief** (or paste the same brief):

> “I make a 400 mm crate side, 60 mm wide and 15 mm thick, simply supported. It must have a load
> capacity of 95–115 kg (strength requirement) and a weight of 320–360 g (weight requirement). My
> batch is a published measured rHDPE range: 380–1,250 MPa stiffness, 41.6–48.4 MPa strength, density
> 0.94.”

Show the status **Meta is reading the brief…**, then the parsed fields: product, compression, two
requirements, batch range and steady stream.

**Say:** “Muse Spark turns the shop language into editable state. It only extracts what was said;
missing fields stay empty. The shop can correct anything.”

### 0:55–1:20 — Engineering + verifier

Show the decision and the **Builds that pass** list. Open the **Meta → verifier** trace under the list.

**Say:** “Muse Spark proposed moves. The verifier checks the exact proposal against every range across
the full plastic swing. Rejected proposals are shown, not hidden. Then the mechanics searches the
passing size in the accepted direction. The model cannot invent a strength or a weight.”

Show the **Batch** pane: strength/weight needed vs delivery. The 400 mm crate side, 60 × 15 mm,
reports **95.4–111.0 kg** and **338.4 g** — inside both requirements.

### 1:20–1:55 — A batch that doesn't fit

Change one requirement or the batch low end so the current geometry fails. Use a second case:
raise the crate requirement or lower the batch strength. Show the headline **Narrow the … swing** or
**Lift the … low end**.

**Say:** “This is the important case. The app does not say ‘don’t use the batch.’ It tells the shop
what range the build needs, how far the delivery is from it, and what to add or change.”

Click **Ask Meta about this batch**. Show the grounded answer with concrete actions — wash/sort,
add the steadier stream, change the section, or route the batch. No test instructions.

### 1:55–2:25 — One makeable plan

Go back to the passing crate case. Point at:

- the build: `400 mm crate side, 60 × 15 mm`
- the two ranges it satisfies: 95.4–111.0 kg and 338.4 g
- the sourced batch: 380–1,250 MPa stiffness, 41.6–48.4 MPa strength
- the **Copy build** button

**Say:** “The shop leaves with a build and a batch recipe, not a rejected delivery. The model proposed;
the mechanics disposed; the screen shows both.”

### 2:25–2:45 — Under the hood

Cut to a simple architecture overlay or the README:

- `app/product.js` — rectangular-section mechanics, full-swing range, least material
- `/api/product/brief` — Muse Spark extracts the shop ask
- `/api/product/proposals` — Muse Spark proposes moves; server sanitises parameters
- `/api/product/advice` — grounded actions, all requirements, no invented numbers
- 26 app tests + 135 server tests; browser never receives the key

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

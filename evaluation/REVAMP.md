# AnyRB — revamp after the judges' verdict

Lead re-score against the same rubric (judges' reports are the pre-revamp record in this folder).
This is a re-score of the code and docs as they now stand, not a prediction about the live video.

| Category | Weight | Before | After | What moved it |
|---|---:|---:|---:|---|
| Impact | 30% | 5.5 | 7.0 | Consequence and run size on screen, blend priced, pain cited, worked failure case |
| Use of Meta AI Tooling | 25% | 6.0 | 7.5 | Verifier-feedback round, live/saved labels, origin labels, committed live evidence |
| Demo | 25% | 5.0 | 6.5 | Range view, pinned decision, first-open path, refreshed screens — video is still the draft |
| Technical Depth | 20% | 5.5 | 7.5 | Buckling bug fixed and regression-tested, gap names buckling, limits stated |
| **Total** | | **5.5** | **7.1** | |

## Finding → fix

1. **Compression buckling (Technical P0).** `weakInertia` now cubes the short side
   (`app/product.js`). The gap diagnosis names buckling and stops asking for stronger plastic when
   stiffness is the limit. The planter example is reframed as a panel supported at both ends
   (9–12 kg, carries 9.1–11.7 kg); the correction is stated in `data/CASE_STUDY.md`. Four new app
   tests hold the numbers (32 app tests, all passing).
2. **No picture of the swing (Demo/UX P0).** Every requirement now has a band-and-bar view: pale
   band = what you need, solid bar = what the build gives across the full swing, with the closest
   margin in numbers (the crate case shows its 0.4 kg low-end margin). On failure the same view
   shows the current build's own bar and how far it is short.
3. **Meta load-bearing + visible (Meta P1).** Exact proposals that do not pass are returned to
   Muse Spark once with the verifier's calculated ranges (`verifier_feedback`, sanitised in
   `server/product_ai.py`, two new server tests). Builds are labelled "proposed by Muse Spark",
   "direction from Muse Spark, size calculated here", "calculated here" or "your build as
   entered". Brief and proposal answers are labelled live or saved. One real live check is
   committed at `server/evidence/product_live_calls.json` (brief live in 9.6 s; it also caught and
   fixed a brief mis-mapping — "load capacity" in kg is now stated as a strength target in the
   extraction prompt, guarded by a test; 138 server tests, all passing).
4. **Consequences (Impact).** A failing decision states what the current build actually carries /
   weighs against the requirement, in part units, and the copied plan carries the same line. An
   optional run size turns grams a part into kilograms a run. A blend is charged the steadier
   stream it uses in every part and ranked on that axis; its row shows the % and the grams a part.
5. **First open (Demo/UX).** Three readiness steps (part / what must hold / this delivery) fill in
   as the shop types. "Read with Meta" is a filled button, "Speak" an outlined one, the sample
   brief and the examples are proper choices, and a pinned decision bar keeps the headline and its
   action on screen while editing below. The phantom 0 × 0 mm trace row is gone (blank other
   products are filtered before the trace), and trace wording is "passes / does not pass" with the
   second-round note.
6. **Pitch evidence (Impact).** `HACKATHON.md` now carries the measured swing (1,350 ± 239 MPa,
   n=50; 1,213 ± 654 MPa compilation; 2–24 wt% filler across spec-compliant lots, dossier 01),
   states the beneficiary's validation status plainly, and the failure case is worked with exact
   numbers in `data/CASE_STUDY.md` and `DEMO_SCRIPT.md`. Architecture slide counts corrected
   (32/138). The Engineering panel and spec state the limits in place: solid rectangular section,
   pinned-end buckling, and no added safety factor — the ranges entered are the ranges checked.
7. **Screens.** `demo/screenshots/v10/` refreshed from the current build: `first-open-blank.png`,
   `decision-range.png`, `failure-gap.png`, `mobile-first.png`; the pack list in `demo/README.md`
   now matches the files.

## What did not change, deliberately

- Retired v0.3/v0.4 server routes and their 52 tests stay in the working repo; the submission
  packaging script already strips them, and `HACKATHON_WORK.md` quarantines them. Removing them
  here would have traded a judged-surface cleanup for a broken test suite.
- The blend mixture rule is still the linear rule; it is now priced in the ranking and disclosed
  as the optimistic end in `HACKATHON.md`, not replaced with an invented blend model.
- No new product claims: no customers, savings, or accuracy figures were added anywhere.

## Remaining, in the builder's hands (not scored here)

- The reference video is still the 2:42 synthetic-narration draft; `DEMO_SCRIPT.md` is updated to
  the new screens and the worked failure case for the final recording.
- One named shop's own measured delivery run through the product is the remaining Impact evidence
  no document can substitute for (judge-impact, Fix 5).

## Second round (2026-11-02, after builder review of the live page)

The live page exposed what the reports had only named (Impact Fix 3): the Batch
panel asked for stiffness/strength low–high in MPa as a first-class input, which
a shop user does not have. Fixed in the product, not in the wording:

- Batch now starts with "What do you know about this delivery?" — a published
  range for the plastic (recycled HDPE incl. the measured one-supplier lot,
  recycled PP, mixed polyolefins, PET, LDPE, from `data/feedstock_library.json`
  / `data/CASE_STUDY.md`), each labelled "Not a measurement of your delivery"
  where it is applied. The MPa fields moved behind "Have numbers from a
  supplier sheet or your own test?" with a plain explanation of stiffness,
  strength, and why the low end governs.
- The sample brief is now shop language with no engineering units at all
  ("…has to carry 95 to 115 kg… recycled HDPE from one supplier, fairly
  clean"). Muse Spark extracts part and requirements; the delivery is set to
  the matching published range from the shop's own words, labelled on the
  page. Verified live end-to-end (passing crate build, correct band applied).
- Waiting is visible: the headline area says a live read takes about ten
  seconds, the pinned bar says when moves are being checked with Muse Spark,
  the gap panel explains "needs vs gives" once instead of repeating bare MPa,
  and a "See the build and how its ranges sit" link appears with the decision.
- Repository: the nine stale root documents (PRODUCT_SPEC, PRODUCT_V2, REPORT,
  REVIEW_RESPONSE, V0_3–V0_7 specs) moved to `docs/archive/` with an index
  stating they describe the retired product only; README rewritten to answer
  what this is, why it exists, and how it is used in the first screen.
34 app tests and 138 server tests pass after this round.

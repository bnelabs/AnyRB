# AnyRB — Meta judges' verdict (synthesis)

Four independent judges, Meta Global AI Developer Hackathon rubric. Full reports:
`judge-stage1-meta.md`, `judge-impact.md`, `judge-technical.md`, `judge-demo-ux.md` in this folder.

## Scores as submitted (working tree, 2026-11-02)

| Category | Weight | Score | Weighted |
|---|---|---:|---:|
| Impact | 30% | 5.5 | 1.65 |
| Use of Meta AI Tooling | 25% | 6.0 | 1.50 |
| Demo | 25% | 5.0 | 1.25 |
| Technical Depth & Execution | 20% | 5.5 | 1.10 |
| **Stage 2 total** | | | **5.5 / 10** |

**Stage 1: PASS.** Real Muse Spark 1.3 Contributor + Muse Voice Transcribe calls in code and in
local logs, fits *Build for Your World*, not a banned category, work dated Oct 29–31, 2026.
Keep *Build for Your World*; *Push the Frontier* scored 3/10 as a claim and is not used.

## What judges credited (do not lose this)

- A delivery is an input, not a verdict: full-swing, all-targets-at-once pass rule, material gap,
  blend search, reroute to another product, copyable build ticket.
- The model boundary: allow-list, parameter-only proposals, stated-number-only brief extraction,
  grounded advice, no invented fallback. Exact Meta proposals are scored and visibly rejected.
- The decision headline replaces the page title ("Make the …", "Lift the … low end by …").
- Tests as run by judges: 28 app + 135 server passing (mock mode).

## Findings that cap the score, ranked

1. **Compression mechanics error (Technical).** `weakInertia` in `app/product.js` cubed the long
   side (strong axis). The planter example reported ~1,028–1,322 kg; correct weak-axis Euler
   buckling is ~7.5 kg. One shipped example was wrong by ~137×, and the gap diagnosis shared
   the blind spot.
2. **No picture of the swing (Demo/UX).** Every range was numbers in sentences. No bar, band or
   margin anywhere; the crate case's 0.4 kg low-end margin had to be subtracted in the judge's head.
3. **Meta is not load-bearing, and live-ness is not visible (Meta tooling).** Proposal numbers are
   reduced to a direction before the local search; a winner can appear with no model at all.
   Cached answers are not labelled cached in the UI, and committed live evidence covers only
   retired endpoints.
4. **Consequences not on screen (Impact).** On failure, the current build's own failing range was
   computed and discarded. No run-size scaling. A blend ranked as free (0 g) against +g of section,
   so a 90% steadier-stream recipe could beat a thicker section on an invisible cost.
5. **First open gives no path (Demo/UX).** 18+ blank fields, result panels hidden, and the one-click
   sample brief was a 12 px underlined link. A phantom "0 × 0 mm" build appeared in the verifier
   trace. The failure case — the strongest beat — changed a headline at the top of the page while
   the user was editing at the bottom, with nothing sticky or local to show it.
6. **Pitch evidence stays in the research folder (Impact).** The quantified batch swing
   (published rHDPE ranges) never entered `HACKATHON.md`; the beneficiary is a persona with no
   stated validation status; the flagship case already passes, and the failure case had no
   precomputed numbers.

## Revamp applied after this verdict

See `REVAMP.md` in this folder for the change-by-change map from finding to fix, and the
re-score. Public-repo, deployment and final-video actions are the builder's and are not
counted here.

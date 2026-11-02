# What was built during the hackathon

The repository history starts **2026-10-29**, inside the Meta Global AI Developer Hackathon building
period (Oct 27–Nov 4). The active submission is the product-first, multi-requirement app at commit
`32d9bfc` and the Meta brief/proposal/advice backend built on top of it.

## Judged surface

| Area | Files | What changed |
|---|---|---|
| Product-first page | `app/index.html`, `app/main.js`, `app/styles.css` | Replaced the bracket-default screen with "What do you want to make?", optional case examples, multiple target requirements, Batch section and Ask Meta. |
| Mechanics + verification | `app/product.js`, `app/tests/model.test.mjs` | Rectangular-section capacity/stiffness/mass, full-swing range test, least-material selection, material gap, blend, exact model trace, model-move search; no invented numbers; 28 app tests. |
| Meta brief | `server/product_ai.py`, `server/app.py`, `server/tests/test_product_brief.py` (new), `app/main.js` | Natural-language typed or spoken brief; Muse Voice transcribes, Muse Spark parses into editable product/target/batch state; numbers not stated are dropped. |
| Verifier trace | `app/product.js`, `app/main.js`, `app/index.html` | Exact Muse Spark proposals are scored and shown as accepted/rejected; the mechanics search then supplies the passing builds. |
| Meta proposals | `server/product_ai.py`, `server/app.py`, `server/tests/test_product_proposals.py` | Optional `targets` array, all requirements simultaneously, sanitised parameter-only output, no fixed fallback. |
| Meta advice | `server/product_ai.py`, `server/app.py`, `server/tests/test_product_advice.py` | Grounded batch advice, all requirements/gaps addressed, no test/trial/certification instructions, no fixed advice fallback. |
| Submission | `README.md`, `HACKATHON.md`, `SUBMISSION.md`, `SUBMISSION_REPO.md`, `DEMO_SCRIPT.md`, `DEPLOY.md`, `V0_8_SPEC.md`, `LICENSE`, `Dockerfile`, `render.yaml` | Current story, clean public-submission tree, deployment, 3-minute script, MIT license, new-work boundary. |
| Demo | `demo/screenshots/v10/`, `demo/anyrb-demo-draft.mp4` | First-open, sourced rHDPE crate case / verifier trace, mobile screens, and a reference screen cut with synthetic narration. |

## Historical, not part of the judged product

`engine/`, `validation/`, `reports/`, `research/`, `audit/`, `history/`, `demo/screenshots/v4–v8`, and
the old `HACKATHON.md` content are pre-product exploration. The old 56-pass validation belongs to the
historical bracket engine, not to `app/product.js`. Do not present it as validation of AnyRB v0.8.

## Commit map

```
current  Meta brief front door, exact-proposal trace, sourced rHDPE case, submission pack
32d9bfc  product-first, multiple requirements, Meta targets, tests
caa83da  delivery-to-build app, Batch section, proposals/advice endpoints
477acdf  v0.7 measured-piece app (retired)
…        earlier hackathon history (engine/research), archived
```

# What was built during the hackathon

The repository history starts **2026-10-29**, inside the Meta Global AI Developer Hackathon building
period (Oct 27–Nov 4). The active submission is the product-first, multi-requirement app on `main`
and the Meta brief/proposal/advice backend built on top of it.

## Judged surface

| Area | Files | What changed |
|---|---|---|
| Product-first page | `app/index.html`, `app/main.js`, `app/styles.css` | Replaced the bracket-default screen with "What do you want to make?", optional case examples, multiple target requirements, Batch section and Ask Meta. |
| Mechanics + verification | `app/product.js`, `app/tests/model.test.mjs` | Rectangular-section capacity/stiffness/mass, full-swing range test, least-material selection, material gap, blend, exact model trace, model-move search; no invented numbers; unit-aware brief grounding, family-constrained sort outcomes; 70 checker tests. |
| Meta brief | `server/product_ai.py`, `server/app.py`, `server/tests/test_product_brief.py` (new), `app/main.js` | Natural-language typed brief; Muse Spark parses it into editable product/target/batch state; numbers not stated are dropped. |
| Verifier trace | `app/product.js`, `app/main.js`, `app/index.html` | Exact Muse Spark proposals are scored and shown as accepted/rejected; the mechanics search then supplies the passing builds. |
| Meta proposals | `server/product_ai.py`, `server/app.py`, `server/tests/test_product_proposals.py` | Optional `targets` array, all requirements simultaneously, sanitised parameter-only output, no fixed fallback. |
| Meta advice | `server/product_ai.py`, `server/app.py`, `server/tests/test_product_advice.py` | Grounded batch advice, all requirements/gaps addressed, no test/trial/certification instructions, no fixed advice fallback. |
| Submission | `README.md`, `HACKATHON.md`, `SUBMISSION.md`, `DEMO_SCRIPT.md`, `DEPLOY.md`, `V0_8_SPEC.md`, `LICENSE`, `Dockerfile`, `render.yaml` | Current story, clean public-submission tree, deployment, 3-minute script, MIT license, new-work boundary. |
| Demo | `demo/screenshots/v10/`, `demo/slides/` | First-open, sourced rHDPE crate case / verifier trace, mobile screens, architecture slide. The video is recorded fresh from `DEMO_SCRIPT.md`; no draft cut ships in the repo. |

## Historical, not part of the judged product

The v0.2–v0.7 bracket-engine history (`engine/`, `validation/`, `reports/`, `research/`,
`audit/`, `history/`, old screenshots, the retired v0.4 server surface and its tests) was
deleted from the repository. The old validation scores belong to that retired engine, not to
`app/product.js`. Do not present them as validation of AnyRB.

## Commit map

```
current  Meta brief front door, exact-proposal trace, sourced rHDPE case, unit-aware
         grounding, family-constrained sort outcomes, Air restyle, v0.4 retirement,
         submission pack
…        earlier round commits in this repo's history
```

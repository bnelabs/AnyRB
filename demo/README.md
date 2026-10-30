# AnyRB demo pack

One page, one job. The product is the range and the next action.

## Open

Double-click `../index.html`, or serve the repository and open `/`:

```bash
python3 -m http.server 8000
# http://localhost:8000/
```

No backend, no network, no key. The page saves the current entry in this browser.

## The checked screens (`screenshots/v7/`)

1. `01-first-open.png` — first open. The page asks what the person is making and shows the empty answer
   with the next step.
2. `02-no-measurements.png` — product, range and plastic entered; no measurement. No number or pass.
   The answer says to run the stiffness test on a piece from this batch and gives the next check.
3. `03-one-batch.png` — one batch measured at 2,100 MPa inside 1,800–2,400 MPa. The next batch is
   unknown until checked the same way.
4. `04-two-versions.png` — four measurements over two batches, all carrying the plastic they were made
   with. Part of the April batch is outside; the 3 mm wall version stays inside and the 2 mm wall version
   is outside. The answer names the version to make and the version to drop.
5. `05-phone.png` — the same split at 390 px, one column, no horizontal overflow.
6. `06-mix-mismatch.png` — the current plastic has a different mix from the measured pieces. The numbers
   on hand do not cover this plastic; the answer says not to ship it and gives one test on a piece from
   this batch.

## Reproduce

```bash
python3 app/build.py
node app/tests/model.test.mjs
```

The screenshots are captured from the built standalone `index.html` with headless Chrome at 1440 px and
390 px. There is no chart, score, catalog, paper list, bracket studio, voice button, generated picture,
proof dashboard or AI label in the active page.

## History

Old v0.6 screenshots remain in `screenshots/v6/` and earlier. The retired v0.6 interface lives in
`../history/v0.6-app/`; it is not built or linked. Research notes are in `../research/`.

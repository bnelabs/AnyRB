# Where the published ranges come from

The delivery ranges the page offers as a starting point are published bands from
`data/feedstock_library.json` (and, for the crate case, `data/CASE_STUDY.md`).
They are **not measurements of your delivery**. This file names what can be named
from this repository, and says plainly what cannot.

## Named sources

| Code | Source | What it supports here |
|---|---|---|
| R01 | Georgiou, Sun, Liu, Athanasiou, *PNAS* 2025, e2502613122 | One supplier's recycled-HDPE plates measured at **1,350 ± 239 MPa** (CV 17.7%, n=50 across 10 plates); a literature compilation of the same material at mean 1,213 ± 654 MPa (n=40, including method differences between studies) |
| R02 | Cecon et al. 2023, quoted in R01 | Recycled HDPE modulus across three US recycling facilities (MRFs): **380–1,250 MPa measured** |
| R04 | Eriksen 2019 | Recycled-HDPE strength **41.6–48.4 MPa** used in the crate case; within-sample strength scatter of ≤1–4% against 20–50% between sources |
| R05 | Hinczica et al., *J. Appl. Polym. Sci.* (2026, issue 15) | Ten recycled-polypropylene lots that all passed the same MFR/density specification still ranged **2–24 wt% filler**, with elongation at break from 10–100% — a specification pass is not the same delivery twice |
| R12 | Jones 2023 | Standard recycled-HDPE density range behind the 0.94 g/cm³ crate value |

## The honest limits of this list

- The library's other codes (R03, R06–R11, R17–R36) refer to a research dossier
  that is not included in this repository. Several of those sources were read at
  abstract level only (the library's own `gaps` list says so). Bands that rest on
  them — recycled PET and PETG in particular — should be read as published
  starting points, not settled values.
- The "typical published range" bands in the app are a published mean ± the
  published variation for that plastic. That is spread *across published
  sources*, which is usually wider than one real delivery's own swing.
- Two bands are graded **D** in the library — recycled LDPE and mixed
  polyolefins — and the library's notes say of LDPE: "Do not use for structural
  claims." The page repeats that warning wherever those ranges are picked for a
  load-bearing check.
- Correlations between stiffness, strength and elongation in the library are
  marked assumptions there, and no seasonality data for rHDPE was found. The app
  does not use those correlations; it checks the ranges you enter, as entered.

If you have your supplier's numbers or your own test, they replace every band
above the moment you type them.

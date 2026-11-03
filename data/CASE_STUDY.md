# Worked cases and their sources

## 1. Sourced measured case — rHDPE crate side

The batch range is a **published measured rHDPE range**, not a customer-specific part or a certification.

### Part

- Product: **crate side**
- Load path: **simply supported**
- Span: **400 mm**
- Width: **60 mm**
- Thickness: **15 mm**
- Requirements:
  - **strength** 95–115 kg (load capacity)
  - **weight** 320–360 g

### Sourced batch

- type: **rHDPE**, US mixed rigid MRF range / literature case
- stiffness **1,111–1,589 MPa** — measured 1,350 ± 239 MPa across 10 plates, n=50 (R01 via Georgiou 2025)
- strength **41.6–48.4 MPa** — R04 (Eriksen 2019)
- density **0.94 g/cm³** — R12 / standard rHDPE range

### Result

The mechanics evaluates the full stiffness/strength swing and reports:

- capacity **≈95.4–111.0 kg**
- weight **≈338.4 g**
- both requirements inside the target.

This is the case the sample brief uses. The app requires no cover sheet: the
source is named in the brief and the case notes.

## 2. Illustrative second case — planter wall

- Product: planter wall, supported at both ends, 300 × 180 × 4 mm
- Target: strength 9–12 kg, weight 180–230 g
- Delivery: 700–850 MPa stiffness, 14–18 MPa strength, density 0.94 — **illustrative**, not a
  measured customer batch.
- Result: the entered build carries 9.1–11.7 kg and weighs 203.0 g — inside both targets.

The planter case exists to show a second product and multi-requirement switching. It is labeled
illustrative in this file and should be replaced with a shop's measured range for a production claim.

Correction worth stating: an earlier version of this case treated the 4 mm panel as a compression
post and reported over 1,000 kg. A panel that thin buckles about its weak axis long before the
material crushes — at the low stiffness above it carries about 7.5 kg as a post. The mechanics now
uses the weak-axis value, a regression test holds it there, and this case is framed as the panel
it is.

## When the same delivery does not fit (worked, with the app's own numbers)

Keep the crate case above and change only the strength requirement to **130–150 kg** (weight stays
320–360 g). The app then reports, exactly:

- Headline: **“This delivery varies too much in strength.”**
- As it stands, the build **carries 95.4–111.0 kg and weighs 338.4 g** — the strength range sits
  34.6 kg short at the low end of the 130–150 kg requirement.
- Material gap: this build needs **56.7–65.4 MPa**; the delivery gives **41.6–48.4 MPa**. The
  delivery's swing is wider than the requirement window allows, so a thicker or wider part —
  which raises both ends together — cannot close it.
- The action the app gives, in its own words: “This delivery varies too much for the range you
  need. A thicker or wider part raises both ends together, so it cannot fix this. Mix in another
  plastic that measures nearly the same every time, or sort the weakest pieces out first.” It does
  not say “don’t use this delivery.”

In the passing case the app also says what it does not do: “Ranges are checked as entered — no
safety margin added. The closest margin is thin — make one and check it before a run.” The
0.4 kg margin at the low end earns that sentence.

These numbers come from the app's mechanics on the inputs above and are exercised in
`app/tests/model.test.mjs`.

## Honesty

The rHDPE ranges are published measurements, not a guarantee about the next delivery. The planter
batch is illustrative. The app accepts the shop's own measured ranges; it does not certify a blend or
a part. Sources: R01 (Georgiou et al., PNAS 2025) for the single-supplier stretch-film lot
(1,350 ± 239 MPa, n=50); R04 (Eriksen 2019) for 41.6–48.4 MPa strength; R12 (Jones 2023) for the
HDPE density range. The full source list, including what cannot be named from this repository,
is in [SOURCES.md](SOURCES.md).

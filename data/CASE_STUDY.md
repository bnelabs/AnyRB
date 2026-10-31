# Demo cases

## 1. Sourced measured case — rHDPE crate side

This is the primary judge case. The batch range is a **published measured rHDPE range**, not a
customer-specific part or a certification.

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
- stiffness **380–1,250 MPa** — R02 via R01 (Cecon 2023 / Georgiou 2025)
- strength **41.6–48.4 MPa** — R04 (Eriksen 2019)
- density **0.94 g/cm³** — R12 / standard rHDPE range

### Result

The mechanics evaluates the full stiffness/strength swing and reports:

- capacity **≈95.4–111.0 kg**
- weight **≈338.4 g**
- both requirements inside the target.

This is the case the sample brief and the 3-minute video use. The app requires no cover sheet: the
source is named in the brief and the case notes.

## 2. Illustrative second case — planter wall

- Product: planter wall, compression, 300 × 180 × 4 mm
- Target: strength 1,000–1,400 kg, weight 180–230 g
- Delivery: 700–850 MPa stiffness, 14–18 MPa strength, density 0.94 — **illustrative**, not a
  measured customer batch.
- Result: 176 × 4 mm, 1,005–1,292 kg, 198.5 g.

The planter case exists to show a second product and multi-requirement switching. It is labeled
illustrative in this file and should be replaced with a shop's measured range for a production claim.

## Failure case for the video

Change the batch low end or a target so the crate/planter cannot be made by geometry alone. The app
shows the failing requirement, the material range needed, and the actions: add a steadier stream,
sort/wash/dry, change section or span, route to another product, or split the delivery. It must not say
“don’t use this delivery.”

## Honesty

The rHDPE ranges are published measurements, not a guarantee about the next delivery. The planter
batch is illustrative. The app accepts the shop's own measured ranges; it does not certify a blend or
a part. Sources: R02 via R01 (Cecon 2023 / Georgiou 2025) for the 380–1,250 MPa MRF range; R04
(Eriksen 2019) for 41.6–48.4 MPa strength; R12 (Jones 2023) for the HDPE density range.

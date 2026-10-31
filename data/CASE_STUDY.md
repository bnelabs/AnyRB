# Demo case — planter wall from a variable PP delivery

This is the case the app and the 3-minute video use. It is a **labeled demo case**, not a
certification or a measured customer part.

## Part

- Product: **planter wall**
- Load path: **compression**
- Span: **300 mm**
- Width: **180 mm**
- Thickness: **4 mm**
- Requirements:
  - **strength** 1,000–1,400 kg (load capacity)
  - **weight** 180–230 g

## Delivery (example range)

- recycled polypropylene, “April delivery”, 20% HDPE, light paper labels
- stiffness **700–850 MPa**
- strength **14–18 MPa**
- density **0.94 g/cm³**
- declared steadier stream: **2,000 MPa stiffness, 40 MPa strength**

## Result

The mechanics evaluates the full swing. The local minimum is **176 × 4 mm**:

- capacity **≈1,005–1,292 kg**
- weight **≈198.5 g**
- both requirements inside the target.

The current 180 × 4 mm still passes at 1,028–1,322 kg / 203 g; the app prefers the narrower section
because it uses less build mass.

## Failure case for the demo

Change the batch low end or the target so the planter cannot be made by geometry alone. The app should
show the requirement that fails, the material range needed, and the actions:

- add the declared steadier stream and re-check the blend
- sort/wash/dry to lift the low end
- change the section or span
- route the delivery to another product
- split the delivery

It must not say “don’t use this delivery.”

## Honesty

The ranges are illustrative, chosen to exercise the workflow. They are within the published
recyclate-variability territory in `research/01-recyclate-variability.md` (rPP modulus mean ≈1,100 MPa
CV ≈18%; strength ≈27 MPa CV ≈13%; density 0.94; spec-compliant lots still swing in filler and
elongation). For a production claim, replace them with the shop's measured batch. The app accepts the
shop's own ranges; it does not certify a blend or a part.

# AnyRB v0.2 — Design System & 3-Step Flow Spec

**Status:** design target for the hackathon demo · **Owner:** product-designer · **Implementer:** demo-engineer
**Companion artifact:** [`prototype.html`](prototype.html) — the visual source of truth. When this document and the prototype disagree on a spacing/colour value, the prototype wins for the demo and this document should be corrected.

---

## 0. One-paragraph brief

AnyRB v0.1 proved the science — a verified frame-FE solver, exact bivariate-normal reliability, and a robust design that beats a conventional safety-factor design by 10 % mass at a fraction of the risk. But it shipped as a dense dark CAE dashboard: eight data sections, neon cyan, dense tables, no AI in the live path. v0.2 is a different product surface for the same engine: a **calm, editorial AI design studio** in which a designer describes a part in one paragraph, an AI partner turns it into a structured brief and proposes three candidate strategies, the verified engine does all the math, and the result is a one-page qualification the designer can defend. The UI's job is not to show the solver; it is to make the solver's output *legible, trustworthy and quick to act on*.

**Design principle in one line:** *warm paper, one accent, serif headlines, real numbers, and every AI claim signed.*

---

## 1. Positioning & target user

| | |
|---|---|
| **Product name** | AnyRB |
| **Category** | AI reliability studio for recycled-polymer part design |
| **One line** | *Describe the part. Give it the batch you actually have. Get a design that behaves reliably — and the proof.* |
| **Target user** | An in-house mechanical designer / AM engineer at a small brand or service bureau, 28–45, comfortable with CAD but not with reliability statistics, who is told "use recycled material" and has to prove it won't fail. Time-poor, demo-audience-friendly, scientifically literate but not a CAE specialist. |
| **Job to be done** | "In 3 minutes, tell me what geometry to print, how much it weighs, how likely it is to fail across real batches, and whether the lot that just arrived is usable." |
| **Feeling to create** | *A serious lab instrument, not a startup dashboard.* Confidence, calm, honesty. The AI feels like a partner taking notes; the physics feels like the authority. |
| **Non-goals (v0.2)** | Not certification software; not a CAD modeller; not a full CAE post-processor; no dense tabular comparisons on the primary path; no hidden assumptions. |
| **Claim posture** | "In-silico only · decision support, not certification · simulated numbers · literature-derived feedstock." Stated in chrome, on the Prove screen, and in every AI memo. |

---

## 2. The 3-step journey

One project at a time. The stepper is always visible; the user can move backwards freely, forwards only through an action ("Design with AI", "Continue to proof"). There are exactly three screens; everything else is a drawer, a disclosure or a state.

| Step | Screen | Question answered | Primary CTA | AI role | Engine role |
|---|---|---|---|---|---|
| 01 | **Brief** | *What are we making, and from which batch?* | **Design with AI →** | Muse Spark parses intent → editable fields; extracts lot data; previews the plan. Voice via Muse Voice Transcribe. | Validates targets; snapshots feedstock distribution. |
| 02 | **Design** | *Which architecture, and what does it cost?* | **Continue to proof →** | Muse Spark proposes 3 strategies as parameter priors; writes the design memo from computed metrics only. | Frame FE, mass, closed-form P_f, printability, ranks candidates. |
| 03 | **Prove** | *Can we ship this batch?* | **Export qualification report** (secondary: accept/reject lot) | Muse Spark writes the qualification narrative; Muse Image makes the concept render. | Acceptance window, per-lot width scale, validation checklist. |

**Global chrome (every screen):** wordmark · project switcher · **AI status pill** · Lab mode toggle · help. Thin left rail with the vertical stepper; below it a quiet session card (seed, engine version, validation counts). On <1080 px the rail collapses to a top segmented control and the session card moves into the footer.

**State model (required for demo):** `default · empty · loading · error · offline`, plus AI pill modes `live · cached · offline`. Deep links: `?screen=brief|design|prove` and `?state=…` (prototype supports both).

---

## 3. Screen specs

### 3.1 Screen 01 — Brief

**Purpose:** turn a paragraph into a structured, editable brief and a lot passport. The screen should feel like writing on good paper, not filling a form.

**Content, in order:**

1. **Screen head** — eyebrow `01 · Brief`; display heading; one-line deck.
2. **Prompt card** (primary object, full width, 22 px radius)
   - Label `Your brief`.
   - Textarea, prefilled with the reference brief (see copy deck).
   - Example chips: `Shelf bracket · 150 N` · `Tighter deflection` · `Heavy duty · 300 N` (chips fill the textarea; they do *not* auto-run).
   - Mic button, bottom-right of the textarea: `Describe it out loud` (Muse Voice Transcribe). Clicking shows `Listening…` then `Transcribing…`, then a transcript fills the textarea and a provenance toast appears.
   - Footer row: `~80 words` counter · mic · primary CTA `Design with AI →`.
   - While running: **AI activity strip** below the card with three live steps — `Reading your brief` / `Planning candidate strategies` / `Running the verified solver` — each with model or engine badge and a check when done.
3. **AI understanding card** (left, wider) — `Muse Spark · 0.74 s` badge + confidence `0.94` + `Editable` badge.
   Six field rows (Part, Design load, Deflection limit, Reliability target, Print process, Batch), each with a pencil affordance. Foot note: *"Nothing is hidden. Edit any field before the engine runs."*
   - **Empty state:** `No brief yet — describe the part on the left, or start from an example.`
   - **Loading state:** skeleton bars + `Muse Spark is reading your brief…`
   - **Error state:** deterministic fallback fields shown with a `fallback` badge; retry link.
4. **Lot passport card** (right) — heading `Lot passport`; verified preset badge. Material title serif: `rPETG · printed in-plane`. Source line: *Literature preset · ISO 527-2 in-plane strength · R07*. 2×2 stat block: `E mean 2,100 MPa`, `E CV 10 %`, `σy mean 46 MPa`, `σy CV 10 %`. A highlighted line of prose: *"85 % of the variance is between lots — that is the batch problem this tool exists to solve."* Actions: `Change preset` · `Paste datasheet →` (the latter opens a text area; Muse Spark "extracts" fields — mock in prototype).
5. **AI plan preview** — `How the studio will explore`, three quiet columns: `Light` (minimum mass, mean-material sizing), `Balanced` (mass vs reliability), `Conservative` (safety-factor sizing). Each one rationale sentence and a `prior` tag.
6. **Advanced disclosure** — `Advanced model inputs` (details/summary): lattice topology `94 frame elements`, width field `4 × 2 control points`, lot/within split `85 / 15 %`, deflection limit `2.5 mm`. Behind the Lab mode toggle as well.
7. **Meta footer** of the screen: auto-save line `Draft saved locally · session 20251029`.

**Interactions:** chips → textarea; mic → simulated voice; CTA → activity strip → Design screen; every understanding field editable (contenteditable or inline inputs); advanced toggle; lab mode reveals advanced inputs only.

### 3.2 Screen 02 — Design

**Purpose:** show the AI proposing and the engine deciding. One big drawing, three numbers, three candidates, one memo. No tables.

**Content, in order:**

1. **Screen head** — eyebrow `02 · Design`; heading `AI proposes. Physics decides.`; deck.
2. **Part visualisation card** (left, wide) — a clean SVG elevation of the graded lattice bracket:
   - hatched fixed wall at the root, 1 px technical linework, lattice struts graded thick→thin from root to tip;
   - measurement ticks + dimension lines `150 mm` and `60 mm`; load arrow `150 N ↓`; deflection annotation `δ limit 2.5 mm (exaggerated)`;
   - a faint dot-grid inside the drawing area; caption `Graded lattice · elevation · not to scale`.
   - Toggle group `Geometry · Stress & buckling · Strut width` — changes the stroke colour/width encoding. Selecting a candidate changes the strut widths and the caption `Showing: Balanced · robust`.
   - Under the drawing: `Verified FE · 94 frame elements` + `engine v0.1` + printability chip.
3. **Metric trio** (right column, stacked with hairline dividers) — exactly three:
   - **Mass** `50.73 g`
   - **P_f across batches** `0.997 %` (target `≤ 1.00 %`)
   - **Binding failure mode** `Euler buckling`
   Each has a `Why this number?` disclosure with a plain-language sentence and an engine-provenance line. No more than three on this screen.
4. **Candidate cards** (3 across): `Light` · `Balanced · recommended` · `Conservative`. Each card: AI prior tag, serif mass, P_f, printability pill, one-line trade-off, engine evaluation note. Selecting updates the canvas, the metric trio and the caption. The `Balanced` card is selected by default and carries the one accent border.
   Numbers map to the verified comparison set (Light = mean-only 44.34 g / 51.8 %; Balanced = robust 50.73 g / 0.997 %; Conservative = nominal FoS 1.5 56.41 g / 0.00064 %) — see §7.4 mock/real.
5. **AI design memo** (bottom left) — `Design memo` + `Muse Spark 1.3 · 1.24 s · cached · numbers injected from engine` badge; 4–6 sentences; two `Suggested next` actions. AI content is set in the body face, never in display serif — only headlines are serif.
6. **`vs conventional` strip** (bottom right) — four hairline bars on mass (`g · lower is better`): AnyRB robust `50.73`, nominal FoS 1.5 `56.41`, uniform sized to target `60.31`, solid plate `111.60`. One-sentence takeaway under it.
7. **CTA row** — secondary `Back to brief`, primary `Continue to proof →`.

### 3.3 Screen 03 — Prove

**Purpose:** one page a design reviewer can approve. It must read as a *qualification*, not a report dump. Numbers first, AI prose second, honesty always visible.

**Content, in order:**

1. **Screen head** — eyebrow `03 · Prove`; heading `Qualification you can hand to a review.`; deck. Status chip `Meets 99 % reliability target`.
2. **Reliability gauge card** (left) — semicircular gauge, big serif `0.997 %` P_f, track and target tick at `1.00 %`, caption `Reliability across delivered lots 99.0 % · target ≥ 99.0 %`. Below: three key facts — `Governing mode Euler buckling` · `Mass 50.73 g` · `Printability 3/3 checks`.
3. **Batch acceptance window card** (right) — SVG chart: x = measured lot mean E (× nominal), y = required width scale s; accepted region (right/below), compensated region (left, s ≤ 1.5), rejected region (s > 1.5). Marked points: nominal (`E ×1.0 · pass`), weak lot (`E ×0.8 · width ×1.10 · +8.5 % mass · pass with compensation`), reject lot (`E ×0.5 · reject`). Dashed line `1.5 × print clip`. Caption: *Illustrative v0.1 acceptance logic; the engine computes the exact window.*
4. **Batch passport card** (left, below gauge) — `Screen an incoming lot against this design.` Two inputs (`Lot mean E · × nominal`, default `0.8`; `Lot mean σy · × nominal`, default `1.0`), three preset scenario chips (`Nominal lot`, `Weak lot · E ×0.8`, `Reject lot · E ×0.5`), and a verdict panel that changes live:
   - **PASS** — `Width scale 1.00 × · no compensation` (nominal).
   - **PASS WITH COMPENSATION** — `1.10 × width · +8.5 % mass` (E ×0.8); `P_f for this lot ≤ 1.00 % target`.
   - **REJECT · REROUTE** — `required width scale exceeds the 1.5 × print clip` (E ×0.5).
   Verdict is text + colour + icon (never colour alone).
5. **Scientific validation card** (right, below acceptance chart) — live L0–L2 checklist, 7 rows with pass ticks and one-line evidence:
   element benchmarks (`cantilever vs Euler–Bernoulli · rel. err < 1e-15`), equilibrium & symmetry, cross-implementation (`Python ↔ JS · < 1e-6 rel.`), Monte-Carlo vs closed form, mesh/convergence, independent solver (energy minimisation vs direct stiffness), homogenisation (unit-cell vs analytical truss scaling). Footer: `29 Python tests · 22 JS tests passing · L0–L1 verified, L2 partial` + link `Validation report`.
6. **AI engineering memo** (left) — `Qualification memo` + Muse Spark badge; 4 sentences + `Next test` action. Explicit `AI-written from computed outputs`.
7. **Generated concept render** (right) — image card. If `demo/assets/product_render.png` exists, use it; else the prototype's styled placeholder. Always labelled `AI illustration — not the CAD model` and `Muse Image 1.0 · 4.18 s · cached`.
8. **Export row** — `Qualification report · HTML`, `STL · 1,140 triangles`, `Design JSON`, `AI provenance log`. Secondary buttons; toast confirmation (`mock export` in prototype).
9. **Claims ladder + limitations** (full width, quiet footer card) — four rungs: L0 equations & code verified (achieved), L1 solution verified (achieved), L2 literature-calibrated + UQ (partial), L4–L6 experimental validation (not claimed). One limitations paragraph in 13 px muted.
10. **Global footer** — `AnyRB is decision support, not certification. · In-silico only · Literature-derived feedstock · v0.2 design prototype`.

**Persistent on all screens:** AI status pill in the top bar opens the provenance drawer. Drawer contains four mock model calls with latency, status (live/cached/fallback), token counts and a JSON snippet; footer rule: *"Deterministic fallback exists for every model call. Numbers are never generated by a model."*

---

## 4. Copy deck

Tone: **plain, confident, scientific, unhyped.** Short sentences. No exclamation marks. Numbers always with units. AI is a partner, never a magician ("the studio", not "the magic"). Avoid "revolutionary", "seamless", "unleash".

### 4.1 Global chrome

| Element | Copy |
|---|---|
| Wordmark | `AnyRB` (serif, no tagline next to it) |
| Project switcher | `rPETG wall bracket` |
| AI pill · live | green dot · `Live · Meta models` |
| AI pill · cached | ink dot · `Cached session · 4 calls` |
| AI pill · offline | hollow dot · `Offline · fallback on` |
| AI pill menu item 1 | **Live · Meta models** — `Muse Spark, Muse Image, Muse Voice Transcribe, SAM 3.1` |
| AI pill menu item 2 | **Cached session** — `Show the last responses; no new calls` |
| AI pill menu item 3 | **Offline assistant** — `Deterministic fallbacks; engine still runs locally` |
| Lab mode | `Lab mode` (toggle, pressable) |
| Help | `Help` |
| Skip link | `Skip to content` |
| Footer | `AnyRB is decision support, not certification.` · `In-silico only · Literature-derived feedstock · Simulated numbers` |

### 4.2 Brief

| Slot | Copy |
|---|---|
| Eyebrow | `01 · Brief` |
| H1 | **Tell us what the part must survive.** |
| Deck | *Describe the part, the load it must carry, and the batch you actually have. The studio turns it into a design brief — every field is editable.* |
| Prompt label | `Your brief` |
| Prompt default value | *A wall bracket for a recycled PETG shelf unit. 150 N tip load, 2.5 mm max tip deflection, 1 % failure target across delivered lots. Print it upright in rPETG on a 0.4 mm nozzle.* |
| Prompt placeholder | `Describe the part, the load, the limits and the batch…` |
| Example chips label | `Try an example` |
| Example chips | `Shelf bracket · 150 N` / `Tighter deflection` / `Heavy duty · 300 N` |
| Mic button | `Describe it out loud` · listening: `Listening…` · transcribing: `Transcribing…` · done toast: `Transcribed · Muse Voice Transcribe · 0.95 s (mock)` |
| Prompt counter | `35 words` |
| Primary CTA | **Design with AI →** |
| CTA busy | `Designing…` |
| Activity steps | `Reading your brief` · `Planning candidate strategies` · `Running the verified solver` |
| Activity done | `3 candidates evaluated · engine v0.1 · 0.42 s` |
| Understanding heading | **What the studio understood** |
| Understanding badges | `Muse Spark 1.3 · 0.74 s` · `Confidence 0.94` · `Editable` |
| Understanding fields | `Part` → Wall bracket · `Design load` → 150 N · `Deflection limit` → 2.5 mm · `Reliability target` → P_f ≤ 1.00 % · `Print process` → FDM · 0.4 mm · `Batch` → rPETG preset |
| Understanding footnote | *Nothing is hidden. Edit any field before the engine runs.* |
| Understanding empty | `No brief yet — describe the part on the left, or start from an example.` |
| Understanding loading | `Muse Spark is reading your brief…` |
| Understanding error | `The AI partner didn't respond. Showing the deterministic fallback parse.` + `Retry` |
| Lot passport heading | **Lot passport** · badge `Verified preset` |
| Lot material | `rPETG · printed in-plane` |
| Lot source | *Literature preset · ISO 527-2 in-plane strength · R07* |
| Lot stats | `E mean` 2,100 MPa · `E CV` 10 % · `σy mean` 46 MPa · `σy CV` 10 % |
| Lot insight | *85 % of the variance is between lots — that is the batch problem this tool exists to solve.* |
| Lot actions | `Change preset` · `Paste datasheet →` |
| Plan preview heading | `How the studio will explore` |
| Plan items | **Light** — `Minimum mass. Mean-material sizing, risky across batches.` · **Balanced** — `Mass against reliability, optimised for the target.` · **Conservative** — `Safety-factor sizing. Pays for safety nobody asked for.` |
| Advanced summary | `Advanced model inputs` |
| Advanced fields | `Lattice topology` 94 frame elements · `Width field` 4 × 2 control points · `Lot / within split` 85 / 15 % · `Deflection limit` 2.5 mm |
| Screen meta | `Draft saved locally · session 20251029` |

### 4.3 Design

| Slot | Copy |
|---|---|
| Eyebrow | `02 · Design` |
| H1 | **AI proposes. Physics decides.** |
| Deck | *Three candidate strategies, each evaluated by the verified engine on your batch distribution. Pick the trade-off you can defend.* |
| Canvas caption | `Graded lattice · elevation · not to scale` |
| Canvas meta | `150 × 60 × 10 mm` · `rPETG printed` · `150 N tip load` |
| View toggles | `Geometry` · `Stress & buckling` · `Strut width` |
| Selected caption | `Showing: Balanced · robust` |
| Metric labels | `Mass` · `P_f across batches` · `Binding failure mode` |
| Metric values | `50.73 g` · `0.997 %` · `Euler buckling` |
| Metric sublabels | `polymer volume × rPETG density` · `target ≤ 1.00 %` · `stiffness / buckling carries ~all P_f` |
| Why-mass | `Lattice mass scales with the strut-width field; the optimiser minimised it subject to the reliability target. Engine output, not measured.` |
| Why-Pf | `Closed-form bivariate-normal probability over the lot-to-lot distribution, including yield, Euler buckling and deflection. Engine output, not measured.` |
| Why-mode | `At the robust optimum the strength demand is only ~40 % of mean printed strength, so stiffness/buckling carries essentially all of the failure probability.` |
| Candidate tags | `AI prior` · `Recommended` |
| Candidate Light | `44.34 g` · `51.8 % P_f` · `mean-material sizing` · *Fails about half of delivered lots — the failure mode this tool exists to prevent.* · printability `Warn` |
| Candidate Balanced | `50.73 g` · `0.997 % P_f` · `robust optimum` · *Meets the 1 % target with the least mass. Recommended.* · printability `Pass` |
| Candidate Conservative | `56.41 g` · `0.00064 % P_f` · `nominal FoS 1.5` · *Safer than requested; pays 10 % extra mass for risk nobody asked for.* · printability `Pass` |
| Candidate footer | `Evaluated by engine v0.1` |
| Memo heading | **Design memo** · badge `Muse Spark 1.3 · 1.24 s · cached · numbers injected` |
| Memo body | *"The robust design lands at 50.73 g with P_f 0.997 %, inside your 1.00 % target across delivered lots. Stiffness is the binding constraint: the strength demand is met with margin, so widening struts for strength would only add mass. Compared with a nominal safety-factor-1.5 design you save 10 % mass while keeping the required reliability; the mean-only alternative at 44.34 g fails 51.8 % of batches and should not be considered shippable. Printability is clean: minimum strut 1.18 mm, slenderness 22.7, neighbour ratio 1.45. Suggested next: tighten root struts, then send this design to proof."* |
| Suggested next | `Tighten root struts` · `Send to proof` |
| vs-conventional heading | `vs conventional` · `Mass g · lower is better` |
| vs takeaway | *54 % lighter than the solid plate, 16 % lighter than a uniform lattice sized to the same target.* |
| CTA secondary | `Back to brief` |
| CTA primary | **Continue to proof →** |

### 4.4 Prove

| Slot | Copy |
|---|---|
| Eyebrow | `03 · Prove` |
| H1 | **Qualification you can hand to a review.** |
| Deck | *One page that says what the design is, which batches it accepts, and what the model cannot tell you.* |
| Status chip | `Meets 99 % reliability target` |
| Gauge heading | `Probability of failure across batches` |
| Gauge value | `0.997 %` · `target ≤ 1.00 %` |
| Gauge caption | `Reliability across delivered lots 99.0 %` · `1.00 % failure budget · 99.7 % used` |
| Key facts | `Governing mode · Euler buckling` · `Mass · 50.73 g` · `Printability · 3 / 3 checks` |
| Acceptance heading | **Batch acceptance window** |
| Acceptance caption | *Illustrative v0.1 logic: a lot at 0.8 × nominal E needs a 1.10 × width scale (+8.5 % mass) and passes with compensation; at 0.5 × it is rejected. The engine computes the exact window.* |
| Passport heading | **Batch passport** · sub `Screen an incoming lot against this design.` |
| Passport inputs | `Lot mean E · × nominal` · `Lot mean σy · × nominal` |
| Passport chips | `Nominal lot` · `Weak lot · E ×0.8` · `Reject lot · E ×0.5` |
| Verdict pass | **PASS** — `No compensation needed. Width scale 1.00 ×.` |
| Verdict compensate | **PASS · WITH COMPENSATION** — `Width scale 1.10 × · added mass +8.5 %. P_f for this lot remains inside the 1.00 % target.` |
| Verdict reject | **REJECT · REROUTE** — `Required width scale exceeds the 1.5 × print clip. Use this lot for a non-structural part.` |
| Passport disclaimer | *Illustrative v0.1 logic; supplier proxies should replace assumed lot means before production decisions.* |
| Checklist heading | **Scientific validation** · badge `L0–L1 verified` |
| Checklist rows | `Element benchmarks` — cantilever vs Euler–Bernoulli, rel. err < 1e-15 · `Equilibrium & symmetry` — force equilibrium and symmetry checks · `Cross-implementation` — Python ↔ JS agree < 1e-6 relative · `Monte-Carlo vs closed form` — analytic P_f vs independent MC · `Mesh & convergence` — fixed 94-element lattice; tolerance checks · `Independent solver` — energy minimisation vs direct stiffness · `Homogenisation` — unit-cell vs analytical truss scaling |
| Checklist footer | `29 Python tests · 22 JS tests passing · L0–L1 verified, L2 partial` + `Validation report ↗` |
| Memo heading | **Qualification memo** · badge `Muse Spark 1.3 · 1.62 s · live · numbers injected` |
| Memo body | *"The design meets the 1.00 % failure target across delivered lots at 50.73 g; the governing mode is Euler buckling, and the strength demand is not binding. It accepts lots down to 0.8 × nominal mean E with a 1.10 × strut-width compensation (+8.5 % mass); lots at 0.5 × nominal E are outside the printable compensation range and should be rerouted. The claim is in-silico only: the material distribution is a literature preset and must be replaced by this supplier's lot data before production. Next test: measure E and σy on three lots from the incoming supplier and refit the distribution."* |
| Memo tag | `AI-written from computed outputs` |
| Render heading | `Concept render` · `Muse Image 1.0 · 4.18 s · cached` |
| Render caption | `AI illustration — not the CAD model.` |
| Exports heading | `Export` |
| Export buttons | `Qualification report · HTML` · `STL · 1,140 triangles` · `Design JSON` · `AI provenance log` |
| Export toast | `Queued — mock export` |
| Claims ladder heading | `Claims ladder` |
| Claims rows | `L0 · Equations & code verified` — achieved · `L1 · Solution verified` — achieved · `L2 · Literature-calibrated + UQ` — partial · `L4–L6 · Experimental validation` — not claimed |
| Limitations | *Simulated numbers only: linear-elastic 2-D frame idealisation, literature-derived feedstock distributions, a local (not proven global) optimum, and no physical testing. AnyRB is decision support, not certification.* |

### 4.5 Global states

| State | Visible treatment | Copy |
|---|---|---|
| **Loading** | skeleton blocks in AI regions + activity strip; engine numbers stay readable | `The studio is reading your brief…` · `Muse Spark 1.3 · deterministic fallback ready` |
| **Empty** | brief prompt empty, understanding card empty, no candidates | `No brief yet.` · `Describe the part you need, or start from an example.` · CTA `Start from an example` |
| **Error** | inline banner at top of main; AI regions keep deterministic fallback content with `fallback` badge | **The AI partner didn't respond.** *Your brief is safe. The verified engine can run from the deterministic fallback — numbers will not change.* buttons `Retry AI` / `Continue offline` |
| **Offline** | top banner + pill switches to offline; cached AI text still shown with `cached` badges | **Offline assistant.** *Meta models are unreachable. Showing the last cached responses; the verified engine still runs locally.* |
| **Cached pill** | pill text changes; provenance drawer marks rows `cached` | `Cached session · 4 calls` |

### 4.6 Toasts / micro-feedback

| Trigger | Copy |
|---|---|
| Candidate selected | `Balanced selected · engine output applied` |
| Mic done | `Transcribed · Muse Voice Transcribe · 0.95 s (mock)` |
| Export clicked | `Queued — mock export` |
| Provenance copy | `Provenance log copied (mock)` |
| Passport scenario | `Weak lot applied · compensation calculated` |
| Lab mode on | `Lab mode on · model inputs visible` |
| Drawer open | `AI provenance · 4 calls this session` |

---

## 5. Design tokens

All tokens are implemented as CSS custom properties in `prototype.html :root`. **No external fonts, no icon font, no images required.**

### 5.1 Colour roles

| Token | Hex | Role | Notes |
|---|---|---|---|
| `--paper` | `#F7F5F0` | app background (warm paper) | default canvas |
| `--paper-deep` | `#F1EDE3` | inset panels, segmented tracks, skeleton base | one step warmer |
| `--card` | `#FFFFFF` | cards | pure white on warm paper is deliberate |
| `--card-warm` | `#FCFBF7` | quiet nested panels | |
| `--ink` | `#15171A` | primary text, linework, button labels on accent | contrast on paper 17.6:1 |
| `--muted` | `#6B7280` | secondary text on white cards | 4.86:1 on white |
| `--muted-strong` | `#565E6A` | secondary text on paper, ledes | 5.9:1 on paper |
| `--line` | `#E4DFD3` | 1 px warm-grey borders, dividers, hairlines | |
| `--line-strong` | `#D3CCBD` | control borders, hover | |
| `--accent` | `#FF5A36` | **safety orange** — primary CTA fill, risk, selection, gauge exceedance | large fills only; ink label on it = 5.9:1 |
| `--accent-ink` | `#B8361A` | orange used as *text* on paper | 5.4:1 AA |
| `--accent-soft` | `#FDEDE7` | risk/attention tint background | |
| `--verify` | `#0B6B53` | **verified green** — pass, verified, live, achieved | 5.9:1 on paper |
| `--verify-soft` | `#E9F1ED` | pass tint background | |
| `--focus` | `#15171A` + `rgba(255,90,54,.38)` halo | focus ring | 2 px outline + 4 px halo |

**Rule: two accent colours maximum** — safety orange and verified green. Everything else is ink, paper, or warm grey. Warnings use the orange family; passes use green; neutral/cached uses ink and grey. Never introduce a third hue (no blues, purples, cyans — the old UI's fault).

### 5.2 Typography

| Token | Stack / size | Use |
|---|---|---|
| `--serif` | `"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif` | display headlines, metric numerals, candidate masses, drawer title |
| `--sans` | `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, "Helvetica Neue", Arial, sans-serif` | all UI, body, labels, buttons |
| `--mono` | `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` | provenance, latencies, token counts, seed, technical badges |
| `display` | serif 500, `clamp(38px, 4.2vw, 56px)`, line 1.03, tracking −0.028em | screen H1 only |
| `h2` | serif 500, 28–32 px, tracking −0.015em | section headings ("Batch acceptance window") |
| `h3` | sans 600, 19 px, tracking −0.01em | card titles |
| `body` | sans 15.5 px / 1.62 | body copy |
| `body-lg` | sans 17 px / 1.6 | ledes |
| `small` | sans 13.5 px / 1.5 | metadata, captions |
| `micro` | sans 11 px, 650, uppercase, tracking 0.1em | eyebrows, labels, table-like headers |
| `metric` | serif 500, `clamp(34px, 3.4vw, 46px)`, tabular | the three hero metrics |
| `mono` | mono 12.5 px, tabular | provenance rows, latencies |
| numerals | `font-variant-numeric: tabular-nums` on all numbers, always | alignment and calm |

**Hierarchy rule:** exactly one serif display headline per screen; serif is never used below h2 except for hero numbers and candidate masses. Sans does all interface work. No all-caps serif, no italic body, no letter-spacing on lowercase body.

### 5.3 Spacing scale

`4 · 8 · 12 · 16 · 20 · 24 · 28 · 32 · 40 · 48 · 56 · 72 · 96` px.
Card padding `26–28 px`; inner card gaps `20 px`; section gaps `44–56 px`; screen top padding `44 px`; max content width `1160 px` inside the rail layout; page shell max `1440 px`. Never use odd values or arbitrary margins outside the scale.

### 5.4 Radii, borders, shadows

| Token | Value | Use |
|---|---|---|
| `--r-lg` | `22px` | cards, visualisation frame |
| `--r-md` | `16px` | nested panels, chart frames |
| `--r-sm` | `12px` | buttons, inputs, toasts |
| `--r-pill` | `999px` | chips, pills, segmented controls |
| `--hair` | `1px solid var(--line)` | all borders and dividers |
| `--sh-xs` | `0 1px 2px rgba(21,23,26,.04)` | chips, segmented active |
| `--sh-sm` | `0 1px 2px rgba(21,23,26,.04), 0 10px 28px −18px rgba(21,23,26,.18)` | cards |
| `--sh-md` | `0 2px 4px rgba(21,23,26,.05), 0 24px 48px −24px rgba(21,23,26,.22)` | drawer, dropdown |

Borders are always warm (`#E4DFD3`), never pure grey-blue. Shadows are low, diffuse, barely visible; never glows.

### 5.5 Iconography & linework

- Inline SVG only, 1.5 px stroke, 20 × 20 viewBox, round caps/joins, `currentColor`.
- Icon set needed: chevron-right, chevron-down, check, arrow-right, mic, pencil, plus, close, copy, download, alert, help, clock, dot.
- Measurement/lattice linework is a motif: ticks, dimension lines, dashed limit lines, hatched fixed supports, 1 px hairline rules. Keep linework ink at 8–18 % opacity except where it is data.
- Never use emoji, never use a filled icon font, never mix stroke weights within one icon.

### 5.6 Motion

| Token | Value | Use |
|---|---|---|
| `--dur-1` | `150ms` | hover, chip, focus |
| `--dur-2` | `200ms` | disclosure, selection, toggle |
| `--dur-3` | `260ms` | screen enter, drawer, dropdown |
| `--ease` | `cubic-bezier(.22,.61,.21,1)` | all UI easing (ease-out family) |

Rules: transform/opacity only; no layout animation; no bounce; no parallax. Screen enter = 8 px rise + fade over 240 ms. Drawer = translateX 260 ms. Skeleton shimmer = 1.4 s linear infinite. AI thinking dots pulse 2.4 s. **`@media (prefers-reduced-motion: reduce)` sets every animation/transition duration to 0.001 ms and disables the skeleton shimmer and pulse.** Canvas/lattice mode changes cross-fade at 200 ms.

### 5.7 Focus & accessibility

- **Focus:** `:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; box-shadow: 0 0 0 4px rgba(255,90,54,.35); border-radius: inherit }` — never `outline: none` without a replacement.
- **Contrast:** body ink on paper 17.6:1; muted-strong 5.9:1; muted on white 4.86:1; verified green 5.9:1 on paper; orange text uses `--accent-ink` 5.4:1; primary button is orange fill with ink label 5.9:1. No text below 12 px except mono badges at 11 px which are non-essential and repeated in accessible labels.
- **Targets:** interactive elements ≥ 44 × 44 px (stepper rows, buttons, toggles, stepper chips); icon buttons ≥ 40 px with aria-label.
- **Semantics:** one `<h1>` per screen; stepper is `<nav aria-label="Steps">` with `aria-current="step"`; AI regions are `role="status"` / `aria-live="polite"`; drawer `role="dialog" aria-modal="true"` with Esc close and focus return; forms have visible labels; charts have `<title>`/`<desc>` and adjacent text equivalents; colour never carries meaning alone (verdicts are text + icon + colour).
- **Keyboard:** all controls reachable in DOM order; Segmented controls are real buttons with `aria-pressed`; candidate cards are buttons; drawer traps focus (prototype: focus close button on open, Esc closes, returns focus).
- **Reduced motion, zoom:** layout must survive 200 % zoom and 320 px width; no horizontal scroll above 900 px viewport.
- **Screen-reader number reading:** numbers are plain text with units, not images; `P_f` is written `P_f` in accessible labels (`probability of failure`).

### 5.8 Responsive

| Breakpoint | Behaviour |
|---|---|
| ≥ 1280 px | full layout: 236 px rail, content max 1160 px, 2-column splits, 3 candidate cards |
| 1080–1279 px | rail narrows to 208 px; side-by-side splits stay but tighten |
| 900–1079 px | rail collapses to a horizontal segmented stepper under the top bar; splits stay 2-column; candidate cards 3 → 3 narrow |
| < 900 px | everything stacks; metric trio becomes rows; candidate cards 1-column; canvas keeps intrinsic ratio; top bar compresses (project name hides); still usable but **the demo target is ≥ 900 px** |
| < 640 px | display 34 px, prompt CTA full-width, drawer full-width |

Fixed test sizes: `1440 × 900` (demo projector), `1280 × 800`, `1024 × 768`, `960 × 900`.

---

## 6. Component inventory

Every component below exists in `prototype.html`; class names are the handoff contract.

| # | Component | Class | Anatomy | States | Notes |
|---|---|---|---|---|---|
| 1 | **Top bar** | `.topbar` | mark + wordmark + project switcher · AI pill · Lab mode · help | sticky, offline | 64 px tall, solid paper, hairline bottom |
| 2 | **Vertical stepper** | `.stepper` / `.step` | `01` number circle · name · sublabel · completion tick · connector line | future, active, done, hover, disabled forward | `<nav>` + `aria-current`; becomes `.stepper--horizontal` < 1080 |
| 3 | **AI status pill** | `.ai-pill` + `.ai-menu` | dot · label · chevron; menu with 3 modes | live (green pulsing dot), cached (ink dot), offline (hollow dot), open | opens menu; selection updates body state; always honest |
| 4 | **Session card** | `.rail-meta` | `Session 20251029`, engine version, 94 frame elements, 29 Python / 22 JS tests, claims rung | static | moves to footer < 1080 |
| 5 | **Prompt box** | `.prompt` | label · textarea · example chips · word counter · mic · CTA | idle, focus-within (ink ring), listening, transcribing, busy | whole card is the input affordance; textarea borderless |
| 6 | **Mic button** | `.mic` | 44 px pill, mic icon + label | idle, listening (orange ring + pulse), transcribing (spinner), disabled | simulated in prototype |
| 7 | **AI understanding card** | `.ai-card` / `.kv` | header + model badge + confidence + edit affordance; 6 key/value rows; footnote | filled, editable, empty, loading skeleton, error/fallback | edit icon appears on hover/focus |
| 8 | **Lot passport card** | `.lot-card` | title + verified badge; material serif title; source; 2×2 stats; insight line; actions | preset, imported (mock), empty | the "variability is the input" story |
| 9 | **AI plan preview** | `.plan` | 3 columns `Light / Balanced / Conservative` + one-line rationale + prior tag | static, loading skeleton | sets expectations for Design |
| 10 | **AI activity strip** | `.activity` | 3 steps with dot/check + model badge; elapsed; done message | idle (hidden), running, done | `aria-live="polite"` |
| 11 | **Lattice visualisation** | `.viz` / `#lattice` | SVG elevation, hatched wall, graded struts, dimension ticks, load arrow, deflection annotation, dot grid | geometry / stress / width modes; candidate variants; loading skeleton | vector, no images; `<title>/<desc>`; caption + toggles |
| 12 | **Metric trio** | `.metrics` / `.metric` | micro label · serif value + unit · sublabel · `Why this number?` disclosure | three only; selection updates | never more than 3 metrics on Design |
| 13 | **Candidate card** | `.candidate` | prior tag · name · serif mass · P_f · printability pill · trade-off · engine note | default, selected (accent left rule + ink border), warn pill | real `<button>` with `aria-pressed`; selecting updates viz + metrics |
| 14 | **vs conventional strip** | `.vs` | 4 hairline mass bars with labels + values; takeaway sentence | static | compact, no table |
| 15 | **AI memo card** | `.memo` | serif h3 `Design memo`/`Qualification memo` · model badge · 4–6 sentences · suggested actions | live, cached, fallback | AI prose never in serif; number tokens may be wrapped `<b>` |
| 16 | **Reliability gauge** | `.gauge` | semicircle track + green value arc + target tick + big P_f + caption | pass/warn (target exceeded) | pure SVG; numbers repeated in text |
| 17 | **Batch acceptance chart** | `.chart` | SVG regions (accepted / compensate / reject), curve, 3 labelled points, axes | static/illustrative | `<title>/<desc>`; legend text |
| 18 | **Batch passport input** | `.passport` | 2 numeric inputs + scenario chips + verdict panel | pass, compensate, reject | verdict = text + colour + icon; live update |
| 19 | **Validation checklist** | `.checklist` | 7 rows: tick · name · evidence line; footer test counts + report link | pass/warn | quiet, evidence-first |
| 20 | **Concept render** | `.render` | framed image or styled placeholder + `AI illustration` label + model badge + caption | image present / placeholder / loading | `../demo/assets/product_render.png` if present |
| 21 | **Export row** | `.exports` | 4 secondary buttons with icon + meta line | idle, queued toast | mock in prototype |
| 22 | **Claims ladder** | `.claims` | 4 rungs: code, achievement tag; limitations paragraph | static | always visible on Prove |
| 23 | **AI provenance drawer** | `.drawer` | header + session · 4 call rows (model, task, latency, tokens, status, cache) · expandable JSON · rule line · copy | closed, open, cached, fallback | `role="dialog"`, scrim, Esc, focus return |
| 24 | **Toast** | `.toast` | ink pill, text, auto-dismiss 2.6 s | single or stacked | `aria-live="polite"` |
| 25 | **State banners** | `.banner` | icon + heading + sentence + actions | error, offline, info | per `data-state` |
| 26 | **Skeletons** | `.is-skel` / `[data-state="loading"] .ai-region` | paper-deep bars shimmer | AI regions only; engine numbers remain visible | honest loading |
| 27 | **Disclosure** | `details.why` / `details.advanced` | summary row with chevron; body copy | closed, open | native `<details>`; 200 ms |
| 28 | **Footer / prototype switch** | `.footer` | brand line, honesty line, state links | static | state links only in prototype |

**AI provenance pattern (applies to every AI output):** `[Model name + version] · [latency] · [status: live | cached | fallback] · [numbers injected]` rendered as a mono micro-badge inside or directly under the card header. No AI text may appear without one. In `error`/`offline` states the badge changes to `fallback` / `cached`, and the AI region keeps deterministic fallback text — the engine numbers never change.

---

## 7. Handoff

### 7.1 Files

| File | What it is |
|---|---|
| [`design/DESIGN_SPEC.md`](DESIGN_SPEC.md) | this document — system, flow, copy, tokens, components, handoff |
| [`design/prototype.html`](prototype.html) | single-file static prototype; the visual target. Vanilla HTML/CSS/JS; no external assets, fonts or CDNs |
| [`design/README.md`](README.md) | how to open, what is mocked, dev notes |

### 7.2 Exact tokens (copy into the app's stylesheet)

```css
--paper:#F7F5F0; --paper-deep:#F1EDE3; --card:#FFFFFF; --card-warm:#FCFBF7;
--ink:#15171A; --muted:#6B7280; --muted-strong:#565E6A;
--line:#E4DFD3; --line-strong:#D3CCBD;
--accent:#FF5A36; --accent-ink:#B8361A; --accent-soft:#FDEDE7;
--verify:#0B6B53; --verify-soft:#E9F1ED;
--serif:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif;
--sans:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,"Helvetica Neue",Arial,sans-serif;
--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
--r-lg:22px; --r-md:16px; --r-sm:12px; --r-pill:999px;
--sh-xs:0 1px 2px rgba(21,23,26,.04);
--sh-sm:0 1px 2px rgba(21,23,26,.04), 0 10px 28px -18px rgba(21,23,26,.18);
--sh-md:0 2px 4px rgba(21,23,26,.05), 0 24px 48px -24px rgba(21,23,26,.22);
--ease:cubic-bezier(.22,.61,.21,1);
--dur-1:150ms; --dur-2:200ms; --dur-3:260ms;
```

### 7.3 Screen order & DOM mapping

1. `.topbar` → global chrome (fixed height 64).
2. `.shell` grid `236px 1fr`: `.rail` (stepper + session card) + `.main`.
3. `.main > .banner` (state banners, hidden by default) + three `<section class="screen" data-screen="brief|design|prove">`.
4. Screen content order is exactly §3.1 / §3.2 / §3.3.
5. Overlays outside `.main`: `.scrim`, `.drawer` (provenance), `.toast-region`, `.ai-menu` (inside top bar positioning context).
6. `?screen=` selects the active screen; `?state=` sets `document.body.dataset.state`; the stepper updates `aria-current` and completion classes.
7. To port: keep the class names, replace mock strings with API payloads, keep the CSS token block, and keep the AI badges wired to real `/api/provenance` data.

### 7.4 Mock vs real (explicit)

| Surface | Status | Notes for demo-engineer |
|---|---|---|
| Mass, P_f, governing mode, candidate comparison numbers | **REAL engine outputs** (verbatim v0.1 numbers) | 50.73 g / 0.997 % / Euler buckling; 44.34 g / 51.8 %; 56.41 g / 0.00064 %; 60.31 g / 1.00 %; 111.60 g; default uniform 62.69 g / 0.0082 %. Wire from `reports/summary.json` / engine calls. |
| Printability numbers | **REAL** | min strut 1.18 mm, slenderness 22.7, neighbour ratio 1.45 |
| Batch passport numbers | **REAL** | E ×0.8 → width scale 1.10, +8.5 % mass, pass; E ×0.5 → reject; 1.5 × print-clip rejection band |
| Validation checklist counts | **REAL** | 29 Python / 22 JS tests; seven checks from `validation/` |
| Lattice drawing | **Illustrative rendering** | geometry is a visual approximation of the 94-element model; not to scale |
| Batch acceptance chart curve | **Illustrative** | only the three supplied operating points are real; exact curve must come from the engine's acceptance-window computation |
| AI understanding fields, confidence 0.94, plan preview | **MOCK → Muse Spark** | `POST /api/brief/parse` returns schema-validated fields; confidence from response; editable UI stays |
| AI design memo / qualification memo | **MOCK → Muse Spark** | numbers must be injected from engine response; never let the model invent values |
| Model names, latencies, tokens, cache/fallback status | **MOCK** | replace with `/api/provenance`; per-visit values change |
| Voice transcript | **MOCK → Muse Voice Transcribe** | prototype simulates listening/transcribing; no audio capture |
| SAM 3.1 photo segmentation | **MOCK** | optional call shown in provenance only |
| Concept render | **REAL ASSET + MOCK CALL** | `demo/assets/product_render.png` now exists (1200 × 1200, added by the demo team); the prototype loads it via the relative path `../demo/assets/product_render.png`. The `Muse Image · 4.18 s` provenance row is mock. Image is illustrative only; label stays "AI illustration — not the CAD model" |
| Exports | **MOCK** | buttons only toast; wire to existing report/STL/JSON build |
| Lab mode sliders | **Illustrative** | visual toggle only; real sliders must recompute through the engine |
| Tokens, type, spacing, motion | **REAL spec** | implement exactly; do not substitute fonts |

### 7.5 Prototype QA recipe (for the demo engineer)

| What | URL |
|---|---|
| Land on Brief | `prototype.html` or `?screen=brief` |
| Begin on Design | `?screen=design` |
| Begin on Prove | `?screen=prove` |
| AI thinking skeletons | `?state=loading` (+ any screen) |
| No-brief empty state | `?state=empty` |
| AI failure banner + fallback badges | `?state=error` |
| Offline assistant banner + pill | `?state=offline` |
| Provenance drawer | open the AI pill → `View AI provenance` (or the footer links) |

The footer's quiet `State: default · loading · empty · error · offline` switch swaps states in place (no reload) so QA can screenshot every state quickly. Interactions that work: stepper navigation, brief → activity strip → Design, candidate selection (canvas + metrics update), view-mode toggles, mic simulation, batch-passport inputs/scenarios (live verdict), provenance drawer (Esc/scrim close, focus return), AI status menu, lab-mode advanced inputs, toast feedback, `?screen=` + `?state=` deep links.

### 7.6 Deviations from the PRD (and why)

1. **The concept render asset appeared during the build** at `demo/assets/product_render.png` (1200 × 1200). The prototype already points an `<img>` at that relative path and gracefully falls back to a styled SVG placeholder via `onerror`, so the file works as-is and can be swapped or inlined by the demo engineer.
2. **Batch acceptance chart is illustrative.** The PRD asks for a window chart; only three operating points (nominal, E ×0.8, E ×0.5) are supplied. The prototype draws a schematic curve through them, labels the chart `Illustrative v0.1 logic`, and does not invent additional engine points. Real curve must be computed by the engine.
3. **Candidate cards reuse verified comparison strategies** (Light = mean-only, Balanced = robust, Conservative = nominal FoS 1.5) rather than inventing new "AI parameter priors" with made-up mass/P_f values. The AI-prior framing and rationale text are mock; the numbers are real.
4. **Mic, exports, lab mode, SAM 3.1 and the concept render are visibly simulated** in the static prototype (toasts/placeholder/latency badges). No hidden fake functionality: every mock is labelled or in the provenance log.
5. **State switching is URL-only** (`?state=…&screen=…`) plus quiet state links in the footer, instead of extra chrome. This keeps the primary path clean while making QA screenshots trivial.
6. **`Lab mode` is presentation-only** in the prototype (reveals advanced inputs); the real sliders/recompute are deferred to the demo engineer, since the PRD's live-path priority is AI on the main path.

---

## 8. Anti-patterns (do not ship)

1. **No dense dashboard tables on the primary path.** Comparisons are 4 hairline bars or a single sentence; the validation checklist is evidence rows, not a table. Tables (if ever needed) live behind Lab mode or exports.
2. **No dark UI, no neon, no cyan/purple gradients, no glassmorphism, no glow shadows, no blueprint grid backgrounds.** This is the v0.1 failure being fixed.
3. **No more than two accent colours** (safety orange, verified green) and one paper tone. No third hue for "info"; use ink and grey.
4. **No invented numbers.** Every displayed value must trace to the verified engine or be explicitly labelled as mock/illustrative. No fake decimals, no rounded "about 51 %" where 50.73 exists, no synthetic latencies outside the provenance mock.
5. **No AI text without provenance.** Model badge + latency + cached/fallback + "numbers injected" is mandatory on every AI surface.
6. **No hiding assumptions.** Assumptions, claim ladder and limitations are always one scroll away on Prove, and the AI memos are explicitly written from computed outputs.
7. **No decorative serif everywhere.** Serif is reserved for one display headline per screen, section headings, hero numbers and candidate masses. Buttons, labels and body are sans.
8. **No card soup.** Each screen has a clear primary object (prompt → drawing → qualification); supporting cards are quiet, flat, hairline-bordered. Avoid every section being a card with a shadow at the same weight.
9. **No over-animation.** 150–260 ms, transform/opacity only, no bounce, no confetti, no typewriter AI text.
10. **No auto-advancing carousels, no modals on the happy path, no dashboard "KPI grid" with 8+ numbers.** Three metrics on Design, one verdict on Prove.
11. **No colour-only status.** Live/cached/offline, pass/warn/reject are always text or icon + text.
12. **No external dependencies.** The prototype must run from `file://` with no network and no fonts/CDNs; the shipped app inherits this rule.

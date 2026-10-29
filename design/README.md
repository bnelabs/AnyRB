# AnyRB v0.2 — Design deliverables

This folder is the **design source of truth** for the v0.2 redesign of AnyRB (the AI reliability studio for recycled-plastics part design). It replaces the old dark CAE dashboard with a calm, editorial three-step product: **Brief → Design → Prove**.

| File | What it is |
|---|---|
| [`DESIGN_SPEC.md`](DESIGN_SPEC.md) | Complete design system + 3-step flow spec: positioning, screen-by-screen content, copy deck, tokens, components, accessibility, anti-patterns, and the engineer handoff (including exactly what is mock vs real). |
| [`prototype.html`](prototype.html) | One self-contained static prototype (vanilla HTML/CSS/JS, no external assets, fonts or CDNs). This is the visual target the demo engineer implements. |
| `README.md` | This file — how to open, what to try, what is mocked, handoff notes. |

---

## 1. Open the prototype

No build, no server, no network required:

- **Double-click `prototype.html`** (Chrome/Safari/Firefox), or drag it into a browser.
- Or from `anyrb/`: `python3 -m http.server 8000`, then open `http://127.0.0.1:8000/design/prototype.html`.

The concept render is loaded with a relative `<img>` from `../demo/assets/product_render.png`. Keep the folder structure if you move the file; if the image is missing, a styled SVG placeholder appears automatically (the prototype still looks intentional).

### Deep links

| URL | Result |
|---|---|
| `prototype.html` / `?screen=brief` | Start on **01 Brief** |
| `?screen=design` | Start on **02 Design** |
| `?screen=prove` | Start on **03 Prove** |
| `?state=loading` | Skeleton AI regions + activity strip |
| `?state=empty` | No-brief / no-design empty states |
| `?state=error` | AI-failure banner, fallback badges, retry |
| `?state=offline` | Offline banner + offline AI pill |

Combine them: `prototype.html?screen=prove&state=loading`.
The quiet **State:** switch in the footer swaps states in place (no reload) — handy for QA screenshots.

---

## 2. What to try (the demo path)

1. **Brief** — edit the prompt, click an example chip, or hit **Describe it out loud** (mic simulation: listening → transcribing → transcript + provenance toast). Click **Design with AI** to watch the three-step AI activity strip and land on Design.
2. **Design** — click the three candidate cards (Light / Balanced / Conservative): the metric trio and lattice drawing update. Toggle **Geometry / Stress & buckling / Strut width**. Open the **Why this number?** disclosures.
3. **Prove** — drag the **batch passport** inputs or click **Nominal / Weak lot E×0.8 / Reject lot E×0.5** and watch the verdict change live (pass → pass with compensation → reject). Try the four export buttons (toast feedback).
4. **AI status pill** (top right) → opens the model-status menu; select Cached or Offline. **View AI provenance** opens the drawer with the four mock model calls, latencies, cache/fallback status and JSON snippets (Esc or the scrim closes it; focus returns to the trigger).
5. **Lab mode** reveals the advanced model inputs. **AI provenance** links in the Brief footer and drawer footer also work.

Keyboard: everything is a real button/input; the stepper, candidates, chips and disclosures are focusable; the drawer traps focus and closes on Esc; `Skip to content` is the first tab stop. `prefers-reduced-motion` disables all motion.

---

## 3. What is mocked vs real

**Real (verbatim v0.1 verified-engine numbers — do not change or round):**

- robust design **50.73 g**, **P_f 0.997 %**, binding mode **Euler buckling**; default uniform design **62.69 g / 0.0082 %**
- comparison set: solid **111.60 g**, uniform target-sized **60.31 g / 1.00 %**, nominal FoS 1.5 **56.41 g / 0.00064 %**, mean-only **44.34 g / 51.8 %**
- batch passport: lot **E ×0.8 → width scale 1.10, +8.5 % mass, pass**; **E ×0.5 → reject**; **1.5 ×** print clip
- printability: min strut **1.18 mm**, slenderness **22.7**, neighbour ratio **1.45**
- validation: **29 Python tests / 22 JS tests**; seven L0–L2 checks; 94-element frame model; 1,140-triangle STL
- the concept render image at `../demo/assets/product_render.png`

**Mocked, and visibly labelled as such:**

- AI understanding fields, confidence 0.94, plan preview, design memo and qualification memo (Muse Spark in the live build; numbers must be injected from the engine)
- all model names, latencies, token counts, cache/fallback statuses and the provenance JSON
- voice transcript (simulated) and SAM 3.1 segmentation
- export buttons (toast only), lab-mode sliders, project switcher, help
- the **batch acceptance chart is illustrative**: only the three supplied operating points are real; the exact curve must come from the engine's acceptance-window computation (chart is labelled as such in the UI)
- the lattice drawing is an illustrative rendering of the 94-element model, not a to-scale FEA plot

Full table: `DESIGN_SPEC.md §7.4`.

---

## 4. Handoff notes for the demo engineer

- **Keep the class names.** They are the contract: `.topbar`, `.stepper`, `.ai-pill`, `.prompt-card`, `.card`, `.ai-card`, `.lot-card`, `.plan`, `.viz`, `.metrics`, `.candidate`, `.memo`, `.gauge`, `.chart`, `.passport`, `.checklist`, `.render-card`, `.exports`, `.claims`, `.drawer`, `.toast`, `.badge`, `.chip`, `.seg`, `.btn`.
- **Copy the token block** (`:root` at the top of `prototype.html`) into the app stylesheet unchanged; `DESIGN_SPEC.md §7.2` has the same values in one block.
- **Screen order:** Brief (prompt → understanding + lot passport → plan → advanced) → Design (viz + metric trio → candidates → memo + vs conventional) → Prove (gauge + acceptance window → passport + validation → memo + render → exports → claims).
- **Wire the numbers from the engine, not from the DOM.** Replace mock AI strings with `/api/brief/parse`, `/api/design/plan`, `/api/design/review`, `/api/proof/memo`, `/api/voice/transcribe`, `/api/image/render` and drive the provenance drawer from `/api/provenance`. Keep the `Muse Spark · latency · cached/fallback · numbers injected` badge on every AI surface, and keep the deterministic fallback text for error/offline states.
- **Concept render:** `../demo/assets/product_render.png` (1200 × 1200) is already wired via `<img>` with `onerror` placeholder fallback; inline/bundle it when the demo build is assembled. Always keep the "AI illustration — not the CAD model" label.
- **Do not** reintroduce dark mode, neon, extra accent colours, dashboard tables on the primary path, or AI text without provenance. See the anti-patterns list in `DESIGN_SPEC.md §8`.
- The prototype is a **static target**, not production code: no fetch, no persistence, no audio capture. All interactions exist to prove the UX and to be ported.

---

## 5. Design direction in five lines

1. **Warm paper, not glass.** `#F7F5F0` paper, white cards with 1 px warm-grey borders, 18–22 px radii, soft shadows — an editorial lab instrument.
2. **Serif says, sans works.** Large serif display headlines and hero numerals; a clean system sans for all interface; tabular numerals everywhere numbers are compared.
3. **Exactly two accents.** Safety orange for the primary action/risk; verified green for pass/live/achieved. No third hue, no gradients, no neon.
4. **Three steps, one object each.** Prompt → drawing → qualification. Comparisons are hairline bars or a sentence; tables live in exports and Lab mode.
5. **Honest AI.** Every AI output carries model + latency + cached/fallback + "numbers injected"; the claim ladder and limitations are always visible on Prove; all engine numbers are verbatim.

---

## 6. QA checklist

- [ ] 1440 × 900 demo projector, 1280 × 800, 1024 × 768, 960 × 900: no horizontal scroll, no clipped copy.
- [ ] All five states (`default · loading · empty · error · offline`) × three screens are presentable and honest.
- [ ] Stepper: forward only through actions, backward allowed; `aria-current` updates; completed ticks appear.
- [ ] Candidates update mass/P_f/canvas; passport scenarios flip pass/compensate/reject correctly.
- [ ] AI status menu, provenance drawer (open/Esc/close/focus return), toasts, mic simulation all work.
- [ ] Keyboard-only pass: skip link → top bar → stepper → screen controls → drawer; visible focus everywhere.
- [ ] `prefers-reduced-motion: reduce`: no animation, no skeleton shimmer.
- [ ] No external network requests; works from `file://`; system fonts only.

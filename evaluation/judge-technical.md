# Judge — Technical Depth & Execution (20%)

**Score: 5.5 / 10**

Strong systems engineering around the AI boundary, and two of the three beam
modes are textbook-correct. That is capped — hard — by one order-of-magnitude
mechanics error in the third mode: the compression buckling term uses the
*strong*-axis inertia while calling it `weakInertia`, so a shipped preset
(planter wall, 180 × 4 mm) is certified by the app at ~1,028 kg when Euler
buckling about the true weak axis gives ~7.5 kg. A technical judge who opens
[app/product.js](../app/product.js) at line 282 will find it in minutes, and
[V0_8_SPEC.md](../V0_8_SPEC.md):59 states the intended formula (`π²EI_weak/L²`)
that the code does not implement. Fix that one function plus its regression
test and this is a 7.5; add a safety-factor story and it is an 8.

Evaluation was read-only except this report. Tests and a throwaway `/tmp`
rebuild were run; no source files were modified.

---

## 1. Tests I actually ran

| Command (from `anyrb/`) | Result |
|---|---|
| `node app/tests/model.test.mjs` | **28 pass, 0 fail**, 0 skipped, ~31 ms, exit 0 (node v26.12.1) |
| `AI_MOCK=1 .venv/bin/python -m pytest server/tests -q` | **135 passed, 1 skipped, 1 warning**, 0.78 s, exit 0. Re-run with `-rs`: the skip is the live smoke test at [server/tests/test_server.py](../server/tests/test_server.py):501 (`ANYRB_LIVE_TEST=1` + real key required). The warning is a Starlette `httpx` deprecation in FastAPI's test client, not a project failure. |
| Rebuild check: copied `app/` to `/tmp/anyrb-build-check`, ran `python3 app/build.py` there, `diff -q` against the repo | **BUILD OK (94.0 KiB); generated `index.html` and `app/standalone.html` byte-identical to the committed-in-tree copies.** No drift. |

Venv note: the instructed `.venv/bin/python` exists and works — Python 3.15.2,
pytest 9.2.0, symlinked to Homebrew's `python@3.15`. Two smells worth knowing:
[README.md](../README.md):96 documents `AI_MOCK=1 python3 -m pytest …` (bare
`python3`, not the venv), and [.venv/pyvenv.cfg](../.venv/pyvenv.cfg):5 records
the venv as created for `…/Candidate-2/anybatch/.venv`, a different directory
name than its current `anyrb/` home. It runs fine here because the interpreter
symlink is absolute, but the venv is not relocatable evidence of a clean setup.

What the counts do and don't prove:

- The 28 JS tests are real behaviour tests for selection, gaps, multi-target
  logic and the model boundary — but the *mechanics* tests are thin and partly
  tautological (see §4.6). Only cantilever gets a numeric check, and it
  restates the implementation's own formula.
- Of the 135 pytest tests, 75 target the current product endpoints
  (24 proposals + 31 advice + 20 brief). The other ~52 in
  [server/tests/test_server.py](../server/tests/test_server.py) (986 lines)
  verify the retired v0.3/v0.4 lattice-bracket contract. The headline "135
  passed" therefore overstates coverage of the judged app by roughly a third.
- Everything ran in mock/offline mode. No live Meta call was made or verified
  in this evaluation; `_meta.fallback` behaviour is what's tested.

---

## 2. Mechanics — what is correct

The core of [app/product.js](../app/product.js) is a pure-function module
(no DOM/network/storage, header lines 1–8), and the closed forms for the two
bending modes are right:

- Cantilever capacity `σ·b·t²/(6L)` and stiffness `3EI/L³`
  ([product.js:295-305](../app/product.js#L295-L305)) — correct for an
  end-loaded cantilever with a solid rectangular section, `I = bt³/12`
  ([product.js:278-280](../app/product.js#L278-L280)).
- Simply supported capacity `2σ·b·t²/(3L)` and stiffness `48EI/L³`
  ([product.js:298-305](../app/product.js#L298-L305)) — correct for a
  **central point load**. (The load position/distribution is an unstated
  assumption; a uniformly distributed load would change the moment by 2×.
  The UI never says "point load at midspan".)
- Mass `ρ·b·t·L/1000` g ([product.js:308-311](../app/product.js#L308-L311)) —
  unit-correct (mm³ → cm³), and strength is converted N → kgf with
  `G = 9.80665` ([product.js:10](../app/product.js#L10),
  [product.js:336-338](../app/product.js#L336-L338)). Labelling kgf as "kg"
  is conventional shop language but should be named once.
- **Full-swing range check** ([product.js:326-344](../app/product.js#L326-L344)):
  a build passes only if its *entire* property range across the batch's
  E/σ swing sits inside the target window (`range.min ≥ target.min`,
  `range.max ≤ target.max`). This is the right conservative instinct for
  variable recyclate — the low end must clear the strength floor. Note the
  deliberate trade-off: exceeding the strength *ceiling* also fails. That is
  defensible for a "hits the range" product contract, but a structural user
  will read a strength max as odd; be ready to explain it.
- **Multi-target simultaneity**: `passesAllTargets`
  ([product.js:554-557](../app/product.js#L554-L557)) requires every target
  at once, candidates are deduped and ranked, and gaps are reported per
  target when nothing passes ([product.js:803-806](../app/product.js#L803-L806)).
  The gap inverse-solving in `requiredMaterial`/`materialGap`
  ([product.js:457-520](../app/product.js#L457-L520)) is algebraically
  correct for the two bending modes.
- **Deterministic local search**: minimum-thickness scan at 0.5 mm steps
  ([product.js:522-538](../app/product.js#L522-L538)) and blend scan
  ([product.js:540-552](../app/product.js#L540-L552)) always run, so the app
  still produces a calculated answer with no model at all
  ([product.js:757-764](../app/product.js#L757-L764)).

## 3. The AI boundary — the strongest engineering in the repo

This is genuinely well built, and it is what keeps the score above the middle
despite §4.1:

- **Parameters-only proposals, rebuilt from an allow-list.**
  [server/product_ai.py:293-346](../server/product_ai.py#L293-L346)
  (`sanitize_proposals`) constructs each proposal from named keys only;
  strength/stiffness/weight/result keys from the model simply cannot survive.
  The browser re-implements the same gate independently
  ([product.js:408-440](../app/product.js#L408-L440) `normalizeCandidate`
  builds fresh objects; the test at
  [app/tests/model.test.mjs:231-243](../app/tests/model.test.mjs#L231-L243)
  feeds it `strength: 999, certification: 'yes'` and asserts they are gone).
- **Clamping everywhere, on both sides.** Server contract limits
  ([product_ai.py:48-53](../server/product_ai.py#L48-L53)); request-side
  sanitisation clamps rather than rejects
  ([product_ai.py:191-287](../server/product_ai.py#L191-L287)). Model span
  proposals are additionally clamped to ±20 % of the user's span in the
  browser ([product.js:677-679](../app/product.js#L677-L679)).
- **No invented fallback.** When the model is unavailable or returns garbage,
  proposals are an empty list with `_meta.fallback = true`
  ([product_ai.py:385-419](../server/product_ai.py#L385-L419)); advice returns
  `available: false` with empty text
  ([product_ai.py:785-797](../server/product_ai.py#L785-L797)); the brief
  returns an all-null extract ([product_ai.py:1179-1217](../server/product_ai.py#L1179-L1217)).
  Nothing pads the list from a local fixed menu — and there are tests named
  exactly for that (`test_sanitizer_never_pads_missing_move_types`,
  `test_no_local_fixed_proposal_generator`).
- **Advice grounding.** Every number in advice text must exist in the
  supplied plan, via [server/prompts.py:220-240](../server/prompts.py#L220-L240)
  (3 % tolerance, percent-form conversion), wrapped by the range-dash-aware
  `advice_grounding` ([product_ai.py:709-723](../server/product_ai.py#L709-L723)).
  Ungrounded, certifying, or test-instructing output is discarded wholesale
  ([product_ai.py:823-838](../server/product_ai.py#L823-L838)). The
  deterministic test-instruction guard
  ([product_ai.py:730-751](../server/product_ai.py#L730-L751)) even handles
  false positives ("latest", "greatest" survive — tested).
- **Brief extract-only gate.** A brief number survives only if it (or a
  unit-converted form) was actually stated in the user's text
  ([product_ai.py:995-1034](../server/product_ai.py#L995-L1034),
  [product_ai.py:1072-1144](../server/product_ai.py#L1072-L1144)); unstated
  fields stay null for the UI to ask about. Prompt-injection posture is
  consistent: untrusted text is delimiter-wrapped and fences are neutralised
  ([prompts.py:22-36](../server/prompts.py#L22-L36)).
- **Meta client hygiene.** [server/meta_client.py](../server/meta_client.py):
  key redaction including partial-key fragments (lines 105–114), cache-first
  with provenance logging that strips the key (lines 162–191), one transient
  retry then a contributor→standard model fallback chain (lines 320–393),
  and `_meta` that honestly reports `cached`/`fallback`/`mock`. The browser
  payload builders are asserted key-free in tests
  ([app/tests/model.test.mjs:308-330](../app/tests/model.test.mjs#L308-L330)).
- **Exact-proposal verifier trace.** Model proposals are first scored
  *as given* and the rejection is user-visible (`modelTrace`,
  [product.js:693-713](../app/product.js#L693-L713)) before the mechanics
  searches that move's direction for a passing size. "The model proposes,
  the physics disposes" is implemented, not just claimed.

## 4. Flaws a technical judge will find — ranked

### 4.1 [Critical] Compression buckling uses the strong axis — planter preset overstates capacity ~137×

[product.js:282-286](../app/product.js#L282-L286):

```js
function weakInertia(part) {
  const a = part.widthMm; const b = part.thicknessMm;
  return (Math.min(a, b) * Math.max(a, b) ** 3) / 12;
}
```

Weak-axis inertia of a rectangle is `(long side)·(short side)³/12`. This code
cubes the **long** side — it returns the *maximum* second moment, the exact
opposite of its name and of [V0_8_SPEC.md:59](../V0_8_SPEC.md#L59)
(`π²EI_weak/L²`). It feeds the Euler term at
[product.js:290-293](../app/product.js#L290-L293).

Verified numerically against the shipped planter preset
([product.js:38-42](../app/product.js#L38-L42), 300 mm tall, 180 × 4 mm,
default plastic E 700–850 MPa, σ 14–18 MPa):

- Code: `I = 1,944,000 mm⁴` → Euler ≈ 149 kN, so `min(squash, Euler)` =
  squash = 10,080 N. The app reports the current build passing at
  **1,028–1,322 kg**.
- Correct weak axis: `I = 180·4³/12 = 960 mm⁴` (2,025× smaller) → Euler ≈
  **74 N ≈ 7.5 kg** at E = 700 MPa. The wall buckles at roughly 1/137 of the
  claimed load.

This is not an edge case a judge has to construct: it is one of the five
example cases on the first screen, and its target window (1,000–1,400 kg)
was evidently tuned against the buggy number.

Compounding it, `requiredMaterial` for compression ignores buckling
entirely — the coefficient is just area
([product.js:460](../app/product.js#L460)) — so even the *gap diagnosis*
("you need σ ≥ 13.6 MPa; your batch gives 14–18") would bless this wall.
With the correct inertia, hitting 1,000 kg would need E ≈ 93,000 MPa: no
plastic exists. Two code paths must agree after the fix.

Also missing even once `I` is fixed: an effective-length factor (K = 1,
pinned–pinned, is silently assumed at [product.js:292](../app/product.js#L292);
a "stands in compression" wall is closer to fixed–free, K = 2, another 4×),
any slenderness/short-column (crushing-vs-Euler) transition, and imperfection
knockdown. And the only compression test asserts an *ordering*
(capacity > simple-beam capacity) with a stubby 20 × 5 section where the bug
cannot bite ([app/tests/model.test.mjs:46-53](../app/tests/model.test.mjs#L46-L53)).

### 4.2 [High] No safety factor, and "strength" is undefined

There is no occurrence of a safety/partial factor anywhere in `app/` (grep:
zero matches). Capacity is computed at face value from the user-supplied
σ range ([product.js:289-299](../app/product.js#L289-L299)) and the range
check then requires the batch's low end to sit above the target floor — the
batch swing is the only margin. Nothing states whether σ is yield or
ultimate, tensile or flexural, and no factor is applied to either the load
or the resistance side. [README.md:131-134](../README.md#L131-L134) honestly
disclaims certification, which protects the *claim*, but the app still
outputs a build ticket ("Make the …") with no margin language. For recycled
plastic under sustained load the bigger omission is creep: E enters as an
instantaneous modulus ([product.js:302-306](../app/product.js#L302-L306));
there is no time/temperature derating, no shear check (relevant for the
short, thick pallet/crate geometries), no self-weight in the bending load,
and stiffness is judged only against a user-invented N/mm window rather than
a deflection limit. The retired engine had a sustained-load advisory; the
active product dropped it silently.

### 4.3 [High] Blend rule is the optimistic bound, and blend "mass" breaks least-mass selection

`blendPlastic` ([product.js:313-324](../app/product.js#L313-L324)) applies a
linear (Voigt) mixture rule to both endpoints of E *and* σ. Voigt is the
theoretical **upper bound** for modulus of a perfectly bonded composite; for
immiscible recycled blends, strength routinely falls *below* linear
interpolation. Three further distortions:

- Density is never blended — `plasticFor` returns the batch plastic with
  only E/σ changed ([product.js:381-385](../app/product.js#L381-L385)), so a
  blend's weight is scored at the unblended density
  ([product.js:774](../app/product.js#L774)). The fraction's basis (mass?
  volume?) is never declared.
- The steady stream is a single point value, so blending mechanically
  *narrows* the swing toward certainty (at f = 0.9 the residual swing is
  10 % of the batch's) — blending is credited with removing variability
  that a real second stream would partly re-add.
- Because a same-geometry blend has `addedG = 0`, least-added-mass ranking
  ([product.js:781](../app/product.js#L781),
  [product.js:793-799](../app/product.js#L793-L799)) prefers "replace 90 % of
  your material with the steady stream" over "+5 g of thickness" — the
  scarce-stream consumption is free in the objective. (`proposalRow` and the
  build ticket do disclose the % separately
  ([product.js:929](../app/product.js#L929)), but the *winner choice* is
  made on the distorted metric.)

### 4.4 [Medium] One solid rectangle, hidden constants, inconsistent contracts

- **Rectangular solid only**: `I = bt³/12`, area `bt`
  ([product.js:274-280](../app/product.js#L274-L280)). No hollow, ribbed,
  T/I or sandwich sections — for stiffness-limited plastic parts the section
  *shape* is usually the design lever, and here "section" means only width
  (plus optionally thickness). README discloses this
  ([README.md:132](../README.md#L132)); the UI does not.
- **Hidden 20 % support penalty**: every span move is charged
  `0.2 × currentMass` grams, added into both its mass and its weight range
  ([product.js:698](../app/product.js#L698),
  [product.js:753](../app/product.js#L753),
  [product.js:768-774](../app/product.js#L768-L774)) and labelled "+ support".
  The constant is undocumented in the spec and independent of span change,
  mode change, or support type — an invented number sitting inside an
  otherwise "no invented numbers" product.
- **JS ↔ server contract drift**: server proposal limits are thickness
  2–200 mm, width 5–500, span 50–5000, blend 0.15–0.75
  ([product_ai.py:48-53](../server/product_ai.py#L48-L53)); the browser
  accepts thickness 1–400, width 2–800, span 20–6000
  ([product.js:137-139](../app/product.js#L137-L139)) and locally searches
  blends 0.05–0.90 ([product.js:545](../app/product.js#L545)). A model blend
  at 0.10 is legal in one layer and out-of-contract in the other. Density
  bounds also differ (browser 0.05–5 g/cm³ at
  [product.js:211](../app/product.js#L211) vs server 0.5–3 at
  [product_ai.py:273](../server/product_ai.py#L273)).
- **Grounding tolerances are looser than they look**: brief numbers pass if
  they match a stated number scaled by any of
  (1, 1000, 0.001, 100, 0.01, 10, 0.1) within 3 %
  ([product_ai.py:982](../server/product_ai.py#L982),
  [product_ai.py:1007-1011](../server/product_ai.py#L1007-L1011)) — a stated
  "10" can ground an extracted 100 or 1,000. Advice grounding exempts every
  integer ≤ 12 as a "count/label" ([prompts.py:231](../server/prompts.py#L231)),
  so "12 kg" in prose is ungroundable-by-design. Both are reasonable
  engineering trade-offs; neither is documented as one.
- **Cache key excludes the system prompt** ([meta_client.py:366](../server/meta_client.py#L366)
  hashes kind + model + payload), and there is no TTL — a prompt fix does not
  invalidate cached answers. `meta_client` also falls back to reading an env
  file *outside the repo* (`…/sprint/backend/.env`,
  [meta_client.py:64-65](../server/meta_client.py#L64-L65)), a legacy path a
  reviewer will trip over.

### 4.5 [Medium] Stale historical surface actively confuses the technical story

The working tree still ships the retired world next to the product, and parts
of it are *live code*, not just old docs:

- [server/app.py](../server/app.py) still registers the v0.4 endpoints
  (`/api/brief/parse`, `/api/design/plan`, `/api/design/review`,
  `/api/proof/memo` — lines 441–557) backed by the lattice-bracket prompts
  and deterministic fallbacks in [server/prompts.py](../server/prompts.py),
  and `/api/health` reports `"version": "v0.4"`, an "engine 0.4 canonical"
  with reliability targets, and the old validation summary
  ([server/app.py:405-429](../server/app.py#L405-L429)). A judge probing the
  API will meet a second, contradictory product.
- [validation/README.md](../validation/README.md) still headlines
  "55 PASS · 3 WARN" (its own `results.json` says 56/2 — internally
  inconsistent) for the **retired FE lattice engine**
  ([engine/anyrb/mechanics.py](../engine/anyrb/mechanics.py)), not for
  `product.js`. None of that validation touches the shipped planter bug.
  [README.md:99-101](../README.md#L99-L101) and
  [SUBMISSION_REPO.md:29-30](../SUBMISSION_REPO.md#L29-L30) say the clean
  submission tree removes all of this — but the tree being judged has not
  been cleaned.
- **Dirty working tree**: `git status` shows 14 modified tracked files plus
  1 untracked screenshot on top of HEAD `51da45d` (v0.9.4), including
  [app/product.js](../app/product.js), its tests, both built HTML files and
  the demo video. The judged behaviour (e.g. the crate case's E range
  1,111–1,589 MPa) exists only uncommitted. A judge who checks out HEAD gets
  a different app; a judge who doesn't will ask why the submission isn't a
  commit.

### 4.6 [Medium] Mechanics test coverage would not catch §4.1 — and didn't

- The single numeric mechanics test reproduces the implementation's formula
  as its own expected value
  ([app/tests/model.test.mjs:39-44](../app/tests/model.test.mjs#L39-L44)) —
  it can catch a typo, never a wrong formula.
- Compression is tested only by inequality on a stocky section
  ([app/tests/model.test.mjs:46-53](../app/tests/model.test.mjs#L46-L53));
  there is no slender-section case, no Euler value, no test that
  `min(squash, Euler)` ever selects Euler. A one-line numeric test
  (180 × 4 × 300 mm → ≈ 74 N) would have caught §4.1 at commit time.
- No test covers blend density/mass, span-support mass, self-weight, or any
  section-search boundary; one test is a source-string guard over HTML/JS
  ([app/tests/model.test.mjs:341-362](../app/tests/model.test.mjs#L341-L362)),
  which tests that strings exist, not that behaviour is right.

### 4.7 [Low] Build transpiler is clever and fragile

[app/build.py](../app/build.py) regex-transpiles ES modules into a single
page (import/export rewriting, lines 27–92) and syntax-checks the bundle with
`node --check` (lines 138–153). Verified above: current output is
byte-reproducible. But `node --check` proves syntax, not semantics; the
regexes will silently mishandle re-exports, multiline import specifiers
beyond the one pattern, or `export default <expr>` (line 81 strips the
keyword and leaves the expression). Fine for two known modules; a trap the
day a third module style arrives. It also writes two copies of a 94 KiB file
that must be re-generated and re-committed on every source edit — currently
in sync, but they are part of the dirty tree (§4.5).

## 5. Strengths worth showing judges (with the file open)

1. The allow-list boundary, demonstrated live: feed the proposals endpoint a
   model reply containing `"strength": 999` and watch it vanish —
   [product_ai.py:293-346](../server/product_ai.py#L293-L346) +
   [app/tests/model.test.mjs:231-243](../app/tests/model.test.mjs#L231-L243).
2. The verifier trace: exact Meta proposals scored and *visibly rejected*
   before any search — [product.js:693-713](../app/product.js#L693-L713),
   test at [app/tests/model.test.mjs:245-254](../app/tests/model.test.mjs#L245-L254).
3. Full-swing, all-targets-at-once passing rule —
   [product.js:341-344](../app/product.js#L341-L344) +
   [product.js:554-557](../app/product.js#L554-L557). This is the correct
   answer to recyclate variability and it is simple enough to explain.
4. Failure honesty: with the model off, the endpoints return empty +
   `fallback: true` rather than inventing moves/advice
   ([product_ai.py:400-403](../server/product_ai.py#L400-L403)) while the
   local minimum-thickness/blend calculation still answers.
5. Reproducible single-file build (verified byte-identical in /tmp) and a
   163-test green run in under a second — the demo cannot die from a flaky
   test suite.

## 6. Ranked fixes

1. **Fix `weakInertia`** to `(max · min³)/12`
   ([product.js:282-286](../app/product.js#L282-L286)); make
   `requiredMaterial`'s compression branch buckling-aware (required E from
   Euler alongside required σ) ([product.js:460](../app/product.js#L460));
   add a numeric slender-column regression test (planter geometry → ≈ 74 N,
   not 10,080 N) and re-tune or remove the planter preset, which currently
   only "passes" because of the bug. State the effective-length assumption.
2. **Introduce an explicit margin**: define σ (yield vs ultimate), apply a
   named partial/safety factor (or require targets to be entered as
   allowables and say so in the UI), and add a sustained-load/creep derating
   note for E. Put the rectangular-section + central-point-load assumptions
   on the Engineering panel, not only in [README.md:132](../README.md#L132).
3. **Repair the blend model**: declare the fraction basis, blend density by
   the same rule, give the steady stream a range (or stop crediting swing
   reduction), label the mixture rule as an upper-bound estimate, and charge
   blends their steady-stream mass in the least-added-mass ranking
   ([product.js:774-799](../app/product.js#L774-L799)) so the winner metric
   compares like with like.
4. **Remove or justify the hidden constants**: the 20 %-of-current-mass span
   support charge ([product.js:753](../app/product.js#L753)) should be a
   user-visible input or be deleted; align JS and server limits (thickness/
   width/span/blend/density) into one contract table.
5. **Clean the judged tree**: commit the working tree (or tag the judged
   commit), drop the retired `/api/brief|design|proof` routes and v0.4
   health payload from the shipped server, and move `engine/`, `validation/`,
   `history/` out — as [SUBMISSION_REPO.md](../SUBMISSION_REPO.md) already
   prescribes. Until then, add a banner to `validation/README.md` that its
   58 checks do not cover `app/product.js`.
6. **Deepen mechanics tests**: independent numeric expectations (not
   formula restatements) for simple-support and compression, a case where
   Euler governs, blend mass/density, and a build-drift CI check
   (`build.py` in a temp dir + `diff`) so the generated pages cannot go
   stale silently.
7. **Tighten the caches/grounding edges**: include a system-prompt hash (or
   prompt version) in the Spark cache key
   ([meta_client.py:366](../server/meta_client.py#L366)), document the
   ≤12-integer and ×10/×100 grounding allowances, and remove the
   out-of-repo `sprint/backend/.env` fallback
   ([meta_client.py:64-65](../server/meta_client.py#L64-L65)).

---

*Bottom line for the 20 % criterion: the software architecture around the
model — sanitising, grounding, clamping, fallbacks, provenance, reproducible
build — is hackathon-finalist quality. The engineering core it protects has
one disqualifying-until-fixed defect in compression buckling that flips a
shipped example from ~7.5 kg to ~1,028 kg, no safety-factor story, and an
optimistic blend rule. 5.5/10 as it stands; the path to 8 is short, specific,
and listed above.*

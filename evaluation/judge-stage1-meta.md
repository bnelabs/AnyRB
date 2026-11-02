# AnyRB — Stage 1 screening + Use of Meta AI Tooling

**Judge role:** Meta Global AI Developer Hackathon, Stage 1 screener / Use of Meta AI Tooling (25%)
**Date of this review:** 2026-11-02 (inside the Oct 27–Nov 4, 2026 building period)
**Method:** Read-only code/docs/git inspection. I did **not** call the Meta API, did not start the server, did not read `server/.env` contents, and inspected `server/cache/` by file names only. Local `server/provenance.jsonl` was aggregated (kind/model/cached/fallback/timestamp counts) — it contains no key field by construction (`server/meta_client.py:162-173`). Nothing below invents a live call, user, or result I could not trace to code or a logged artefact.

---

## Verdict: PASS (Stage 1) — with two evidence fixes required before final submission

## Use of Meta AI Tooling: **6 / 10**

### Stage 1 gate, criterion by criterion

| Criterion | Verdict | Basis |
|---|---|---|
| Reasonably fits theme / problem statement | **PASS** | Declared track is Build for Your World (`HACKATHON.md:3`, `SUBMISSION.md:5-6`): a named, specific beneficiary — a small shop buying variable recycled-plastic deliveries that must decide what to make, at what size, and what to add (`HACKATHON.md:9-12`). The mechanics, batch gap and blend are built around that shop decision, not around a generic prompt box. |
| Reasonably used Meta Model API and/or open weights | **PASS** | Real HTTP integration, not a stub: `POST {META_BASE_URL}/chat/completions` with `muse-spark-1.3-contributor`, falling back to `muse-spark-1.3` (`server/meta_client.py:70-76`, `:320-353`, `:377-391`), and `POST /asr/transcribe` with `muse-voice-transcribe-1.0` (`server/meta_client.py:75`, `:506-524`). Local provenance logs non-cached, non-fallback calls for exactly the judged kinds (see §2). |
| New work only (Oct 27–Nov 4, 2026) | **PASS, with a disclosure caveat** | All 23 commits are dated 2026-10-29 to 2026-10-31; zero commits predate Oct 27. The judged v0.8/v0.9 surface is demonstrably incremental in that window (`caa83da` 2026-10-31 → `32d9bfc` → `f0b215b` → `a25c499` → `51da45d`). Caveat in §5. |
| Demo identifies hackathon-built work | **PASS in the docs; NOT YET complete as a submission** | `HACKATHON_WORK.md:7-18` maps judged files/commits and `HACKATHON_WORK.md:20-24` explicitly quarantines pre-product history. But the public-facing pack is unfinished: repo/live URLs are "to be set" (`SUBMISSION.md:16-19`), every pre-submit box is unchecked (`SUBMISSION.md:44-53`), the video is a synthetic-narration draft to be replaced (`DEMO_SCRIPT.md:3`, `HACKATHON.md:70`), and 14 files of Nov 2 work are currently uncommitted (`git status`). |
| Not a banned category (basic RAG, simple chatbot, etc.) | **PASS** | There is no retrieval corpus/RAG pipeline. The core loop is structured extraction → parameter-only proposals → deterministic range scoring in the browser (`app/product.js:693-713`), which is a different shape from a chat wrapper. One component — `/api/product/advice` — is conversational text generation, and on its own it would read as chatbot-adjacent; it survives screening only because it is number-grounded and rejection-tested (§3) and is not the product's centre. Keep it that way in the demo: lead with brief → proposals → verifier, not with Ask Meta. |

**Why PASS and not higher-confidence PASS:** the Meta integration is genuinely in the live path in code and in local logs, but the *tracked, cloneable* evidence for the three judged product endpoints is stale/absent (§2.3). A screener who clones the public repo cannot reproduce the strongest claim from committed artefacts alone. That is fixable in hours (Fix 1) and should not fail Stage 1, but it is the first thing a sceptical judge will find.

---

## 1. What the product actually is (for the record)

AnyRB turns a measured recycled-plastic delivery into a makeable part: Muse Spark parses a typed or spoken shop brief into editable product/target/batch state, Spark proposes engineering moves, and a deterministic verifier scores the exact proposals against every target across the full material swing (`HACKATHON.md:5`, `:16-32`). The browser never receives a model-authored strength/stiffness/weight number (`HACKATHON.md:29-32`); that separation is enforced in code, not just claimed (§3).

## 2. Are Muse Spark 1.3 Contributor and Muse Voice Transcribe really called?

**Yes — in code, and with local log evidence. No — not provable from tracked artefacts alone for the judged endpoints.**

### 2.1 The call path is real network code

- Model IDs and base URL are configuration, defaulting to `https://api.meta.ai/v1`, `muse-spark-1.3-contributor`, `muse-spark-1.3`, `muse-voice-transcribe-1.0` (`server/meta_client.py:70-76`); `reasoning_effort=low`, `max_tokens=4000` (`server/meta_client.py:77-78`).
- Spark: a concrete `httpx` POST to `/chat/completions` with `response_format={"type":"json_object"}`, one transient retry on 429/5xx (`server/meta_client.py:320-353`). `spark_json` tries Contributor, then Standard, then falls back (`server/meta_client.py:377-393`).
- Voice: audio is normalised to mono 16 kHz s16le WAV (`server/meta_client.py:463-489`) and POSTed multipart to `/asr/transcribe` with `mode:"PUSH_TO_TALK"` (`server/meta_client.py:504-524`). The browser records, converts to WAV client-side (`app/main.js:613-656`), uploads (`app/main.js:671-695`), then chains the transcript into the Spark brief parse (`app/main.js:694-695`, `:785-816`).
- Endpoints are wired live: `/api/product/brief`, `/api/product/proposals`, `/api/product/advice`, `/api/voice/transcribe` (`server/app.py:560-592`).
- The key stays server-side: `_headers()` is server-only (`server/meta_client.py:231-232`), and `redact()` strips the key from anything logged/returned (`server/meta_client.py:105-114`, `:167-168`).

### 2.2 Local (uncommitted) evidence supports live use on this machine

Aggregating the local, gitignored `server/provenance.jsonl` (226 entries, 2026-10-29 → 2026-11-02):

| kind | live (not cached, not fallback) | cached | model on live entries |
|---|---|---|---|
| `product_proposals` | 34 | 44 | `muse-spark-1.3-contributor` |
| `product_advice` | 22 | 11 | `muse-spark-1.3-contributor` |
| `product_brief` | 8 | 15 | `muse-spark-1.3-contributor` |
| `asr` | 3 | 1 | `muse-voice-transcribe-1.0` |

Live entries carry plausible latencies (product_brief ≈15–17 s, product_proposals ≈6–7 s, product_advice ≈10 s, asr ≈3–8 s) and token-usage keys. Cache file *names* corroborate the shape: 33 entries in `server/cache/` — 8× `spark_product_brief_*`, 15× `spark_product_proposals_*`, 8× `spark_product_advice_*`, 2× `asr_*`. I did not open cache payloads.

**Limits of this evidence:** provenance is a local append-only log the author controls; it is consistent with the code path and with latency/token shapes, but it is not third-party attestation. I did not independently re-run a live call (read-only brief), so I am reporting "code + local log agree," not "I witnessed a call."

### 2.3 The tracked evidence does **not** prove the judged endpoints — this is the biggest credibility gap

- The only committed evidence file, `server/evidence/live_calls.json`, was generated 2026-10-29 (`live_calls.json:2`) for the **retired** endpoints (`/api/brief/parse`, `/api/lot/parse`, `/api/design/plan`, `/api/design/review`, `/api/proof/memo`, image, SAM) — none of the three judged product endpoints appears in it.
- `server/verify_live.py` still only exercises those retired endpoints plus voice/image/SAM (`server/verify_live.py:180-206`); it never calls `/api/product/brief|proposals|advice`. The repo itself admits the freshness problem (`server/README.md:93-96`).
- Both stronger artefacts are excluded from the public repo by design: cache and provenance are gitignored (`.gitignore:5-6`), and the submission packaging script deletes them from the clean tree (`scripts/package_submission.sh`, "Remove historical, generated and secret material").

Net: on this machine, live use is well supported. From a fresh clone, a judge sees *code that would call Spark/Voice* and *a 2026-10-29 evidence file for a different product surface*. Fix 1 closes exactly this gap.

### 2.4 Repo hygiene / secrets

- `server/.env`: **present locally, gitignored, not tracked.** `git ls-files` shows only `server/.env.example` (whose key value is a placeholder, `server/.env.example:3`); `.gitignore:3-4` covers `server/.env` and `.env`; `git check-ignore` confirms. I did not read or print the `.env` contents.
- Cache, provenance and `.venv/` are likewise untracked. No credential was observed in tracked files during this review. (I did not perform a full-repo secret scan; the packaging checklist claim "No `.env`, no key, no cache in the repo" in `SUBMISSION.md:51` is consistent with `git ls-files` output I saw.)

## 3. Mocked / cached / fallback behaviour — the honest parts and the trap

The product endpoints were clearly designed to refuse invention, and mostly do:

- **Resolution order** in `spark_json`: explicit mock (bypasses cache) → disk cache → no-key fallback → live Contributor → live Standard → deterministic fallback (`server/meta_client.py:356-393`). Every outcome is labelled in `_meta` with model, latency, `cached`, `fallback`, `mock`, usage (`server/meta_client.py:213-221`).
- **Proposals:** on any failure the fallback is `{"proposals": []}` — there is no local fixed move list (`server/product_ai.py:388-403`). The browser then shows "Muse Spark is unavailable. The calculated build stands." (`app/main.js:418-424`, `:322`).
- **Advice:** unavailable/ungrounded/test-instructing/certification-claiming output is replaced by `available:false` with a `reason_code` (`server/product_ai.py:800-847`, guards at `:724-751` and `:832-838`).
- **Brief:** unavailable or content-free parses return a fully empty brief with `available:false`; no local parser is substituted (`server/product_ai.py:1179-1210`).
- **Sanitising is the strongest engineering here.** Brief numbers are dropped unless they were actually stated in the user's text, with unit-factor tolerance (`server/product_ai.py:995-1034`, `:1072-1144`); proposals are rebuilt from an allow-list, clamped, and stripped of any result keys (`server/product_ai.py:293-346`); advice numbers must ground to the request payload (`server/product_ai.py:709-723`).

**The trap — cache is checked before the key, and the UI hides it:**

1. A warm cache returns `cached:true, fallback:false` **even with no key / offline** (`server/meta_client.py:369-373`, `:259-271`). The submission docs acknowledge the demo sample is cached (`HACKATHON.md:96-97`).
2. The frontend never surfaces `_cached` or the model name: `readBrief` announces "Muse Spark read…" on any `available` response (`app/main.js:806-816`), `fetchProposals` only checks `fallback` (`app/main.js:417-424`), and there is no cached/live badge anywhere in `app/main.js` / `app/index.html`.

So the exact demo a judge is most likely to replay — the sample brief on a warmed machine — can succeed with the network unplugged while the UI narrates it as a live Spark read. The server is honest (`_meta.cached`); the product surface is not. This is precisely the demo-integrity failure mode Meta screeners are trained to probe (Fix 2).

**Fallback inconsistency outside the judged surface:** the retired endpoints still exposed by the same server (`server/app.py:441-557`) use deterministic fallbacks in `server/prompts.py` that *do* synthesise plans/memos, and `/api/health` advertises all eleven endpoints (`server/schemas.py:392-395`) while simultaneously naming only the three product endpoints as active (`server/app.py:407-412`). A judge who pokes `/api/design/plan` offline will get invented content and may reasonably ask which claim — "never invents" or this — is operative. Quarantine or clearly label them (Fix 5).

## 4. What a sceptical Meta judge would try to break

These are the probes I would run, with what the code says will happen. I flag which outcomes I verified by reading vs. inferred from code paths.

1. **"Is the verifier just theatre?"** Partly answerable in the project's favour: the trace scores the *exact* Spark proposals deterministically (`traceModelProposals`, `app/product.js:693-713`) and the UI shows accepted/rejected counts (`app/main.js:262-296`), with a test asserting a 12.5 mm proposal is scored and rejected (`app/tests/model.test.mjs:245-254`). **But** the passing list is then built from more than Spark: `evaluateBuilds` unconditionally adds a locally-searched minimum-thickness candidate and a blend candidate alongside exact/model-directed ones (`app/product.js:758-763`). Remove Spark entirely and a winner can still appear. The accurate claim is "verifier-checked, locally-completed," not "Meta proposes, verifier disposes" (`HACKATHON.md:29-32`, `DEMO_SCRIPT.md:51-53` overstate the model's role).
2. **"Is Spark just parsing / just filling a fixed menu?"** For the brief: yes, it is extraction — deliberately, with stated-number grounding as the safeguard (`server/product_ai.py:877-890`, `:1025-1034`). The defence is voice input + free-form multi-target text + unit conversion + editability; a form alone would not need Spark, so the demo must show messy, spoken, multi-requirement input, not the polished sample sentence. For proposals: the menu is fixed by contract — four required move types (`server/product_ai.py:45-46`, prompt at `:66-71`) — and, critically, `searchModelMoves` uses only each proposal's **direction** (thicker/thinner, wider/narrower, longer/shorter) and then searches for the passing size itself (`app/product.js:597-663`). Change Spark's thickness from 17 mm to 19 mm and the outcome is identical if the sign is the same. Spark's numerical judgement is therefore mostly discarded; only move-type + direction + (for span) mode survive. This is the single largest cap on the Meta-tooling score.
3. **"Unplug it."** With a warm cache: sample brief still "reads" (see §3). With cache cleared and no key: brief returns empty/unavailable, proposals return `[]`, advice returns `available:false`, and the local mechanics (current build, minimum thickness, blend) still computes (`server/product_ai.py:390-403`, `:1198-1210`; `app/product.js:759-762`). That degraded mode is honest and should be *shown* in the demo rather than discovered by the judge.
4. **"Feed the verifier a rejection and watch Spark learn."** It won't: there is no feedback loop. Rejected proposals are handed to the local mechanics search (`app/main.js:292-294`); Spark is never re-queried with the rejection. One round-trip per endpoint, no iteration, no use of Spark's reasoning over the verifier's counter-evidence. A frontier-track judge will notice the missing loop immediately (Fix 3).
5. **"Clone it fresh and prove it's live."** Fails today: no cache, no provenance, `verify_live.py` tests retired endpoints, evidence file predates the product surface (§2.3). Also, 14 files of current work are uncommitted, so even the code a judge clones may lag this review.
6. **Prompt-injection / hallucination probes.** Brief text is wrapped as untrusted data (`server/product_ai.py:861-862`, `:1165-1176`) and unstated numbers are dropped — but numbers the user *states* falsely pass by design (extract-only means extract-only). Advice with invented numbers is rejected by grounding (`server/product_ai.py:832-838`); advice telling the user to test/prototype/measure is rejected deterministically (`server/product_ai.py:726-751`). These guards are genuinely implemented; the demo should include one live injection/grounding rejection to prove they fire outside unit tests (tests are mock-mode: `server/tests/test_product_brief.py:30`, simulated transport, no network).
7. **Voice robustness.** Only 3 live ASR entries in local provenance, all from this machine's sessions; the tracked transcript evidence is the retired bracket brief (`server/evidence/live_calls.json:241-260`, generated from a synthesised WAV in `server/verify_live.py:71-81`). Accent, noise, and non-WAV input are unproven in committed artefacts. The client-side WAV conversion (`app/main.js:613-656`) is real work; the evidence for it is thin.
8. **"What about Muse Image / SAM 3.1?"** Implemented (`server/meta_client.py:417-457`, `:555-605`) and exposed (`server/app.py:595-628`), with live entries in the old evidence file — but the judged product never calls them, and the submission table correctly excludes them (`HACKATHON.md:34-42`). Credit claimed: none. Risk: a judge finding four models in `meta_client.py:3-7` and two in the submission may suspect padding; the docs' restraint here is correct and should be kept.

## 5. New-work assessment

- `git log`: 23 commits, first `7c8c54e` 2026-10-29 18:01, last committed `51da45d` 2026-10-31; the product/Meta-brief work lands 2026-10-31 (`caa83da`, `32d9bfc`, `f0b215b`, `a25c499`). All inside Oct 27–Nov 4. `HACKATHON_WORK.md:3-5` states this accurately.
- **Caveat a screener must record:** the first commit imports 93 files / ~55,500 insertions at once, including a complete earlier product, research dossier, reports and a working Meta backend. Git therefore *cannot* prove that none of that substrate predates Oct 27; it can only prove it entered this repo on Oct 29. The judged surface (v0.8 product page, `server/product_ai.py`, brief front door, verifier trace) is layered incrementally on top in dated commits, so the "new work" claim for the *judged* surface is well supported. For the substrate, the honest disclosure already exists in embryo (`HACKATHON.md:73-75`, `HACKATHON_WORK.md:20-24`); strengthen it with one sentence stating what, if anything, existed before Oct 27 (Fix 6).
- Uncommitted Nov 2 changes (docs, `app/product.js`, `app/main.js`, demo video/screenshots, plus untracked `demo/screenshots/v10/first-open-blank.png`) are in-period but invisible to a clone until committed.

## 6. Score justification — Use of Meta AI Tooling: 6/10

**What earns points above a basic integration (→ 4–5 range and beyond):**

- Three distinct Spark roles composed in one workflow — extract-only brief parsing, parameter-only move proposals, grounded batch advice — plus a second modality (Voice Transcribe) feeding the first (`HACKATHON.md:36-41`; `server/product_ai.py:58-89`, `:432-465`, `:860-890`).
- The propose-but-never-decide architecture: allow-list rebuilding, clamping, stated-number dropping, advice grounding, test-instruction and certification rejection (`server/product_ai.py:293-346`, `:709-751`, `:1025-1144`). This is a considered answer to "why trust the model near physical numbers," and the verifier trace makes it visible (`app/main.js:262-296`).
- Production-shaped client behaviour: Contributor→Standard fallback, transient retry, per-call `_meta` provenance (model/latency/tokens/cached/fallback), key redaction (`server/meta_client.py:105-114`, `:320-393`).

**What caps it at 6:**

- **Spark is not load-bearing for the headline result.** Its proposal numbers are reduced to directions (`app/product.js:597-663`) and the winner can be produced by local minimum/blend search with no model at all (`app/product.js:758-763`). Replace Spark proposals with a four-line heuristic emitting the same fixed menu (`server/product_ai.py:45-46`) and most demos would be indistinguishable.
- **No iterative or reasoning-forward use of Spark.** Single-shot calls; verifier rejections never return to the model (§4.4); `reasoning_effort=low` with no exposed rationale, trade-off analysis across simultaneous targets is asserted in prompts (`server/product_ai.py:74-76`) but the multi-target reasoning is neither shown nor logged.
- **Live-ness is not demonstrable from the submitted artefacts** (§2.3) and the UI conceals cached vs. live (§3). Tooling sophistication that a judge cannot witness scores less than the same sophistication made legible.
- Voice is transcription-only with thin committed evidence (§4.7); Image/SAM exist but are correctly unclaimed and add nothing to the judged score.

This is a credible, safety-conscious integration with one genuinely distinctive idea (model proposes parameters, deterministic verifier owns every physical number). To move toward 8+, the model must become *necessary* and *observably live*: a verifier-feedback re-proposal loop, and committed live evidence for the judged endpoints.

## 7. Top fixes, ranked

1. **[P0 — evidence] Refresh live verification for the judged surface.** Extend `server/verify_live.py` (currently retired endpoints only, `:180-206`) to call `/api/product/brief`, `/api/product/proposals`, `/api/product/advice` and the voice→brief chain with a *novel, non-sample* brief; commit the regenerated `server/evidence/live_calls.json` (hashes/tokens/latency, no key — the writer already asserts key absence at `:252`). Without this, the central claim is unverifiable from the repo.
2. **[P0 — demo integrity] Surface `_meta` in the UI.** Badge each Meta result as Live (model name) / Cached / Unavailable, driven by `_meta.cached`/`_meta.model`/`_meta.fallback` that the server already returns (`server/meta_client.py:213-221`); change the brief status text at `app/main.js:816` so a cached parse does not announce a fresh Spark read. Then deliberately demo one uncached input live.
3. **[P1 — make Meta load-bearing] Close the verifier loop.** Feed rejected exact proposals (move, size, failing ranges from `traceModelProposals`, `app/product.js:693-713`) back to Spark for one re-proposal round, log both rounds in provenance, and label locally-searched candidates as local in the build list so the model's contribution is distinguishable from `minimumThicknessCandidate`/`blendCandidate` (`app/product.js:758-763`). This converts "Spark just suggests directions" into an observable agent–verifier iteration.
4. **[P1 — submission completeness] Finish the pack.** Commit the Nov 2 working tree, set the public repo and live URLs, replace the synthetic narration (`SUBMISSION.md:16-19`, `:44-53`; `DEMO_SCRIPT.md:3`), and record the final video from a clean state per `DEMO_SCRIPT.md:8-14` — including the offline/cache-cleared degraded mode (§4.3) before a judge discovers it.
5. **[P2 — surface hygiene] Quarantine the retired endpoints.** Remove or explicitly label the v0.2–v0.4 endpoints (`server/app.py:441-557`) in the judged deployment and reconcile `/api/health`'s endpoint list (`server/schemas.py:392-395` vs. `server/app.py:407-412`), so "the product never invents fallbacks" is true of everything a judge can reach.
6. **[P2 — new-work disclosure] One paragraph on the Oct 29 substrate.** State plainly what existed before Oct 27 (if anything) behind the 93-file first commit, keeping the judged-surface commit map in `HACKATHON_WORK.md:26-34`. Screeners reward the disclosure; they penalise discovering the import themselves.
7. **[P3 — deepen the Spark role] Use the reasoning you are paying for.** For simultaneous targets, have Spark return a short grounded trade-off rationale (numbers re-checked by the existing grounding gate, `server/product_ai.py:832-838`) explaining *why this move direction for these conflicting targets*, and display it beside the trace. That gives judges a capability a template cannot trivially reproduce.

---

*Files changed by this review: this report only. No application or server code was edited, and no live API call was made.*

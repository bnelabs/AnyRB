# Submission pack — AnyRB

## Track

- **Indie Developer**
- **Build for Your World**

## One line

AnyRB turns a measured recycled-plastic delivery into a makeable part: Meta reads the shop's ask and
proposes engineering and material moves; a deterministic verifier proves which build stays inside
every target.

## Links

- Repo: public URL to be set at submission
- Live demo: public URL to be set after deployment (see deployment below)
- 3-minute video: link to be set after recording; script in [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md)
- Local run: `.venv/bin/python -m server.app` → http://127.0.0.1:8787

## What judges should look at

1. First open: no default product. Start from the **planter** example or type a part.
2. Add a second requirement (weight + strength) and show the build must satisfy both.
3. Show the Batch gap and the Ask Meta answer for a failing delivery.
4. Show the proposal→verifier trace: Meta proposes; verifier rejects or accepts; mechanics finds the
   passing size.
5. `app/product.js` for the deterministic scoring and `server/product_ai.py` for the Meta boundary.

## Deployment

The server serves the built root page and the API from one process. Use the included `Dockerfile`
and `render.yaml`/`fly.toml`, set `META_API_KEY` as a secret, set a spend limit, and expose port 8787.
Do not commit `server/.env`.

## What is real vs example

- The planter case and batch ranges are a labeled demo case; replace with a shop's measured ranges for
  production use.
- The mechanics is a rectangular-section model, not a general 3-D solver.
- The model never authors a strength/stiffness/weight result; the verifier does.

## Checklist before submit

- [ ] Public repo at submission time
- [ ] MIT license present
- [ ] Live URL responds and the `/api/health` shows live mode
- [ ] Three-minute video recorded from a clean state
- [ ] `README.md`, `HACKATHON.md`, `HACKATHON_WORK.md` current
- [ ] No `.env`, no key, no cache in the repo
- [ ] app tests, server tests and browser smoke pass
- [ ] Submission page lists the public repo, video, live URL

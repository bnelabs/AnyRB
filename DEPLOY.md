# Public demo deployment

The app is one FastAPI process: it serves the built root `index.html` and the Meta product endpoints.
The key never goes to the browser.

## Render

1. Push the public repo.
2. Create a new Render Web Service from the repo; use the included `render.yaml`.
3. Set `META_API_KEY` as a secret environment variable. Do not commit `server/.env`.
4. Set a spend limit in the Meta billing console.
5. After deploy, verify:
   - `GET /api/health` returns `ok: true` and `ai.live: true`
   - first open shows "What do you want to make?"
   - sample brief -> Meta read -> planter case -> Ask about this delivery
6. Put the URL in `SUBMISSION.md` and the submission page.

## Docker

```bash
docker build -t anyrb .
docker run --rm -p 8787:8787 -e META_API_KEY=... anyrb
```

## Notes

- The server reads `META_API_KEY` from the environment; `ANYRB_MOCK=1` gives a no-model demo.
- `server/cache/` can be a mounted disk for repeat judge visits; it is gitignored.
- Rate limiting is in-process; for a public demo set a Meta spend limit and keep the key server-side.

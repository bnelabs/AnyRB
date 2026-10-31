# Clean public-submission repository

The working repo contains the hackathon product plus earlier bracket-engine history. For judging, use
a clean tree so judges see only the active product:

```bash
scripts/package_submission.sh ../anyrb-hackathon
cd ../anyrb-hackathon
git init
git add .
git commit -m "AnyRB — Meta Global AI Developer Hackathon"
git branch -M main
git remote add origin <public repo URL>
git push -u origin main
```

Then set the public repo URL, live demo URL and video URL in [`SUBMISSION.md`](SUBMISSION.md).

The clean tree keeps:

- `app/` — active page, mechanics, tests
- `server/` — FastAPI backend and the three active product endpoints plus the existing V0.4 routes
  required by the server app
- `data/CASE_STUDY.md`
- `demo/screenshots/v9/`
- `HACKATHON.md`, `SUBMISSION.md`, `DEMO_SCRIPT.md`, `V0_8_SPEC.md`, `LICENSE`
- `Dockerfile`, `render.yaml`, `requirements.txt`, `DEPLOY.md`

It removes the old engine/validation/reports/research/audit history, old screenshots, `.env`, caches
and old server tests. The old validation is not evidence for this app.

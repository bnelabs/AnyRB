# AnyRB app

One page. Sources are plain ES modules; `build.py` inlines them into the standalone page.

- `index.html` — natural-language brief, product question, optional case examples, Engineering, Batch, Ask Meta.
- `styles.css` — white page, one system sans, quiet rules, one black pill.
- `product.js` — pure mechanics, multi-requirement pass/gap, blend rule, model-move search,
  selection and case presets. No DOM, no network, no storage. The default state has no product and no
  decision; every part and every requirement comes from the user.
- `main.js` — DOM wiring, brief parsing, exact-proposal trace, local scoring, `/api/product/brief`,
  `/api/product/proposals` and `/api/product/advice` calls. The browser never sees an API key.
- `build.py` — writes `../index.html` and `standalone.html`.
- `tests/model.test.mjs` — `node --test` coverage of the mechanics and app boundary.

## Run

```bash
# from repo root
python3 app/build.py
.venv/bin/python -m server.app          # http://127.0.0.1:8787
open http://127.0.0.1:8787/
```

A `file://` open uses `http://127.0.0.1:8787` for Meta. The local mechanics works without the server;
the AI sections show an honest unavailable state and no invented fallback. For a public demo see
[`../DEPLOY.md`](../DEPLOY.md) and [`../SUBMISSION.md`](../SUBMISSION.md).

## Test

```bash
node app/tests/model.test.mjs
AI_MOCK=1 python3 -m pytest server/tests -q
```

# AnyRB — current product only
PY := .venv/bin/python

.PHONY: build app-test test-server serve verify

build:
	python3 app/build.py

app-test:
	node app/tests/model.test.mjs

test-server:
	AI_MOCK=1 $(PY) -m pytest server/tests -q

serve:
	$(PY) -m server.app

verify: build app-test test-server
	@echo "--- verify passed ---"

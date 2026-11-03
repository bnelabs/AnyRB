# AnyRB — current product only
PY := .venv/bin/python

.PHONY: setup build app-test test-server serve verify

setup:
	python3 -m venv .venv
	.venv/bin/pip install -r requirements.txt

build:
	python3 app/build.py

app-test:
	node app/tests/model.test.mjs
	node app/tests/page-wiring.test.mjs
	node app/tests/combinations.test.mjs

test-server:
	AI_MOCK=1 $(PY) -m pytest server/tests -q

serve:
	$(PY) -m server.app

verify: build app-test test-server
	@echo "--- verify passed ---"

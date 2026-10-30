# AnyRB — one-command development targets
PY := .venv/bin/python
PYTHONPATH := engine
export PYTHONPATH

.PHONY: test report fixtures compare app-test app-build pdf serve test-server verify-live validate verify all smoke

all: test report

test:
	$(PY) -m unittest discover -s engine/tests -v

report:
	$(PY) -m anyrb.cli demo --out reports

fixtures:
	$(PY) -m anyrb.cli fixtures

compare:
	$(PY) -m anyrb.cli compare

sweep:
	$(PY) -m anyrb.cli sweep

app-test:
	node app/tests/model.test.mjs

app-build:
	$(PY) app/build.py

pdf:
	$(PY) demo/build_pdf.py

serve:
	$(PY) -m server.app

test-server:
	AI_MOCK=1 $(PY) -m pytest server/tests -q

verify-live:
	$(PY) server/verify_live.py

validate:
	$(PY) validation/run_validation.py

verify: test
	node app/tests/model.test.mjs
	AI_MOCK=1 $(PY) -m pytest server/tests -q
	$(PY) validation/run_validation.py
	$(PY) -c "import json,os; s=json.load(open('reports/summary.json')); assert os.path.getsize('reports/qualification_report.html')>100000; assert os.path.getsize('reports/robust_design.stl')>10000; print('deliverables OK:', s['robust']['mass_g'], 'g, P_f', s['robust']['pf'])"
	@echo "--- verify passed ---" 

smoke: test report fixtures
	@echo "--- smoke complete ---"

"""Cross-implementation verification: JavaScript demo engine vs Python fixtures.

Skips automatically when Node.js or the demo app is not present.  This is the
Lead's independent check of the demo engineer's engine (separate from the
app's own test suite).
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.abspath(os.path.join(HERE, "..", ".."))
APP_ENGINE = os.path.join(PROJECT, "history", "v0.6-app", "engine.js")
FIXTURES = os.path.join(PROJECT, "history", "v0.6-app", "tests", "fixtures", "reference.json")
NODE = shutil.which("node")

KEY_MAP = {"rpetg": "rPETG", "rpet": "rPET", "rhdpe": "rHDPE", "rpp": "rPP"}

SCRIPT = """
import { analyzeLattice, analyzeSolid, probabilityOfFailure, MATERIAL_PRESETS } from 'file://__ENGINE__';
import { readFileSync } from 'node:fs';
const fx = JSON.parse(readFileSync('__FIXTURES__', 'utf8'));
const keyMap = __KEYMAP__;
const out = { cases: [], solid: null };
for (const c of fx.cases) {
  const logWidth = c.controls.map((v) => v);
  const mat = MATERIAL_PRESETS[keyMap[c.material]];
  const a = analyzeLattice(logWidth, { rho: mat.rho });
  out.cases.push({
    name: c.name,
    mass_g: a.mass_g,
    sigma_req_MPa: a.demands.sigma_y_req,
    E_req_MPa: a.demands.E_req,
    E_req_def_MPa: a.demands.E_req_def,
    E_req_buck_MPa: a.demands.E_req_buck,
    u_tip_unit_mm: a.uTipUnit,
    pf: probabilityOfFailure(a, mat),
  });
}
const s = analyzeSolid({});
out.solid = { mass_g: s.mass_g, sigma_req_MPa: s.demands.sigma_y_req,
              E_req_MPa: s.demands.E_req, pf: probabilityOfFailure(s, MATERIAL_PRESETS['rPETG']) };
console.log(JSON.stringify(out));
"""


@unittest.skipUnless(NODE and os.path.exists(APP_ENGINE) and os.path.exists(FIXTURES),
                     "node / demo engine / fixtures not available")
class TestJavaScriptEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with tempfile.TemporaryDirectory() as td:
            script_path = os.path.join(td, "check.mjs")
            script = (SCRIPT
                      .replace("__ENGINE__", APP_ENGINE)
                      .replace("__FIXTURES__", FIXTURES)
                      .replace("__KEYMAP__", json.dumps(KEY_MAP)))
            with open(script_path, "w") as f:
                f.write(script)
            res = subprocess.run([NODE, script_path], capture_output=True,
                                 text=True, timeout=120)
            if res.returncode != 0:
                raise RuntimeError("node cross-check failed:\n" + res.stderr[-3000:])
            cls.js = json.loads(res.stdout.strip().splitlines()[-1])
        with open(FIXTURES) as f:
            cls.fx = json.load(f)

    def test_cases_match(self):
        by_name = {c["name"]: c for c in self.js["cases"]}
        for case in self.fx["cases"]:
            js = by_name[case["name"]]
            for key in ("mass_g", "sigma_req_MPa", "E_req_MPa", "E_req_def_MPa",
                        "E_req_buck_MPa", "u_tip_unit_mm"):
                py = case[key]
                got = js[key]
                if py == 0:
                    self.assertAlmostEqual(got, 0.0, places=9)
                else:
                    rel = abs(got - py) / max(abs(py), 1e-12)
                    self.assertLess(rel, 1e-6,
                                    f"{case['name']}.{key}: js={got} py={py} rel={rel:g}")
            self.assertAlmostEqual(js["pf"], case["pf"], places=8)

    def test_solid_matches(self):
        s = self.js["solid"]
        self.assertAlmostEqual(s["mass_g"], 111.6, places=6)
        self.assertAlmostEqual(s["sigma_req_MPa"], 3.5, places=6)
        self.assertAlmostEqual(s["E_req_MPa"], 304.8888888889, places=6)
        self.assertAlmostEqual(s["pf"], 0.0, places=6)


if __name__ == "__main__":
    unittest.main()

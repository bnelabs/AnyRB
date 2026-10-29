import fs from 'node:fs';
import * as E from '../../app/engine.js';
const fxPath = new URL('../../app/tests/fixtures/reference.json', import.meta.url);
const fx = JSON.parse(fs.readFileSync(fxPath, 'utf8'));
const out = { cases: [] };
for (const c of fx.cases) {
  const mat = fx.materials[c.material];
  const a = E.analyzeLattice(c.controls, { rho: mat.rho });
  const pf = E.probabilityOfFailure(a, mat, 'lot');
  out.cases.push({ name: c.name, mass_g: a.mass_g,
    sigma_req_MPa: a.demands.sigma_y_req, E_req_MPa: a.demands.E_req,
    u_tip_unit_mm: a.uTipUnit, pf });
}
console.log(JSON.stringify(out));

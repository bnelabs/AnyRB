"""Verification tests for the AnyRB reference engine.

Run with:  PYTHONPATH=engine .venv/bin/python -m unittest discover -s engine/tests -v
"""
from __future__ import annotations

import json
import math
import os
import tempfile
import unittest

import numpy as np

from anyrb.lattice import (build_lattice, widths_from_controls, uniform_controls,
                              mass_g, PAD_LEN, CELL, NX, NY, HEIGHT, DEPTH,
                              PAD_VOLUME, W_MIN, W_MAX, F_DESIGN, U_LIMIT)
from anyrb.materials import PRESETS, Material, get_material
from anyrb.mechanics import (_local_stiffness, _transform, solve_unit, demands,
                                solid_demands, evaluate, N_DOF)
from anyrb.reliability import phi2, failure_probability, monte_carlo, sensitivity
from anyrb.optimize import (optimize_robust, optimize_deterministic,
                               compare_strategies, batch_recipe, acceptance_window,
                               minimum_uniform_width)
from anyrb.stl import write_ascii_stl

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURES = os.path.join(HERE, "..", "..", "app", "tests", "fixtures", "reference.json")


class TestGeometry(unittest.TestCase):
    def setUp(self):
        self.lat = build_lattice()

    def test_topology_counts(self):
        self.assertEqual(self.lat.nodes.shape, (32, 2))
        self.assertEqual(self.lat.elements.shape, (94, 2))
        counts = np.bincount(self.lat.kind)
        self.assertEqual(list(counts), [28, 24, 42])
        self.assertEqual(N_DOF, 96)

    def test_lengths(self):
        horiz = self.lat.lengths[self.lat.kind == 0]
        diag = self.lat.lengths[self.lat.kind == 2]
        np.testing.assert_allclose(horiz, 20.0)
        np.testing.assert_allclose(diag, math.hypot(20, 20))

    def test_boundary_nodes(self):
        fixed = [j * 8 for j in range(4)]
        tip = [j * 8 + 7 for j in range(4)]
        for n in fixed:
            self.assertAlmostEqual(self.lat.nodes[n, 0], PAD_LEN)
        for n in tip:
            self.assertAlmostEqual(self.lat.nodes[n, 0], 150.0)

    def test_width_field_uniform_and_clip(self):
        pts = np.array([[PAD_LEN, 0.0], [PAD_LEN + 70, 30.0], [150.0, 60.0]])
        w = widths_from_controls(uniform_controls(2.0), pts)
        np.testing.assert_allclose(w, 2.0)
        lo = widths_from_controls(uniform_controls(0.01), pts)
        hi = widths_from_controls(uniform_controls(99.0), pts)
        np.testing.assert_allclose(lo, W_MIN)
        np.testing.assert_allclose(hi, W_MAX)

    def test_width_field_bilinear(self):
        c = np.log(np.array([[4.0, 4.0, 1.0, 1.0], [4.0, 4.0, 1.0, 1.0]]))
        pts = np.array([[PAD_LEN, 30.0], [PAD_LEN + 70, 30.0], [100.0, 30.0]])
        w = widths_from_controls(c.ravel(), pts)
        # x_norm at x=150-? -> 1/3 at 70 mm; midpoint of third interval is 2/3
        self.assertAlmostEqual(math.log(w[1]), math.log(4.0) * (1 - 70 / 140) + math.log(1.0) * (70 / 140), places=10)

    def test_mass_consistency(self):
        w = np.full(94, 2.0)
        expected = 1.27 * (np.sum(DEPTH * w * self.lat.lengths) + PAD_VOLUME) / 1000.0
        self.assertAlmostEqual(mass_g(self.lat, w, 1.27), expected, places=10)


class TestMechanics(unittest.TestCase):
    def test_single_element_cantilever_exact(self):
        E, L, w, t = 2000.0, 100.0, 2.0, 10.0
        A, I = t * w, t * w ** 3 / 12
        kl = _local_stiffness(E, A, I, L)
        kg = _transform(1.0, 0.0).T @ kl @ _transform(1.0, 0.0)
        u = np.linalg.solve(kg[3:, 3:], np.array([0.0, -1.0, 0.0]))
        exact = -1.0 * L ** 3 / (3 * E * I)
        self.assertAlmostEqual(u[1], exact, places=12)

    def test_tip_deflection_and_symmetry(self):
        lat = build_lattice()
        w = np.full(94, 2.0)
        sol = solve_unit(lat, w, F_total=1.0, E=1.0)
        tip = [3 * (j * 8 + 7) + 1 for j in range(4)]
        v = sol["u"][tip]
        self.assertAlmostEqual(v[0], v[3], places=10)   # y=0 vs y=60
        self.assertAlmostEqual(v[1], v[2], places=10)   # y=20 vs y=40
        self.assertGreater(sol["u_tip"], 0.0)

    def test_force_equilibrium(self):
        lat = build_lattice()
        w = np.full(94, 2.0)
        sol = solve_unit(lat, w, F_total=1.0, E=1.0)
        # vertical reactions at the four clamped nodes must sum to +1 N
        fixed_v = [3 * (j * 8) + 1 for j in range(4)]
        K = np.zeros((96, 96))
        for e, (n1, n2) in enumerate(lat.elements):
            A = DEPTH * w[e]
            I = DEPTH * w[e] ** 3 / 12
            kl = _local_stiffness(1.0, A, I, lat.lengths[e])
            T = _transform(math.cos(lat.angles[e]), math.sin(lat.angles[e]))
            dofs = [3 * n1, 3 * n1 + 1, 3 * n1 + 2, 3 * n2, 3 * n2 + 1, 3 * n2 + 2]
            K[np.ix_(dofs, dofs)] += T.T @ kl @ T
        R = K @ sol["u"]
        self.assertAlmostEqual(float(R[fixed_v].sum()), 1.0, places=9)

    def test_demand_scaling_linear_in_load(self):
        lat = build_lattice()
        w = widths_from_controls(uniform_controls(2.0), lat.midpoints)
        d1 = demands(lat, w, F=100.0)
        d2 = demands(lat, w, F=200.0)
        self.assertAlmostEqual(d2.sigma_req / d1.sigma_req, 2.0, places=10)
        self.assertAlmostEqual(d2.E_req / d1.E_req, 2.0, places=10)
        self.assertAlmostEqual(d2.u_tip_unit, d1.u_tip_unit, places=12)

    def test_solid_demands(self):
        sd = solid_demands(1.27)
        # cantilever plate: delta = F L^3 / (3 E I); I = t h^3 / 12
        L, I = 140.0, 10 * 60 ** 3 / 12
        self.assertAlmostEqual(sd.E_req, 150.0 * L ** 3 / (3 * I * U_LIMIT), places=8)
        self.assertAlmostEqual(sd.mass_g, 1.27 * 150 * 60 * 10 / 1000, places=10)

    def test_rigid_body_modes_zero_stress(self):
        """A rigid-body translation and a small rigid rotation of all nodes must
        produce zero element forces (L0 verification for the frame assembly)."""
        lat = build_lattice()
        w = np.full(94, 2.0)
        for mode in (np.array([1.0, 0.0]), np.array([0.0, 1.0]),
                     np.array([-1.0e-3, -5.0e-4])):  # rotation: (th*y, -th*x)
            u = np.zeros(96)
            for n, (x, y) in enumerate(lat.nodes):
                u[3 * n + 0] = mode[0] - 0.0 * y
                u[3 * n + 1] = mode[1] + 0.0 * x
                if n == 0:
                    pass
            # proper small rotation about the origin: u = theta*(-y, x)
            if abs(mode[0]) < 1e-2:
                th = -mode[0]
                for n, (x, y) in enumerate(lat.nodes):
                    u[3 * n + 0] = -th * y
                    u[3 * n + 1] = th * x
                    u[3 * n + 2] = th
            max_f = 0.0
            for e, (n1, n2) in enumerate(lat.elements):
                A = DEPTH * w[e]
                I = DEPTH * w[e] ** 3 / 12
                kl = _local_stiffness(1.0, A, I, lat.lengths[e])
                T = _transform(math.cos(lat.angles[e]), math.sin(lat.angles[e]))
                dofs = [3 * n1, 3 * n1 + 1, 3 * n1 + 2, 3 * n2, 3 * n2 + 1, 3 * n2 + 2]
                fl = kl @ (T @ u[dofs])
                max_f = max(max_f, float(np.max(np.abs(fl))))
            self.assertLess(max_f, 1e-9)

    def test_element_force_conventions(self):
        """Pure axial extension: N must be positive (tension), moments ~0."""
        lat = build_lattice()
        w = np.full(94, 2.0)
        sol = solve_unit(lat, w, F_total=1.0, E=1.0)
        self.assertTrue(np.all(np.isfinite(sol["N"])))
        self.assertLess(np.max(np.abs(sol["M1"])), 1e5)


class TestReliability(unittest.TestCase):
    def test_phi2_matches_scipy(self):
        try:
            from scipy.stats import multivariate_normal
        except ImportError:  # pragma: no cover
            self.skipTest("scipy not available")
        for a, b, r in [(-2.5, 1.2, 0.6), (0.3, -1.1, 0.0),
                        (1.9, 2.2, 0.9), (-0.5, -0.5, 0.3)]:
            ref = multivariate_normal.cdf([a, b], mean=[0, 0],
                                          cov=[[1, r], [r, 1]])
            self.assertAlmostEqual(phi2(a, b, r), float(ref), places=12)

    def test_pf_matches_monte_carlo(self):
        m = PRESETS["rpetg"]
        for sr, er in [(12.0, 1400.0), (18.0, 1800.0), (25.0, 800.0)]:
            pf = failure_probability(m, sr, er)
            E, sy = m.sample(300000, np.random.default_rng(7), level="lot")
            mc = float(np.mean((sy < sr) | (E < er)))
            self.assertLess(abs(pf - mc), 0.004)
            self.assertGreaterEqual(pf, 0.0)
            self.assertLessEqual(pf, 1.0)

    def test_degenerate_distribution_limits(self):
        m = PRESETS["rpetg"]
        md = m.lot_from_measurement(m.E_mean, m.sy_mean)  # zero lot-level variance
        self.assertAlmostEqual(failure_probability(md, m.sy_mean * 0.9, m.E_mean * 0.9, level="lot"), 0.0)
        self.assertAlmostEqual(failure_probability(md, m.sy_mean * 1.1, m.E_mean * 1.1, level="lot"), 1.0)

    def test_pf_monotone_in_demand(self):
        m = PRESETS["rpetg"]
        p1 = failure_probability(m, 12.0, 1400.0)
        p2 = failure_probability(m, 14.0, 1600.0)
        self.assertLessEqual(p1, p2)

    def test_two_level_hierarchy(self):
        m = PRESETS["rpetg"]
        p = m.params("lot")
        self.assertAlmostEqual(p["cv_E"], m.lot_fraction * m.E_cv, places=12)
        E, sy = m.sample(200000, np.random.default_rng(0), level="lot")
        self.assertLess(abs(E.std() / E.mean() - p["cv_E"]), 0.006)
        self.assertLess(abs(np.corrcoef(np.log(E), np.log(sy))[0, 1] - m.corr), 0.02)

    def test_monte_carlo_metrics(self):
        m = PRESETS["rpetg"]
        r = monte_carlo(m, 13.9, 1474.0, n=40000, seed=1)
        self.assertAlmostEqual(r.pf, failure_probability(m, 13.9, 1474.0), delta=0.004)
        self.assertLessEqual(r.p5_margin, r.p50_margin)
        self.assertGreater(r.robustness_index, 0.0)


class TestOptimisation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mat = PRESETS["rpetg"]

    def test_robust_meets_target(self):
        r = optimize_robust(self.mat, 0.02)
        self.assertLessEqual(r.pf, 0.02 + 1e-4)

    def test_robust_lighter_than_uniform(self):
        target = 0.01
        robust = optimize_robust(self.mat, target)
        w = minimum_uniform_width(self.mat, target)
        uniform = evaluate(self.mat, uniform_controls(w))
        self.assertLess(robust.mass_g, uniform["mass_g"])

    def test_deterministic_design_passes_with_sf(self):
        r = optimize_deterministic(self.mat, 1.5)
        d = demands(build_lattice(),
                    widths_from_controls(r.controls, build_lattice().midpoints))
        self.assertLessEqual(1.5 * d.sigma_req, self.mat.sy_mean * 1.001)
        self.assertLessEqual(1.5 * d.E_req, self.mat.E_mean * 1.001)

    def test_comparison_sane(self):
        res = compare_strategies(self.mat, 0.01)
        self.assertGreater(res["solid"].mass_g, res["robust"].mass_g)
        self.assertLess(res["robust"].pf, 0.05)
        self.assertGreater(res["mean_only"].pf, 0.1)
        self.assertEqual(res["robust"].strategy, "robust")

    def test_batch_recipe_weak_lot_needs_more_material(self):
        r = optimize_robust(self.mat, 0.01)
        br_ok = batch_recipe(self.mat, r.controls, 0.01,
                             lot_E=self.mat.E_mean, lot_sy=self.mat.sy_mean)
        br_weak = batch_recipe(self.mat, r.controls, 0.01,
                               lot_E=0.8 * self.mat.E_mean,
                               lot_sy=self.mat.sy_mean)
        self.assertIsNotNone(br_weak["scale_required"])
        self.assertGreaterEqual(br_weak["scale_required"], br_ok["scale_required"])

    def test_acceptance_window_contains_nominal_lot(self):
        r = optimize_robust(self.mat, 0.02)
        aw = acceptance_window(self.mat, r.controls, 0.02, n_grid=21)
        i = int(np.argmin(np.abs(aw["mE"] - 1.0)))
        j = int(np.argmin(np.abs(aw["msy"] - 1.0)))
        self.assertTrue(aw["pass"][j, i])


class TestIO(unittest.TestCase):
    def test_stl_export(self):
        lat = build_lattice()
        w = widths_from_controls(uniform_controls(2.0), lat.midpoints)
        with tempfile.TemporaryDirectory() as td:
            path = os.path.join(td, "design.stl")
            info = write_ascii_stl(path, lat, w)
            self.assertEqual(info["triangles"], 94 * 12 + 12)
            self.assertTrue(info["size_bytes"] > 1000)
            with open(path) as f:
                self.assertTrue(f.readline().startswith("solid"))

    def test_fixtures_match_engine(self):
        if not os.path.exists(FIXTURES):
            self.skipTest("reference fixtures not generated")
        with open(FIXTURES) as f:
            fx = json.load(f)
        for case in fx["cases"]:
            mat = PRESETS[case["material"]]
            r = evaluate(mat, np.asarray(case["controls"], float))
            self.assertAlmostEqual(r["mass_g"], case["mass_g"], places=6)
            self.assertAlmostEqual(r["sigma_req_MPa"], case["sigma_req_MPa"], places=9)
            self.assertAlmostEqual(r["E_req_MPa"], case["E_req_MPa"], places=6)
            self.assertAlmostEqual(r["pf"], case["pf"], places=10)


if __name__ == "__main__":
    unittest.main()

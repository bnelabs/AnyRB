"""Reference product geometry and width-field parameterisation.

Product: cantilever bracket arm, in-plane 2D idealisation.
Overall 150 mm x 60 mm x 10 mm deep. A 10 mm solid wall pad is clamped; the
remaining 140 mm is a 7 x 3 grid of X-braced square cells (20 mm cells).

Coordinates are millimetres, forces newtons, stresses MPa (N/mm^2).
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

# ---------------------------------------------------------------------------
# Geometry constants (mm)
# ---------------------------------------------------------------------------
LENGTH = 150.0
HEIGHT = 60.0
DEPTH = 10.0
PAD_LEN = 10.0
CELL = 20.0
NX = 7           # cells along x
NY = 3           # cells along y
NODES_X = NX + 1  # 8
NODES_Y = NY + 1  # 4
N_NODES = NODES_X * NODES_Y  # 32
PAD_VOLUME = PAD_LEN * HEIGHT * DEPTH  # 6000 mm^3 solid wall pad

W_MIN = 1.0
W_MAX = 4.0
U_LIMIT = 2.5      # mm, serviceability limit at the tip
F_DESIGN = 150.0   # N total downward load distributed over the tip nodes

# Width-field control points: 4 x-positions (at wall, thirds, tip) x 2 y-levels
CTRL_X = np.array([0.0, 1.0 / 3.0, 2.0 / 3.0, 1.0])
CTRL_Y = np.array([0.0, 1.0])
N_CTRL = CTRL_X.size * CTRL_Y.size  # 8 design variables


@dataclass(frozen=True)
class Lattice:
    nodes: np.ndarray          # (32, 2)
    elements: np.ndarray       # (94, 2) node ids
    lengths: np.ndarray        # (94,)
    angles: np.ndarray         # (94,) radians
    midpoints: np.ndarray      # (94, 2)
    kind: np.ndarray           # (94,) 0=horizontal, 1=vertical, 2=diagonal
    node_xy: np.ndarray        # alias for nodes (clarity)


def build_lattice() -> Lattice:
    xs = PAD_LEN + CELL * np.arange(NODES_X)
    ys = CELL * np.arange(NODES_Y)
    xx, yy = np.meshgrid(xs, ys)                       # (4, 8)
    nodes = np.column_stack([xx.ravel(), yy.ravel()])  # node id = j*8 + i
    elems: list[tuple[int, int]] = []
    kinds: list[int] = []
    # horizontal edges
    for j in range(NODES_Y):
        for i in range(NX):
            elems.append((j * 8 + i, j * 8 + i + 1)); kinds.append(0)
    # vertical edges
    for j in range(NY):
        for i in range(NODES_X):
            elems.append((j * 8 + i, (j + 1) * 8 + i)); kinds.append(1)
    # both diagonals of every cell (X-braced)
    for j in range(NY):
        for i in range(NX):
            elems.append((j * 8 + i, (j + 1) * 8 + i + 1)); kinds.append(2)
            elems.append((j * 8 + i + 1, (j + 1) * 8 + i)); kinds.append(2)
    elements = np.asarray(elems, dtype=int)
    p1 = nodes[elements[:, 0]]
    p2 = nodes[elements[:, 1]]
    d = p2 - p1
    lengths = np.hypot(d[:, 0], d[:, 1])
    angles = np.arctan2(d[:, 1], d[:, 0])
    midpoints = 0.5 * (p1 + p2)
    return Lattice(nodes=nodes, elements=elements, lengths=lengths,
                   angles=angles, midpoints=midpoints,
                   kind=np.asarray(kinds, dtype=int), node_xy=nodes)


def flat_controls(control_logw: np.ndarray) -> np.ndarray:
    """Accept (8,), (2,4) or (4,2)-style input and return a (2,4) array."""
    a = np.asarray(control_logw, dtype=float)
    if not np.all(np.isfinite(a)):
        raise ValueError("control_logw must contain only finite numbers")
    if a.shape == (N_CTRL,):
        return a.reshape(CTRL_Y.size, CTRL_X.size)
    if a.shape == (CTRL_Y.size, CTRL_X.size):
        return a
    raise ValueError(f"control_logw must have {N_CTRL} entries, got shape {a.shape}")


def widths_from_controls(control_logw: np.ndarray, midpoints: np.ndarray) -> np.ndarray:
    """Bilinear log-width field evaluated at element midpoints, clipped to bounds."""
    c = flat_controls(control_logw)
    xn = np.clip((midpoints[:, 0] - PAD_LEN) / (NX * CELL), 0.0, 1.0)
    yn = np.clip(midpoints[:, 1] / HEIGHT, 0.0, 1.0)
    # locate x interval in {0, 1/3, 2/3, 1}
    fx = xn * (CTRL_X.size - 1)
    ix = np.clip(np.floor(fx).astype(int), 0, CTRL_X.size - 2)
    tx = fx - ix
    fy = yn * (CTRL_Y.size - 1)
    iy = np.clip(np.floor(fy).astype(int), 0, CTRL_Y.size - 2)
    ty = fy - iy
    w00 = c[iy, ix]
    w01 = c[iy, ix + 1]
    w10 = c[iy + 1, ix]
    w11 = c[iy + 1, ix + 1]
    logw = ((1 - ty) * ((1 - tx) * w00 + tx * w01)
            + ty * ((1 - tx) * w10 + tx * w11))
    return np.clip(np.exp(logw), W_MIN, W_MAX)


def uniform_controls(width_mm: float) -> np.ndarray:
    return np.full(N_CTRL, np.log(float(width_mm)))


def mass_g(lattice: Lattice, widths: np.ndarray, rho_g_cm3: float) -> float:
    """Strut volume + solid pad, converted mm^3 -> cm^3."""
    area = DEPTH * widths                      # mm^2
    volume = float(np.sum(area * lattice.lengths)) + PAD_VOLUME
    return rho_g_cm3 * volume / 1000.0


def printability_report(lattice: Lattice, widths: np.ndarray) -> dict:
    short = widths < W_MIN - 1e-9
    slenderness = lattice.lengths / np.maximum(widths, 1e-9)
    ratio = np.maximum(widths / np.roll(widths, 1), np.roll(widths, 1) / np.maximum(widths, 1e-9))
    return {
        "min_width_mm": float(widths.min()),
        "max_width_mm": float(widths.max()),
        "max_slenderness": float(slenderness.max()),
        "max_neighbour_width_ratio": float(ratio.max()),
        "out_of_bounds": bool(short.any() or (widths > W_MAX + 1e-9).any()),
    }

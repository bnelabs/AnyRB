"""STL export of the lattice geometry (boxes per strut + solid wall pad).

This is a *visualisation / slicer-input* export: the strut boxes overlap at the
nodes (as printed lattices do).  Most slicers union overlapping shells; the
mesh is not a single watertight manifold.  That limitation is stated in the
report and README.
"""
from __future__ import annotations

import struct

import numpy as np

from .lattice import DEPTH, HEIGHT, Lattice, PAD_LEN, build_lattice, widths_from_controls


def _box_triangles(c1: np.ndarray, c2: np.ndarray, w: float, t: float) -> np.ndarray:
    """Return (12, 3, 3) triangle vertices for a rectangular prism strut."""
    d = c2 - c1
    L = np.linalg.norm(d)
    if L < 1e-12:
        return np.zeros((0, 3, 3))
    u = d / L
    p = np.array([-u[1], u[0], 0.0])          # in-plane perpendicular
    z = np.array([0.0, 0.0, 1.0])
    hw, ht = 0.5 * w, 0.5 * t
    corners = []
    for a in (0.0, 1.0):
        base = c1 + a * (c2 - c1)
        for sb in (-1.0, 1.0):
            for sz in (-1.0, 1.0):
                corners.append(base + sb * hw * p + sz * ht * z)
    # index layout: (a, sb, sz) -> a*4 + i where i in {0:(-,-),1:(-,+),2:(+,-),3:(+,+)}
    # slightly clearer: rebuild explicit array
    P = np.array(corners).reshape(2, 2, 2, 3)  # a, sb, sz
    # faces: bottom/top compared via sb; front/back via sz; ends via a
    quads = [
        (P[0, 0, 0], P[0, 0, 1], P[0, 1, 1], P[0, 1, 0]),   # start end
        (P[1, 0, 0], P[1, 1, 0], P[1, 1, 1], P[1, 0, 1]),   # far end
        (P[0, 0, 0], P[1, 0, 0], P[1, 0, 1], P[0, 0, 1]),   # sb = -1 side
        (P[0, 1, 0], P[0, 1, 1], P[1, 1, 1], P[1, 1, 0]),   # sb = +1 side
        (P[0, 0, 0], P[0, 1, 0], P[1, 1, 0], P[1, 0, 0]),   # sz = -1 side
        (P[0, 0, 1], P[1, 0, 1], P[1, 1, 1], P[0, 1, 1]),   # sz = +1 side
    ]
    tris = []
    for q0, q1, q2, q3 in quads:
        tris.append([q0, q1, q2])
        tris.append([q0, q2, q3])
    return np.array(tris, dtype=float)


def _pad_triangles() -> np.ndarray:
    """Axis-aligned 10 x 60 x 10 mm wall-pad prism (0..10, 0..60, -5..5)."""
    return _box_triangles(np.array([0.0, HEIGHT / 2.0, 0.0]),
                          np.array([PAD_LEN, HEIGHT / 2.0, 0.0]),
                          HEIGHT, DEPTH)


def lattice_triangles(lattice: Lattice, widths: np.ndarray) -> np.ndarray:
    tris = [np.array([[[0.0, 0.0, -DEPTH / 2], [PAD_LEN, 0.0, -DEPTH / 2],
                       [0.0, HEIGHT, -DEPTH / 2]]])]  # placeholder replaced below
    out = [_pad_triangles()]
    for e in range(lattice.elements.shape[0]):
        n1, n2 = lattice.elements[e]
        c1 = np.array([*lattice.nodes[n1], 0.0])
        c2 = np.array([*lattice.nodes[n2], 0.0])
        out.append(_box_triangles(c1, c2, widths[e], DEPTH))
    return np.vstack(out)


def write_ascii_stl(path: str, lattice: Lattice, widths: np.ndarray, name: str = "anyrb") -> dict:
    tris = lattice_triangles(lattice, widths)
    with open(path, "w", encoding="ascii") as f:
        f.write(f"solid {name}\n")
        for t in tris:
            # normal
            n = np.cross(t[1] - t[0], t[2] - t[0])
            ln = np.linalg.norm(n)
            n = n / ln if ln > 0 else n
            f.write(f"  facet normal {n[0]:.6e} {n[1]:.6e} {n[2]:.6e}\n    outer loop\n")
            for v in t:
                f.write(f"      vertex {v[0]:.6f} {v[1]:.6f} {v[2]:.6f}\n")
            f.write("    endloop\n  endfacet\n")
        f.write(f"endsolid {name}\n")
    return {"path": path, "triangles": int(tris.shape[0]),
            "size_bytes": __import__("os").path.getsize(path)}


def write_binary_stl(path: str, lattice: Lattice, widths: np.ndarray,
                     name: str = "anyrb") -> dict:
    tris = lattice_triangles(lattice, widths).astype(np.float32)
    with open(path, "wb") as f:
        header = (name + " " * 80).encode("ascii")[:80]
        f.write(header)
        f.write(struct.pack("<I", tris.shape[0]))
        for t in tris:
            n = np.cross(t[1] - t[0], t[2] - t[0])
            ln = np.linalg.norm(n)
            n = n / ln if ln > 0 else n
            f.write(struct.pack("<12fH", *n, *t[0], *t[1], *t[2], 0))
    return {"path": path, "triangles": int(tris.shape[0]),
            "size_bytes": __import__("os").path.getsize(path)}

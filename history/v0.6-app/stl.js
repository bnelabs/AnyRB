/**
 * AnyRB — binary STL export for the lattice bracket.
 *
 * Each strut is exported as a rectangular box from node to node (width w,
 * depth t); the solid wall pad is a box too. Boxes overlap at the joints —
 * the note in the UI says a slicer will union them. The geometry is a
 * printability/visualisation artefact, not a manufacturing-ready part.
 *
 * Pure ES module: no DOM. ui.js wraps the ArrayBuffer in a Blob download.
 */

import { GEOMETRY } from './config.js';

const float32 = (v) => Math.fround(v);

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function normalize(v) {
  const len = Math.hypot(v[0], v[1], v[2]);
  return len > 1e-12 ? [v[0] / len, v[1] / len, v[2] / len] : [0, 0, 1];
}
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }

/**
 * Build the list of oriented boxes.
 * box = {center:[3], e1:[3], e2:[3], e3:[3], h:number}
 */
export function latticeBoxes(analysis) {
  const boxes = [];
  if (analysis.kind === 'lattice') {
    for (const el of analysis.elements) {
      boxes.push({
        center: [el.xm, el.ym, GEOMETRY.depth / 2],
        e1: [el.c, el.s, 0], // along the strut
        e2: [-el.s, el.c, 0], // in-plane transverse
        e3: [0, 0, 1], // extrusion direction
        h: el.L / 2,
      });
      // box stores half extents separately below via meta
      boxes[boxes.length - 1].half = [el.L / 2, el.w / 2, GEOMETRY.depth / 2];
      boxes[boxes.length - 1].h = el.L / 2;
    }
  } else {
    // Solid plate: one box covering the full 150 × 60 × 10 envelope.
    boxes.push({
      center: [GEOMETRY.Lx / 2, GEOMETRY.Ly / 2, GEOMETRY.depth / 2],
      e1: [1, 0, 0],
      e2: [0, 1, 0],
      e3: [0, 0, 1],
      half: [GEOMETRY.Lx / 2, GEOMETRY.Ly / 2, GEOMETRY.depth / 2],
    });
  }
  // Solid wall pad 10 × 60 × 10 (already counted in mass; drawn for printability).
  if (analysis.kind === 'lattice') {
    boxes.push({
      center: [GEOMETRY.padWidth / 2, GEOMETRY.Ly / 2, GEOMETRY.depth / 2],
      e1: [1, 0, 0],
      e2: [0, 1, 0],
      e3: [0, 0, 1],
      half: [GEOMETRY.padWidth / 2, GEOMETRY.Ly / 2, GEOMETRY.depth / 2],
    });
  }
  return boxes;
}

/** 12 triangles (outward winding) for one oriented box. */
function boxTriangles(box) {
  const { center, e1, e2, e3, half } = box;
  const [h1, h2, h3] = half;
  const c = [];
  for (let i = 0; i < 8; i++) {
    const sx = i & 1 ? 1 : -1;
    const sy = i & 2 ? 1 : -1;
    const sz = i & 4 ? 1 : -1;
    c.push(add(center, add(scale(e1, sx * h1), add(scale(e2, sy * h2), scale(e3, sz * h3)))));
  }
  // corner index bits: 1 → +e1, 2 → +e2, 4 → +e3
  const quads = [
    [1, 3, 7, 5], // +e1 face
    [0, 4, 6, 2], // −e1
    [2, 6, 7, 3], // +e2
    [0, 1, 5, 4], // −e2
    [4, 5, 7, 6], // +e3
    [0, 2, 3, 1], // −e3
  ];
  const outward = [e1, scale(e1, -1), e2, scale(e2, -1), e3, scale(e3, -1)];
  const tris = [];
  for (let q = 0; q < quads.length; q++) {
    const [a, b, cc, d] = quads[q].map((idx) => c[idx]);
    // choose winding so the geometric normal matches the intended outward normal
    const n = normalize(cross(sub(b, a), sub(cc, a)));
    if (dot(n, outward[q]) < 0) tris.push([a, cc, b], [a, d, cc]);
    else tris.push([a, b, cc], [a, cc, d]);
  }
  return tris;
}

/**
 * Binary STL (little-endian). Returns {buffer, triangleCount, boxCount, byteLength}.
 * Layout: 80-byte header, uint32 triangle count, then 50 bytes per triangle.
 */
export function buildBinarySTL(analysis, { header } = {}) {
  const boxes = latticeBoxes(analysis);
  const triangles = [];
  for (const box of boxes) triangles.push(...boxTriangles(box));
  const n = triangles.length;
  const buffer = new ArrayBuffer(84 + 50 * n);
  const dv = new DataView(buffer);
  const headerText = (header || 'AnyRB v0.1 in-silico lattice bracket; boxes per strut; slicer should union overlaps.')
    .slice(0, 79);
  const bytes = new TextEncoder().encode(headerText);
  new Uint8Array(buffer, 0, Math.min(80, bytes.length)).set(bytes.slice(0, 80));
  dv.setUint32(80, n, true);
  let off = 84;
  for (const [a, b, c] of triangles) {
    const normal = normalize(cross(sub(b, a), sub(c, a)));
    dv.setFloat32(off, float32(normal[0]), true);
    dv.setFloat32(off + 4, float32(normal[1]), true);
    dv.setFloat32(off + 8, float32(normal[2]), true);
    off += 12;
    for (const v of [a, b, c]) {
      dv.setFloat32(off, float32(v[0]), true);
      dv.setFloat32(off + 4, float32(v[1]), true);
      dv.setFloat32(off + 8, float32(v[2]), true);
      off += 12;
    }
    dv.setUint16(off, 0, true);
    off += 2;
  }
  return { buffer, triangleCount: n, boxCount: boxes.length, byteLength: buffer.byteLength };
}

/** Suggested download name (no filesystem access here). */
export function stlFileName(analysis, material) {
  const preset = (material.preset || 'material').toString();
  return `anyrb_${preset}_${analysis.mass_g.toFixed(1)}g.stl`;
}

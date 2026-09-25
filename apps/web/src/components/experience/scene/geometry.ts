'use client';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type P2 = [number, number];

export function sampleBezier(p0: P2, p1: P2, p2: P2, p3: P2, n = 16): P2[] {
  const out: P2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const mt = 1 - t;
    out.push([
      mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0],
      mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
}

/** Turn a centre-line polyline into a closed outline with the given width (with taper). */
export function strokeToShape(pts: P2[], width: number, taper: [number, number] = [1, 1]): THREE.Shape {
  const left: P2[] = [];
  const right: P2[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0];
    let dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    const t = i / (pts.length - 1);
    const w = (width / 2) * (taper[0] + (taper[1] - taper[0]) * t);
    left.push([pts[i][0] - dy * w, pts[i][1] + dx * w]);
    right.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
  }
  const shape = new THREE.Shape();
  shape.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < left.length; i++) shape.lineTo(left[i][0], left[i][1]);
  for (let i = right.length - 1; i >= 0; i--) shape.lineTo(right[i][0], right[i][1]);
  shape.closePath();
  return shape;
}

export function extrudeStroke(pts: P2[], width: number, depth: number, bevel = 0.005, taper?: [number, number]) {
  const shape = strokeToShape(pts, width, taper);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.8,
    bevelSegments: 3,
    curveSegments: 6,
    steps: 1,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

export function merge(geos: THREE.BufferGeometry[]) {
  const prepared = geos.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    if (!ng.attributes.uv) {
      ng.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(ng.attributes.position.count * 2), 2));
    }
    // keep only the attributes all geometries share
    for (const k of Object.keys(ng.attributes)) if (!['position', 'normal', 'uv'].includes(k)) ng.deleteAttribute(k);
    return ng;
  });
  return mergeGeometries(prepared, false)!;
}

/** Plane subdivided in X/Y with its UVs, lying in XY */
export function gridPlane(w: number, h: number, sx: number, sy: number) {
  return new THREE.PlaneGeometry(w, h, sx, sy);
}

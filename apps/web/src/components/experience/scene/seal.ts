'use client';
import * as THREE from 'three';
import { mulberry32, ValueNoise } from './noise';

/**
 * Builds a blobby wax seal split along a jagged crack line into two halves.
 * Shapes are built in XY, extruded along +Z, then rotated so the seal lies in
 * XZ with its top facing +Y. "top" half is the one pointing toward -Z (hinge).
 */
export function sealGeometries(R = 0.019, seed = 11) {
  const n = new ValueNoise(seed);
  const rnd = mulberry32(seed);
  const N = 120;
  const radius = (a: number) => {
    const lobes = 0.06 * Math.sin(a * 3 + 1.1) + 0.04 * Math.sin(a * 5 + 0.3);
    const drip = Math.max(0, Math.cos(a - 4.4)) ** 12 * 0.16 + Math.max(0, Math.cos(a - 0.5)) ** 18 * 0.1;
    return R * (1 + lobes + drip + (n.n2(Math.cos(a) * 3 + 5, Math.sin(a) * 3 + 5) - 0.5) * 0.12);
  };
  const outline = (a: number): [number, number] => [Math.cos(a) * radius(a), Math.sin(a) * radius(a)];
  const right = outline(0);
  const left = outline(Math.PI);
  // jagged crack from left to right, near y = 0
  const crack: Array<[number, number]> = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = left[0] + (right[0] - left[0]) * t;
    const y = left[1] + (right[1] - left[1]) * t + (i > 0 && i < steps ? (rnd() - 0.5) * R * 0.22 : 0);
    crack.push([x, y]);
  }
  const topShape = new THREE.Shape();
  topShape.moveTo(right[0], right[1]);
  for (let i = 1; i <= N / 2; i++) {
    const [x, y] = outline((i / (N / 2)) * Math.PI);
    topShape.lineTo(x, y);
  }
  for (let i = 1; i < crack.length; i++) topShape.lineTo(crack[i][0], crack[i][1]);
  const botShape = new THREE.Shape();
  botShape.moveTo(left[0], left[1]);
  for (let i = 1; i <= N / 2; i++) {
    const [x, y] = outline(Math.PI + (i / (N / 2)) * Math.PI);
    botShape.lineTo(x, y);
  }
  for (let i = crack.length - 2; i >= 0; i--) botShape.lineTo(crack[i][0], crack[i][1]);

  const depth = R * 0.12;
  const opts: THREE.ExtrudeGeometryOptions = {
    depth,
    bevelEnabled: true,
    bevelThickness: R * 0.1,
    bevelSize: R * 0.1,
    bevelSegments: 5,
    curveSegments: 4,
  };
  const make = (s: THREE.Shape) => {
    const g = new THREE.ExtrudeGeometry(s, opts);
    // planar UVs from XY so the emboss maps seamlessly across both halves
    const pos = g.attributes.position as THREE.BufferAttribute;
    const uv = new Float32Array(pos.count * 2);
    const S = R * 2.0 * 1.19; // texture covers the full seal; impression = inner 0.72
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = pos.getX(i) / S + 0.5;
      uv[i * 2 + 1] = pos.getY(i) / S + 0.5;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.rotateX(-Math.PI / 2);
    g.computeVertexNormals();
    return g;
  };
  return { top: make(topShape), bottom: make(botShape), height: depth + R * 0.2 };
}

/** Irregular shards for the crumbs that burst off when the seal cracks */
export function crumbGeometry() {
  const g = new THREE.IcosahedronGeometry(0.0022, 0);
  const p = g.attributes.position as THREE.BufferAttribute;
  const rnd = mulberry32(3);
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(i, p.getX(i) * (0.6 + rnd() * 0.8), p.getY(i) * (0.4 + rnd() * 0.5), p.getZ(i) * (0.6 + rnd() * 0.8));
  }
  g.computeVertexNormals();
  return g;
}

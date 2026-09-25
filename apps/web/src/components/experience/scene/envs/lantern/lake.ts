'use client';
import * as THREE from 'three';

/* Layout of the night lake. Water at y = 0, the jetty runs toward the viewer (+z). */
export const DOCK = { y: 0.42, x0: -0.62, x1: 0.62, zEnd: 0.28, zStart: 3.2 };
/** the paper lantern: body size and where it floats before it drifts in */
export const LANTERN = { w: 0.3, h: 0.34, base: 0.035 };
export const LANTERN_REST = new THREE.Vector3(0.26, 0, -0.95);
export const LANTERN_NEAR = new THREE.Vector3(0.02, 0, -0.1);
/** direction toward the moon */
export const MOON_DIR = new THREE.Vector3(-0.42, 0.3, -0.86).normalize();
/** distant lanterns drifting on the lake (x, z, phase) */
export const FAR_LANTERNS: Array<[number, number, number]> = [
  [-2.4, -5.5, 0.3],
  [3.1, -8.5, 1.7],
  [-6.5, -14, 2.9],
  [7.5, -19, 4.1],
  [-1.2, -24, 5.2],
  [12, -32, 0.9],
  [-14, -38, 3.3],
];

export const smooth = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

/** gentle bobbing on the water */
export const bob = (t: number, ph = 0) => Math.sin(t * 0.9 + ph) * 0.006 + Math.sin(t * 1.7 + ph * 2) * 0.003;

/** shared by the water shader: where the lanterns are (xyz) and how bright (w) */
export const lanternUniforms = {
  uLanterns: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, -10, 0, 0)) },
  uRipple: { value: new THREE.Vector4(0, 0, 0, 0) }, // x, z, start time, strength
};

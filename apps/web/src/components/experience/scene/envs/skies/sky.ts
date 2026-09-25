'use client';
import * as THREE from 'three';

/* Layout of the basket and the floating scroll. Basket floor at y = 0, we look out toward −z. */
export const BASKET = { hx: 0.6, hz: 0.55, rim: 1.05 };
/** envelope mouth (the big balloon above us) */
export const MOUTH = { y: 5.2, r: 1.25 };
/** where the scroll floats, hanging under its balloons, before we reach for it */
export const HANG = new THREE.Vector3(0.16, 1.28, -1.05);
/** just outside the rim, within arm's reach */
export const CATCH = new THREE.Vector3(0.04, 1.3, -0.8);
/** direction toward the sun: low, ahead and to the right, so balloons glow against it */
export const SUN_DIR = new THREE.Vector3(0.48, 0.26, -0.84).normalize();
/** string length from the scroll to the balloon knots */
export const STRING = 0.5;

export const smooth = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

/** lathe profile of a party balloon (radius, height), knot at y = 0 */
export const PARTY_BALLOON: Array<[number, number]> = [
  [0.0, 0.0], [0.008, 0.004], [0.012, 0.012], [0.03, 0.03], [0.062, 0.07], [0.088, 0.12], [0.1, 0.17], [0.098, 0.22], [0.084, 0.26], [0.058, 0.29], [0.028, 0.305], [0.0, 0.31],
];

/** lathe profile of a hot-air balloon envelope, mouth at y = 0 (metres) */
export const ENVELOPE: Array<[number, number]> = [
  [1.25, 0], [1.6, 0.8], [2.6, 2.4], [4.1, 4.4], [5.6, 6.6], [6.5, 8.6], [6.9, 10.4], [6.8, 11.8], [6.2, 13.2], [5.0, 14.4], [3.3, 15.3], [1.4, 15.8], [0.0, 15.9],
];

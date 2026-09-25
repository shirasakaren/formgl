'use client';
/* Shared state of the shoreline: the beach slope and the swash (how far the last wave ran up). */

export const SHORE = {
  /** sand height = slope · z (z grows up the beach, toward the camera) */
  slope: 0.08,
  /** calm water level at the waterline */
  base: 0.004,
  /** extra height a wave adds when it runs up the beach */
  runup: 0.024,
};

export const sandY = (z: number) => SHORE.slope * z;

export const shoreUniforms = {
  uTime: { value: 0 },
  /** current water level at the shore */
  uLevel: { value: SHORE.base },
  /** highest recent level — the sand stays wet (and glossy) below it */
  uWet: { value: SHORE.base + SHORE.runup },
  /** 0..1 how much of a wave is currently on the beach */
  uSwash: { value: 0 },
};

/** a wave every ~8s: a quick run-up, a slow wash back */
export function swashAt(t: number) {
  const period = 8.5;
  const p = (t % period) / period;
  const up = 0.26;
  const s = p < up ? Math.sin((p / up) * Math.PI * 0.5) : 1 - smooth((p - up) / (1 - up));
  return s * s;
}

function smooth(x: number) {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

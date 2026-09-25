'use client';
import * as THREE from 'three';

export type Pair = [number, number];
export type Triple = [number, number, number];

/**
 * Camera framing for one environment. Arrays are [desktop, portrait] (or
 * [desktop, tablet, portrait] for fracW). The rig blends intro → hero → close → letter.
 */
export interface CamConfig {
  /** the thing we look at while idle (world) */
  subject: THREE.Vector3;
  /** its visible size, used to frame it */
  subjectSize: [number, number];
  heroElev: Pair;
  heroAzim: Pair;
  heroFracW: Triple;
  heroFracH: Pair;
  /** raise the look-at point by dist × k (composition) */
  heroLookUp: Pair;
  closeTarget: THREE.Vector3;
  closeElev: Pair;
  closeAzim: Pair;
  closeDist: Pair;
  introTarget: THREE.Vector3;
  introElev: number;
  introAzim: number;
  introDist: Pair;
  letterCentre: THREE.Vector3;
  letterDir: THREE.Vector3;
  fov: Triple;
  /** optional tweak of the camera during the final fly-away (0..1) */
  flyAway?: (k: number, pos: THREE.Vector3, tgt: THREE.Vector3) => void;
}

export function parkCamConfig(): CamConfig {
  const rest = new THREE.Vector3(0.3, 0.5265, -0.125);
  return {
    subject: rest.clone(),
    subjectSize: [0.232, 0.162],
    heroElev: [0.3, 0.26],
    heroAzim: [0.62, 0.42],
    heroFracW: [0.32, 0.44, 0.62],
    heroFracH: [0.38, 0.34],
    heroLookUp: [0.11, 0.2],
    closeTarget: new THREE.Vector3(rest.x * 0.6, rest.y + 0.06, rest.z + 0.11),
    closeElev: [0.18, 0.24],
    closeAzim: [0.4, 0.3],
    closeDist: [0.74, 0.78],
    introTarget: new THREE.Vector3(-0.1, 0.62, -0.3),
    introElev: 0.12,
    introAzim: 0.5,
    introDist: [3.4, 4.6],
    letterCentre: new THREE.Vector3(rest.x * 0.3, rest.y + 0.2, rest.z + 0.17),
    letterDir: new THREE.Vector3(0.06, 0.16, 1).normalize(),
    fov: [32, 36, 42],
    flyAway: (k, pos, tgt) => {
      tgt.y += k * 0.9;
      tgt.z -= k * 0.6;
      pos.y += k * 0.15;
    },
  };
}

/** Shared mutable scene references (no React state — read inside useFrame). */
export const sceneRefs = {
  envelope: null as THREE.Group | null,
  /** world-space pose of the envelope at rest on the bench */
  envelopeRest: { pos: new THREE.Vector3(0.3, 0.5265, -0.125), rotX: 1.22, rotY: 0.36, rotZ: 0.035 },
  /** where the camera sits for the close-up (the envelope turns to face it) */
  camClose: new THREE.Vector3(0.3, 0.7, 0.6),
  /** DOM rect (px) the letter overlay's paper occupies, for 3D ↔ DOM alignment */
  letterRect: { x: 0, y: 0, w: 0, h: 0, vw: 1, vh: 1 },
  /** computed each frame by the camera rig for the letter view */
  letterTarget: { pos: new THREE.Vector3(), present: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), quat: new THREE.Quaternion(), ready: false },
  /** hint position for the DOM button over the envelope */
  hint: { x: 0, y: 0, r: 0, visible: false },
  pointerInside: false,
  /** framing of the active environment */
  cam: parkCamConfig(),
  /** world pose of the letter while it is still in its vessel (written by the vessel each frame) */
  letterSource: null as null | ((out: { p: THREE.Vector3; q: THREE.Quaternion }, t: number) => void),
  /** world point the depth of field focuses on */
  focus: new THREE.Vector3(0.05, 0.45, 0.04),
  /** distance camera → focus, updated each frame */
  focusDistance: 1,
};

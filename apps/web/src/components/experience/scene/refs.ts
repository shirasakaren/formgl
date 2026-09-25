'use client';
import * as THREE from 'three';

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
  /** world point the depth of field focuses on */
  focus: new THREE.Vector3(0.05, 0.45, 0.04),
  /** distance camera → focus, updated each frame */
  focusDistance: 1,
};

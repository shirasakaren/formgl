'use client';
import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { anim } from '../store';
import { ENVELOPE, LETTER } from './assets';
import { sceneRefs } from './refs';

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

function spherical(target: THREE.Vector3, elev: number, azim: number, dist: number, out: THREE.Vector3) {
  const ce = Math.cos(elev);
  return out.set(target.x + Math.sin(azim) * ce * dist, target.y + Math.sin(elev) * dist, target.z + Math.cos(azim) * ce * dist);
}

export function CameraRig({ sway = true, reducedMotion = false }: { sway?: boolean; reducedMotion?: boolean }) {
  const { camera, size } = useThree();
  const v = useMemo(
    () => ({
      heroT: new THREE.Vector3(),
      heroP: new THREE.Vector3(),
      closeP: new THREE.Vector3(),
      closeT: new THREE.Vector3(),
      introP: new THREE.Vector3(),
      introT: new THREE.Vector3(),
      letterP: new THREE.Vector3(),
      letterT: new THREE.Vector3(),
      letterFinal: new THREE.Vector3(),
      pos: new THREE.Vector3(),
      tgt: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      m: new THREE.Matrix4(),
      up: new THREE.Vector3(0, 1, 0),
      right: new THREE.Vector3(),
      camUp: new THREE.Vector3(),
      px: 0,
      py: 0,
    }),
    [],
  );

  useFrame((state, dt) => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    const portrait = aspect < 0.85;
    const fov = portrait ? 42 : aspect < 1.25 ? 36 : 32;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    const tanH = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const rest = sceneRefs.envelopeRest.pos;

    /* ── hero: envelope leaning on the backrest in the lower third, the park above ── */
    const frac = portrait ? 0.62 : aspect < 1.25 ? 0.44 : 0.32;
    // fit by width, but never let the envelope fill too much of the height (ultrawide / landscape phones)
    const heroDist = Math.max(ENVELOPE.w / (frac * 2 * tanH * aspect), ENVELOPE.h / ((portrait ? 0.34 : 0.38) * 2 * tanH));
    v.heroT.set(rest.x, rest.y, rest.z);
    spherical(v.heroT, portrait ? 0.26 : 0.3, portrait ? 0.42 : 0.62, heroDist, v.heroP);
    // look a little above the envelope so the backrest and the park fill the top
    v.heroT.y += heroDist * (portrait ? 0.2 : 0.11);

    /* ── close: the envelope lifts toward us ── */
    v.closeT.set(rest.x * 0.6, rest.y + 0.06, rest.z + 0.11);
    spherical(v.closeT, portrait ? 0.24 : 0.18, portrait ? 0.3 : 0.4, heroDist * (portrait ? 0.78 : 0.74), v.closeP);
    sceneRefs.camClose.copy(v.closeP);

    /* ── establishing shot ── */
    v.introT.set(-0.1, 0.62, -0.3);
    spherical(v.introT, 0.12, 0.5, portrait ? 4.6 : 3.4, v.introP);

    /* ── letter: sized to match the DOM paper so the hand-off is seamless ── */
    const lr = sceneRefs.letterRect;
    const vw = size.width;
    const vh = size.height;
    const paperW = lr.w > 0 ? lr.w : Math.min(vw * 0.92, 680);
    const letterDist = (LETTER.w * vh) / (2 * tanH * Math.max(80, paperW));
    // presentation distance: far enough to see the whole unfolded sheet
    const fitDist = Math.max(LETTER.h / (0.8 * 2 * tanH), LETTER.w / (0.8 * 2 * tanH * aspect));
    const presentDist = Math.max(letterDist * 1.3, fitDist);
    const al = smooth(clamp(anim.align));
    const letterCentre = v.letterT.set(rest.x * 0.3, rest.y + 0.2, rest.z + 0.17);
    v.dir.set(0.06, 0.16, 1).normalize();
    v.letterP.copy(letterCentre).addScaledVector(v.dir, presentDist + (letterDist - presentDist) * al);
    v.letterFinal.copy(letterCentre).addScaledVector(v.dir, letterDist);

    /* ── blend poses ── */
    const c = anim.cam;
    if (c <= 1) {
      const k = smooth(clamp(c));
      v.pos.lerpVectors(v.heroP, v.closeP, k);
      v.tgt.lerpVectors(v.heroT, v.closeT, k);
    } else {
      const k = smooth(clamp(c - 1));
      v.pos.lerpVectors(v.closeP, v.letterP, k);
      v.tgt.lerpVectors(v.closeT, v.letterT, k);
    }
    if (anim.intro > 0) {
      const k = smooth(clamp(anim.intro));
      v.pos.lerp(v.introP, k);
      v.tgt.lerp(v.introT, k);
    }
    if (anim.flyAway > 0) {
      // follow the envelope up into the sky a little
      const k = smooth(clamp(anim.flyAway));
      v.tgt.y += k * 0.9;
      v.tgt.z -= k * 0.6;
      v.pos.y += k * 0.15;
    }

    /* ── life: slow handheld drift + pointer parallax ── */
    const t = state.clock.elapsedTime;
    const swayAmt = sway && !reducedMotion ? 1 : 0;
    const dist = v.pos.distanceTo(v.tgt);
    v.px += (anim.px - v.px) * Math.min(1, dt * 2.5);
    v.py += (anim.py - v.py) * Math.min(1, dt * 2.5);
    v.dir.subVectors(v.tgt, v.pos).normalize();
    v.right.crossVectors(v.dir, v.up).normalize();
    v.camUp.crossVectors(v.right, v.dir).normalize();
    const drift = swayAmt * dist * 0.012;
    const par = (reducedMotion ? 0 : 1) * dist * 0.035 * (c >= 1.5 ? 0.35 : 1);
    v.pos
      .addScaledVector(v.right, Math.sin(t * 0.21) * drift + v.px * par)
      .addScaledVector(v.camUp, Math.sin(t * 0.17 + 1.3) * drift * 0.7 + v.py * par * 0.6);

    cam.position.copy(v.pos);
    cam.lookAt(v.tgt);

    /* ── letter reading pose (always facing the letter camera pose) ── */
    const lt = sceneRefs.letterTarget;
    v.m.lookAt(v.letterFinal, v.letterT, v.up);
    lt.quat.setFromRotationMatrix(v.m);
    // align the sheet's top with the DOM paper's top edge
    const sheetHpx = (LETTER.h / LETTER.w) * paperW;
    const topPx = lr.h > 0 ? lr.y : Math.max(24, (vh - sheetHpx) / 2);
    const centrePx = topPx + sheetHpx / 2;
    const centreXpx = lr.w > 0 ? lr.x + lr.w / 2 : vw / 2;
    const worldPerPx = (2 * letterDist * tanH) / vh;
    v.right.set(1, 0, 0).applyQuaternion(lt.quat);
    v.camUp.set(0, 1, 0).applyQuaternion(lt.quat);
    lt.pos
      .copy(v.letterT)
      .addScaledVector(v.camUp, -(centrePx - vh / 2) * worldPerPx)
      .addScaledVector(v.right, (centreXpx - vw / 2) * worldPerPx);
    // presentation pose: the sheet waits at the letter centre while the camera pulls in
    lt.present.copy(v.letterT);
    lt.up.copy(v.camUp);
    lt.ready = true;

    /* ── focus for depth of field ── */
    const f = sceneRefs.focus;
    if (c < 1.5) f.lerpVectors(v.heroT, v.closeT, smooth(clamp(c)));
    else f.copy(lt.pos);
    if (anim.intro > 0) f.lerp(v.introT, smooth(clamp(anim.intro)) * 0.6);
    sceneRefs.focusDistance = cam.position.distanceTo(f);
  });
  return null;
}

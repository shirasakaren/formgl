'use client';
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { anim, useExperience } from '../store';
import { LETTER } from './assets';
import { sceneRefs } from './refs';

/**
 * Pins the DOM letter (real inputs, fully accessible) onto the 3D sheet.
 *
 * Each frame the sheet's four corners are projected to the screen and the DOM sheet
 * gets the CSS matrix3d of the homography that maps its layout box onto that quad —
 * so the form tilts, breathes and turns with the paper as if it were written on it.
 */
export function PaperProjector() {
  const { camera, gl } = useThree();
  const v = useMemo(
    () => ({
      c: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()],
      local: [
        new THREE.Vector3(-LETTER.w / 2, LETTER.h / 2, 0.0006),
        new THREE.Vector3(LETTER.w / 2, LETTER.h / 2, 0.0006),
        new THREE.Vector3(LETTER.w / 2, -LETTER.h / 2, 0.0006),
        new THREE.Vector3(-LETTER.w / 2, -LETTER.h / 2, 0.0006),
      ],
      pts: new Float64Array(8),
    }),
    [],
  );
  const last = useRef<{ t: string; o: string; el: HTMLElement | null }>({ t: '', o: '', el: null });

  useFrame(() => {
    const el = sceneRefs.paperEl;
    const L = sceneRefs.letterGroup;
    if (!el || !L) return;
    // a new page is a new element: write everything again
    if (last.current.el !== el) last.current = { t: '', o: '', el };
    const phase = useExperience.getState().phase;
    const flip = Math.abs(anim.fx.flip ?? 0);
    // the writing appears once the sheet has settled in front of us, hides while it turns edge-on
    const settle = THREE.MathUtils.smoothstep(anim.align, 0.72, 1);
    const turn = 1 - THREE.MathUtils.smoothstep(flip, 0.55, 0.8);
    const writing = phase === 'reading' || phase === 'opening';
    const opacity = writing ? settle * turn : 0;
    // the printed preview on the sheet gives way to blank paper under the live writing
    if (anim.fx.reply < 0.5) anim.fx.blank = writing ? settle : 0;
    const o = opacity.toFixed(3);
    if (o !== last.current.o) {
      el.style.opacity = o;
      el.style.visibility = opacity > 0.01 ? 'visible' : 'hidden';
      last.current.o = o;
    }
    if (opacity <= 0.01) return;

    L.updateMatrixWorld();
    camera.updateMatrixWorld();
    const rect = gl.domElement.getBoundingClientRect();
    for (let i = 0; i < 4; i++) {
      const p = v.c[i].copy(v.local[i]).applyMatrix4(L.matrixWorld).project(camera);
      if (p.z > 1) return; // behind the camera: keep the last good transform
      v.pts[i * 2] = rect.left + (p.x * 0.5 + 0.5) * rect.width;
      v.pts[i * 2 + 1] = rect.top + (0.5 - p.y * 0.5) * rect.height;
    }
    const { w, h } = sceneRefs.paperSize;
    const m = rectToQuad(w, h, v.pts);
    if (!m) return;
    const t = `matrix3d(${m.map((x) => x.toFixed(6)).join(',')})`;
    if (t !== last.current.t) {
      el.style.transform = t;
      last.current.t = t;
    }
  });
  return null;
}

/**
 * CSS matrix3d (column-major) of the projective map sending the rectangle
 * (0,0)-(w,h) to the quad p0 (top-left), p1 (top-right), p2 (bottom-right), p3 (bottom-left).
 */
function rectToQuad(w: number, h: number, p: Float64Array): number[] | null {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = p;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;
  let a: number, b: number, d: number, e: number, g: number, hh: number;
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
    a = x1 - x0;
    b = x3 - x0;
    d = y1 - y0;
    e = y3 - y0;
    g = 0;
    hh = 0;
  } else {
    const den = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(den) < 1e-12) return null;
    g = (dx3 * dy2 - dx2 * dy3) / den;
    hh = (dx1 * dy3 - dx3 * dy1) / den;
    a = x1 - x0 + g * x1;
    b = x3 - x0 + hh * x3;
    d = y1 - y0 + g * y1;
    e = y3 - y0 + hh * y3;
  }
  const c = x0;
  const f = y0;
  // unit square → quad, then scale the layout box down to the unit square
  a /= w;
  d /= w;
  g /= w;
  b /= h;
  e /= h;
  hh /= h;
  return [a, d, 0, g, b, e, 0, hh, 0, 0, 1, 0, c, f, 0, 1];
}

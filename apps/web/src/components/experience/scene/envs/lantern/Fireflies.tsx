'use client';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Quality } from '../../../store';
import { windUniforms } from '../../Ground';
import { mulberry32 } from '../../noise';

/** Fireflies drifting over the reeds, each blinking on its own slow rhythm. All motion is in the shader. */
export function Fireflies({ quality }: { quality: Quality }) {
  const points = useMemo(() => {
    const n = quality === 'low' ? 36 : quality === 'medium' ? 70 : 110;
    const rnd = mulberry32(21);
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      // mostly over the reeds on either side of the jetty, a few out over the water
      const side = rnd() < 0.5 ? -1 : 1;
      const far = rnd() < 0.25;
      pos[i * 3] = far ? (rnd() - 0.5) * 9 : side * (0.9 + rnd() * 2.4);
      pos[i * 3 + 1] = 0.15 + rnd() * 0.9;
      pos[i * 3 + 2] = far ? -2 - rnd() * 6 : -1.2 + rnd() * 2.6;
      seed[i * 4] = rnd() * 100;
      seed[i * 4 + 1] = 0.6 + rnd() * 0.8;
      seed[i * 4 + 2] = 0.12 + rnd() * 0.2;
      seed[i * 4 + 3] = 0.6 + rnd() * 0.7;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.5, -2), 12);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: windUniforms.uTime,
        uColor: { value: new THREE.Color(1.6, 1.45, 0.55) },
        uScale: { value: quality === 'low' ? 40 : 56 },
      },
      vertexShader: /* glsl */ `
        attribute vec4 aSeed; uniform float uTime; uniform float uScale;
        varying float vA;
        void main() {
          float t = uTime * aSeed.y + aSeed.x;
          vec3 p = position;
          p.x += sin(t * 0.37) * aSeed.z + sin(t * 0.91) * 0.04;
          p.y += sin(t * 0.53 + 1.3) * aSeed.z * 0.6;
          p.z += cos(t * 0.29) * aSeed.z;
          // slow blink: mostly dark, a soft glow now and then
          float b = sin(t * 0.8 + aSeed.x);
          vA = smoothstep(0.1, 0.9, b) * (0.7 + 0.3 * sin(t * 9.0));
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uScale * aSeed.w / -mv.z;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; varying float vA;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = dot(c, c) * 4.0;
          float a = exp(-d * 5.0) + exp(-d * 40.0) * 1.5;
          gl_FragColor = vec4(uColor * a * vA, 1.0);
        }`,
    });
    const p = new THREE.Points(geo, mat);
    p.renderOrder = 8;
    return p;
  }, [quality]);
  return <primitive object={points} />;
}

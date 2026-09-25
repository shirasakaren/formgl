'use client';
import { useMemo } from 'react';
import * as THREE from 'three';

/** Gradient sky dome with a soft sun glow and faint high clouds. */
export function Sky({ top, horizon, glow, sunDir, radius = 400, cloudiness = 0.12, below }: { top: string; horizon: string; glow: string; sunDir: [number, number, number]; radius?: number; cloudiness?: number; below?: string }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTop: { value: new THREE.Color(top) },
          uHorizon: { value: new THREE.Color(horizon) },
          uBelow: { value: new THREE.Color(below ?? horizon) },
          uGlow: { value: new THREE.Color(glow) },
          uSun: { value: new THREE.Vector3(...sunDir).normalize() },
          uClouds: { value: cloudiness },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_Position.z = gl_Position.w;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uBelow; uniform vec3 uGlow; uniform vec3 uSun; uniform float uClouds;
          varying vec3 vDir;
          float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
          float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
            return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
          void main() {
            vec3 d = normalize(vDir);
            float y = d.y;
            vec3 col = y >= 0.0 ? mix(uHorizon, uTop, pow(clamp(y, 0.0, 1.0), 0.38)) : mix(uHorizon, uBelow, clamp(-y * 4.0, 0.0, 1.0));
            float s = max(dot(d, normalize(uSun)), 0.0);
            col += uGlow * (pow(s, 5.0) * 0.32 + pow(s, 40.0) * 0.7 + pow(s, 700.0) * 2.5);
            // soft streaky high clouds
            vec2 p = d.xz / max(0.08, y + 0.15) * 1.4;
            float c = n(p * 1.3) * 0.6 + n(p * 3.1) * 0.3 + n(p * 7.0) * 0.1;
            col = mix(col, vec3(1.0), smoothstep(0.55, 0.9, c) * uClouds * smoothstep(0.02, 0.3, y));
            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }),
    [top, horizon, glow, sunDir, cloudiness, below],
  );
  return (
    <mesh material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[radius, 32, 16]} />
    </mesh>
  );
}

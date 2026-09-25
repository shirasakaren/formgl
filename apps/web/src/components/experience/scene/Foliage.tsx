'use client';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Quality } from '../store';
import type { SceneAssets } from './assets';
import { windUniforms } from './Ground';
import { mulberry32 } from './noise';
import type { LightPreset } from './presets';

export interface Canopy {
  c: [number, number, number];
  r: [number, number, number];
  n: number;
  card: number;
  tint?: number;
}

const VERT = /* glsl */ `
  attribute vec4 aCard;   // centre xyz, size
  attribute vec4 aShade;  // normal xyz, tint
  attribute float aRoll;
  uniform float uTime; uniform float uWind;
  varying vec2 vUv; varying vec3 vN; varying float vTint; varying vec3 vW; varying float vSeed;
  void main() {
    vUv = uv;
    vN = aShade.xyz; vTint = aShade.w; vSeed = aRoll;
    vec3 c = aCard.xyz;
    // canopy sway, stronger at the top of each tree
    c.x += sin(uTime * 0.7 + c.z * 0.3 + aRoll) * 0.05 * uWind * max(c.y - 1.0, 0.0) * 0.4;
    vW = c;
    vec4 mv = modelViewMatrix * vec4(c, 1.0);
    float roll = aRoll * 6.2831 + sin(uTime * 1.3 + aRoll * 20.0) * 0.08 * uWind;
    vec2 p = position.xy * aCard.w;
    p = mat2(cos(roll), -sin(roll), sin(roll), cos(roll)) * p;
    mv.xy += p;
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = /* glsl */ `
  uniform sampler2D uMap; uniform vec3 uSun; uniform vec3 uDark; uniform vec3 uLit; uniform vec3 uFog; uniform vec3 uGlint;
  uniform float uTime;
  varying vec2 vUv; varying vec3 vN; varying float vTint; varying vec3 vW; varying float vSeed;
  void main() {
    float t = texture2D(uMap, vUv).r;
    float a = texture2D(uMap, vUv).a;
    if (a < 0.45) discard;
    vec3 n = normalize(vN);
    vec3 s = normalize(uSun);
    vec3 v = normalize(cameraPosition - vW);
    float lam = max(dot(n, s), 0.0);
    float wrap = max(dot(n, s) * 0.5 + 0.5, 0.0);
    // inner canopy is darker (self shadowing)
    float occl = 0.45 + 0.55 * smoothstep(-0.3, 0.8, n.y * 0.5 + dot(n, s) * 0.5);
    vec3 col = mix(uDark * 0.38, uLit * 0.9, clamp(lam * 0.75 + wrap * 0.2, 0.0, 1.0)) * (0.5 + 0.6 * t) * vTint * occl;
    // backlit translucency
    float trans = pow(max(dot(-v, s), 0.0), 3.0) * (1.0 - lam);
    col += uLit * trans * 0.35 * t;
    // sparkles where the sun catches leaf faces
    float sp = step(0.93, t) * lam * (0.6 + 0.4 * sin(uTime * 2.0 + vSeed * 40.0));
    col += uGlint * sp * 0.9;
    float d = length(vW - cameraPosition);
    col = mix(col, uFog, smoothstep(9.0, 70.0, d) * 0.7);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function Foliage({ canopies, assets, preset, quality, seed = 3 }: { canopies: Canopy[]; assets: SceneAssets; preset: LightPreset; quality: Quality; seed?: number }) {
  const mesh = useMemo(() => {
    const rnd = mulberry32(seed);
    const density = quality === 'low' ? 0.45 : quality === 'medium' ? 0.75 : 1;
    const total = canopies.reduce((a, c) => a + Math.round(c.n * density), 0);
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.attributes.position);
    geo.setAttribute('uv', base.attributes.uv);
    const card = new Float32Array(total * 4);
    const shade = new Float32Array(total * 4);
    const roll = new Float32Array(total);
    let k = 0;
    const v = new THREE.Vector3();
    for (const cp of canopies) {
      const n = Math.round(cp.n * density);
      for (let i = 0; i < n; i++) {
        // points biased toward the ellipsoid surface
        v.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
        if (v.lengthSq() > 1) v.normalize();
        const len = Math.pow(v.length(), 0.35);
        v.normalize().multiplyScalar(len);
        const px = cp.c[0] + v.x * cp.r[0];
        const py = cp.c[1] + v.y * cp.r[1];
        const pz = cp.c[2] + v.z * cp.r[2];
        card[k * 4] = px;
        card[k * 4 + 1] = py;
        card[k * 4 + 2] = pz;
        card[k * 4 + 3] = cp.card * (0.7 + rnd() * 0.6) * (1 / Math.sqrt(density));
        const nn = v.clone().normalize();
        shade[k * 4] = nn.x;
        shade[k * 4 + 1] = nn.y;
        shade[k * 4 + 2] = nn.z;
        shade[k * 4 + 3] = (cp.tint ?? 1) * (0.8 + rnd() * 0.4);
        roll[k] = rnd();
        k++;
      }
    }
    geo.setAttribute('aCard', new THREE.InstancedBufferAttribute(card, 4));
    geo.setAttribute('aShade', new THREE.InstancedBufferAttribute(shade, 4));
    geo.setAttribute('aRoll', new THREE.InstancedBufferAttribute(roll, 1));
    geo.instanceCount = k;
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: assets.cluster },
        uSun: { value: new THREE.Vector3(...preset.sunDir).normalize() },
        uDark: { value: new THREE.Color(preset.treeTint) },
        uLit: { value: new THREE.Color(preset.treeLit) },
        uFog: { value: new THREE.Color(preset.fog) },
        uGlint: { value: new THREE.Color(preset.bokeh) },
        uTime: windUniforms.uTime,
        uWind: windUniforms.uWind,
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    return m;
  }, [canopies, assets, preset, quality, seed]);
  return <primitive object={mesh} />;
}

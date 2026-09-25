'use client';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Quality } from '../store';
import type { SceneAssets } from './assets';
import { windUniforms } from './Ground';
import { mulberry32 } from './noise';
import type { LightPreset } from './presets';
import { Foliage, type Canopy } from './Foliage';

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * p;
    gl_Position.z = gl_Position.w; // always at the far plane
  }
`;
const SKY_FRAG = /* glsl */ `
  uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uGlow; uniform vec3 uSun;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y, 0.0, 1.0);
    vec3 col = mix(uHorizon, uTop, pow(h, 0.55));
    float s = max(dot(d, normalize(uSun)), 0.0);
    col += uGlow * (pow(s, 6.0) * 0.35 + pow(s, 48.0) * 0.8 + pow(s, 900.0) * 3.0);
    // faint high clouds
    float c = sin(d.x * 9.0 + d.z * 4.0) * sin(d.z * 7.0 - d.x * 3.0) * 0.5 + 0.5;
    col = mix(col, vec3(1.0), smoothstep(0.7, 1.0, c) * 0.12 * smoothstep(0.05, 0.4, h));
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const BOKEH_VERT = /* glsl */ `
  attribute vec4 aData; // size, phase, speed, brightness
  uniform float uTime;
  varying float vA; varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(instanceMatrix[3].xyz, 1.0);
    float tw = 0.5 + 0.5 * sin(uTime * aData.z + aData.y);
    vA = aData.w * (0.35 + 0.65 * tw * tw);
    mv.xy += position.xy * aData.x;
    gl_Position = projectionMatrix * mv;
  }
`;
const BOKEH_FRAG = /* glsl */ `
  uniform sampler2D uMap; uniform vec3 uColor;
  varying float vA; varying vec2 vUv;
  void main() {
    vec4 t = texture2D(uMap, vUv);
    gl_FragColor = vec4(uColor * t.rgb * vA, t.a * vA);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function Background({ preset, assets, quality }: { preset: LightPreset; assets: SceneAssets; quality: Quality }) {
  const res = useMemo(() => {
    const sun = new THREE.Vector3(...preset.sunDir).normalize();
    const sky = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color(preset.skyTop) },
        uHorizon: { value: new THREE.Color(preset.skyHorizon) },
        uGlow: { value: new THREE.Color(preset.sunGlow) },
        uSun: { value: sun },
      },
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
    });

    const rnd = mulberry32(31);
    const m = new THREE.Matrix4();
    const trees: Array<{ x: number; z: number; s: number }> = [];
    const treeCount = quality === 'low' ? 18 : 30;
    for (let i = 0; i < treeCount; i++) {
      const a = -Math.PI * 0.95 + (i / treeCount) * Math.PI * 0.9 + (rnd() - 0.5) * 0.12;
      const r = 12 + rnd() * 16;
      trees.push({ x: Math.cos(a) * r * 1.2, z: Math.sin(a) * r, s: 0.8 + rnd() * 0.7 });
    }
    for (let i = 0; i < 8; i++) {
      const side = i % 2 ? 1 : -1;
      trees.push({ x: side * (7 + rnd() * 9), z: -2 + rnd() * 8, s: 0.8 + rnd() * 0.5 });
    }
    const canopies: Canopy[] = [];
    const trunks: Array<[number, number, number, number]> = [];
    trees.forEach((t) => {
      const h = (4.5 + rnd() * 3) * t.s;
      trunks.push([t.x, t.z, h * 0.62, 0.12 * t.s]);
      const lobes = 3;
      for (let j = 0; j < lobes; j++) {
        const rr = (1.7 + rnd() * 1.2) * t.s;
        canopies.push({
          c: [t.x + (rnd() - 0.5) * 2.6 * t.s, h * 0.74 + (rnd() - 0.3) * 1.8 * t.s, t.z + (rnd() - 0.5) * 2 * t.s],
          r: [rr * 1.1, rr * 0.9, rr],
          n: 110,
          card: 1.05 * t.s,
          tint: 0.85 + rnd() * 0.3,
        });
      }
    });
    // midground hedge / shrubs behind the bench
    for (let j = 0; j < 14; j++) {
      const x = -8 + (j / 14) * 16 + (rnd() - 0.5) * 0.8;
      const z = -3.6 - rnd() * 1.6 - Math.abs(x) * 0.12;
      const r = 0.6 + rnd() * 0.5;
      canopies.push({ c: [x, r * 0.7, z], r: [r * 1.5, r * 0.8, r], n: 70, card: 0.42, tint: 0.75 + rnd() * 0.2 });
    }

    // trunks
    const trunkGeo = new THREE.CylinderGeometry(0.6, 1, 1, 7, 1, true);
    trunkGeo.translate(0, 0.5, 0);
    const trunkMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(preset.treeTint).multiplyScalar(0.45).lerp(new THREE.Color(preset.fog), 0.25) });
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, trunks.length);
    trunks.forEach(([x, z, h, r], i) => {
      m.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(r, h, r));
      trunkMesh.setMatrixAt(i, m);
    });

    // bokeh sun sparkles in the far canopies
    const bokehCount = quality === 'low' ? 40 : 110;
    const bgeo = new THREE.PlaneGeometry(1, 1);
    const bdata = new Float32Array(bokehCount * 4);
    const bokehMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uMap: { value: assets.bokeh }, uColor: { value: new THREE.Color(preset.bokeh) }, uTime: windUniforms.uTime },
      vertexShader: BOKEH_VERT,
      fragmentShader: BOKEH_FRAG,
    });
    const bokeh = new THREE.InstancedMesh(bgeo, bokehMat, bokehCount);
    for (let i = 0; i < bokehCount; i++) {
      const t = trees[Math.floor(rnd() * trees.length)];
      m.makeTranslation(t.x + (rnd() - 0.5) * 5, 2 + rnd() * 5, t.z + (rnd() - 0.5) * 3 + 1.5);
      bokeh.setMatrixAt(i, m);
      bdata[i * 4] = 0.25 + rnd() * 0.6;
      bdata[i * 4 + 1] = rnd() * 6.28;
      bdata[i * 4 + 2] = 0.6 + rnd() * 1.8;
      bdata[i * 4 + 3] = 0.35 + rnd() * 0.6;
    }
    bgeo.setAttribute('aData', new THREE.InstancedBufferAttribute(bdata, 4));
    bokeh.frustumCulled = false;
    bokeh.renderOrder = 5;
    return { sky, trunkMesh, bokeh, canopies };
  }, [preset, assets, quality]);

  return (
    <group>
      <mesh material={res.sky} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[90, 32, 16]} />
      </mesh>
      <Foliage canopies={res.canopies} assets={assets} preset={preset} quality={quality} />
      <primitive object={res.trunkMesh} />
      <primitive object={res.bokeh} />
    </group>
  );
}

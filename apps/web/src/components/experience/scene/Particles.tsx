'use client';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { anim, type Quality } from '../store';
import type { SceneAssets } from './assets';
import { windUniforms } from './Ground';
import { mulberry32 } from './noise';
import type { LightPreset } from './presets';

/* ───────────── dust motes floating in the sun ───────────── */

export function Dust({ assets, preset, quality }: { assets: SceneAssets; preset: LightPreset; quality: Quality }) {
  const res = useMemo(() => {
    const count = quality === 'low' ? 160 : quality === 'medium' ? 320 : 520;
    const rnd = mulberry32(9);
    const pos = new Float32Array(count * 3);
    const data = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rnd() - 0.5) * 2.6;
      pos[i * 3 + 1] = 0.35 + rnd() * 1.1;
      pos[i * 3 + 2] = -0.8 + rnd() * 2.2;
      data[i * 4] = rnd() * 10;
      data[i * 4 + 1] = 0.5 + rnd() * 1.5;
      data[i * 4 + 2] = 2 + rnd() * 5;
      data[i * 4 + 3] = rnd();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aData', new THREE.BufferAttribute(data, 4));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: windUniforms.uTime,
        uWind: windUniforms.uWind,
        uMap: { value: assets.dot },
        uColor: { value: new THREE.Color(preset.dustColor) },
        uPixel: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute vec4 aData; uniform float uTime; uniform float uWind; uniform float uPixel;
        varying float vA;
        void main() {
          vec3 p = position;
          float t = uTime * 0.05 * aData.y + aData.x;
          p.x += sin(t * 3.0) * 0.12 + uTime * 0.012 * uWind;
          p.y += sin(t * 2.3 + 1.0) * 0.08;
          p.z += cos(t * 2.7) * 0.1;
          p.x = mod(p.x + 1.3, 2.6) - 1.3;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float tw = 0.5 + 0.5 * sin(uTime * aData.z * 0.4 + aData.x * 6.0);
          vA = (0.25 + 0.75 * tw * tw) * (0.4 + aData.w * 0.6);
          gl_PointSize = (3.0 + aData.w * 5.0) * uPixel / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform vec3 uColor; varying float vA;
        void main() {
          vec4 t = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(uColor * t.a * vA * 0.9, t.a * vA);
        }`,
    });
    const points = new THREE.Points(g, mat);
    points.frustumCulled = false;
    return { points, mat };
  }, [assets, preset, quality]);
  useFrame(({ gl }) => {
    res.mat.uniforms.uPixel.value = gl.getPixelRatio() * 1.6;
  });
  return <primitive object={res.points} />;
}

/* ───────────── falling leaves / petals ───────────── */

export function FallingLeaves({ assets, count = 14, petals = false, quality }: { assets: SceneAssets; count?: number; petals?: boolean; quality: Quality }) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const n = quality === 'low' ? Math.ceil(count / 2) : count;
  const res = useMemo(() => {
    const rnd = mulberry32(petals ? 55 : 44);
    const geo = new THREE.PlaneGeometry(petals ? 0.022 : 0.05, petals ? 0.03 : 0.05, 2, 2);
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getX(i) * p.getX(i) * (petals ? 20 : 8));
    geo.computeVertexNormals();
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    const cell = petals ? 1 : 2;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.5 + (cell % 2) * 0.5, uv.getY(i) * 0.5 + (1 - Math.floor(cell / 2)) * 0.5);
    const mat = new THREE.MeshStandardMaterial({
      map: petals ? null : assets.leaves,
      color: petals ? '#f7c6d0' : '#ffffff',
      alphaTest: 0.4,
      side: THREE.DoubleSide,
      roughness: 0.7,
      transparent: false,
    });
    if (petals) {
      mat.map = null;
    }
    const state = Array.from({ length: n }, () => ({
      x: (rnd() - 0.5) * 3,
      y: 0.6 + rnd() * 2.2,
      z: -1 + rnd() * 2.4,
      vy: 0.12 + rnd() * 0.12,
      phase: rnd() * 10,
      spin: 0.8 + rnd() * 2,
      amp: 0.1 + rnd() * 0.25,
    }));
    return { geo, mat, state, rnd };
  }, [assets, n, petals]);

  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const e = useMemo(() => new THREE.Euler(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const s = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  useFrame((st, dt) => {
    const d = Math.min(dt, 0.05);
    const t = st.clock.elapsedTime;
    res.state.forEach((l, i) => {
      l.y -= l.vy * d;
      l.x += (Math.sin(t * 0.8 + l.phase) * l.amp + anim.wind * 0.25) * d;
      l.z += Math.cos(t * 0.6 + l.phase) * l.amp * 0.5 * d;
      if (l.y < 0.0) {
        l.y = 2.6 + res.rnd() * 0.8;
        l.x = (res.rnd() - 0.5) * 3 - 0.6;
        l.z = -1 + res.rnd() * 2.4;
      }
      e.set(t * l.spin + l.phase, t * l.spin * 0.7, Math.sin(t + l.phase) * 1.2);
      q.setFromEuler(e);
      m4.compose(v.set(l.x, l.y, l.z), q, s);
      mesh.current.setMatrixAt(i, m4);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[res.geo, res.mat, n]} frustumCulled={false} />;
}

/* ───────────── dandelion seeds drifting through the air ───────────── */

export function FloatingSeeds({ assets, quality }: { assets: SceneAssets; quality: Quality }) {
  const res = useMemo(() => {
    const count = quality === 'low' ? 10 : 24;
    const rnd = mulberry32(21);
    const geo = new THREE.PlaneGeometry(1, 1);
    const data = new Float32Array(count * 4);
    const start = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      start[i * 3] = (rnd() - 0.5) * 3;
      start[i * 3 + 1] = 0.3 + rnd() * 1.2;
      start[i * 3 + 2] = -1.2 + rnd() * 2.2;
      data[i * 4] = rnd() * 100;
      data[i * 4 + 1] = 0.02 + rnd() * 0.025;
      data[i * 4 + 2] = 0.5 + rnd();
      data[i * 4 + 3] = rnd();
    }
    geo.setAttribute('aStart', new THREE.InstancedBufferAttribute(start, 3));
    geo.setAttribute('aData', new THREE.InstancedBufferAttribute(data, 4));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: windUniforms.uTime, uWind: windUniforms.uWind, uMap: { value: assets.seed } },
      vertexShader: /* glsl */ `
        attribute vec3 aStart; attribute vec4 aData;
        uniform float uTime; uniform float uWind;
        varying vec2 vUv; varying float vA;
        void main() {
          vUv = uv;
          float t = uTime * 0.06 * aData.z + aData.x;
          vec3 p = aStart;
          p.x = mod(aStart.x + uTime * (0.03 + uWind * 0.05) * aData.z + 1.5, 3.0) - 1.5;
          p.y += sin(t * 2.0) * 0.12 + sin(t * 5.1) * 0.02;
          p.z += cos(t * 1.7) * 0.15;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float rot = sin(t * 3.0) * 0.4;
          vec2 c = position.xy * aData.y;
          c = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * c;
          mv.xy += c;
          float edge = smoothstep(1.5, 1.2, abs(p.x));
          vA = (0.55 + aData.w * 0.4) * edge;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; varying vec2 vUv; varying float vA;
        void main() {
          vec4 t = texture2D(uMap, vUv);
          gl_FragColor = vec4(vec3(1.0, 0.99, 0.96) * 1.15, t.a * vA);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) mesh.setMatrixAt(i, m);
    mesh.frustumCulled = false;
    return { mesh };
  }, [assets, quality]);
  return <primitive object={res.mesh} />;
}

/* ───────────── butterflies ───────────── */

function Butterfly({ assets, seed }: { assets: SceneAssets; seed: number }) {
  const g = useRef<THREE.Group>(null!);
  const l = useRef<THREE.Mesh>(null!);
  const r = useRef<THREE.Mesh>(null!);
  const res = useMemo(() => {
    const geo = new THREE.PlaneGeometry(0.035, 0.035);
    geo.translate(0.0175, 0, 0);
    const mat = new THREE.MeshStandardMaterial({ map: assets.wing, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.6 });
    return { geo, mat, rnd: mulberry32(seed) };
  }, [assets, seed]);
  const params = useMemo(() => ({ a: 0.5 + res.rnd() * 0.6, b: 0.3 + res.rnd() * 0.3, ph: res.rnd() * 10, cx: (res.rnd() - 0.5) * 1.4, cz: -0.6 - res.rnd() * 0.6 }), [res]);
  const prev = useMemo(() => new THREE.Vector3(), []);
  useFrame((st) => {
    const t = st.clock.elapsedTime * 0.35 + params.ph;
    const x = params.cx + Math.sin(t * 1.1) * params.a;
    const y = 0.75 + Math.sin(t * 2.3) * 0.18 + Math.sin(t * 7) * 0.02;
    const z = params.cz + Math.cos(t * 0.9) * params.b;
    g.current.position.set(x, y, z);
    const dx = x - prev.x;
    const dz = z - prev.z;
    if (Math.abs(dx) + Math.abs(dz) > 1e-5) g.current.rotation.y = Math.atan2(dx, dz) - Math.PI / 2;
    prev.set(x, y, z);
    const flap = Math.sin(st.clock.elapsedTime * 22 + params.ph) * 0.9 + 0.3;
    l.current.rotation.x = flap;
    r.current.rotation.x = -flap;
  });
  return (
    <group ref={g}>
      <group rotation={[0, 0, 0]}>
        <mesh ref={l} geometry={res.geo} material={res.mat} rotation={[0, 0, 0]}>
        </mesh>
        <group scale={[1, -1, 1]}>
          <mesh ref={r} geometry={res.geo} material={res.mat} />
        </group>
      </group>
    </group>
  );
}

export function Butterflies({ assets, count = 2 }: { assets: SceneAssets; count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <group key={i} rotation={[0, 0, Math.PI / 2]}>
          <Butterfly assets={assets} seed={i * 7 + 3} />
        </group>
      ))}
    </>
  );
}

/* ───────────── volumetric light shafts through the canopy ───────────── */

export function LightShafts({ preset, count = 6 }: { preset: LightPreset; count?: number }) {
  const res = useMemo(() => {
    const rnd = mulberry32(5);
    const dir = new THREE.Vector3(...preset.sunDir).normalize();
    const geo = new THREE.PlaneGeometry(1, 1, 1, 8);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uTime: windUniforms.uTime, uColor: { value: new THREE.Color(preset.sunGlow) } },
      vertexShader: /* glsl */ `
        attribute float aSeed; varying vec2 vUv; varying float vSeed; varying float vFade;
        void main(){
          vUv = uv; vSeed = aSeed;
          vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
          vec3 n = normalize(mat3(modelViewMatrix * instanceMatrix) * vec3(0.0, 0.0, 1.0));
          vFade = abs(n.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec3 uColor; varying vec2 vUv; varying float vSeed; varying float vFade;
        void main(){
          float across = sin(vUv.x * 3.14159);
          float along = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
          float flick = 0.6 + 0.4 * sin(uTime * 0.7 + vSeed * 13.0) * sin(uTime * 0.31 + vSeed);
          float a = pow(across, 2.0) * along * flick * 0.045 * vFade;
          gl_FragColor = vec4(uColor * a, a);
        }`,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const seeds = new Float32Array(count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    for (let i = 0; i < count; i++) {
      const base = new THREE.Vector3((rnd() - 0.5) * 2.4, 0, -0.6 + rnd() * 1.4);
      const face = new THREE.Quaternion().setFromAxisAngle(dir, rnd() * Math.PI);
      m.compose(base, face.multiply(q), new THREE.Vector3(0.12 + rnd() * 0.2, 4, 1));
      mesh.setMatrixAt(i, m);
      seeds[i] = rnd();
    }
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    mesh.frustumCulled = false;
    mesh.renderOrder = 6;
    return { mesh };
  }, [preset, count]);
  return <primitive object={res.mesh} />;
}

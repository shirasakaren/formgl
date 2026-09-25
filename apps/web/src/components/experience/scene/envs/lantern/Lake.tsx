'use client';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { anim, type Quality } from '../../../store';
import { windUniforms } from '../../Ground';
import { merge } from '../../geometry';
import { mulberry32 } from '../../noise';
import { bob, FAR_LANTERNS, lanternUniforms, MOON_DIR } from './lake';

/* ───────────────────────── water ───────────────────────── */

const WATER_VERT = /* glsl */ `
  varying vec3 vW;
  void main() { vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }
`;

const WATER_FRAG = /* glsl */ `
  uniform float uTime; uniform vec3 uDeep; uniform vec3 uSky; uniform vec3 uHorizon; uniform vec3 uMoon; uniform vec3 uMoonCol; uniform vec3 uWarm;
  uniform vec4 uLanterns[8]; uniform vec4 uRipple;
  varying vec3 vW;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
  void main() {
    vec3 v = normalize(cameraPosition - vW);
    float dist = length(vW.xz - cameraPosition.xz);
    // small wind ripples, calmer far away (and a set of rings where the lantern moves)
    vec2 p = vW.xz;
    float e = 0.05;
    float r0 = n(p * 3.0 + uTime * 0.25) + n(p * 7.0 - uTime * 0.35) * 0.5;
    float rx = n((p + vec2(e, 0.0)) * 3.0 + uTime * 0.25) + n((p + vec2(e, 0.0)) * 7.0 - uTime * 0.35) * 0.5;
    float rz = n((p + vec2(0.0, e)) * 3.0 + uTime * 0.25) + n((p + vec2(0.0, e)) * 7.0 - uTime * 0.35) * 0.5;
    float calm = 1.0 / (1.0 + dist * 0.08);
    vec2 grad = vec2(rx - r0, rz - r0) / e * 0.018 * calm;
    float rd = length(p - uRipple.xy);
    float age = uTime - uRipple.z;
    float ring = sin(rd * 38.0 - age * 6.0) * exp(-rd * 3.0) * exp(-age * 0.7) * uRipple.w * step(0.0, age);
    grad += normalize(p - uRipple.xy + 0.0001) * ring * 0.08;
    vec3 nrm = normalize(vec3(-grad.x, 1.0, -grad.y));
    float fres = 0.04 + 0.96 * pow(1.0 - max(dot(nrm, v), 0.0), 5.0);
    vec3 r = reflect(-v, nrm);
    // reflected sky: dark overhead, glowing horizon
    vec3 sky = mix(uHorizon, uSky, smoothstep(0.0, 0.35, r.y));
    vec3 col = mix(uDeep, sky, fres);
    // the moon's path on the water
    float m = max(dot(r, uMoon), 0.0);
    float glint = smoothstep(0.62, 0.85, n(p * 48.0 + vec2(uTime * 0.6, -uTime * 0.4))) * smoothstep(4.0, 14.0, dist);
    col += uMoonCol * (pow(m, 900.0) * 3.0 + pow(m, 60.0) * 0.5 * glint + pow(m, 12.0) * 0.04);
    // warm reflections of every lantern: long streaks stretched toward us
    for (int i = 0; i < 8; i++) {
      vec4 L = uLanterns[i];
      if (L.w <= 0.0) continue;
      vec3 toL = L.xyz - vW;
      vec2 d = toL.xz;
      vec3 toC = normalize(cameraPosition - L.xyz);
      vec2 across = normalize(vec2(-toC.z, toC.x));
      float side = dot(d, across);
      float along = dot(d, -normalize(toC.xz));
      float streak = exp(-side * side * 28.0 / (0.3 + L.y + abs(along) * 0.6)) * exp(-max(along, 0.0) * 0.35) * smoothstep(-0.3, 0.05, along);
      float pool = exp(-dot(d, d) * 9.0);
      float wob = 0.65 + 0.35 * n(vec2(side * 30.0, along * 6.0) + uTime * 1.3);
      col += uWarm * L.w * (streak * 0.55 * wob + pool * 0.35) * (0.4 + fres);
    }
    col = mix(col, uHorizon * 0.9, smoothstep(30.0, 240.0, dist) * 0.8);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function Water({ sky, horizon, deep }: { sky: string; horizon: string; deep: string }) {
  const mesh = useMemo(() => {
    const geo = new THREE.CircleGeometry(600, 48);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: windUniforms.uTime,
        uDeep: { value: new THREE.Color(deep) },
        uSky: { value: new THREE.Color(sky) },
        uHorizon: { value: new THREE.Color(horizon) },
        uMoon: { value: MOON_DIR.clone() },
        uMoonCol: { value: new THREE.Color('#dfe8ff') },
        uWarm: { value: new THREE.Color(1.0, 0.62, 0.3) },
        ...lanternUniforms,
      },
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
    });
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = false;
    m.frustumCulled = false;
    return m;
  }, [sky, horizon, deep]);
  return <primitive object={mesh} />;
}

/* ───────────────────────── stars & moon ───────────────────────── */

export function Stars({ quality }: { quality: Quality }) {
  const pts = useMemo(() => {
    const rnd = mulberry32(31);
    const n = quality === 'low' ? 700 : 1500;
    const pos = new Float32Array(n * 3);
    const data = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      // upper hemisphere, denser toward the zenith
      const u = rnd();
      const y = 0.05 + Math.pow(u, 0.7) * 0.95;
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(a) * r * 380, y * 380, Math.sin(a) * r * 380], i * 3);
      data.set([rnd(), 0.6 + Math.pow(rnd(), 4) * 2.4], i * 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aData', new THREE.BufferAttribute(data, 2));
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: windUniforms.uTime },
      vertexShader: /* glsl */ `
        attribute vec2 aData; uniform float uTime; varying float vA;
        void main() {
          vA = (0.55 + 0.45 * sin(uTime * (1.0 + aData.x * 2.0) + aData.x * 40.0)) * smoothstep(0.0, 60.0, position.y);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aData.y;
          gl_Position = projectionMatrix * mv;
          gl_Position.z = gl_Position.w * 0.9999;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(vec3(0.92, 0.95, 1.0) * a, a); }`,
    });
    const p = new THREE.Points(g, m);
    p.frustumCulled = false;
    p.renderOrder = -5;
    return p;
  }, [quality]);
  return <primitive object={pts} />;
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.2, 'rgba(255,255,255,0.55)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function Moon() {
  const res = useMemo(() => {
    const glow = glowTexture();
    const disc = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.6, 1.55), fog: false, toneMapped: true });
    const halo = new THREE.SpriteMaterial({ map: glow, color: '#9fb3e8', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0.8 });
    return { disc, halo };
  }, []);
  const p = MOON_DIR.clone().multiplyScalar(300);
  return (
    <group position={p}>
      <mesh material={res.disc} renderOrder={-4}>
        <sphereGeometry args={[6, 24, 16]} />
      </mesh>
      <sprite material={res.halo} scale={70} renderOrder={-4} />
    </group>
  );
}

/* ───────────────────────── far shore ───────────────────────── */

export function Shore({ color }: { color: string }) {
  const res = useMemo(() => {
    const rnd = mulberry32(12);
    const hillMat = new THREE.MeshBasicMaterial({ color, fog: true });
    const hills: THREE.BufferGeometry[] = [];
    for (const [dist, height, seed] of [
      [140, 16, 1],
      [95, 9, 2],
    ] as const) {
      const shape = new THREE.Shape();
      const w = 520;
      shape.moveTo(-w / 2, -2);
      const r = mulberry32(seed * 7);
      for (let x = -w / 2; x <= w / 2; x += 8) shape.lineTo(x, height * (0.35 + 0.65 * Math.abs(Math.sin(x * 0.012 + seed) * 0.7 + Math.sin(x * 0.031 + seed * 2) * 0.3)) + r() * 1.5);
      shape.lineTo(w / 2, -2);
      const g = new THREE.ShapeGeometry(shape);
      g.translate(0, 0, -dist);
      hills.push(g);
    }
    // a line of pines along the near shore
    // tiered pine silhouette: three stacked cones and a bit of trunk
    const tree = merge([
      new THREE.CylinderGeometry(0.08, 0.1, 0.8, 5).translate(0, 0.4, 0),
      new THREE.ConeGeometry(0.9, 1.5, 7).translate(0, 1.2, 0),
      new THREE.ConeGeometry(0.7, 1.3, 7).translate(0, 1.95, 0),
      new THREE.ConeGeometry(0.45, 1.1, 7).translate(0, 2.65, 0),
    ]);
    const pines: THREE.Matrix4[] = [];
    const q = new THREE.Quaternion();
    for (let i = 0; i < 150; i++) {
      const x = -130 + rnd() * 260;
      const z = -50 - rnd() * 22;
      // taller in clumps, thinning out toward the middle where the lake opens up
      const clump = 0.6 + 0.4 * Math.abs(Math.sin(x * 0.05 + 1.3));
      const s = (1.1 + rnd() * 1.6) * clump * (Math.abs(x) < 18 ? 0.7 : 1);
      q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), (rnd() - 0.5) * 0.06);
      pines.push(new THREE.Matrix4().compose(new THREE.Vector3(x, -0.3, z), q, new THREE.Vector3(s * (0.7 + rnd() * 0.3), s, s * 0.8)));
    }
    const pineMesh = new THREE.InstancedMesh(tree, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(0.7), fog: true }), pines.length);
    pines.forEach((m, i) => pineMesh.setMatrixAt(i, m));
    pineMesh.frustumCulled = false;
    return { hillMat, hills, pineMesh };
  }, [color]);
  return (
    <>
      {res.hills.map((g, i) => (
        <mesh key={i} geometry={g} material={res.hillMat} renderOrder={-3} />
      ))}
      <primitive object={res.pineMesh} />
    </>
  );
}

/* ───────────────────────── other lanterns ───────────────────────── */

/** lanterns set adrift by others, far out on the lake; they rise with ours when a reply is sent */
export function FarLanterns({ paper }: { paper: string }) {
  const group = useRef<THREE.Group>(null!);
  const res = useMemo(() => {
    const body = new THREE.BoxGeometry(0.3, 0.34, 0.3);
    body.translate(0, 0.2, 0);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(paper).multiply(new THREE.Color(1.3, 0.72, 0.36)).multiplyScalar(1.25) });
    const glow = new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffb35c', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 });
    return { body, mat, glow };
  }, [paper]);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    const g = group.current;
    if (!g) return;
    const F = anim.flyAway;
    g.children.forEach((c, i) => {
      const [x, z, ph] = FAR_LANTERNS[i];
      // released together with ours, each a little later
      const k = Math.max(0, Math.min(1, (F - 0.12 - i * 0.05) / 0.8));
      const lift = k * k * (18 + i * 2);
      c.position.set(x + Math.sin(t * 0.2 + ph) * 0.4 + k * Math.sin(ph) * 3, bob(t, ph) + lift, z - k * 4);
      c.rotation.y = t * 0.1 + ph;
      const L = lanternUniforms.uLanterns.value[i + 1];
      L.set(c.position.x, c.position.y, c.position.z, (0.9 + 0.1 * Math.sin(t * 7 + ph * 5)) * Math.max(0, 1 - lift / 6) * 0.8);
    });
  });
  return (
    <group ref={group}>
      {FAR_LANTERNS.map(([, , ph], i) => (
        <group key={i}>
          <mesh geometry={res.body} material={res.mat} />
          <sprite material={res.glow} scale={[1.5 + (ph % 1) * 0.4, 1.0, 1]} position={[0, 0.34, 0]} />
        </group>
      ))}
    </group>
  );
}

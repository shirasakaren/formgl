'use client';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Quality } from '../../../store';
import type { SceneAssets } from '../../assets';
import { merge } from '../../geometry';
import { windUniforms } from '../../Ground';
import { mulberry32 } from '../../noise';
import { DOCK } from './lake';

/** The old wooden jetty we stand on, with its posts, a coil of rope and a lantern hook. */
export function Dock({ assets, quality }: { assets: SceneAssets; quality: Quality }) {
  const res = useMemo(() => {
    const map = assets.env.dock.clone();
    const nrm = assets.env.dockNormal.clone();
    const rough = assets.env.dockRough.clone();
    for (const t of [map, nrm, rough]) {
      // the strip is drawn at plank proportions (8:1), so one repeat per plank; sharp at grazing angles
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      t.needsUpdate = true;
    }
    const wood = new THREE.MeshStandardMaterial({ map, normalMap: nrm, normalScale: new THREE.Vector2(0.4, 0.4), roughnessMap: rough, roughness: 0.9, color: '#a79a8c' });
    const rnd = mulberry32(5);
    // planks run across the jetty, with small gaps and a little unevenness
    const planks: THREE.BufferGeometry[] = [];
    const pw = 0.14;
    for (let z = DOCK.zEnd; z < DOCK.zStart; z += pw + 0.012) {
      const g = new THREE.BoxGeometry(DOCK.x1 - DOCK.x0 + (rnd() - 0.5) * 0.04, 0.035, pw);
      g.rotateY((rnd() - 0.5) * 0.02);
      g.translate((rnd() - 0.5) * 0.02, DOCK.y - 0.0175 + (rnd() - 0.5) * 0.006, z + pw / 2);
      // shift UVs so the grain differs per plank
      const uv = g.attributes.uv as THREE.BufferAttribute;
      const o = rnd();
      const ou = rnd();
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.9 + ou * 0.1, uv.getY(i) * 0.9 + o);
      planks.push(g);
    }
    const beams = merge([
      new THREE.BoxGeometry(0.08, 0.1, DOCK.zStart - DOCK.zEnd).translate(DOCK.x0 + 0.1, DOCK.y - 0.085, (DOCK.zStart + DOCK.zEnd) / 2),
      new THREE.BoxGeometry(0.08, 0.1, DOCK.zStart - DOCK.zEnd).translate(DOCK.x1 - 0.1, DOCK.y - 0.085, (DOCK.zStart + DOCK.zEnd) / 2),
    ]);
    const posts: THREE.BufferGeometry[] = [];
    for (const z of [DOCK.zEnd + 0.06, DOCK.zEnd + 1.3, DOCK.zEnd + 2.6])
      for (const x of [DOCK.x0 + 0.04, DOCK.x1 - 0.04]) {
        const tall = z < DOCK.zEnd + 0.1;
        const h = tall ? DOCK.y + 0.6 : DOCK.y + 0.3;
        posts.push(new THREE.CylinderGeometry(0.045, 0.05, h, 10).translate(x, h / 2 - 0.3, z));
      }
    const rope = new THREE.TorusGeometry(0.085, 0.014, 8, 32);
    rope.rotateX(Math.PI / 2);
    const rope2 = rope.clone().scale(0.8, 1, 0.8).translate(0, 0.022, 0);
    const ropeGeo = merge([rope, rope2]);
    const ropeMat = new THREE.MeshStandardMaterial({ color: '#8c7a5c', roughness: 1 });
    const wrap = new THREE.TorusGeometry(0.052, 0.01, 6, 20).rotateX(Math.PI / 2);
    return { wood, planks: merge(planks), beams, posts: merge(posts), ropeGeo, ropeMat, wrap };
  }, [assets]);
  const shadows = quality !== 'low';
  return (
    <>
      <mesh geometry={res.planks} material={res.wood} receiveShadow castShadow={shadows} />
      <mesh geometry={res.beams} material={res.wood} castShadow={shadows} />
      <mesh geometry={res.posts} material={res.wood} castShadow={shadows} receiveShadow />
      <mesh geometry={res.ropeGeo} material={res.ropeMat} position={[DOCK.x1 - 0.22, DOCK.y + 0.014, DOCK.zEnd + 0.55]} castShadow={shadows} receiveShadow />
      {[0.72, 0.76].map((y) => (
        <mesh key={y} geometry={res.wrap} material={res.ropeMat} position={[DOCK.x0 + 0.04, y, DOCK.zEnd + 0.06]} />
      ))}
    </>
  );
}

/** Reeds and lily pads around the jetty, swaying in the night breeze. */
export function Reeds({ quality }: { quality: Quality }) {
  const res = useMemo(() => {
    const rnd = mulberry32(9);
    const n = quality === 'low' ? 260 : 620;
    const blade = new THREE.PlaneGeometry(0.02, 1, 1, 4);
    blade.translate(0, 0.5, 0);
    const mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: { uTime: windUniforms.uTime, uWind: windUniforms.uWind, uBase: { value: new THREE.Color('#0b120e') }, uTip: { value: new THREE.Color('#27331f') } },
      vertexShader: /* glsl */ `
        uniform float uTime; uniform float uWind; varying float vH;
        void main() {
          vec3 p = position;
          vH = uv.y;
          vec4 w = instanceMatrix * vec4(p, 1.0);
          float ph = instanceMatrix[3].x * 3.1 + instanceMatrix[3].z * 1.7;
          float bend = pow(uv.y, 2.0) * (0.05 + uWind * 0.08);
          w.x += sin(uTime * 1.3 + ph) * bend;
          w.z += cos(uTime * 1.1 + ph) * bend * 0.5;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uBase; uniform vec3 uTip; varying float vH;
        void main() { gl_FragColor = vec4(mix(uBase, uTip, vH), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const reeds = new THREE.InstancedMesh(blade, mat, n);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    let k = 0;
    for (let i = 0; i < n; i++) {
      // clumps either side of the jetty and along the near bank
      const side = rnd() < 0.5 ? -1 : 1;
      const clump = Math.floor(rnd() * 6);
      const cx = side * (1.0 + clump * 0.35 + rnd() * 0.25);
      const cz = -0.8 + clump * 0.45 + rnd() * 0.4;
      q.setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.25, rnd() * Math.PI, (rnd() - 0.5) * 0.25));
      m.compose(new THREE.Vector3(cx + (rnd() - 0.5) * 0.3, -0.05, cz + (rnd() - 0.5) * 0.3), q, new THREE.Vector3(1, 0.5 + rnd() * 0.9, 1));
      reeds.setMatrixAt(k++, m);
    }
    reeds.count = k;
    reeds.frustumCulled = false;
    // lily pads
    const pad = new THREE.CircleGeometry(0.11, 18, 0.3, Math.PI * 2 - 0.6);
    pad.rotateX(-Math.PI / 2);
    const padMat = new THREE.MeshStandardMaterial({ color: '#27402c', roughness: 0.5 });
    const pads = new THREE.InstancedMesh(pad, padMat, 24);
    for (let i = 0; i < 24; i++) {
      const side = i % 2 ? -1 : 1;
      m.compose(new THREE.Vector3(side * (0.9 + rnd() * 1.6), 0.004, -1.6 + rnd() * 2.2), q.setFromEuler(new THREE.Euler(0, rnd() * 6, 0)), new THREE.Vector3(1, 1, 1).multiplyScalar(0.6 + rnd() * 0.8));
      pads.setMatrixAt(i, m);
    }
    pads.receiveShadow = true;
    return { reeds, pads };
  }, [quality]);
  return (
    <>
      <primitive object={res.reeds} />
      <primitive object={res.pads} />
    </>
  );
}

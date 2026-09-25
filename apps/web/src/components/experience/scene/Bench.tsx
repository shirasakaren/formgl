'use client';
import { useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { SceneAssets } from './assets';
import { extrudeStroke, merge, sampleBezier, type P2 } from './geometry';

export const BENCH = {
  seatY: 0.45,
  length: 1.64,
  frameX: [-0.72, 0, 0.72],
};

const SLAT = { w: 0.068, t: 0.028, gap: 0.012 };

function sideFrame(withArm: boolean) {
  const W = 0.026;
  const D = 0.034;
  const parts: THREE.BufferGeometry[] = [];
  // front leg with a softly flared foot
  parts.push(extrudeStroke(sampleBezier([0.25, 0.012], [0.21, 0.06], [0.2, 0.25], [0.2, 0.43]), W, D, 0.006, [1.5, 1]));
  // rear leg sweeping up into the backrest support
  const rear: P2[] = [
    ...sampleBezier([-0.3, 0.012], [-0.24, 0.12], [-0.19, 0.3], [-0.19, 0.43], 14),
    ...sampleBezier([-0.19, 0.43], [-0.19, 0.53], [-0.23, 0.66], [-0.28, 0.815], 14).slice(1),
  ];
  parts.push(extrudeStroke(rear, W, D, 0.006, [1.5, 0.8]));
  // seat rail
  parts.push(extrudeStroke(sampleBezier([0.23, 0.424], [0.1, 0.416], [-0.1, 0.416], [-0.2, 0.424], 10), 0.022, D * 0.9, 0.004));
  // lower stretcher with an S-scroll
  parts.push(extrudeStroke(sampleBezier([0.205, 0.13], [0.08, 0.22], [-0.08, 0.06], [-0.23, 0.15], 18), 0.016, D * 0.8, 0.004));
  // decorative scroll under the seat
  const scroll: P2[] = [];
  for (let i = 0; i <= 28; i++) {
    const a = (i / 28) * Math.PI * 2.1;
    const r = 0.055 * (1 - i / 34);
    scroll.push([0.02 + Math.cos(a + 1.2) * r, 0.33 + Math.sin(a + 1.2) * r]);
  }
  parts.push(extrudeStroke(scroll, 0.013, D * 0.75, 0.003, [1, 0.6]));
  if (withArm) {
    const arm: P2[] = [
      ...sampleBezier([-0.235, 0.66], [-0.1, 0.7], [0.12, 0.69], [0.24, 0.65], 16),
      ...sampleBezier([0.24, 0.65], [0.31, 0.62], [0.27, 0.54], [0.2, 0.44], 12).slice(1),
    ];
    parts.push(extrudeStroke(arm, 0.03, D * 1.1, 0.008));
    // curl at the front of the armrest
    const curl: P2[] = [];
    for (let i = 0; i <= 20; i++) {
      const a = (i / 20) * Math.PI * 1.8;
      const r = 0.03 * (1 - i / 26);
      curl.push([0.26 + Math.cos(-a + 0.3) * r, 0.6 + Math.sin(-a + 0.3) * r]);
    }
    parts.push(extrudeStroke(curl, 0.014, D, 0.004));
  }
  const g = merge(parts);
  // profile is in (z, y); rotate so extrusion runs along world X
  g.rotateY(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

export function Bench({ assets }: { assets: SceneAssets }) {
  const { slats, iron, bolts, ironGeoArm, ironGeo } = useMemo(() => {
    const slatGeo = new RoundedBoxGeometry(BENCH.length, SLAT.t, SLAT.w, 3, 0.008);
    const mats: THREE.MeshStandardMaterial[] = [];
    const slats: Array<{ pos: [number, number, number]; rot: [number, number, number]; mat: THREE.MeshStandardMaterial }> = [];
    const makeMat = (i: number) => {
      const map = assets.wood.map.clone();
      const nm = assets.wood.normalMap.clone();
      const rm = assets.wood.roughnessMap.clone();
      for (const t of [map, nm, rm]) {
        t.offset.set((i * 0.37) % 1, (i * 0.21) % 1);
        t.repeat.set(i % 2 ? -1 : 1, 1);
        t.needsUpdate = true;
      }
      const m = new THREE.MeshStandardMaterial({
        map,
        normalMap: nm,
        roughnessMap: rm,
        roughness: 1,
        metalness: 0,
        normalScale: new THREE.Vector2(0.45, 0.45),
        color: new THREE.Color().setHSL(0.08, 0.1, 0.92 + (i % 3) * 0.03),
      });
      mats.push(m);
      return m;
    };
    // seat: 5 slats
    const n = 5;
    const depth = n * SLAT.w + (n - 1) * SLAT.gap;
    for (let i = 0; i < n; i++) {
      const z = depth / 2 - SLAT.w / 2 - i * (SLAT.w + SLAT.gap);
      const y = BENCH.seatY - SLAT.t / 2 - (i === 0 ? 0.002 : 0);
      slats.push({ pos: [0, y, z], rot: [i === 0 ? 0.08 : 0, 0, 0], mat: makeMat(i) });
    }
    // backrest: 3 slats following the frame's backrest support
    const back: Array<[number, number]> = [
      [0.565, -0.193],
      [0.66, -0.216],
      [0.755, -0.238],
    ];
    back.forEach(([y, z], i) => slats.push({ pos: [0, y, z], rot: [Math.PI / 2 - 0.235, 0, 0], mat: makeMat(i + 5) }));

    const iron = new THREE.MeshStandardMaterial({ color: '#2c302a', roughness: 0.42, metalness: 0.7 });
    // bolts (little domes) where slats meet frames
    const boltGeo = new THREE.SphereGeometry(0.0038, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const boltMat = new THREE.MeshStandardMaterial({ color: '#8a877c', roughness: 0.3, metalness: 0.9 });
    const bolts = new THREE.InstancedMesh(boltGeo, boltMat, slats.length * 3);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    let k = 0;
    slats.forEach((s) => {
      for (const x of BENCH.frameX) {
        const e = new THREE.Euler(...s.rot);
        q.setFromEuler(e);
        const up = new THREE.Vector3(0, SLAT.t / 2, 0).applyQuaternion(q);
        m4.compose(new THREE.Vector3(x, s.pos[1], s.pos[2]).add(up), q, new THREE.Vector3(1, 1, 1));
        bolts.setMatrixAt(k++, m4);
      }
    });
    bolts.castShadow = true;
    return { slats: { geo: slatGeo, list: slats }, iron, bolts, ironGeoArm: sideFrame(true), ironGeo: sideFrame(false) };
  }, [assets]);

  return (
    <group>
      {slats.list.map((s, i) => (
        <mesh key={i} geometry={slats.geo} material={s.mat} position={s.pos} rotation={s.rot} castShadow receiveShadow />
      ))}
      <mesh geometry={ironGeoArm} material={iron} position={[BENCH.frameX[0], 0, 0]} castShadow receiveShadow />
      <mesh geometry={ironGeoArm} material={iron} position={[BENCH.frameX[2], 0, 0]} castShadow receiveShadow />
      <mesh geometry={ironGeo} material={iron} position={[BENCH.frameX[1], 0, 0]} castShadow receiveShadow />
      <primitive object={bolts} />
    </group>
  );
}

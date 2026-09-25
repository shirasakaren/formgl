'use client';
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { type Quality } from '../store';
import type { SceneAssets } from './assets';
import { windMaterial, windUniforms } from './Ground';
import { mulberry32, ValueNoise } from './noise';

/** The old tree whose canopy casts the dappled light over the bench. */
function trunkGeometry() {
  const g = new THREE.CylinderGeometry(0.2, 0.34, 7, 40, 60, true);
  g.translate(0, 3.5, 0);
  const n = new ValueNoise(17);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x);
    const r = Math.hypot(v.x, v.z);
    const root = Math.exp(-v.y * 2.6) * (0.35 + 0.25 * Math.max(0, Math.sin(a * 4 + 1)) ** 2);
    const bark = (n.fbm(a * 3, v.y * 1.5, 3) - 0.5) * 0.08;
    const lean = v.y * v.y * 0.006;
    const nr = r * (1 + root + bark);
    p.setXYZ(i, Math.cos(a) * nr + lean, v.y, Math.sin(a) * nr);
  }
  g.computeVertexNormals();
  return g;
}

export function HeroTree({ assets }: { assets: SceneAssets }) {
  const res = useMemo(() => {
    const map = assets.bark.map.clone();
    map.repeat.set(3, 3);
    map.needsUpdate = true;
    const nm = assets.bark.normalMap.clone();
    nm.repeat.set(3, 3);
    nm.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({ map, normalMap: nm, normalScale: new THREE.Vector2(1.4, 1.4), roughness: 0.95 });
    return { geo: trunkGeometry(), mat };
  }, [assets]);
  return <mesh geometry={res.geo} material={res.mat} position={[-2.25, 0, -0.35]} castShadow receiveShadow />;
}

/**
 * A twig with leaves hanging in front of the lens (top corner). Heavily out
 * of focus, it frames the shot and sways in the wind.
 */
export function ForegroundBranch({ assets }: { assets: SceneAssets }) {
  const group = useRef<THREE.Group>(null!);
  const { camera, size } = useThree();
  const res = useMemo(() => {
    const rnd = mulberry32(8);
    const geo = new THREE.PlaneGeometry(0.038, 0.038);
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.5, 0.5 + uv.getY(i) * 0.5);
    const mat = windMaterial(new THREE.MeshStandardMaterial({ map: assets.leaves, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.7 }), 0.4);
    const count = 16;
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const x = -t * 0.075 + (rnd() - 0.5) * 0.03;
      const y = -t * t * 0.05 + (rnd() - 0.5) * 0.025 + 0.01;
      e.set(rnd() * 1.2 - 0.6, rnd() * 3, rnd() * 3);
      q.setFromEuler(e);
      const s = 0.7 + rnd() * 0.6;
      m.compose(new THREE.Vector3(x, y, (rnd() - 0.5) * 0.06), q, new THREE.Vector3(s, s, s));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, new THREE.Color().setHSL(0.24 + rnd() * 0.05, 0.4, 0.45 + rnd() * 0.2));
    }
    return { mesh };
  }, [assets]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const aspect = size.width / size.height;
    const t = windUniforms.uTime.value;
    const w = windUniforms.uWind.value;
    // anchor to the upper right corner of the view, 0.3m in front of the lens
    const d = 0.26;
    const cam = camera as THREE.PerspectiveCamera;
    const hh = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * d;
    const local = new THREE.Vector3(hh * aspect * 1.08, hh * 1.02, -d);
    g.position.copy(local.applyMatrix4(camera.matrixWorld));
    g.quaternion.copy(camera.quaternion);
    g.rotateZ(Math.sin(t * 0.7) * 0.05 * w - 0.2);
    g.rotateX(Math.sin(t * 0.5 + 1) * 0.04 * w);
  });

  return (
    <group ref={group}>
      <primitive object={res.mesh} />
    </group>
  );
}

/** Dandelion puffballs growing in the grass — a quiet echo of the intro. */
export function Dandelions({ assets, quality }: { assets: SceneAssets; quality: Quality }) {
  const res = useMemo(() => {
    const rnd = mulberry32(77);
    const spots: Array<[number, number, number]> = [
      [0.95, -0.72, 0.36],
      [1.12, -0.95, 0.3],
      [-0.9, -0.8, 0.33],
      [-1.35, -1.1, 0.28],
      [0.35, -1.25, 0.38],
      [1.6, -0.62, 0.26],
      [-0.4, -0.66, 0.24],
    ].slice(0, quality === 'low' ? 4 : 7) as Array<[number, number, number]>;
    const stemMat = new THREE.MeshStandardMaterial({ color: '#7d8f4c', roughness: 0.8 });
    const stems: THREE.BufferGeometry[] = [];
    const seedsPer = quality === 'low' ? 60 : 110;
    const seedGeo = new THREE.PlaneGeometry(0.02, 0.02);
    seedGeo.translate(0, 0.01, 0);
    const seedMat = new THREE.MeshStandardMaterial({
      map: assets.seed,
      transparent: true,
      alphaTest: 0.05,
      depthWrite: false,
      side: THREE.DoubleSide,
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 0.25,
      roughness: 0.6,
    });
    const seeds = new THREE.InstancedMesh(seedGeo, seedMat, spots.length * seedsPer);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    let k = 0;
    const heads: THREE.Vector3[] = [];
    spots.forEach(([x, z, h]) => {
      const bend = (rnd() - 0.5) * 0.08;
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x, 0, z), new THREE.Vector3(x + bend, h * 0.6, z), new THREE.Vector3(x + bend * 1.6, h, z + bend * 0.3));
      stems.push(new THREE.TubeGeometry(curve, 12, 0.0022, 5, false));
      const head = curve.getPoint(1);
      heads.push(head);
      for (let i = 0; i < seedsPer; i++) {
        // fibonacci sphere
        const y = 1 - (i / (seedsPer - 1)) * 2;
        const r = Math.sqrt(1 - y * y);
        const phi = i * 2.399963;
        const dir = new THREE.Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r).normalize();
        if (dir.y < -0.75) continue;
        q.setFromUnitVectors(up, dir);
        m.compose(head.clone().addScaledVector(dir, 0.003), q, new THREE.Vector3(1, 1, 1));
        seeds.setMatrixAt(k++, m);
      }
    });
    seeds.count = k;
    seeds.frustumCulled = false;
    const merged = stems.length ? stems : [];
    return { stems: merged, stemMat, seeds, heads };
  }, [assets, quality]);

  return (
    <group>
      {res.stems.map((g, i) => (
        <mesh key={i} geometry={g} material={res.stemMat} castShadow />
      ))}
      {res.heads.map((h, i) => (
        <mesh key={`c${i}`} position={h} material={res.stemMat}>
          <sphereGeometry args={[0.004, 8, 6]} />
        </mesh>
      ))}
      <primitive object={res.seeds} />
    </group>
  );
}

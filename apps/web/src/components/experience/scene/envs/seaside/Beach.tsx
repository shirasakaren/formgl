'use client';
import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Quality } from '../../../store';
import type { SceneAssets } from '../../assets';
import { mulberry32, ValueNoise } from '../../noise';
import type { LightPreset } from '../../presets';
import { sandY, shoreUniforms } from './shore';

/** The beach: sloping sand that darkens and glistens where the waves have been. */
export function Sand({ assets }: { assets: SceneAssets }) {
  const mesh = useMemo(() => {
    const geo = new THREE.PlaneGeometry(60, 40, 200, 160);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, 12);
    const p = geo.attributes.position as THREE.BufferAttribute;
    const n = new ValueNoise(21);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      // gentle dunes further up the beach, a smooth slope at the waterline
      const dune = Math.max(0, z - 2.5) * 0.05 * n.fbm(x * 0.15, z * 0.2, 3) + Math.max(0, z - 4) * 0.08;
      p.setY(i, sandY(z) + dune + (n.n2(x * 3, z * 3) - 0.5) * 0.002 * Math.min(1, Math.max(0, z)));
    }
    geo.computeVertexNormals();
    const map = assets.env.sand.clone();
    map.repeat.set(40, 26);
    map.needsUpdate = true;
    const nm = assets.env.sandNormal.clone();
    nm.repeat.set(40, 26);
    nm.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({ map, normalMap: nm, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.95 });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uWet = shoreUniforms.uWet;
      sh.uniforms.uLevel = shoreUniforms.uLevel;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldP;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldP; uniform float uWet; uniform float uLevel;')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           float wet = smoothstep(uWet + 0.003, uWet - 0.004, vWorldP.y);
           float under = smoothstep(uLevel + 0.002, uLevel - 0.004, vWorldP.y);
           diffuseColor.rgb *= mix(1.0, 0.68, wet);
           diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.8, 0.9, 0.92), under);`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
           roughnessFactor = mix(roughnessFactor, 0.28, smoothstep(uWet + 0.003, uWet - 0.004, vWorldP.y));`,
        );
    };
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    return m;
  }, [assets]);
  return <primitive object={mesh} />;
}

function scallopGeometry() {
  // a fan with ribs, gently cupped
  const g = new THREE.CircleGeometry(1, 28, Math.PI * 0.08, Math.PI * 0.84);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const a = Math.atan2(y, x);
    const r = Math.hypot(x, y);
    const rib = Math.cos(a * 18) * 0.035 * r;
    p.setZ(i, (1 - r * r) * 0.28 + rib);
  }
  g.computeVertexNormals();
  return g;
}

function conchGeometry() {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    pts.push(new THREE.Vector2(Math.sin(t * Math.PI) * (1 - t * 0.8) * 0.45 + 0.02, t * 1.6));
  }
  const g = new THREE.LatheGeometry(pts, 20);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const s = 1 + Math.sin(y * 9 + Math.atan2(p.getZ(i), p.getX(i))) * 0.06;
    p.setX(i, p.getX(i) * s);
    p.setZ(i, p.getZ(i) * s);
  }
  g.computeVertexNormals();
  return g;
}

function starGeometry() {
  const s = new THREE.Shape();
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 0.38 : 1;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.quadraticCurveTo(Math.cos(a - 0.3) * (r + 0.1), Math.sin(a - 0.3) * (r + 0.1), x, y);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 3, curveSegments: 6 });
  g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

/** Shells, pebbles, a starfish and a sun-bleached piece of driftwood near the bottle. */
export function ShoreProps({ assets, quality }: { assets: SceneAssets; quality: Quality }) {
  const res = useMemo(() => {
    const rnd = mulberry32(17);
    const shellMat = new THREE.MeshStandardMaterial({ map: assets.env.shell, roughness: 0.45, side: THREE.DoubleSide });
    const scallop = new THREE.InstancedMesh(scallopGeometry(), shellMat, 9);
    const conch = new THREE.InstancedMesh(conchGeometry(), new THREE.MeshStandardMaterial({ color: '#f1dccb', roughness: 0.4 }), 4);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const spots = (i: number): [number, number] => {
      const a = rnd() * Math.PI * 2;
      const r = 0.18 + rnd() * 0.9 + i * 0.03;
      return [0.05 + Math.cos(a) * r * 1.4, 0.34 + Math.sin(a) * r * 0.6];
    };
    for (let i = 0; i < scallop.count; i++) {
      const [x, z] = spots(i);
      e.set(-Math.PI / 2 + (rnd() - 0.5) * 0.5, rnd() * 6.28, 0, 'YXZ');
      q.setFromEuler(e);
      const s = 0.012 + rnd() * 0.014;
      m.compose(new THREE.Vector3(x, sandY(z) + 0.002, z), q, new THREE.Vector3(s, s, s));
      scallop.setMatrixAt(i, m);
      scallop.setColorAt(i, new THREE.Color().setHSL(0.03 + rnd() * 0.06, 0.45, 0.78 + rnd() * 0.12));
    }
    for (let i = 0; i < conch.count; i++) {
      const [x, z] = spots(i + 4);
      e.set(0, rnd() * 6.28, Math.PI / 2 - 0.2);
      q.setFromEuler(e);
      const s = 0.012 + rnd() * 0.008;
      m.compose(new THREE.Vector3(x, sandY(z) + s * 0.4, z), q, new THREE.Vector3(s, s, s));
      conch.setMatrixAt(i, m);
    }
    // pebbles
    const pebGeo = mergeVertices(new THREE.IcosahedronGeometry(1, 2));
    const pp = pebGeo.attributes.position as THREE.BufferAttribute;
    const n = new ValueNoise(4);
    for (let i = 0; i < pp.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pp, i);
      v.multiplyScalar(1 + (n.n2(v.x * 2 + 3, v.y * 2 + v.z) - 0.5) * 0.3);
      pp.setXYZ(i, v.x, v.y * 0.55, v.z);
    }
    pebGeo.computeVertexNormals();
    const pebCount = quality === 'low' ? 24 : 60;
    const pebbles = new THREE.InstancedMesh(pebGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55 }), pebCount);
    for (let i = 0; i < pebCount; i++) {
      const x = (rnd() - 0.5) * 3.2;
      const z = -0.3 + rnd() * 1.8;
      e.set(rnd() * 0.4, rnd() * 6.28, rnd() * 0.4);
      q.setFromEuler(e);
      const s = 0.004 + Math.pow(rnd(), 2) * 0.016;
      m.compose(new THREE.Vector3(x, sandY(z) + s * 0.2, z), q, new THREE.Vector3(s * (1 + rnd() * 0.4), s, s));
      pebbles.setMatrixAt(i, m);
      pebbles.setColorAt(i, new THREE.Color().setHSL(0.08, 0.08 + rnd() * 0.1, 0.35 + rnd() * 0.4));
    }
    // starfish
    const star = new THREE.InstancedMesh(starGeometry(), new THREE.MeshStandardMaterial({ color: '#e27d52', roughness: 0.75 }), 2);
    [[-0.22, 0.52, 0.03], [0.62, 0.9, 0.022]].forEach(([x, z, s], i) => {
      e.set(0, rnd() * 6.28, 0);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, sandY(z) + 0.002, z), q, new THREE.Vector3(s, s, s));
      star.setMatrixAt(i, m);
    });
    // driftwood: a bleached, knotted branch half buried behind the bottle
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.9, sandY(0.62) + 0.01, 0.62),
      new THREE.Vector3(-0.45, sandY(0.7) + 0.025, 0.7),
      new THREE.Vector3(-0.05, sandY(0.82) + 0.02, 0.82),
      new THREE.Vector3(0.25, sandY(0.95) + 0.012, 0.95),
    ]);
    const driftGeo = new THREE.TubeGeometry(curve, 40, 0.028, 10, false);
    const dp = driftGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < dp.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(dp, i);
      const k = 1 + (n.n2(v.x * 12, v.z * 12) - 0.5) * 0.25;
      dp.setY(i, (v.y - sandY(v.z)) * k + sandY(v.z));
    }
    driftGeo.computeVertexNormals();
    const dmap = assets.env.drift.clone();
    dmap.repeat.set(6, 1);
    dmap.needsUpdate = true;
    const driftMat = new THREE.MeshStandardMaterial({ map: dmap, normalMap: assets.env.driftNormal, color: '#d9d0c4', roughness: 0.9 });
    return { scallop, conch, pebbles, star, driftGeo, driftMat };
  }, [assets, quality]);
  return (
    <group>
      <primitive object={res.scallop} castShadow receiveShadow />
      <primitive object={res.conch} castShadow receiveShadow />
      <primitive object={res.pebbles} castShadow receiveShadow />
      <primitive object={res.star} castShadow receiveShadow />
      <mesh geometry={res.driftGeo} material={res.driftMat} castShadow receiveShadow />
    </group>
  );
}

/** Headlands on the horizon, a lighthouse and a sailboat far away. */
export function Horizon({ preset }: { preset: LightPreset }) {
  const res = useMemo(() => {
    const n = new ValueNoise(7);
    const hill = (w: number, h: number, seed: number) => {
      const g = new THREE.PlaneGeometry(w, h, 80, 1);
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i) / w + 0.5;
        if (p.getY(i) > 0) {
          const prof = Math.sin(x * Math.PI) ** 0.6 * (0.55 + n.fbm(x * 4 + seed, seed, 4) * 0.7);
          p.setY(i, -h / 2 + h * prof);
        }
      }
      return g;
    };
    const fog = new THREE.Color(preset.fog);
    const far = new THREE.MeshBasicMaterial({ color: new THREE.Color('#6f8a86').lerp(fog, 0.72), fog: false });
    const near = new THREE.MeshBasicMaterial({ color: new THREE.Color('#5d7a6d').lerp(fog, 0.55), fog: false });
    return { left: hill(110, 26, 1), right: hill(80, 16, 5), far, near };
  }, [preset]);
  return (
    <group>
      <mesh geometry={res.left} material={res.far} position={[-95, 3, -180]} />
      <mesh geometry={res.right} material={res.near} position={[80, 1, -150]} />
      {/* lighthouse on the left headland */}
      <group position={[-62, 11.5, -176]}>
        <mesh material={res.near} position={[0, 2.2, 0]}>
          <cylinderGeometry args={[0.55, 0.8, 4.4, 10]} />
        </mesh>
        <mesh position={[0, 4.7, 0]}>
          <cylinderGeometry args={[0.45, 0.45, 0.6, 10]} />
          <meshBasicMaterial color="#fff6d8" />
        </mesh>
      </group>
      {/* a small sailboat on the horizon */}
      <group position={[18, 0.3, -120]}>
        <mesh material={res.near}>
          <boxGeometry args={[2.4, 0.4, 0.6]} />
        </mesh>
        <mesh position={[0.2, 1.8, 0]}>
          <coneGeometry args={[0.9, 3.2, 3]} />
          <meshBasicMaterial color={new THREE.Color('#ffffff').lerp(new THREE.Color(preset.fog), 0.35)} />
        </mesh>
      </group>
    </group>
  );
}

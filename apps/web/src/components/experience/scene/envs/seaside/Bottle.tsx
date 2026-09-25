'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { anim, useExperience, type Quality } from '../../../store';
import { sfx } from '../../../audio';
import type { SceneAssets } from '../../assets';
import { sceneRefs } from '../../refs';
import { sealGeometries } from '../../seal';
import { ctx2d, makeCanvas, softBlur, toTexture } from '../../textures';
import { sandY, shoreUniforms } from './shore';

const PROFILE: Array<[number, number]> = [
  [0.0, 0.0], [0.024, 0.0], [0.031, 0.003], [0.034, 0.012], [0.034, 0.165], [0.032, 0.184], [0.024, 0.202],
  [0.0142, 0.217], [0.0124, 0.232], [0.0124, 0.246], [0.0146, 0.249], [0.0146, 0.254], [0.0119, 0.256],
];
const NECK_TOP = 0.254;
const R = 0.034;

const smooth = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

/** place a bottle whose local +Y is `axis`, rolled by `roll` around it */
function orient(q: THREE.Quaternion, axis: THREE.Vector3, roll: number) {
  q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().normalize());
  const r = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), roll);
  return q.multiply(r);
}

function shadowTex() {
  const c = makeCanvas(256, 128);
  const g = ctx2d(c);
  g.fillStyle = '#000';
  g.beginPath();
  g.ellipse(128, 64, 90, 22, 0, 0, Math.PI * 2);
  g.fill();
  return toTexture(softBlur(c, 10));
}

export const BOTTLE_REST = {
  pos: new THREE.Vector3(0.04, sandY(0.3) + R - 0.006, 0.3),
  axis: new THREE.Vector3(0.88, -0.035, -0.47).normalize(),
};

export function Bottle({ assets, sealColor, quality, onOpen }: { assets: SceneAssets; sealColor: string; quality: Quality; onOpen: () => void }) {
  const group = useRef<THREE.Group>(null!);
  const cork = useRef<THREE.Group>(null!);
  const shadow = useRef<THREE.Mesh>(null!);
  const grains = useRef<THREE.InstancedMesh>(null!);
  const { camera, size } = useThree();

  const res = useMemo(() => {
    const geo = new THREE.LatheGeometry(PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 48);
    // real refraction (transmission) re-renders the whole scene every frame: high quality only
    const glass =
      quality !== 'high'
        ? new THREE.MeshPhysicalMaterial({ color: '#cfe8e0', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.32, clearcoat: 1, envMapIntensity: 1.4, side: THREE.DoubleSide, depthWrite: false })
        : new THREE.MeshPhysicalMaterial({
            color: '#e4f4ef',
            roughness: 0.04,
            metalness: 0,
            transmission: 1,
            thickness: 0.006,
            ior: 1.5,
            attenuationColor: new THREE.Color('#b9e0d2'),
            attenuationDistance: 0.4,
            clearcoat: 0.6,
            clearcoatRoughness: 0.08,
            envMapIntensity: 0.8,
            specularIntensity: 1,
          });
    const corkMat = new THREE.MeshStandardMaterial({ map: assets.env.cork, roughness: 0.95 });
    const corkGeo = new THREE.CylinderGeometry(0.0128, 0.0112, 0.024, 20);
    const twine = new THREE.MeshStandardMaterial({ color: '#cdb892', roughness: 1 });
    const ring = new THREE.TorusGeometry(0.0132, 0.0011, 6, 28);
    ring.rotateX(Math.PI / 2);
    const seal = sealGeometries(0.0115, 23);
    const sealMat = new THREE.MeshPhysicalMaterial({
      color: sealColor,
      map: assets.seal.cavity,
      normalMap: assets.seal.normal,
      roughnessMap: assets.seal.rough,
      roughness: 1,
      clearcoat: 0.5,
      clearcoatRoughness: 0.3,
    });
    const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, opacity: 0.45, depthWrite: false, color: '#3b2a18' });
    const moundMat = new THREE.MeshStandardMaterial({ map: assets.env.sand, roughness: 1, color: '#d9c49c' });
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
    const grainGeo = new THREE.IcosahedronGeometry(0.0016, 0);
    return { geo, glass, corkMat, corkGeo, twine, ring, seal, sealMat, shadowMat, moundMat, hitMat, grainGeo };
  }, [assets, quality, sealColor]);

  const v = useMemo(
    () => ({
      p: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      q2: new THREE.Quaternion(),
      axis: new THREE.Vector3(),
      a1: new THREE.Vector3(),
      tip: new THREE.Vector3(),
      land: new THREE.Vector3(0.24, sandY(0.52) + 0.012, 0.52),
      m: new THREE.Matrix4(),
      s: new THREE.Vector3(1, 1, 1),
      grain: { fired: false, p: new Float32Array(90), v: new Float32Array(90) },
      e: new THREE.Euler(),
    }),
    [],
  );

  // the scroll rides inside the bottle, its axis along the bottle
  useEffect(() => {
    const local = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
    const off = new THREE.Vector3();
    sceneRefs.letterSource = (out) => {
      const g = group.current;
      if (!g) return;
      g.updateMatrixWorld();
      const s = anim.slide;
      off.set(0, 0.112 + s * 0.27, 0).applyMatrix4(g.matrixWorld);
      out.p.copy(off);
      out.q.copy(g.quaternion).multiply(local);
    };
    return () => {
      sceneRefs.letterSource = null;
    };
  }, []);

  useFrame((st, dt) => {
    const g = group.current;
    if (!g) return;
    const t = st.clock.elapsedTime;
    const phase = useExperience.getState().phase;
    const hoverTarget = phase === 'idle' && sceneRefs.pointerInside ? 1 : 0;
    anim.hover += (hoverTarget - anim.hover) * Math.min(1, dt * 6);
    const L = smooth(anim.lift);
    const S = smooth(anim.settle);
    const F = anim.flyAway;

    /* ── pose ── */
    const swash = shoreUniforms.uSwash.value;
    const rock = Math.max(0, swash - 0.55) * 2.2;
    v.p.copy(BOTTLE_REST.pos);
    v.axis.copy(BOTTLE_REST.axis);
    let roll = 0.4 + Math.sin(t * 2.1) * 0.06 * rock + anim.hover * 0.08;
    v.p.y += anim.hover * 0.004;
    // held up toward the camera, neck raised
    v.a1.set(0.5, 0.78, 0.22).normalize();
    v.p.lerp(v.tip.set(-0.01, 0.12, 0.48), L);
    v.axis.lerp(v.a1, L).normalize();
    v.p.y += Math.sin(L * Math.PI) * 0.03;
    roll += L * 0.6;
    // laid back down in the sand, a little further up the beach
    if (S > 0) {
      v.p.lerp(v.tip.set(-0.16, sandY(0.38) + R - 0.004, 0.38), S);
      v.p.y += Math.sin(S * Math.PI) * 0.04;
      v.axis.lerp(v.a1.set(-0.9, -0.04, -0.42).normalize(), S).normalize();
    }
    // handed to the sea: carried off, bobbing, toward the horizon
    if (F > 0) {
      const k1 = smooth(F * 2.2);
      const k2 = Math.max(0, (F - 0.3) / 0.7);
      v.p.lerp(v.tip.set(0.08, shoreUniforms.uLevel.value + 0.012, -0.25), k1);
      v.p.z -= k2 * k2 * 9;
      v.p.x += k2 * 1.2;
      v.p.y = THREE.MathUtils.lerp(v.p.y, shoreUniforms.uLevel.value + 0.01 + Math.sin(t * 2.2) * 0.012, k1);
      v.axis.lerp(v.a1.set(0.95, 0.06 + Math.sin(t * 1.7) * 0.05, -0.3).normalize(), k1).normalize();
      roll += Math.sin(t * 1.3) * 0.3 * k1;
    }
    orient(v.q, v.axis, roll);
    g.position.copy(v.p);
    g.quaternion.copy(v.q);
    g.updateMatrixWorld();

    /* ── cork: twist, pop, fly into the sand (and back when sending) ── */
    const c = anim.fx.cork ?? 0;
    const ck = cork.current;
    const twist = Math.min(c, 0.6) / 0.6;
    if (c <= 0.6) {
      // seated in the neck, twisting loose
      v.tip.set(0, NECK_TOP + 0.001 + twist * 0.006, 0).applyMatrix4(g.matrixWorld);
      ck.position.copy(v.tip);
      v.q2.setFromAxisAngle(v.a1.set(0, 1, 0), twist * Math.PI * 4);
      ck.quaternion.copy(g.quaternion).multiply(v.q2);
    } else {
      // world-space arc from the neck to its landing spot on the sand
      const f = smooth((c - 0.6) / 0.4);
      v.tip.set(0, NECK_TOP + 0.01, 0).applyMatrix4(g.matrixWorld);
      ck.position.lerpVectors(v.tip, v.land, f);
      ck.position.y += Math.sin(f * Math.PI) * 0.14;
      if (f > 0.98) v.e.set(Math.PI / 2, 0.6, 0);
      else v.e.set(f * 9, f * 5, f * 3);
      v.q2.setFromEuler(v.e);
      ck.quaternion.copy(g.quaternion).slerp(v.q2, f);
    }

    /* ── sand grains falling off as it is lifted ── */
    const gm = grains.current;
    if (anim.lift > 0.02 && !v.grain.fired) {
      v.grain.fired = true;
      for (let i = 0; i < 30; i++) {
        v.tip.set((Math.random() - 0.5) * 0.02, Math.random() * 0.2, (Math.random() - 0.5) * 0.02).applyMatrix4(g.matrixWorld);
        v.grain.p.set([v.tip.x, v.tip.y, v.tip.z], i * 3);
        v.grain.v.set([(Math.random() - 0.5) * 0.05, -Math.random() * 0.05, (Math.random() - 0.5) * 0.05], i * 3);
      }
    }
    if (anim.lift < 0.01) v.grain.fired = false;
    gm.visible = v.grain.fired && anim.lift < 1 && S < 0.01;
    if (gm.visible) {
      const d = Math.min(dt, 1 / 30);
      for (let i = 0; i < 30; i++) {
        const o = i * 3;
        v.grain.v[o + 1] -= 2.5 * d;
        for (let k = 0; k < 3; k++) v.grain.p[o + k] += v.grain.v[o + k] * d;
        const floor = sandY(v.grain.p[o + 2]) + 0.001;
        if (v.grain.p[o + 1] < floor) {
          v.grain.p[o + 1] = floor;
          v.grain.v[o] = v.grain.v[o + 1] = v.grain.v[o + 2] = 0;
        }
        v.m.makeTranslation(v.grain.p[o], v.grain.p[o + 1], v.grain.p[o + 2]);
        gm.setMatrixAt(i, v.m);
      }
      gm.instanceMatrix.needsUpdate = true;
    }

    /* ── contact shadow ── */
    const sh = shadow.current;
    const lifted = Math.max(0, v.p.y - (sandY(v.p.z) + R));
    sh.position.set(v.p.x + v.axis.x * 0.12, sandY(v.p.z) + 0.001, v.p.z + v.axis.z * 0.12);
    sh.rotation.set(-Math.PI / 2, 0, Math.atan2(v.axis.z, v.axis.x) * -1);
    const spread = 1 + lifted * 6;
    sh.scale.set(0.34 * spread, 0.1 * spread, 1);
    (sh.material as THREE.MeshBasicMaterial).opacity = (0.45 / (spread * spread)) * (1 - Math.min(1, F * 3));

    /* ── hint ── */
    v.tip.set(0, 0.12, 0).applyMatrix4(g.matrixWorld).project(camera);
    sceneRefs.hint.x = (v.tip.x * 0.5 + 0.5) * size.width;
    sceneRefs.hint.y = (-v.tip.y * 0.5 + 0.5) * size.height;
    sceneRefs.hint.visible = phase === 'idle';
  });

  const onOver = (ev: ThreeEvent<PointerEvent>) => {
    ev.stopPropagation();
    if (useExperience.getState().phase !== 'idle') return;
    sceneRefs.pointerInside = true;
    document.body.style.cursor = 'pointer';
    sfx.hover();
  };
  const onOut = () => {
    sceneRefs.pointerInside = false;
    document.body.style.cursor = '';
  };
  const onClick = (ev: ThreeEvent<MouseEvent>) => {
    ev.stopPropagation();
    if (useExperience.getState().phase !== 'idle') return;
    sceneRefs.pointerInside = false;
    document.body.style.cursor = '';
    onOpen();
  };

  return (
    <>
      <group ref={group}>
        <mesh geometry={res.geo} material={res.glass} castShadow renderOrder={3} />
        {/* twine wrapped around the neck */}
        {[0.229, 0.2335, 0.238].map((y) => (
          <mesh key={y} geometry={res.ring} material={res.twine} position={[0, y, 0]} castShadow />
        ))}
        <mesh material={res.twine} position={[0.012, 0.222, 0.004]} rotation={[0.2, 0, 0.35]}>
          <cylinderGeometry args={[0.0009, 0.0009, 0.03, 5]} />
        </mesh>
        <mesh material={res.hitMat} position={[0, 0.13, 0]} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
          <cylinderGeometry args={[0.07, 0.07, 0.34, 10]} />
        </mesh>
      </group>
      <group ref={cork}>
        <mesh geometry={res.corkGeo} material={res.corkMat} position={[0, 0.004, 0]} castShadow />
        <mesh geometry={res.seal.top} material={res.sealMat} position={[0, 0.0165, 0]} scale={[1, 0.7, 1]} castShadow />
        <mesh geometry={res.seal.bottom} material={res.sealMat} position={[0, 0.0165, 0]} scale={[1, 0.7, 1]} castShadow />
      </group>
      <instancedMesh ref={grains} args={[res.grainGeo, res.moundMat, 30]} visible={false} frustumCulled={false} />
      <mesh ref={shadow} material={res.shadowMat} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
      </mesh>
    </>
  );
}

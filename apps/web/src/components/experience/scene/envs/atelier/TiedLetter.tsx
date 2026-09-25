'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { anim, useExperience } from '../../../store';
import { sfx } from '../../../audio';
import { LETTER, type SceneAssets } from '../../assets';
import { sceneRefs } from '../../refs';
import { sealGeometries } from '../../seal';
import { LETTER_REST, pressedFlowerCanvas } from './room';

const LW = LETTER.w;
const LH = LETTER.h;
const HALF = LH / 4; // the folded letter is LW × LH/2, centred
const smooth = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};
const seg = (v: number, a: number, b: number) => smooth((v - a) / (b - a));

/**
 * A flat ribbon loop around a rectangle of half extents (hx, hz): the loop runs in the
 * X/Z plane of its own frame (x along the letter, z its thickness), its width along Y.
 */
function bandGeometry(hx: number, hz: number, width: number, r = 0.0016) {
  const pts: THREE.Vector2[] = [];
  const corner = (cx: number, cz: number, a0: number) => {
    for (let i = 0; i <= 4; i++) {
      const a = a0 + (i / 4) * (Math.PI / 2);
      pts.push(new THREE.Vector2(cx + Math.cos(a) * r, cz + Math.sin(a) * r));
    }
  };
  corner(hx - r, hz - r, 0);
  corner(-hx + r, hz - r, Math.PI / 2);
  corner(-hx + r, -hz + r, Math.PI);
  corner(hx - r, -hz + r, Math.PI * 1.5);
  pts.push(pts[0].clone());
  const pos: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    const pr = pts[(i - 1 + pts.length) % pts.length];
    const tx = q.x - pr.x;
    const tz = q.y - pr.y;
    const l = Math.hypot(tx, tz) || 1;
    // outward normal of the loop
    const nx = tz / l;
    const nz = -tx / l;
    pos.push(p.x, -width / 2, p.y, p.x, width / 2, p.y);
    nrm.push(nx, 0, nz, nx, 0, nz);
    if (i < pts.length - 1) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}

/** a bow: two loops and two tails, built from flat ribbon */
function bowGeometry(width: number) {
  const loops: THREE.BufferGeometry[] = [];
  const mk = (pts: THREE.Vector3[], flat = false) => {
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const n = 24;
    const pos: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = curve.getPoint(t);
      const tg = curve.getTangent(t);
      // ribbon width lies roughly along world-ish "up" of the bow plane
      const side = new THREE.Vector3(0, 0, 1).cross(tg).normalize().multiplyScalar(width / 2);
      const up = flat ? side : tg.clone().cross(side).normalize().multiplyScalar(width / 2);
      pos.push(p.x - up.x, p.y - up.y, p.z - up.z, p.x + up.x, p.y + up.y, p.z + up.z);
      if (i < n) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  for (const s of [-1, 1]) {
    loops.push(mk([V(0, 0, 0.001), V(s * 0.012, s * 0.006, 0.006), V(s * 0.026, s * 0.01, 0.004), V(s * 0.03, 0, 0.002), V(s * 0.024, -s * 0.008, 0.005), V(s * 0.01, -s * 0.004, 0.004), V(0, 0, 0.001)]));
  }
  const tails = [
    mk([V(0, 0, 0.001), V(0.006, -0.012, 0.002), V(0.012, -0.03, 0.0008), V(0.02, -0.048, 0.0004)], true),
    mk([V(0, 0, 0.001), V(-0.008, -0.014, 0.002), V(-0.01, -0.032, 0.0008), V(-0.018, -0.05, 0.0004)], true),
  ];
  return { loops, tails };
}

export function TiedLetter({ assets, ribbonColor, sealColor, onOpen }: { assets: SceneAssets; ribbonColor: string; sealColor: string; onOpen: () => void }) {
  const frame = useRef<THREE.Group>(null!);
  const bandA = useRef<THREE.Group>(null!);
  const bandB = useRef<THREE.Group>(null!);
  const bow = useRef<THREE.Group>(null!);
  const knot = useRef<THREE.Group>(null!);
  const flower = useRef<THREE.Mesh>(null!);
  const { camera, size } = useThree();

  const res = useMemo(() => {
    const W = 0.011;
    // band A runs along the letter's length (loop in local YZ), band B across it (loop in XZ)
    const a = bandGeometry(HALF + 0.001, 0.0022, W);
    a.rotateZ(Math.PI / 2); // x → y
    const b = bandGeometry(LW / 2 + 0.001, 0.0022, W);
    const ribbonMat = new THREE.MeshPhysicalMaterial({ color: ribbonColor, roughness: 0.4, sheen: 0.35, sheenColor: new THREE.Color(ribbonColor).lerp(new THREE.Color('#ffffff'), 0.3), sheenRoughness: 0.4, side: THREE.DoubleSide });
    const bw = bowGeometry(W * 0.95);
    const seal = sealGeometries(0.014, 31);
    const sealMat = new THREE.MeshPhysicalMaterial({ color: sealColor, map: assets.seal.cavity, normalMap: assets.seal.normal, roughnessMap: assets.seal.rough, roughness: 1, clearcoat: 0.5, clearcoatRoughness: 0.3 });
    const flowerMat = new THREE.MeshStandardMaterial({ map: pressedFlowerCanvas(), alphaTest: 0.3, roughness: 0.85, side: THREE.DoubleSide, transparent: false });
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
    return { a, b, ribbonMat, bw, seal, sealMat, flowerMat, hitMat };
  }, [assets, ribbonColor, sealColor]);

  const v = useMemo(
    () => ({
      qRest: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, LETTER_REST.yaw, 0, 'YXZ')),
      q: new THREE.Quaternion(),
      e: new THREE.Euler(0, 0, 0, 'YXZ'),
      p: new THREE.Vector3(),
      off: new THREE.Vector3(),
      tip: new THREE.Vector3(),
    }),
    [],
  );

  // the letter's own pose: lies on the blotter, lifts and tilts toward us with `slide`
  useEffect(() => {
    const e = new THREE.Euler(0, 0, 0, 'YXZ');
    const off = new THREE.Vector3();
    sceneRefs.letterSource = (out) => {
      const s = smooth(anim.slide);
      e.set(-Math.PI / 2 + s * 0.45, LETTER_REST.yaw * (1 - s), Math.sin(s * Math.PI) * 0.05);
      out.q.setFromEuler(e);
      out.p.copy(LETTER_REST.pos);
      out.p.y += anim.hover * 0.004 + s * 0.09;
      out.p.z += s * 0.06;
      // origin at the fold (the far edge): centre + HALF along the sheet's up
      off.set(0, HALF, 0).applyQuaternion(out.q);
      out.p.add(off);
    };
    return () => {
      sceneRefs.letterSource = null;
    };
  }, []);

  useFrame(() => {
    const g = frame.current;
    if (!g) return;
    const phase = useExperience.getState().phase;
    const hoverTarget = phase === 'idle' && sceneRefs.pointerInside ? 1 : 0;
    anim.hover += (hoverTarget - anim.hover) * 0.12;
    // ribbon & flower live in the resting frame (they are left on the desk)
    g.position.copy(LETTER_REST.pos);
    g.position.y += anim.hover * 0.004;
    g.quaternion.copy(v.qRest);

    const r = anim.fx.ribbon ?? 0;
    const sent = anim.flyAway > 0 || anim.fx.plane > 0;
    // the bow pulls undone
    const bu = seg(r, 0, 0.4);
    const bw = bow.current;
    bw.visible = bu < 0.99 && !sent;
    bw.scale.set(1 - bu * 0.8, 1 - bu * 0.95, 1 - bu * 0.5);
    bw.rotation.z = bu * 0.9;
    // bands loosen then slip off: A to the right, B toward the viewer — then lie flat on the desk
    const loosen = 1 + seg(r, 0.3, 0.5) * 0.12;
    const slideA = seg(r, 0.42, 0.85);
    const slideB = seg(r, 0.48, 0.9);
    const drop = (k: number) => seg(k, 0.55, 1);
    const A = bandA.current;
    A.position.set(-0.035 + slideA * (LW / 2 + 0.05), 0.01, 0.0012 - drop(slideA) * 0.0007);
    A.scale.set(loosen * (1 + slideA * 0.1), loosen, loosen * (1 - drop(slideA) * 0.7));
    A.rotation.z = slideA * 0.5;
    const B = bandB.current;
    B.position.set(-0.01 * slideB, 0.01 - slideB * (HALF + 0.06), 0.0012 - drop(slideB) * 0.0007);
    B.scale.set(loosen, loosen * (1 + slideB * 0.1), loosen * (1 - drop(slideB) * 0.7));
    B.rotation.z = -slideB * 0.35;
    A.visible = B.visible = !sent;
    // the seal & knot ride with band A
    const K = knot.current;
    K.position.set(A.position.x, 0.01 - slideA * 0.02, 0.0005 - drop(slideA) * 0.0012);
    K.rotation.z = slideA * 0.8;
    K.visible = !sent;
    // pressed flower lifts off and drifts to the left, landing on the desk
    const f = smooth(anim.fx.flower ?? 0);
    const fm = flower.current;
    fm.position.set(0.045 - f * 0.26, -0.035 - f * 0.05, 0.0035 + Math.sin(f * Math.PI) * 0.06 - f * 0.0033);
    fm.rotation.set(Math.sin(f * Math.PI) * 0.6, Math.sin(f * Math.PI) * 0.3, 0.5 + f * 1.4);
    fm.visible = !sent;

    /* hint over the bow */
    v.tip.set(-0.035, 0.01, 0.03).applyMatrix4(g.matrixWorld).project(camera);
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
    <group ref={frame}>
      <group ref={bandA}>
        <mesh geometry={res.a} material={res.ribbonMat} castShadow />
      </group>
      <group ref={bandB}>
        <mesh geometry={res.b} material={res.ribbonMat} castShadow />
      </group>
      <group ref={knot}>
        <group ref={bow} position={[0, 0, 0.0005]}>
          {res.bw.loops.map((g, i) => (
            <mesh key={i} geometry={g} material={res.ribbonMat} castShadow />
          ))}
          {res.bw.tails.map((g, i) => (
            <mesh key={`t${i}`} geometry={g} material={res.ribbonMat} castShadow />
          ))}
        </group>
        {/* the wax seal pressed over the knot */}
        <group position={[0, 0, 0.0035]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.6, 1]}>
          <mesh geometry={res.seal.top} material={res.sealMat} castShadow />
          <mesh geometry={res.seal.bottom} material={res.sealMat} />
        </group>
      </group>
      <mesh ref={flower} material={res.flowerMat} scale={[0.07, 0.07, 1]} castShadow>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh material={res.hitMat} position={[0, 0, 0.02]} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
        <boxGeometry args={[LW + 0.06, LH / 2 + 0.06, 0.06]} />
      </mesh>
    </group>
  );
}

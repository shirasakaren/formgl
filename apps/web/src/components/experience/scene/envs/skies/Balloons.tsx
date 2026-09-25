'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { anim, useExperience } from '../../../store';
import { sfx } from '../../../audio';
import { LETTER } from '../../assets';
import { ScrollPanel } from '../../bend';
import { sceneRefs } from '../../refs';
import { CATCH, HANG, PARTY_BALLOON, smooth, STRING } from './sky';

/** balloon offsets from the knot where the strings meet (above the scroll) */
const BUNCH: Array<[number, number, number]> = [
  [-0.13, 0.06, 0.02],
  [0.12, 0.1, 0.04],
  [0.0, 0.24, -0.06],
  [-0.06, 0.17, 0.12],
  [0.15, 0.27, -0.03],
];

/** where the scroll's roll axis is right now, before it is lifted to be read */
function sourcePose(t: number, out: { p: THREE.Vector3; q: THREE.Quaternion }, e: THREE.Euler) {
  const d = smooth(anim.fx.drift ?? 0);
  const inflate = anim.fx.inflate ?? 0;
  const F = anim.flyAway;
  // floating gently, less once it is in our hand
  const calm = 1 - d * 0.75;
  out.p.lerpVectors(HANG, CATCH, d);
  out.p.x += Math.sin(t * 0.5) * 0.025 * calm;
  out.p.y += Math.sin(t * 0.8) * 0.03 * calm + anim.hover * 0.02;
  out.p.z += Math.sin(t * 0.37 + 1) * 0.015 * calm;
  let yaw = Math.sin(t * 0.3) * 0.18 * calm - 0.15 * (1 - d);
  let roll = Math.sin(t * 0.7 + 0.5) * 0.06 * calm;
  if (inflate > 0 && F > 0) {
    // the reply, carried off by its new balloon: up and away toward the sun
    const k = F;
    out.p.x += k * 2.4 + Math.sin(t * 0.9) * 0.05 * k;
    out.p.y += k * k * 7 + k * 0.6;
    out.p.z -= k * 6;
    yaw += Math.sin(t * 0.8) * 0.3 * k;
    roll += Math.sin(t * 1.3) * 0.12 * k;
  }
  e.set(roll * 0.4, yaw, roll);
  out.q.setFromEuler(e);
}

export function Balloons({ palette, accent, onOpen }: { palette: string[]; accent: string; onOpen: () => void }) {
  const bunch = useRef<THREE.Group>(null!);
  const lines = useRef<THREE.LineSegments>(null!);
  const reply = useRef<THREE.Group>(null!);
  const replyLine = useRef<THREE.Line>(null!);
  const { camera, size } = useThree();

  const res = useMemo(() => {
    const geo = new THREE.LatheGeometry(PARTY_BALLOON.map(([r, y]) => new THREE.Vector2(r, y)), 36);
    const knot = new THREE.ConeGeometry(0.009, 0.014, 8).rotateX(Math.PI).translate(0, -0.004, 0);
    const mats = palette.map(
      (c) =>
        new THREE.MeshPhysicalMaterial({
          color: c,
          roughness: 0.22,
          clearcoat: 1,
          clearcoatRoughness: 0.12,
          sheen: 0.6,
          sheenColor: new THREE.Color(c).lerp(new THREE.Color('#ffffff'), 0.6),
          transparent: true,
          opacity: 0.94,
        }),
    );
    const replyMat = new THREE.MeshPhysicalMaterial({ color: accent, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1, sheen: 0.6, sheenColor: new THREE.Color(accent).lerp(new THREE.Color('#ffffff'), 0.6) });
    // strings: 3 segments each, from the knot down to the scroll
    const segs = BUNCH.length * 3;
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segs * 2 * 3), 3));
    const lineMat = new THREE.LineBasicMaterial({ color: '#f4efe8', transparent: true, opacity: 0.85 });
    const replyGeo = new THREE.BufferGeometry();
    replyGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(4 * 3), 3));
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
    // where the roll sits relative to the sheet centre (Letter3D keeps the roll at the source point)
    const sp = new ScrollPanel(LETTER.w, LETTER.h);
    const [cy, cz] = sp.rollCentre(0);
    sp.geometry.dispose();
    return { geo, knot, mats, replyMat, lineGeo, lineMat, replyGeo, hitMat, roll: new THREE.Vector3(0, cy, cz) };
  }, [palette, accent]);

  const v = useMemo(
    () => ({
      src: { p: new THREE.Vector3(), q: new THREE.Quaternion() },
      e: new THREE.Euler(0, 0, 0, 'YXZ'),
      knot: new THREE.Vector3(),
      a: new THREE.Vector3(),
      b: new THREE.Vector3(),
      tip: new THREE.Vector3(),
      rollW: new THREE.Vector3(),
      fall: BUNCH.map(() => new THREE.Vector3()),
    }),
    [],
  );

  useEffect(() => {
    const e = new THREE.Euler(0, 0, 0, 'YXZ');
    sceneRefs.letterSource = (out, t) => sourcePose(t, out, e);
    return () => {
      sceneRefs.letterSource = null;
    };
  }, []);

  useFrame((st, dt) => {
    const t = st.clock.elapsedTime;
    const phase = useExperience.getState().phase;
    const hoverTarget = phase === 'idle' && sceneRefs.pointerInside ? 1 : 0;
    anim.hover += (hoverTarget - anim.hover) * Math.min(1, dt * 6);
    sourcePose(t, v.src, v.e);
    const r = anim.fx.release ?? 0;
    const R = r * r;

    /* ── the bunch: tied above the scroll, then let go ── */
    const g = bunch.current;
    g.visible = r < 0.999;
    v.knot.copy(v.src.p).add(v.a.set(Math.sin(t * 0.6) * 0.02, STRING, 0));
    // released: rise, spread and drift toward the sun
    v.knot.x += R * 1.4 + r * 0.2;
    v.knot.y += R * 3.6 + r * 0.25;
    v.knot.z -= R * 2.2;
    g.position.copy(v.knot);
    const pos = res.lineGeo.attributes.position as THREE.BufferAttribute;
    let w = 0;
    g.children.forEach((c, i) => {
      if (i >= BUNCH.length) return;
      const [ox, oy, oz] = BUNCH[i];
      const spread = 1 + r * 1.2;
      c.position.set(ox * spread + Math.sin(t * 0.9 + i) * 0.01, oy * spread + Math.sin(t * 1.1 + i * 2) * 0.012 + r * i * 0.15, oz * spread);
      c.rotation.set(Math.sin(t * 0.7 + i) * 0.12 + ox, i, Math.sin(t * 0.5 + i) * 0.12 - ox * 1.4);
      c.updateMatrix();
      // string: from the balloon's knot down to the scroll (or dangling once released)
      v.a.set(0, 0, 0).applyMatrix4(c.matrix).add(g.position);
      if (r <= 0.001) v.b.copy(v.src.p);
      else {
        v.fall[i].set(v.a.x - 0.05 * r - Math.sin(t + i) * 0.03, v.a.y - STRING * (0.95 - r * 0.2), v.a.z + 0.04 * r);
        v.b.lerpVectors(v.src.p, v.fall[i], Math.min(1, r * 5));
      }
      for (let k = 0; k < 3; k++) {
        const t0 = k / 3;
        const t1 = (k + 1) / 3;
        const sag = (x: number) => Math.sin(x * Math.PI) * 0.02;
        pos.setXYZ(w++, v.a.x + (v.b.x - v.a.x) * t0 + sag(t0), v.a.y + (v.b.y - v.a.y) * t0, v.a.z + (v.b.z - v.a.z) * t0);
        pos.setXYZ(w++, v.a.x + (v.b.x - v.a.x) * t1 + sag(t1), v.a.y + (v.b.y - v.a.y) * t1, v.a.z + (v.b.z - v.a.z) * t1);
      }
    });
    pos.needsUpdate = true;
    lines.current.visible = g.visible;
    res.lineGeo.computeBoundingSphere();

    /* ── the reply's balloon: blown up above the rolled letter, then away with it ── */
    const inf = anim.fx.inflate ?? 0;
    const rp = reply.current;
    const L = sceneRefs.letterGroup;
    rp.visible = inf > 0.001 && !!L;
    replyLine.current.visible = rp.visible;
    if (rp.visible && L) {
      L.updateMatrixWorld();
      v.rollW.copy(res.roll).applyMatrix4(L.matrixWorld);
      const s = Math.max(0.001, inf) * 1.35;
      rp.scale.setScalar(s);
      rp.position.set(v.rollW.x + Math.sin(t * 0.8) * 0.02, v.rollW.y + STRING * 0.9 * Math.min(1, inf * 1.3), v.rollW.z);
      rp.rotation.set(Math.sin(t * 0.7) * 0.1, t * 0.2, Math.sin(t * 0.5) * 0.1);
      const rpos = res.replyGeo.attributes.position as THREE.BufferAttribute;
      v.a.copy(rp.position);
      rpos.setXYZ(0, v.a.x, v.a.y, v.a.z);
      rpos.setXYZ(1, v.a.x * 0.66 + v.rollW.x * 0.34 + 0.01, v.a.y * 0.66 + v.rollW.y * 0.34, v.a.z * 0.66 + v.rollW.z * 0.34);
      rpos.setXYZ(2, v.a.x * 0.33 + v.rollW.x * 0.67 + 0.01, v.a.y * 0.33 + v.rollW.y * 0.67, v.a.z * 0.33 + v.rollW.z * 0.67);
      rpos.setXYZ(3, v.rollW.x, v.rollW.y, v.rollW.z);
      rpos.needsUpdate = true;
      res.replyGeo.computeBoundingSphere();
    }

    /* ── hint over the bunch ── */
    v.tip.copy(v.src.p).add(v.a.set(0, 0.06, 0)).project(camera);
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
      <group ref={bunch}>
        {BUNCH.map((_, i) => (
          <group key={i} matrixAutoUpdate={false}>
            <mesh geometry={res.geo} material={res.mats[i % res.mats.length]} castShadow />
            <mesh geometry={res.knot} material={res.mats[i % res.mats.length]} />
          </group>
        ))}
        {/* generous tap target around balloons and scroll */}
        <mesh material={res.hitMat} position={[0, -STRING * 0.4, 0]} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
          <boxGeometry args={[0.55, STRING + 0.55, 0.4]} />
        </mesh>
      </group>
      <lineSegments ref={lines} geometry={res.lineGeo} material={res.lineMat} frustumCulled={false} />
      <group ref={reply} visible={false}>
        <mesh geometry={res.geo} material={res.replyMat} castShadow />
        <mesh geometry={res.knot} material={res.replyMat} />
      </group>
      <primitive object={useMemo(() => new THREE.Line(res.replyGeo, res.lineMat), [res])} ref={replyLine} visible={false} frustumCulled={false} />
    </>
  );
}

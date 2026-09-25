'use client';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { anim, type Quality } from '../../../store';
import { sfx } from '../../../audio';
import type { SceneAssets } from '../../assets';
import { merge } from '../../geometry';
import { windUniforms } from '../../Ground';
import { mulberry32 } from '../../noise';
import { BASKET, ENVELOPE, MOUTH } from './sky';

function envelopeGeometry(scale = 1) {
  const g = new THREE.LatheGeometry(ENVELOPE.map(([r, y]) => new THREE.Vector2(r * scale, y * scale)), 48, 0, Math.PI * 2);
  return g;
}

/** load tapes: the seams running up the envelope */
function tapeGeometry(scale: number, count: number) {
  const pts = ENVELOPE.map(([r, y]) => new THREE.Vector2(r * scale * 1.003, y * scale));
  const geos: THREE.BufferGeometry[] = [];
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2;
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(Math.sin(a) * p.x, p.y, Math.cos(a) * p.x)));
    geos.push(new THREE.TubeGeometry(curve, 40, 0.035 * scale, 3, false));
  }
  return merge(geos);
}

/** Our basket, its burner and the great striped envelope above us. */
export function Basket({ assets, quality, accent }: { assets: SceneAssets; quality: Quality; accent: string }) {
  const flame = useRef<THREE.Group>(null!);
  const light = useRef<THREE.PointLight>(null!);
  const flag = useRef<THREE.Mesh>(null!);

  const res = useMemo(() => {
    const { hx, hz, rim } = BASKET;
    /* wicker walls, both faces */
    const wick = assets.env.wicker.clone();
    const wickN = assets.env.wickerNormal.clone();
    for (const t of [wick, wickN]) {
      t.repeat.set(2.4, 2);
      t.needsUpdate = true;
    }
    const wicker = new THREE.MeshStandardMaterial({ map: wick, normalMap: wickN, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.92, side: THREE.DoubleSide, color: '#f0dcc0' });
    const walls = merge([
      new THREE.PlaneGeometry(hx * 2, rim).translate(0, rim / 2, -hz),
      new THREE.PlaneGeometry(hx * 2, rim).rotateY(Math.PI).translate(0, rim / 2, hz),
      new THREE.PlaneGeometry(hz * 2, rim).rotateY(Math.PI / 2).translate(-hx, rim / 2, 0),
      new THREE.PlaneGeometry(hz * 2, rim).rotateY(-Math.PI / 2).translate(hx, rim / 2, 0),
    ]);
    const floor = new THREE.PlaneGeometry(hx * 2, hz * 2).rotateX(-Math.PI / 2).translate(0, 0.01, 0);
    const floorMat = new THREE.MeshStandardMaterial({ color: '#8a6a48', roughness: 0.9 });
    /* padded suede rim: a tube around a rounded rectangle */
    const rr = 0.06;
    const C = (x: number, z: number) => new THREE.Vector3(x, rim, z);
    const corners: Array<[number, number, number]> = [
      [hx - rr, -hz + rr, -Math.PI / 2],
      [hx - rr, hz - rr, 0],
      [-hx + rr, hz - rr, Math.PI / 2],
      [-hx + rr, -hz + rr, Math.PI],
    ];
    const ring: THREE.Vector3[] = [];
    corners.forEach(([cx, cz, a0]) => {
      for (let i = 0; i <= 6; i++) {
        const a = a0 + (i / 6) * (Math.PI / 2);
        ring.push(C(cx + Math.cos(a) * rr, cz + Math.sin(a) * rr));
      }
    });
    const rimCurve = new THREE.CatmullRomCurve3(ring, true, 'centripetal');
    const rimGeo = new THREE.TubeGeometry(rimCurve, 120, 0.05, 10, true);
    const suede = new THREE.MeshPhysicalMaterial({ color: '#7a4f33', roughness: 0.85, sheen: 1, sheenColor: new THREE.Color('#c79a72'), sheenRoughness: 0.6 });
    /* corner uprights in leather sleeves, up to the burner frame */
    const TOP = 2.35;
    const poles: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const g = new THREE.CylinderGeometry(0.022, 0.022, TOP - rim + 0.05, 10);
        g.translate(sx * (hx - 0.06), rim + (TOP - rim) / 2, sz * (hz - 0.06));
        poles.push(g);
      }
    const poleGeo = merge(poles);
    const frame = merge([
      new THREE.BoxGeometry(hx * 2 - 0.1, 0.03, 0.03).translate(0, TOP, -(hz - 0.06)),
      new THREE.BoxGeometry(hx * 2 - 0.1, 0.03, 0.03).translate(0, TOP, hz - 0.06),
      new THREE.BoxGeometry(0.03, 0.03, hz * 2 - 0.1).translate(-(hx - 0.06), TOP, 0),
      new THREE.BoxGeometry(0.03, 0.03, hz * 2 - 0.1).translate(hx - 0.06, TOP, 0),
      // the burner itself: coils + cans in the middle
      new THREE.TorusGeometry(0.13, 0.018, 8, 24).rotateX(Math.PI / 2).translate(0, TOP + 0.08, 0),
      new THREE.TorusGeometry(0.13, 0.018, 8, 24).rotateX(Math.PI / 2).translate(0, TOP + 0.13, 0),
      new THREE.CylinderGeometry(0.1, 0.12, 0.16, 16, 1, true).translate(0, TOP + 0.02, 0),
      new THREE.BoxGeometry(0.02, 0.02, hz * 2 - 0.12).rotateY(Math.PI / 4).translate(0, TOP, 0),
      new THREE.BoxGeometry(0.02, 0.02, hz * 2 - 0.12).rotateY(-Math.PI / 4).translate(0, TOP, 0),
    ]);
    const steel = new THREE.MeshStandardMaterial({ color: '#b9b7b2', roughness: 0.35, metalness: 1 });
    /* ropes up to the envelope mouth */
    const ropes: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const a = new THREE.Vector3(sx * (hx - 0.06), TOP, sz * (hz - 0.06));
        const b = new THREE.Vector3(sx * MOUTH.r * 0.72, MOUTH.y, sz * MOUTH.r * 0.72);
        const d = b.clone().sub(a);
        const g = new THREE.CylinderGeometry(0.008, 0.008, d.length(), 5);
        g.translate(0, d.length() / 2, 0);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
        g.translate(a.x, a.y, a.z);
        ropes.push(g);
        // and a flying wire from the rim to the frame
        const r2 = new THREE.CylinderGeometry(0.005, 0.005, TOP - rim, 4).translate(sx * (hx - 0.03), rim + (TOP - rim) / 2, sz * (hz - 0.03));
        ropes.push(r2);
      }
    const ropeGeo = merge(ropes);
    const ropeMat = new THREE.MeshStandardMaterial({ color: '#d9cbb1', roughness: 0.9 });
    /* the envelope */
    const stripes = assets.env.stripes.clone();
    stripes.repeat.set(4, 1);
    stripes.needsUpdate = true;
    const envGeo = envelopeGeometry(1).translate(0, MOUTH.y, 0);
    const envMat = new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.6, side: THREE.DoubleSide });
    const tapes = tapeGeometry(1, 12).translate(0, MOUTH.y, 0);
    const tapeMat = new THREE.MeshStandardMaterial({ color: '#efe6da', roughness: 0.7 });
    /* on board: a fuel cylinder, an altimeter clipped on the rim, a pennant on the front pole */
    const tank = new THREE.CylinderGeometry(0.15, 0.15, 0.72, 20).translate(-0.36, 0.37, 0.32);
    const tankMat = new THREE.MeshStandardMaterial({ color: '#5c3b28', roughness: 0.8 });
    const instrument = merge([
      new THREE.BoxGeometry(0.14, 0.1, 0.05).translate(0, 0, 0),
      new THREE.CylinderGeometry(0.035, 0.035, 0.012, 20).rotateX(Math.PI / 2).translate(-0.03, 0.005, 0.028),
      new THREE.CylinderGeometry(0.025, 0.025, 0.012, 20).rotateX(Math.PI / 2).translate(0.04, 0.005, 0.028),
    ]);
    const dial = new THREE.MeshStandardMaterial({ color: '#2c2a28', roughness: 0.4, metalness: 0.3 });
    const pennant = new THREE.PlaneGeometry(0.3, 0.12, 12, 1).translate(0.15, 0, 0);
    const pennantMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.7, side: THREE.DoubleSide });
    const pp = pennant.attributes.position as THREE.BufferAttribute;
    const base = Float32Array.from(pp.array as Float32Array);
    // taper to a point
    for (let i = 0; i < pp.count; i++) {
      const x = pp.getX(i);
      pp.setY(i, pp.getY(i) * (1 - x / 0.3));
    }
    const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.3, 0.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const flameGeo = new THREE.ConeGeometry(0.1, 0.9, 12, 1, true).translate(0, 0.45, 0);
    const blue = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.8, 2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    return { wicker, walls, floor, floorMat, rimGeo, suede, poleGeo, frame, steel, ropeGeo, ropeMat, envGeo, envMat, tapes, tapeMat, tank, tankMat, instrument, dial, pennant, pennantMat, base, flameMat, flameGeo, blue, TOP };
  }, [assets, accent]);

  useFrame((st) => {
    const t = st.clock.elapsedTime;
    // the burner roars when the timeline asks or when the ambience fires it
    const since = (performance.now() - sfx.lastBurner) / 1000;
    const amb = since < 2.2 ? Math.min(1, since * 4) * Math.min(1, (2.2 - since) * 2) : 0;
    const b = Math.max(anim.fx.burner ?? 0, amb);
    const f = flame.current;
    if (f) {
      f.visible = b > 0.01;
      f.scale.set(1 + Math.sin(t * 31) * 0.08, b * (0.9 + Math.sin(t * 23) * 0.12), 1 + Math.cos(t * 27) * 0.08);
      res.flameMat.opacity = b * 0.8;
      res.blue.opacity = b * 0.6;
    }
    if (light.current) light.current.intensity = b * (3 + Math.sin(t * 40) * 0.5);
    // pennant flutter
    const fl = flag.current;
    if (fl) {
      const p = fl.geometry.attributes.position as THREE.BufferAttribute;
      const w = 0.6 + windUniforms.uWind.value;
      for (let i = 0; i < p.count; i++) {
        const x = res.base[i * 3];
        p.setZ(i, Math.sin(x * 18 - t * 7) * 0.02 * (x / 0.3) * w);
      }
      p.needsUpdate = true;
    }
  });

  const { hx, hz, rim } = BASKET;
  const shadows = quality !== 'low';
  return (
    <>
      <mesh geometry={res.walls} material={res.wicker} castShadow={shadows} receiveShadow />
      <mesh geometry={res.floor} material={res.floorMat} receiveShadow />
      <mesh geometry={res.rimGeo} material={res.suede} castShadow={shadows} receiveShadow />
      <mesh geometry={res.poleGeo} material={res.suede} castShadow={shadows} />
      <mesh geometry={res.frame} material={res.steel} castShadow={shadows} />
      <mesh geometry={res.ropeGeo} material={res.ropeMat} />
      <mesh geometry={res.envGeo} material={res.envMat} />
      <mesh geometry={res.tapes} material={res.tapeMat} />
      <mesh geometry={res.tank} material={res.tankMat} castShadow={shadows} receiveShadow />
      <group position={[-hx + 0.22, rim + 0.02, -hz - 0.03]} rotation={[-0.25, 0.1, 0]}>
        <mesh geometry={res.instrument} material={res.dial} castShadow={shadows} />
      </group>
      <mesh ref={flag} geometry={res.pennant} material={res.pennantMat} position={[hx - 0.06, res.TOP - 0.12, -(hz - 0.06)]} rotation={[0, 0.5, 0]} />
      <group ref={flame} position={[0, res.TOP + 0.12, 0]} visible={false}>
        <mesh geometry={res.flameGeo} material={res.flameMat} renderOrder={8} />
        <mesh geometry={res.flameGeo} material={res.blue} scale={[0.6, 0.3, 0.6]} renderOrder={8} />
      </group>
      <pointLight ref={light} position={[0, res.TOP + 0.4, 0]} color="#ffae5c" intensity={0} distance={6} decay={2} />
    </>
  );
}

/** Other balloons drifting far off, each bobbing on its own. */
export function FarBalloons({ assets }: { assets: SceneAssets }) {
  const group = useRef<THREE.Group>(null!);
  const res = useMemo(() => {
    const rnd = mulberry32(3);
    const env = envelopeGeometry(1);
    const basket = new THREE.BoxGeometry(1.1, 1.0, 1.1).translate(0, -4.2, 0);
    const mats = [assets.env.stripes2, assets.env.stripes].map((m) => {
      const t = m.clone();
      t.repeat.set(3, 1);
      t.needsUpdate = true;
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.65 });
    });
    const wick = new THREE.MeshStandardMaterial({ color: '#8a6a48', roughness: 1 });
    const list = [
      { p: [-38, 4, -95], s: 0.9, m: 0 },
      { p: [64, -6, -170], s: 1, m: 1 },
      { p: [-120, 10, -240], s: 1.1, m: 0 },
      { p: [22, 16, -70], s: 0.7, m: 1 },
      { p: [150, 2, -120], s: 1, m: 0 },
    ].map((b) => ({ ...b, ph: rnd() * 6 }));
    return { env, basket, mats, wick, list };
  }, [assets]);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    const g = group.current;
    if (!g) return;
    g.children.forEach((c, i) => {
      const b = res.list[i];
      c.position.set(b.p[0] + Math.sin(t * 0.03 + b.ph) * 3, b.p[1] + Math.sin(t * 0.2 + b.ph) * 0.6, b.p[2]);
      c.rotation.y = t * 0.02 + b.ph;
    });
  });
  return (
    <group ref={group}>
      {res.list.map((b, i) => (
        <group key={i} scale={b.s}>
          <mesh geometry={res.env} material={res.mats[b.m]} />
          <mesh geometry={res.basket} material={res.wick} />
        </group>
      ))}
    </group>
  );
}

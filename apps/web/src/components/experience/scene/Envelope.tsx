'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { anim, useExperience } from '../store';
import { ENVELOPE, type SceneAssets } from './assets';
import { BendPanel } from './bend';
import { sceneRefs } from './refs';
import { crumbGeometry, sealGeometries } from './seal';
import { makeCanvas, ctx2d, softBlur, toTexture } from './textures';
import { sfx } from '../audio';

const W = ENVELOPE.w;
const H = ENVELOPE.h;
const FLAP_L = H * ENVELOPE.tipY;
const Y_BACK = 0.0011;
const Y_POCKET = 0.0029;
const Y_FLAP = 0.0036;
const SEAL_R = 0.0205;
const SEAL_S = FLAP_L - SEAL_R * 0.28; // seal centre distance from hinge
const CRUMBS = 14;

function shadowTexture() {
  const c = makeCanvas(256, 256);
  const g = ctx2d(c);
  g.fillStyle = 'rgba(0,0,0,1)';
  g.beginPath();
  g.roundRect(52, 60, 152, 136, 18);
  g.fill();
  return toTexture(softBlur(c, 12));
}

function flapHalfWidth(t: number) {
  const cap = 0.14;
  if (t < 1 - cap) return (W / 2) * (1 - t) * (1 - 0.05 * Math.sin(Math.PI * t));
  const base = (W / 2) * cap * (1 - 0.05 * Math.sin(Math.PI * (1 - cap)));
  const q = (t - (1 - cap)) / cap;
  return Math.max(0.0004, base * Math.sqrt(Math.max(0, 1 - q * q)));
}

function pocketGeometry() {
  // rectangle with a V notch at the top edge (formed by the side flaps)
  const s = new THREE.Shape();
  const hw = W / 2;
  const hh = H / 2;
  const notchY = hh - H * ENVELOPE.sideY;
  s.moveTo(-hw, -hh);
  s.lineTo(hw, -hh);
  s.lineTo(hw, hh);
  s.quadraticCurveTo(W * 0.2, notchY + H * 0.2, W * 0.03, notchY);
  s.quadraticCurveTo(0, notchY - H * 0.012, -W * 0.03, notchY);
  s.quadraticCurveTo(-W * 0.2, notchY + H * 0.2, -hw, hh);
  s.closePath();
  const g = new THREE.ShapeGeometry(s, 24);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / W + 0.5, pos.getY(i) / H + 0.5);
  g.rotateX(-Math.PI / 2);
  return g;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function Envelope({ assets, sealColor, onOpen }: { assets: SceneAssets; sealColor: string; onOpen: () => void }) {
  const group = useRef<THREE.Group>(null!);
  const flapOuter = useRef<THREE.Mesh>(null!);
  const sealTop = useRef<THREE.Group>(null!);
  const sealBottom = useRef<THREE.Group>(null!);
  const crumbs = useRef<THREE.InstancedMesh>(null!);
  const shadow = useRef<THREE.Mesh>(null!);
  const { camera, size } = useThree();

  const res = useMemo(() => {
    const paperNormal = assets.envPaper.normalMap.clone();
    paperNormal.repeat.set(3, 2);
    paperNormal.needsUpdate = true;
    const paperMap = assets.envPaper.map.clone();
    paperMap.repeat.set(2, 1.4);
    paperMap.needsUpdate = true;
    const common = { roughness: 0.86, metalness: 0, sheen: 0.35, sheenRoughness: 0.7, sheenColor: new THREE.Color('#ffffff') };
    const paper = new THREE.MeshPhysicalMaterial({ ...common, map: paperMap, normalMap: paperNormal, normalScale: new THREE.Vector2(0.35, 0.35) });
    const pocket = new THREE.MeshPhysicalMaterial({ ...common, map: assets.pocket, normalMap: paperNormal, normalScale: new THREE.Vector2(0.35, 0.35) });
    const flapOut = new THREE.MeshPhysicalMaterial({ ...common, map: assets.flap, normalMap: paperNormal, normalScale: new THREE.Vector2(0.35, 0.35), side: THREE.FrontSide });
    const linerMap = assets.liner.clone();
    linerMap.repeat.set(1.6, 1.6);
    linerMap.needsUpdate = true;
    const linerIn = new THREE.MeshStandardMaterial({ map: linerMap, roughness: 0.75, side: THREE.BackSide });
    const linerFloor = new THREE.MeshStandardMaterial({ map: linerMap, roughness: 0.75 });
    const seal = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(sealColor),
      map: assets.seal.cavity,
      normalMap: assets.seal.normal,
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughnessMap: assets.seal.rough,
      roughness: 1,
      metalness: 0.02,
      clearcoat: 0.55,
      clearcoatRoughness: 0.32,
      sheen: 0.25,
      sheenColor: new THREE.Color(sealColor).offsetHSL(0, 0, 0.25),
    });
    const flap = new BendPanel(W, FLAP_L, 22, 18, flapHalfWidth, (x, s) => [x / W + 0.5, 1 - s / FLAP_L]);
    const sealGeo = sealGeometries(SEAL_R, 11);
    const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, opacity: 0.5, depthWrite: false, color: '#1b120a' });
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
    return { paper, pocket, flapOut, linerIn, linerFloor, seal, flap, sealGeo, pocketGeo: pocketGeometry(), shadowMat, hitMat, crumbGeo: crumbGeometry() };
  }, [assets, sealColor]);

  const crumbState = useMemo(
    () => ({ fired: false, t0: 0, p: new Float32Array(CRUMBS * 3), v: new Float32Array(CRUMBS * 3), r: new Float32Array(CRUMBS * 3) }),
    [],
  );

  useEffect(() => {
    sceneRefs.envelope = group.current;
    // the letter lives inside the envelope until it slides out of the top
    const m = new THREE.Matrix4();
    const local = new THREE.Matrix4();
    const e = new THREE.Euler();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3();
    sceneRefs.letterSource = (out) => {
      const env = group.current;
      if (!env) return;
      env.updateMatrixWorld();
      const s = anim.slide;
      e.set(-Math.PI / 2 + s * 0.55, 0, Math.sin(s * Math.PI) * 0.03);
      q.setFromEuler(e);
      local.compose(p.set(0, 0.0016 + 0.006 * s + 0.07 * s * s, -0.074 - 0.11 * s - 0.02 * s * s), q, sc.set(1, 1, 1));
      m.multiplyMatrices(env.matrixWorld, local);
      m.decompose(out.p, out.q, sc);
    };
    return () => {
      sceneRefs.envelope = null;
      sceneRefs.letterSource = null;
    };
  }, []);

  const tmpV = useMemo(() => new THREE.Vector3(), []);
  const tmpN = useMemo(() => new THREE.Vector3(), []);
  const tmpS = useMemo(() => new THREE.Vector3(), []);
  const liftPos = useMemo(() => new THREE.Vector3(), []);
  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const e = useMemo(() => new THREE.Euler(), []);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const phase = useExperience.getState().phase;
    const hoverTarget = phase === 'idle' && sceneRefs.pointerInside ? 1 : 0;
    anim.hover += (hoverTarget - anim.hover) * Math.min(1, dt * 6);

    /* ── envelope pose ── */
    const rest = sceneRefs.envelopeRest;
    const L = anim.lift;
    const S = anim.settle;
    const F = anim.flyAway;
    const hv = anim.hover;
    const breathe = phase === 'idle' ? Math.sin(t * 1.3) * 0.0015 * hv : 0;
    // turn to face the close-up camera
    tmpV.copy(sceneRefs.camClose).sub(liftPos.set(rest.pos.x * 0.6, rest.pos.y + 0.06, rest.pos.z + 0.11)).normalize();
    const faceYaw = Math.atan2(tmpV.x, tmpV.z);
    const facePitch = Math.acos(THREE.MathUtils.clamp(tmpV.y, -1, 1));
    // rest (+hover: leans a touch toward you)
    let px = rest.pos.x;
    let py = rest.pos.y + hv * 0.004 + breathe;
    let pz = rest.pos.z + hv * 0.01;
    let rx = rest.rotX + hv * 0.05 + anim.py * 0.015 * hv;
    let ry = rest.rotY - anim.px * 0.03 * hv;
    let rz = rest.rotZ;
    // lifted toward the camera
    if (L > 0) {
      px += (liftPos.x - px) * L;
      py += (liftPos.y - py) * L + Math.sin(L * Math.PI) * 0.012;
      pz += (liftPos.z - pz) * L;
      rx += (facePitch - rx) * L;
      ry += (faceYaw - ry) * L;
      rz += (0 - rz) * L + Math.sin(L * Math.PI) * 0.05;
      rz += Math.sin(t * 2.2) * 0.006 * L;
    }
    // settled: dropped flat on the seat, flap open
    if (S > 0) {
      const k = S;
      px += (rest.pos.x - 0.13 - px) * k;
      py += (0.4513 - py) * k + Math.sin(k * Math.PI) * 0.045;
      pz += (0.045 - pz) * k;
      rx += (0 - rx) * k;
      ry += (rest.rotY + 0.42 - ry) * k;
      rz += (0.0 - rz) * k;
    }
    if (F > 0) {
      const f = F * F;
      px += f * 0.9 + Math.sin(F * 5) * 0.05 * F;
      py += f * 1.9 + Math.sin(F * Math.PI) * 0.12;
      pz += -f * 1.8;
      rx += F * 0.9;
      ry += F * 1.4;
      rz += Math.sin(F * 7) * 0.3 * F;
    }
    g.position.set(px, py, pz);
    g.rotation.set(rx, ry, rz, 'YXZ');
    g.updateMatrixWorld();

    /* ── flap ── */
    const p = anim.flap;
    const a = p * Math.PI * 0.93;
    const k = -9 * Math.sin(Math.PI * p) - 1.5 * p;
    res.flap.apply(a, k, 0);

    /* ── seal ── */
    const c = anim.crack;
    const shake = c > 0 && c < 0.62 ? Math.sin(t * 70) * 0.04 * Math.sin((c / 0.62) * Math.PI) : 0;
    const sep = c > 0.6 ? easeOut(Math.min(1, (c - 0.6) / 0.4)) : 0;
    const [u, v, ang] = BendPanel.curve(a, k, SEAL_S);
    const sealBase = 0.0019;
    // top half rides with the flap (in flap frame → envelope local)
    sealTop.current.position.set(0, Y_FLAP + v + Math.cos(ang) * sealBase, -H / 2 + u - Math.sin(ang) * sealBase - sep * 0.0008);
    sealTop.current.rotation.set(-ang - sep * 0.06, shake, 0);
    // bottom half stays on the pocket (restamped when anim.stamp runs)
    const st = anim.stamp;
    const stampLift = st > 0 && st < 1 ? Math.sin(Math.min(1, st * 1.6) * Math.PI) * 0.03 * (st < 0.62 ? 1 : 0) : 0;
    const squash = st > 0.55 && st < 0.8 ? 1 - Math.sin(((st - 0.55) / 0.25) * Math.PI) * 0.25 : 1;
    sealBottom.current.position.set(0, Y_POCKET + sealBase + stampLift, -H / 2 + SEAL_S + sep * 0.0009);
    sealBottom.current.rotation.set(sep * 0.03, -shake, 0);
    sealBottom.current.scale.set(1, squash, 1);
    sealTop.current.scale.set(1, squash, 1);

    /* ── crumbs (world space: they tumble onto the seat) ── */
    const cm = crumbs.current;
    if (c > 0.6 && !crumbState.fired) {
      crumbState.fired = true;
      crumbState.t0 = t;
      const nrm = tmpN.set(0, 1, 0).transformDirection(g.matrixWorld);
      for (let i = 0; i < CRUMBS; i++) {
        tmpV.set((Math.random() - 0.5) * SEAL_R * 2, Y_POCKET + 0.004, -H / 2 + SEAL_S + (Math.random() - 0.5) * 0.004).applyMatrix4(g.matrixWorld);
        crumbState.p[i * 3] = tmpV.x;
        crumbState.p[i * 3 + 1] = tmpV.y;
        crumbState.p[i * 3 + 2] = tmpV.z;
        const ang2 = Math.random() * Math.PI * 2;
        const sp = 0.04 + Math.random() * 0.1;
        crumbState.v[i * 3] = Math.cos(ang2) * sp + nrm.x * 0.25;
        crumbState.v[i * 3 + 1] = 0.12 + Math.random() * 0.2 + nrm.y * 0.2;
        crumbState.v[i * 3 + 2] = Math.sin(ang2) * sp + nrm.z * 0.25;
        crumbState.r[i * 3] = Math.random() * 6;
        crumbState.r[i * 3 + 1] = Math.random() * 6;
        crumbState.r[i * 3 + 2] = 0.6 + Math.random() * 0.9;
      }
    }
    if (c < 0.01 && crumbState.fired && anim.stamp === 0) crumbState.fired = false;
    cm.visible = crumbState.fired && F < 0.05;
    if (crumbState.fired) {
      const d = Math.min(dt, 1 / 30);
      for (let i = 0; i < CRUMBS; i++) {
        const o = i * 3;
        const floor = 0.4508;
        if (crumbState.p[o + 1] > floor + 0.0001 || crumbState.v[o + 1] > 0) {
          crumbState.v[o + 1] -= 2.2 * d;
          crumbState.p[o] += crumbState.v[o] * d;
          crumbState.p[o + 1] += crumbState.v[o + 1] * d;
          crumbState.p[o + 2] += crumbState.v[o + 2] * d;
          if (crumbState.p[o + 1] < floor) {
            crumbState.p[o + 1] = floor;
            crumbState.v[o] *= 0.3;
            crumbState.v[o + 2] *= 0.3;
            crumbState.v[o + 1] = Math.abs(crumbState.v[o + 1]) > 0.08 ? -crumbState.v[o + 1] * 0.25 : 0;
          }
        }
        const spin = Math.min(t - crumbState.t0, 1.2);
        e.set(crumbState.r[o] + spin * 5, crumbState.r[o + 1] + spin * 4, 0);
        q.setFromEuler(e);
        const sc = crumbState.r[o + 2];
        m4.compose(tmpV.set(crumbState.p[o], crumbState.p[o + 1], crumbState.p[o + 2]), q, tmpS.set(sc, sc, sc));
        cm.setMatrixAt(i, m4);
      }
      cm.instanceMatrix.needsUpdate = true;
    }

    /* ── contact shadow ── */
    const sh = shadow.current;
    const flat = Math.max(0, Math.cos(rx));
    const liftAmt = Math.max(0, py - (0.4513 + (H / 2) * Math.sin(rx) * 0.98));
    // centre of the envelope's footprint on the seat
    tmpV.set(0, 0, H * 0.5 * (1 - flat)).applyMatrix4(g.matrixWorld);
    sh.position.set(tmpV.x, 0.4508, tmpV.z + 0.01 * (1 - flat));
    sh.rotation.set(-Math.PI / 2, 0, ry);
    const spread = 1 + liftAmt * 10;
    sh.scale.set(W * 1.5 * spread, (H * 1.7 * flat + 0.05 * (1 - flat)) * spread, 1);
    (sh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (0.5 + 0.2 * (1 - flat)) / (spread * spread)) * (1 - F);

    /* ── DOM hint position (projected seal) ── */
    tmpV.set(0, 0.004, -H / 2 + SEAL_S).applyMatrix4(g.matrixWorld);
    tmpV.project(camera);
    sceneRefs.hint.x = (tmpV.x * 0.5 + 0.5) * size.width;
    sceneRefs.hint.y = (-tmpV.y * 0.5 + 0.5) * size.height;
    tmpV.set(W / 2, 0, 0).applyMatrix4(g.matrixWorld).project(camera);
    sceneRefs.hint.r = Math.abs((tmpV.x * 0.5 + 0.5) * size.width - sceneRefs.hint.x);
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
        {/* back panel (outside paper) with the lined interior on top */}
        <mesh material={res.paper} position={[0, Y_BACK / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[W, Y_BACK, H]} />
        </mesh>
        <mesh material={res.linerFloor} position={[0, Y_BACK + 0.0001, -H * 0.02]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[W * 0.985, H * 0.96]} />
        </mesh>
        {/* front pocket (bottom + side flaps) */}
        <mesh geometry={res.pocketGeo} material={res.pocket} position={[0, Y_POCKET, 0]} castShadow receiveShadow />
        {/* thin paper edges */}
        <mesh material={res.paper} position={[0, Y_POCKET / 2, H / 2 - 0.0004]} receiveShadow>
          <boxGeometry args={[W, Y_POCKET, 0.0008]} />
        </mesh>
        <mesh material={res.paper} position={[W / 2 - 0.0004, Y_POCKET / 2, 0]} receiveShadow>
          <boxGeometry args={[0.0008, Y_POCKET, H]} />
        </mesh>
        <mesh material={res.paper} position={[-W / 2 + 0.0004, Y_POCKET / 2, 0]} receiveShadow>
          <boxGeometry args={[0.0008, Y_POCKET, H]} />
        </mesh>
        {/* top flap: outer paper + liner on the inside */}
        <group position={[0, Y_FLAP, -H / 2]}>
          <mesh ref={flapOuter} geometry={res.flap.geometry} material={res.flapOut} castShadow receiveShadow />
          <mesh geometry={res.flap.geometry} material={res.linerIn} receiveShadow />
        </group>
        {/* wax seal halves */}
        <group ref={sealTop}>
          <mesh geometry={res.sealGeo.top} material={res.seal} castShadow receiveShadow />
        </group>
        <group ref={sealBottom}>
          <mesh geometry={res.sealGeo.bottom} material={res.seal} castShadow receiveShadow />
        </group>
        {/* invisible, generous hit area for pointer / touch */}
        <mesh material={res.hitMat} position={[0, 0.01, 0]} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
          <boxGeometry args={[W * 1.15, 0.03, H * 1.2]} />
        </mesh>
      </group>
      <instancedMesh ref={crumbs} args={[res.crumbGeo, res.seal, CRUMBS]} castShadow visible={false} frustumCulled={false} />
      <mesh ref={shadow} material={res.shadowMat} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
      </mesh>
    </>
  );
}

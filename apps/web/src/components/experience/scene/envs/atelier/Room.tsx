'use client';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { anim, type Quality } from '../../../store';
import type { SceneAssets } from '../../assets';
import { merge } from '../../geometry';
import { windUniforms } from '../../Ground';
import { mulberry32 } from '../../noise';
import type { LightPreset } from '../../presets';
import { gardenCanvas, printCanvas, ROOM, SILL_Y, SUN_DIR, WALL_T, WALL_Z, WIN } from './room';

type Rect = [number, number, number, number]; // a0, a1, y0, y1

/** planes with world-scale UVs (so wallpaper keeps its size on every piece) */
function wallGeometry(rects: Rect[], plane: 'back' | 'left' | 'right', at: number, tile: number) {
  const geos = rects.map(([a0, a1, y0, y1]) => {
    const g = new THREE.PlaneGeometry(a1 - a0, y1 - y0);
    g.translate((a0 + a1) / 2, (y0 + y1) / 2, 0);
    const p = g.attributes.position as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / tile, p.getY(i) / tile);
    if (plane === 'left') {
      g.rotateY(Math.PI / 2);
      g.translate(at, 0, 0);
    } else if (plane === 'right') {
      g.rotateY(-Math.PI / 2);
      g.translate(at, 0, 0);
    } else g.translate(0, 0, at);
    return g;
  });
  return merge(geos);
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}

/** a window sash: frame + glazing bars, hinge at local x = 0, extends toward +x·dir */
function sashGeometry(w: number, h: number, dir: 1 | -1) {
  const t = 0.045;
  const d = 0.04;
  const bar = 0.018;
  const parts = [
    box(t, h, d, (dir * t) / 2, h / 2, 0),
    box(t, h, d, dir * (w - t / 2), h / 2, 0),
    box(w, t, d, (dir * w) / 2, t / 2, 0),
    box(w, t, d, (dir * w) / 2, h - t / 2, 0),
    box(bar, h, d * 0.7, (dir * w) / 2, h / 2, 0),
    box(w, bar, d * 0.7, (dir * w) / 2, h * 0.5, 0),
  ];
  return merge(parts);
}

export function Room({ assets, preset, quality }: { assets: SceneAssets; preset: LightPreset; quality: Quality }) {
  const sashL = useRef<THREE.Group>(null!);
  const sashR = useRef<THREE.Group>(null!);
  const outside = useRef<THREE.Group>(null!);

  const res = useMemo(() => {
    const H = ROOM.h;
    const RAIL = 0.9;
    /* ── walls ── */
    const paper = assets.env.wallpaper.clone();
    paper.needsUpdate = true;
    const upperBack: Rect[] = [
      [ROOM.x0, WIN.x0, RAIL, H],
      [WIN.x1, ROOM.x1, RAIL, H],
      [WIN.x0, WIN.x1, WIN.y1, H],
      [WIN.x0, WIN.x1, RAIL, WIN.y0],
    ];
    const lowerBack: Rect[] = [[ROOM.x0, ROOM.x1, 0, RAIL]];
    const side: Rect = [WALL_Z, ROOM.zFront, RAIL, H];
    const sideLow: Rect = [WALL_Z, ROOM.zFront, 0, RAIL];
    const upper = merge([
      wallGeometry(upperBack, 'back', WALL_Z, 0.56),
      wallGeometry([[-side[1], -side[0], side[2], side[3]]], 'left', ROOM.x0, 0.56),
      wallGeometry([[side[0], side[1], side[2], side[3]]], 'right', ROOM.x1, 0.56),
    ]);
    const lower = merge([
      wallGeometry(lowerBack, 'back', WALL_Z, 1),
      wallGeometry([[-sideLow[1], -sideLow[0], 0, RAIL]], 'left', ROOM.x0, 1),
      wallGeometry([[sideLow[0], sideLow[1], 0, RAIL]], 'right', ROOM.x1, 1),
    ]);
    const wallMat = new THREE.MeshStandardMaterial({ map: paper, roughness: 0.92, color: '#fbf6ee' });
    const paintMat = new THREE.MeshStandardMaterial({ color: '#cdbfa6', roughness: 0.7 });
    const trimMat = new THREE.MeshStandardMaterial({ color: '#e6dccb', roughness: 0.55 });

    /* ── mouldings: chair rail, skirting, panels, window architrave ── */
    const mould: THREE.BufferGeometry[] = [
      box(ROOM.x1 - ROOM.x0, 0.035, 0.022, 0, RAIL, WALL_Z + 0.011),
      box(ROOM.x1 - ROOM.x0, 0.13, 0.018, 0, 0.065, WALL_Z + 0.009),
    ];
    for (let x = ROOM.x0 + 0.15; x < ROOM.x1 - 0.5; x += 0.62) {
      const w = 0.5;
      const y0 = 0.22;
      const y1 = RAIL - 0.1;
      mould.push(box(w, 0.016, 0.01, x + w / 2, y0, WALL_Z + 0.005), box(w, 0.016, 0.01, x + w / 2, y1, WALL_Z + 0.005));
      mould.push(box(0.016, y1 - y0, 0.01, x, (y0 + y1) / 2, WALL_Z + 0.005), box(0.016, y1 - y0, 0.01, x + w, (y0 + y1) / 2, WALL_Z + 0.005));
    }
    const arch = 0.075;
    mould.push(
      box(arch, WIN.y1 - WIN.y0 + arch, 0.024, WIN.x0 - arch / 2, (WIN.y0 + WIN.y1 + arch) / 2, WALL_Z + 0.012),
      box(arch, WIN.y1 - WIN.y0 + arch, 0.024, WIN.x1 + arch / 2, (WIN.y0 + WIN.y1 + arch) / 2, WALL_Z + 0.012),
      box(WIN.x1 - WIN.x0 + arch * 2 + 0.03, arch, 0.03, 0, WIN.y1 + arch / 2, WALL_Z + 0.015),
      // window reveal (the thickness of the wall)
      box(0.01, WIN.y1 - WIN.y0, WALL_T, WIN.x0 - 0.005, (WIN.y0 + WIN.y1) / 2, WALL_Z - WALL_T / 2),
      box(0.01, WIN.y1 - WIN.y0, WALL_T, WIN.x1 + 0.005, (WIN.y0 + WIN.y1) / 2, WALL_Z - WALL_T / 2),
      box(WIN.x1 - WIN.x0, 0.01, WALL_T, 0, WIN.y1 + 0.005, WALL_Z - WALL_T / 2),
    );
    // side walls get rails and skirting too
    for (const sx of [ROOM.x0, ROOM.x1]) {
      const s = Math.sign(sx);
      mould.push(box(0.022, 0.035, ROOM.zFront - WALL_Z, sx - s * 0.011, RAIL, (WALL_Z + ROOM.zFront) / 2));
      mould.push(box(0.018, 0.13, ROOM.zFront - WALL_Z, sx - s * 0.009, 0.065, (WALL_Z + ROOM.zFront) / 2));
    }
    const mouldGeo = merge(mould);
    const sill = box(WIN.x1 - WIN.x0 + 0.2, 0.035, WALL_T + 0.1, 0, SILL_Y - 0.0175, WALL_Z - WALL_T / 2 + 0.05);
    const apron = box(WIN.x1 - WIN.x0 + 0.1, 0.06, 0.02, 0, SILL_Y - 0.065, WALL_Z + 0.01);

    /* ── the window itself: fixed frame + transom lights + two casements open outward ── */
    const fz = WALL_Z - WALL_T + 0.025;
    const frame = merge([
      box(0.05, WIN.y1 - WIN.y0, 0.05, WIN.x0 + 0.025, (WIN.y0 + WIN.y1) / 2, fz),
      box(0.05, WIN.y1 - WIN.y0, 0.05, WIN.x1 - 0.025, (WIN.y0 + WIN.y1) / 2, fz),
      box(WIN.x1 - WIN.x0, 0.05, 0.05, 0, WIN.y1 - 0.025, fz),
      box(WIN.x1 - WIN.x0, 0.05, 0.05, 0, WIN.y0 + 0.025, fz),
      box(WIN.x1 - WIN.x0, 0.055, 0.055, 0, WIN.transom, fz),
      box(0.02, WIN.y1 - WIN.transom, 0.03, -0.17, (WIN.y1 + WIN.transom) / 2, fz),
      box(0.02, WIN.y1 - WIN.transom, 0.03, 0.17, (WIN.y1 + WIN.transom) / 2, fz),
    ]);
    const sw = (WIN.x1 - WIN.x0) / 2 - 0.05;
    const sh = WIN.transom - WIN.y0 - 0.075;
    const sashGeoL = sashGeometry(sw, sh, 1);
    const sashGeoR = sashGeometry(sw, sh, -1);
    const paneL = new THREE.PlaneGeometry(sw - 0.06, sh - 0.06);
    paneL.translate(sw / 2, sh / 2, 0);
    const paneR = paneL.clone();
    paneR.translate(-sw, 0, 0);
    const transomGlass = new THREE.PlaneGeometry(WIN.x1 - WIN.x0 - 0.1, WIN.y1 - WIN.transom - 0.06);
    transomGlass.translate(0, (WIN.y1 + WIN.transom) / 2, fz);
    const glass = new THREE.MeshPhysicalMaterial({ color: '#f4fbff', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.12, envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false });
    const frameMat = new THREE.MeshStandardMaterial({ color: '#f7f4ec', roughness: 0.5 });
    const brass = new THREE.MeshStandardMaterial({ color: '#c9a45c', roughness: 0.3, metalness: 1 });

    /* ── invisible occluders: the wall blocks the sun except through the opening ── */
    const occ = merge([
      box(4, 6, WALL_T, WIN.x0 - 2, 1.5, WALL_Z - WALL_T / 2),
      box(4, 6, WALL_T, WIN.x1 + 2, 1.5, WALL_Z - WALL_T / 2),
      box(WIN.x1 - WIN.x0, 3, WALL_T, 0, WIN.y1 + 1.5, WALL_Z - WALL_T / 2),
      box(WIN.x1 - WIN.x0, 2, WALL_T, 0, WIN.y0 - 1, WALL_Z - WALL_T / 2),
    ]);
    const occMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });

    /* ── floor: oak boards, each with its own piece of grain, laid on a dark base ── */
    const rnd = mulberry32(12);
    const plankW = 0.14;
    const planks: THREE.BufferGeometry[] = [];
    for (let x = ROOM.x0; x < ROOM.x1; x += plankW) {
      let z = WALL_Z;
      while (ROOM.zFront - z > 0.02) {
        const rest = ROOM.zFront - z;
        const len = rest < 1.2 ? rest : Math.min(rest, 0.9 + rnd() * 1.4);
        const g = new THREE.PlaneGeometry(plankW - 0.003, len - 0.003);
        g.rotateX(-Math.PI / 2);
        g.translate(x + plankW / 2, 0, z + len / 2);
        const uv = g.attributes.uv as THREE.BufferAttribute;
        const u0 = rnd() * 4;
        const v0 = rnd();
        // grain runs along the board (texture u → world z)
        for (let i = 0; i < uv.count; i++) {
          const a = uv.getX(i);
          const b = uv.getY(i);
          uv.setXY(i, u0 + (1 - b) * (len / 1.3), v0 + a * 0.9);
        }
        planks.push(g);
        z += len;
      }
    }
    const floorGeo = merge(planks);
    const floorMap = assets.env.floor.clone();
    const floorNrm = assets.env.floorNormal.clone();
    floorMap.needsUpdate = floorNrm.needsUpdate = true;
    const floorMat = new THREE.MeshPhysicalMaterial({ map: floorMap, normalMap: floorNrm, normalScale: new THREE.Vector2(0.4, 0.4), roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4, color: '#e6cfb2' });
    const seamMat = new THREE.MeshStandardMaterial({ color: '#4a3322', roughness: 0.9 });
    const ceiling = new THREE.PlaneGeometry(ROOM.x1 - ROOM.x0, ROOM.zFront - WALL_Z);
    ceiling.rotateX(Math.PI / 2);
    ceiling.translate(0, H, (WALL_Z + ROOM.zFront) / 2);

    /* ── curtain rod ── */
    const rod = new THREE.CylinderGeometry(0.011, 0.011, 2.3, 16);
    rod.rotateZ(Math.PI / 2);
    rod.translate(0, 2.34, WALL_Z + 0.09);
    const finial = new THREE.SphereGeometry(0.022, 16, 12);
    const rodGeo = merge([
      rod,
      finial.clone().translate(-1.17, 2.34, WALL_Z + 0.09),
      finial.clone().translate(1.17, 2.34, WALL_Z + 0.09),
      box(0.02, 0.05, 0.1, -0.95, 2.34, WALL_Z + 0.045),
      box(0.02, 0.05, 0.1, 0.95, 2.34, WALL_Z + 0.045),
    ]);

    /* ── pictures on the wall ── */
    const pictures = [
      { x: 1.08, y: 1.52, w: 0.34, h: 0.44, seed: 3 },
      { x: -1.1, y: 1.58, w: 0.28, h: 0.36, seed: 8 },
    ].map((p) => {
      const f = 0.03;
      const geo = merge([
        box(p.w + f * 2, f, 0.025, p.x, p.y + p.h / 2 + f / 2, WALL_Z + 0.0125),
        box(p.w + f * 2, f, 0.025, p.x, p.y - p.h / 2 - f / 2, WALL_Z + 0.0125),
        box(f, p.h, 0.025, p.x - p.w / 2 - f / 2, p.y, WALL_Z + 0.0125),
        box(f, p.h, 0.025, p.x + p.w / 2 + f / 2, p.y, WALL_Z + 0.0125),
      ]);
      const print = new THREE.PlaneGeometry(p.w, p.h);
      print.translate(p.x, p.y, WALL_Z + 0.004);
      return { geo, print, mat: new THREE.MeshStandardMaterial({ map: printCanvas(p.seed), roughness: 0.85 }) };
    });
    const pictureFrame = new THREE.MeshStandardMaterial({ color: '#b08a4e', roughness: 0.35, metalness: 0.6 });

    /* ── outside: the garden backdrop + a climbing rose around the window (its leaves throw shadows in) ── */
    const garden = new THREE.MeshBasicMaterial({ map: gardenCanvas(preset.skyTop, preset.skyHorizon), fog: false });
    garden.color.setScalar(1.12);
    const gardenGeo = new THREE.PlaneGeometry(22, 11);
    gardenGeo.translate(0.5, 4.3, -8);
    const leafMat = new THREE.MeshStandardMaterial({ map: assets.cluster, alphaTest: 0.45, color: '#6f9a4a', roughness: 0.8, side: THREE.DoubleSide });
    const leafMat2 = leafMat.clone();
    leafMat2.color.set('#557c38');
    const roseMat = new THREE.MeshStandardMaterial({ map: assets.flower, alphaTest: 0.4, color: '#f3a9b9', roughness: 0.7, side: THREE.DoubleSide });
    const leaves: Array<{ p: [number, number, number]; s: number; r: number; m: number; ph: number }> = [];
    const lr = mulberry32(4);
    // arching over the top-left of the window and down its left side, and a branch high in the sun's path
    for (let i = 0; i < 26; i++) {
      const t = i / 25;
      const a = t * Math.PI * 0.95;
      const x = -0.1 - Math.cos(a) * 0.75 + (lr() - 0.5) * 0.12;
      const y = 1.35 + Math.sin(a) * 1.0 + (lr() - 0.5) * 0.15;
      leaves.push({ p: [x, y, WALL_Z - WALL_T - 0.12 - lr() * 0.25], s: 0.2 + lr() * 0.16, r: lr() * 6, m: lr() < 0.5 ? 0 : 1, ph: lr() * 6 });
    }
    for (let i = 0; i < 16; i++) {
      leaves.push({ p: [-0.9 - lr() * 0.9, 2.1 + lr() * 0.9, -1.1 - lr() * 1.2], s: 0.3 + lr() * 0.25, r: lr() * 6, m: 1, ph: lr() * 6 });
    }
    const roses: Array<[number, number, number, number]> = [];
    for (let i = 0; i < 12; i++) {
      const L = leaves[Math.floor(lr() * 26)];
      roses.push([L.p[0] + (lr() - 0.5) * 0.1, L.p[1] + (lr() - 0.5) * 0.1, L.p[2] + 0.03, 0.05 + lr() * 0.03]);
    }
    const card = new THREE.PlaneGeometry(1, 1);

    /* ── a beam of sunlight: the opening swept along the sun's direction ── */
    const beam = (() => {
      const L = 3.2;
      const d = SUN_DIR.clone().multiplyScalar(-L);
      const zc = WALL_Z - WALL_T;
      const c = [
        new THREE.Vector3(WIN.x0, WIN.y0, zc),
        new THREE.Vector3(WIN.x1, WIN.y0, zc),
        new THREE.Vector3(WIN.x1, WIN.y1, zc),
        new THREE.Vector3(WIN.x0, WIN.y1, zc),
      ];
      const pos: number[] = [];
      const along: number[] = [];
      const across: number[] = [];
      for (let i = 0; i < 4; i++) {
        const a = c[i];
        const b = c[(i + 1) % 4];
        const a2 = a.clone().add(d);
        const b2 = b.clone().add(d);
        pos.push(...a.toArray(), ...b.toArray(), ...b2.toArray(), ...a.toArray(), ...b2.toArray(), ...a2.toArray());
        along.push(0, 0, 1, 0, 1, 1);
        across.push(0, 1, 1, 0, 1, 0);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
      g.setAttribute('aAcross', new THREE.Float32BufferAttribute(across, 1));
      const m = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uTime: windUniforms.uTime, uColor: { value: new THREE.Color(preset.sunGlow) }, uGust: { value: 0 } },
        vertexShader: /* glsl */ `
          attribute float aAlong; attribute float aAcross; varying float vAlong; varying float vAcross; varying vec3 vW;
          void main() { vAlong = aAlong; vAcross = aAcross; vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uTime; uniform vec3 uColor; uniform float uGust; varying float vAlong; varying float vAcross; varying vec3 vW;
          void main() {
            float fade = smoothstep(0.0, 0.12, vAlong) * pow(1.0 - vAlong, 1.6);
            float streak = 0.6 + 0.4 * sin(vAcross * 23.0 + uTime * 0.3) * sin(vAcross * 7.0 - uTime * 0.17 + vW.y * 2.0);
            float edge = smoothstep(0.0, 0.18, vAcross) * smoothstep(1.0, 0.82, vAcross);
            float a = fade * streak * (0.4 + 0.6 * edge) * (0.028 + uGust * 0.01);
            gl_FragColor = vec4(uColor * a, a);
          }`,
      });
      return new THREE.Mesh(g, m);
    })();

    return {
      upper, lower, wallMat, paintMat, trimMat, mouldGeo, sill, apron, frame, sashGeoL, sashGeoR, paneL, paneR, transomGlass,
      glass, frameMat, brass, occ, occMat, floorGeo, floorMat, seamMat, ceiling, rodGeo, pictures, pictureFrame,
      garden, gardenGeo, leafMat, leafMat2, roseMat, leaves, roses, card, beam, sw, sh, fz,
    };
  }, [assets, preset]);

  useFrame((st) => {
    const t = st.clock.elapsedTime;
    const gust = anim.fx.gust ?? 0;
    // the casements breathe on their hinges in the breeze
    if (sashL.current) sashL.current.rotation.y = 1.05 + Math.sin(t * 0.6) * 0.03 + gust * 0.12;
    if (sashR.current) sashR.current.rotation.y = -1.2 - Math.sin(t * 0.5 + 1) * 0.03 - gust * 0.1;
    const o = outside.current;
    if (o) {
      const w = windUniforms.uWind.value + gust;
      for (let i = 0; i < o.children.length; i++) {
        const c = o.children[i];
        const ph = (c.userData.ph as number) ?? 0;
        c.rotation.z = (c.userData.r as number) + Math.sin(t * 1.3 + ph) * 0.06 * (0.5 + w);
        c.position.x = (c.userData.x as number) + Math.sin(t * 0.9 + ph) * 0.008 * (0.5 + w);
      }
    }
    (res.beam.material as THREE.ShaderMaterial).uniforms.uGust.value = gust;
  });

  const shadowWalls = quality !== 'low';
  return (
    <>
      <mesh geometry={res.upper} material={res.wallMat} receiveShadow />
      <mesh geometry={res.lower} material={res.paintMat} receiveShadow />
      <mesh geometry={res.mouldGeo} material={res.trimMat} receiveShadow />
      <mesh geometry={res.sill} material={res.trimMat} receiveShadow castShadow />
      <mesh geometry={res.apron} material={res.trimMat} />
      <mesh geometry={res.frame} material={res.frameMat} castShadow />
      <mesh geometry={res.transomGlass} material={res.glass} renderOrder={4} />
      <group position={[WIN.x0 + 0.05, WIN.y0 + 0.05, res.fz]}>
        <group ref={sashL}>
          <mesh geometry={res.sashGeoL} material={res.frameMat} castShadow />
          <mesh geometry={res.paneL} material={res.glass} renderOrder={4} />
          <mesh material={res.brass} position={[res.sw - 0.03, res.sh / 2, 0.03]}>
            <sphereGeometry args={[0.01, 10, 8]} />
          </mesh>
        </group>
      </group>
      <group position={[WIN.x1 - 0.05, WIN.y0 + 0.05, res.fz]}>
        <group ref={sashR}>
          <mesh geometry={res.sashGeoR} material={res.frameMat} castShadow />
          <mesh geometry={res.paneR} material={res.glass} renderOrder={4} />
        </group>
      </group>
      {shadowWalls && <mesh geometry={res.occ} material={res.occMat} castShadow />}
      <mesh geometry={res.floorGeo} material={res.floorMat} receiveShadow />
      <mesh material={res.seamMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, (WALL_Z + ROOM.zFront) / 2]}>
        <planeGeometry args={[ROOM.x1 - ROOM.x0, ROOM.zFront - WALL_Z]} />
      </mesh>
      <mesh geometry={res.ceiling} material={res.paintMat} />
      <mesh geometry={res.rodGeo} material={res.brass} />
      {res.pictures.map((p, i) => (
        <group key={i}>
          <mesh geometry={p.geo} material={res.pictureFrame} />
          <mesh geometry={p.print} material={p.mat} />
        </group>
      ))}
      <mesh geometry={res.gardenGeo} material={res.garden} />
      <group ref={outside}>
        {res.leaves.map((l, i) => (
          <mesh key={i} geometry={res.card} material={l.m ? res.leafMat2 : res.leafMat} position={l.p} scale={l.s} rotation={[0, 0.2, l.r]} userData={{ r: l.r, x: l.p[0], ph: l.ph }} castShadow />
        ))}
        {res.roses.map(([x, y, z, s], i) => (
          <mesh key={`r${i}`} geometry={res.card} material={res.roseMat} position={[x, y, z]} scale={s} userData={{ r: i, x, ph: i }} castShadow />
        ))}
      </group>
      {quality !== 'low' && <primitive object={res.beam} />}
    </>
  );
}

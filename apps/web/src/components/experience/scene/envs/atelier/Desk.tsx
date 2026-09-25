'use client';
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { anim, type Quality } from '../../../store';
import type { SceneAssets } from '../../assets';
import { merge } from '../../geometry';
import { windUniforms } from '../../Ground';
import { mulberry32 } from '../../noise';
import { featherCanvas, leatherCanvas, DESK, DESK_Y, SILL_Y, WALL_Z } from './room';

const lathe = (pts: Array<[number, number]>, seg = 32) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

function box(w: number, h: number, d: number, x: number, y: number, z: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

/** A writing desk by the window, and everything a letter writer keeps on it. */
export function Desk({ assets, quality, accent }: { assets: SceneAssets; quality: Quality; accent: string }) {
  const flame = useRef<THREE.Mesh>(null!);
  const candleLight = useRef<THREE.PointLight>(null!);
  const steam = useRef<THREE.Group>(null!);
  const flowers = useRef<THREE.Group>(null!);
  const plant = useRef<THREE.Group>(null!);
  const { camera } = useThree();

  const res = useMemo(() => {
    /* ── the desk ── */
    const topMap = assets.env.desk.clone();
    const topNrm = assets.env.deskNormal.clone();
    const topRough = assets.env.deskRough.clone();
    for (const t of [topMap, topNrm, topRough]) {
      t.repeat.set(1.7, 7);
      t.needsUpdate = true;
    }
    const wood = new THREE.MeshPhysicalMaterial({ map: topMap, normalMap: topNrm, normalScale: new THREE.Vector2(0.12, 0.12), roughnessMap: topRough, roughness: 0.6, clearcoat: 0.5, clearcoatRoughness: 0.25, color: '#b99a82' });
    const woodSide = new THREE.MeshStandardMaterial({ map: assets.env.desk, roughness: 0.6, color: '#a8876c' });
    const top = new THREE.BoxGeometry(DESK.w, 0.035, DESK.d);
    top.translate(DESK.cx, DESK_Y - 0.0175, DESK.cz);
    const lip = merge([
      // the gallery rail along the back
      box(DESK.w - 0.04, 0.05, 0.018, DESK.cx, DESK_Y + 0.025, DESK.cz - DESK.d / 2 + 0.012),
      box(0.018, 0.05, 0.12, DESK.cx - DESK.w / 2 + 0.03, DESK_Y + 0.025, DESK.cz - DESK.d / 2 + 0.07),
      box(0.018, 0.05, 0.12, DESK.cx + DESK.w / 2 - 0.03, DESK_Y + 0.025, DESK.cz - DESK.d / 2 + 0.07),
    ]);
    const apron = merge([
      box(DESK.w - 0.1, 0.1, 0.02, DESK.cx, DESK_Y - 0.085, DESK.cz + DESK.d / 2 - 0.05),
      box(DESK.w - 0.1, 0.1, 0.02, DESK.cx, DESK_Y - 0.085, DESK.cz - DESK.d / 2 + 0.05),
      box(0.02, 0.1, DESK.d - 0.1, DESK.cx - DESK.w / 2 + 0.05, DESK_Y - 0.085, DESK.cz),
      box(0.02, 0.1, DESK.d - 0.1, DESK.cx + DESK.w / 2 - 0.05, DESK_Y - 0.085, DESK.cz),
    ]);
    // a drawer front with a brass pull
    const drawer = box(0.5, 0.075, 0.012, DESK.cx, DESK_Y - 0.085, DESK.cz + DESK.d / 2 - 0.035);
    const legs: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const g = new THREE.CylinderGeometry(0.026, 0.016, DESK_Y - 0.035, 4, 1);
        g.rotateY(Math.PI / 4);
        g.translate(DESK.cx + sx * (DESK.w / 2 - 0.06), (DESK_Y - 0.035) / 2, DESK.cz + sz * (DESK.d / 2 - 0.06));
        legs.push(g);
      }
    const legGeo = merge(legs);
    const brass = new THREE.MeshStandardMaterial({ color: '#c9a45c', roughness: 0.28, metalness: 1 });

    /* ── leather blotter ── */
    const blotter = new THREE.BoxGeometry(0.42, 0.003, 0.3);
    blotter.translate(0.05, DESK_Y + 0.0015, 0.07);
    const blotterMat = new THREE.MeshStandardMaterial({ map: leatherCanvas('#2c4636'), roughness: 0.7, color: '#8aa092' });

    /* ── books: a stack at the back left, cloth covers ── */
    const books: Array<{ geo: THREE.BufferGeometry; mat: THREE.Material; p: [number, number, number]; ry: number }> = [];
    const pageMat = new THREE.MeshStandardMaterial({ color: '#efe5cf', roughness: 0.95 });
    const dims = [
      [0.25, 0.04, 0.18],
      [0.22, 0.032, 0.16],
      [0.19, 0.045, 0.135],
    ];
    let y = DESK_Y;
    dims.forEach(([w, h, d], i) => {
      const map = assets.env.books.clone();
      map.repeat.set(1, 1 / 6);
      map.offset.set(0, ((i * 2 + 1) % 6) / 6);
      map.needsUpdate = true;
      const cover = new THREE.MeshStandardMaterial({ map, roughness: 0.75 });
      // box faces: +x -x +y -y +z -z — pages on three sides
      const mats = [pageMat, cover, cover, cover, pageMat, pageMat];
      const g = new THREE.BoxGeometry(w, h, d);
      books.push({ geo: g, mat: mats as unknown as THREE.Material, p: [-0.44 + i * 0.01, y + h / 2, -0.2 + i * 0.012], ry: [0.08, -0.12, 0.22][i] });
      y += h;
    });
    const bookTop = y;

    /* ── candle on the books ── */
    const holder = lathe([[0, 0], [0.04, 0], [0.042, 0.004], [0.016, 0.01], [0.012, 0.03], [0.02, 0.034], [0.02, 0.04], [0, 0.04]]);
    const candle = new THREE.CylinderGeometry(0.0115, 0.012, 0.11, 20);
    candle.translate(0, 0.04 + 0.055, 0);
    const wax = new THREE.MeshPhysicalMaterial({ color: '#f6efe0', roughness: 0.5, sheen: 0.3, sheenColor: new THREE.Color('#fff4dc') });
    const flameTex = (() => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 128;
      const g = c.getContext('2d')!;
      const gr = g.createRadialGradient(32, 84, 2, 32, 76, 40);
      gr.addColorStop(0, 'rgba(255,255,240,1)');
      gr.addColorStop(0.3, 'rgba(255,214,120,0.9)');
      gr.addColorStop(0.7, 'rgba(255,140,40,0.3)');
      gr.addColorStop(1, 'rgba(255,120,20,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(32, 8);
      g.bezierCurveTo(52, 60, 50, 110, 32, 118);
      g.bezierCurveTo(14, 110, 12, 60, 32, 8);
      g.fill();
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const flameMat = new THREE.MeshBasicMaterial({ map: flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(1.6, 1.4, 1.1) });

    /* ── inkwell + quill ── */
    const inkwell = lathe([[0, 0], [0.034, 0], [0.036, 0.004], [0.036, 0.026], [0.03, 0.036], [0.014, 0.04], [0.013, 0.048], [0.0, 0.048]], 28);
    const inkGlass = new THREE.MeshPhysicalMaterial({ color: '#27313a', roughness: 0.06, metalness: 0, clearcoat: 1, envMapIntensity: 1.4 });
    const collar = new THREE.CylinderGeometry(0.0155, 0.0155, 0.007, 20);
    collar.translate(0, 0.049, 0);
    const feather = new THREE.PlaneGeometry(0.05, 0.26, 1, 8);
    feather.translate(0, 0.13, 0);
    // a gentle curve along the feather
    const fp = feather.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < fp.count; i++) {
      const yy = fp.getY(i);
      fp.setZ(i, Math.pow(yy / 0.26, 2) * 0.03);
    }
    feather.computeVertexNormals();
    const featherMat = new THREE.MeshStandardMaterial({ map: featherCanvas(), alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.8 });

    /* ── teacup and saucer ── */
    const saucer = lathe([[0, 0], [0.05, 0], [0.068, 0.006], [0.074, 0.011], [0.072, 0.012], [0.05, 0.006], [0, 0.005]], 40);
    const cup = lathe([[0, 0.006], [0.024, 0.006], [0.026, 0.01], [0.036, 0.03], [0.042, 0.056], [0.0425, 0.06], [0.04, 0.06], [0.036, 0.034], [0.025, 0.015], [0, 0.014]], 40);
    const handle = new THREE.TorusGeometry(0.014, 0.0035, 8, 20, Math.PI * 1.3);
    handle.rotateZ(-Math.PI * 0.65);
    handle.translate(0.046, 0.038, 0);
    const porcelain = new THREE.MeshPhysicalMaterial({ color: '#fbf8f2', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 });
    const rim = new THREE.MeshStandardMaterial({ color: '#c9a45c', roughness: 0.3, metalness: 1 });
    const rimGeo = new THREE.TorusGeometry(0.0412, 0.0011, 6, 40);
    rimGeo.rotateX(Math.PI / 2);
    rimGeo.translate(0, 0.0602, 0);
    const tea = new THREE.CircleGeometry(0.038, 32);
    tea.rotateX(-Math.PI / 2);
    tea.translate(0, 0.05, 0);
    const teaMat = new THREE.MeshPhysicalMaterial({ color: '#7a3d17', roughness: 0.05, clearcoat: 1 });
    const steamMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uTime: windUniforms.uTime },
      vertexShader: /* glsl */ `varying vec2 vUv; uniform float uTime; attribute float aSeed; varying float vSeed;
        void main(){ vUv = uv; vSeed = 0.0; vec3 p = position; p.x += sin(uv.y * 5.0 + uTime * 1.3) * 0.012 * uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
      fragmentShader: /* glsl */ `varying vec2 vUv; uniform float uTime;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
        void main(){
          vec2 q = vec2(vUv.x * 3.0 + sin(vUv.y * 6.0 - uTime) * 0.4, vUv.y * 4.0 - uTime * 0.6);
          float w = n(q) * n(q * 2.1 + 3.0);
          float core = exp(-pow((vUv.x - 0.5 - sin(vUv.y * 4.0 + uTime * 0.8) * 0.15) * 4.0, 2.0));
          float a = smoothstep(0.08, 0.5, w) * core * smoothstep(0.0, 0.15, vUv.y) * (1.0 - vUv.y) * 0.22;
          gl_FragColor = vec4(vec3(1.0), a);
        }`,
    });
    const steamGeo = new THREE.PlaneGeometry(0.06, 0.2, 1, 12);
    steamGeo.translate(0, 0.1 + 0.055, 0);

    /* ── vase of sweet peas at the back right ── */
    const vase = lathe([[0, 0], [0.03, 0], [0.042, 0.03], [0.044, 0.07], [0.03, 0.12], [0.022, 0.15], [0.028, 0.17], [0.026, 0.172], [0.0, 0.16]], 32);
    const vaseMat = new THREE.MeshPhysicalMaterial({ color: '#a9c3c7', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 });
    const rnd = mulberry32(33);
    const stemMat = new THREE.MeshStandardMaterial({ color: '#5f7d3c', roughness: 0.8 });
    const petalCols = ['#f3b3c7', '#e98fae', '#fff2f5', '#c7a0e0', accent];
    const bloomMats = petalCols.map((c) => new THREE.MeshStandardMaterial({ map: assets.flower, alphaTest: 0.4, color: c, roughness: 0.6, side: THREE.DoubleSide }));
    const stems: THREE.BufferGeometry[] = [];
    const blooms: Array<{ p: THREE.Vector3; m: number; s: number; r: THREE.Euler }> = [];
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2;
      const lean = 0.2 + rnd() * 0.5;
      const len = 0.09 + rnd() * 0.09;
      const tip = new THREE.Vector3(Math.cos(a) * Math.sin(lean) * len, 0.15 + Math.cos(lean) * len, Math.sin(a) * Math.sin(lean) * len);
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.1, 0), new THREE.Vector3(tip.x * 0.3, 0.2, tip.z * 0.3), tip);
      stems.push(new THREE.TubeGeometry(curve, 8, 0.0018, 4, false));
      for (let k = 0; k < 3; k++) blooms.push({ p: tip.clone().add(new THREE.Vector3((rnd() - 0.5) * 0.025, -k * 0.018, (rnd() - 0.5) * 0.025)), m: Math.floor(rnd() * petalCols.length), s: 0.034 + rnd() * 0.022, r: new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3) });
    }
    const stemGeo = merge(stems);
    const card = new THREE.PlaneGeometry(1, 1);

    /* ── potted herb on the sill ── */
    const pot = lathe([[0, 0], [0.045, 0], [0.055, 0.08], [0.06, 0.082], [0.06, 0.095], [0.0, 0.095]], 28);
    const potMat = new THREE.MeshStandardMaterial({ color: '#b86a45', roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ map: assets.cluster, alphaTest: 0.45, color: '#6f9c4c', roughness: 0.75, side: THREE.DoubleSide });
    const herb: Array<{ p: [number, number, number]; r: [number, number, number]; s: number }> = [];
    for (let i = 0; i < 9; i++) herb.push({ p: [(rnd() - 0.5) * 0.08, 0.12 + rnd() * 0.08, (rnd() - 0.5) * 0.08], r: [rnd() * 3, rnd() * 3, rnd() * 3], s: 0.1 + rnd() * 0.06 });

    return {
      wood, woodSide, top, lip, apron, drawer, legGeo, brass, blotter, blotterMat, books, bookTop, holder, candle, wax, flameMat,
      inkwell, inkGlass, collar, feather, featherMat, saucer, cup, handle, porcelain, rim, rimGeo, tea, teaMat, steamMat, steamGeo,
      vase, vaseMat, stemGeo, stemMat, blooms, bloomMats, card, pot, potMat, leafMat, herb,
    };
  }, [assets, quality, accent]);

  const candlePos: [number, number, number] = [-0.42, res.bookTop, -0.2];
  const flamePos = new THREE.Vector3(candlePos[0], candlePos[1] + 0.162, candlePos[2]);

  useFrame((st) => {
    const t = st.clock.elapsedTime;
    const gust = anim.fx.gust ?? 0;
    // candle: flicker, and the flame leans away from the window when the wind comes in
    const fl = 1 + Math.sin(t * 13) * 0.05 + Math.sin(t * 29 + 1) * 0.04 + Math.sin(t * 5.3) * 0.05;
    const f = flame.current;
    if (f) {
      f.scale.set(0.028 * (1 - gust * 0.2), 0.055 * fl * (1 - gust * 0.25), 1);
      f.position.copy(flamePos);
      f.position.z += gust * 0.006;
      f.lookAt(camera.position.x, f.position.y, camera.position.z);
      f.rotateX(-gust * 0.35);
    }
    if (candleLight.current) candleLight.current.intensity = 0.25 * fl * (1 - gust * 0.3);
    // steam faces the viewer, blown sideways by gusts
    const s = steam.current;
    if (s) {
      s.children.forEach((c, i) => {
        c.lookAt(camera.position.x, c.position.y + s.position.y, camera.position.z);
        c.rotation.z = gust * 0.5 + Math.sin(t * 0.4 + i) * 0.05;
      });
    }
    const w = windUniforms.uWind.value * 0.3 + gust;
    if (flowers.current) flowers.current.rotation.z = Math.sin(t * 1.1) * 0.012 * w;
    if (plant.current) plant.current.children.forEach((c, i) => (c.rotation.z = res.herb[i].r[2] + Math.sin(t * 1.7 + i) * 0.08 * (0.3 + w)));
  });

  return (
    <>
      <mesh geometry={res.top} material={res.wood} castShadow receiveShadow />
      <mesh geometry={res.lip} material={res.wood} castShadow receiveShadow />
      <mesh geometry={res.apron} material={res.woodSide} castShadow />
      <mesh geometry={res.drawer} material={res.woodSide} />
      <mesh material={res.brass} position={[DESK.cx, DESK_Y - 0.085, DESK.cz + DESK.d / 2 - 0.022]}>
        <sphereGeometry args={[0.008, 12, 8]} />
      </mesh>
      <mesh geometry={res.legGeo} material={res.woodSide} castShadow receiveShadow />
      <mesh geometry={res.blotter} material={res.blotterMat} receiveShadow />
      {res.books.map((b, i) => (
        <mesh key={i} geometry={b.geo} material={b.mat} position={b.p} rotation={[0, b.ry, 0]} castShadow receiveShadow />
      ))}
      <group position={candlePos}>
        <mesh geometry={res.holder} material={res.brass} castShadow />
        <mesh geometry={res.candle} material={res.wax} castShadow receiveShadow />
        <mesh position={[0, 0.152, 0]}>
          <cylinderGeometry args={[0.0008, 0.0008, 0.012, 4]} />
          <meshBasicMaterial color="#2a2018" />
        </mesh>
      </group>
      <mesh ref={flame} material={res.flameMat} renderOrder={6}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <pointLight ref={candleLight} position={flamePos} color="#ffb36b" intensity={0.25} distance={1.4} decay={2} />
      <group position={[0.31, DESK_Y, -0.17]}>
        <mesh geometry={res.inkwell} material={res.inkGlass} castShadow receiveShadow />
        <mesh geometry={res.collar} material={res.brass} />
        <mesh geometry={res.feather} material={res.featherMat} position={[0, 0.03, 0]} rotation={[-0.32, 0.5, -0.28]} castShadow />
      </group>
      <group position={[0.46, DESK_Y, 0.12]} rotation={[0, -0.5, 0]}>
        <mesh geometry={res.saucer} material={res.porcelain} castShadow receiveShadow />
        <group position={[0, 0.006, 0]}>
          <mesh geometry={res.cup} material={res.porcelain} castShadow receiveShadow />
          <mesh geometry={res.handle} material={res.porcelain} castShadow />
          <mesh geometry={res.rimGeo} material={res.rim} />
          <mesh geometry={res.tea} material={res.teaMat} />
        </group>
      </group>
      <group ref={steam} position={[0.46, DESK_Y, 0.12]}>
        <mesh geometry={res.steamGeo} material={res.steamMat} position={[0, 0, 0]} renderOrder={7} />
        <mesh geometry={res.steamGeo} material={res.steamMat} position={[0.008, 0.01, 0.005]} scale={[0.8, 1.2, 1]} renderOrder={7} />
      </group>
      <group position={[0.5, DESK_Y, -0.22]}>
        <mesh geometry={res.vase} material={res.vaseMat} castShadow receiveShadow />
        <group ref={flowers}>
          <mesh geometry={res.stemGeo} material={res.stemMat} castShadow />
          {res.blooms.map((b, i) => (
            <mesh key={i} geometry={res.card} material={res.bloomMats[b.m]} position={b.p} rotation={b.r} scale={b.s} castShadow />
          ))}
        </group>
      </group>
      <group position={[0.34, SILL_Y, WALL_Z - 0.06]}>
        <mesh geometry={res.pot} material={res.potMat} castShadow receiveShadow />
        <group ref={plant}>
          {res.herb.map((h, i) => (
            <mesh key={i} geometry={res.card} material={res.leafMat} position={h.p} rotation={h.r} scale={h.s} castShadow />
          ))}
        </group>
      </group>
    </>
  );
}

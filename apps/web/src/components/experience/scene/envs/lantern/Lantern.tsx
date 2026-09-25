'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { anim, useExperience, type Quality } from '../../../store';
import { sfx } from '../../../audio';
import { LETTER, type SceneAssets } from '../../assets';
import { merge } from '../../geometry';
import { windUniforms } from '../../Ground';
import { sceneRefs } from '../../refs';
import { bob, LANTERN, LANTERN_NEAR, LANTERN_REST, lanternUniforms, smooth } from './lake';

const { w: W, h: H, base: B } = LANTERN;

/**
 * The floating paper lantern: a light wooden frame, washi panels lit from inside by a candle,
 * a two-flap lid. The folded letter stands inside, its silhouette showing through the paper.
 */
export function Lantern({ assets, paper, seal, quality, onOpen }: { assets: SceneAssets; paper: string; seal: string; quality: Quality; onOpen: () => void }) {
  const group = useRef<THREE.Group>(null!);
  const lidA = useRef<THREE.Group>(null!);
  const lidB = useRef<THREE.Group>(null!);
  const flame = useRef<THREE.Mesh>(null!);
  const light = useRef<THREE.PointLight>(null!);
  const { camera, size } = useThree();

  const res = useMemo(() => {
    const wood = new THREE.MeshStandardMaterial({ color: '#4a3526', roughness: 0.8 });
    const t = 0.012;
    const frame = merge([
      // vertical corner sticks
      ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => new THREE.BoxGeometry(t, H, t).translate((sx * (W - t)) / 2, B + H / 2, (sz * (W - t)) / 2))),
      // rims top and bottom
      ...[B + t / 2, B + H - t / 2].flatMap((y) => [
        new THREE.BoxGeometry(W, t, t).translate(0, y, (W - t) / 2),
        new THREE.BoxGeometry(W, t, t).translate(0, y, -(W - t) / 2),
        new THREE.BoxGeometry(t, t, W).translate((W - t) / 2, y, 0),
        new THREE.BoxGeometry(t, t, W).translate(-(W - t) / 2, y, 0),
      ]),
    ]);
    const baseGeo = new THREE.BoxGeometry(W + 0.04, B, W + 0.04).translate(0, B / 2 - 0.012, 0);
    const baseMat = new THREE.MeshStandardMaterial({ color: '#3d2c20', roughness: 0.9 });
    // glowing washi panels: brightest low in the middle, where the candle is
    const washi = assets.env.washi;
    const panelUniforms = {
      uMap: { value: washi },
      uPaper: { value: new THREE.Color(paper) },
      uWarm: { value: new THREE.Color(1.0, 0.6, 0.26) },
      uGlow: { value: 1 },
      uTime: windUniforms.uTime,
    };
    const panelMat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      uniforms: panelUniforms,
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform vec3 uPaper; uniform vec3 uWarm; uniform float uGlow; uniform float uTime;
        varying vec2 vUv;
        void main() {
          float fib = texture2D(uMap, vUv * 1.3).r;
          vec2 c = vUv - vec2(0.5, 0.28);
          float g = exp(-dot(c * vec2(1.4, 1.0), c * vec2(1.4, 1.0)) * 5.0);
          float flick = 0.92 + 0.08 * sin(uTime * 11.0) * sin(uTime * 7.3 + 1.0);
          vec3 col = uPaper * uWarm * (0.3 + g * 1.35 * flick) * uGlow * (0.75 + 0.35 * fib);
          // a faint wax-seal stamp on the paper, and darker edges
          float edge = smoothstep(0.0, 0.06, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
          col *= 0.7 + 0.3 * edge;
          gl_FragColor = vec4(col, 0.93);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const panel = new THREE.PlaneGeometry(W - 0.006, H - 0.006);
    const panels = [
      { p: [0, B + H / 2, W / 2 - 0.004], r: [0, 0, 0] },
      { p: [0, B + H / 2, -W / 2 + 0.004], r: [0, Math.PI, 0] },
      { p: [W / 2 - 0.004, B + H / 2, 0], r: [0, Math.PI / 2, 0] },
      { p: [-W / 2 + 0.004, B + H / 2, 0], r: [0, -Math.PI / 2, 0] },
    ] as Array<{ p: [number, number, number]; r: [number, number, number] }>;
    // lid flaps hinge at the top front / back edges
    const flap = new THREE.PlaneGeometry(W - 0.006, W / 2 - 0.004);
    flap.rotateX(-Math.PI / 2);
    flap.translate(0, 0, (W / 2 - 0.004) / 2);
    const candle = new THREE.CylinderGeometry(0.02, 0.022, 0.06, 16).translate(0, B + 0.03, -0.075);
    const wax = new THREE.MeshStandardMaterial({ color: '#f3ead8', roughness: 0.6, emissive: new THREE.Color('#ffb566'), emissiveIntensity: 0.25 });
    const flameTex = (() => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 128;
      const g = c.getContext('2d')!;
      const gr = g.createRadialGradient(32, 84, 2, 32, 76, 40);
      gr.addColorStop(0, 'rgba(255,255,240,1)');
      gr.addColorStop(0.3, 'rgba(255,210,120,0.9)');
      gr.addColorStop(0.7, 'rgba(255,140,40,0.3)');
      gr.addColorStop(1, 'rgba(255,120,20,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(32, 8);
      g.bezierCurveTo(52, 60, 50, 110, 32, 118);
      g.bezierCurveTo(14, 110, 12, 60, 32, 8);
      g.fill();
      const tx = new THREE.CanvasTexture(c);
      tx.colorSpace = THREE.SRGBColorSpace;
      return tx;
    })();
    const flameMat = new THREE.MeshBasicMaterial({ map: flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(1.8, 1.5, 1.1) });
    const seam = new THREE.MeshBasicMaterial({ color: seal });
    // the lantern's floor, lit only by its own candle: an unlit warm glow instead of a blown-out lit surface
    const floorUniforms = { uGlow: panelUniforms.uGlow };
    const floorMat = new THREE.ShaderMaterial({
      uniforms: floorUniforms,
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uGlow; varying vec2 vUv;
        void main() {
          vec2 c = vUv - vec2(0.5, 0.75);
          float g = exp(-dot(c, c) * 9.0);
          vec3 col = mix(vec3(0.16, 0.09, 0.05), vec3(0.95, 0.62, 0.32), g) * uGlow;
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    // a ribbon of the seal colour around the top rim (four strips: the top stays open)
    const by = B + H - 0.02;
    const band = merge([
      new THREE.BoxGeometry(W + 0.004, 0.012, 0.004).translate(0, by, W / 2),
      new THREE.BoxGeometry(W + 0.004, 0.012, 0.004).translate(0, by, -W / 2),
      new THREE.BoxGeometry(0.004, 0.012, W + 0.004).translate(W / 2, by, 0),
      new THREE.BoxGeometry(0.004, 0.012, W + 0.004).translate(-W / 2, by, 0),
    ]);
    const floor = new THREE.PlaneGeometry(W - 0.012, W - 0.012).rotateX(-Math.PI / 2).translate(0, B + 0.001, 0);
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
    return { wood, frame, baseGeo, baseMat, panelMat, panelUniforms, panel, panels, flap, candle, wax, flameMat, seam, hitMat, floor, floorMat, band };
  }, [assets, paper, seal]);

  const v = useMemo(() => ({ p: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler(), tip: new THREE.Vector3(), rippleAt: -1 }), []);

  /** where the lantern is right now: drifting, drawn in to the jetty, or rising into the sky */
  const pose = (t: number, out: { p: THREE.Vector3; q: THREE.Quaternion }) => {
    const d = smooth(anim.fx.drift ?? 0);
    const F = anim.flyAway;
    out.p.lerpVectors(LANTERN_REST, LANTERN_NEAR, d);
    out.p.x += Math.sin(t * 0.21) * 0.05 * (1 - d);
    out.p.z += Math.cos(t * 0.17) * 0.03 * (1 - d);
    out.p.y = bob(t) + anim.hover * 0.01;
    let yaw = 0.25 * (1 - d) + Math.sin(t * 0.3) * 0.08 * (1 - d * 0.7);
    let tilt = Math.sin(t * 0.8) * 0.02;
    if (F > 0) {
      // released: lifts off the water and floats up and away into the stars
      const k = F;
      out.p.y += k * k * 7 + k * 0.25;
      out.p.z -= k * 3.2;
      out.p.x += Math.sin(k * 3 + 0.5) * 0.35 * k;
      yaw += k * 1.2;
      tilt += Math.sin(t * 1.4) * 0.05 * k;
    }
    out.q.setFromEuler(v.e.set(tilt, yaw, tilt * 0.6));
  };

  // the folded letter stands inside, and rises out of the lantern with `slide`
  useEffect(() => {
    const o = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
    const off = new THREE.Vector3();
    const lean = new THREE.Quaternion();
    const e = new THREE.Euler();
    sceneRefs.letterSource = (out, t) => {
      pose(t, o);
      const s = smooth(anim.slide);
      // origin at the fold (top edge of the folded sheet); the sheet hangs LH/2 below it
      off.set(0, B + 0.004 + LETTER.h / 2 + s * (H + 0.05), 0.02).applyQuaternion(o.q);
      out.p.copy(o.p).add(off);
      lean.setFromEuler(e.set(-s * 0.25, 0, 0));
      out.q.copy(o.q).multiply(lean);
    };
    return () => {
      sceneRefs.letterSource = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((st, dt) => {
    const g = group.current;
    if (!g) return;
    const t = st.clock.elapsedTime;
    const phase = useExperience.getState().phase;
    const hoverTarget = phase === 'idle' && sceneRefs.pointerInside ? 1 : 0;
    anim.hover += (hoverTarget - anim.hover) * Math.min(1, dt * 6);
    pose(t, v);
    g.position.copy(v.p);
    g.quaternion.copy(v.q);

    // lid: two flaps fold open, and close again before it is released
    const lid = smooth(anim.fx.lid ?? 0);
    // the back flap stands up behind the letter; the front one folds right down over the side, out of the way
    lidA.current.rotation.x = -lid * 1.85;
    lidB.current.rotation.x = -lid * 2.75;

    // candle
    const glow = 1 + (anim.fx.glow ?? 0) * 0.5 + anim.hover * 0.15;
    const fl = 1 + Math.sin(t * 13) * 0.05 + Math.sin(t * 29 + 1) * 0.04 + Math.sin(t * 5.3) * 0.06;
    res.panelUniforms.uGlow.value = glow * (0.97 + 0.03 * fl);
    const f = flame.current;
    f.scale.set(0.035, 0.07 * fl, 1);
    f.lookAt(camera.position.x, g.getWorldPosition(v.tip).y + 0.11, camera.position.z);
    if (light.current) light.current.intensity = 1.6 * glow * fl * (quality === 'low' ? 0.8 : 1);

    // the water knows where we are (warm reflection) and ripples as the lantern is drawn in
    lanternUniforms.uLanterns.value[0].set(v.p.x, v.p.y + 0.18, v.p.z, Math.max(0, 1 - anim.flyAway * 2.5) * glow);
    const drift = anim.fx.drift ?? 0;
    if (drift > 0.02 && drift < 0.98 && t - v.rippleAt > 0.9) {
      v.rippleAt = t;
      lanternUniforms.uRipple.value.set(v.p.x, v.p.z, t, 1);
    }

    // hint over the lantern
    v.tip.set(0, B + H + 0.04, 0).applyMatrix4(g.matrixWorld).project(camera);
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
    <group ref={group}>
      <mesh geometry={res.baseGeo} material={res.baseMat} castShadow receiveShadow />
      <mesh geometry={res.frame} material={res.wood} castShadow />
      <mesh geometry={res.floor} material={res.floorMat} />
      {res.panels.map((pn, i) => (
        <mesh key={i} geometry={res.panel} material={res.panelMat} position={pn.p} rotation={pn.r} renderOrder={6} />
      ))}
      {/* a ribbon of the seal colour around the top rim */}
      <mesh geometry={res.band} material={res.seam} />
      <group position={[0, B + H, -W / 2 + 0.004]} ref={lidA}>
        <mesh geometry={res.flap} material={res.panelMat} renderOrder={6} />
      </group>
      <group position={[0, B + H, W / 2 - 0.004]} rotation={[0, Math.PI, 0]}>
        <group ref={lidB}>
          <mesh geometry={res.flap} material={res.panelMat} rotation={[0, 0, 0]} renderOrder={6} />
        </group>
      </group>
      <mesh geometry={res.candle} material={res.wax} />
      <mesh ref={flame} material={res.flameMat} position={[0, B + 0.1, -0.075]} renderOrder={7}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <pointLight ref={light} position={[0, B + 0.22, -0.04]} color="#ffae5c" intensity={1.6} distance={3.2} decay={2} />
      <mesh material={res.hitMat} position={[0, B + H / 2, 0]} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
        <boxGeometry args={[W + 0.2, H + 0.25, W + 0.2]} />
      </mesh>
    </group>
  );
}

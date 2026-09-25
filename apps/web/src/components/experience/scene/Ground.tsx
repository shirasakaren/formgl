'use client';
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { anim, type Quality } from '../store';
import type { SceneAssets } from './assets';
import { mulberry32 } from './noise';
import type { LightPreset } from './presets';
import { makeCanvas, ctx2d, toTexture } from './textures';

/** shared uniforms so every wind-driven material moves in sync */
export const windUniforms = { uTime: { value: 0 }, uWind: { value: 0.45 } };

export function WindClock() {
  useFrame((s) => {
    windUniforms.uTime.value = s.clock.elapsedTime;
    windUniforms.uWind.value = anim.wind;
  });
  return null;
}

function radialAlpha(inner: number, size = 256) {
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  const gr = g.createRadialGradient(size / 2, size / 2, size * inner * 0.5, size / 2, size / 2, size / 2);
  gr.addColorStop(0, '#fff');
  gr.addColorStop(1, '#000');
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return toTexture(c, { srgb: false });
}

function pathAlpha() {
  const c = makeCanvas(64, 256);
  const g = ctx2d(c);
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#000');
  gr.addColorStop(0.08, '#fff');
  gr.addColorStop(0.92, '#fff');
  gr.addColorStop(1, '#000');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 256);
  // ragged edges
  const r = mulberry32(2);
  g.fillStyle = '#000';
  for (let i = 0; i < 90; i++) {
    const y = r() < 0.5 ? r() * 18 : 256 - r() * 18;
    g.globalAlpha = 0.5;
    g.beginPath();
    g.arc(r() * 64, y, 2 + r() * 5, 0, Math.PI * 2);
    g.fill();
  }
  return toTexture(c, { srgb: false });
}

function grassGeometry() {
  // tapered blade, 5 segments, root at y=0
  const segs = 5;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const w = 0.5 * (1 - t * 0.92);
    pos.push(-w, t, 0, w, t, 0);
    uv.push(0, t, 1, t);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  // normals pointing up-ish gives soft, lawn-like shading
  const n: number[] = [];
  for (let i = 0; i < pos.length / 3; i++) n.push(0, 0.9, 0.44);
  g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  g.setIndex(idx);
  return g;
}

function windMaterial(base: THREE.MeshStandardMaterial, stiffness = 1, rootShade = false) {
  base.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    if (rootShade) {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float vH;');
      shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvH = uv.y;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vH;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(0.32, 1.12, smoothstep(0.0, 1.0, vH));');
    }
    shader.uniforms.uWind = windUniforms.uWind;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime; uniform float uWind;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         #ifdef USE_INSTANCING
           vec3 ipos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
         #else
           vec3 ipos = vec3(0.0);
         #endif
         float h = uv.y;
         float gust = 0.55 + 0.45 * sin(uTime * 0.6 + ipos.x * 0.35 + ipos.z * 0.2);
         float w = (sin(uTime * 1.7 + ipos.x * 2.1 + ipos.z * 1.3) * 0.6 + sin(uTime * 3.1 + ipos.x * 5.0) * 0.25) * uWind * gust;
         transformed.x += w * h * h * 0.35 * ${stiffness.toFixed(2)};
         transformed.z += w * h * h * 0.18 * ${stiffness.toFixed(2)};`,
      );
  };
  return base;
}

export function Ground({ assets, preset, quality }: { assets: SceneAssets; preset: LightPreset; quality: Quality }) {
  const res = useMemo(() => {
    const gravelMap = assets.gravel.map.clone();
    gravelMap.repeat.set(9, 3.2);
    gravelMap.needsUpdate = true;
    const gravelN = assets.gravel.normalMap.clone();
    gravelN.repeat.set(9, 3.2);
    gravelN.needsUpdate = true;
    const path = new THREE.MeshStandardMaterial({
      map: gravelMap,
      normalMap: gravelN,
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughness: 0.95,
      alphaMap: pathAlpha(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const lawnMap = assets.lawn.clone();
    lawnMap.repeat.set(26, 26);
    lawnMap.needsUpdate = true;
    const lawnNear = new THREE.MeshStandardMaterial({ map: lawnMap, roughness: 1, color: new THREE.Color(preset.lawnNear).lerp(new THREE.Color('#ffffff'), 0.35), alphaMap: radialAlpha(0.55), transparent: true, depthWrite: false });
    const farMap = assets.lawn.clone();
    farMap.repeat.set(60, 60);
    farMap.needsUpdate = true;
    const lawnFar = new THREE.MeshBasicMaterial({ map: farMap, color: new THREE.Color(preset.lawnFar).multiplyScalar(1.05), fog: true });

    // grass blades
    const count = quality === 'low' ? 4000 : quality === 'medium' ? 10000 : 18000;
    const rnd = mulberry32(12);
    const blade = grassGeometry();
    const grassMat = windMaterial(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, side: THREE.DoubleSide }), 1, true);
    const grass = new THREE.InstancedMesh(blade, grassMat, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const col = new THREE.Color();
    const cA = new THREE.Color(preset.lawnNear);
    const cB = new THREE.Color(preset.lawnFar);
    const cDry = new THREE.Color('#b9a466');
    let placed = 0;
    let guard = 0;
    while (placed < count && guard++ < count * 6) {
      // denser behind the bench and at the sides, never on the path
      const x = (rnd() - 0.5) * 9;
      const z = -0.55 - Math.pow(rnd(), 1.4) * 6.5 + (rnd() < 0.18 ? rnd() * 3.4 : 0);
      const onPath = z > -0.62 && z < 2.3 && Math.abs(x) < 4.2;
      if (onPath && rnd() > 0.02) continue;
      const hgt = 0.04 + rnd() * 0.09 * (1 + Math.max(0, -z - 1) * 0.15);
      const wdt = 0.005 + rnd() * 0.004;
      e.set((rnd() - 0.5) * 0.5, rnd() * Math.PI, (rnd() - 0.5) * 0.5);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(wdt, hgt, 1));
      grass.setMatrixAt(placed, m);
      col.copy(cA).lerp(cB, rnd() * 0.6);
      if (rnd() < 0.12) col.lerp(cDry, 0.6);
      col.multiplyScalar(0.75 + rnd() * 0.5);
      grass.setColorAt(placed, col);
      placed++;
    }
    grass.count = placed;
    grass.receiveShadow = true;
    grass.frustumCulled = false;

    // fallen leaves on the gravel and the bench
    const leafCount = quality === 'low' ? 30 : 70;
    const leafGeo = new THREE.PlaneGeometry(0.05, 0.05, 2, 2);
    // gentle curl
    const lp = leafGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < lp.count; i++) lp.setZ(i, (lp.getX(i) * lp.getX(i)) * 6);
    leafGeo.computeVertexNormals();
    const leafUv = leafGeo.attributes.uv as THREE.BufferAttribute;
    const leafMat = new THREE.MeshStandardMaterial({ map: assets.leaves, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8 });
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, leafCount);
    // pick autumn cells (2,3) of the atlas via per-instance uv offset
    const offs = new Float32Array(leafCount * 2);
    let li = 0;
    for (let n = 0; n < leafCount; n++) {
      const i = li;
      const onBench = n < 4;
      const x = onBench ? -0.55 + rnd() * 1.1 : (rnd() - 0.5) * 5;
      const z = onBench ? (rnd() - 0.5) * 0.3 : -0.5 + rnd() * 2.6;
      const y = onBench ? 0.451 : 0.003;
      if (onBench && Math.abs(x - 0.05) < 0.2) continue;
      e.set(-Math.PI / 2 + (rnd() - 0.5) * 0.3, 0, rnd() * Math.PI * 2);
      q.setFromEuler(e);
      const s = 0.6 + rnd() * 0.7;
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s));
      leaves.setMatrixAt(i, m);
      const cell = rnd() < 0.5 ? 2 : rnd() < 0.5 ? 3 : 1;
      offs[i * 2] = (cell % 2) * 0.5;
      offs[i * 2 + 1] = (1 - Math.floor(cell / 2)) * 0.5;
      li++;
    }
    leaves.count = li;
    leafGeo.setAttribute('aOff', new THREE.InstancedBufferAttribute(offs, 2));
    for (let i = 0; i < leafUv.count; i++) leafUv.setXY(i, leafUv.getX(i) * 0.5, leafUv.getY(i) * 0.5);
    leafMat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 aOff;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv += aOff;\n#endif');
    };
    leaves.castShadow = true;
    leaves.receiveShadow = true;
    // meadow flowers scattered in the lawn — they melt into colourful bokeh
    const flowerCount = quality === 'low' ? 160 : 520;
    const fgeo = new THREE.PlaneGeometry(0.022, 0.022);
    const fmat = windMaterial(new THREE.MeshStandardMaterial({ map: assets.flower, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6 }), 0.6);
    const flowers = new THREE.InstancedMesh(fgeo, fmat, flowerCount);
    const tints = ['#ffffff', '#fff6d6', '#f7e27a', '#d9c8f0', '#f6c9d6'].map((c) => new THREE.Color(c));
    for (let i = 0; i < flowerCount; i++) {
      const x = (rnd() - 0.5) * 8;
      const z = -0.7 - Math.pow(rnd(), 1.2) * 5.5;
      e.set(-Math.PI / 2 + 0.5 + (rnd() - 0.5) * 0.6, rnd() * 6.28, 0, 'YXZ');
      q.setFromEuler(e);
      const s2 = 0.6 + rnd() * 0.8;
      m.compose(new THREE.Vector3(x, 0.05 + rnd() * 0.08, z), q, new THREE.Vector3(s2, s2, s2));
      flowers.setMatrixAt(i, m);
      flowers.setColorAt(i, tints[Math.floor(rnd() * tints.length)]);
    }
    flowers.receiveShadow = true;
    return { path, lawnNear, lawnFar, grass, leaves, flowers };
  }, [assets, preset, quality]);

  return (
    <group>
      <mesh material={res.lawnFar} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.012, -10]}>
        <planeGeometry args={[160, 160]} />
      </mesh>
      <mesh material={res.lawnNear} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.006, -0.5]} receiveShadow>
        <planeGeometry args={[18, 18]} />
      </mesh>
      <mesh material={res.path} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.85]} receiveShadow renderOrder={2}>
        <planeGeometry args={[12, 3.2]} />
      </mesh>
      <primitive object={res.grass} />
      <primitive object={res.leaves} />
      <primitive object={res.flowers} />
    </group>
  );
}

export { windMaterial };

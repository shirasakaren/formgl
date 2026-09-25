'use client';
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { anim, type Quality } from '../../../store';
import type { SceneAssets } from '../../assets';
import type { LightPreset } from '../../presets';
import { WALL_Z, WIN } from './room';

const W = 0.66;
const H = 2.3;
const TOP = 2.33;

/** Two floor-length sheers. They billow into the room with every gust and glow where the sun is behind them. */
export function Curtains({ assets, preset, quality }: { assets: SceneAssets; preset: LightPreset; quality: Quality }) {
  const res = useMemo(() => {
    const seg = quality === 'low' ? [24, 40] : [48, 80];
    const geo = new THREE.PlaneGeometry(W, H, seg[0], seg[1]);
    geo.translate(0, -H / 2, 0);
    const uniforms = {
      uTime: { value: 0 },
      uGust: { value: 0 },
      uGlow: { value: new THREE.Color(preset.sunGlow).multiplyScalar(0.55) },
    };
    const make = (side: 1 | -1) => {
      const map = assets.env.sheer.clone();
      map.repeat.set(1.4, 3);
      map.needsUpdate = true;
      const m = new THREE.MeshStandardMaterial({
        map,
        color: '#fffaf1',
        roughness: 0.9,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, uniforms, { uSide: { value: side } });
        sh.vertexShader = sh.vertexShader
          .replace(
            '#include <common>',
            /* glsl */ `#include <common>
            uniform float uTime; uniform float uGust; uniform float uSide;
            varying vec3 vWorldC;
            vec3 drape(vec3 p) {
              float u = p.x / ${W.toFixed(3)} + 0.5;
              float v = clamp(-p.y / ${H.toFixed(3)}, 0.0, 1.0);
              // gathered folds, deeper toward the outer edge where the fabric bunches
              float outer = uSide > 0.0 ? u : 1.0 - u;
              float folds = sin(u * 6.2831 * 4.5 + 0.7) * (0.016 + 0.012 * outer) + sin(u * 6.2831 * 10.0 + 1.3) * 0.004;
              // wind: billows into the room, most at the hem and at the window side
              float inner = 1.0 - outer;
              float bil = uGust * pow(v, 1.35) * (0.1 + 0.16 * inner);
              float breeze = (sin(uTime * 1.1 + v * 3.5 + u * 2.0) * 0.5 + 0.5) * 0.03 * pow(v, 1.5)
                + sin(uTime * 2.6 + v * 8.0 + u * 6.0) * 0.006 * v * (0.4 + uGust * 2.0);
              p.z += folds * (1.0 - 0.35 * v) + bil + breeze;
              // hem swings toward the room's middle and lifts a touch
              p.x += -uSide * bil * 0.35 * v;
              p.y += bil * 0.3 * v;
              return p;
            }`,
          )
          .replace(
            '#include <beginnormal_vertex>',
            /* glsl */ `
            vec3 dp0 = drape(position);
            vec3 dpx = drape(position + vec3(0.01, 0.0, 0.0)) - dp0;
            vec3 dpy = drape(position + vec3(0.0, 0.01, 0.0)) - dp0;
            vec3 objectNormal = normalize(cross(dpx, dpy));
            #ifdef USE_TANGENT
              vec3 objectTangent = vec3(tangent.xyz);
            #endif`,
          )
          .replace('#include <begin_vertex>', 'vec3 transformed = dp0;')
          .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldC = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform vec3 uGlow; varying vec3 vWorldC;')
          .replace(
            '#include <emissivemap_fragment>',
            /* glsl */ `#include <emissivemap_fragment>
            // sunlit from behind where the fabric hangs in front of the open window
            float inWin = smoothstep(${WIN.x0.toFixed(2)} - 0.05, ${WIN.x0.toFixed(2)} + 0.08, vWorldC.x) * smoothstep(${WIN.x1.toFixed(2)} + 0.05, ${WIN.x1.toFixed(2)} - 0.08, vWorldC.x)
              * smoothstep(${WIN.y0.toFixed(2)} - 0.1, ${WIN.y0.toFixed(2)} + 0.15, vWorldC.y) * smoothstep(${WIN.y1.toFixed(2)} + 0.1, ${WIN.y1.toFixed(2)} - 0.1, vWorldC.y);
            totalEmissiveRadiance += uGlow * (0.06 + inWin * 1.5) * diffuseColor.a;`,
          );
      };
      m.customProgramCacheKey = () => `curtain${side}`;
      return m;
    };
    return { geo, left: make(-1), right: make(1), uniforms };
  }, [assets, preset, quality]);

  useFrame((st) => {
    const t = st.clock.elapsedTime;
    res.uniforms.uTime.value = t;
    // a soft breathing breeze plus the gusts of the timeline
    const idle = Math.pow(Math.sin(t * 0.23) * 0.5 + 0.5, 3) * 0.25;
    res.uniforms.uGust.value = Math.max(idle, anim.fx.gust ?? 0);
  });

  const z = WALL_Z + 0.075;
  return (
    <>
      <mesh geometry={res.geo} material={res.left} position={[WIN.x0 - 0.2, TOP, z]} renderOrder={5} />
      <mesh geometry={res.geo} material={res.right} position={[WIN.x1 + 0.2, TOP, z]} renderOrder={5} />
    </>
  );
}

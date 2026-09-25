'use client';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Quality } from '../../../store';
import type { SceneAssets } from '../../assets';
import { windUniforms } from '../../Ground';
import { mulberry32 } from '../../noise';

/**
 * A sea of pastel clouds far below, a few towering cumulus on the horizon and
 * thin wisps drifting past close by. Camera-facing instanced puffs, sorted far → near.
 */
export function Clouds({ assets, quality, lit, shade, horizon, sunDir }: { assets: SceneAssets; quality: Quality; lit: string; shade: string; horizon: string; sunDir: THREE.Vector3 }) {
  const mesh = useMemo(() => {
    const rnd = mulberry32(17);
    type Puff = { p: THREE.Vector3; size: number; alpha: number; drift: number };
    const puffs: Puff[] = [];
    const sea = quality === 'low' ? 70 : 130;
    for (let i = 0; i < sea; i++) {
      // a wide disc below us, denser toward the horizon
      const a = rnd() * Math.PI * 2;
      const d = 30 + Math.pow(rnd(), 0.6) * 420;
      puffs.push({ p: new THREE.Vector3(Math.cos(a) * d, -34 - rnd() * 16 + d * 0.02, Math.sin(a) * d), size: 40 + rnd() * 70 + d * 0.12, alpha: 0.85, drift: 0.2 + rnd() * 0.3 });
    }
    const towers = quality === 'low' ? 8 : 14;
    for (let i = 0; i < towers; i++) {
      const a = -Math.PI / 2 + (rnd() - 0.5) * Math.PI * 1.4;
      const d = 150 + rnd() * 220;
      const base = new THREE.Vector3(Math.cos(a) * d, -26 + rnd() * 6, Math.sin(a) * d);
      for (let k = 0; k < 3; k++) {
        puffs.push({ p: base.clone().add(new THREE.Vector3((rnd() - 0.5) * 30, k * 16 + rnd() * 6, (rnd() - 0.5) * 20)), size: 46 - k * 8 + rnd() * 18, alpha: 0.95, drift: 0.3 });
      }
    }
    // close wisps at our height, slowly sliding past
    for (let i = 0; i < 9; i++) {
      const side = i % 2 ? 1 : -1;
      puffs.push({ p: new THREE.Vector3(side * (6 + rnd() * 14), -1.5 + rnd() * 5, -14 - rnd() * 40), size: 8 + rnd() * 10, alpha: 0.35, drift: 1.2 + rnd() });
    }
    puffs.sort((a, b) => b.p.length() - a.p.length());
    const n = puffs.length;
    const offset = new Float32Array(n * 3);
    const data = new Float32Array(n * 4);
    puffs.forEach((q, i) => {
      offset.set([q.p.x, q.p.y, q.p.z], i * 3);
      data.set([q.size, rnd() * 100, q.alpha, q.drift], i * 4);
    });
    const geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 0.62);
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    geo.setAttribute('uv', quad.attributes.uv);
    geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offset, 3));
    geo.setAttribute('aData', new THREE.InstancedBufferAttribute(data, 4));
    geo.instanceCount = n;
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTime: windUniforms.uTime,
        uMap: { value: assets.env.cloud },
        uLit: { value: new THREE.Color(lit).multiplyScalar(1.3) },
        uShade: { value: new THREE.Color(shade) },
        uHorizon: { value: new THREE.Color(horizon) },
        uSun: { value: sunDir.clone().normalize() },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aOffset; attribute vec4 aData;
        uniform float uTime;
        varying vec2 vUv; varying float vA; varying float vDist; varying vec2 vLocal; varying float vSunSide; varying float vSeed;
        void main() {
          vUv = uv; vA = aData.z; vSeed = aData.y;
          vec3 c = aOffset;
          if (aData.z < 0.5) {
            // wisps: slide past us and fade in and out as they go
            float ph = fract(uTime * aData.w * 0.012 + aData.y * 0.37);
            c.x += (ph - 0.5) * 50.0 * sign(aOffset.x);
            vA *= sin(ph * 3.14159);
          } else {
            c.x += sin(uTime * 0.004 * aData.w + aData.y) * 12.0;
          }
          vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          vec3 p = c + (right * position.x + up * position.y) * aData.x;
          vLocal = position.xy;
          vSunSide = dot(normalize(position.xy + vec2(0.0001)), vec2(0.7, 0.55));
          vec4 mv = viewMatrix * vec4(p, 1.0);
          vDist = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform vec3 uLit; uniform vec3 uShade; uniform vec3 uHorizon;
        varying vec2 vUv; varying float vA; varying float vDist; varying vec2 vLocal; varying float vSunSide; varying float vSeed;
        void main() {
          vec4 t = texture2D(uMap, vUv);
          float a = t.a * vA;
          if (a < 0.01) discard;
          // lit crowns, lavender undersides, a warm rim on the sun side
          float h = smoothstep(-0.28, 0.3, vLocal.y);
          vec3 col = mix(uShade, uLit, h * 0.8 + 0.2 * t.r);
          col += uLit * max(vSunSide, 0.0) * 0.12;
          float far = smoothstep(80.0, 480.0, vDist);
          col = mix(col, uHorizon, far * 0.65);
          gl_FragColor = vec4(col, a * (1.0 - far * 0.25));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    m.renderOrder = -1;
    return m;
  }, [assets, quality, lit, shade, horizon, sunDir]);
  return <primitive object={mesh} />;
}

/** The bright floor of cloud tops far below us, fading into the haze at the horizon. */
export function CloudFloor({ lit, shade, horizon }: { lit: string; shade: string; horizon: string }) {
  const mesh = useMemo(() => {
    const geo = new THREE.CircleGeometry(1800, 64);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      fog: false,
      depthWrite: false,
      uniforms: { uTime: windUniforms.uTime, uLit: { value: new THREE.Color(lit).multiplyScalar(1.35) }, uShade: { value: new THREE.Color(shade) }, uHorizon: { value: new THREE.Color(horizon) } },
      vertexShader: /* glsl */ `varying vec3 vW; void main(){ vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec3 uLit; uniform vec3 uShade; uniform vec3 uHorizon; varying vec3 vW;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
        float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s+=a*n(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }
        void main(){
          vec2 p = vW.xz * 0.012 + vec2(uTime * 0.004, 0.0);
          float c = fbm(p);
          // billows: lit crowns toward the sun (ahead-right), shaded folds between
          float lx = fbm(p + vec2(0.04, -0.03));
          float light = clamp(0.55 + (c - lx) * 6.0, 0.0, 1.0);
          vec3 col = mix(uShade, uLit, smoothstep(0.35, 0.75, c) * 0.6 + light * 0.4);
          float d = length(vW.xz - cameraPosition.xz);
          col = mix(col, uHorizon * 1.1, smoothstep(200.0, 1600.0, d) * 0.85);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.y = -42;
    m.renderOrder = -2;
    m.frustumCulled = false;
    return m;
  }, [lit, shade, horizon]);
  return <primitive object={mesh} />;
}

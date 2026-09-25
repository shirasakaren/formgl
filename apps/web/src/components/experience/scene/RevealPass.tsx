'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { seedSprite, toTexture } from './textures';
import { hexToRgb } from './noise';

/*
 * The solid loading colour breaks apart into thousands of dandelion seeds that
 * are carried away by the wind, revealing the park underneath.
 *
 * Drawn as the very last pass of the main WebGL canvas (after post-processing),
 * so it is always composited on top of the scene. Every seed evaluates the same
 * dissolve field as the solid layer, so it lifts off exactly when its pixel
 * dissolves.
 */

const FIELD = /* glsl */ `
  uniform vec2 uRes; uniform vec2 uCenter;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
  // 0 → dissolves first, 1 → last
  float field(vec2 px) {
    vec2 uv = px / uRes;
    vec2 d = (uv - uCenter) * vec2(uRes.x / uRes.y, 1.0);
    float r = length(d) / length(vec2(uRes.x / uRes.y, 1.0));
    float n = fbm(uv * vec2(uRes.x / uRes.y, 1.0) * 3.2);
    // wind blows from the left: the left side starts a touch earlier
    return clamp(r * 0.62 + n * 0.42 - uv.x * 0.08, 0.0, 1.0);
  }
`;

export interface RevealProps {
  color: string;
  /** false: the sheet stays fully opaque (covering the scene) */
  run: boolean;
  reduced: boolean;
  /** render the main scene too (when there is no post-processing composer) */
  renderScene: boolean;
  onDone: () => void;
}

export function RevealPass({ color, run, reduced, renderScene, onDone }: RevealProps) {
  const { size } = useThree();
  const done = useRef(onDone);
  done.current = onDone;
  const clock = useRef({ t: 0, finished: false });

  const res = useMemo(() => {
    const w = size.width;
    const h = size.height;
    const [r, g, b] = hexToRgb(color);
    // raw sRGB values: written straight to the (sRGB) canvas, matching the DOM loader exactly
    const col = new THREE.Vector3(r / 255, g / 255, b / 255);
    const uniforms = {
      uRes: { value: new THREE.Vector2(w, h) },
      uCenter: { value: new THREE.Vector2(0.5, 0.52) },
      uP: { value: -0.06 },
      uColor: { value: col },
      uTime: { value: 0 },
      uSeeds: { value: reduced ? 0 : 1 },
    };
    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(0, w, h, 0, -10, 10);

    const sheet = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms,
        vertexShader: /* glsl */ `
          varying vec2 vPx; uniform vec2 uRes;
          void main() { vPx = position.xy + 0.5 * uRes; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          ${FIELD}
          uniform float uP; uniform vec3 uColor; varying vec2 vPx;
          void main() {
            float th = field(vPx);
            float fibre = (vnoise(vPx * 0.09) - 0.5) * 0.06 + (vnoise(vPx * 0.3) - 0.5) * 0.025;
            float a = smoothstep(uP - 0.02, uP + 0.03, th + fibre);
            // soft light rim on the tearing edge
            float rim = smoothstep(0.05, 0.0, abs(th + fibre - uP)) * 0.14 * step(0.0, uP);
            gl_FragColor = vec4(min(uColor + rim, vec3(1.0)), a);
          }`,
      }),
    );
    sheet.position.set(w / 2, h / 2, 0);
    sheet.frustumCulled = false;
    scene.add(sheet);

    const spacing = Math.max(16, Math.min(30, Math.sqrt((w * h) / 2600)));
    const cols = Math.ceil(w / spacing) + 1;
    const rows = Math.ceil(h / spacing) + 1;
    const count = cols * rows;
    const origin = new Float32Array(count * 2);
    const data = new Float32Array(count * 4);
    let k = 0;
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        origin[k * 2] = x * spacing + (Math.random() - 0.5) * spacing;
        origin[k * 2 + 1] = y * spacing + (Math.random() - 0.5) * spacing;
        data[k * 4] = Math.random() * 6.283;
        data[k * 4 + 1] = spacing * (1.1 + Math.random() * 0.9);
        data[k * 4 + 2] = 0.7 + Math.random() * 0.7;
        data[k * 4 + 3] = (Math.random() - 0.5) * 0.12;
        k++;
      }
    const geo = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    geo.index = base.index;
    geo.setAttribute('position', base.attributes.position);
    geo.setAttribute('uv', base.attributes.uv);
    geo.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(origin, 2));
    geo.setAttribute('aData', new THREE.InstancedBufferAttribute(data, 4));
    geo.instanceCount = count;
    const tex = toTexture(seedSprite(128));
    const seeds = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: { ...uniforms, uMap: { value: tex } },
        vertexShader: /* glsl */ `
          ${FIELD}
          attribute vec2 aOrigin; attribute vec4 aData;
          uniform float uP; uniform float uTime;
          varying vec2 vUv; varying float vA; varying float vShade;
          void main() {
            vUv = uv;
            float th = field(aOrigin);
            float age = (uP - th) * 2.6 * aData.z;
            vA = smoothstep(-0.03, 0.02, age) * (1.0 - smoothstep(0.55, 1.05, age));
            float a = max(age, 0.0);
            vec2 wind = vec2(0.95, 0.62) * uRes.y;
            vec2 p = aOrigin + wind * pow(a, 1.35) * 0.55;
            p += vec2(sin(a * 5.0 + aData.x) * 40.0, cos(a * 3.7 + aData.x * 1.3) * 26.0) * a;
            float rot = aData.x + a * 2.4 + sin(uTime * 2.0 + aData.x) * 0.2 * a;
            float s = aData.y * (1.0 + a * 0.5);
            vec2 c = position.xy * s;
            c = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * c;
            vShade = aData.w;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p + c, 0.0, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap; uniform vec3 uColor; uniform float uSeeds;
          varying vec2 vUv; varying float vA; varying float vShade;
          void main() {
            vec4 t = texture2D(uMap, vUv);
            // seeds carry the colour, slightly lighter so they read against the park
            vec3 c = min(uColor * (1.0 + vShade) + 0.07, vec3(1.0));
            gl_FragColor = vec4(c, t.a * vA * uSeeds);
          }`,
      }),
    );
    seeds.frustumCulled = false;
    scene.add(seeds);
    return { scene, cam, uniforms, geo, tex };
  }, [size.width, size.height, color, reduced]);

  useEffect(
    () => () => {
      res.geo.dispose();
      res.tex.dispose();
    },
    [res],
  );

  useFrame((state, delta) => {
    const { gl, scene, camera } = state;
    if (renderScene) {
      gl.autoClear = true;
      gl.render(scene, camera);
    }
    const c = clock.current;
    let p = -0.06;
    if (run) {
      // accumulate clamped frame time: a hitch (shader warm-up, GC) slows the
      // reveal down for a moment instead of skipping straight past it
      c.t += Math.min(delta, 1 / 30) * 1000;
      const qa = Number(new URLSearchParams(window.location.search).get('revealMs'));
      const dur = qa > 0 ? qa : reduced ? 900 : 3400;
      const t = c.t / dur;
      const e = t < 1 ? 1 - Math.pow(1 - t, 1.6) : 1;
      p = -0.05 + e * 1.12;
      res.uniforms.uTime.value = t * 3.4;
      if (t >= (reduced ? 1.05 : 1.45) && !c.finished) {
        c.finished = true;
        done.current();
      }
    }
    res.uniforms.uP.value = p;
    (window as unknown as { __revealP?: number }).__revealP = p;
    const prevAuto = gl.autoClear;
    const prevTone = gl.toneMapping;
    gl.autoClear = false;
    gl.toneMapping = THREE.NoToneMapping;
    gl.setRenderTarget(null);
    gl.render(res.scene, res.cam);
    gl.autoClear = prevAuto;
    gl.toneMapping = prevTone;
  }, 2);

  return null;
}

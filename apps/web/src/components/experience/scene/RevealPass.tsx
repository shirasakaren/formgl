'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { seedSprite, softDot, toTexture } from './textures';
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
  uniform vec2 uRes; uniform vec2 uCenter; uniform float uTime;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
  // 0 → dissolves first, 1 → last
  float field(vec2 px) {
    vec2 uv = px / uRes;
    float asp = uRes.x / uRes.y;
    #if MODE == 1
      // tide: the colour drains downward like a wave pulling back, with a ragged foamy line
      float w = sin(uv.x * 7.0 + 1.3) * 0.035 + sin(uv.x * 17.0 - 0.4) * 0.015;
      return clamp((1.0 - uv.y) * 0.86 + w + (fbm(uv * vec2(asp * 3.0, 2.0)) - 0.5) * 0.16, 0.0, 1.0);
    #elif MODE == 2
      // curtains: part from the middle outward, the leading edges swaying
      float sway = sin(uv.y * 5.0 + 0.8) * 0.03 + sin(uv.y * 13.0) * 0.012;
      return clamp(abs(uv.x - 0.5 + sway) * 2.0 * 0.94 + (fbm(uv * vec2(1.0, 6.0)) - 0.5) * 0.06, 0.0, 1.0);
    #elif MODE == 3
      // clouds: billowing puffs clear from the centre as we fly through
      vec2 d = (uv - uCenter) * vec2(asp, 1.0);
      float r = length(d) / length(vec2(asp, 1.0));
      float b = fbm(uv * vec2(asp, 1.0) * 2.2);
      float billow = 1.0 - abs(b * 2.0 - 1.0);
      return clamp(r * 0.5 + billow * 0.55 + (b - 0.5) * 0.2, 0.0, 1.0);
    #else
      vec2 d = (uv - uCenter) * vec2(asp, 1.0);
      float r = length(d) / length(vec2(asp, 1.0));
      float n = fbm(uv * vec2(asp, 1.0) * 3.2);
      // wind blows from the left: the left side starts a touch earlier
      return clamp(r * 0.62 + n * 0.42 - uv.x * 0.08, 0.0, 1.0);
    #endif
  }
`;

const MODES = { dandelion: 0, tide: 1, curtain: 2, clouds: 3 } as const;

export interface RevealProps {
  mode?: keyof typeof MODES;
  color: string;
  /** false: the sheet stays fully opaque (covering the scene) */
  run: boolean;
  /** finished: stop drawing the overlay (stays mounted — see note in useFrame) */
  done?: boolean;
  reduced: boolean;
  /** render the main scene too (when there is no post-processing composer) */
  renderScene: boolean;
  onDone: () => void;
}

export function RevealPass({ mode = 'dandelion', color, run, done: finished = false, reduced, renderScene, onDone }: RevealProps) {
  const { size, gl } = useThree();
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
        defines: { MODE: MODES[mode] },
        fragmentShader: /* glsl */ `
          ${FIELD}
          uniform float uP; uniform vec3 uColor; varying vec2 vPx;
          void main() {
            float th = field(vPx);
            vec2 uv = vPx / uRes;
            vec3 col = uColor;
            float a;
            #if MODE == 1
              float fibre = (vnoise(vPx * 0.05 + vec2(uTime * 0.6, 0.0)) - 0.5) * 0.05;
              float d = th + fibre - uP;
              a = smoothstep(-0.015, 0.05, d);
              // lacy foam riding the edge, a darker wet band just behind it
              float lace = smoothstep(0.35, 0.8, vnoise(vPx * 0.09 + vec2(0.0, uTime)) * vnoise(vPx * 0.23 - uTime * 0.5) * 2.0);
              float band = smoothstep(0.07, 0.0, abs(d - 0.012));
              col = mix(col * 0.97, vec3(1.0), band * (0.55 + 0.45 * lace));
              a = max(a, band * lace * 0.9 * step(0.0, uP));
            #elif MODE == 2
              float d = th - uP;
              a = smoothstep(-0.01, 0.03, d);
              // gathered sheer folds that bunch toward the leading edge
              float folds = sin((uv.x * 70.0) + d * 40.0) * 0.5 + 0.5;
              col *= 0.93 + 0.1 * folds;
              // translucent sheer near the edge, a stitched hem
              a *= mix(0.62, 1.0, smoothstep(0.0, 0.18, d));
              float hem = smoothstep(0.02, 0.0, abs(d - 0.006));
              col = mix(col, col * 0.86, hem * 0.6);
            #elif MODE == 3
              float d = th - uP;
              a = smoothstep(-0.05, 0.09, d);
              // sunlit rims on the cloud edges
              float rim = smoothstep(0.1, 0.0, abs(d)) * step(0.0, uP);
              col = min(col + rim * 0.12, vec3(1.0));
            #else
              float fibre = (vnoise(vPx * 0.09) - 0.5) * 0.06 + (vnoise(vPx * 0.3) - 0.5) * 0.025;
              a = smoothstep(uP - 0.02, uP + 0.03, th + fibre);
              float rim = smoothstep(0.05, 0.0, abs(th + fibre - uP)) * 0.14 * step(0.0, uP);
              col = min(uColor + rim, vec3(1.0));
            #endif
            gl_FragColor = vec4(col, a);
          }`,
      }),
    );
    sheet.position.set(w / 2, h / 2, 0);
    sheet.frustumCulled = false;
    scene.add(sheet);

    const density = mode === 'clouds' ? 260 : mode === 'curtain' ? 900 : mode === 'tide' ? 1800 : 2600;
    const spacing = Math.max(16, Math.sqrt((w * h) / density));
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
        data[k * 4 + 1] =
          mode === 'clouds' ? spacing * (1.6 + Math.random() * 1.6) : mode === 'curtain' ? 3 + Math.random() * 5 : mode === 'tide' ? 4 + Math.random() * 9 : spacing * (1.1 + Math.random() * 0.9);
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
    const tex = toTexture(mode === 'dandelion' ? seedSprite(128) : softDot(64));
    const seeds = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        defines: { MODE: MODES[mode] },
        uniforms: { ...uniforms, uMap: { value: tex } },
        vertexShader: /* glsl */ `
          ${FIELD}
          attribute vec2 aOrigin; attribute vec4 aData;
          uniform float uP;
          varying vec2 vUv; varying float vA; varying float vShade;
          void main() {
            vUv = uv;
            float th = field(aOrigin);
            float age = (uP - th) * 2.6 * aData.z;
            vA = smoothstep(-0.03, 0.02, age) * (1.0 - smoothstep(0.55, 1.05, age));
            float a = max(age, 0.0);
            vec2 p;
            float rot;
            float s = aData.y;
            #if MODE == 1
              // foam flecks and bubbles left behind by the retreating water
              p = aOrigin + vec2(sin(a * 3.0 + aData.x) * 14.0, -pow(a, 1.2) * uRes.y * 0.22);
              rot = 0.0;
              s *= 1.0 - a * 0.4;
              vA *= 0.9;
            #elif MODE == 2
              // dust motes glinting in the light as the curtains part
              p = aOrigin + vec2(sin(a * 2.0 + aData.x) * 20.0 * a, a * uRes.y * 0.08);
              rot = 0.0;
              vA *= 0.55 + 0.45 * sin(uTime * 4.0 + aData.x * 9.0);
            #elif MODE == 3
              // cloud puffs rushing past as we fly through them
              vec2 dir = normalize(aOrigin - uCenter * uRes + vec2(0.001));
              p = aOrigin + dir * pow(a, 1.4) * uRes.y * 0.9;
              rot = aData.x;
              s *= 1.0 + a * 2.2;
              vA *= 0.7;
            #else
              vec2 wind = vec2(0.95, 0.62) * uRes.y;
              p = aOrigin + wind * pow(a, 1.35) * 0.55;
              p += vec2(sin(a * 5.0 + aData.x) * 40.0, cos(a * 3.7 + aData.x * 1.3) * 26.0) * a;
              rot = aData.x + a * 2.4 + sin(uTime * 2.0 + aData.x) * 0.2 * a;
              s *= 1.0 + a * 0.5;
            #endif
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
            #if MODE == 1 || MODE == 2
              c = vec3(1.0);
            #endif
            gl_FragColor = vec4(c, t.a * vA * uSeeds);
          }`,
      }),
    );
    seeds.frustumCulled = false;
    scene.add(seeds);
    return { scene, cam, uniforms, geo, tex };
  }, [size.width, size.height, color, reduced, mode]);

  useEffect(
    () => () => {
      res.geo.dispose();
      res.tex.dispose();
    },
    [res],
  );
  // compile the reveal's shaders while the loader is still up (Warmup links them)
  useEffect(() => {
    const prevTone = gl.toneMapping;
    try {
      gl.toneMapping = THREE.NoToneMapping; // same state as when it draws
      gl.setRenderTarget(null);
      gl.compile(res.scene, res.cam);
    } catch {
      /* compiled on first use instead */
    }
    gl.toneMapping = prevTone;
  }, [gl, res]);

  useFrame((state, delta) => {
    const { gl, scene, camera } = state;
    if (renderScene) {
      gl.autoClear = true;
      gl.render(scene, camera);
    }
    // NB: this component stays mounted after the reveal. A priority>0 frame
    // subscriber disables R3F's automatic render, so in the no-composer path
    // (renderScene) we keep rendering the scene ourselves.
    if (finished) return;
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

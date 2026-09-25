'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { seedSprite } from '../scene/textures';

/*
 * The solid loading colour breaks apart into thousands of dandelion seeds that
 * are carried away by the wind, revealing the park scene underneath.
 * Everything is computed on the GPU: each seed evaluates the same dissolve
 * field as the solid layer, so it lifts off exactly when its pixel dissolves.
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

export function DandelionReveal({ color, run, reduced, onDone }: { color: string; run: boolean; reduced: boolean; onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (!run) return;
    const canvas = ref.current;
    if (!canvas) return;
    if (reduced) {
      canvas.style.transition = 'opacity 0.8s ease';
      canvas.style.opacity = '0';
      const t = setTimeout(() => done.current(), 800);
      return () => clearTimeout(t);
    }
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch {
      done.current();
      return;
    }
    const onLost = (e: Event) => {
      e.preventDefault();
      console.warn('[formgl] reveal context lost');
      done.current();
    };
    canvas.addEventListener('webglcontextlost', onLost);
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(0, w, h, 0, -10, 10);
    const col = new THREE.Color(color);
    const uniforms = {
      uRes: { value: new THREE.Vector2(w, h) },
      uCenter: { value: new THREE.Vector2(0.5, 0.52) },
      uP: { value: -0.05 },
      uColor: { value: col },
      uTime: { value: 0 },
    };

    // solid layer with a fibrous dissolving edge
    const sheet = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        uniforms,
        vertexShader: `varying vec2 vPx; uniform vec2 uRes; void main(){ vPx = (position.xy + 0.5 * uRes); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          ${FIELD}
          uniform float uP; uniform vec3 uColor; varying vec2 vPx;
          void main() {
            float th = field(vPx);
            float fibre = (vnoise(vPx * 0.35) - 0.5) * 0.05 + (vnoise(vPx * 1.3) - 0.5) * 0.02;
            float a = smoothstep(uP - 0.012, uP + 0.02, th + fibre);
            // soft light rim on the tearing edge
            float rim = smoothstep(0.05, 0.0, abs(th + fibre - uP)) * 0.18;
            gl_FragColor = vec4(uColor + rim, a);
          }`,
      }),
    );
    sheet.position.set(w / 2, h / 2, 0);
    scene.add(sheet);

    // seeds
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
    const tex = new THREE.CanvasTexture(seedSprite(128));
    tex.colorSpace = THREE.SRGBColorSpace;
    const seeds = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
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
          uniform sampler2D uMap; uniform vec3 uColor;
          varying vec2 vUv; varying float vA; varying float vShade;
          void main() {
            vec4 t = texture2D(uMap, vUv);
            vec3 c = uColor * (1.0 + vShade) + 0.06;
            gl_FragColor = vec4(c, t.a * vA);
          }`,
      }),
    );
    seeds.frustumCulled = false;
    scene.add(seeds);

    let raf = 0;
    const start = performance.now();
    const qa = Number(new URLSearchParams(window.location.search).get('revealMs'));
    const DURATION = qa > 0 ? qa : 3400;
    const tick = () => {
      const t = (performance.now() - start) / DURATION;
      uniforms.uTime.value = t * 3.4;
      // ease: slow start, confident middle, long tail for the last seeds
      const e = t < 1 ? 1 - Math.pow(1 - t, 1.6) : 1;
      uniforms.uP.value = -0.05 + e * 1.12;
      (window as unknown as { __revealP?: number }).__revealP = uniforms.uP.value;
      renderer.render(scene, cam);
      if (t < 1.45) raf = requestAnimationFrame(tick);
      else {
        done.current();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('webglcontextlost', onLost);
      renderer.dispose();
      geo.dispose();
      tex.dispose();
    };
  }, [run, color, reduced]);

  return <canvas ref={ref} className="fgl-reveal" style={{ background: run ? 'transparent' : color }} aria-hidden />;
}

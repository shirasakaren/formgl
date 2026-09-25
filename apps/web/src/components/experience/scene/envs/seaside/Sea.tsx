'use client';
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { anim, type Quality } from '../../../store';
import type { LightPreset } from '../../presets';
import { SHORE, shoreUniforms, swashAt } from './shore';

/** Keeps the shoreline uniforms moving: swash cycle + the extra wave of the opening. */
export function ShoreClock() {
  useFrame((st, dt) => {
    const t = st.clock.elapsedTime;
    const wave = anim.fx.wave ?? 0;
    const sw = Math.max(swashAt(t) * 0.8, wave * 1.12);
    shoreUniforms.uTime.value = t;
    shoreUniforms.uSwash.value = sw;
    const level = SHORE.base + SHORE.runup * sw;
    shoreUniforms.uLevel.value = level;
    // the sand dries slowly after each wave
    const wet = shoreUniforms.uWet.value;
    shoreUniforms.uWet.value = level > wet ? level : Math.max(SHORE.base + SHORE.runup * 0.35, wet - dt * 0.0016);
  });
  return null;
}

const VERT = /* glsl */ `
  uniform float uTime; uniform float uLevel;
  varying vec3 vW; varying vec3 vN; varying float vWave;
  float wav(vec2 p, vec2 d, float f, float sp, float a) { return sin(dot(p, d) * f + uTime * sp) * a; }
  void main() {
    vec3 p = (modelMatrix * vec4(position, 1.0)).xyz;
    // open-sea swell, calmed near the shore
    float far = smoothstep(-0.8, -9.0, p.z);
    float h = wav(p.xz, normalize(vec2(0.3, 1.0)), 0.9, 1.1, 0.05) + wav(p.xz, normalize(vec2(-0.6, 1.0)), 1.7, 1.7, 0.025) + wav(p.xz, normalize(vec2(1.0, 0.4)), 3.1, 2.3, 0.01);
    p.y = uLevel + h * far;
    // analytic-ish normal from the wave sum
    float e = 0.05;
    float hx = wav(p.xz + vec2(e, 0.0), normalize(vec2(0.3, 1.0)), 0.9, 1.1, 0.05) + wav(p.xz + vec2(e, 0.0), normalize(vec2(-0.6, 1.0)), 1.7, 1.7, 0.025);
    float hz = wav(p.xz + vec2(0.0, e), normalize(vec2(0.3, 1.0)), 0.9, 1.1, 0.05) + wav(p.xz + vec2(0.0, e), normalize(vec2(-0.6, 1.0)), 1.7, 1.7, 0.025);
    vN = normalize(vec3(-(hx - h) / e * far, 1.0, -(hz - h) / e * far));
    vWave = h * far;
    vW = p;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime; uniform float uLevel; uniform float uSwash; uniform float uSlope;
  uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSky; uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uFog;
  varying vec3 vW; varying vec3 vN; varying float vWave;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
  void main() {
    float sand = uSlope * vW.z;
    float depth = vW.y - sand;
    if (depth < -0.002) discard;
    vec3 v = normalize(cameraPosition - vW);
    // fine ripples
    vec2 rp = vW.xz * 6.0;
    vec3 n = normalize(vN + vec3(vn(rp + uTime * 0.6) - 0.5, 0.0, vn(rp.yx - uTime * 0.5) - 0.5) * 0.35);
    float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
    float d = 1.0 - exp(-max(depth, 0.0) * 7.0);
    vec3 col = mix(uShallow, uDeep, d);
    col = mix(col, uSky, fres * 0.75);
    // sun glitter: many tiny glints scattered on the swell
    vec3 r = reflect(-v, n);
    float spec = pow(max(dot(r, normalize(uSun)), 0.0), 220.0);
    float glint = step(0.72, vn(vW.xz * 18.0 + uTime * 1.3)) * pow(max(dot(r, normalize(uSun)), 0.0), 30.0);
    col += uSunCol * (spec * 2.5 + glint * 1.4);
    // foam: the lacy edge of the swash plus breaking crests further out
    float lace = vn(vW.xz * 22.0 + vec2(uTime * 0.4, -uTime * 0.2)) * vn(vW.xz * 9.0 - uTime * 0.3);
    float edge = smoothstep(0.012, 0.0, depth) * smoothstep(0.1, 0.35, lace * 2.0);
    float crestZ = -0.35 - mod(uTime * 0.28, 1.0) * 2.4;
    float crest = exp(-pow((vW.z - crestZ) * 3.0, 2.0)) * smoothstep(0.25, 0.6, lace * 1.8) * (1.0 - smoothstep(-0.2, -3.0, crestZ)) ;
    float foam = clamp(edge + crest * 0.8 + smoothstep(0.03, 0.12, vWave) * lace * 0.5, 0.0, 1.0);
    col = mix(col, vec3(0.98, 0.99, 1.0), foam);
    // shallow water is clear: you see the wet sand through it
    float alpha = mix(smoothstep(-0.002, 0.03, depth) * 0.75, 1.0, d) ;
    alpha = max(alpha, foam * 0.95);
    float dist = length(vW - cameraPosition);
    col = mix(col, uFog, smoothstep(25.0, 240.0, dist) * 0.6);
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function Sea({ preset, quality }: { preset: LightPreset; quality: Quality }) {
  const mesh = useMemo(() => {
    const seg = quality === 'low' ? 96 : 180;
    const geo = new THREE.PlaneGeometry(420, 260, seg, seg);
    geo.rotateX(-Math.PI / 2);
    // concentrate resolution near the shore: remap z so rows bunch up near z=0
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i); // -130..130
      const t = (z + 130) / 260; // 0 far … 1 near
      const zz = 1.2 - Math.pow(1 - t, 3.2) * 250;
      p.setZ(i, zz);
    }
    geo.computeBoundingSphere();
    const deep = new THREE.Color('#2f7390').lerp(new THREE.Color(preset.skyTop), 0.25);
    const shallow = new THREE.Color('#8fd0c8').lerp(new THREE.Color(preset.skyHorizon), 0.15);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        ...shoreUniforms,
        uSlope: { value: SHORE.slope },
        uDeep: { value: deep },
        uShallow: { value: shallow },
        uSky: { value: new THREE.Color(preset.skyHorizon).lerp(new THREE.Color(preset.skyTop), 0.4) },
        uSun: { value: new THREE.Vector3(...preset.sunDir).normalize() },
        uSunCol: { value: new THREE.Color(preset.sunColor) },
        uFog: { value: new THREE.Color(preset.fog) },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    m.renderOrder = 2;
    return m;
  }, [preset, quality]);
  return <primitive object={mesh} />;
}

'use client';
import * as THREE from 'three';
import { mulberry32 } from './noise';

/**
 * Renders an animated "komorebi" (sunlight through leaves) mask into a render
 * target. It is used as the sun SpotLight's `map`, so every lit surface in the
 * scene — bench, envelope, letter, ground — receives moving, soft leaf shadows.
 */
export class DappleMap {
  readonly target: THREE.WebGLRenderTarget;
  private blurTarget: THREE.WebGLRenderTarget;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
  private material: THREE.ShaderMaterial;
  private blurMat: THREE.ShaderMaterial;
  private quad: THREE.Mesh;
  private quadScene = new THREE.Scene();
  private leaves: THREE.InstancedMesh;

  constructor(opts: { size: number; leafTexture: THREE.Texture; open: number; count: number; seed?: number }) {
    const { size } = opts;
    const params = { type: THREE.UnsignedByteType, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, depthBuffer: false };
    this.target = new THREE.WebGLRenderTarget(size, size, params);
    this.blurTarget = new THREE.WebGLRenderTarget(size, size, params);
    this.target.texture.colorSpace = THREE.NoColorSpace;

    this.scene.background = new THREE.Color(1, 1, 1);
    const geo = new THREE.PlaneGeometry(1, 1);
    const count = opts.count;
    const rnd = mulberry32(opts.seed ?? 4);
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uWind: { value: 0.5 },
        uMap: { value: opts.leafTexture },
      },
      vertexShader: /* glsl */ `
        attribute vec4 aData;   // x,y centre, rotation, scale
        attribute vec3 aCluster; // cluster phase, cluster amplitude, leaf atlas cell
        uniform float uTime;
        uniform float uWind;
        varying vec2 vUv;
        varying float vShade;
        void main() {
          float t = uTime;
          float gust = 0.6 + 0.4 * sin(t * 0.23 + aCluster.x * 0.7) * sin(t * 0.11 + 1.3);
          vec2 sway = vec2(
            sin(t * 0.9 + aCluster.x) + 0.45 * sin(t * 2.1 + aCluster.x * 3.1),
            cos(t * 0.7 + aCluster.x * 1.7) * 0.6
          ) * aCluster.y * uWind * gust * 0.018;
          float flutter = sin(t * (6.0 + aCluster.x) + aData.x * 40.0) * 0.25 * uWind;
          float rot = aData.z + flutter;
          float s = aData.w * (0.85 + 0.15 * sin(t * 3.0 + aData.y * 30.0) * uWind);
          vec2 p = position.xy * s;
          p = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * p;
          vec2 world = aData.xy + p + sway;
          float cell = aCluster.z;
          vUv = vec2(uv.x * 0.5 + mod(cell, 2.0) * 0.5, uv.y * 0.5 + (1.0 - floor(cell / 2.0)) * 0.5);
          vShade = 0.0;
          gl_Position = vec4(world, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying vec2 vUv;
        void main() {
          float a = texture2D(uMap, vUv).a;
          if (a < 0.5) discard;
          gl_FragColor = vec4(vec3(0.0), a * 0.96);
        }
      `,
    });

    const inst = new THREE.InstancedMesh(geo, this.material, count);
    const data = new Float32Array(count * 4);
    const cluster = new Float32Array(count * 3);
    // leaves grouped in small twig clusters spread over the whole canopy,
    // with a slow noise field carving larger sun gaps between branches
    const open = opts.open;
    const clusters = Math.max(40, Math.round(count / 14));
    const centres: Array<[number, number, number]> = [];
    let guard = 0;
    while (centres.length < clusters && guard++ < clusters * 20) {
      const x = rnd() * 2.2 - 1.1;
      const y = rnd() * 2.2 - 1.1;
      // branch structure: bands of density
      const band = Math.sin(x * 3.1 + Math.sin(y * 2.3) * 1.4) * Math.sin(y * 2.7 - x * 1.1);
      if (band < -0.35 + open * 0.5 && rnd() < 0.85) continue;
      centres.push([x, y, rnd() * 10]);
    }
    for (let i = 0; i < count; i++) {
      const c = centres[i % centres.length];
      const spread = 0.035 + rnd() * 0.05;
      const a = rnd() * Math.PI * 2;
      const r = Math.pow(rnd(), 0.6) * spread;
      data[i * 4] = c[0] + Math.cos(a) * r;
      data[i * 4 + 1] = c[1] + Math.sin(a) * r;
      data[i * 4 + 2] = rnd() * Math.PI * 2;
      data[i * 4 + 3] = (0.03 + rnd() * 0.034) * (1.25 - open * 0.5);
      cluster[i * 3] = c[2];
      cluster[i * 3 + 1] = 0.5 + rnd() * 0.8;
      cluster[i * 3 + 2] = rnd() < 0.8 ? 0 : 1;
    }
    geo.setAttribute('aData', new THREE.InstancedBufferAttribute(data, 4));
    geo.setAttribute('aCluster', new THREE.InstancedBufferAttribute(cluster, 3));
    inst.frustumCulled = false;
    this.leaves = inst;
    this.scene.add(inst);

    this.blurMat = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: { uTex: { value: null }, uDir: { value: new THREE.Vector2() }, uOpen: { value: open } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex; uniform vec2 uDir; uniform float uOpen;
        varying vec2 vUv;
        void main(){
          float w[5]; w[0]=0.227; w[1]=0.1945; w[2]=0.1216; w[3]=0.054; w[4]=0.0162;
          vec3 c = texture2D(uTex, vUv).rgb * w[0];
          for (int i = 1; i < 5; i++) {
            c += texture2D(uTex, vUv + uDir * float(i)).rgb * w[i];
            c += texture2D(uTex, vUv - uDir * float(i)).rgb * w[i];
          }
          // soft round falloff so only the canopy area is dappled, full sun outside
          float d = length(vUv - 0.5) * 2.0;
          // fade into shade toward the edge of the sun cone (no visible rim)
          c *= 1.0 - smoothstep(0.7, 1.0, d);
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blurMat);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  /** compile this mask's shaders ahead of time (the loader's warm-up links them) */
  warm(gl: THREE.WebGLRenderer) {
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(this.target);
    gl.compile(this.scene, this.camera);
    gl.compile(this.quadScene, this.camera);
    gl.setRenderTarget(prev);
  }

  update(gl: THREE.WebGLRenderer, time: number, wind: number) {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uWind.value = wind;
    const prev = gl.getRenderTarget();
    const prevAuto = gl.autoClear;
    const prevTone = gl.toneMapping;
    gl.toneMapping = THREE.NoToneMapping;
    gl.autoClear = true;
    gl.setRenderTarget(this.blurTarget);
    gl.render(this.scene, this.camera);
    const px = 0.55 / this.target.width;
    // leaves → blurTarget, then one separable-ish pass into target
    this.blurMat.uniforms.uTex.value = this.blurTarget.texture;
    this.blurMat.uniforms.uDir.value.set(px, px * 0.6);
    gl.setRenderTarget(this.target);
    gl.render(this.quadScene, this.camera);
    gl.setRenderTarget(prev);
    gl.autoClear = prevAuto;
    gl.toneMapping = prevTone;
  }

  /** debug helper: returns a PNG data URL of a render target */
  dump(gl: THREE.WebGLRenderer, which: 'target' | 'blur' = 'target'): string {
    const rt = which === 'target' ? this.target : this.blurTarget;
    const w = rt.width;
    const h = rt.height;
    const buf = new Uint8Array(w * h * 4);
    gl.readRenderTargetPixels(rt, 0, 0, w, h, buf);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d')!;
    const img = g.createImageData(w, h);
    img.data.set(buf);
    g.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  }

  dispose() {
    this.target.dispose();
    this.blurTarget.dispose();
    this.material.dispose();
    this.blurMat.dispose();
    this.leaves.geometry.dispose();
  }
}

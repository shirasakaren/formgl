'use client';
import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { sceneRefs } from './refs';

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
/** main-thread time we allow ourselves per frame while warming up, so the loader keeps moving */
const BUDGET_MS = 10;

type Programs = Array<{ getUniforms: () => unknown }>;

/** every texture a material uses: standard slots and shader uniforms */
function materialTextures(m: THREE.Material, out: Set<THREE.Texture>) {
  for (const v of Object.values(m as unknown as Record<string, unknown>)) if (v instanceof THREE.Texture) out.add(v);
  const u = (m as THREE.ShaderMaterial).uniforms;
  if (u) for (const x of Object.values(u)) if (x?.value instanceof THREE.Texture) out.add(x.value);
}

/**
 * "Bakes" the GPU side of the scene before anyone sees it, a little per frame:
 * uploads every texture, compiles and links every shader program (including those of
 * objects that are hidden until later — the paper plane, the reply balloon…), then renders
 * a few real frames so shadow maps, post-processing and light masks are ready.
 * Nothing is compiled on the fly once the scene is revealed, so there is no hitching.
 */
export function Warmup({ onProgress, onReady }: { onProgress: (p: number) => void; onReady: () => void }) {
  const { gl, scene, camera, advance } = useThree();
  const done = useRef(false);
  useEffect(() => {
    let cancelled = false;
    const perf = window.location.search.includes('perf');
    (async () => {
      const t0 = performance.now();
      // let the world mount fully (lazy chunks, suspense) before collecting it
      for (let i = 0; i < 3; i++) await nextFrame();
      if (cancelled) return;
      const objects: THREE.Object3D[] = [];
      const textures = new Set<THREE.Texture>();
      scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (!m) return;
        objects.push(o);
        for (const mm of Array.isArray(m) ? m : [m]) materialTextures(mm, textures);
      });
      if (scene.background instanceof THREE.Texture) textures.add(scene.background);
      const texList = [...textures];
      const steps = texList.length + objects.length + 5;
      let step = 0;
      const tick = () => onProgress(Math.min(0.99, ++step / steps));
      let slice = performance.now();
      const maybeYield = async () => {
        if (performance.now() - slice > BUDGET_MS) {
          await nextFrame();
          slice = performance.now();
        }
      };

      /* 1. textures → GPU */
      for (const t of texList) {
        if (cancelled) return;
        try {
          gl.initTexture(t);
        } catch {
          /* render targets etc. */
        }
        tick();
        await maybeYield();
      }
      if (perf) console.log(`[perf] warmup textures ${texList.length} in ${Math.round(performance.now() - t0)}ms`);

      /* 2. shader programs, one object at a time */
      // with KHR_parallel_shader_compile the driver compiles on its own threads: just wait for it
      const parallel = gl.extensions.has('KHR_parallel_shader_compile');
      const linked = new Set<unknown>();
      const linkNew = async () => {
        for (const p of (gl.info.programs ?? []) as unknown as Programs) {
          if (linked.has(p)) continue;
          linked.add(p);
          try {
            p.getUniforms(); // forces the (otherwise lazy, blocking) link now
          } catch {
            /* reported by three on use */
          }
          await maybeYield();
        }
      };
      // the scene is drawn into the post-processing buffer (linear, no tone mapping), which
      // selects different shader variants than the screen: compile for that target
      const target = ((sceneRefs.composer as { inputBuffer?: THREE.WebGLRenderTarget } | null)?.inputBuffer ?? null) as THREE.WebGLRenderTarget | null;
      for (const o of objects) {
        if (cancelled) return;
        gl.setRenderTarget(target);
        const vis = o.visible;
        o.visible = true; // hidden props still need their shaders ready
        const tc = performance.now();
        try {
          if (parallel) await gl.compileAsync(o, camera, scene);
          else gl.compile(o, camera, scene);
        } catch {
          /* ignore: compiled for real on first render */
        }
        o.visible = vis;
        gl.setRenderTarget(null);
        // without the extension, linking is lazy and blocking: do it now, one program at a time
        if (!parallel) await linkNew();
        if (perf && performance.now() - tc > 150) console.log(`[perf] slow program: ${o.name || o.type} ${((o as THREE.Mesh).material as THREE.Material)?.type} ${Math.round(performance.now() - tc)}ms`);
        tick();
        await maybeYield();
      }
      if (perf) console.log(`[perf] warmup programs ${linked.size} in ${Math.round(performance.now() - t0)}ms`);

      /* 3. shadow-map shaders: one plain render with the shadow pass forced */
      await nextFrame();
      gl.shadowMap.needsUpdate = true;
      try {
        gl.setRenderTarget(target);
        gl.render(scene, camera);
        gl.setRenderTarget(null);
      } catch {
        /* ignore */
      }
      tick();
      await nextFrame();

      /* 4. post-processing: run each effect and pass once, a frame apart, so their shaders
         (whose variants depend on the live buffers) compile in small chunks */
      type Eff = { update?: (r: THREE.WebGLRenderer, i: THREE.WebGLRenderTarget, d: number) => void };
      type Pass = { effects?: Eff[]; render?: (r: THREE.WebGLRenderer, i: THREE.WebGLRenderTarget, o: THREE.WebGLRenderTarget, d: number, m: boolean) => void };
      const comp = sceneRefs.composer as { passes?: Pass[]; inputBuffer?: THREE.WebGLRenderTarget; outputBuffer?: THREE.WebGLRenderTarget } | null;
      if (comp?.passes && comp.inputBuffer && comp.outputBuffer) {
        for (const pass of comp.passes) {
          if (cancelled) return;
          for (const eff of pass.effects ?? []) {
            try {
              eff.update?.(gl, comp.inputBuffer, 0);
            } catch {
              /* ignore */
            }
            await nextFrame();
          }
          try {
            pass.render?.(gl, comp.inputBuffer, comp.outputBuffer, 0, false);
          } catch {
            /* ignore */
          }
          gl.setRenderTarget(null);
          await nextFrame();
        }
        if (perf) console.log(`[perf] warmup composer, ${(gl.info.programs ?? []).length} programs in ${Math.round(performance.now() - t0)}ms`);
      }

      /* 5. a few real frames: post-processing (its shaders depend on runtime buffers), : light masks, environment maps, anything left */
      const beforeFrames = (gl.info.programs ?? []).length;
      for (let i = 0; i < 4; i++) {
        await nextFrame();
        advance(performance.now());
        await nextFrame();
        if (!parallel) await linkNew();
        tick();
      }
      if (perf) {
        const progs = (gl.info.programs ?? []) as unknown as Array<{ name: string; type?: string }>;
        console.log(`[perf] warmup done (${progs.length} programs) in ${Math.round(performance.now() - t0)}ms`);
        console.log(`[perf] late programs: ${progs.slice(beforeFrames).map((p) => p.name || p.type).join(', ')}`);
      }
      if (!cancelled && !done.current) {
        done.current = true;
        onProgress(1);
        onReady();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gl, scene, camera, advance, onProgress, onReady]);
  return null;
}

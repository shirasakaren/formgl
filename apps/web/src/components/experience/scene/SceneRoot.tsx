'use client';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import type { EnvironmentKey, PublicForm } from '@formgl/shared';
import { envConfig } from '../envs';
import { anim, useExperience, type Quality } from '../store';
import { buildAssets, type SceneAssets } from './assets';
import { CameraRig } from './CameraRig';
import { WindClock } from './Ground';
import { Letter3D } from './Letter3D';
import { RevealPass } from './RevealPass';
import { sceneRefs } from './refs';
import { PaperProjector } from './PaperProjector';
import { Warmup } from './Warmup';

/** While the DOM letter covers most of the screen, render the scene at ~30fps. */
/**
 * Drives rendering at a steady, capped rate: 60fps normally (so 120/144Hz screens don't double
 * the GPU work), 30fps while the letter is being read. Frames are requested on the display's
 * own clock, so pacing stays even.
 */
function FrameDriver({ fps, active }: { fps: number; active: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = 0;
    const interval = 1000 / fps;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last < interval - 2) return;
      last = t - ((t - last) % interval);
      invalidate();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [fps, active, invalidate]);
  return null;
}

type WorldProps = { form: PublicForm; assets: SceneAssets; quality: Quality; onOpen: () => void };
// each world is its own chunk: only the chosen environment's code is downloaded
const LOADERS: Record<EnvironmentKey, () => Promise<{ default: (p: WorldProps) => React.ReactNode }>> = {
  park: () => import('./envs/park/World'),
  seaside: () => import('./envs/seaside/World'),
  atelier: () => import('./envs/atelier/World'),
  skies: () => import('./envs/skies/World'),
};
const WORLDS = Object.fromEntries(Object.entries(LOADERS).map(([k, load]) => [k, lazy(load)])) as Record<EnvironmentKey, React.LazyExoticComponent<(p: WorldProps) => React.ReactNode>>;

const PIXEL_BUDGET: Record<Quality, number> = { low: 1.0e6, medium: 2.1e6, high: 3.4e6 };
const DPR_MAX: Record<Quality, number> = { low: 1, medium: 1.5, high: 2 };

function budgetDpr(q: Quality) {
  if (typeof window === 'undefined') return 1;
  const px = window.innerWidth * window.innerHeight;
  return Math.max(0.6, Math.min(window.devicePixelRatio || 1, DPR_MAX[q], Math.sqrt(PIXEL_BUDGET[q] / Math.max(1, px))));
}

/**
 * Shadows are baked, not re-rendered every frame: the shadow map only updates when
 * something that casts a shadow moves (the vessel, the letter…), plus at a low rate for
 * worlds with gently swaying casters.
 */
function ShadowBaker() {
  const gl = useThree((s) => s.gl);
  const last = useRef({ sig: NaN, t: -1 });
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    return () => {
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl]);
  useFrame((st) => {
    const a = anim;
    let sig = a.lift + a.slide * 3 + a.rise * 5 + a.unfold * 7 + a.flap * 11 + a.crack * 13 + a.settle * 17 + a.flyAway * 19 + a.hover * 23 + a.align * 29 + a.letterVisible * 31;
    for (const k in a.fx) sig += a.fx[k] * (k.length + 37);
    const now = st.clock.elapsedTime;
    const rate = sceneRefs.shadowRate;
    const phase = useExperience.getState().phase;
    const due = rate > 0 && now - last.current.t >= 1 / (phase === 'reading' ? Math.min(rate, 6) : rate);
    if (sig !== last.current.sig || due || sceneRefs.shadowDirty) {
      gl.shadowMap.needsUpdate = true;
      last.current.t = now;
      sceneRefs.shadowDirty = false;
    }
    last.current.sig = sig;
  }, -1);
  return null;
}

function World(props: WorldProps) {
  const t = props.form.theme;
  const reduced = useExperience((s) => s.reducedMotion);
  const key = (t.environment && WORLDS[t.environment] ? t.environment : 'park') as EnvironmentKey;
  const Env = WORLDS[key];
  const cfg = envConfig(key);
  return (
    <>
      <WindClock />
      <ShadowBaker />
      <CameraRig sway={t.cameraSway} reducedMotion={reduced} />
      <Env {...props} />
      <Letter3D assets={props.assets} style={cfg.letterStyle} ribbonColor={t.accentColor} />
      <PaperProjector />
    </>
  );
}

interface RevealState {
  run: boolean;
  done: boolean;
  onDone: () => void;
  color: string;
}

export default function SceneRoot({ onReady, onOpen, reveal }: { onReady: () => void; onOpen: () => void; reveal: RevealState }) {
  const reduced = useExperience((s) => s.reducedMotion);
  const form = useExperience((s) => s.form)!;
  const quality = useExperience((s) => s.quality);
  const set = useExperience((s) => s.set);
  const [assets, setAssets] = useState<SceneAssets | null>(null);
  // resolution follows a pixel budget per quality tier, so big / high-DPI screens don't melt the GPU
  const [dprCap, setDprCap] = useState(1);
  const [dpr, setDpr] = useState(() => budgetDpr(quality));
  // changing the pixel ratio reallocates every render target: do it rarely (debounced resizes, a
  // couple of steps down under sustained load) and never just because the phase changed
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const apply = () => setDpr((d) => {
      const next = Math.round(budgetDpr(quality) * dprCap * 100) / 100;
      return Math.abs(next - d) > 0.04 ? next : d;
    });
    apply();
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(apply, 300);
    };
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', onResize);
    };
  }, [quality, dprCap]);
  const phase = useExperience((s) => s.phase);
  // the scene is mostly behind the paper (and blurred) while reading: save the battery
  const [calm, setCalm] = useState(false);
  useEffect(() => {
    if (phase !== 'reading') {
      setCalm(false);
      return;
    }
    const t = setTimeout(() => setCalm(true), 1400);
    return () => clearTimeout(t);
  }, [phase]);
  // (reading only lowers the frame rate: resizing the canvas here would cause a hitch)
  const effDpr = dpr;

  useEffect(() => {
    let alive = true;
    // fetch the world's code while its textures bake
    void LOADERS[(form.theme.environment in LOADERS ? form.theme.environment : 'park') as EnvironmentKey]().catch(() => undefined);
    buildAssets(form, (p, label) => {
      if (alive) set({ progress: 0.05 + p * 0.7, progressLabel: label });
    })
      .then((a) => alive && setAssets(a))
      .catch((e) => {
        console.error('[formgl] asset build failed', e);
        if (alive) set({ webgl: false });
      });
    return () => {
      alive = false;
    };
  }, [form, set]);

  useEffect(() => {
    anim.wind = form.theme.wind ?? 0.45;
  }, [form.theme.wind]);

  const onCreated = useMemo(
    () =>
      ({ gl }: { gl: THREE.WebGLRenderer }) => {
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = THREE.PCFShadowMap;
        gl.toneMapping = THREE.AgXToneMapping;
        gl.toneMappingExposure = 1;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          set({ webgl: false });
        });
      },
    [set],
  );

  const onWarm = useMemo(() => (p: number) => set({ progress: 0.75 + p * 0.24, progressLabel: 'Letting the light settle' }), [set]);

  // Under load we only ever lower the resolution. Switching quality tiers would rebuild the
  // whole world (new geometry, new shaders) — exactly the kind of hitch we're avoiding.
  const lowerQuality = () => {
    if (calm || phase === 'loading') return;
    setDprCap((c) => Math.max(0.76, c - 0.12));
  };
  const loading = phase === 'loading';

  return (
    <Canvas
      className="fgl-canvas"
      dpr={effDpr}
      // while the loader covers it, the scene never renders on its own — only the frames the
      // warm-up asks for, once every shader is ready. The loading screen stays smooth.
      frameloop={loading ? 'never' : 'demand'}
      gl={{ antialias: quality === 'low', powerPreference: 'high-performance', alpha: false, stencil: false }}
      camera={{ fov: 32, near: 0.02, far: 220, position: [1.2, 1.2, 3.2] }}
      onCreated={onCreated}
      aria-hidden
    >
      <FrameDriver fps={calm ? 30 : 60} active={!loading} />
      <PerformanceMonitor onDecline={lowerQuality} flipflops={3}>
        {assets && (
          <>
            <Suspense fallback={null}>
              <World form={form} assets={assets} quality={quality} onOpen={onOpen} />
              <Warmup onReady={onReady} onProgress={onWarm} />
            </Suspense>
            <RevealPass mode={envConfig(form.theme.environment).revealMode} color={reveal.color} run={reveal.run} done={reveal.done} reduced={reduced} renderScene={quality === 'low'} onDone={reveal.onDone} />
          </>
        )}
      </PerformanceMonitor>
    </Canvas>
  );
}

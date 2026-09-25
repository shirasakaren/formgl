'use client';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
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

function ReadySignal({ onReady }: { onReady: () => void }) {
  const { gl, scene, camera } = useThree();
  const done = useRef(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = gl as THREE.WebGLRenderer & { compileAsync?: (s: THREE.Object3D, c: THREE.Camera) => Promise<unknown> };
        if (r.compileAsync) await Promise.race([r.compileAsync(scene, camera), new Promise((res) => setTimeout(res, 4000))]);
      } catch {
        /* compile errors surface in render anyway */
      }
      // let a few frames render so shadow maps & the canopy mask are warm
      for (let i = 0; i < 4; i++) await new Promise((res) => requestAnimationFrame(() => res(null)));
      if (!cancelled && !done.current) {
        done.current = true;
        onReady();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gl, scene, camera, onReady]);
  return null;
}

/** While the DOM letter covers most of the screen, render the scene at ~30fps. */
function Throttle({ active }: { active: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => invalidate(), 1000 / 30);
    return () => clearInterval(t);
  }, [active, invalidate]);
  return null;
}

type WorldProps = { form: PublicForm; assets: SceneAssets; quality: Quality; onOpen: () => void };
// each world is its own chunk: only the chosen environment's code is downloaded
const WORLDS: Record<EnvironmentKey, React.LazyExoticComponent<(p: WorldProps) => React.ReactNode>> = {
  park: lazy(() => import('./envs/park/World')),
  seaside: lazy(() => import('./envs/seaside/World')),
  atelier: lazy(() => import('./envs/atelier/World')),
  skies: lazy(() => import('./envs/skies/World')),
};

function World(props: WorldProps) {
  const t = props.form.theme;
  const reduced = useExperience((s) => s.reducedMotion);
  const key = (t.environment && WORLDS[t.environment] ? t.environment : 'park') as EnvironmentKey;
  const Env = WORLDS[key];
  const cfg = envConfig(key);
  return (
    <>
      <WindClock />
      <CameraRig sway={t.cameraSway} reducedMotion={reduced} />
      <Env {...props} />
      <Letter3D assets={props.assets} style={cfg.letterStyle} ribbonColor={t.accentColor} />
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
  const maxDpr = quality === 'high' ? 1.75 : quality === 'medium' ? 1.35 : 1;
  const [dpr, setDpr] = useState(() => Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, maxDpr));
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
  const effDpr = calm ? Math.max(0.6, dpr * 0.6) : dpr;

  useEffect(() => {
    let alive = true;
    buildAssets(form, (p, label) => {
      if (alive) set({ progress: 0.08 + p * 0.72, progressLabel: label });
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

  const lowerQuality = () => {
    if (calm) return;
    const q = useExperience.getState().quality;
    if (dpr > 1.01) setDpr((d) => Math.max(1, d - 0.25));
    else if (q !== 'low') set({ quality: q === 'high' ? 'medium' : 'low' });
  };

  return (
    <Canvas
      className="fgl-canvas"
      dpr={effDpr}
      frameloop={calm ? 'demand' : 'always'}
      gl={{ antialias: quality === 'low', powerPreference: 'high-performance', alpha: false, stencil: false }}
      camera={{ fov: 32, near: 0.02, far: 220, position: [1.2, 1.2, 3.2] }}
      onCreated={onCreated}
      aria-hidden
    >
      <Throttle active={calm} />
      <PerformanceMonitor onDecline={lowerQuality} flipflops={3} onFallback={() => set({ quality: 'low' })}>
        {assets && (
          <>
            <Suspense fallback={null}>
              <World form={form} assets={assets} quality={quality} onOpen={onOpen} />
              <ReadySignal onReady={onReady} />
            </Suspense>
            <RevealPass mode={envConfig(form.theme.environment).revealMode} color={reveal.color} run={reveal.run} done={reveal.done} reduced={reduced} renderScene={quality === 'low'} onDone={reveal.onDone} />
          </>
        )}
      </PerformanceMonitor>
    </Canvas>
  );
}

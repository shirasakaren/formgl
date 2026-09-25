'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import type { PublicForm } from '@formgl/shared';
import { anim, useExperience, type Quality } from '../store';
import { buildAssets, type SceneAssets } from './assets';
import { Background } from './Background';
import { Bench } from './Bench';
import { CameraRig } from './CameraRig';
import { Effects } from './Effects';
import { Envelope } from './Envelope';
import { Ground, WindClock } from './Ground';
import { Letter3D } from './Letter3D';
import { Lighting } from './Lighting';
import { Dandelions, ForegroundBranch, HeroTree } from './Nature';
import { Butterflies, Dust, FallingLeaves, FloatingSeeds, LightShafts } from './Particles';
import { PRESETS } from './presets';

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

function World({ form, assets, quality, onOpen }: { form: PublicForm; assets: SceneAssets; quality: Quality; onOpen: () => void }) {
  const t = form.theme;
  const preset = PRESETS[t.timeOfDay] ?? PRESETS.golden;
  const reduced = useExperience((s) => s.reducedMotion);
  return (
    <>
      <color attach="background" args={[preset.skyHorizon]} />
      <fogExp2 attach="fog" args={[preset.fog, preset.fogDensity]} />
      <WindClock />
      <CameraRig sway={t.cameraSway} reducedMotion={reduced} />
      <Lighting preset={preset} assets={assets} quality={quality} />
      <Background preset={preset} assets={assets} quality={quality} />
      <Ground assets={assets} preset={preset} quality={quality} />
      <HeroTree assets={assets} />
      <Bench assets={assets} />
      <Envelope assets={assets} sealColor={t.sealColor} onOpen={onOpen} />
      <Letter3D assets={assets} />
      <Dandelions assets={assets} quality={quality} />
      {quality !== 'low' && <ForegroundBranch assets={assets} />}
      {t.dust && !reduced && <Dust assets={assets} preset={preset} quality={quality} />}
      {t.fallingLeaves && !reduced && <FallingLeaves assets={assets} quality={quality} />}
      {t.petals && !reduced && <FallingLeaves assets={assets} petals count={26} quality={quality} />}
      {!reduced && <FloatingSeeds assets={assets} quality={quality} />}
      {t.butterflies && !reduced && quality !== 'low' && <Butterflies assets={assets} />}
      {t.timeOfDay !== 'overcast' && quality !== 'low' && <LightShafts preset={preset} />}
      <Effects preset={preset} quality={quality} />
    </>
  );
}

export default function SceneRoot({ onReady, onOpen }: { onReady: () => void; onOpen: () => void }) {
  const form = useExperience((s) => s.form)!;
  const quality = useExperience((s) => s.quality);
  const set = useExperience((s) => s.set);
  const [assets, setAssets] = useState<SceneAssets | null>(null);
  const maxDpr = quality === 'high' ? 1.75 : quality === 'medium' ? 1.35 : 1;
  const [dpr, setDpr] = useState(() => Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, maxDpr));

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
    const q = useExperience.getState().quality;
    if (dpr > 1.01) setDpr((d) => Math.max(1, d - 0.25));
    else if (q !== 'low') set({ quality: q === 'high' ? 'medium' : 'low' });
  };

  return (
    <Canvas
      className="fgl-canvas"
      dpr={dpr}
      gl={{ antialias: quality === 'low', powerPreference: 'high-performance', alpha: false, stencil: false }}
      camera={{ fov: 32, near: 0.02, far: 220, position: [1.2, 1.2, 3.2] }}
      onCreated={onCreated}
      aria-hidden
    >
      <PerformanceMonitor onDecline={lowerQuality} flipflops={3} onFallback={() => set({ quality: 'low' })}>
        {assets && (
          <>
            <World form={form} assets={assets} quality={quality} onOpen={onOpen} />
            <ReadySignal onReady={onReady} />
          </>
        )}
      </PerformanceMonitor>
    </Canvas>
  );
}

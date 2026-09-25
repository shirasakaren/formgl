'use client';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Bloom, DepthOfField, EffectComposer, Noise, ToneMapping, Vignette, SMAA, N8AO } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode, type DepthOfFieldEffect } from 'postprocessing';
import { anim, type Quality } from '../store';
import type { LightPreset } from './presets';
import { sceneRefs } from './refs';

export function Effects({ preset, quality }: { preset: LightPreset; quality: Quality }) {
  const dof = useRef<DepthOfFieldEffect>(null);
  useFrame(() => {
    const e = dof.current;
    if (!e) return;
    // focus on the envelope / letter; narrower range = creamier background
    const d = sceneRefs.focusDistance;
    const macro = 1 - Math.min(1, anim.intro * 1.5);
    const range = d * (0.32 - 0.1 * macro) + 0.06;
    e.cocMaterial.focusDistance = d;
    e.cocMaterial.focusRange = range;
    e.bokehScale = (quality === 'high' ? 4.6 : 3.6) * (0.55 + 0.45 * macro) * (1 + anim.focusLetter * 0.25);
  });

  if (quality === 'low') return null;
  return (
    <EffectComposer ref={(c: unknown) => void (sceneRefs.composer = c)} multisampling={0} enableNormalPass={false}>
      {quality === 'high' ? <N8AO aoRadius={0.25} intensity={1.6} distanceFalloff={0.6} halfRes quality="performance" /> : <></>}
      <DepthOfField ref={dof} focusDistance={1} focusRange={0.4} bokehScale={3} resolutionScale={quality === 'high' ? 0.75 : 0.5} />
      <Bloom mipmapBlur intensity={preset.bloom * 0.55} luminanceThreshold={0.82} luminanceSmoothing={0.25} radius={0.72} />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <Vignette offset={0.28} darkness={0.42} blendFunction={BlendFunction.NORMAL} />
      <Noise premultiply opacity={0.06} blendFunction={BlendFunction.OVERLAY} />
      {quality === 'high' ? <SMAA /> : <></>}
    </EffectComposer>
  );
}

'use client';
import { useEffect, useMemo } from 'react';
import { Lightformer } from '@react-three/drei';
import { BakedEnvironment } from '../../common/BakedEnvironment';
import * as THREE from 'three';
import type { PublicForm } from '@formgl/shared';
import { useExperience, type Quality } from '../../../store';
import type { SceneAssets } from '../../assets';
import { Effects } from '../../Effects';
import { Dust } from '../../Particles';
import { PRESETS, type LightPreset } from '../../presets';
import { sceneRefs, type CamConfig } from '../../refs';
import { Curtains } from './Curtains';
import { Desk } from './Desk';
import { PaperPlane } from './PaperPlane';
import { Room } from './Room';
import { LETTER_REST, SUN_DIR, WINDOW_CENTRE } from './room';
import { TiedLetter } from './TiedLetter';

function atelierCam(): CamConfig {
  const subject = LETTER_REST.pos.clone().add(new THREE.Vector3(-0.02, 0.0, 0.0));
  return {
    subject,
    subjectSize: [0.22, 0.16],
    heroElev: [0.42, 0.5],
    heroAzim: [0.16, 0.08],
    heroFracW: [0.19, 0.26, 0.44],
    heroFracH: [0.2, 0.2],
    heroLookUp: [0.2, 0.26],
    closeTarget: LETTER_REST.pos.clone().add(new THREE.Vector3(-0.02, 0.01, 0.0)),
    closeElev: [0.85, 0.9],
    closeAzim: [0.1, 0.05],
    closeDist: [0.52, 0.56],
    introTarget: new THREE.Vector3(0.0, 1.55, -0.6),
    introElev: 0.02,
    introAzim: -0.25,
    introDist: [1.9, 2.4],
    letterCentre: new THREE.Vector3(0.03, 1.02, 0.24),
    letterDir: new THREE.Vector3(0.03, 0.12, 1).normalize(),
    fov: [36, 40, 46],
    flyAway: (k, pos, tgt) => {
      // turn to watch the plane sail out through the window
      const e = Math.min(1, k * 2.2);
      tgt.lerp(WINDOW_CENTRE.clone().add(new THREE.Vector3(0.1, 0.3, -1.2)), e * 0.8);
      pos.z += e * 0.4;
      pos.y += e * 0.08;
    },
  };
}

/** morning sun streaming in through the window */
function roomPreset(p: LightPreset): LightPreset {
  return { ...p, fogDensity: 0, bloom: p.bloom * 1.15 };
}

export default function AtelierWorld({ form, assets, quality, onOpen }: { form: PublicForm; assets: SceneAssets; quality: Quality; onOpen: () => void }) {
  const t = form.theme;
  const preset = useMemo(() => roomPreset(PRESETS[t.timeOfDay] ?? PRESETS.morning), [t.timeOfDay]);
  const reduced = useExperience((s) => s.reducedMotion);
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(-0.05, 1.0, -0.3);
    return o;
  }, []);
  useEffect(() => {
    sceneRefs.cam = atelierCam();
    sceneRefs.shadowRate = 12;
    sceneRefs.shadowDirty = true;
  }, []);
  const DIST = 9;
  const shadowSize = quality === 'low' ? 1024 : 2048;
  const sunPos: [number, number, number] = [target.position.x + SUN_DIR.x * DIST, target.position.y + SUN_DIR.y * DIST, target.position.z + SUN_DIR.z * DIST];
  return (
    <>
      <color attach="background" args={['#e9dfcf']} />
      <primitive object={target} />
      <spotLight
        color={preset.sunColor}
        intensity={preset.sunIntensity * 0.58}
        position={sunPos}
        target={target}
        angle={Math.atan(1.9 / DIST)}
        penumbra={0.2}
        decay={0}
        distance={0}
        castShadow
        shadow-mapSize-width={shadowSize}
        shadow-mapSize-height={shadowSize}
        shadow-camera-near={DIST - 4}
        shadow-camera-far={DIST + 5}
        shadow-bias={-0.0001}
        shadow-normalBias={0.01}
        shadow-radius={quality === 'high' ? 5 : 3}
        shadow-blurSamples={quality === 'high' ? 12 : 8}
      />
      {/* skylight through the window, and warm light bounced off the walls */}
      <directionalLight color={preset.skyHorizon} intensity={0.9} position={[0.1, 1.6, -2.5]} />
      <directionalLight color="#ffe9cf" intensity={0.85} position={[0.6, 1.8, 3]} />
      <hemisphereLight args={['#f6efe4', '#7a5a3c', 0.42]} />
      <BakedEnvironment intensity={0.45}>
        <Lightformer form="rect" intensity={3.2} color={preset.skyHorizon} scale={[1.1, 1.2, 1]} position={[0, 1.5, -0.9]} />
        <Lightformer form="rect" intensity={0.8} color="#f3e6d2" scale={[8, 3, 1]} position={[0, 1.4, 4]} rotation={[0, Math.PI, 0]} />
        <Lightformer form="rect" intensity={0.5} color="#efe2cc" scale={[6, 6, 1]} position={[0, 3, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <Lightformer form="rect" intensity={0.4} color="#e7d6bd" scale={[4, 3, 1]} position={[-2, 1.2, 0.5]} rotation={[0, Math.PI / 2, 0]} />
      </BakedEnvironment>
      <Room assets={assets} preset={preset} quality={quality} />
      <Curtains assets={assets} preset={preset} quality={quality} />
      <Desk assets={assets} quality={quality} accent={t.accentColor} />
      <TiedLetter assets={assets} ribbonColor={t.accentColor} sealColor={t.sealColor} onOpen={onOpen} />
      <PaperPlane assets={assets} />
      {t.dust && !reduced && <Dust assets={assets} preset={preset} quality={quality} />}
      <Effects preset={preset} quality={quality} />
    </>
  );
}

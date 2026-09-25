'use client';
import { useEffect, useMemo } from 'react';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import type { PublicForm } from '@formgl/shared';
import { useExperience, type Quality } from '../../../store';
import type { SceneAssets } from '../../assets';
import { Effects } from '../../Effects';
import { Dust } from '../../Particles';
import { PRESETS, type LightPreset } from '../../presets';
import { sceneRefs, type CamConfig } from '../../refs';
import { Birds } from '../../common/Birds';
import { Sky } from '../../common/Sky';
import { Horizon, Sand, ShoreProps } from './Beach';
import { Bottle, BOTTLE_REST } from './Bottle';
import { Sea, ShoreClock } from './Sea';

function seasideCam(): CamConfig {
  const subject = BOTTLE_REST.pos.clone().add(new THREE.Vector3(0.07, 0.01, -0.03));
  return {
    subject,
    subjectSize: [0.27, 0.1],
    heroElev: [0.24, 0.3],
    heroAzim: [0.3, 0.18],
    heroFracW: [0.42, 0.56, 0.78],
    heroFracH: [0.3, 0.26],
    heroLookUp: [0.07, 0.18],
    closeTarget: new THREE.Vector3(0.05, 0.24, 0.5),
    closeElev: [0.1, 0.14],
    closeAzim: [0.22, 0.14],
    closeDist: [1.25, 1.3],
    introTarget: new THREE.Vector3(0, 0.6, -2.5),
    introElev: 0.3,
    introAzim: 0.6,
    introDist: [5.5, 7.5],
    letterCentre: new THREE.Vector3(0.0, 0.34, 0.56),
    letterDir: new THREE.Vector3(0.04, 0.1, 1).normalize(),
    fov: [34, 38, 44],
    flyAway: (k, pos, tgt) => {
      // watch the bottle drift out toward the horizon
      tgt.z -= k * 6;
      tgt.x += k * 0.9;
      tgt.y -= k * 0.08;
      pos.y += k * 0.12;
    },
  };
}

/** morning sea light: sun low over the water, bright sky fill */
function seaPreset(p: LightPreset): LightPreset {
  const top = new THREE.Color(p.skyTop).lerp(new THREE.Color('#5f9fd1'), 0.45).getStyle();
  const horizon = new THREE.Color(p.skyHorizon).lerp(new THREE.Color('#c9dfec'), 0.62).getStyle();
  return { ...p, skyTop: top, skyHorizon: horizon, fog: horizon, sunDir: [-0.55, Math.max(0.3, p.sunDir[1] * 0.6), -0.8], hemiIntensity: p.hemiIntensity * 1.1, fogDensity: 0 };
}

export default function SeasideWorld({ form, assets, quality, onOpen }: { form: PublicForm; assets: SceneAssets; quality: Quality; onOpen: () => void }) {
  const t = form.theme;
  const preset = useMemo(() => seaPreset(PRESETS[t.timeOfDay] ?? PRESETS.morning), [t.timeOfDay]);
  const reduced = useExperience((s) => s.reducedMotion);
  const sun = useMemo(() => new THREE.Vector3(...preset.sunDir).normalize(), [preset]);
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.copy(BOTTLE_REST.pos);
    return o;
  }, []);
  useEffect(() => {
    sceneRefs.cam = seasideCam();
  }, []);
  const shadowSize = quality === 'low' ? 1024 : 2048;
  return (
    <>
      <color attach="background" args={[preset.skyHorizon]} />
      <fog attach="fog" args={[preset.fog, 40, 320]} />
      <ShoreClock />
      <Sky top={preset.skyTop} horizon={preset.skyHorizon} glow={preset.sunGlow} sunDir={preset.sunDir} cloudiness={0.28} />
      <primitive object={target} />
      <directionalLight
        color={preset.sunColor}
        intensity={preset.sunIntensity * 0.75}
        position={[BOTTLE_REST.pos.x + sun.x * 12, BOTTLE_REST.pos.y + sun.y * 12, BOTTLE_REST.pos.z + sun.z * 12]}
        target={target}
        castShadow
        shadow-mapSize-width={shadowSize}
        shadow-mapSize-height={shadowSize}
        shadow-camera-left={-1.4}
        shadow-camera-right={1.4}
        shadow-camera-top={1.4}
        shadow-camera-bottom={-1.4}
        shadow-camera-near={2}
        shadow-camera-far={24}
        shadow-bias={-0.0002}
        shadow-normalBias={0.01}
        shadow-radius={4}
      />
      <hemisphereLight args={[preset.hemiSky, '#d9c7a0', preset.hemiIntensity]} />
      {/* soft light bouncing off the bright beach and sea toward the viewer */}
      <directionalLight color={preset.skyHorizon} intensity={1.6} position={[0.4, 1.2, 3]} />
      <Environment resolution={64} frames={1} environmentIntensity={0.5}>
        <Lightformer form="rect" intensity={1.4} color={preset.skyTop} scale={[40, 40, 1]} position={[0, 20, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <Lightformer form="rect" intensity={1.1} color={preset.skyHorizon} scale={[80, 8, 1]} position={[0, 2, -25]} />
        <Lightformer form="rect" intensity={0.7} color="#e8d6b0" scale={[80, 6, 1]} position={[0, -2, 20]} rotation={[0, Math.PI, 0]} />
        <Lightformer form="circle" intensity={8} color={preset.sunGlow} scale={4} position={[sun.x * 20, sun.y * 20, sun.z * 20]} target={[0, 0, 0]} />
      </Environment>
      <Sand assets={assets} />
      <Sea preset={preset} quality={quality} />
      <Horizon preset={preset} />
      <ShoreProps assets={assets} quality={quality} />
      <Bottle assets={assets} sealColor={t.sealColor} quality={quality} onOpen={onOpen} />
      <Birds count={quality === 'low' ? 3 : 6} center={[4, 7, -40]} spread={[40, 5, 12]} color="#5b6368" scale={0.7} />
      {t.dust && !reduced && <Dust assets={assets} preset={preset} quality={quality} />}
      <Effects preset={preset} quality={quality} />
    </>
  );
}

'use client';
import { useEffect, useMemo } from 'react';
import { Lightformer } from '@react-three/drei';
import { BakedEnvironment } from '../../common/BakedEnvironment';
import * as THREE from 'three';
import type { PublicForm } from '@formgl/shared';
import type { Quality } from '../../../store';
import type { SceneAssets } from '../../assets';
import { Effects } from '../../Effects';
import { PRESETS, type LightPreset } from '../../presets';
import { sceneRefs, type CamConfig } from '../../refs';
import { Birds } from '../../common/Birds';
import { Sky } from '../../common/Sky';
import { Balloons } from './Balloons';
import { Basket, FarBalloons } from './Basket';
import { CloudFloor, Clouds } from './Clouds';
import { CATCH, HANG, SUN_DIR } from './sky';

function skiesCam(): CamConfig {
  return {
    subject: HANG.clone().add(new THREE.Vector3(0, 0.2, 0)),
    subjectSize: [0.42, 0.72],
    heroElev: [0.22, 0.2],
    heroAzim: [-0.14, -0.06],
    heroFracW: [0.3, 0.38, 0.6],
    heroFracH: [0.52, 0.44],
    heroLookUp: [0.09, 0.12],
    closeTarget: CATCH.clone().add(new THREE.Vector3(0, 0.12, 0)),
    closeElev: [0.12, 0.14],
    closeAzim: [-0.08, -0.04],
    closeDist: [0.62, 0.66],
    introTarget: new THREE.Vector3(0, 3.2, -0.6),
    introElev: 0.12,
    introAzim: 0.75,
    introDist: [11, 14],
    letterCentre: new THREE.Vector3(0.0, 1.5, -0.35),
    letterDir: new THREE.Vector3(0.02, 0.06, 1).normalize(),
    fov: [38, 42, 48],
    flyAway: (k, pos, tgt) => {
      // look up and follow the reply as it floats away toward the sun
      tgt.x += k * 1.6;
      tgt.y += k * 3.4;
      tgt.z -= k * 3.2;
      pos.y -= k * 0.1;
    },
  };
}

/** pastel high-altitude light: a peach horizon, powder-blue zenith, lavender cloud shadows */
function skyPreset(p: LightPreset): LightPreset {
  const mix = (a: string, b: string, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t).getStyle();
  return {
    ...p,
    skyTop: '#3f86d6',
    skyHorizon: '#f7c3ae',
    sunGlow: mix(p.sunGlow, '#fff0d6', 0.4),
    fog: mix(p.skyHorizon, '#f3dcd6', 0.6),
    fogDensity: 0,
    bloom: p.bloom * 1.2,
  };
}

export default function SkiesWorld({ form, assets, quality, onOpen }: { form: PublicForm; assets: SceneAssets; quality: Quality; onOpen: () => void }) {
  const t = form.theme;
  const preset = useMemo(() => skyPreset(PRESETS[t.timeOfDay] ?? PRESETS.golden), [t.timeOfDay]);
  const palette = useMemo(() => ['#f4b6c2', '#fde2a7', '#b9d7ea', '#cdb4db', t.accentColor], [t.accentColor]);
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, 1.2, -0.4);
    return o;
  }, []);
  useEffect(() => {
    sceneRefs.cam = skiesCam();
    sceneRefs.shadowRate = 0;
    sceneRefs.shadowDirty = true;
  }, []);
  const shadowSize = quality === 'low' ? 1024 : 2048;
  const sunArr = useMemo(() => SUN_DIR.toArray() as [number, number, number], []);
  return (
    <>
      <color attach="background" args={[preset.skyHorizon]} />
      <Sky top={preset.skyTop} horizon={preset.skyHorizon} glow={preset.sunGlow} sunDir={sunArr} cloudiness={0.2} below="#d9c6e6" />
      <primitive object={target} />
      <directionalLight
        color={preset.sunColor}
        intensity={preset.sunIntensity * 0.7}
        position={[target.position.x + SUN_DIR.x * 10, target.position.y + SUN_DIR.y * 10, target.position.z + SUN_DIR.z * 10]}
        target={target}
        castShadow={quality !== 'low'}
        shadow-mapSize-width={shadowSize}
        shadow-mapSize-height={shadowSize}
        shadow-camera-left={-1.8}
        shadow-camera-right={1.8}
        shadow-camera-top={1.8}
        shadow-camera-bottom={-1.8}
        shadow-camera-near={4}
        shadow-camera-far={18}
        shadow-bias={-0.0002}
        shadow-normalBias={0.01}
        shadow-radius={4}
      />
      {/* light bouncing up off the cloud sea, and the soft sky dome */}
      <hemisphereLight args={[preset.skyTop, '#f3e4ec', 0.75]} />
      <directionalLight color="#f6e3ea" intensity={0.6} position={[-0.5, -1, 1.5]} />
      {/* warm light on the letter from our side (the sun is ahead of us) */}
      <directionalLight color="#ffeede" intensity={1.1} position={[0.4, 1.2, 3]} />
      <BakedEnvironment intensity={0.6}>
        <Lightformer form="rect" intensity={1.3} color={preset.skyTop} scale={[40, 40, 1]} position={[0, 20, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <Lightformer form="rect" intensity={1.4} color={preset.skyHorizon} scale={[80, 10, 1]} position={[0, 0, -25]} />
        <Lightformer form="rect" intensity={1.1} color="#f1e2ee" scale={[80, 80, 1]} position={[0, -15, 0]} rotation={[-Math.PI / 2, 0, 0]} />
        <Lightformer form="circle" intensity={9} color={preset.sunGlow} scale={4} position={[SUN_DIR.x * 20, SUN_DIR.y * 20, SUN_DIR.z * 20]} target={[0, 0, 0]} />
      </BakedEnvironment>
      <CloudFloor lit="#ffffff" shade="#a996cf" horizon={preset.skyHorizon} />
      <Clouds assets={assets} quality={quality} lit="#ffffff" shade="#b9a7d8" horizon={preset.skyHorizon} sunDir={SUN_DIR} />
      <FarBalloons assets={assets} />
      <Basket assets={assets} quality={quality} accent={t.accentColor} />
      <Balloons palette={palette} accent={t.accentColor} onOpen={onOpen} />
      <Birds count={quality === 'low' ? 3 : 5} center={[-20, 8, -70]} spread={[30, 6, 10]} color="#6b6470" scale={0.8} />
      <Effects preset={preset} quality={quality} />
    </>
  );
}

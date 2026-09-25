'use client';
import { useEffect, useMemo } from 'react';
import { Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import type { PublicForm } from '@formgl/shared';
import type { Quality } from '../../../store';
import type { SceneAssets } from '../../assets';
import { BakedEnvironment } from '../../common/BakedEnvironment';
import { Sky } from '../../common/Sky';
import { Effects } from '../../Effects';
import { PRESETS, type LightPreset } from '../../presets';
import { sceneRefs, type CamConfig } from '../../refs';
import { Dock, Reeds } from './Dock';
import { Fireflies } from './Fireflies';
import { FarLanterns, Moon, Shore, Stars, Water } from './Lake';
import { Lantern } from './Lantern';
import { LANTERN, LANTERN_NEAR, LANTERN_REST, MOON_DIR } from './lake';

function lanternCam(): CamConfig {
  const mid = LANTERN.base + LANTERN.h / 2;
  return {
    subject: LANTERN_REST.clone().add(new THREE.Vector3(0, mid, 0)),
    subjectSize: [0.34, 0.42],
    heroElev: [0.34, 0.4],
    heroAzim: [-0.22, -0.12],
    heroFracW: [0.13, 0.17, 0.34],
    heroFracH: [0.4, 0.34],
    heroLookUp: [0.1, 0.16],
    closeTarget: LANTERN_NEAR.clone().add(new THREE.Vector3(0, mid + 0.04, 0)),
    closeElev: [0.78, 0.82],
    closeAzim: [-0.12, -0.06],
    closeDist: [0.5, 0.56],
    introTarget: new THREE.Vector3(-0.4, 1.4, -6),
    introElev: 0.08,
    introAzim: 0.55,
    introDist: [7, 9],
    letterCentre: new THREE.Vector3(0.0, 0.78, 0.4),
    letterDir: new THREE.Vector3(0.02, 0.12, 1).normalize(),
    fov: [38, 42, 48],
    flyAway: (k, pos, tgt) => {
      // tilt up and watch our lantern climb into the stars with the others
      tgt.y += k * 4.2;
      tgt.z -= k * 2.8;
      tgt.x += k * 0.3;
      pos.y += k * 0.08;
    },
  };
}

/** moonlit night: deep blue sky with a faint warm band left over on the horizon */
function nightPreset(p: LightPreset): LightPreset {
  return {
    ...p,
    skyTop: '#070d22',
    skyHorizon: '#27304f',
    sunGlow: '#56628c',
    sunColor: '#b7c6ff',
    sunIntensity: 1.1,
    hemiSky: '#2c3b6b',
    hemiGround: '#0a0d14',
    hemiIntensity: 0.45,
    fog: '#1c2340',
    fogDensity: 0,
    bloom: 1.35,
    envIntensity: 0.3,
  };
}

export default function LanternWorld({ form, assets, quality, onOpen }: { form: PublicForm; assets: SceneAssets; quality: Quality; onOpen: () => void }) {
  const t = form.theme;
  const preset = useMemo(() => nightPreset(PRESETS[t.timeOfDay] ?? PRESETS.dusk), [t.timeOfDay]);
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, 0.3, 0.2);
    return o;
  }, []);
  useEffect(() => {
    sceneRefs.cam = lanternCam();
    // the moon never moves and the lantern's shadow is tiny: refresh shadows only a few times a second
    sceneRefs.shadowRate = 6;
    sceneRefs.shadowDirty = true;
    // the letter is read by lantern light: a warm lamp over our shoulder keeps the paper its true colour
    sceneRefs.readingLight = 2.6;
    return () => {
      sceneRefs.readingLight = 1;
    };
  }, []);
  const shadowSize = quality === 'low' ? 1024 : 2048;
  const moonArr = useMemo(() => MOON_DIR.toArray() as [number, number, number], []);
  return (
    <>
      <color attach="background" args={[preset.skyHorizon]} />
      <fog attach="fog" args={[preset.fog, 30, 260]} />
      <Sky top={preset.skyTop} horizon={preset.skyHorizon} glow={preset.sunGlow} sunDir={moonArr} cloudiness={0.06} below="#0b1020" />
      <Stars quality={quality} />
      <Moon />
      <primitive object={target} />
      <directionalLight
        color={preset.sunColor}
        intensity={preset.sunIntensity}
        position={[target.position.x + MOON_DIR.x * 10, target.position.y + MOON_DIR.y * 10, target.position.z + MOON_DIR.z * 10]}
        target={target}
        castShadow={quality !== 'low'}
        shadow-mapSize-width={shadowSize}
        shadow-mapSize-height={shadowSize}
        shadow-camera-left={-2}
        shadow-camera-right={2}
        shadow-camera-top={2}
        shadow-camera-bottom={-2}
        shadow-camera-near={3}
        shadow-camera-far={20}
        shadow-bias={-0.0002}
        shadow-normalBias={0.01}
        shadow-radius={4}
      />
      <hemisphereLight args={[preset.hemiSky, preset.hemiGround, preset.hemiIntensity]} />
      {/* faint cool fill from behind us so the jetty and the letter never go fully black */}
      <directionalLight color="#8d9bd0" intensity={0.35} position={[0.6, 1.4, 3]} />
      <BakedEnvironment intensity={preset.envIntensity}>
        <Lightformer form="rect" intensity={0.6} color={preset.skyTop} scale={[40, 40, 1]} position={[0, 20, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <Lightformer form="rect" intensity={0.9} color={preset.skyHorizon} scale={[80, 8, 1]} position={[0, 2, -25]} />
        <Lightformer form="rect" intensity={0.5} color="#e7a15c" scale={[30, 2, 1]} position={[0, 0.5, -20]} />
        <Lightformer form="circle" intensity={6} color="#dfe6ff" scale={2.5} position={[MOON_DIR.x * 20, MOON_DIR.y * 20, MOON_DIR.z * 20]} target={[0, 0, 0]} />
      </BakedEnvironment>
      <Water sky={preset.skyTop} horizon={preset.skyHorizon} deep="#05080f" />
      <Shore color="#0a0f1c" />
      <FarLanterns paper={t.paperColor} />
      <Dock assets={assets} quality={quality} />
      <Reeds quality={quality} />
      <Lantern assets={assets} paper={t.paperColor} seal={t.sealColor} quality={quality} onOpen={onOpen} />
      <Fireflies quality={quality} />
      <Effects preset={preset} quality={quality} />
    </>
  );
}

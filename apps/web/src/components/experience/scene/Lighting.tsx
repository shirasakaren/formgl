'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { anim, type Quality } from '../store';
import type { SceneAssets } from './assets';
import { DappleMap } from './Dapple';
import type { LightPreset } from './presets';

export function Lighting({ preset, assets, quality }: { preset: LightPreset; assets: SceneAssets; quality: Quality }) {
  const spot = useRef<THREE.SpotLight>(null!);
  const { scene } = useThree();
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, 0.45, 0.0);
    return o;
  }, []);
  const dapple = useMemo(
    () =>
      new DappleMap({
        size: quality === 'low' ? 512 : 1024,
        leafTexture: assets.leaves,
        open: preset.canopyOpen,
        count: quality === 'low' ? 5000 : quality === 'medium' ? 9000 : 12000,
      }),
    [assets.leaves, preset.canopyOpen, quality],
  );
  const dir = useMemo(() => new THREE.Vector3(...preset.sunDir).normalize(), [preset]);
  const DIST = 30;
  const RADIUS = 2.6;

  useEffect(() => {
    scene.add(target);
    const s = spot.current;
    s.target = target;
    s.map = dapple.target.texture;
    return () => {
      scene.remove(target);
      dapple.dispose();
    };
  }, [dapple, scene, target]);

  const debug = typeof window !== 'undefined' && window.location.search.includes('dbg=dapple');
  const debugSun = typeof window !== 'undefined' && window.location.search.includes('dbg=sun');
  const acc = useRef(0);
  useFrame(({ gl, clock }, dt) => {
    // the canopy mask runs at ~30fps — plenty for swaying leaves
    acc.current += dt;
    if (acc.current < 1 / 32) return;
    acc.current = 0;
    dapple.update(gl, clock.elapsedTime, anim.wind);
    if (debug) (window as unknown as { __dapple?: (w?: 'target' | 'blur') => string }).__dapple = (w) => dapple.dump(gl, w);
  });

  const shadowSize = quality === 'low' ? 1024 : 2048;
  return (
    <>
      <spotLight
        ref={spot}
        color={preset.sunColor}
        intensity={preset.sunIntensity}
        position={[target.position.x + dir.x * DIST, target.position.y + dir.y * DIST, target.position.z + dir.z * DIST]}
        angle={Math.atan(RADIUS / DIST)}
        penumbra={0.5}
        decay={0}
        distance={0}
        castShadow
        shadow-mapSize-width={shadowSize}
        shadow-mapSize-height={shadowSize}
        shadow-camera-near={DIST - 8}
        shadow-camera-far={DIST + 8}
        shadow-bias={-0.00008}
        shadow-normalBias={0.012}
        shadow-radius={quality === 'high' ? 6 : 3}
        shadow-blurSamples={quality === 'high' ? 16 : 8}
      />
      {debug && (
        <mesh position={[0.04, 0.62, 0.1]}>
          <planeGeometry args={[0.25, 0.25]} />
          <meshBasicMaterial map={dapple.target.texture} toneMapped={false} />
        </mesh>
      )}
      <hemisphereLight args={[preset.hemiSky, preset.hemiGround, debugSun ? 0 : preset.hemiIntensity]} />
      <Environment resolution={64} frames={1} environmentIntensity={debugSun ? 0 : preset.envIntensity}>
        <Lightformer form="rect" intensity={1.2} color={preset.skyTop} scale={[40, 40, 1]} position={[0, 20, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <Lightformer form="rect" intensity={0.9} color={preset.skyHorizon} scale={[60, 8, 1]} position={[0, 3, -20]} />
        <Lightformer form="rect" intensity={0.5} color={preset.lawnFar} scale={[60, 6, 1]} position={[0, -2, 20]} rotation={[0, Math.PI, 0]} />
        <Lightformer form="circle" intensity={6} color={preset.sunGlow} scale={4} position={[dir.x * 20, dir.y * 20, dir.z * 20]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.35} color={preset.treeTint} scale={[40, 10, 1]} position={[-20, 4, 0]} rotation={[0, Math.PI / 2, 0]} />
      </Environment>
    </>
  );
}

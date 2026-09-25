'use client';
import { useLayoutEffect, useMemo, type ReactNode } from 'react';
import { createPortal, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * A reflection/ambient environment baked ONCE, synchronously, when the world mounts.
 * Children (drei <Lightformer>s) are rendered into a private scene which is turned into a
 * prefiltered (PMREM) map and set as `scene.environment` before any material is compiled —
 * so shaders are built with it from the start and never have to be rebuilt later.
 */
export function BakedEnvironment({ intensity = 1, resolution = 64, children }: { intensity?: number; resolution?: number; children: ReactNode }) {
  const envScene = useMemo(() => new THREE.Scene(), []);
  return (
    <>
      {createPortal(
        <>
          {children}
          <Bake envScene={envScene} intensity={intensity} resolution={resolution} />
        </>,
        envScene,
      )}
    </>
  );
}

/** runs after the lightformers' own layout effects (it is the last child) */
function Bake({ envScene, intensity, resolution }: { envScene: THREE.Scene; intensity: number; resolution: number }) {
  const { gl, scene } = useThree();
  useLayoutEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    envScene.updateMatrixWorld(true);
    const rt = pmrem.fromScene(envScene, 0, 0.1, 1000, { size: resolution * 4 });
    pmrem.dispose();
    const prev = scene.environment;
    const prevI = scene.environmentIntensity;
    scene.environment = rt.texture;
    scene.environmentIntensity = intensity;
    return () => {
      if (scene.environment === rt.texture) {
        scene.environment = prev;
        scene.environmentIntensity = prevI;
      }
      rt.dispose();
    };
  }, [gl, scene, envScene, intensity, resolution]);
  return null;
}

'use client';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mulberry32 } from '../noise';

/** A few distant birds (gulls / swallows) gliding and flapping on lazy loops. */
export function Birds({ count = 4, center = [0, 6, -30], spread = [30, 4, 10], color = '#3a3a3a', scale = 0.6, seed = 3 }: { count?: number; center?: [number, number, number]; spread?: [number, number, number]; color?: string; scale?: number; seed?: number }) {
  const refs = useRef<Array<THREE.Group | null>>([]);
  const birds = useMemo(() => {
    const r = mulberry32(seed);
    return Array.from({ length: count }, () => ({ ph: r() * 10, sp: 0.05 + r() * 0.05, ox: (r() - 0.5) * spread[0], oy: (r() - 0.5) * spread[1], oz: (r() - 0.5) * spread[2], s: scale * (0.7 + r() * 0.6) }));
  }, [count, spread, scale, seed]);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    // one wing: a thin swept triangle
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0.08, -0.35, 0.95, 0, 0.1], 3));
    g.computeVertexNormals();
    return g;
  }, []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, fog: true }), [color]);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    birds.forEach((b, i) => {
      const g = refs.current[i];
      if (!g) return;
      const a = t * b.sp + b.ph;
      g.position.set(center[0] + b.ox + Math.sin(a) * 12, center[1] + b.oy + Math.sin(a * 2.3) * 0.8, center[2] + b.oz + Math.cos(a) * 5);
      g.rotation.y = -a + Math.PI / 2;
      const flap = Math.sin(t * 7 + b.ph * 3) * 0.6 * (0.5 + 0.5 * Math.sin(t * 0.7 + b.ph));
      (g.children[0] as THREE.Mesh).rotation.z = flap;
      (g.children[1] as THREE.Mesh).rotation.z = -flap;
      g.scale.setScalar(b.s);
    });
  });
  return (
    <>
      {birds.map((_, i) => (
        <group key={i} ref={(el) => { refs.current[i] = el; }}>
          <mesh geometry={geo} material={mat} />
          <mesh geometry={geo} material={mat} scale={[-1, 1, 1]} />
        </group>
      ))}
    </>
  );
}

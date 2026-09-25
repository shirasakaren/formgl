'use client';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { anim } from '../store';
import { LETTER, type SceneAssets } from './assets';
import { BendPanel } from './bend';
import { sceneRefs } from './refs';

const LW = LETTER.w;
const LH = LETTER.h;
/** letter placement inside the envelope (envelope local space) */
const IN_ENV = { y: 0.0016, z: -0.074 };

export function Letter3D({ assets }: { assets: SceneAssets }) {
  const group = useRef<THREE.Group>(null!);
  const res = useMemo(() => {
    const nrm = assets.letterPaper.normalMap.clone();
    nrm.repeat.set(2, 3);
    nrm.needsUpdate = true;
    const backMap = assets.letterPaper.map.clone();
    backMap.repeat.set(1.5, 2);
    backMap.needsUpdate = true;
    const front = new THREE.MeshStandardMaterial({ map: assets.letterFace, normalMap: nrm, normalScale: new THREE.Vector2(0.3, 0.3), roughness: 0.9 });
    const back = new THREE.MeshStandardMaterial({ map: backMap, normalMap: nrm, normalScale: new THREE.Vector2(0.3, 0.3), roughness: 0.9, side: THREE.BackSide });
    // bottom half: flat plane using the lower half of the face texture
    const bottom = new THREE.PlaneGeometry(LW, LH / 2, 1, 1);
    const uv = bottom.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * 0.5);
    bottom.translate(0, -LH / 4, 0);
    // top half: bendable, hinged at the fold (y = 0)
    const top = new BendPanel(LW, LH / 2, 12, 16, () => LW / 2, (x, s) => [0.5 - x / LW, 0.5 + s / LH]);
    const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0));
    const topQuat = new THREE.Quaternion().setFromRotationMatrix(basis);
    return { front, back, bottom, top, topQuat };
  }, [assets]);

  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      local: new THREE.Matrix4(),
      p: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      s: new THREE.Vector3(),
      e: new THREE.Euler(),
      q2: new THREE.Quaternion(),
      p2: new THREE.Vector3(),
    }),
    [],
  );

  useFrame((state) => {
    const g = group.current;
    const env = sceneRefs.envelope;
    if (!g || !env) return;
    const t = state.clock.elapsedTime;
    env.updateMatrixWorld();

    /* pose while inside / sliding out of the envelope (envelope-local) */
    const s = anim.slide;
    const sy = IN_ENV.y + 0.006 * s + 0.07 * s * s;
    const sz = IN_ENV.z - 0.11 * s - 0.02 * s * s;
    tmp.e.set(-Math.PI / 2 + s * 0.55, 0, Math.sin(s * Math.PI) * 0.03);
    tmp.q.setFromEuler(tmp.e);
    tmp.local.compose(tmp.p.set(0, sy, sz), tmp.q, tmp.s.set(1, 1, 1));
    tmp.m.multiplyMatrices(env.matrixWorld, tmp.local);
    tmp.m.decompose(tmp.p, tmp.q, tmp.s);

    /* flight to the reading pose */
    const r = anim.rise;
    const target = sceneRefs.letterTarget;
    if (r > 0 && target.ready) {
      const k = r * r * (3 - 2 * r);
      // fly to a centred presentation pose (folded half centred, then the full sheet),
      // and finally glide toward the viewer into exact DOM alignment
      const uf = anim.unfold;
      const al = anim.align;
      tmp.p2.copy(target.present).addScaledVector(target.up, (LH / 4) * (1 - uf * uf * (3 - 2 * uf)));
      tmp.p2.lerp(target.pos, al * al * (3 - 2 * al));
      // the unfolded letter is centred on the fold; while folded we offset so it arrives centred
      tmp.p.lerp(tmp.p2, k);
      tmp.p.y += Math.sin(r * Math.PI) * 0.07;
      tmp.q.slerp(target.quat, k);
      // playful wobble in flight
      tmp.e.set(Math.sin(r * Math.PI * 2) * 0.08 * (1 - r), Math.sin(r * Math.PI) * 0.18 * (1 - r * 0.5), Math.sin(r * Math.PI * 3) * 0.05 * (1 - r));
      tmp.q2.setFromEuler(tmp.e);
      tmp.q.multiply(tmp.q2);
    }
    // gentle breathing in the reading pose (as if held in the wind)
    if (r >= 1) {
      tmp.e.set(Math.sin(t * 0.8) * 0.012, Math.sin(t * 0.6) * 0.015, Math.sin(t * 0.5) * 0.006);
      tmp.q2.setFromEuler(tmp.e);
      tmp.q.multiply(tmp.q2);
    }
    g.position.copy(tmp.p);
    g.quaternion.copy(tmp.q);

    /* unfolding */
    const u = anim.unfold;
    const a = Math.PI * (1 - u) * 0.995;
    const k = 7 * Math.sin(Math.PI * u);
    res.top.apply(a, k, 0.0007 * (1 - u) + 0.0002);
    g.visible = anim.letterVisible > 0.5;
  });

  return (
    <group ref={group}>
      <group>
        <mesh geometry={res.bottom} material={res.front} castShadow receiveShadow />
        <mesh geometry={res.bottom} material={res.back} castShadow receiveShadow />
        <group quaternion={res.topQuat}>
          <mesh geometry={res.top.geometry} material={res.front} castShadow receiveShadow />
          <mesh geometry={res.top.geometry} material={res.back} castShadow receiveShadow />
        </group>
      </group>
    </group>
  );
}

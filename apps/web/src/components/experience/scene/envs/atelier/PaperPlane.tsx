'use client';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { anim } from '../../../store';
import { LETTER, type SceneAssets } from '../../assets';
import { sceneRefs } from '../../refs';
import { WINDOW_CENTRE } from './room';

const A = LETTER.h / 4; // half length of the folded sheet
const B = LETTER.w / 2; // half width
const smooth = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

/*
 * The folded letter becomes a dart. Vertices are defined twice: flat on the sheet
 * (x along its length, z across, y = 0) and folded into the plane (x forward, y up).
 * A fan from the nose covers the whole sheet, so the morph never tears.
 */
const SHEET: Record<string, [number, number]> = {
  N: [A, 0],
  FL: [A, -B],
  FR: [A, B],
  RL: [-A, -B],
  RR: [-A, B],
  ML: [-A, -0.045],
  MR: [-A, 0.045],
  RC: [-A, 0],
};
const PLANE: Record<string, [number, number, number]> = {
  N: [0.105, 0, 0],
  FL: [-0.005, 0.006, -0.014],
  FR: [-0.005, 0.006, 0.014],
  RL: [-0.07, 0.014, -0.1],
  RR: [-0.07, 0.014, 0.1],
  ML: [-0.07, 0.002, -0.016],
  MR: [-0.07, 0.002, 0.016],
  RC: [-0.07, -0.028, 0],
};
const TRIS = [
  ['N', 'FL', 'RL'],
  ['N', 'RL', 'ML'],
  ['N', 'ML', 'RC'],
  ['N', 'RC', 'MR'],
  ['N', 'MR', 'RR'],
  ['N', 'RR', 'FR'],
];

export function PaperPlane({ assets }: { assets: SceneAssets }) {
  const mesh = useRef<THREE.Mesh>(null!);
  const res = useMemo(() => {
    const n = TRIS.length * 3;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const uv = new Float32Array(n * 2);
    TRIS.forEach((tri, i) =>
      tri.forEach((k, j) => {
        const [a, b] = SHEET[k];
        uv.set([b / (2 * B) + 0.5, a / (2 * A) + 0.5], (i * 3 + j) * 2);
      }),
    );
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const map = assets.letterPaper.map.clone();
    map.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.9, side: THREE.DoubleSide, flatShading: true });
    // sheet frame → letter frame: plane x → letter y (its top), plane y → letter z (toward us), plane z → letter x
    const perm = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)));
    return { geo, pos, mat, perm };
  }, [assets]);

  const v = useMemo(
    () => ({
      qSheet: new THREE.Quaternion(),
      qFly: new THREE.Quaternion(),
      q: new THREE.Quaternion(),
      qr: new THREE.Quaternion(),
      m: new THREE.Matrix4(),
      x: new THREE.Vector3(),
      y: new THREE.Vector3(),
      z: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
      p0: new THREE.Vector3(),
      p: new THREE.Vector3(),
      t: new THREE.Vector3(),
      curve: null as THREE.CatmullRomCurve3 | null,
      lastK: -1,
    }),
    [],
  );

  const heading = (dir: THREE.Vector3, roll: number, out: THREE.Quaternion) => {
    v.x.copy(dir).normalize();
    v.z.crossVectors(v.x, v.up).normalize();
    v.y.crossVectors(v.z, v.x).normalize();
    v.m.makeBasis(v.x, v.y, v.z);
    out.setFromRotationMatrix(v.m);
    v.qr.setFromAxisAngle(v.x.set(1, 0, 0), roll);
    return out.multiply(v.qr);
  };

  useFrame((st) => {
    const m = mesh.current;
    const pl = anim.fx.plane ?? 0;
    const F = anim.flyAway;
    m.visible = pl > 0.001 && anim.letterVisible < 0.5;
    if (!m.visible) {
      v.curve = null;
      return;
    }
    const t = st.clock.elapsedTime;
    const k = smooth(pl);
    /* morph the geometry */
    if (k !== v.lastK) {
      v.lastK = k;
      TRIS.forEach((tri, i) =>
        tri.forEach((key, j) => {
          const [a, b] = SHEET[key];
          const P = PLANE[key];
          const o = (i * 3 + j) * 3;
          res.pos[o] = a + (P[0] - a) * k;
          res.pos[o + 1] = P[1] * k;
          res.pos[o + 2] = b + (P[2] - b) * k;
        }),
      );
      res.geo.attributes.position.needsUpdate = true;
      res.geo.computeVertexNormals();
      res.geo.computeBoundingSphere();
    }
    const lt = sceneRefs.letterTarget;
    /* from the letter's pose to a heading toward the window */
    v.qSheet.copy(lt.quat).multiply(res.perm);
    if (!v.curve) {
      v.p0.copy(lt.present);
      v.curve = new THREE.CatmullRomCurve3(
        [
          v.p0.clone(),
          v.p0.clone().add(new THREE.Vector3(0.02, -0.05, -0.32)),
          WINDOW_CENTRE.clone(),
          new THREE.Vector3(0.45, 1.85, -2.4),
          new THREE.Vector3(1.4, 2.8, -7.5),
        ],
        false,
        'centripetal',
      );
    }
    v.t.subVectors(WINDOW_CENTRE, v.p0);
    heading(v.t, 0, v.qFly);
    v.q.slerpQuaternions(v.qSheet, v.qFly, k);
    v.p.copy(v.p0);
    v.p.y += Math.sin(k * Math.PI) * 0.03 + k * 0.01;
    if (F > 0) {
      const u = Math.min(1, F);
      v.curve.getPointAt(u, v.p);
      v.curve.getTangentAt(Math.min(0.999, u + 0.001), v.t);
      // bank through the window and a small dip-and-lift as it glides
      const roll = Math.sin(u * Math.PI * 2) * 0.35 + Math.sin(t * 3) * 0.04;
      heading(v.t, roll, v.qFly);
      v.q.slerp(v.qFly, Math.min(1, u * 6));
    }
    m.position.copy(v.p);
    m.quaternion.copy(v.q);
  });

  return <mesh ref={mesh} geometry={res.geo} material={res.mat} castShadow visible={false} frustumCulled={false} />;
}

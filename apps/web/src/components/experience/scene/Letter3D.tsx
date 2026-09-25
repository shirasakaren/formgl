"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FONT_FAMILIES } from "@formgl/shared";
import { anim, useExperience } from "../store";
import { letterFaceCanvas, toTexture } from "./textures";
import { LETTER, type SceneAssets } from "./assets";
import { BendPanel, ScrollPanel } from "./bend";
import { sceneRefs } from "./refs";

const LW = LETTER.w;
const LH = LETTER.h;
const ROLL_R = 0.0085;

export type LetterStyle = "fold" | "scroll";

/**
 * The 3D letter, shared by every environment.
 *  - style "fold":   folded in half (envelope, desk)      — anim.unfold opens it
 *  - style "scroll": rolled into a scroll (bottle, sky)   — anim.unfold unrolls it,
 *                    anim.fx.ribbon slips the ribbon off first
 * While in its vessel the pose comes from `sceneRefs.letterSource` (fold: the sheet
 * origin at the fold; scroll: the roll's axis centre). Then it rises to the camera's
 * presentation pose and finally aligns with the DOM letter.
 */
export function Letter3D({
  assets,
  style = "fold",
  ribbonColor = "#8e1b1b",
}: {
  assets: SceneAssets;
  style?: LetterStyle;
  ribbonColor?: string;
}) {
  const group = useRef<THREE.Group>(null!);
  const ribbon = useRef<THREE.Group>(null!);
  const readLight = useRef<THREE.DirectionalLight>(null!);
  const res = useMemo(() => {
    const nrm = assets.letterPaper.normalMap.clone();
    nrm.repeat.set(2, 3);
    nrm.needsUpdate = true;
    const backMap = assets.letterPaper.map.clone();
    backMap.repeat.set(1.5, 2);
    backMap.needsUpdate = true;
    const front = new THREE.MeshStandardMaterial({
      map: assets.letterFace,
      normalMap: nrm,
      normalScale: new THREE.Vector2(0.3, 0.3),
      roughness: 0.9,
    });
    // while the form is written straight onto the sheet (DOM projected on top), the printed
    // preview fades to blank paper: uBlank 0 = printed face, 1 = plain paper
    const blankUniforms = {
      uBlank: { value: 0 },
      uBlankMap: { value: assets.letterPaper.map },
    };
    front.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, blankUniforms);
      sh.fragmentShader = sh.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nuniform float uBlank; uniform sampler2D uBlankMap;",
        )
        .replace(
          "#include <map_fragment>",
          `#ifdef USE_MAP
            vec4 sampledDiffuseColor = texture2D( map, vMapUv );
            vec4 blankColor = texture2D( uBlankMap, vMapUv * vec2(1.5, 2.0) );
            diffuseColor *= mix( sampledDiffuseColor, blankColor, uBlank );
          #endif`,
        );
    };
    const back = new THREE.MeshStandardMaterial({
      map: backMap,
      normalMap: nrm,
      normalScale: new THREE.Vector2(0.3, 0.3),
      roughness: 0.9,
      side: THREE.BackSide,
    });
    // fold style
    const bottom = new THREE.PlaneGeometry(LW, LH / 2, 1, 1);
    const uv = bottom.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * 0.5);
    bottom.translate(0, -LH / 4, 0);
    const top = new BendPanel(
      LW,
      LH / 2,
      12,
      16,
      () => LW / 2,
      (x, s) => [0.5 - x / LW, 0.5 + s / LH],
    );
    const basis = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 1, 0),
    );
    const topQuat = new THREE.Quaternion().setFromRotationMatrix(basis);
    // scroll style
    const scroll = style === "scroll" ? new ScrollPanel(LW, LH, ROLL_R) : null;
    const ribbonMat = new THREE.MeshStandardMaterial({
      color: ribbonColor,
      roughness: 0.45,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    const band = new THREE.TorusGeometry(ROLL_R + 0.0012, 0.0016, 8, 28);
    band.rotateY(Math.PI / 2);
    const loop = new THREE.TorusGeometry(0.009, 0.0014, 6, 20);
    loop.scale(1, 0.55, 1);
    const tail = new THREE.PlaneGeometry(0.004, 0.028);
    tail.translate(0, -0.014, 0);
    return {
      front,
      back,
      bottom,
      top,
      topQuat,
      scroll,
      ribbonMat,
      band,
      loop,
      tail,
      blankUniforms,
    };
  }, [assets, style, ribbonColor]);

  const tmp = useMemo(
    () => ({
      src: { p: new THREE.Vector3(), q: new THREE.Quaternion() },
      p: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      e: new THREE.Euler(),
      q2: new THREE.Quaternion(),
      p2: new THREE.Vector3(),
      off: new THREE.Vector3(),
    }),
    [],
  );

  useEffect(() => {
    sceneRefs.letterGroup = group.current;
    sceneRefs.makeReplyFace = (lines) => {
      const form = useExperience.getState().form!;
      const t = form.theme;
      const font = (k: string) =>
        FONT_FAMILIES[k]?.css ?? FONT_FAMILIES.elegant.css;
      sceneRefs.replyFace?.dispose();
      return toTexture(
        letterFaceCanvas({
          paper: assets.letterPaper.map.image as HTMLCanvasElement,
          aspect: LW / LH,
          greeting: form.settings.signOff || undefined,
          title: form.title,
          lines,
          ink: t.inkColor,
          accent: t.accentColor,
          titleFont: font(t.titleFont),
          bodyFont: font(t.bodyFont),
          ruling: t.ruling,
        }),
        { anisotropy: 8 },
      );
    };
    return () => {
      sceneRefs.letterGroup = null;
      sceneRefs.makeReplyFace = null;
    };
  }, [assets]);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    // a soft reading light from over our shoulder while the letter is in front of us,
    // so the paper keeps its true colour whatever the world's lighting
    const rl = readLight.current;
    if (rl) {
      const k = anim.rise * anim.rise * (3 - 2 * anim.rise);
      rl.intensity = 1.15 * k;
      rl.position
        .copy(state.camera.position)
        .add(
          tmp.off.set(0.3, 0.45, 0).applyQuaternion(state.camera.quaternion),
        );
      rl.target.position.copy(g.position);
      rl.target.updateMatrixWorld();
    }
    const t = state.clock.elapsedTime;
    const u = anim.unfold;
    const us = u * u * (3 - 2 * u);

    /* pose while in the vessel */
    if (sceneRefs.letterSource) sceneRefs.letterSource(tmp.src, t);
    tmp.p.copy(tmp.src.p);
    tmp.q.copy(tmp.src.q);
    if (res.scroll) {
      // source is the roll's axis — shift so the group origin sits at the sheet centre
      const [cy, cz] = res.scroll.rollCentre(0);
      tmp.off.set(0, -cy, -cz).applyQuaternion(tmp.q);
      tmp.p.add(tmp.off);
    }

    /* flight to the reading pose */
    const r = anim.rise;
    const target = sceneRefs.letterTarget;
    if (r > 0 && target.ready) {
      const k = r * r * (3 - 2 * r);
      const al = anim.align;
      // presentation: the still-closed letter arrives centred, then the full sheet
      const closedOffset = res.scroll
        ? -(LH / 2) * (1 - us)
        : (LH / 4) * (1 - us);
      tmp.p2.copy(target.present).addScaledVector(target.up, closedOffset);
      tmp.p2.lerp(target.pos, al * al * (3 - 2 * al));
      tmp.p.lerp(tmp.p2, k);
      tmp.p.y += Math.sin(r * Math.PI) * 0.07;
      tmp.q.slerp(target.quat, k);
      tmp.e.set(
        Math.sin(r * Math.PI * 2) * 0.08 * (1 - r),
        Math.sin(r * Math.PI) * 0.18 * (1 - r * 0.5),
        Math.sin(r * Math.PI * 3) * 0.05 * (1 - r),
      );
      tmp.q2.setFromEuler(tmp.e);
      tmp.q.multiply(tmp.q2);
    }
    if (r >= 1) {
      tmp.e.set(
        Math.sin(t * 0.8) * 0.004,
        Math.sin(t * 0.6) * 0.005,
        Math.sin(t * 0.5) * 0.002,
      );
      tmp.q2.setFromEuler(tmp.e);
      tmp.q.multiply(tmp.q2);
      // page turn: the sheet swings round its vertical axis (±1 = edge-on) and lifts a little
      const flip = anim.fx.flip ?? 0;
      const shake = anim.fx.shake ?? 0;
      if (flip !== 0 || shake !== 0) {
        tmp.e.set(
          -Math.abs(flip) * 0.12,
          flip * Math.PI * 0.5,
          Math.sin(t * 42) * 0.018 * shake,
        );
        tmp.q2.setFromEuler(tmp.e);
        tmp.q.multiply(tmp.q2);
        tmp.p.addScaledVector(target.up, Math.abs(flip) * 0.012);
      }
    }
    g.position.copy(tmp.p);
    g.quaternion.copy(tmp.q);

    if (res.scroll) {
      res.scroll.apply(u, Math.sin(u * Math.PI) * 1.2);
      // the ribbon slides off the roll before it unrolls
      const rb = anim.fx.ribbon ?? 0;
      const rg = ribbon.current;
      if (rg) {
        const [cy, cz] = res.scroll.rollCentre(0);
        rg.visible = rb < 0.999 && u < 0.05;
        rg.position.set(rb * 0.13, cy - rb * rb * 0.12, cz + rb * 0.02);
        rg.rotation.set(rb * 2.2, 0, rb * 1.4);
        const sc = 1 - Math.max(0, rb - 0.6) / 0.4;
        rg.scale.setScalar(Math.max(0.001, sc));
      }
    } else {
      const a = Math.PI * (1 - u) * 0.995;
      const k = 7 * Math.sin(Math.PI * u);
      res.top.apply(a, k, 0.0007 * (1 - u) + 0.0002);
    }
    // the reply: once sent, the sheet shows what was written on it
    const reply = sceneRefs.replyFace;
    if (reply && anim.fx.reply > 0.5) {
      if (res.front.map !== reply) res.front.map = reply;
    } else if (res.front.map !== assets.letterFace)
      res.front.map = assets.letterFace;
    res.blankUniforms.uBlank.value =
      anim.fx.reply > 0.5 ? 0 : (anim.fx.blank ?? 0);
    g.visible = anim.letterVisible > 0.5;
  });

  return (
    <>
      <directionalLight ref={readLight} color="#fff3e2" intensity={0} />
      <group ref={group}>
        {res.scroll ? (
          <>
            <mesh
              geometry={res.scroll.geometry}
              material={res.front}
              castShadow
              receiveShadow
            />
            <mesh
              geometry={res.scroll.geometry}
              material={res.back}
              castShadow
              receiveShadow
            />
            <group ref={ribbon}>
              <mesh geometry={res.band} material={res.ribbonMat} castShadow />
              <group position={[0, 0, ROLL_R + 0.003]}>
                <mesh
                  geometry={res.loop}
                  material={res.ribbonMat}
                  position={[0.0, 0.007, 0]}
                  rotation={[0, 0, 0.5]}
                />
                <mesh
                  geometry={res.loop}
                  material={res.ribbonMat}
                  position={[0.0, -0.007, 0]}
                  rotation={[0, 0, -0.5]}
                />
                <mesh
                  geometry={res.tail}
                  material={res.ribbonMat}
                  position={[0.003, 0, 0.001]}
                  rotation={[0, 0.3, 2.6]}
                />
                <mesh
                  geometry={res.tail}
                  material={res.ribbonMat}
                  position={[-0.003, 0, 0.001]}
                  rotation={[0, -0.3, 3.6]}
                />
              </group>
            </group>
          </>
        ) : (
          <group>
            <mesh
              geometry={res.bottom}
              material={res.front}
              castShadow
              receiveShadow
            />
            <mesh
              geometry={res.bottom}
              material={res.back}
              castShadow
              receiveShadow
            />
            <group quaternion={res.topQuat}>
              <mesh
                geometry={res.top.geometry}
                material={res.front}
                castShadow
                receiveShadow
              />
              <mesh
                geometry={res.top.geometry}
                material={res.back}
                castShadow
                receiveShadow
              />
            </group>
          </group>
        )}
      </group>
    </>
  );
}

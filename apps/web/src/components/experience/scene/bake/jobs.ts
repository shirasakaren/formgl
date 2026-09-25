/*
 * Bake jobs: the expensive, pixel-by-pixel procedural textures. They run in a Web Worker
 * (OffscreenCanvas) so the page — and the loading screen — never freeze, and their results
 * are cached in IndexedDB so returning visitors skip the work entirely.
 * Everything here must be DOM-free (it also runs on the main thread as a fallback).
 */
import type { PaperKind } from '@formgl/shared';
import { shade } from '../noise';
import {
  barkTextures,
  bokehDisc,
  butterflyWing,
  flowerSprite,
  gravelTextures,
  lawnTexture,
  leafAtlas,
  leafClusterSprite,
  paperCanvases,
  sealMapsFromRelief,
  seedSprite,
  softDot,
  toTexture,
  woodTextures,
} from '../textures';
import {
  bookCovers,
  cloudPuff,
  corkTexture,
  floorTexture,
  sandTextures,
  sheerTexture,
  shellTexture,
  stripeTexture,
  wallpaperTexture,
  washiTexture,
  wickerTexture,
} from '../envTextures';

/** bump when any generator changes, so stale cached bakes are ignored */
export const BAKE_VERSION = 4;

export const JOBS = {
  wood: (a: { seed: number; light?: string; dark?: string }) => woodTextures(a.seed, a.light, a.dark),
  paper: (a: { color: string; kind: PaperKind; seed: number }) => paperCanvases(a.color, a.kind, a.seed),
  seal: (a: { relief: ImageBitmap }) => sealMapsFromRelief(a.relief),
  ground: () => ({ gravel: gravelTextures(5), lawn: lawnTexture(8) }),
  bark: (a: { seed: number }) => barkTextures(a.seed),
  sprites: (a: { wing: string }) => ({
    leaves: toTexture(leafAtlas(512)),
    seed: toTexture(seedSprite(128)),
    dot: toTexture(softDot(64)),
    bokeh: toTexture(bokehDisc(128)),
    wing: toTexture(butterflyWing(a.wing)),
    flower: toTexture(flowerSprite(64)),
    cluster: toTexture(leafClusterSprite(256), { srgb: false }),
  }),
  /* ── seaside ── */
  sand: () => {
    const s = sandTextures(4);
    return { sand: s.map, sandNormal: s.normalMap };
  },
  shore: () => {
    const d = barkTextures(44);
    return { cork: corkTexture(), shell: shellTexture(), drift: d.map, driftNormal: d.normalMap };
  },
  /* ── atelier ── */
  desk: () => {
    const w = woodTextures(17, '#a8744a', '#5e3a22');
    const f = floorTexture();
    return { desk: w.map, deskNormal: w.normalMap, deskRough: w.roughnessMap, floor: f.map, floorNormal: f.normalMap };
  },
  room: (a: { wall: string }) => ({ wallpaper: wallpaperTexture(shade(a.wall, 0.05)), sheer: sheerTexture(), books: bookCovers() }),
  /* ── skies ── */
  wicker: () => {
    const w = wickerTexture();
    return { wicker: w.map, wickerNormal: w.normalMap };
  },
  balloons: () => ({
    stripes: stripeTexture(['#f2c6d4', '#fdf2e6', '#b8d8e4', '#fdf2e6', '#f6d98e', '#fdf2e6']),
    stripes2: stripeTexture(['#c2577a', '#f7e3c8', '#c2577a', '#f7e3c8']),
    cloud: cloudPuff(),
  }),
  /* ── lantern lake ── */
  lanternLake: () => {
    const w = woodTextures(9, '#7d6a56', '#3b2f25');
    return { dock: w.map, dockNormal: w.normalMap, dockRough: w.roughnessMap, washi: washiTexture() };
  },
};

export type JobName = keyof typeof JOBS;
export type JobArgs<K extends JobName> = Parameters<(typeof JOBS)[K]>[0];
export type JobResult<K extends JobName> = ReturnType<(typeof JOBS)[K]>;

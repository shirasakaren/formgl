'use client';
import * as THREE from 'three';
import { FONT_FAMILIES, paginate, isInputField, type PublicForm } from '@formgl/shared';
import {
  envelopePocketCanvas,
  flapCanvas,
  letterFaceCanvas,
  linerCanvas,
  paperCanvases,
  sealMaps,
  sealRelief,
  toTexture,
  type SealMaps,
  type WoodSet,
} from './textures';
import { bake, prewarmBakers } from './bake/client';

export const ENVELOPE = { w: 0.232, h: 0.162, tipY: 0.56, sideY: 0.52 };
export const LETTER = { w: 0.212, h: 0.3 };

export interface SceneAssets {
  wood: WoodSet;
  envPaper: { map: THREE.Texture; normalMap: THREE.Texture };
  letterPaper: { map: THREE.Texture; normalMap: THREE.Texture };
  pocket: THREE.Texture;
  flap: THREE.Texture;
  liner: THREE.Texture;
  letterFace: THREE.Texture;
  seal: SealMaps;
  gravel: { map: THREE.Texture; normalMap: THREE.Texture };
  lawn: THREE.Texture;
  bark: { map: THREE.Texture; normalMap: THREE.Texture };
  leaves: THREE.Texture;
  seed: THREE.Texture;
  dot: THREE.Texture;
  bokeh: THREE.Texture;
  wing: THREE.Texture;
  flower: THREE.Texture;
  cluster: THREE.Texture;
  /** environment specific textures (registered by each environment) */
  env: Record<string, THREE.Texture>;
}

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function fontCss(key: string) {
  return FONT_FAMILIES[key]?.css ?? FONT_FAMILIES.elegant.css;
}

async function loadFonts(keys: string[]) {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  const fams = Array.from(new Set(keys.map((k) => FONT_FAMILIES[k]?.family).filter(Boolean)));
  await Promise.race([
    Promise.all(fams.map((f) => document.fonts.load(`64px "${f}"`).catch(() => null))),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
}

function loadImage(url?: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
    setTimeout(() => resolve(img.complete && img.naturalWidth ? img : null), 6000);
  });
}

let cache: { key: string; promise: Promise<SceneAssets> } | null = null;

/** textures each world needs besides the shared ones: [loader label, job, args] */
const ENV_BAKES = {
  park: (): Array<[string, () => Promise<Record<string, THREE.Texture>>]> => [],
  seaside: () => [
    ['Smoothing the wet sand', () => bake('sand', undefined as never)],
    ['Washing the sea glass', () => bake('shore', undefined as never)],
  ],
  atelier: (form: PublicForm) => [
    ['Dusting the writing desk', () => bake('desk', undefined as never)],
    ['Hanging the curtains', () => bake('room', { wall: form.theme.envelopeColor })],
  ],
  skies: () => [
    ['Weaving the basket', () => bake('wicker', undefined as never)],
    ['Inflating the balloons', () => bake('balloons', undefined as never)],
  ],
} as unknown as Record<string, (form: PublicForm) => Array<[string, () => Promise<Record<string, THREE.Texture>>]>>;

/**
 * Builds every texture the scene needs before it is shown. The heavy procedural ones are
 * baked in parallel in workers (and cached across visits); only the text-bearing ones are
 * drawn here, a frame apart, so the loader never stutters. Progress is reported per task.
 */
export function buildAssets(form: PublicForm, onProgress: (p: number, label: string) => void): Promise<SceneAssets> {
  const envKey = form.theme.environment ?? 'park';
  const t = form.theme;
  const key = JSON.stringify([form.id, form.title, t, form.settings.greeting, form.fields.map((f) => f.label), form.settings.fieldsPerPage, envKey]);
  // React may mount twice (dev) or re-run: share the build in flight
  if (cache?.key === key) return cache.promise;
  const promise = build(form, envKey, onProgress);
  cache = { key, promise };
  promise.catch(() => {
    if (cache?.promise === promise) cache = null;
  });
  return promise;
}

async function build(form: PublicForm, envKey: string, onProgress: (p: number, label: string) => void): Promise<SceneAssets> {
  const isPark = envKey === 'park';
  const t = form.theme;
  const perf = typeof window !== 'undefined' && window.location.search.includes('perf');
  const t0 = performance.now();
  prewarmBakers();
  const out: Partial<SceneAssets> = { env: {} };

  /* progress: every task has a weight; the label follows the latest finished task */
  let total = 0;
  let done = 0;
  let label = 'Gathering sunlight';
  const track = <T,>(name: string, weight: number, p: Promise<T>): Promise<T> => {
    total += weight;
    return p.then((v) => {
      done += weight;
      label = name;
      onProgress(Math.min(0.999, done / total), label);
      if (perf) console.log(`[perf] ${name} done at ${Math.round(performance.now() - t0)}ms`);
      return v;
    });
  };

  /* 1. start every worker bake at once */
  const wood = isPark ? track('Sanding the old bench', 1, bake('wood', { seed: 7 })) : null;
  const envPaperP = track('Choosing the paper', 1, bake('paper', { color: t.envelopeColor, kind: t.envelopePaper, seed: 3 }));
  const letterPaperP = track('Choosing the paper', 1, bake('paper', { color: t.paperColor, kind: t.paper, seed: 5 }));
  const ground = isPark ? track('Raking the gravel path', 2, bake('ground', undefined as never)) : null;
  const bark = isPark ? track('Growing an old tree', 1, bake('bark', { seed: 21 })) : null;
  const sprites = track(isPark ? 'Catching dandelion seeds' : 'Setting the scene', 1, bake('sprites', { wing: t.petals ? '#f4a7b9' : '#f2b84b' }));
  const envJobs = (ENV_BAKES[envKey]?.(form) ?? []).map(([name, run]) => track(name, 1, run()));

  /* 2. meanwhile on this thread: fonts, logo, then the seal's relief (cheap drawing) */
  const fontsP = track('Warming up the ink', 1, loadFonts([t.titleFont, t.bodyFont, t.labelFont, 'script', 'elegant', 'serif']));
  const logo = await loadImage(t.logoUrl);
  await fontsP;
  await frame();
  const sealArgs = { logo, monogram: t.sealMonogram || (form.title.trim()[0] ?? 'F').toUpperCase(), font: fontCss('serif') };
  const sealP = track(
    'Pressing the wax seal',
    2,
    (async (): Promise<SealMaps> => {
      const relief = sealRelief(sealArgs);
      try {
        const bmp = await createImageBitmap(relief);
        return await bake('seal', { relief: bmp }, `${sealArgs.monogram}|${sealArgs.font}|${t.logoUrl ?? ''}`);
      } catch {
        await frame();
        return sealMaps(sealArgs);
      }
    })(),
  );

  /* 3. text textures need the paper; draw them one per frame */
  const [envPaper, letterPaper] = await Promise.all([envPaperP, letterPaperP]);
  out.envPaper = { map: toTexture(envPaper.color, { wrap: true }), normalMap: toTexture(envPaper.normal, { srgb: false, wrap: true }) };
  out.letterPaper = { map: toTexture(letterPaper.color, { wrap: true }), normalMap: toTexture(letterPaper.normal, { srgb: false, wrap: true }) };
  const texts = track(
    'Writing the first lines',
    2,
    (async () => {
      if (isPark) {
        await frame();
        const aspect = ENVELOPE.w / ENVELOPE.h;
        out.pocket = toTexture(
          envelopePocketCanvas({
            paper: envPaper.color,
            title: t.envelopeTitle || form.title,
            subtitle: t.envelopeSubtitle,
            titleFont: fontCss(t.titleFont),
            subtitleFont: fontCss(t.bodyFont),
            ink: t.inkColor,
            accent: t.accentColor,
            aspect,
            tipY: ENVELOPE.tipY,
            sideY: ENVELOPE.sideY,
          }),
          { anisotropy: 16 },
        );
        await frame();
        out.flap = toTexture(flapCanvas(envPaper.color, aspect));
        await frame();
        out.liner = toTexture(linerCanvas(t.envelopeColor, t.linerColor), { wrap: true });
      }
      await frame();
      const pages = paginate(form.fields, form.settings.fieldsPerPage);
      const lines = (pages[0]?.fields ?? []).filter((f) => isInputField(f.type)).map((f) => f.label);
      out.letterFace = toTexture(
        letterFaceCanvas({
          paper: letterPaper.color,
          aspect: LETTER.w / LETTER.h,
          greeting: form.settings.greeting,
          title: form.title,
          lines,
          ink: t.inkColor,
          accent: t.accentColor,
          titleFont: fontCss(t.titleFont),
          bodyFont: fontCss(t.bodyFont),
          ruling: t.ruling,
        }),
        { anisotropy: 16 },
      );
    })(),
  );

  /* 4. collect */
  const [w, g, b, sp, seal, envs] = await Promise.all([wood, ground, bark, sprites, sealP, Promise.all(envJobs), texts]);
  if (w) out.wood = w;
  if (g) {
    out.gravel = g.gravel;
    out.lawn = g.lawn;
  }
  if (b) out.bark = b;
  Object.assign(out, sp);
  out.seal = seal;
  for (const e of envs) Object.assign(out.env!, e);
  onProgress(1, 'Listening to the leaves');
  if (perf) console.log(`[perf] assets ready in ${Math.round(performance.now() - t0)}ms`);
  return out as SceneAssets;
}

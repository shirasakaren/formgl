'use client';
import * as THREE from 'three';
import { FONT_FAMILIES, paginate, isInputField, type PublicForm } from '@formgl/shared';
import {
  barkTextures,
  bokehDisc,
  butterflyWing,
  flowerSprite,
  leafClusterSprite,
  envelopePocketCanvas,
  flapCanvas,
  gravelTextures,
  lawnTexture,
  leafAtlas,
  letterFaceCanvas,
  linerCanvas,
  paperCanvases,
  sealMaps,
  seedSprite,
  softDot,
  toTexture,
  woodTextures,
  type SealMaps,
  type WoodSet,
} from './textures';

export const ENVELOPE = { w: 0.232, h: 0.162, tipY: 0.56, sideY: 0.52 };
export const LETTER = { w: 0.212, h: 0.3 };

export interface SceneAssets {
  wood: WoodSet;
  envPaper: { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture };
  letterPaper: { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture };
  pocket: THREE.CanvasTexture;
  flap: THREE.CanvasTexture;
  liner: THREE.CanvasTexture;
  letterFace: THREE.CanvasTexture;
  seal: SealMaps;
  gravel: { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture };
  lawn: THREE.CanvasTexture;
  bark: { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture };
  leaves: THREE.CanvasTexture;
  seed: THREE.CanvasTexture;
  dot: THREE.CanvasTexture;
  bokeh: THREE.CanvasTexture;
  wing: THREE.CanvasTexture;
  flower: THREE.CanvasTexture;
  cluster: THREE.CanvasTexture;
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

let cache: { key: string; assets: SceneAssets } | null = null;

export async function buildAssets(form: PublicForm, onProgress: (p: number, label: string) => void): Promise<SceneAssets> {
  const t = form.theme;
  const key = JSON.stringify([form.id, form.title, t, form.settings.greeting, form.fields.length]);
  if (cache?.key === key) return cache.assets;

  const steps: Array<[string, () => void | Promise<void>]> = [];
  const out: Partial<SceneAssets> = {};
  let logo: HTMLImageElement | null = null;

  steps.push(['Warming up the ink', async () => {
    await loadFonts([t.titleFont, t.bodyFont, t.labelFont, 'script', 'elegant', 'serif']);
    logo = await loadImage(t.logoUrl);
  }]);
  steps.push(['Sanding the old bench', () => {
    out.wood = woodTextures(7);
  }]);
  let envPaper: ReturnType<typeof paperCanvases>;
  let letterPaper: ReturnType<typeof paperCanvases>;
  steps.push(['Choosing the paper', () => {
    envPaper = paperCanvases(t.envelopeColor, t.envelopePaper, 3);
    letterPaper = paperCanvases(t.paperColor, t.paper, 5);
    out.envPaper = {
      map: toTexture(envPaper.color, { wrap: true }),
      normalMap: toTexture(envPaper.normal, { srgb: false, wrap: true }),
    };
    out.letterPaper = {
      map: toTexture(letterPaper.color, { wrap: true }),
      normalMap: toTexture(letterPaper.normal, { srgb: false, wrap: true }),
    };
  }]);
  steps.push(['Addressing the envelope', () => {
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
    out.flap = toTexture(flapCanvas(envPaper.color, aspect));
    out.liner = toTexture(linerCanvas(t.envelopeColor, t.linerColor), { wrap: true });
  }]);
  steps.push(['Pressing the wax seal', () => {
    out.seal = sealMaps({
      logo,
      monogram: t.sealMonogram || (form.title.trim()[0] ?? 'F').toUpperCase(),
      font: fontCss('serif'),
    });
  }]);
  steps.push(['Writing the first lines', () => {
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
  }]);
  steps.push(['Raking the gravel path', () => {
    out.gravel = gravelTextures(5);
    out.lawn = lawnTexture(8);
  }]);
  steps.push(['Growing an old tree', () => {
    out.bark = barkTextures(21);
    const leaves = toTexture(leafAtlas(512));
    leaves.premultiplyAlpha = false;
    out.leaves = leaves;
  }]);
  steps.push(['Catching dandelion seeds', () => {
    out.seed = toTexture(seedSprite(128));
    out.dot = toTexture(softDot(64));
    out.bokeh = toTexture(bokehDisc(128));
    out.wing = toTexture(butterflyWing(t.petals ? '#f4a7b9' : '#f2b84b'));
    out.flower = toTexture(flowerSprite(64));
    out.cluster = toTexture(leafClusterSprite(256), { srgb: false });
  }]);

  for (let i = 0; i < steps.length; i++) {
    const [label, fn] = steps[i];
    onProgress(i / steps.length, label);
    await frame();
    await fn();
  }
  onProgress(1, 'Listening to the leaves');
  const assets = out as SceneAssets;
  cache = { key, assets };
  return assets;
}

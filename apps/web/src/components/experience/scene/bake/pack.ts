/* (De)serialising bake results: textures and canvases travel as ImageBitmaps. */
import * as THREE from 'three';

export interface TexProps {
  cs: string;
  ws: number;
  wt: number;
  rx: number;
  ry: number;
  an: number;
}
export type Packed = null | boolean | number | string | Packed[] | { [k: string]: Packed } | { __t: number; p: TexProps } | { __c: number };

export interface Source {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  /** textures are flipped (WebGL ignores UNPACK_FLIP_Y for bitmaps); plain canvases are not */
  flip: boolean;
}

const isCanvas = (v: unknown): v is HTMLCanvasElement | OffscreenCanvas =>
  (typeof OffscreenCanvas !== 'undefined' && v instanceof OffscreenCanvas) || (typeof HTMLCanvasElement !== 'undefined' && v instanceof HTMLCanvasElement);

export function pack(v: unknown, out: Source[]): Packed {
  if (v instanceof THREE.Texture) {
    out.push({ canvas: v.image as OffscreenCanvas, flip: true });
    return { __t: out.length - 1, p: { cs: v.colorSpace, ws: v.wrapS, wt: v.wrapT, rx: v.repeat.x, ry: v.repeat.y, an: v.anisotropy } };
  }
  if (isCanvas(v)) {
    out.push({ canvas: v, flip: false });
    return { __c: out.length - 1 };
  }
  if (Array.isArray(v)) return v.map((x) => pack(x, out));
  if (v && typeof v === 'object') {
    const o: { [k: string]: Packed } = {};
    for (const [k, x] of Object.entries(v)) o[k] = pack(x, out);
    return o;
  }
  return (v ?? null) as Packed;
}

export function unpack(v: Packed, bitmaps: ImageBitmap[]): unknown {
  if (Array.isArray(v)) return v.map((x) => unpack(x, bitmaps));
  if (v && typeof v === 'object') {
    if ('__t' in v && typeof v.__t === 'number') {
      const p = (v as { p: TexProps }).p;
      const t = new THREE.Texture(bitmaps[v.__t]);
      t.colorSpace = p.cs as THREE.ColorSpace;
      t.wrapS = p.ws as THREE.Wrapping;
      t.wrapT = p.wt as THREE.Wrapping;
      t.repeat.set(p.rx, p.ry);
      t.anisotropy = p.an;
      t.flipY = false;
      t.needsUpdate = true;
      return t;
    }
    if ('__c' in v && typeof v.__c === 'number') return bitmaps[v.__c];
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) o[k] = unpack(x as Packed, bitmaps);
    return o;
  }
  return v;
}

/** bitmap options that keep pixels exactly as painted (normal maps must not be colour-managed) */
export const bitmapOpts = (flip: boolean): ImageBitmapOptions => ({
  premultiplyAlpha: 'none',
  colorSpaceConversion: 'none',
  ...(flip ? { imageOrientation: 'flipY' as const } : {}),
});

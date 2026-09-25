'use client';
import * as THREE from 'three';
import type { PaperKind } from '@formgl/shared';
import { clamp01, hexToRgb, mulberry32, shade, smoothstep, ValueNoise } from './noise';

/* ─────────────────────────── canvas helpers ─────────────────────────── */

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function ctx2d(c: HTMLCanvasElement) {
  return c.getContext('2d', { willReadFrequently: false }) as CanvasRenderingContext2D;
}

export function toTexture(
  c: HTMLCanvasElement,
  opts: { srgb?: boolean; repeat?: [number, number]; wrap?: boolean; anisotropy?: number; flipY?: boolean } = {},
): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  if (opts.wrap || opts.repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  }
  if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
  t.anisotropy = opts.anisotropy ?? 8;
  if (opts.flipY === false) t.flipY = false;
  t.needsUpdate = true;
  return t;
}

/** Sobel normal map from a height field (values ~0..1) */
export function normalFromHeight(height: Float32Array, w: number, h: number, strength = 2, wrap = true): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  const g = ctx2d(c);
  const img = g.createImageData(w, h);
  const d = img.data;
  const at = (x: number, y: number) => {
    if (wrap) {
      x = (x + w) % w;
      y = (y + h) % h;
    } else {
      x = x < 0 ? 0 : x >= w ? w - 1 : x;
      y = y < 0 ? 0 : y >= h ? h - 1 : y;
    }
    return height[y * w + x];
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx =
        at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const dy =
        at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      let nx = -dx * strength;
      let ny = dy * strength;
      let nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l;
      ny /= l;
      nz /= l;
      const i = (y * w + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255;
      d[i + 1] = (ny * 0.5 + 0.5) * 255;
      d[i + 2] = (nz * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** read a canvas' luminance into a height array */
export function heightFromCanvas(c: HTMLCanvasElement): Float32Array {
  const g = ctx2d(c);
  const { data } = g.getImageData(0, 0, c.width, c.height);
  const out = new Float32Array(c.width * c.height);
  for (let i = 0; i < out.length; i++) out[i] = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 765;
  return out;
}

/* ─────────────────────────── wood ─────────────────────────── */

export interface WoodSet {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

export function woodTextures(seed = 7, light = '#c49d72', dark = '#8a6443'): WoodSet {
  const W = 1024;
  const H = 128;
  const n = new ValueNoise(seed);
  const n2 = new ValueNoise(seed + 11);
  const color = makeCanvas(W, H);
  const rough = makeCanvas(W, H);
  const g = ctx2d(color);
  const gr = ctx2d(rough);
  const img = g.createImageData(W, H);
  const rimg = gr.createImageData(W, H);
  const height = new Float32Array(W * H);
  const L = hexToRgb(light);
  const D = hexToRgb(dark);
  const weather = [138, 128, 116];
  const rk = mulberry32(seed * 3 + 1);
  const knots = Array.from({ length: 4 }, () => [rk(), 0.2 + rk() * 0.6, 0.012 + rk() * 0.02]);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const v = y / H;
      let knot = 0;
      let kd = 1;
      for (const [kx, ky, kr] of knots) {
        const dx = (u - kx) * 8;
        const dy = v - ky;
        const d2 = (dx * dx + dy * dy) / (kr * kr * 60);
        knot += Math.exp(-d2) * 2.2;
        kd = Math.min(kd, d2);
      }
      const warp = n.fbm(u * 9, v * 1.7, 4) * 3.4 + Math.sin(u * 9 + v * 2) * 0.35 + knot;
      const rings = v * 9 + warp;
      const ring = rings - Math.floor(rings);
      const line = smoothstep(0.78, 0.98, ring) * (1 - smoothstep(0.98, 1, ring));
      const streak = n2.n2(u * 380, v * 22);
      const pores = streak > 0.82 ? (streak - 0.82) * 4 : 0;
      const mott = n.fbm(u * 18, v * 5, 3);
      let t = 0.22 + line * 0.3 + (mott - 0.5) * 0.35 + pores * 0.22 + Math.exp(-kd * 6) * 0.5;
      t = clamp01(t);
      let r = L[0] + (D[0] - L[0]) * t;
      let gg = L[1] + (D[1] - L[1]) * t;
      let b = L[2] + (D[2] - L[2]) * t;
      // weathering: silver-grey patina + a few darker water stains
      const w = smoothstep(0.35, 0.8, n2.fbm(u * 4, v * 3, 3)) * 0.45;
      r += (weather[0] - r) * w;
      gg += (weather[1] - gg) * w;
      b += (weather[2] - b) * w;
      const stain = smoothstep(0.7, 0.9, n.fbm(u * 3 + 10, v * 2, 4)) * 0.25;
      r *= 1 - stain;
      gg *= 1 - stain;
      b *= 1 - stain * 0.9;
      const i = (y * W + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = gg;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
      height[y * W + x] = 1 - line * 0.6 - pores * 0.5 + mott * 0.15;
      const ro = 0.62 + line * 0.18 + pores * 0.2 - w * 0.1;
      rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = clamp01(ro) * 255;
      rimg.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  gr.putImageData(rimg, 0, 0);
  const nm = normalFromHeight(height, W, H, 1.6);
  return {
    map: toTexture(color, { wrap: true }),
    normalMap: toTexture(nm, { srgb: false, wrap: true }),
    roughnessMap: toTexture(rough, { srgb: false, wrap: true }),
  };
}

/* ─────────────────────────── paper ─────────────────────────── */

export interface PaperCanvases {
  color: HTMLCanvasElement;
  normal: HTMLCanvasElement;
}

/** A tileable paper surface: fibres, mottling and kind-specific structure. */
export function paperCanvases(base: string, kind: PaperKind = 'cotton', seed = 3, size = 512): PaperCanvases {
  const n = new ValueNoise(seed);
  const rnd = mulberry32(seed * 13 + 1);
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  const img = g.createImageData(size, size);
  const height = new Float32Array(size * size);
  const B = hexToRgb(kind === 'kraft' ? shade(base, -0.05) : base);
  const period = 8;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * period;
      const v = (y / size) * period;
      const mott = n.fbm(u, v, 4, period);
      const fine = n.n2(x * 0.5, y * 0.5, size * 0.5);
      let h = mott * 0.5 + fine * 0.18;
      let tone = (mott - 0.5) * (kind === 'parchment' ? 0.16 : kind === 'kraft' ? 0.1 : 0.05) + (fine - 0.5) * 0.035;
      if (kind === 'laid') {
        const laid = Math.sin((y / size) * Math.PI * 2 * 96) * 0.5 + 0.5;
        const chain = Math.exp(-Math.pow(((x / size) * 12) % 1 - 0.5, 2) * 900);
        h += laid * 0.25 + chain * 0.2;
        tone += laid * 0.012 - chain * 0.015;
      } else if (kind === 'linen') {
        const a = Math.sin((x / size) * Math.PI * 2 * 110) * 0.5 + 0.5;
        const b = Math.sin((y / size) * Math.PI * 2 * 110) * 0.5 + 0.5;
        const wv = a * 0.5 + b * 0.5 + (n.n2(x * 0.3, y * 0.05, size * 0.3) - 0.5) * 0.4;
        h += wv * 0.35;
        tone += (wv - 0.5) * 0.03;
      } else if (kind === 'watercolor') {
        const bump = n.fbm(u * 6, v * 6, 3, period * 6);
        h += bump * 0.9;
        tone += (bump - 0.5) * 0.04;
      } else if (kind === 'parchment') {
        const blot = smoothstep(0.55, 0.8, n.fbm(u * 0.5 + 3, v * 0.5, 4, period / 2));
        tone -= blot * 0.08;
      }
      const i = (y * size + x) * 4;
      img.data[i] = B[0] * (1 + tone);
      img.data[i + 1] = B[1] * (1 + tone);
      img.data[i + 2] = B[2] * (1 + tone * 1.1);
      img.data[i + 3] = 255;
      height[y * size + x] = h;
    }
  }
  g.putImageData(img, 0, 0);
  // fibres
  const fibres = kind === 'kraft' ? 900 : kind === 'cotton' || kind === 'watercolor' ? 520 : 320;
  g.lineCap = 'round';
  for (let i = 0; i < fibres; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const len = 4 + rnd() * (kind === 'kraft' ? 22 : 14);
    const a = rnd() * Math.PI * 2;
    const dark = rnd() < (kind === 'kraft' ? 0.6 : 0.35);
    g.strokeStyle = dark ? `rgba(60,40,20,${0.04 + rnd() * 0.07})` : `rgba(255,255,255,${0.12 + rnd() * 0.18})`;
    g.lineWidth = 0.5 + rnd() * 0.8;
    // draw wrapped copies so the tile stays seamless
    for (const ox of [-size, 0, size])
      for (const oy of [-size, 0, size]) {
        const X = x + ox;
        const Y = y + oy;
        if (X < -30 || X > size + 30 || Y < -30 || Y > size + 30) continue;
        g.beginPath();
        g.moveTo(X, Y);
        g.quadraticCurveTo(X + Math.cos(a + 0.6) * len * 0.5, Y + Math.sin(a + 0.6) * len * 0.5, X + Math.cos(a) * len, Y + Math.sin(a) * len);
        g.stroke();
      }
  }
  const normal = normalFromHeight(height, size, size, kind === 'watercolor' ? 3.2 : kind === 'linen' || kind === 'laid' ? 2.2 : 1.4);
  return { color: c, normal };
}

/* ─────────────────────────── liner pattern ─────────────────────────── */

export function linerCanvas(base: string, liner: string, size = 512): HTMLCanvasElement {
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  g.fillStyle = liner;
  g.fillRect(0, 0, size, size);
  const rnd = mulberry32(42);
  // soft vignette tone
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.8);
  grad.addColorStop(0, 'rgba(255,255,255,0.06)');
  grad.addColorStop(1, 'rgba(0,0,0,0.08)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  // botanical sprigs pattern (tileable grid with offset rows)
  const ink = shade(base, 0.2);
  const step = size / 4;
  for (let row = -1; row <= 4; row++) {
    for (let col = -1; col <= 4; col++) {
      const x = col * step + (row % 2 ? step / 2 : 0);
      const y = row * step;
      const rot = (rnd() - 0.5) * 0.8 + (row % 2 ? 0.6 : -0.6);
      g.save();
      g.translate(x, y);
      g.rotate(rot);
      g.strokeStyle = ink;
      g.fillStyle = ink;
      g.globalAlpha = 0.55;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, -step * 0.32);
      g.quadraticCurveTo(step * 0.06, 0, 0, step * 0.32);
      g.stroke();
      for (let k = -2; k <= 2; k++) {
        const ly = k * step * 0.12;
        for (const s of [-1, 1]) {
          g.save();
          g.translate(0, ly);
          g.rotate(s * 0.9);
          g.beginPath();
          g.ellipse(s * step * 0.07, 0, step * 0.075, step * 0.028, 0, 0, Math.PI * 2);
          g.fill();
          g.restore();
        }
      }
      g.globalAlpha = 0.35;
      g.beginPath();
      g.arc(step * 0.28, step * 0.2, step * 0.03, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }
  return c;
}

/* ─────────────────────────── envelope faces ─────────────────────────── */

export interface EnvelopeTextOpts {
  paper: HTMLCanvasElement;
  title: string;
  subtitle?: string;
  titleFont: string;
  subtitleFont: string;
  ink: string;
  accent: string;
  /** envelope proportions */
  aspect: number;
  /** relative y (0 top → 1 bottom) of the flap tip */
  tipY: number;
  /** relative y of side-flap meeting point */
  sideY: number;
}

function fitFont(g: CanvasRenderingContext2D, text: string, family: string, maxW: number, start: number, min = 18) {
  let size = start;
  do {
    g.font = `${size}px ${family}`;
    if (g.measureText(text).width <= maxW) break;
    size -= 4;
  } while (size > min);
  return size;
}

/**
 * The front "pocket" of the envelope as seen from the flap side: bottom flap and
 * two side flaps, crease shading, and the handwritten title.
 */
export function envelopePocketCanvas(o: EnvelopeTextOpts): HTMLCanvasElement {
  const W = 1536;
  const H = Math.round(W / o.aspect);
  const c = makeCanvas(W, H);
  const g = ctx2d(c);
  const pat = g.createPattern(o.paper, 'repeat')!;
  g.fillStyle = pat;
  g.fillRect(0, 0, W, H);

  const sideY = o.sideY * H;
  // side flap edges: from top corners down to the middle meeting point, then to bottom corners
  const drawEdge = (pts: Array<[number, number]>, shadow: number) => {
    g.save();
    g.lineJoin = 'round';
    g.strokeStyle = `rgba(80,55,35,${shadow})`;
    g.lineWidth = 10;
    g.filter = 'blur(6px)';
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y + 5) : g.moveTo(x, y + 5)));
    g.stroke();
    g.filter = 'none';
    g.strokeStyle = 'rgba(70,50,30,0.35)';
    g.lineWidth = 1.6;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 1.2;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y - 1.5) : g.moveTo(x, y - 1.5)));
    g.stroke();
    g.restore();
  };
  // Bottom flap: a wide soft "V" rising from bottom corners to a rounded peak
  const peakY = H * 0.42;
  const bottomFlap: Array<[number, number]> = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const x = t * W;
    const k = Math.abs(t - 0.5) * 2; // 1 at edges, 0 at middle
    const y = peakY + (H - peakY) * Math.pow(k, 1.25) * 0.98 + (1 - Math.pow(k, 0.4)) * H * 0.0;
    bottomFlap.push([x, Math.min(H, y + H * 0.02 * (1 - k))]);
  }
  // side flaps (under the bottom flap): left & right triangles meeting near sideY
  drawEdge(
    [
      [0, 0],
      [W * 0.47, sideY],
      [W * 0.05, H],
    ],
    0.1,
  );
  drawEdge(
    [
      [W, 0],
      [W * 0.53, sideY],
      [W * 0.95, H],
    ],
    0.1,
  );
  // bottom flap fill (slightly lighter) + edge
  g.save();
  g.beginPath();
  g.moveTo(0, H);
  bottomFlap.forEach(([x, y]) => g.lineTo(x, y));
  g.lineTo(W, H);
  g.closePath();
  g.clip();
  g.fillStyle = pat;
  g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,0.06)';
  g.fillRect(0, 0, W, H);
  g.restore();
  drawEdge(bottomFlap, 0.16);

  // border crease: folded edges catch light / shadow
  const border = g.createLinearGradient(0, 0, 0, H);
  border.addColorStop(0, 'rgba(0,0,0,0.0)');
  border.addColorStop(1, 'rgba(0,0,0,0.05)');
  g.fillStyle = border;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.lineWidth = 4;
  g.strokeRect(2, 2, W - 4, H - 4);
  g.strokeStyle = 'rgba(90,65,40,0.18)';
  g.lineWidth = 2;
  g.strokeRect(7, 7, W - 14, H - 14);

  // handwritten title on the bottom flap
  const cx = W / 2;
  const titleY = H * 0.745;
  g.fillStyle = o.ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const size = fitFont(g, o.title, o.titleFont, W * 0.78, Math.round(H * 0.2));
  g.save();
  g.globalAlpha = 1;
  g.shadowColor = 'rgba(40,20,10,0.25)';
  g.shadowBlur = 1.5;
  g.fillText(o.title, cx, titleY);
  g.restore();
  if (o.subtitle) {
    fitFont(g, o.subtitle, o.subtitleFont, W * 0.6, Math.round(H * 0.058), 14);
    g.globalAlpha = 0.75;
    g.fillText(o.subtitle, cx, titleY + size * 0.62);
    g.globalAlpha = 1;
  }
  // a tiny flourish under the title
  g.strokeStyle = o.accent;
  g.globalAlpha = 0.5;
  g.lineWidth = 2.2;
  g.beginPath();
  const fy = titleY + size * (o.subtitle ? 0.98 : 0.6);
  g.moveTo(cx - W * 0.09, fy);
  g.bezierCurveTo(cx - W * 0.03, fy - 12, cx + W * 0.03, fy + 12, cx + W * 0.09, fy);
  g.stroke();
  g.globalAlpha = 1;
  return c;
}

/** Outer face of the top flap */
export function flapCanvas(paper: HTMLCanvasElement, aspect: number): HTMLCanvasElement {
  const W = 1024;
  const H = Math.round(W / aspect);
  const c = makeCanvas(W, H);
  const g = ctx2d(c);
  g.fillStyle = g.createPattern(paper, 'repeat')!;
  g.fillRect(0, 0, W, H);
  // gentle light gradient, hinge crease at the top
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(90,60,35,0.10)');
  grad.addColorStop(0.04, 'rgba(255,255,255,0.10)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.03)');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  return c;
}

/* ─────────────────────────── wax seal emboss ─────────────────────────── */

export interface SealMaps {
  normal: THREE.CanvasTexture;
  cavity: THREE.CanvasTexture;
  rough: THREE.CanvasTexture;
}

/**
 * Builds normal / cavity / roughness maps for the wax seal from the admin's logo
 * (or a monogram). The stamp impression covers the inner 70% of the seal.
 */
export function sealMaps(opts: { logo?: HTMLImageElement | null; monogram: string; font: string }): SealMaps {
  const S = 512;
  const h = makeCanvas(S, S);
  const g = ctx2d(h);
  const n = new ValueNoise(99);
  const cx = S / 2;
  const R = S * 0.36; // impression radius
  // base: mid-grey wax body with lumpy noise
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x - cx, y - cx) / R;
      let v = 0.5 + (n.fbm(x / 60, y / 60, 4) - 0.5) * 0.35;
      // rim of pushed wax just outside the stamp
      v += Math.exp(-Math.pow((d - 1.07) * 7, 2)) * 0.35;
      // stamp floor
      if (d < 1) v = 0.28 + (n.fbm(x / 90, y / 90, 2) - 0.5) * 0.03;
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);

  // relief drawn in lighter grey (raised) inside the impression
  const relief = makeCanvas(S, S);
  const rg = ctx2d(relief);
  rg.fillStyle = '#000';
  rg.fillRect(0, 0, S, S);
  rg.fillStyle = '#fff';
  rg.strokeStyle = '#fff';
  // beaded border
  rg.lineWidth = 6;
  rg.beginPath();
  rg.arc(cx, cx, R * 0.9, 0, Math.PI * 2);
  rg.stroke();
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    rg.beginPath();
    rg.arc(cx + Math.cos(a) * R * 0.8, cx + Math.sin(a) * R * 0.8, 3.2, 0, Math.PI * 2);
    rg.fill();
  }
  const inner = R * 0.68;
  let drewLogo = false;
  if (opts.logo && opts.logo.naturalWidth > 0) {
    try {
      const lw = opts.logo.naturalWidth;
      const lh = opts.logo.naturalHeight;
      const scale = (inner * 1.75) / Math.max(lw, lh);
      const w = lw * scale;
      const hh = lh * scale;
      const tmp = makeCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(hh)));
      const tg = ctx2d(tmp);
      tg.drawImage(opts.logo, 0, 0, tmp.width, tmp.height);
      const td = tg.getImageData(0, 0, tmp.width, tmp.height);
      let hasAlpha = false;
      for (let i = 3; i < td.data.length; i += 16) if (td.data[i] < 240) { hasAlpha = true; break; }
      for (let i = 0; i < td.data.length; i += 4) {
        const lum = (td.data[i] + td.data[i + 1] + td.data[i + 2]) / 765;
        const a = td.data[i + 3] / 255;
        const v = hasAlpha ? a * (lum < 0.92 ? 1 : 0.6) : clamp01((0.85 - lum) * 2.2);
        td.data[i] = td.data[i + 1] = td.data[i + 2] = v * 255;
        td.data[i + 3] = 255;
      }
      tg.putImageData(td, 0, 0);
      rg.globalCompositeOperation = 'lighter';
      rg.drawImage(tmp, cx - w / 2, cx - hh / 2);
      rg.globalCompositeOperation = 'source-over';
      drewLogo = true;
    } catch {
      drewLogo = false; // tainted canvas (CORS) → fall back to monogram
    }
  }
  if (!drewLogo) {
    const letter = (opts.monogram || 'F').slice(0, 2);
    rg.textAlign = 'center';
    rg.textBaseline = 'middle';
    rg.font = `${Math.round(inner * (letter.length > 1 ? 1.05 : 1.55))}px ${opts.font}`;
    rg.fillText(letter, cx, cx + inner * 0.06);
    // little laurel sprigs
    rg.lineWidth = 3;
    for (const s of [-1, 1]) {
      for (let k = 0; k < 5; k++) {
        const a = Math.PI / 2 + s * (0.55 + k * 0.23);
        const px = cx + Math.cos(a) * inner * 0.92;
        const py = cx + Math.sin(a) * inner * 0.92;
        rg.save();
        rg.translate(px, py);
        rg.rotate(a + (s > 0 ? -0.6 : 0.6));
        rg.beginPath();
        rg.ellipse(0, 0, 9, 4, 0, 0, Math.PI * 2);
        rg.fill();
        rg.restore();
      }
    }
  }
  // soften relief then composite as raised areas
  g.save();
  g.filter = 'blur(2.5px)';
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.62;
  g.drawImage(relief, 0, 0);
  g.restore();

  const height = heightFromCanvas(h);
  const normal = normalFromHeight(height, S, S, 9, false);

  // cavity: darken recessed floor edges + outside wax slightly lighter
  const cav = makeCanvas(S, S);
  const cg = ctx2d(cav);
  const cimg = cg.createImageData(S, S);
  const rough = makeCanvas(S, S);
  const rgh = ctx2d(rough);
  const rimg = rgh.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const d = Math.hypot(x - cx, y - cx) / R;
      const hv = height[i];
      let c = 0.78 + hv * 0.35;
      if (d < 1) c -= 0.08 * (1 - hv * 1.5);
      c = clamp01(c);
      cimg.data[i * 4] = cimg.data[i * 4 + 1] = cimg.data[i * 4 + 2] = c * 255;
      cimg.data[i * 4 + 3] = 255;
      const r = d < 1 ? 0.32 - hv * 0.12 : 0.5 + (n.n2(x / 6, y / 6) - 0.5) * 0.2;
      rimg.data[i * 4] = rimg.data[i * 4 + 1] = rimg.data[i * 4 + 2] = clamp01(r) * 255;
      rimg.data[i * 4 + 3] = 255;
    }
  }
  cg.putImageData(cimg, 0, 0);
  rgh.putImageData(rimg, 0, 0);
  return {
    normal: toTexture(normal, { srgb: false }),
    cavity: toTexture(cav),
    rough: toTexture(rough, { srgb: false }),
  };
}

/* ─────────────────────────── ground ─────────────────────────── */

export function gravelTextures(seed = 5, size = 512) {
  const rnd = mulberry32(seed);
  const n = new ValueNoise(seed);
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  const hc = makeCanvas(size, size);
  const hg = ctx2d(hc);
  // base compacted soil
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const v = n.fbm((x / size) * 8, (y / size) * 8, 4, 8);
      const i = (y * size + x) * 4;
      img.data[i] = 150 + v * 40;
      img.data[i + 1] = 132 + v * 36;
      img.data[i + 2] = 108 + v * 30;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  hg.fillStyle = '#404040';
  hg.fillRect(0, 0, size, size);
  const palette = ['#b9aa92', '#a39479', '#cfc3ad', '#8d7f69', '#d8cfbf', '#9a8c7a', '#7c7063'];
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 1.5 + Math.pow(rnd(), 2.2) * 7;
    const a = rnd() * Math.PI;
    for (const [ox, oy] of [
      [0, 0],
      [size, 0],
      [-size, 0],
      [0, size],
      [0, -size],
    ]) {
      if (x + ox < -10 || x + ox > size + 10 || y + oy < -10 || y + oy > size + 10) continue;
      const col = palette[Math.floor(rnd() * palette.length)];
      const gr = g.createRadialGradient(x + ox - r * 0.3, y + oy - r * 0.3, r * 0.1, x + ox, y + oy, r * 1.1);
      gr.addColorStop(0, shade(col, 0.25));
      gr.addColorStop(0.7, col);
      gr.addColorStop(1, shade(col, -0.35));
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(x + ox, y + oy, r, r * (0.6 + rnd() * 0.4), a, 0, Math.PI * 2);
      g.fill();
      const hgr = hg.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      hgr.addColorStop(0, '#ffffff');
      hgr.addColorStop(1, '#404040');
      hg.fillStyle = hgr;
      hg.beginPath();
      hg.ellipse(x + ox, y + oy, r, r * 0.8, a, 0, Math.PI * 2);
      hg.fill();
    }
  }
  const normal = normalFromHeight(heightFromCanvas(hc), size, size, 3);
  return { map: toTexture(c, { wrap: true }), normalMap: toTexture(normal, { srgb: false, wrap: true }) };
}

export function lawnTexture(seed = 8, size = 512) {
  const n = new ValueNoise(seed);
  const rnd = mulberry32(seed);
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const v = n.fbm((x / size) * 6, (y / size) * 6, 5, 6);
      const d = n.n2(x * 0.2, y * 0.2, size * 0.2);
      const i = (y * size + x) * 4;
      const dry = smoothstep(0.55, 0.75, v);
      img.data[i] = 62 + v * 40 + dry * 50 + d * 10;
      img.data[i + 1] = 88 + v * 50 + dry * 30 + d * 12;
      img.data[i + 2] = 38 + v * 20 + d * 6;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 5000; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    g.strokeStyle = `rgba(${120 + rnd() * 60},${150 + rnd() * 50},${60 + rnd() * 30},${0.25 + rnd() * 0.3})`;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rnd() - 0.5) * 3, y - 3 - rnd() * 6);
    g.stroke();
  }
  return toTexture(c, { wrap: true });
}

export function barkTextures(seed = 21) {
  const W = 256;
  const H = 1024;
  const n = new ValueNoise(seed);
  const c = makeCanvas(W, H);
  const g = ctx2d(c);
  const img = g.createImageData(W, H);
  const height = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const v = y / H;
      const furrow = n.fbm(u * 10 + n.fbm(u * 3, v * 2, 2, 3) * 1.5, v * 3, 4, 10);
      const ridge = 1 - Math.abs(furrow - 0.5) * 2;
      const h = Math.pow(ridge, 1.5);
      const moss = smoothstep(0.62, 0.8, n.fbm(u * 4 + 5, v * 6, 3, 4)) * 0.6;
      const i = (y * W + x) * 4;
      const base = 60 + h * 55;
      img.data[i] = base * 0.95 * (1 - moss) + moss * 90;
      img.data[i + 1] = base * 0.82 * (1 - moss) + moss * 105;
      img.data[i + 2] = base * 0.7 * (1 - moss) + moss * 50;
      img.data[i + 3] = 255;
      height[y * W + x] = h;
    }
  g.putImageData(img, 0, 0);
  const normal = normalFromHeight(height, W, H, 4);
  return { map: toTexture(c, { wrap: true }), normalMap: toTexture(normal, { srgb: false, wrap: true }) };
}

/* ─────────────────────────── leaves & sprites ─────────────────────────── */

/** 2×2 atlas of leaves: [green, light green, yellow, autumn orange] */
export function leafAtlas(size = 512): HTMLCanvasElement {
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  const cell = size / 2;
  const palettes = [
    ['#4f7a35', '#6d9a45', '#35551f'],
    ['#7aa84a', '#9cc466', '#57803a'],
    ['#c6a53d', '#e1c25a', '#9b7f22'],
    ['#c46a2b', '#df8b3e', '#8f4417'],
  ];
  palettes.forEach((p, idx) => {
    const ox = (idx % 2) * cell;
    const oy = Math.floor(idx / 2) * cell;
    g.save();
    g.translate(ox + cell / 2, oy + cell / 2);
    const L = cell * 0.42;
    const Wd = cell * 0.2;
    const path = new Path2D();
    path.moveTo(0, L);
    path.bezierCurveTo(Wd * 1.35, L * 0.45, Wd * 1.1, -L * 0.55, 0, -L);
    path.bezierCurveTo(-Wd * 1.1, -L * 0.55, -Wd * 1.35, L * 0.45, 0, L);
    const grad = g.createLinearGradient(-Wd, -L, Wd, L);
    grad.addColorStop(0, p[1]);
    grad.addColorStop(0.6, p[0]);
    grad.addColorStop(1, p[2]);
    g.fillStyle = grad;
    g.fill(path);
    g.clip(path);
    g.strokeStyle = 'rgba(255,255,230,0.35)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, L * 1.1);
    g.lineTo(0, -L);
    g.stroke();
    g.lineWidth = 1;
    for (let k = -4; k <= 4; k++) {
      const y = k * L * 0.2;
      g.beginPath();
      g.moveTo(0, y);
      g.quadraticCurveTo(Wd * 0.6, y - L * 0.12, Wd * 1.4, y - L * 0.22);
      g.moveTo(0, y);
      g.quadraticCurveTo(-Wd * 0.6, y - L * 0.12, -Wd * 1.4, y - L * 0.22);
      g.stroke();
    }
    g.restore();
    // petiole
    g.save();
    g.translate(ox + cell / 2, oy + cell / 2);
    g.strokeStyle = p[2];
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, L);
    g.lineTo(0, L + cell * 0.07);
    g.stroke();
    g.restore();
  });
  return c;
}

/** A clump of leaves on a twig — used as billboard cards for distant canopies */
export function leafClusterSprite(size = 256): HTMLCanvasElement {
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  const rnd = mulberry32(19);
  const cx = size / 2;
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.pow(rnd(), 0.7) * size * 0.4;
    const x = cx + Math.cos(a) * r;
    const y = cx + Math.sin(a) * r;
    const L = size * (0.05 + rnd() * 0.05);
    const tone = 0.55 + rnd() * 0.45;
    g.save();
    g.translate(x, y);
    g.rotate(a + (rnd() - 0.5) * 1.2);
    const v = Math.round(255 * tone);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.beginPath();
    g.moveTo(0, -L);
    g.bezierCurveTo(L * 0.55, -L * 0.4, L * 0.5, L * 0.5, 0, L);
    g.bezierCurveTo(-L * 0.5, L * 0.5, -L * 0.55, -L * 0.4, 0, -L);
    g.fill();
    g.restore();
  }
  return c;
}

/** Tiny meadow flower (white petals, yellow heart) */
export function flowerSprite(size = 64): HTMLCanvasElement {
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  const r = size / 2;
  g.translate(r, r);
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 7; i++) {
    g.save();
    g.rotate((i / 7) * Math.PI * 2);
    g.beginPath();
    g.ellipse(0, -r * 0.5, r * 0.2, r * 0.46, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  g.fillStyle = '#f2c230';
  g.beginPath();
  g.arc(0, 0, r * 0.22, 0, Math.PI * 2);
  g.fill();
  return c;
}

/** Dandelion seed (pappus) sprite, white on transparent */
export function seedSprite(size = 128, color = '#ffffff'): HTMLCanvasElement {
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  const cx = size / 2;
  const top = size * 0.3;
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineCap = 'round';
  // stalk
  g.globalAlpha = 0.9;
  g.lineWidth = size * 0.012;
  g.beginPath();
  g.moveTo(cx, top);
  g.lineTo(cx, size * 0.86);
  g.stroke();
  // seed body
  g.beginPath();
  g.ellipse(cx, size * 0.88, size * 0.018, size * 0.06, 0, 0, Math.PI * 2);
  g.fill();
  // umbrella filaments
  const rays = 26;
  for (let i = 0; i < rays; i++) {
    const a = Math.PI + (i / (rays - 1)) * Math.PI;
    const len = size * (0.26 + Math.sin((i / rays) * Math.PI) * 0.08);
    g.globalAlpha = 0.55;
    g.lineWidth = size * 0.006;
    g.beginPath();
    g.moveTo(cx, top);
    const ex = cx + Math.cos(a) * len;
    const ey = top + Math.sin(a) * len * 0.75;
    g.quadraticCurveTo(cx + Math.cos(a) * len * 0.5, top + Math.sin(a) * len * 0.2, ex, ey);
    g.stroke();
    g.globalAlpha = 0.35;
    g.beginPath();
    g.arc(ex, ey, size * 0.008, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  return c;
}

export function softDot(size = 64, inner = 0.0): HTMLCanvasElement {
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  const gr = g.createRadialGradient(size / 2, size / 2, size * inner, size / 2, size / 2, size / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return c;
}

/** Bokeh disc with a slightly brighter rim (like real lens bokeh) */
export function bokehDisc(size = 128): HTMLCanvasElement {
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  const r = size / 2;
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, 'rgba(255,255,255,0.55)');
  gr.addColorStop(0.78, 'rgba(255,255,255,0.7)');
  gr.addColorStop(0.9, 'rgba(255,255,255,0.9)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.beginPath();
  g.arc(r, r, r, 0, Math.PI * 2);
  g.fill();
  return c;
}

export function butterflyWing(color = '#f2c14e', size = 256): HTMLCanvasElement {
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  // right wing only, root at left-middle
  g.translate(0, size / 2);
  const p = new Path2D();
  p.moveTo(0, 0);
  p.bezierCurveTo(size * 0.2, -size * 0.55, size * 0.95, -size * 0.5, size * 0.9, -size * 0.1);
  p.bezierCurveTo(size * 0.85, size * 0.05, size * 0.6, size * 0.05, size * 0.5, size * 0.02);
  p.bezierCurveTo(size * 0.75, size * 0.2, size * 0.7, size * 0.45, size * 0.45, size * 0.42);
  p.bezierCurveTo(size * 0.25, size * 0.4, size * 0.1, size * 0.2, 0, 0);
  const gr = g.createRadialGradient(0, 0, 4, 0, 0, size * 0.9);
  gr.addColorStop(0, shade(color, -0.45));
  gr.addColorStop(0.35, color);
  gr.addColorStop(0.85, shade(color, 0.2));
  gr.addColorStop(1, '#2a1a10');
  g.fillStyle = gr;
  g.fill(p);
  g.save();
  g.clip(p);
  g.strokeStyle = 'rgba(30,20,10,0.8)';
  g.lineWidth = size * 0.035;
  g.stroke(p);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.arc(size * (0.62 + i * 0.06), -size * (0.32 - i * 0.05), size * 0.02, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  return c;
}

/* ─────────────────────────── 3D letter face ─────────────────────────── */

export function letterFaceCanvas(o: {
  paper: HTMLCanvasElement;
  aspect: number;
  greeting?: string;
  title: string;
  lines: string[];
  ink: string;
  accent: string;
  titleFont: string;
  bodyFont: string;
  ruling: 'plain' | 'lined' | 'dotted' | 'grid';
}): HTMLCanvasElement {
  const W = 1024;
  const H = Math.round(W / o.aspect);
  const c = makeCanvas(W, H);
  const g = ctx2d(c);
  g.fillStyle = g.createPattern(o.paper, 'repeat')!;
  g.fillRect(0, 0, W, H);
  // ruling
  g.strokeStyle = 'rgba(80,110,150,0.16)';
  g.fillStyle = 'rgba(80,110,150,0.2)';
  g.lineWidth = 1.5;
  const step = W / 22;
  if (o.ruling === 'lined') {
    for (let y = H * 0.14; y < H * 0.95; y += step) {
      g.beginPath();
      g.moveTo(W * 0.07, y);
      g.lineTo(W * 0.93, y);
      g.stroke();
    }
  } else if (o.ruling === 'dotted' || o.ruling === 'grid') {
    for (let y = step; y < H; y += step)
      for (let x = step; x < W; x += step) {
        if (o.ruling === 'dotted') {
          g.beginPath();
          g.arc(x, y, 1.6, 0, Math.PI * 2);
          g.fill();
        }
      }
    if (o.ruling === 'grid') {
      for (let y = step; y < H; y += step) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(W, y);
        g.stroke();
      }
      for (let x = step; x < W; x += step) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, H);
        g.stroke();
      }
    }
  }
  const pad = W * 0.1;
  g.fillStyle = o.ink;
  g.textBaseline = 'alphabetic';
  let y = H * 0.11;
  if (o.greeting) {
    g.font = `${Math.round(W * 0.045)}px ${o.bodyFont}`;
    g.globalAlpha = 0.85;
    g.fillText(o.greeting, pad, y);
    y += W * 0.08;
  }
  g.globalAlpha = 1;
  g.textAlign = 'center';
  const ts = fitFont(g, o.title, o.titleFont, W - pad * 2, Math.round(W * 0.1));
  g.fillText(o.title, W / 2, y + ts * 0.4);
  y += ts * 0.9;
  g.strokeStyle = o.accent;
  g.globalAlpha = 0.5;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(W * 0.4, y);
  g.bezierCurveTo(W * 0.46, y - 8, W * 0.54, y + 8, W * 0.6, y);
  g.stroke();
  g.globalAlpha = 1;
  g.textAlign = 'left';
  y += W * 0.08;
  for (const line of o.lines.slice(0, 4)) {
    g.font = `${Math.round(W * 0.036)}px ${o.bodyFont}`;
    g.globalAlpha = 0.9;
    g.fillText(line.length > 48 ? line.slice(0, 46) + '…' : line, pad, y);
    g.globalAlpha = 0.28;
    g.fillRect(pad, y + W * 0.045, W - pad * 2, 2);
    y += W * 0.13;
  }
  g.globalAlpha = 1;
  return c;
}

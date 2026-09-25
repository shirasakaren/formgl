'use client';
import * as THREE from 'three';
import type { EnvAssetContext, EnvStep } from './assets';
import { clamp01, hexToRgb, mulberry32, shade, smoothstep, ValueNoise } from './noise';
import { barkTextures, ctx2d, makeCanvas, normalFromHeight, toTexture, woodTextures } from './textures';

/* ───────────────────────── seaside ───────────────────────── */

function sandTextures(seed = 4, size = 512) {
  const n = new ValueNoise(seed);
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  const img = g.createImageData(size, size);
  const height = new Float32Array(size * size);
  const B = hexToRgb('#e3cfa4');
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const warp = n.fbm(u * 4, v * 4, 3, 4) * 2.2;
      // wind ripples running across the beach
      const rip = (Math.sin((v * 22 + warp * 1.6 + n.n2(u * 40, v * 6, 40) * 0.6) * Math.PI * 2) * 0.5 + 0.5) * smoothstep(0.3, 0.7, n.fbm(u * 3 + 9, v * 3, 3, 3));
      const grain = n.n2(x * 0.9, y * 0.9, size * 0.9 > 0 ? Math.round(size * 0.9) : 0);
      const speck = n.n2(x * 0.45 + 13, y * 0.45 + 7, Math.round(size * 0.45));
      const mott = n.fbm(u * 6 + 3, v * 6, 4, 6);
      let t = (mott - 0.5) * 0.12 + (grain - 0.5) * 0.14 + rip * 0.012;
      if (speck > 0.86) t -= 0.25 * (speck - 0.86) * 7;
      if (speck < 0.1) t += 0.12;
      const i = (y * size + x) * 4;
      img.data[i] = B[0] * (1 + t);
      img.data[i + 1] = B[1] * (1 + t * 1.02);
      img.data[i + 2] = B[2] * (1 + t * 1.1);
      img.data[i + 3] = 255;
      height[y * size + x] = rip * 0.22 + grain * 0.4 + mott * 0.2;
    }
  g.putImageData(img, 0, 0);
  const nm = normalFromHeight(height, size, size, 1.8);
  return { map: toTexture(c, { wrap: true }), normalMap: toTexture(nm, { srgb: false, wrap: true }) };
}

function corkTexture(size = 256) {
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  const r = mulberry32(8);
  g.fillStyle = '#b98b5e';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 2200; i++) {
    g.fillStyle = r() < 0.5 ? `rgba(90,55,25,${0.2 + r() * 0.4})` : `rgba(235,200,150,${0.15 + r() * 0.3})`;
    g.beginPath();
    g.arc(r() * size, r() * size, 0.5 + r() * 2.2, 0, Math.PI * 2);
    g.fill();
  }
  return toTexture(c, { wrap: true });
}

function shellTexture(size = 256) {
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  const grad = g.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#f6d9c9');
  grad.addColorStop(0.5, '#f2c6b0');
  grad.addColorStop(1, '#fff3ea');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  // radial ribs + growth rings
  for (let i = 0; i < 18; i++) {
    const x = (i / 18) * size;
    g.fillStyle = 'rgba(160,90,70,0.12)';
    g.fillRect(x, 0, 3, size);
  }
  for (let j = 0; j < 9; j++) {
    g.strokeStyle = 'rgba(190,120,90,0.18)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, (j / 9) * size);
    g.lineTo(size, (j / 9) * size + 6);
    g.stroke();
  }
  return toTexture(c, { wrap: true });
}

/* ───────────────────────── atelier ───────────────────────── */

function wallpaperTexture(base: string, size = 512) {
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  const n = new ValueNoise(3);
  const img = g.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const t = (n.fbm((x / size) * 8, (y / size) * 8, 3, 8) - 0.5) * 0.06;
      const i = (y * size + x) * 4;
      img.data[i] *= 1 + t;
      img.data[i + 1] *= 1 + t;
      img.data[i + 2] *= 1 + t;
    }
  g.putImageData(img, 0, 0);
  // delicate vertical stripes with tiny flowers
  const ink = shade(base, -0.12);
  for (let x = 0; x < size; x += size / 8) {
    g.fillStyle = ink;
    g.globalAlpha = 0.35;
    g.fillRect(x, 0, 2, size);
    g.globalAlpha = 0.5;
    for (let y = size / 16; y < size; y += size / 8) {
      const ox = x + size / 16;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        g.beginPath();
        g.ellipse(ox + Math.cos(a) * 4, y + Math.sin(a) * 4, 3, 1.6, a, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  g.globalAlpha = 1;
  return toTexture(c, { wrap: true });
}

function sheerTexture(size = 256) {
  // vertical weave + soft gathered folds; used with alpha for sheer curtains
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const fold = Math.sin((x / size) * Math.PI * 2 * 6) * 0.5 + 0.5;
      const weave = (Math.sin(x * 1.7) * 0.5 + 0.5) * (Math.sin(y * 1.7) * 0.5 + 0.5);
      const v = 0.72 + fold * 0.2 + weave * 0.08;
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255 * clamp01(v);
      img.data[i + 3] = 255 * (0.38 + fold * 0.25);
    }
  g.putImageData(img, 0, 0);
  const t = toTexture(c, { wrap: true });
  return t;
}

function bookCovers(size = 256) {
  const cols = ['#6b2d3a', '#2f4f5f', '#5d6b3a', '#8a6443', '#2b2320', '#b0835a'];
  const c = makeCanvas(size, size * cols.length);
  const g = ctx2d(c);
  const n = new ValueNoise(12);
  cols.forEach((col, k) => {
    g.fillStyle = col;
    g.fillRect(0, k * size, size, size);
    const img = g.getImageData(0, k * size, size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const p = i / 4;
      const t = (n.n2((p % size) * 0.4, Math.floor(p / size) * 0.4) - 0.5) * 0.18;
      img.data[i] *= 1 + t;
      img.data[i + 1] *= 1 + t;
      img.data[i + 2] *= 1 + t;
    }
    g.putImageData(img, 0, k * size);
    g.strokeStyle = 'rgba(230,200,130,0.8)';
    g.lineWidth = 3;
    g.strokeRect(12, k * size + 12, size - 24, size - 24);
    g.fillStyle = 'rgba(230,200,130,0.85)';
    g.fillRect(size * 0.3, k * size + size * 0.2, size * 0.4, 5);
    g.fillRect(size * 0.35, k * size + size * 0.2 + 12, size * 0.3, 3);
  });
  return toTexture(c);
}

function floorTexture() {
  // warm oak boards: reuse the wood generator, laid in planks
  const w = woodTextures(31, '#b98a5c', '#7c5334');
  return w;
}

/* ───────────────────────── skies ───────────────────────── */

function wickerTexture(size = 512) {
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  g.fillStyle = '#a57b4c';
  g.fillRect(0, 0, size, size);
  const height = new Float32Array(size * size);
  const img = g.getImageData(0, 0, size, size);
  const cell = size / 16;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const cx = Math.floor(x / cell);
      const cy = Math.floor(y / cell);
      const fx = (x % cell) / cell;
      const fy = (y % cell) / cell;
      const horizontal = (cx + cy) % 2 === 0;
      const across = horizontal ? fy : fx;
      const along = horizontal ? fx : fy;
      const strand = Math.sin(across * Math.PI);
      const hgt = strand * (0.7 + 0.3 * Math.sin(along * Math.PI));
      const i = (y * size + x) * 4;
      const tone = 0.62 + hgt * 0.5;
      img.data[i] = 176 * tone;
      img.data[i + 1] = 132 * tone;
      img.data[i + 2] = 84 * tone;
      height[y * size + x] = hgt;
    }
  g.putImageData(img, 0, 0);
  const nm = normalFromHeight(height, size, size, 3);
  return { map: toTexture(c, { wrap: true }), normalMap: toTexture(nm, { srgb: false, wrap: true }) };
}

function stripeTexture(colors: string[], size = 512) {
  const c = makeCanvas(size, 64);
  const g = ctx2d(c);
  const w = size / colors.length;
  colors.forEach((col, i) => {
    g.fillStyle = col;
    g.fillRect(i * w, 0, w + 1, 64);
  });
  return toTexture(c, { wrap: true });
}

function cloudPuff(size = 256) {
  // soft, lumpy cloud billboard: overlapping radial discs (alpha) — no canvas filter, it is very slow on some GPUs
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  const r = mulberry32(5);
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.pow(r(), 0.7) * size * 0.26;
    const rad = size * (0.1 + r() * 0.14);
    const x = size / 2 + Math.cos(a) * d * 1.3;
    const y = size / 2 + Math.sin(a) * d * 0.6 + size * 0.04;
    const gr = g.createRadialGradient(x, y - rad * 0.3, rad * 0.1, x, y, rad);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)');
    gr.addColorStop(0.7, 'rgba(245,240,248,0.75)');
    gr.addColorStop(1, 'rgba(240,235,245,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  }
  return toTexture(c);
}

/* ───────────────────────── registry ───────────────────────── */

export const ENV_TEXTURES: Record<string, (ctx: EnvAssetContext) => EnvStep[]> = {
  seaside: ({ out }) => [
    ['Smoothing the wet sand', () => {
      const s = sandTextures(4);
      out.env.sand = s.map;
      out.env.sandNormal = s.normalMap;
    }],
    ['Washing the sea glass', () => {
      out.env.cork = corkTexture();
      out.env.shell = shellTexture();
      const d = barkTextures(44);
      out.env.drift = d.map;
      out.env.driftNormal = d.normalMap;
    }],
  ],
  atelier: ({ form, out }) => [
    ['Dusting the writing desk', () => {
      const w = woodTextures(17, '#a8744a', '#5e3a22');
      out.env.desk = w.map;
      out.env.deskNormal = w.normalMap;
      out.env.deskRough = w.roughnessMap;
      const f = floorTexture();
      out.env.floor = f.map;
      out.env.floorNormal = f.normalMap;
    }],
    ['Hanging the curtains', () => {
      out.env.wallpaper = wallpaperTexture(shade(form.theme.envelopeColor, 0.05));
      out.env.sheer = sheerTexture();
      out.env.books = bookCovers();
    }],
  ],
  skies: ({ out }) => [
    ['Weaving the basket', () => {
      const w = wickerTexture();
      out.env.wicker = w.map;
      out.env.wickerNormal = w.normalMap;
    }],
    ['Inflating the balloons', () => {
      out.env.stripes = stripeTexture(['#f2c6d4', '#fdf2e6', '#b8d8e4', '#fdf2e6', '#f6d98e', '#fdf2e6']);
      out.env.stripes2 = stripeTexture(['#c2577a', '#f7e3c8', '#c2577a', '#f7e3c8']);
      out.env.cloud = cloudPuff();
    }],
  ],
};

export { smoothstep };

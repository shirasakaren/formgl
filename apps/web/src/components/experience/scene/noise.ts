/* Small, fast, seeded noise helpers used by the procedural texture generators. */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class ValueNoise {
  private perm: Uint8Array;
  private vals: Float32Array;
  constructor(seed = 1) {
    const r = mulberry32(seed);
    this.perm = new Uint8Array(512);
    this.vals = new Float32Array(256);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      p[i] = i;
      this.vals[i] = r();
    }
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = p[i];
      p[i] = p[j];
      p[j] = t;
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }
  /** 2D value noise in [0,1], optionally periodic (for tileable textures) */
  n2(x: number, y: number, period = 0): number {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    let x0 = xi,
      y0 = yi,
      x1 = xi + 1,
      y1 = yi + 1;
    if (period > 0) {
      x0 = ((x0 % period) + period) % period;
      x1 = ((x1 % period) + period) % period;
      y0 = ((y0 % period) + period) % period;
      y1 = ((y1 % period) + period) % period;
    }
    const P = this.perm;
    const V = this.vals;
    const a = V[P[(x0 & 255) + P[y0 & 255]]];
    const b = V[P[(x1 & 255) + P[y0 & 255]]];
    const c = V[P[(x0 & 255) + P[y1 & 255]]];
    const d = V[P[(x1 & 255) + P[y1 & 255]]];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  fbm(x: number, y: number, octaves = 4, period = 0): number {
    let amp = 0.5,
      f = 1,
      sum = 0,
      norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.n2(x * f, y * f, period ? period * f : 0);
      norm += amp;
      amp *= 0.5;
      f *= 2;
    }
    return sum / norm;
  }
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [240, 230, 214];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

/** mix color with white (t>0) or black (t<0) */
export function shade(hex: string, t: number): string {
  const [r, g, b] = hexToRgb(hex);
  if (t >= 0) return rgbToHex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t);
  return rgbToHex(r * (1 + t), g * (1 + t), b * (1 + t));
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

'use client';
/* Layout of the writing room and the small canvases painted for it. */
import * as THREE from 'three';
import { mulberry32 } from '../../noise';
import { ctx2d, makeCanvas, toTexture } from '../../textures';

/** height of the desk top surface */
export const DESK_Y = 0.76;
export const DESK = { w: 1.3, d: 0.66, cx: 0, cz: -0.02 };
/** inner face of the window wall */
export const WALL_Z = -0.45;
export const WALL_T = 0.16;
/** the window opening in the back wall */
export const WIN = { x0: -0.52, x1: 0.52, y0: 0.98, y1: 2.12, transom: 1.78 };
export const SILL_Y = WIN.y0 - 0.02;
export const ROOM = { x0: -1.8, x1: 1.8, zBack: WALL_Z, zFront: 3.2, h: 2.8 };
/** direction toward the sun (it pours in through the window) */
export const SUN_DIR = new THREE.Vector3(-0.3, 0.55, -1).normalize();
/** the folded letter lying on the blotter */
export const LETTER_REST = { pos: new THREE.Vector3(0.06, DESK_Y + 0.0032, 0.08), yaw: 0.1 };
export const WINDOW_CENTRE = new THREE.Vector3((WIN.x0 + WIN.x1) / 2 + 0.04, (WIN.y0 + WIN.transom) / 2, WALL_Z - 0.08);

/** a sunny cottage garden seen through the window (unlit backdrop, softened) */
export function gardenCanvas(sky: string, horizon: string) {
  const W = 1024;
  const H = 576;
  const c = makeCanvas(W, H);
  const g = ctx2d(c);
  const rnd = mulberry32(71);
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, sky);
  gr.addColorStop(0.62, horizon);
  gr.addColorStop(1, horizon);
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  // soft summer clouds (radial puffs — canvas filters are far too slow on some devices)
  for (let i = 0; i < 9; i++) {
    const x = rnd() * W;
    const y = 40 + rnd() * 150;
    for (let k = 0; k < 5; k++) {
      const cx = x + (k - 2) * 38 + rnd() * 20;
      const cy = y + rnd() * 16;
      const r = 50 + rnd() * 40;
      const cg = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      cg.addColorStop(0, 'rgba(255,255,255,0.55)');
      cg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = cg;
      g.beginPath();
      g.ellipse(cx, cy, r, r * 0.45, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  // far hills, hazy
  g.fillStyle = '#b7c9b0';
  g.beginPath();
  g.moveTo(0, H * 0.66);
  for (let x = 0; x <= W; x += 32) g.lineTo(x, H * 0.62 - Math.sin(x * 0.006 + 1) * 22 - Math.sin(x * 0.017) * 8);
  g.lineTo(W, H);
  g.lineTo(0, H);
  g.fill();
  // tree line: round canopies, lit from the upper left
  const trees = 26;
  for (let i = 0; i < trees; i++) {
    const x = (i / trees) * W + rnd() * 40 - 20;
    const base = H * (0.7 + rnd() * 0.04);
    const r = 40 + rnd() * 60;
    const cy = base - r * (1 + rnd() * 0.6);
    const dark = ['#5f7f4a', '#6e8c52', '#58764a', '#7a9656'][Math.floor(rnd() * 4)];
    for (let k = 0; k < 6; k++) {
      const ox = (rnd() - 0.5) * r * 0.9;
      const oy = (rnd() - 0.5) * r * 0.7;
      const rr = r * (0.45 + rnd() * 0.35);
      const lg = g.createRadialGradient(x + ox - rr * 0.4, cy + oy - rr * 0.4, rr * 0.1, x + ox, cy + oy, rr);
      lg.addColorStop(0, '#b8cf84');
      lg.addColorStop(1, dark);
      g.fillStyle = lg;
      g.beginPath();
      g.arc(x + ox, cy + oy, rr, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#6b5a45';
    g.fillRect(x - 3, cy + r * 0.4, 6, base - cy - r * 0.4);
  }
  // lawn
  const lawn = g.createLinearGradient(0, H * 0.7, 0, H);
  lawn.addColorStop(0, '#a9c27a');
  lawn.addColorStop(1, '#7fa05a');
  g.fillStyle = lawn;
  g.fillRect(0, H * 0.72, W, H * 0.28);
  // clipped hedge with a gate gap
  for (let x = -20; x < W + 20; x += 14) {
    if (x > W * 0.46 && x < W * 0.54) continue;
    const hgt = 70 + Math.sin(x * 0.05) * 4 + rnd() * 6;
    const hg = g.createLinearGradient(0, H * 0.86 - hgt, 0, H * 0.86);
    hg.addColorStop(0, '#6f9150');
    hg.addColorStop(1, '#3f5c2f');
    g.fillStyle = hg;
    g.beginPath();
    g.ellipse(x, H * 0.86 - hgt * 0.5, 14, hgt * 0.55, 0, 0, Math.PI * 2);
    g.fill();
  }
  // flower borders
  const cols = ['#f2b8c6', '#ffffff', '#f6d36b', '#c9a2e0', '#f08d7a', '#fbe3ea'];
  for (let i = 0; i < 900; i++) {
    const x = rnd() * W;
    const y = H * 0.87 + rnd() * H * 0.12;
    g.fillStyle = cols[Math.floor(rnd() * cols.length)];
    g.globalAlpha = 0.85;
    g.beginPath();
    g.arc(x, y, 2 + rnd() * 3.5, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  // soften it all once: shrink and scale back up (it is seen out of focus anyway)
  const small = makeCanvas(W / 4, H / 4);
  const sg = ctx2d(small);
  sg.imageSmoothingQuality = 'high';
  sg.drawImage(c, 0, 0, W / 4, H / 4);
  g.imageSmoothingQuality = 'high';
  g.clearRect(0, 0, W, H);
  g.drawImage(small, 0, 0, W, H);
  return toTexture(c);
}

/** a violet pressed between pages: flat, faded, a little translucent */
export function pressedFlowerCanvas(size = 256) {
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  const cx = size / 2;
  g.strokeStyle = '#6f7a45';
  g.lineWidth = 5;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx, cx);
  g.bezierCurveTo(cx + 8, cx + 50, cx - 10, cx + 80, cx + 6, size - 8);
  g.stroke();
  // two leaves on the stem
  g.fillStyle = '#7f8b50';
  for (const [y, s] of [[cx + 60, 1], [cx + 88, -1]] as const) {
    g.save();
    g.translate(cx + 2, y);
    g.rotate(s * 0.9);
    g.beginPath();
    g.ellipse(s * 20, 0, 22, 8, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  const petals = 5;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2 - Math.PI / 2;
    g.save();
    g.translate(cx, cx);
    g.rotate(a);
    const pg = g.createLinearGradient(0, 0, 0, -cx * 0.62);
    pg.addColorStop(0, '#5e3f86');
    pg.addColorStop(1, '#a58ad0');
    g.fillStyle = pg;
    g.beginPath();
    g.ellipse(0, -cx * 0.33, cx * 0.2, cx * 0.33, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(60,30,90,0.35)';
    g.lineWidth = 1;
    for (let k = -2; k <= 2; k++) {
      g.beginPath();
      g.moveTo(0, -6);
      g.lineTo(k * 6, -cx * 0.55);
      g.stroke();
    }
    g.restore();
  }
  g.fillStyle = '#f3d25c';
  g.beginPath();
  g.arc(cx, cx, 9, 0, Math.PI * 2);
  g.fill();
  return toTexture(c);
}

/** a long goose feather for the quill */
export function featherCanvas(w = 128, h = 512) {
  const c = makeCanvas(w, h);
  const g = ctx2d(c);
  const rnd = mulberry32(5);
  const cx = w / 2;
  // vane: asymmetric, fringed barbs
  for (let y = 40; y < h - 60; y += 1.5) {
    const t = (y - 40) / (h - 100);
    const env = Math.sin(Math.pow(t, 0.8) * Math.PI) * (1 - t * 0.2);
    const wl = env * w * 0.44 * (0.9 + rnd() * 0.15);
    const wr = env * w * 0.3 * (0.9 + rnd() * 0.15);
    const tone = 232 + rnd() * 20;
    g.strokeStyle = `rgba(${tone},${tone - 6},${tone - 16},0.9)`;
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(cx, y);
    g.quadraticCurveTo(cx - wl * 0.5, y - 6, cx - wl, y - 16);
    g.moveTo(cx, y);
    g.quadraticCurveTo(cx + wr * 0.5, y - 6, cx + wr, y - 14);
    g.stroke();
    if (rnd() < 0.04) y += 4; // little splits in the vane
  }
  // shaft
  g.strokeStyle = '#efe6d2';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(cx, 20);
  g.lineTo(cx, h);
  g.stroke();
  return toTexture(c);
}

/** a botanical print for the wall */
export function printCanvas(seed: number, w = 256, h = 320) {
  const c = makeCanvas(w, h);
  const g = ctx2d(c);
  const rnd = mulberry32(seed);
  g.fillStyle = '#f4ecdb';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(120,100,70,0.4)';
  g.lineWidth = 2;
  g.strokeRect(18, 18, w - 36, h - 36);
  // a sprig
  g.strokeStyle = '#5d6b3f';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(w / 2, h - 50);
  g.bezierCurveTo(w / 2 + 20, h * 0.6, w / 2 - 20, h * 0.4, w / 2 + 6, 60);
  g.stroke();
  for (let i = 0; i < 9; i++) {
    const t = 0.15 + i * 0.08;
    const y = h - 50 - t * (h - 110);
    const s = i % 2 ? 1 : -1;
    g.save();
    g.translate(w / 2 + Math.sin(t * 5) * 8, y);
    g.rotate(s * (0.7 + rnd() * 0.3));
    g.fillStyle = seed % 2 ? '#7d9360' : '#8e9a58';
    g.beginPath();
    g.ellipse(s * 26, 0, 28, 10, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  if (seed % 2) {
    for (let i = 0; i < 3; i++) {
      g.fillStyle = ['#c95b6d', '#d98a9a', '#b64657'][i];
      g.beginPath();
      g.arc(w / 2 + (i - 1) * 16, 70 + i * 10, 12, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.fillStyle = 'rgba(80,60,40,0.55)';
  g.font = 'italic 14px Georgia, serif';
  g.textAlign = 'center';
  g.fillText(seed % 2 ? 'Rosa canina' : 'Olea europaea', w / 2, h - 28);
  return toTexture(c);
}

/** fine noise used as a bump for the leather blotter */
export function leatherCanvas(color: string, size = 256) {
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  g.fillStyle = color;
  g.fillRect(0, 0, size, size);
  const img = g.getImageData(0, 0, size, size);
  const rnd = mulberry32(3);
  for (let i = 0; i < img.data.length; i += 4) {
    const t = (rnd() - 0.5) * 0.12;
    img.data[i] *= 1 + t;
    img.data[i + 1] *= 1 + t;
    img.data[i + 2] *= 1 + t;
  }
  g.putImageData(img, 0, 0);
  // tooled gold border
  g.strokeStyle = 'rgba(214,180,110,0.8)';
  g.lineWidth = 3;
  g.strokeRect(10, 10, size - 20, size - 20);
  g.lineWidth = 1;
  g.strokeRect(17, 17, size - 34, size - 34);
  return toTexture(c);
}

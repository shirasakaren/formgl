import type { TimeOfDay } from '@formgl/shared';

export interface LightPreset {
  /** direction toward the sun (unnormalized) */
  sunDir: [number, number, number];
  sunColor: string;
  sunIntensity: number;
  /** how much of the canopy lets light through (0 = dense shade, 1 = open) */
  canopyOpen: number;
  skyTop: string;
  skyHorizon: string;
  sunGlow: string;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  fog: string;
  fogDensity: number;
  /** far lawn / tree tints for the unlit background */
  lawnFar: string;
  lawnNear: string;
  treeTint: string;
  treeLit: string;
  bokeh: string;
  exposure: number;
  bloom: number;
  envIntensity: number;
  dustColor: string;
}

export const PRESETS: Record<TimeOfDay, LightPreset> = {
  morning: {
    sunDir: [-0.7, 0.8, 0.5],
    sunColor: '#fff1d9',
    sunIntensity: 5.5,
    canopyOpen: 0.42,
    skyTop: '#9cc3e6',
    skyHorizon: '#f4ecdf',
    sunGlow: '#fff4dd',
    hemiSky: '#dce9f5',
    hemiGround: '#8a8a64',
    hemiIntensity: 0.55,
    fog: '#e9eee6',
    fogDensity: 0.028,
    lawnFar: '#b7cf8f',
    lawnNear: '#7c9a52',
    treeTint: '#3f5f33',
    treeLit: '#8fb35c',
    bokeh: '#fff6dc',
    exposure: 1.0,
    bloom: 0.55,
    envIntensity: 0.4,
    dustColor: '#fff7e2',
  },
  noon: {
    sunDir: [-0.35, 1.6, 0.3],
    sunColor: '#fffaf0',
    sunIntensity: 6,
    canopyOpen: 0.38,
    skyTop: '#86b8e8',
    skyHorizon: '#eef3f5',
    sunGlow: '#ffffff',
    hemiSky: '#e3eef9',
    hemiGround: '#7f8760',
    hemiIntensity: 0.6,
    fog: '#e7eef0',
    fogDensity: 0.022,
    lawnFar: '#b3d27f',
    lawnNear: '#6f9444',
    treeTint: '#46693a',
    treeLit: '#95ba5e',
    bokeh: '#ffffff',
    exposure: 0.95,
    bloom: 0.45,
    envIntensity: 0.45,
    dustColor: '#ffffff',
  },
  golden: {
    sunDir: [-0.8, 0.55, 0.5],
    sunColor: '#ffc98a',
    sunIntensity: 6.2,
    canopyOpen: 0.45,
    skyTop: '#f0c9a2',
    skyHorizon: '#fde6c4',
    sunGlow: '#ffd9a0',
    hemiSky: '#f6dcc0',
    hemiGround: '#8c7650',
    hemiIntensity: 0.5,
    fog: '#f3dcbc',
    fogDensity: 0.03,
    lawnFar: '#d9c37e',
    lawnNear: '#8c9447',
    treeTint: '#4a5a2a',
    treeLit: '#bdb25a',
    bokeh: '#ffd89a',
    exposure: 1.02,
    bloom: 0.75,
    envIntensity: 0.35,
    dustColor: '#ffe2b0',
  },
  dusk: {
    sunDir: [-0.9, 0.32, 0.4],
    sunColor: '#ff9e7a',
    sunIntensity: 4.6,
    canopyOpen: 0.5,
    skyTop: '#b8a3c9',
    skyHorizon: '#f7c9b0',
    sunGlow: '#ffb38a',
    hemiSky: '#cdb9d8',
    hemiGround: '#6b5a58',
    hemiIntensity: 0.55,
    fog: '#e7c9c2',
    fogDensity: 0.034,
    lawnFar: '#b9a584',
    lawnNear: '#6f7447',
    treeTint: '#4d4d3c',
    treeLit: '#d99a78',
    bokeh: '#ffc2a0',
    exposure: 1.05,
    bloom: 0.85,
    envIntensity: 0.35,
    dustColor: '#ffd0b8',
  },
  overcast: {
    sunDir: [-0.4, 1.2, 0.3],
    sunColor: '#eef1f4',
    sunIntensity: 1.2,
    canopyOpen: 0.8,
    skyTop: '#c9d1d8',
    skyHorizon: '#edf0f1',
    sunGlow: '#f4f6f7',
    hemiSky: '#e6ebef',
    hemiGround: '#7b8070',
    hemiIntensity: 1.3,
    fog: '#e3e7e8',
    fogDensity: 0.035,
    lawnFar: '#a9bb92',
    lawnNear: '#6c8551',
    treeTint: '#4e5e46',
    treeLit: '#7f9870',
    bokeh: '#f3f5f7',
    exposure: 1.0,
    bloom: 0.3,
    envIntensity: 0.8,
    dustColor: '#f5f5f5',
  },
};

'use client';
import type { EnvironmentKey } from '@formgl/shared';
import { parkIntro, parkOpen, parkSend } from '../timeline';
import { seasideIntro, seasideOpen, seasideSend } from './seaside';
import { atelierIntro, atelierOpen, atelierSend } from './atelier';
import { skiesIntro, skiesOpen, skiesSend } from './skies';
import { lanternIntro, lanternOpen, lanternSend } from './lantern';

export type RevealMode = 'dandelion' | 'tide' | 'curtain' | 'clouds' | 'embers';
export type Ambience = 'park' | 'sea' | 'room' | 'sky' | 'night';
export type VignetteKey =
  | 'ink' | 'stamp' | 'plane' | 'leaves' | 'envelope' | 'dandelion'
  | 'waves' | 'bottle' | 'shell' | 'gull' | 'lighthouse' | 'sunrise'
  | 'typewriter' | 'candle' | 'teacup' | 'clock'
  | 'balloon' | 'clouds' | 'hotair' | 'kite'
  | 'lantern' | 'moon' | 'fireflies';

type Tl = { kill: () => void };

export interface EnvConfig {
  key: EnvironmentKey;
  letterStyle: 'fold' | 'scroll';
  revealMode: RevealMode;
  ambience: Ambience;
  vignettes: VignetteKey[];
  quotes: string[];
  intro: (reduced: boolean, onDone?: () => void) => Tl;
  open: (reduced: boolean, onLetterReady: () => void) => Tl;
  send: (reduced: boolean, onSent: () => void) => Tl;
}

const CONFIGS: Record<EnvironmentKey, EnvConfig> = {
  park: {
    key: 'park',
    letterStyle: 'fold',
    revealMode: 'dandelion',
    ambience: 'park',
    vignettes: ['ink', 'stamp', 'plane', 'leaves', 'envelope', 'dandelion'],
    quotes: [
      'Some words are worth the wait.',
      'Good letters take a moment.',
      'Slow down. Something kind is coming.',
      'Written by hand, delivered by light.',
      'Listen — the leaves are whispering.',
    ],
    intro: parkIntro,
    open: parkOpen,
    send: parkSend,
  },
  seaside: {
    key: 'seaside',
    letterStyle: 'scroll',
    revealMode: 'tide',
    ambience: 'sea',
    vignettes: ['waves', 'bottle', 'shell', 'gull', 'lighthouse', 'sunrise'],
    quotes: [
      'The tide always brings back what matters.',
      'Somewhere, someone threw this to the sea for you.',
      'Salt, sun, and a few honest words.',
      'Listen — the waves are counting to ten.',
      'Every bottle finds its shore.',
    ],
    intro: seasideIntro,
    open: seasideOpen,
    send: seasideSend,
  },
  atelier: {
    key: 'atelier',
    letterStyle: 'fold',
    revealMode: 'curtain',
    ambience: 'room',
    vignettes: ['typewriter', 'candle', 'ink', 'teacup', 'clock', 'plane'],
    quotes: [
      'Pull up a chair. The tea is still warm.',
      'The best letters are written slowly.',
      'Morning light, fresh ink, an open window.',
      'Someone saved their kindest words for you.',
      'Let the curtains breathe for a moment.',
    ],
    intro: atelierIntro,
    open: atelierOpen,
    send: atelierSend,
  },
  skies: {
    key: 'skies',
    letterStyle: 'scroll',
    revealMode: 'clouds',
    ambience: 'sky',
    vignettes: ['balloon', 'clouds', 'hotair', 'plane', 'kite', 'sunrise'],
    quotes: [
      'Hold on — we are going up.',
      'Some words deserve to float.',
      'Above the clouds, everything feels lighter.',
      'A little wind, a little wonder.',
      'Look up. Something is drifting your way.',
    ],
    intro: skiesIntro,
    open: skiesOpen,
    send: skiesSend,
  },
  lantern: {
    key: 'lantern',
    letterStyle: 'fold',
    revealMode: 'embers',
    ambience: 'night',
    vignettes: ['lantern', 'moon', 'fireflies', 'candle', 'ink', 'stamp'],
    quotes: [
      'Some wishes are carried by light.',
      'The lake keeps every lantern safe.',
      'Hush — the night is listening.',
      'A small flame, a few kind words.',
      'Let it go, and watch it rise.',
    ],
    intro: lanternIntro,
    open: lanternOpen,
    send: lanternSend,
  },
};

export function envConfig(key?: string): EnvConfig {
  return CONFIGS[(key as EnvironmentKey) ?? 'park'] ?? CONFIGS.park;
}

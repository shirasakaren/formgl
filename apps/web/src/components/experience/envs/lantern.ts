'use client';
import { anim } from '../store';
import { sfx } from '../audio';
import { ensureFx, fresh } from '../timeline';

const fx = anim.fx;
/**
 * drift  – the lantern is drawn in across the water to the jetty (0 → 1)
 * lid    – its two paper flaps fold open (0 → 1)
 * glow   – the candle flares up a little (0..1)
 */
const KEYS = ['drift', 'lid', 'glow'];

export function lanternIntro(reduced: boolean, onDone?: () => void) {
  ensureFx(KEYS);
  const tl = fresh(reduced ? 4 : 1);
  anim.intro = 1;
  Object.assign(fx, { drift: 0, lid: 0, glow: 0 });
  // from far out over the lake, drift back to the end of the jetty
  tl.to(anim, { intro: 0, duration: 5.0, ease: 'power3.inOut' });
  tl.to(fx, { glow: 0.6, duration: 1.2, ease: 'power2.out' }, 2.6);
  tl.to(fx, { glow: 0, duration: 1.6, ease: 'power1.inOut' }, 3.8);
  if (onDone) tl.call(onDone, [], 3.8);
  return tl;
}

/** the lantern floats to the jetty, its lid opens and the folded letter rises out of the light */
export function lanternOpen(reduced: boolean, onLetterReady: () => void) {
  ensureFx(KEYS);
  const tl = fresh(reduced ? 3 : 1);
  anim.intro = 0;
  Object.assign(fx, { drift: 0, lid: 0, glow: 0 });
  tl.call(() => sfx.tap(), [], 0);
  tl.to(fx, { drift: 1, duration: 1.7, ease: 'power2.inOut' }, 0);
  tl.to(anim, { cam: 1, duration: 1.7, ease: 'power2.inOut' }, 0);
  tl.to(fx, { glow: 1, duration: 0.8, ease: 'power2.out' }, 1.0);
  tl.to(fx, { lid: 1, duration: 1.0, ease: 'power2.inOut' }, 1.3);
  tl.call(() => sfx.flap(), [], 1.35);
  tl.to(anim, { slide: 1, duration: 1.1, ease: 'power2.inOut' }, 1.9);
  tl.call(() => sfx.slide(), [], 1.9);
  tl.to(fx, { glow: 0.3, duration: 1.4, ease: 'power1.inOut' }, 2.6);
  tl.to(anim, { rise: 1, duration: 1.4, ease: 'power2.inOut' }, 2.7);
  tl.to(anim, { cam: 2, duration: 1.5, ease: 'power2.inOut' }, 2.7);
  tl.to(anim, { focusLetter: 1, duration: 1.6, ease: 'power1.inOut' }, 2.7);
  tl.to(anim, { unfold: 1, duration: 1.0, ease: 'power2.out' }, 3.8);
  tl.call(() => sfx.unfold(), [], 3.8);
  tl.to(anim, { align: 1, duration: 0.8, ease: 'power2.inOut' }, 4.7);
  tl.call(onLetterReady, [], 5.4);
  return tl;
}

/** the reply is folded back into the lantern, the lid closes, and it rises into the night with the others */
export function lanternSend(reduced: boolean, onSent: () => void) {
  ensureFx(KEYS);
  const tl = fresh(reduced ? 3 : 1);
  anim.letterVisible = 1;
  tl.to(anim, { align: 0, duration: 0.7, ease: 'power2.inOut' }, 0.1);
  tl.to(anim, { unfold: 0, duration: 0.9, ease: 'power2.inOut' }, 0.6);
  tl.call(() => sfx.unfold(), [], 0.6);
  tl.to(anim, { rise: 0, duration: 1.4, ease: 'power2.inOut' }, 1.4);
  tl.to(anim, { cam: 1, duration: 1.6, ease: 'power2.inOut' }, 1.4);
  tl.to(anim, { focusLetter: 0, duration: 1.2 }, 1.4);
  tl.to(anim, { slide: 0, duration: 0.9, ease: 'power2.inOut' }, 2.7);
  tl.call(() => sfx.slide(), [], 2.7);
  tl.to(fx, { lid: 0, duration: 0.8, ease: 'power2.inOut' }, 3.5);
  tl.call(() => sfx.flap(), [], 3.55);
  // the candle breathes in, and the lantern lets go of the water
  tl.to(fx, { glow: 1, duration: 0.6, ease: 'power2.out' }, 4.2);
  tl.to(anim, { flyAway: 1, duration: 5.0, ease: 'power1.in' }, 4.5);
  tl.call(() => sfx.release(), [], 4.55);
  tl.call(() => sfx.chime(), [], 5.6);
  tl.call(onSent, [], 7.6);
  return tl;
}

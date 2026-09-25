'use client';
import { anim } from '../store';
import { sfx } from '../audio';
import { ensureFx, fresh } from '../timeline';

const fx = anim.fx;
const KEYS = ['gust', 'ribbon', 'flower', 'plane'];

export function atelierIntro(reduced: boolean, onDone?: () => void) {
  ensureFx(KEYS);
  const tl = fresh(reduced ? 4 : 1);
  anim.intro = 1;
  tl.to(anim, { intro: 0, duration: 4.4, ease: 'power3.inOut' });
  // a breath of wind through the window as we arrive
  tl.to(fx, { gust: 1, duration: 1.6, ease: 'power2.out' }, 0.6);
  tl.to(fx, { gust: 0, duration: 2.6, ease: 'power1.inOut' }, 2.2);
  if (onDone) tl.call(onDone, [], 3.4);
  return tl;
}

/** the silk bow unties, the pressed flower drifts aside, the letter lifts and opens */
export function atelierOpen(reduced: boolean, onLetterReady: () => void) {
  ensureFx(KEYS);
  const tl = fresh(reduced ? 3 : 1);
  anim.intro = 0;
  Object.assign(fx, { ribbon: 0, flower: 0, plane: 0 });
  tl.call(() => sfx.tap(), [], 0);
  tl.to(fx, { gust: 1, duration: 1.1, ease: 'power2.out' }, 0);
  tl.to(fx, { gust: 0, duration: 2.4, ease: 'power1.inOut' }, 1.1);
  tl.call(() => sfx.gust(), [], 0.05);
  tl.to(anim, { cam: 1, duration: 1.5, ease: 'power2.inOut' }, 0);
  tl.to(fx, { ribbon: 1, duration: 1.4, ease: 'power1.inOut' }, 0.35);
  tl.call(() => sfx.ribbon(), [], 0.4);
  tl.call(() => sfx.ribbon(), [], 1.0);
  tl.to(fx, { flower: 1, duration: 1.5, ease: 'power1.inOut' }, 0.8);
  tl.to(anim, { slide: 1, duration: 1.0, ease: 'power2.inOut' }, 1.6);
  tl.call(() => sfx.slide(), [], 1.6);
  tl.to(anim, { rise: 1, duration: 1.4, ease: 'power2.inOut' }, 2.4);
  tl.to(anim, { cam: 2, duration: 1.5, ease: 'power2.inOut' }, 2.4);
  tl.to(anim, { focusLetter: 1, duration: 1.6, ease: 'power1.inOut' }, 2.4);
  tl.to(anim, { unfold: 1, duration: 0.95, ease: 'power2.out' }, 3.5);
  tl.call(() => sfx.unfold(), [], 3.5);
  tl.to(anim, { align: 1, duration: 0.8, ease: 'power2.inOut' }, 4.45);
  tl.call(onLetterReady, [], 5.1);
  return tl;
}

/** the letter folds itself into a paper plane and glides out of the open window */
export function atelierSend(reduced: boolean, onSent: () => void) {
  ensureFx(KEYS);
  const tl = fresh(reduced ? 3 : 1);
  anim.letterVisible = 1;
  tl.to(anim, { align: 0, duration: 0.7, ease: 'power2.inOut' }, 0.1);
  tl.to(anim, { unfold: 0, duration: 0.8, ease: 'power2.inOut' }, 0.7);
  tl.call(() => sfx.unfold(), [], 0.7);
  // the folded sheet is handed to the paper plane, which folds itself
  tl.set(anim, { letterVisible: 0 }, 1.5);
  tl.to(fx, { plane: 1, duration: 1.0, ease: 'power2.inOut' }, 1.5);
  tl.call(() => sfx.page(), [], 1.5);
  tl.to(anim, { focusLetter: 0, duration: 1.2 }, 1.8);
  tl.to(anim, { flyAway: 1, duration: 3.4, ease: 'power1.inOut' }, 2.4);
  tl.call(() => sfx.whoosh(), [], 2.5);
  tl.to(fx, { gust: 1, duration: 1.2, ease: 'power2.out' }, 3.4);
  tl.to(fx, { gust: 0, duration: 2.4, ease: 'power1.inOut' }, 4.6);
  tl.call(() => sfx.gust(), [], 3.4);
  tl.call(onSent, [], 5.6);
  return tl;
}

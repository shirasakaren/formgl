'use client';
import { anim } from '../store';
import { sfx } from '../audio';
import { ensureFx, fresh } from '../timeline';

const fx = anim.fx;

export function seasideIntro(reduced: boolean, onDone?: () => void) {
  const tl = fresh(reduced ? 4 : 1);
  anim.intro = 1;
  tl.to(anim, { intro: 0, duration: 4.6, ease: 'power3.inOut' });
  if (onDone) tl.call(onDone, [], 3.6);
  return tl;
}

/** a wave washes in, the bottle is lifted, the cork twists & pops, the scroll slides out and unrolls */
export function seasideOpen(reduced: boolean, onLetterReady: () => void) {
  const tl = fresh(reduced ? 3 : 1);
  anim.intro = 0;
  ensureFx(['wave', 'cork', 'ribbon']);
  Object.assign(fx, { wave: 0, cork: 0, ribbon: 0 });
  tl.call(() => sfx.tap(), [], 0);
  tl.to(fx, { wave: 1, duration: 1.0, ease: 'power2.out' }, 0);
  tl.to(fx, { wave: 0, duration: 1.8, ease: 'power1.inOut' }, 1.0);
  tl.call(() => sfx.splash(), [], 0.15);
  tl.to(anim, { cam: 1, duration: 1.6, ease: 'power2.inOut' }, 0.1);
  tl.to(anim, { lift: 1, duration: 1.3, ease: 'power3.out' }, 0.9);
  tl.to(fx, { cork: 0.6, duration: 0.9, ease: 'power1.inOut' }, 1.9);
  tl.call(() => sfx.ribbon(), [], 1.95);
  tl.to(fx, { cork: 1, duration: 0.9, ease: 'power2.out' }, 2.8);
  tl.call(() => sfx.pop(), [], 2.82);
  tl.to(anim, { slide: 1, duration: 1.1, ease: 'power1.inOut' }, 3.1);
  tl.call(() => {
    sfx.clink();
    sfx.slide();
  }, [], 3.1);
  tl.to(anim, { rise: 1, duration: 1.4, ease: 'power2.inOut' }, 4.0);
  tl.to(anim, { cam: 2, duration: 1.5, ease: 'power2.inOut' }, 4.0);
  tl.to(anim, { settle: 1, duration: 1.5, ease: 'power2.inOut' }, 4.2);
  tl.to(anim, { focusLetter: 1, duration: 1.6, ease: 'power1.inOut' }, 4.2);
  tl.to(fx, { ribbon: 1, duration: 0.6, ease: 'power2.in' }, 5.0);
  tl.call(() => sfx.ribbon(), [], 5.0);
  tl.to(anim, { unfold: 1, duration: 1.1, ease: 'power2.out' }, 5.45);
  tl.call(() => sfx.unfold(), [], 5.45);
  tl.to(anim, { align: 1, duration: 0.8, ease: 'power2.inOut' }, 6.5);
  tl.call(onLetterReady, [], 7.15);
  return tl;
}

/** roll it up, back into the bottle, cork it, and let the sea carry it off */
export function seasideSend(reduced: boolean, onSent: () => void) {
  ensureFx(['wave', 'cork', 'ribbon']);
  const tl = fresh(reduced ? 3 : 1);
  anim.letterVisible = 1;
  tl.to(anim, { align: 0, duration: 0.7, ease: 'power2.inOut' }, 0.1);
  tl.to(anim, { unfold: 0, duration: 1.0, ease: 'power2.inOut' }, 0.7);
  tl.call(() => sfx.unfold(), [], 0.7);
  tl.to(fx, { ribbon: 0, duration: 0.5, ease: 'power2.out' }, 1.65);
  tl.call(() => sfx.ribbon(), [], 1.65);
  tl.to(anim, { rise: 0, duration: 1.4, ease: 'power2.inOut' }, 2.1);
  tl.to(anim, { cam: 1, duration: 1.5, ease: 'power2.inOut' }, 2.1);
  tl.to(anim, { settle: 0, duration: 1.3, ease: 'power2.inOut' }, 2.1);
  tl.to(anim, { focusLetter: 0, duration: 1.2 }, 2.1);
  tl.to(anim, { slide: 0, duration: 1.0, ease: 'power2.inOut' }, 3.4);
  tl.call(() => sfx.slide(), [], 3.4);
  tl.to(fx, { cork: 0.6, duration: 0.8, ease: 'power2.inOut' }, 4.3);
  tl.to(fx, { cork: 0, duration: 0.45, ease: 'power2.in' }, 5.1);
  tl.call(() => sfx.stamp(), [], 5.5);
  tl.to(anim, { cam: 0.5, duration: 1.2, ease: 'power2.inOut' }, 5.6);
  tl.to(anim, { flyAway: 1, duration: 4.2, ease: 'power1.inOut' }, 5.8);
  tl.call(() => sfx.splash(), [], 6.4);
  tl.call(onSent, [], 8.6);
  return tl;
}

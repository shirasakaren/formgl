'use client';
import { anim } from '../store';
import { sfx } from '../audio';
import { ensureFx, fresh } from '../timeline';

const fx = anim.fx;
/**
 * drift   – the balloon bunch floats over to the basket (0 → 1)
 * release – its balloons are let go and rise away (0 → 1)
 * ribbon  – the ribbon slips off the scroll (Letter3D)
 * inflate – a fresh balloon blows up for the reply (0 → 1)
 * burner  – our own burner roars (0..1, pulses)
 */
const KEYS = ['drift', 'release', 'ribbon', 'inflate', 'burner'];

function burn(tl: gsap.core.Timeline, at: number, dur = 1.4) {
  tl.call(() => sfx.burner(), [], at);
  tl.to(fx, { burner: 1, duration: 0.25, ease: 'power2.out' }, at);
  tl.to(fx, { burner: 0, duration: 0.6, ease: 'power1.in' }, at + dur);
}

export function skiesIntro(reduced: boolean, onDone?: () => void) {
  ensureFx(KEYS);
  const tl = fresh(reduced ? 4 : 1);
  anim.intro = 1;
  // we glide in from beside our balloon and settle into the basket
  tl.to(anim, { intro: 0, duration: 4.8, ease: 'power3.inOut' });
  burn(tl, 0.9, 1.6);
  if (onDone) tl.call(onDone, [], 3.6);
  return tl;
}

/** the balloons drift over, we catch the string, let them go, and the scroll unrolls */
export function skiesOpen(reduced: boolean, onLetterReady: () => void) {
  ensureFx(KEYS);
  const tl = fresh(reduced ? 3 : 1);
  anim.intro = 0;
  Object.assign(fx, { drift: 0, release: 0, ribbon: 0, inflate: 0 });
  tl.call(() => sfx.tap(), [], 0);
  tl.to(fx, { drift: 1, duration: 1.5, ease: 'power2.inOut' }, 0);
  tl.to(anim, { cam: 1, duration: 1.6, ease: 'power2.inOut' }, 0);
  tl.call(() => sfx.squeak(), [], 1.1);
  tl.to(fx, { release: 1, duration: 3.2, ease: 'power1.in' }, 1.35);
  tl.call(() => sfx.release(), [], 1.4);
  tl.to(fx, { ribbon: 1, duration: 1.0, ease: 'power1.inOut' }, 2.1);
  tl.call(() => sfx.ribbon(), [], 2.15);
  tl.to(anim, { rise: 1, duration: 1.4, ease: 'power2.inOut' }, 2.5);
  tl.to(anim, { cam: 2, duration: 1.5, ease: 'power2.inOut' }, 2.5);
  tl.to(anim, { focusLetter: 1, duration: 1.6, ease: 'power1.inOut' }, 2.5);
  tl.to(anim, { unfold: 1, duration: 1.1, ease: 'power2.out' }, 3.55);
  tl.call(() => sfx.unfold(), [], 3.55);
  tl.to(anim, { align: 1, duration: 0.8, ease: 'power2.inOut' }, 4.6);
  tl.call(onLetterReady, [], 5.3);
  return tl;
}

/** the reply is rolled and tied, a new balloon blows up and carries it into the sky */
export function skiesSend(reduced: boolean, onSent: () => void) {
  ensureFx(KEYS);
  const tl = fresh(reduced ? 3 : 1);
  anim.letterVisible = 1;
  fx.inflate = 0;
  tl.to(anim, { align: 0, duration: 0.7, ease: 'power2.inOut' }, 0.1);
  tl.to(anim, { unfold: 0, duration: 1.0, ease: 'power2.inOut' }, 0.6);
  tl.call(() => sfx.unfold(), [], 0.6);
  tl.to(fx, { ribbon: 0, duration: 0.6, ease: 'power1.inOut' }, 1.5);
  tl.call(() => sfx.ribbon(), [], 1.5);
  tl.to(fx, { inflate: 1, duration: 1.3, ease: 'back.out(1.6)' }, 1.9);
  tl.call(() => sfx.squeak(), [], 1.95);
  tl.call(() => sfx.squeak(), [], 2.4);
  // hand it out over the rim…
  tl.to(anim, { rise: 0, duration: 1.6, ease: 'power1.inOut' }, 2.8);
  tl.to(anim, { cam: 1, duration: 1.8, ease: 'power2.inOut' }, 2.8);
  tl.to(anim, { focusLetter: 0, duration: 1.2 }, 2.8);
  // …and let go
  tl.to(anim, { flyAway: 1, duration: 4.4, ease: 'power1.in' }, 4.2);
  tl.call(() => sfx.release(), [], 4.25);
  burn(tl, 5.4, 1.5);
  tl.call(onSent, [], 7.4);
  return tl;
}

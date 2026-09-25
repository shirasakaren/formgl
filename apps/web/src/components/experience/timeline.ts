'use client';
import gsap from 'gsap';
import { anim } from './store';
import { sfx } from './audio';

let current: gsap.core.Timeline | null = null;

// QA mode (?fgl=…): keep real time even when frames are very slow (software GL)
if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('fgl')) gsap.ticker.lagSmoothing(0);

function fresh(speed = 1) {
  current?.kill();
  current = gsap.timeline({ defaults: { overwrite: 'auto' } });
  current.timeScale(speed);
  if (typeof window !== 'undefined') (window as unknown as { __fglTl?: gsap.core.Timeline }).__fglTl = current;
  return current;
}

/** After the dandelion reveal: glide from the wide park shot to the envelope. */
export function playIntro(reduced: boolean, onDone?: () => void) {
  const tl = fresh(reduced ? 4 : 1);
  anim.intro = 1;
  tl.to(anim, { intro: 0, duration: 4.2, ease: 'power3.inOut' });
  if (onDone) tl.call(onDone, [], 3.2);
  return tl;
}

/** The envelope opening choreography. */
export function playOpen(reduced: boolean, onLetterReady: () => void) {
  const tl = fresh(reduced ? 3 : 1);
  anim.intro = 0;
  tl.call(() => sfx.tap(), [], 0);
  tl.to(anim, { cam: 1, duration: 1.4, ease: 'power2.inOut' }, 0);
  tl.to(anim, { lift: 1, duration: 1.2, ease: 'power3.out' }, 0.1);
  // the seal trembles… then cracks
  tl.to(anim, { crack: 1, duration: 0.7, ease: 'none' }, 0.9);
  tl.call(() => sfx.crack(), [], 0.9 + 0.42);
  // flap lifts and curls over
  tl.to(anim, { flap: 1, duration: 1.15, ease: 'power2.inOut' }, 1.6);
  tl.call(() => sfx.flap(), [], 1.6);
  // the letter slides out
  tl.to(anim, { slide: 1, duration: 1.0, ease: 'power1.inOut' }, 2.5);
  tl.call(() => sfx.slide(), [], 2.5);
  // …floats up toward us while the envelope settles back onto the bench
  tl.to(anim, { rise: 1, duration: 1.4, ease: 'power2.inOut' }, 3.3);
  tl.to(anim, { cam: 2, duration: 1.5, ease: 'power2.inOut' }, 3.3);
  tl.to(anim, { settle: 1, duration: 1.4, ease: 'power2.inOut' }, 3.5);
  tl.to(anim, { focusLetter: 1, duration: 1.6, ease: 'power1.inOut' }, 3.5);
  // unfold in the light, then bring it close to read
  tl.to(anim, { unfold: 1, duration: 0.95, ease: 'power2.out' }, 4.55);
  tl.call(() => sfx.unfold(), [], 4.55);
  tl.to(anim, { align: 1, duration: 0.8, ease: 'power2.inOut' }, 5.5);
  tl.call(onLetterReady, [], 6.15);
  return tl;
}

/** Fold the letter back into the envelope, re-seal it and send it off. */
export function playSend(reduced: boolean, onSent: () => void) {
  const tl = fresh(reduced ? 3 : 1);
  anim.letterVisible = 1;
  tl.to(anim, { align: 0, duration: 0.7, ease: 'power2.inOut' }, 0.1);
  tl.to(anim, { unfold: 0, duration: 0.8, ease: 'power2.inOut' }, 0.7);
  tl.call(() => sfx.unfold(), [], 0.7);
  tl.to(anim, { rise: 0, duration: 1.4, ease: 'power2.inOut' }, 1.4);
  tl.to(anim, { cam: 1, duration: 1.5, ease: 'power2.inOut' }, 1.4);
  tl.to(anim, { settle: 0, duration: 1.2, ease: 'power2.inOut' }, 1.4);
  tl.to(anim, { focusLetter: 0, duration: 1.2 }, 1.4);
  tl.to(anim, { slide: 0, duration: 0.9, ease: 'power2.inOut' }, 2.7);
  tl.call(() => sfx.slide(), [], 2.7);
  tl.to(anim, { flap: 0, duration: 0.95, ease: 'power2.inOut' }, 3.5);
  tl.call(() => sfx.flap(), [], 3.5);
  tl.set(anim, { crack: 0 }, 4.4);
  tl.to(anim, { stamp: 1, duration: 0.9, ease: 'none' }, 4.4);
  tl.call(() => sfx.stamp(), [], 4.4 + 0.52);
  tl.to(anim, { cam: 0.6, duration: 1.0, ease: 'power2.inOut' }, 5.0);
  tl.to(anim, { flyAway: 1, duration: 2.4, ease: 'power2.in' }, 5.5);
  tl.call(() => sfx.whoosh(), [], 5.55);
  tl.call(onSent, [], 7.0);
  return tl;
}

export function killTimeline() {
  current?.kill();
  current = null;
}

'use client';
import { useEffect, useRef, useState } from 'react';
import { anim, useExperience } from './store';
import { sceneRefs } from './scene/refs';

/** Floating DOM hint pinned to the wax seal. It's also the accessible button. */
export function EnvelopeHint({ onOpen }: { onOpen: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const form = useExperience((s) => s.form)!;
  const phase = useExperience((s) => s.phase);
  const preview = useExperience((s) => s.preview);
  const [show, setShow] = useState(false);
  const available = form.availability === 'open' || preview;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = ref.current;
      const h = sceneRefs.hint;
      if (el) el.dataset.settled = anim.intro < 0.04 && h.visible ? '1' : '0';
      if (el && h.visible) {
        el.style.transform = `translate3d(${h.x}px, ${h.y}px, 0)`;
        el.style.setProperty("--r", `${Math.max(30, Math.min(60, h.r * 0.24))}px`);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // wait for the camera glide to settle before inviting a tap
    const t = setTimeout(() => setShow(true), 200);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [phase]);

  const message =
    form.availability === 'closed'
      ? form.settings.closedMessage || 'This letter is no longer accepting replies.'
      : form.availability === 'not_yet'
        ? 'This letter can’t be opened just yet.'
        : form.availability === 'limit'
          ? 'This letter has received all the replies it can hold.'
          : null;

  return (
    <button
      ref={ref}
      type="button"
      className={`fgl-hint${show ? ' is-visible' : ''}${available ? '' : ' is-locked'}`}
      onClick={available ? onOpen : undefined}
      aria-label={available ? `Open the letter: ${form.title}` : message ?? form.title}
      aria-disabled={!available}
    >
      <span className="fgl-hint-ring" aria-hidden />
      <span className="fgl-hint-ring two" aria-hidden />
      <span className="fgl-hint-label">
        {available ? form.theme.openHint || 'Tap to open' : message}
      </span>
    </button>
  );
}

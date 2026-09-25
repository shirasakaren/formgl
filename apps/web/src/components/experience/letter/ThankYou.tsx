'use client';
import { useEffect, useMemo, useRef } from 'react';
import { FONT_FAMILIES } from '@formgl/shared';
import { useExperience } from '../store';
import { Rich } from '../fields/common';

export function ThankYou() {
  const form = useExperience((s) => s.form)!;
  const reduced = useExperience((s) => s.reducedMotion);
  const ref = useRef<HTMLHeadingElement>(null);
  const s = form.settings;
  const t = form.theme;
  useEffect(() => {
    ref.current?.focus();
    if (s.redirectUrl && /^https?:\/\//i.test(s.redirectUrl)) {
      const tm = setTimeout(() => {
        window.location.href = s.redirectUrl!;
      }, 4500);
      return () => clearTimeout(tm);
    }
  }, [s.redirectUrl]);
  const bits = useMemo(
    () =>
      Array.from({ length: s.confetti && !reduced ? 36 : 0 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 2.5,
        dur: 5 + Math.random() * 5,
        size: 8 + Math.random() * 12,
        kind: i % 3,
        rot: Math.random() * 360,
      })),
    [s.confetti, reduced],
  );
  return (
    <section className="fgl-thanks" aria-live="polite" style={{ ['--fgl-ink' as string]: t.inkColor, ['--fgl-accent' as string]: t.accentColor, ['--fgl-font-title' as string]: FONT_FAMILIES[t.titleFont]?.css, ['--fgl-font-body' as string]: FONT_FAMILIES[t.bodyFont]?.css }}>
      <div className="fgl-thanks-bits" aria-hidden>
        {bits.map((b, i) => (
          <span key={i} className={`bit k${b.kind}`} style={{ left: `${b.left}%`, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`, width: b.size, height: b.size, ['--rot' as string]: `${b.rot}deg` }} />
        ))}
      </div>
      <div className="fgl-thanks-card">
        <svg className="fgl-thanks-seal" viewBox="0 0 64 64" aria-hidden>
          <path d="M32 6c9 0 14 3 18 8s8 10 8 18-3 14-8 18-10 8-18 8-14-3-18-8-8-10-8-18 3-14 8-18S23 6 32 6z" fill={t.sealColor} />
          <circle cx="32" cy="32" r="17" fill="none" stroke="#000" strokeOpacity="0.2" strokeWidth="2" />
          <path d="M23 33l6 6 12-14" fill="none" stroke="#fff" strokeOpacity="0.85" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h2 ref={ref} tabIndex={-1} className="fgl-thanks-title">
          {s.thankYouHeading || 'Thank you'}
        </h2>
        <Rich html={s.thankYouHtml} className="fgl-thanks-body" />
        {s.redirectUrl && <p className="fgl-hint-text">Taking you onward in a moment…</p>}
      </div>
    </section>
  );
}

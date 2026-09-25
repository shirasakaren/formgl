'use client';
import { useExperience } from './store';
import { FONT_FAMILIES } from '@formgl/shared';

/** 2D illustrated envelope for devices without WebGL. */
export function Fallback({ onOpen }: { onOpen: () => void }) {
  const form = useExperience((s) => s.form)!;
  const phase = useExperience((s) => s.phase);
  const t = form.theme;
  const titleFont = FONT_FAMILIES[t.titleFont]?.css;
  return (
    <div className="fgl-fallback" style={{ ['--env' as string]: t.envelopeColor, ['--seal' as string]: t.sealColor, ['--ink' as string]: t.inkColor }}>
      <div className="fgl-fallback-light" aria-hidden />
      {(phase === 'idle' || phase === 'revealing' || phase === 'loading') && (
        <button type="button" className="fgl-fallback-env" onClick={onOpen} aria-label={`Open the letter: ${form.title}`}>
          <span className="flap" aria-hidden />
          <span className="seal" aria-hidden>
            {t.logoUrl ? <img src={t.logoUrl} alt="" /> : (t.sealMonogram || form.title[0] || 'F').toUpperCase()}
          </span>
          <span className="title" style={{ fontFamily: titleFont }}>{t.envelopeTitle || form.title}</span>
          {t.envelopeSubtitle && <span className="subtitle">{t.envelopeSubtitle}</span>}
          <span className="hint">{t.openHint || 'Tap to open'}</span>
        </button>
      )}
    </div>
  );
}

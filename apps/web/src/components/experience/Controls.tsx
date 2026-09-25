'use client';
import { Volume2, VolumeX } from 'lucide-react';
import { useExperience } from './store';
import { sfx } from './audio';

export function Controls() {
  const soundOn = useExperience((s) => s.soundOn);
  const set = useExperience((s) => s.set);
  const phase = useExperience((s) => s.phase);
  const form = useExperience((s) => s.form);
  if (phase === 'loading' || !form) return null;
  const toggle = () => {
    const next = !soundOn;
    set({ soundOn: next });
    sfx.setEnabled(next);
    if (next) sfx.startAmbience({ wind: form.theme.wind, musicUrl: form.theme.musicUrl });
    try {
      window.localStorage.setItem('fgl_sound', next ? '1' : '0');
    } catch {
      /* noop */
    }
  };
  return (
    <div className="fgl-controls">
      <button type="button" className="fgl-icon-btn" onClick={toggle} aria-pressed={soundOn} aria-label={soundOn ? 'Mute ambient sound' : 'Turn on ambient sound'}>
        {soundOn ? <Volume2 size={18} strokeWidth={1.6} /> : <VolumeX size={18} strokeWidth={1.6} />}
      </button>
      {!form.settings.hideBranding && (
        <a className="fgl-brand" href="/" aria-label="Made with FormGL">
          FormGL
        </a>
      )}
    </div>
  );
}

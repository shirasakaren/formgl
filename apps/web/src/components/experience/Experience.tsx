'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { paginate, type PublicForm } from '@formgl/shared';
import { anim, resetAnim, useExperience, type Quality } from './store';
import { Loader } from './loader/Loader';
import { DandelionReveal } from './loader/DandelionReveal';
import { EnvelopeHint } from './EnvelopeHint';
import { Controls } from './Controls';
import { LetterOverlay } from './letter/LetterOverlay';
import { ThankYou } from './letter/ThankYou';
import { Fallback } from './Fallback';
import { playIntro, playOpen, playSend, killTimeline } from './timeline';
import { sfx } from './audio';
import { progressStore, track } from '@/lib/public/client';
import './experience.css';

const SceneRoot = dynamic(() => import('./scene/SceneRoot'), { ssr: false });

function detectQuality(): Quality {
  try {
    const q = new URLSearchParams(window.location.search).get('quality');
    if (q === 'low' || q === 'medium' || q === 'high') return q;
    const nav = navigator as Navigator & { deviceMemory?: number };
    const mem = nav.deviceMemory ?? 8;
    const cores = nav.hardwareConcurrency ?? 8;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || coarse;
    const small = Math.min(window.innerWidth, window.innerHeight) < 700;
    if (mobile || small) return mem >= 6 && cores >= 6 ? 'medium' : 'low';
    if (cores >= 8 && mem >= 8) return 'high';
    return 'medium';
  } catch {
    return 'medium';
  }
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function Experience({ form, demo = false, preview = false }: { form: PublicForm; demo?: boolean; preview?: boolean }) {
  const set = useExperience((s) => s.set);
  const phase = useExperience((s) => s.phase);
  const webgl = useExperience((s) => s.webgl);
  const reduced = useExperience((s) => s.reducedMotion);
  const [mounted, setMounted] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [minTimeDone, setMinTimeDone] = useState(false);
  const [revealRun, setRevealRun] = useState(false);
  const [revealDone, setRevealDone] = useState(false);
  const opened = useRef(false);
  const startTime = useRef(0);

  /* ── boot ── */
  useEffect(() => {
    resetAnim();
    const params = new URLSearchParams(window.location.search);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches || params.get('motion') === 'reduced';
    let soundOn = form.theme.ambientSound;
    try {
      const saved = window.localStorage.getItem('fgl_sound');
      if (saved != null) soundOn = saved === '1';
    } catch {
      /* noop */
    }
    // hidden fields from the URL + saved progress
    const answers: Record<string, string> = {};
    for (const f of form.fields) {
      if (f.type === 'hidden') {
        const key = f.config?.param || f.id;
        const v = params.get(key);
        if (v) answers[f.id] = v.slice(0, 500);
      }
    }
    const saved = form.settings.allowSaveProgress && !demo ? progressStore.load(form.slug) : null;
    sfx.setEnabled(soundOn);
    set({
      form,
      demo,
      preview,
      phase: 'loading',
      progress: 0.03,
      progressLabel: 'Gathering sunlight',
      quality: detectQuality(),
      reducedMotion,
      webgl: hasWebGL(),
      soundOn,
      page: saved?.page ?? 0,
      answers: { ...(saved?.answers ?? {}), ...answers },
      startedAt: 0,
    });
    setMounted(true);
    startTime.current = Date.now();
    track(form.slug, 'view', {}, demo || preview);
    const minT = setTimeout(() => setMinTimeDone(true), reducedMotion ? 600 : 2200);
    return () => {
      clearTimeout(minT);
      killTimeline();
    };
  }, [form, demo, preview, set]);

  /* ── pointer parallax ── */
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      anim.px = (e.clientX / window.innerWidth) * 2 - 1;
      anim.py = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      anim.px = Math.max(-1, Math.min(1, e.gamma / 25));
      anim.py = Math.max(-1, Math.min(1, (e.beta - 45) / 25));
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('deviceorientation', onOrient, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('deviceorientation', onOrient);
    };
  }, []);

  /* ── first gesture starts audio ── */
  useEffect(() => {
    const start = () => {
      sfx.startAmbience({ wind: form.theme.wind, musicUrl: form.theme.musicUrl });
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    };
    window.addEventListener('pointerdown', start);
    window.addEventListener('keydown', start);
    return () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
      sfx.stop();
    };
  }, [form.theme.wind, form.theme.musicUrl]);

  /* ── loading → reveal ── */
  const onSceneReady = useCallback(() => {
    set({ progress: 1, progressLabel: 'Here it is' });
    setSceneReady(true);
  }, [set]);

  useEffect(() => {
    if (!webgl && mounted) {
      // no WebGL: skip straight to the 2D fallback
      set({ progress: 1 });
      setSceneReady(true);
    }
  }, [webgl, mounted, set]);

  // dev / QA helper: ?fgl=idle skips the intro, ?fgl=open opens the envelope
  const debug = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('fgl') : null;
  useEffect(() => {
    if (!debug || !sceneReady || phase !== 'loading') return;
    anim.intro = 0;
    setRevealRun(true);
    setRevealDone(true);
    set({ phase: 'idle' });
    if (debug === 'open' || debug === 'letter') setTimeout(() => open(), 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debug, sceneReady, phase]);

  useEffect(() => {
    if (debug) return;
    if (sceneReady && minTimeDone && phase === 'loading') {
      track(form.slug, 'loaded', {}, demo || preview);
      const t = setTimeout(() => {
        set({ phase: 'revealing' });
        setRevealRun(true);
        if (webgl) playIntro(reduced);
      }, 350);
      return () => clearTimeout(t);
    }
  }, [sceneReady, minTimeDone, phase, set, webgl, reduced, form.slug, demo, preview]);

  const onRevealDone = useCallback(() => {
    setRevealDone(true);
    const s = useExperience.getState();
    if (s.phase === 'revealing') set({ phase: 'idle' });
  }, [set]);

  /* ── open the envelope ── */
  const open = useCallback(() => {
    const s = useExperience.getState();
    if (opened.current || (s.phase !== 'idle' && s.phase !== 'revealing')) return;
    if (s.form?.availability !== 'open' && !s.preview) return;
    opened.current = true;
    sfx.startAmbience({ wind: form.theme.wind, musicUrl: form.theme.musicUrl });
    set({ phase: 'opening' });
    track(form.slug, 'open', {}, demo || preview);
    if (!s.webgl) {
      set({ phase: 'reading' });
      return;
    }
    playOpen(s.reducedMotion, () => set({ phase: 'reading' }));
  }, [set, form, demo, preview]);

  /* ── send ── */
  const onSubmitted = useCallback(() => {
    const s = useExperience.getState();
    progressStore.clear(form.slug);
    progressStore.markSubmitted(form.slug);
    set({ phase: 'sending' });
    if (!s.webgl) {
      setTimeout(() => set({ phase: 'sent' }), 900);
      return;
    }
    playSend(s.reducedMotion, () => {
      set({ phase: 'sent' });
      sfx.chime();
    });
  }, [set, form.slug]);

  /* ── abandon tracking ── */
  useEffect(() => {
    const onHide = () => {
      const s = useExperience.getState();
      if (s.startedAt && s.phase !== 'sent' && s.phase !== 'sending') track(form.slug, 'abandon', { page: s.page + 1 }, demo || preview);
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [form.slug, demo, preview]);

  const pages = paginate(form.fields, form.settings.fieldsPerPage);
  const showLetter = phase === 'opening' || phase === 'reading' || phase === 'sending';

  return (
    <main className="fgl-root" data-phase={phase} style={{ ['--fgl-loader' as string]: form.theme.loaderColor }}>
      <a href="#fgl-letter" className="fgl-skip" onClick={(e) => { e.preventDefault(); open(); }}>
        Skip to the questions
      </a>
      <h1 className="sr-only">{form.title}</h1>
      {mounted && webgl && (
        <SceneRoot onReady={onSceneReady} onOpen={open} reveal={{ run: revealRun, done: revealDone, onDone: onRevealDone, color: form.theme.loaderColor }} />
      )}
      {mounted && !webgl && <Fallback onOpen={open} />}
      {mounted && webgl && (phase === 'idle' || phase === 'revealing') && <EnvelopeHint onOpen={open} />}
      {showLetter && <LetterOverlay pages={pages} onSubmitted={onSubmitted} visible={phase !== 'opening'} />}
      {phase === 'sent' && <ThankYou />}
      <Controls />
      {!revealDone && !webgl && <DandelionReveal color={form.theme.loaderColor} run={revealRun} reduced onDone={onRevealDone} />}
      {!revealRun && <Loader hidden={false} />}
    </main>
  );
}

'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  FONT_FAMILIES,
  isFieldVisible,
  isInputField,
  toEmbedUrl,
  validateField,
  type AnswerValue,
  type LetterPage,
} from '@formgl/shared';
import { anim, useExperience } from '../store';
import { sceneRefs } from '../scene/refs';
import { Field } from '../fields/Field';
import { Rich } from '../fields/common';
import { paperCanvases } from '../scene/textures';
import { mulberry32 } from '../scene/noise';
import { sfx } from '../audio';
import { progressStore, submitAnswers, SubmitError, track } from '@/lib/public/client';

function usePaperBackground(color: string, kind: string) {
  return useMemo(() => {
    if (typeof document === 'undefined') return '';
    try {
      const { color: c } = paperCanvases(color, kind as never, 5, 384);
      return c.toDataURL('image/jpeg', 0.86);
    } catch {
      return '';
    }
  }, [color, kind]);
}

/** pre-blurred leaf shadows for the paper (animated with cheap transforms) */
function useDappleImage() {
  return useMemo(() => {
    if (typeof document === 'undefined') return '';
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d')!;
    const r = mulberry32(12);
    g.filter = 'blur(14px)';
    for (let i = 0; i < 26; i++) {
      const x = r() * 512;
      const y = r() * 512;
      const rot = r() * Math.PI;
      const col = `rgba(40,45,20,${0.35 + r() * 0.4})`;
      const rx = 26 + r() * 40;
      const ry = 10 + r() * 16;
      // wrapped copies keep the tile seamless
      for (const ox of [-512, 0, 512])
        for (const oy of [-512, 0, 512]) {
          g.save();
          g.translate(x + ox, y + oy);
          g.rotate(rot);
          g.fillStyle = col;
          g.beginPath();
          g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
          g.fill();
          g.restore();
        }
    }
    return c.toDataURL('image/png');
  }, []);
}

interface Ghost {
  page: number;
  dir: 1 | -1;
  key: number;
}

export function LetterOverlay({ pages, onSubmitted, visible }: { pages: LetterPage[]; onSubmitted: () => void; visible: boolean }) {
  const form = useExperience((s) => s.form)!;
  const demo = useExperience((s) => s.demo);
  const preview = useExperience((s) => s.preview);
  const page = useExperience((s) => s.page);
  const answers = useExperience((s) => s.answers);
  const phase = useExperience((s) => s.phase);
  const reduced = useExperience((s) => s.reducedMotion);
  const set = useExperience((s) => s.set);
  const setAnswer = useExperience((s) => s.setAnswer);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState('');
  const [shake, setShake] = useState(0);
  const [shown, setShown] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const started = useRef(!!useExperience.getState().startedAt);
  const t = form.theme;
  const s = form.settings;
  const paperBg = usePaperBackground(t.paperColor, t.paper);
  const dapple = useDappleImage();
  const total = pages.length;
  const cur = Math.min(page, total - 1);
  const isLast = cur === total - 1;
  const slug = form.slug;
  const sending = phase === 'sending';

  /* report the paper rect so the 3D letter lands exactly where the DOM paper is */
  useLayoutEffect(() => {
    const el = sheet.current;
    if (!el) return;
    const report = () => {
      const r = el.getBoundingClientRect();
      const sc = scroller.current?.scrollTop ?? 0;
      sceneRefs.letterRect = { x: r.left, y: r.top + sc, w: r.width, h: r.height, vw: window.innerWidth, vh: window.innerHeight };
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    window.addEventListener('resize', report);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', report);
    };
  }, [cur]);

  /* crossfade: DOM letter takes over from the 3D letter */
  useEffect(() => {
    if (!visible || sending) return;
    setShown(true);
    const tm = setTimeout(() => {
      anim.letterVisible = 0;
    }, reduced ? 200 : 750);
    // focus the letter for keyboard & screen reader users
    const f = setTimeout(() => headingRef.current?.focus({ preventScroll: true }), 400);
    return () => {
      clearTimeout(tm);
      clearTimeout(f);
    };
  }, [visible, sending, reduced]);

  useEffect(() => {
    if (sending) {
      anim.letterVisible = 1;
      setShown(false);
    }
  }, [sending]);

  /* save progress */
  useEffect(() => {
    if (!s.allowSaveProgress || demo || preview) return;
    const tm = setTimeout(() => progressStore.save(slug, answers, cur), 400);
    return () => clearTimeout(tm);
  }, [answers, cur, s.allowSaveProgress, demo, preview, slug]);

  const onChange = useCallback(
    (id: string, v: AnswerValue) => {
      setAnswer(id, v);
      setErrors((e) => (e[id] ? { ...e, [id]: '' } : e));
      if (!started.current) {
        started.current = true;
        track(slug, 'start', { page: cur + 1 }, demo || preview);
      }
    },
    [setAnswer, slug, cur, demo, preview],
  );

  const pageFields = pages[cur]?.fields ?? [];
  const visibleFields = pageFields.filter((f) => isFieldVisible(f, answers));

  const validatePage = (idx: number) => {
    const errs: Record<string, string> = {};
    for (const f of pages[idx]?.fields ?? []) {
      if (!isFieldVisible(f, answers)) continue;
      const e = validateField(f, answers[f.id]);
      if (e) errs[f.id] = e;
    }
    return errs;
  };

  const focusFirstError = (errs: Record<string, string>) => {
    const id = Object.keys(errs)[0];
    if (!id) return;
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-field="${id}"]`);
      el?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
      el?.querySelector<HTMLElement>('input, textarea, select, button, canvas')?.focus({ preventScroll: true });
    });
  };

  const goTo = (next: number) => {
    if (next < 0 || next >= total || next === cur) return;
    if (next > cur) {
      const errs = validatePage(cur);
      if (Object.keys(errs).length) {
        setErrors(errs);
        setShake((x) => x + 1);
        sfx.error();
        focusFirstError(errs);
        return;
      }
    }
    setErrors({});
    setBanner('');
    setGhost({ page: cur, dir: next > cur ? 1 : -1, key: Date.now() });
    set({ page: next });
    sfx.page();
    track(slug, 'page', { page: next + 1 }, demo || preview);
    scroller.current?.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    setTimeout(() => headingRef.current?.focus({ preventScroll: true }), 50);
  };

  useEffect(() => {
    if (!ghost) return;
    const tm = setTimeout(() => setGhost(null), reduced ? 250 : 1000);
    return () => clearTimeout(tm);
  }, [ghost, reduced]);

  const submit = async () => {
    // validate every page, jump to the first page with a problem
    for (let i = 0; i < total; i++) {
      const errs = validatePage(i);
      if (Object.keys(errs).length) {
        if (i !== cur) {
          setGhost({ page: cur, dir: -1, key: Date.now() });
          set({ page: i });
        }
        setErrors(errs);
        setShake((x) => x + 1);
        sfx.error();
        focusFirstError(errs);
        return;
      }
    }
    setSubmitting(true);
    setBanner('');
    try {
      const clean: Record<string, AnswerValue> = {};
      for (const f of form.fields) {
        if (!isInputField(f.type)) continue;
        if (f.type !== 'hidden' && !isFieldVisible(f, answers)) continue;
        if (answers[f.id] !== undefined) clean[f.id] = answers[f.id];
      }
      await submitAnswers(slug, clean, useExperience.getState().startedAt || Date.now(), demo || preview);
      scroller.current?.scrollTo({ top: 0, behavior: 'auto' });
      onSubmitted();
    } catch (e) {
      const err = e as SubmitError;
      sfx.error();
      if (err.details && typeof err.details === 'object') {
        setErrors(err.details);
        const first = Object.keys(err.details)[0];
        const pi = pages.findIndex((p) => p.fields.some((f) => f.id === first));
        if (pi >= 0 && pi !== cur) set({ page: pi });
        focusFirstError(err.details);
      }
      setBanner(err.status === 409 ? 'It looks like you’ve already replied to this letter. Thank you!' : err.message || 'Something went wrong — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const vars = {
    ['--fgl-ink' as string]: t.inkColor,
    ['--fgl-accent' as string]: t.accentColor,
    ['--fgl-paper' as string]: t.paperColor,
    ['--fgl-highlight' as string]: t.highlightColor,
    ['--fgl-seal' as string]: t.sealColor,
    ['--fgl-font-title' as string]: FONT_FAMILIES[t.titleFont]?.css,
    ['--fgl-font-body' as string]: FONT_FAMILIES[t.bodyFont]?.css,
    ['--fgl-font-label' as string]: FONT_FAMILIES[t.labelFont]?.css,
    ['--fgl-radius' as string]: `${t.inputRadius}px`,
    ['--fgl-paper-img' as string]: paperBg ? `url(${paperBg})` : 'none',
    ['--fgl-dapple' as string]: dapple ? `url(${dapple})` : 'none',
  } as React.CSSProperties;

  const renderBody = (idx: number, interactive: boolean) => {
    const fields = (pages[idx]?.fields ?? []).filter((f) => isFieldVisible(f, answers));
    let inputIndex = 0;
    return (
      <>
        {idx === 0 && (
          <header className="fgl-letter-head">
            {t.coverImageUrl && (
              <div className="fgl-cover">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.coverImageUrl} alt="" />
              </div>
            )}
            {t.coverVideoUrl && (() => {
              const e = toEmbedUrl(t.coverVideoUrl, { muted: true });
              return (
                <div className="fgl-cover video">
                  {e.kind === 'file' ? (
                    <video src={e.url} controls playsInline preload="metadata" />
                  ) : (
                    <iframe src={e.url} title="Cover video" loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
                  )}
                </div>
              );
            })()}
            {s.greeting && <p className="fgl-greeting">{s.greeting}</p>}
            <h2 className="fgl-title">{form.title}</h2>
            {form.description && <p className="fgl-subtitle">{form.description}</p>}
            {s.introHtml && <Rich html={s.introHtml} className="fgl-intro" />}
          </header>
        )}
        {idx > 0 && s.showPageNumbers && (
          <p className="fgl-page-kicker" aria-hidden>
            {`— ${idx + 1} —`}
          </p>
        )}
        <div className="fgl-fields">
          {fields.map((f) => {
            const i = isInputField(f.type) ? inputIndex++ : inputIndex;
            const isLastInput = interactive && f.id === [...fields].reverse().find((x) => ['short_text', 'email', 'url', 'number', 'currency', 'phone'].includes(x.type))?.id;
            return (
              <Field
                key={f.id}
                field={f}
                value={answers[f.id]}
                error={interactive ? errors[f.id] || undefined : undefined}
                index={i}
                animation={reduced ? 'none' : t.fieldAnimation}
                slug={slug}
                demo={demo || preview}
                onChange={onChange}
                onEnter={isLastInput ? () => (isLast ? undefined : goTo(cur + 1)) : undefined}
              />
            );
          })}
        </div>
        {idx === total - 1 && (s.signOff || s.signature) && (
          <footer className="fgl-signoff">
            {s.signOff && <p>{s.signOff}</p>}
            {s.signature && <p className="fgl-signature-text">{s.signature}</p>}
          </footer>
        )}
      </>
    );
  };

  const empty = visibleFields.length === 0 && pageFields.length === 0;

  return (
    <div
      ref={scroller}
      className={`fgl-letter-scroll${visible && shown ? ' is-shown' : ''}${sending ? ' is-sending' : ''}`}
      style={vars}
      aria-hidden={!visible}
      id="fgl-letter"
    >
      {s.showProgress && total > 1 && (
        <div className="fgl-progress" aria-hidden>
          <span style={{ width: `${((cur + 1) / total) * 100}%` }} />
        </div>
      )}
      <div className="fgl-letter-wrap">
        <div className={`fgl-stack t-${reduced ? 'fade' : t.pageTransition}`}>
          {total > 1 && cur < total - 1 && <div className="fgl-sheet fgl-under two" aria-hidden />}
          {total > 1 && cur < total - 2 && <div className="fgl-sheet fgl-under three" aria-hidden />}
          {ghost && (
            <div key={ghost.key} className={`fgl-sheet fgl-paper fgl-ghost dir-${ghost.dir > 0 ? 'fwd' : 'back'} ruling-${t.ruling} input-${t.inputStyle}`} aria-hidden inert>
              <div className="fgl-sheet-inner">{renderBody(ghost.page, false)}</div>
            </div>
          )}
          <form
            ref={sheet}
            key={`page-${cur}`}
            className={`fgl-sheet fgl-paper current ruling-${t.ruling} input-${t.inputStyle}${ghost ? ` entering dir-${ghost.dir > 0 ? 'fwd' : 'back'}` : ''}${shake ? ' shake' : ''}`}
            data-shake={shake}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (isLast) void submit();
              else goTo(cur + 1);
            }}
            aria-label={`${form.title} — page ${cur + 1} of ${total}`}
          >
            <div className="fgl-paper-dapple" aria-hidden>
              <span />
              <span className="b" />
            </div>
            <div className="fgl-sheet-inner">
              <div ref={headingRef} tabIndex={-1} className="sr-only">
                Page {cur + 1} of {total}
              </div>
              {renderBody(cur, true)}
              {empty && <p className="fgl-empty">This letter is waiting for its first words.</p>}
              {banner && (
                <p className="fgl-banner" role="alert">
                  {banner}
                </p>
              )}
              <nav className="fgl-nav" aria-label="Letter pages">
                {cur > 0 ? (
                  <button type="button" className="fgl-btn ghost" onClick={() => goTo(cur - 1)}>
                    <span aria-hidden>←</span> {s.backLabel || 'Back'}
                  </button>
                ) : (
                  <span />
                )}
                {s.showPageNumbers && total > 1 && (
                  <span className="fgl-pages" aria-hidden>
                    {pages.map((_, i) => (
                      <i key={i} className={i === cur ? 'on' : i < cur ? 'done' : ''} />
                    ))}
                  </span>
                )}
                {isLast ? (
                  <button type="submit" className={`fgl-btn seal${submitting ? ' busy' : ''}`} disabled={submitting || sending}>
                    <span className="fgl-btn-wax" aria-hidden />
                    <span>{submitting ? 'Sealing…' : s.submitLabel || 'Send'}</span>
                  </button>
                ) : (
                  <button type="submit" className="fgl-btn primary">
                    {s.nextLabel || 'Next'} <span aria-hidden>→</span>
                  </button>
                )}
              </nav>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

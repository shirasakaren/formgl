'use client';
import DOMPurify from 'isomorphic-dompurify';
import type { AnswerValue, FormField } from '@formgl/shared';

export interface FieldProps<T extends AnswerValue = AnswerValue> {
  field: FormField;
  value: T | undefined;
  onChange: (v: AnswerValue) => void;
  error?: string;
  inputId: string;
  describedBy?: string;
  slug: string;
  demo: boolean;
  /** called on Enter in single-line inputs */
  onEnter?: () => void;
}

export function sanitize(html?: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['target', 'rel', 'style'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
  });
}

export function Rich({ html, className }: { html?: string; className?: string }) {
  if (!html) return null;
  return <div className={`fgl-rich ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: sanitize(html) }} />;
}

/** Deterministic shuffle per field so options don't jump between renders */
export function useOptions(field: FormField) {
  const opts = field.options ?? [];
  if (!field.shuffle) return opts;
  const seed = [...field.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const arr = [...opts];
  let s = seed;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function InkCheck({ on, round = false }: { on: boolean; round?: boolean }) {
  return (
    <span className={`fgl-ink-box${round ? ' round' : ''}${on ? ' on' : ''}`} aria-hidden>
      <svg viewBox="0 0 24 24">
        {round ? (
          <circle className="mark" cx="12" cy="12" r="5.2" />
        ) : (
          <path className="mark" d="M5 12.5 L10 17 L19.5 6.5" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    </span>
  );
}

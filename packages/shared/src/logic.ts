import { isContentBlock, isInputField } from './fields';
import type { AnswerValue, Answers, FileRef, FormField, LogicCondition } from './types';

/* ───────────────────────── Conditional logic ───────────────────────── */

function asText(v: AnswerValue | undefined): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' ? (x as FileRef).name : String(x))).join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function isEmptyAnswer(v: AnswerValue | undefined): boolean {
  if (v == null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') {
    return Object.values(v).every((x) => x == null || (typeof x === 'string' ? x.trim() === '' : Array.isArray(x) ? x.length === 0 : false));
  }
  return false;
}

function evalCondition(c: LogicCondition, answers: Answers): boolean {
  const v = answers[c.fieldId];
  const target = c.value == null ? '' : String(c.value).toLowerCase();
  switch (c.op) {
    case 'empty':
      return isEmptyAnswer(v);
    case 'not_empty':
      return !isEmptyAnswer(v);
    case 'eq':
      if (Array.isArray(v)) return v.some((x) => String(x).toLowerCase() === target);
      return asText(v).toLowerCase() === target;
    case 'neq':
      if (Array.isArray(v)) return !v.some((x) => String(x).toLowerCase() === target);
      return asText(v).toLowerCase() !== target;
    case 'contains':
      return asText(v).toLowerCase().includes(target);
    case 'not_contains':
      return !asText(v).toLowerCase().includes(target);
    case 'gt':
      return Number(v) > Number(c.value);
    case 'lt':
      return Number(v) < Number(c.value);
    default:
      return true;
  }
}

export function isFieldVisible(field: FormField, answers: Answers): boolean {
  if (field.type === 'hidden') return false;
  const logic = field.logic;
  if (!logic || !logic.conditions?.length) return true;
  const results = logic.conditions.map((c) => evalCondition(c, answers));
  const matched = logic.match === 'any' ? results.some(Boolean) : results.every(Boolean);
  return logic.action === 'show' ? matched : !matched;
}

/* ───────────────────────── Pagination ───────────────────────── */

export interface LetterPage {
  index: number;
  fields: FormField[];
}

/**
 * Split fields into letter pages.
 *  - `page_break` always starts a new page
 *  - only input fields count toward `fieldsPerPage`; content blocks ride along
 *  - hidden fields never render (they are collected from the URL)
 */
export function paginate(fields: FormField[], fieldsPerPage: number): LetterPage[] {
  const per = Math.max(1, Math.floor(fieldsPerPage || 1));
  const pages: FormField[][] = [[]];
  let count = 0;
  for (const f of fields) {
    if (f.type === 'hidden') continue;
    if (f.type === 'page_break') {
      if (pages[pages.length - 1].length) {
        pages.push([]);
        count = 0;
      }
      continue;
    }
    if (isInputField(f.type)) {
      if (count >= per) {
        pages.push([]);
        count = 0;
      }
      count++;
    }
    pages[pages.length - 1].push(f);
  }
  // A trailing page with only content (e.g. trailing divider) merges back
  const cleaned = pages.filter((p) => p.length > 0);
  return (cleaned.length ? cleaned : [[]]).map((p, index) => ({ index, fields: p }));
}

/* ───────────────────────── Validation ───────────────────────── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const URL_RE = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(:\d+)?(\/[^\s]*)?$/i;
const PHONE_RE = /^\+?[0-9 ()\-.]{6,20}$/;

export function validateField(field: FormField, value: AnswerValue | undefined): string | null {
  if (isContentBlock(field.type) || field.type === 'hidden') return null;
  const v = field.validation ?? {};
  const empty = isEmptyAnswer(value);
  if (field.required && (empty || (field.type === 'consent' && value !== true))) {
    return field.type === 'consent' ? 'Please agree to continue' : 'This one needs an answer';
  }
  if (empty) return null;

  switch (field.type) {
    case 'short_text':
    case 'long_text': {
      const s = String(value);
      if (v.minLength != null && s.length < v.minLength) return `At least ${v.minLength} characters`;
      if (v.maxLength != null && s.length > v.maxLength) return `At most ${v.maxLength} characters`;
      if (v.pattern) {
        try {
          if (!new RegExp(v.pattern).test(s)) return v.patternMessage || 'That doesn’t look right';
        } catch {
          /* ignore invalid admin regex */
        }
      }
      return null;
    }
    case 'email':
      return EMAIL_RE.test(String(value).trim()) ? null : 'That email doesn’t look quite right';
    case 'url':
      return URL_RE.test(String(value).trim()) ? null : 'That link doesn’t look quite right';
    case 'phone':
      return PHONE_RE.test(String(value).trim()) ? null : 'That number doesn’t look quite right';
    case 'number':
    case 'currency':
    case 'slider':
    case 'rating':
    case 'scale':
    case 'nps': {
      const n = Number(value);
      if (Number.isNaN(n)) return 'Please enter a number';
      const min = v.min ?? field.config?.scaleMin;
      const max = v.max ?? field.config?.scaleMax ?? (field.type === 'rating' ? field.config?.ratingMax : undefined);
      if (min != null && n < min) return `Must be at least ${min}`;
      if (max != null && n > max) return `Must be at most ${max}`;
      return null;
    }
    case 'checkboxes':
    case 'multiselect': {
      const arr = Array.isArray(value) ? value : [];
      if (v.minSelect != null && arr.length < v.minSelect) return `Pick at least ${v.minSelect}`;
      if (v.maxSelect != null && arr.length > v.maxSelect) return `Pick at most ${v.maxSelect}`;
      return null;
    }
    case 'file_upload':
    case 'image_upload': {
      const arr = Array.isArray(value) ? value : [];
      if (v.maxFiles != null && arr.length > v.maxFiles) return `Up to ${v.maxFiles} files`;
      return null;
    }
    case 'matrix': {
      if (field.required) {
        const rows = field.config?.rows ?? [];
        const obj = (value ?? {}) as Record<string, unknown>;
        const missing = rows.some((r) => isEmptyAnswer(obj[r.label] as AnswerValue));
        if (missing) return 'Please answer every row';
      }
      return null;
    }
    case 'date_range': {
      const r = value as { start?: string; end?: string };
      if (r.start && r.end && r.start > r.end) return 'The end date comes before the start';
      if (field.required && (!r.start || !r.end)) return 'Pick both dates';
      return null;
    }
    default:
      return null;
  }
}

export function validateAnswers(fields: FormField[], answers: Answers): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    if (!isFieldVisible(f, answers)) continue;
    const e = validateField(f, answers[f.id]);
    if (e) errors[f.id] = e;
  }
  return errors;
}

/* ───────────────────────── Display helpers ───────────────────────── */

/** Human readable rendering of any answer (CSV export, tables, emails) */
export function formatAnswer(field: FormField | undefined, value: AnswerValue | undefined): string {
  if (value == null) return '';
  if (typeof value === 'boolean') {
    if (field?.type === 'yes_no') return value ? field.config?.yesLabel || 'Yes' : field.config?.noLabel || 'No';
    return value ? 'Yes' : 'No';
  }
  if (Array.isArray(value)) {
    return value
      .map((x) => (x && typeof x === 'object' ? (x as FileRef).url || (x as FileRef).name : String(x)))
      .join(field?.type === 'ranking' ? ' > ' : ', ');
  }
  if (typeof value === 'object') {
    if (field?.type === 'date_range') {
      const r = value as { start?: string; end?: string };
      return [r.start, r.end].filter(Boolean).join(' → ');
    }
    return Object.entries(value)
      .filter(([, x]) => x != null && x !== '')
      .map(([k, x]) => (field?.type === 'matrix' ? `${k}: ${Array.isArray(x) ? x.join('/') : x}` : Array.isArray(x) ? x.join(', ') : String(x)))
      .join(field?.type === 'matrix' ? '; ' : ' ');
  }
  return String(value);
}

/* ───────────────────────── Slugs ───────────────────────── */

const SLUG_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'; // no l/1/o/0 confusion

export function randomSlug(length = 3): string {
  let s = '';
  const cryptoObj = (globalThis as unknown as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  const bytes = new Uint8Array(length);
  if (cryptoObj?.getRandomValues) cryptoObj.getRandomValues(bytes);
  else for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  for (let i = 0; i < length; i++) s += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
  return s;
}

export const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  '_next',
  'static',
  'assets',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  'files',
  'health',
  'login',
  'logout',
  'manifest.webmanifest',
  'og',
  'preview',
]);

export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-_]{0,63}$/.test(slug) && !RESERVED_SLUGS.has(slug);
}

/* ───────────────────────── Video embeds ───────────────────────── */

export function toEmbedUrl(src: string, opts: { autoplay?: boolean; loop?: boolean; muted?: boolean } = {}): { kind: 'youtube' | 'vimeo' | 'file' | 'unknown'; url: string } {
  if (!src) return { kind: 'unknown', url: '' };
  const yt = src.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) {
    const p = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1' });
    if (opts.autoplay) p.set('autoplay', '1');
    if (opts.muted || opts.autoplay) p.set('mute', '1');
    if (opts.loop) {
      p.set('loop', '1');
      p.set('playlist', yt[1]);
    }
    return { kind: 'youtube', url: `https://www.youtube-nocookie.com/embed/${yt[1]}?${p}` };
  }
  const vm = src.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) {
    const p = new URLSearchParams({ dnt: '1' });
    if (opts.autoplay) p.set('autoplay', '1');
    if (opts.muted || opts.autoplay) p.set('muted', '1');
    if (opts.loop) p.set('loop', '1');
    return { kind: 'vimeo', url: `https://player.vimeo.com/video/${vm[1]}?${p}` };
  }
  if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(src) || src.startsWith('/api/files/')) return { kind: 'file', url: src };
  return { kind: 'unknown', url: src };
}

import clsx, { type ClassValue } from 'clsx';
import DOMPurify from 'isomorphic-dompurify';
import { format, formatDistanceToNowStrict } from 'date-fns';

export const cn = (...v: ClassValue[]) => clsx(v);

/** Warm, colorblind-validated categorical palette (fixed order). */
export const CHART_COLORS = ['#a8322d', '#0f8a7a', '#c7861c', '#3f63b0', '#7a9a1e', '#b04a86'];
export const OTHER_COLOR = '#b9ada0';
/** Sequential ramp (single hue, light → dark) */
export const SEQ = ['#f6e7e1', '#ecc6b9', '#dd9b88', '#c96a55', '#a8322d', '#7a1d1a'];

export function seqColor(t: number): string {
  if (!Number.isFinite(t) || t <= 0) return SEQ[0];
  const i = Math.min(SEQ.length - 1, Math.max(1, Math.ceil(t * (SEQ.length - 1))));
  return SEQ[i];
}

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['target', 'rel', 'style'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
  });
}

export function stripHtml(html?: string): string {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

export const nf = new Intl.NumberFormat('en-US');
export const fmtNum = (n: number | null | undefined, digits = 0) =>
  n == null || !Number.isFinite(n) ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
export const fmtCompact = (n: number) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
export const fmtPct = (r: number | null | undefined, digits = 1) =>
  r == null || !Number.isFinite(r) ? '—' : `${(r * 100).toFixed(digits).replace(/\.0$/, '')}%`;

export function fmtDuration(ms?: number | null): string {
  if (!ms || !Number.isFinite(ms) || ms <= 0) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function fmtDate(iso?: string | null, pattern = 'MMM d, yyyy'): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : format(d, pattern);
}
export const fmtDateTime = (iso?: string | null) => fmtDate(iso, 'MMM d, yyyy · HH:mm');
export function fmtAgo(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : `${formatDistanceToNowStrict(d)} ago`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function publicUrl(slug: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/${slug}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** "2026-09-25T10:00" for <input type=datetime-local> from ISO */
export function toLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function slugifyFilename(s: string) {
  return (s || 'form').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'form';
}

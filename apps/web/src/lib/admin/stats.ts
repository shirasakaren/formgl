import { formatAnswer, isEmptyAnswer, type AnswerValue, type FileRef, type FormField, type FormResponse } from '@formgl/shared';

export const NUMERIC_TYPES = new Set(['number', 'currency', 'rating', 'scale', 'nps', 'slider']);
export const CHOICE_TYPES = new Set(['multiple_choice', 'checkboxes', 'dropdown', 'multiselect', 'country', 'yes_no', 'ranking']);
export const TEXT_TYPES = new Set(['short_text', 'long_text', 'email', 'url', 'phone', 'name', 'address']);

export type FieldKind = 'numeric' | 'choice' | 'text' | 'other';
export function fieldKind(f: FormField): FieldKind {
  if (NUMERIC_TYPES.has(f.type)) return 'numeric';
  if (CHOICE_TYPES.has(f.type)) return 'choice';
  if (TEXT_TYPES.has(f.type)) return 'text';
  return 'other';
}

export function toNumber(v: AnswerValue | undefined): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^0-9.\-]/g, ''));
    return v.trim() !== '' && Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Choice values → list of category labels for a single answer */
export function toCategories(f: FormField, v: AnswerValue | undefined): string[] {
  if (isEmptyAnswer(v)) return [];
  if (typeof v === 'boolean') return [v ? f.config?.yesLabel || 'Yes' : f.config?.noLabel || 'No'];
  if (f.type === 'ranking' && Array.isArray(v)) return v.length ? [String(v[0])] : [];
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' ? (x as FileRef).name : String(x)));
  if (typeof v === 'object') return [formatAnswer(f, v)];
  return [String(v)];
}

export function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}
export function median(xs: number[]) {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export function stdDev(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

export function histogram(xs: number[], f?: FormField): Array<{ bucket: string; count: number }> {
  if (!xs.length) return [];
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  const integral = xs.every((x) => Number.isInteger(x));
  // Discrete scales: one bar per value
  if (integral && max - min <= 20) {
    const lo = f?.type === 'nps' ? 0 : f?.type === 'rating' ? 1 : Math.min(min, f?.config?.scaleMin ?? min);
    const hi = f?.type === 'nps' ? 10 : f?.type === 'rating' ? (f.config?.ratingMax ?? max) : Math.max(max, f?.config?.scaleMax ?? max);
    const out: Array<{ bucket: string; count: number }> = [];
    for (let i = lo; i <= hi; i++) out.push({ bucket: String(i), count: xs.filter((x) => x === i).length });
    return out;
  }
  const bins = Math.min(12, Math.max(4, Math.ceil(Math.sqrt(xs.length))));
  const w = (max - min) / bins || 1;
  const out = Array.from({ length: bins }, (_, i) => ({
    bucket: `${round(min + i * w)}–${round(min + (i + 1) * w)}`,
    count: 0,
  }));
  for (const x of xs) out[Math.min(bins - 1, Math.floor((x - min) / w))].count++;
  return out;
}
const round = (n: number) => (Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10);

export function nps(xs: number[]) {
  if (!xs.length) return null;
  const promoters = xs.filter((x) => x >= 9).length;
  const detractors = xs.filter((x) => x <= 6).length;
  const passives = xs.length - promoters - detractors;
  return {
    score: Math.round(((promoters - detractors) / xs.length) * 100),
    promoters,
    passives,
    detractors,
  };
}

export function pearson(pairs: Array<[number, number]>) {
  const n = pairs.length;
  if (n < 3) return NaN;
  const mx = mean(pairs.map((p) => p[0]));
  const my = mean(pairs.map((p) => p[1]));
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (const [x, y] of pairs) {
    num += (x - mx) * (y - my);
    dx += (x - mx) ** 2;
    dy += (y - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : NaN;
}

const STOP = new Set(
  'a about above after again against all am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with you your yours yourself yourselves also would really much get got im its dont thats ive youre one like well us'.split(
    ' ',
  ),
);

export function topWords(texts: string[], limit = 15) {
  const counts = new Map<string, number>();
  for (const t of texts) {
    for (const raw of t.toLowerCase().split(/[^\p{L}\p{N}']+/u)) {
      const w = raw.replace(/^'+|'+$/g, '').replace(/'/g, '');
      if (w.length < 3 || STOP.has(w) || /^\d+$/.test(w)) continue;
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

export function distribution(f: FormField, responses: FormResponse[]) {
  const counts = new Map<string, number>();
  // seed with defined options so zero-count options still show
  if (f.type === 'yes_no') {
    counts.set(f.config?.yesLabel || 'Yes', 0);
    counts.set(f.config?.noLabel || 'No', 0);
  }
  for (const o of f.options ?? []) counts.set(o.label, 0);
  let answered = 0;
  for (const r of responses) {
    const cats = toCategories(f, r.answers[f.id]);
    if (cats.length) answered++;
    for (const c of cats) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const rows = [...counts.entries()].map(([label, count]) => ({ label, count, pct: answered ? count / answered : 0 }));
  if (!f.options?.length) rows.sort((a, b) => b.count - a.count);
  return { rows, answered };
}

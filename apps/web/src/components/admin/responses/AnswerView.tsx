'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import { Check, Download, FileText, Heart, Play, Star, X, Circle, ThumbsUp, Flower2 } from 'lucide-react';
import { formatAnswer, isEmptyAnswer, type AnswerValue, type FileRef, type FormField } from '@formgl/shared';
import { cn } from '@/lib/admin/utils';
import { Chip } from '../ui';

/* ───────────────────────── Lightbox ───────────────────────── */

type Media = { url: string; kind: 'image' | 'video'; name?: string };
export const useLightbox = create<{ media: Media | null; open: (m: Media) => void; close: () => void }>((set) => ({
  media: null,
  open: (media) => set({ media }),
  close: () => set({ media: null }),
}));

export function Lightbox() {
  const { media, close } = useLightbox();
  useEffect(() => {
    if (!media) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [media, close]);
  if (!media) return null;
  return (
    <div className="fgl-anim-fade fixed inset-0 z-[120] flex items-center justify-center bg-[#1a1412]/85 p-4 backdrop-blur-sm" onClick={close} role="dialog" aria-modal="true" aria-label={media.name ?? 'Media preview'}>
      <button onClick={close} aria-label="Close preview" className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20">
        <X className="size-5" />
      </button>
      <div onClick={(e) => e.stopPropagation()} className="fgl-anim-pop flex max-h-full max-w-5xl flex-col items-center gap-3">
        {media.kind === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.url} alt={media.name ?? ''} className="max-h-[80dvh] max-w-full rounded-lg bg-white object-contain shadow-2xl" />
        ) : (
          <video src={media.url} controls autoPlay className="max-h-[80dvh] max-w-full rounded-lg bg-black shadow-2xl" />
        )}
        <div className="flex items-center gap-3 text-sm text-white/80">
          {media.name && <span className="truncate">{media.name}</span>}
          <a href={media.url} download={media.name} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 hover:bg-white/20">
            <Download className="size-3.5" /> Download
          </a>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Answer rendering ───────────────────────── */

const isFileRefArray = (v: unknown): v is FileRef[] => Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && v[0] !== null && 'url' in (v[0] as object);
const isImageUrl = (s: string) => /^data:image\//.test(s) || /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(s);
const fmtSize = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

const RATING_ICONS = { star: Star, heart: Heart, circle: Circle, thumb: ThumbsUp, flower: Flower2 };

export function AnswerView({ field, value, compact }: { field?: FormField; value: AnswerValue | undefined; compact?: boolean }) {
  const open = useLightbox((s) => s.open);
  if (isEmptyAnswer(value)) return <span className="text-(--ink-3)">—</span>;
  const type = field?.type;

  // files / images / videos
  if (isFileRefArray(value)) {
    return (
      <div className={cn('flex gap-1.5', compact ? 'flex-nowrap' : 'flex-wrap')}>
        {value.map((f) =>
          f.mime?.startsWith('image/') ? (
            <button key={f.id ?? f.url} type="button" onClick={(e) => { e.stopPropagation(); open({ url: f.url, kind: 'image', name: f.name }); }} className="shrink-0 overflow-hidden rounded-md ring-1 ring-(--line) hover:ring-(--accent)" aria-label={`View ${f.name}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt={f.name} loading="lazy" className={cn('object-cover', compact ? 'size-8' : 'size-24')} />
            </button>
          ) : f.mime?.startsWith('video/') ? (
            <button key={f.id ?? f.url} type="button" onClick={(e) => { e.stopPropagation(); open({ url: f.url, kind: 'video', name: f.name }); }} className={cn('relative grid shrink-0 place-items-center overflow-hidden rounded-md bg-[#2b2320] text-white ring-1 ring-(--line) hover:ring-(--accent)', compact ? 'size-8' : 'h-24 w-36')} aria-label={`Play ${f.name}`}>
              {!compact && <video src={f.url} muted preload="metadata" className="absolute inset-0 h-full w-full object-cover opacity-70" />}
              <Play className="relative size-4 fill-white" />
            </button>
          ) : (
            <a key={f.id ?? f.url} href={f.url} download={f.name} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex max-w-52 shrink-0 items-center gap-1.5 rounded-md bg-(--paper-2) px-2 py-1 text-xs hover:bg-[#e7dece]">
              <FileText className="size-3.5 shrink-0 text-(--accent)" />
              <span className="truncate">{f.name}</span>
              {!compact && f.size ? <span className="text-(--ink-3)">{fmtSize(f.size)}</span> : null}
              <Download className="size-3 shrink-0 text-(--ink-3)" />
            </a>
          ),
        )}
      </div>
    );
  }

  if (type === 'signature' && typeof value === 'string' && (isImageUrl(value) || value.startsWith('/api/files/'))) {
    return (
      <button type="button" onClick={(e) => { e.stopPropagation(); open({ url: value, kind: 'image', name: 'Signature' }); }} className="rounded-md bg-white ring-1 ring-(--line) hover:ring-(--accent)" aria-label="View signature">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value} alt="Signature" className={cn('object-contain', compact ? 'h-8 w-20' : 'h-24 w-64')} />
      </button>
    );
  }

  if (type === 'color' && typeof value === 'string') {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="size-4 rounded ring-1 ring-black/10" style={{ background: value }} />
        <span className="font-mono text-xs uppercase">{value}</span>
      </span>
    );
  }

  if (type === 'rating' && (typeof value === 'number' || typeof value === 'string')) {
    const n = Number(value);
    const max = field?.config?.ratingMax ?? 5;
    const Icon = RATING_ICONS[field?.config?.ratingIcon ?? 'star'] ?? Star;
    return (
      <span className="inline-flex items-center gap-0.5" aria-label={`${n} of ${max}`} title={`${n} / ${max}`}>
        {Array.from({ length: max }, (_, i) => (
          <Icon key={i} className={cn(compact ? 'size-3.5' : 'size-4', i < n ? 'fill-[#c7861c] text-[#c7861c]' : 'text-[#dccfbf]')} aria-hidden />
        ))}
      </span>
    );
  }

  if ((type === 'nps' || type === 'scale' || type === 'slider') && value !== null && typeof value !== 'object') {
    const n = Number(value);
    const tone = type === 'nps' ? (n >= 9 ? 'bg-[#e3f1e7] text-[#276640]' : n >= 7 ? 'bg-[#f6efdc] text-[#8a6412]' : 'bg-[#f7e6e3] text-[#8e1b1b]') : 'bg-(--paper-2) text-(--ink)';
    return (
      <span className={cn('inline-flex min-w-7 items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums', tone)}>
        {field?.config?.prefix}
        {n}
        {field?.config?.suffix}
      </span>
    );
  }

  if (typeof value === 'boolean') {
    const label = formatAnswer(field, value);
    return <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium', value ? 'bg-[#e3f1e7] text-[#276640]' : 'bg-(--paper-2) text-(--ink-2)')}>{value && <Check className="size-3" />}{type === 'consent' ? (value ? 'Agreed' : 'Declined') : label}</span>;
  }

  if (Array.isArray(value)) {
    const items = value.map(String);
    return (
      <span className={cn('flex gap-1', compact ? 'flex-nowrap overflow-hidden' : 'flex-wrap')}>
        {items.map((s, i) => (
          <Chip key={i} className="shrink-0">
            {type === 'ranking' ? `${i + 1}. ${s}` : s}
          </Chip>
        ))}
      </span>
    );
  }

  if (typeof value === 'object' && value) {
    if (type === 'matrix' && !compact) {
      return (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {Object.entries(value).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-(--ink-2)">{k}</dt>
              <dd className="font-medium">{Array.isArray(v) ? v.join(', ') : String(v ?? '—')}</dd>
            </div>
          ))}
        </dl>
      );
    }
    return <span className={cn(compact && 'block truncate')}>{formatAnswer(field, value)}</span>;
  }

  const s = String(value);
  if (type === 'url' || (/^https?:\/\//i.test(s) && !s.includes(' '))) {
    const href = /^https?:\/\//i.test(s) ? s : `https://${s}`;
    return (
      <a href={href} target="_blank" rel="noreferrer noopener" onClick={(e) => e.stopPropagation()} className={cn('text-(--accent) underline underline-offset-2', compact && 'block truncate')}>
        {s}
      </a>
    );
  }
  if (type === 'email') return <a href={`mailto:${s}`} onClick={(e) => e.stopPropagation()} className={cn('text-(--accent) hover:underline', compact && 'block truncate')}>{s}</a>;
  if (type === 'phone') return <a href={`tel:${s.replace(/[^+\d]/g, '')}`} onClick={(e) => e.stopPropagation()} className="hover:underline">{s}</a>;
  if ((type === 'currency' || type === 'number') && s !== '') {
    const n = Number(s);
    const pretty = Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : s;
    return <span className="tabular-nums">{field?.config?.prefix}{pretty}{field?.config?.suffix ? ` ${field.config.suffix}` : ''}</span>;
  }
  return <span className={cn(compact ? 'block truncate' : 'whitespace-pre-wrap')}>{s}</span>;
}

'use client';
import { toEmbedUrl, type FormField } from '@formgl/shared';
import { Rich } from './common';

export function ContentBlock({ field }: { field: FormField }) {
  const c = field.config ?? {};
  const align = c.align ?? 'left';
  switch (field.type) {
    case 'heading': {
      const Tag = (`h${Math.min(4, (c.level ?? 2) + 1)}` as unknown) as 'h3';
      return (
        <Tag className={`fgl-heading lvl-${c.level ?? 2}`} style={{ textAlign: align }}>
          {field.label}
        </Tag>
      );
    }
    case 'paragraph':
      return <Rich html={c.html} className={`fgl-para align-${align}`} />;
    case 'quote':
      return (
        <figure className="fgl-quote">
          <Rich html={c.html} />
          {c.caption && <figcaption>— {c.caption}</figcaption>}
        </figure>
      );
    case 'image':
      if (!c.src) return null;
      return (
        <figure className={`fgl-figure align-${c.align ?? 'center'}${c.rounded ? ' rounded' : ''}`} style={{ ['--w' as string]: `${c.mediaWidth ?? 100}%` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.src} alt={c.alt ?? ''} loading="lazy" />
          {c.caption && <figcaption>{c.caption}</figcaption>}
        </figure>
      );
    case 'video': {
      const e = toEmbedUrl(c.src ?? '', { autoplay: c.autoplay, loop: c.loop, muted: c.muted });
      if (!e.url) return null;
      return (
        <figure className={`fgl-figure fgl-video align-${c.align ?? 'center'}${c.rounded !== false ? ' rounded' : ''}`} style={{ ['--w' as string]: `${c.mediaWidth ?? 100}%` }}>
          <div className="fgl-video-frame">
            {e.kind === 'file' ? (
              <video src={e.url} controls playsInline autoPlay={c.autoplay} muted={c.muted || c.autoplay} loop={c.loop} preload="metadata" />
            ) : (
              <iframe
                src={e.url}
                title={c.caption || field.label || 'Video'}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
              />
            )}
          </div>
          {c.caption && <figcaption>{c.caption}</figcaption>}
        </figure>
      );
    }
    case 'divider':
      return <Divider kind={c.divider ?? 'flourish'} />;
    case 'spacer':
      return <div aria-hidden style={{ height: Math.max(4, Math.min(240, c.height ?? 32)) }} />;
    default:
      return null;
  }
}

export function Divider({ kind }: { kind: string }) {
  if (kind === 'line') return <hr className="fgl-divider line" />;
  if (kind === 'dots')
    return (
      <div className="fgl-divider dots" role="separator">
        <span>·</span>
        <span>·</span>
        <span>·</span>
      </div>
    );
  if (kind === 'wave')
    return (
      <div className="fgl-divider svg" role="separator">
        <svg viewBox="0 0 240 16" aria-hidden>
          <path d="M2 8 Q 17 0, 32 8 T 62 8 T 92 8 T 122 8 T 152 8 T 182 8 T 212 8 T 238 8" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </div>
    );
  return (
    <div className="fgl-divider svg" role="separator">
      <svg viewBox="0 0 240 24" aria-hidden>
        <path d="M10 12 H 96 M 144 12 H 230" stroke="currentColor" strokeWidth="0.9" />
        <path d="M120 4 C 112 4, 106 12, 120 12 C 134 12, 128 20, 120 20 C 112 20, 108 14, 104 12 M 120 12 C 132 12, 136 10, 136 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="100" cy="12" r="1.6" fill="currentColor" />
        <circle cx="140" cy="12" r="1.6" fill="currentColor" />
      </svg>
    </div>
  );
}

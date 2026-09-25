'use client';
import { useState } from 'react';
import type { FieldProps } from './common';
import { useOptions } from './common';
import { sfx } from '../audio';

const ICONS: Record<string, (filled: boolean) => React.ReactNode> = {
  star: (f) => <path d="M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3.1-5.4 3.1 1.2-6L3.3 9.5l6.1-.7z" fill={f ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />,
  heart: (f) => <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z" fill={f ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />,
  circle: (f) => <circle cx="12" cy="12" r="7.5" fill={f ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.3" />,
  thumb: (f) => <path d="M7 11v8H4v-8h3zm2 8h7.2a2 2 0 0 0 2-1.6l1.1-5.4A2 2 0 0 0 17.3 9.6H13l.7-3.4a1.6 1.6 0 0 0-2.9-1.2L8.8 9.4A2 2 0 0 0 9 10.6V19z" fill={f ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />,
  flower: (f) => (
    <g fill={f ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.2">
      {[0, 72, 144, 216, 288].map((r) => (
        <ellipse key={r} cx="12" cy="7" rx="3" ry="4.2" transform={`rotate(${r} 12 12)`} />
      ))}
      <circle cx="12" cy="12" r="2.2" fill={f ? '#fff6' : 'none'} />
    </g>
  ),
};

export function Rating({ field, value, onChange, inputId, describedBy }: FieldProps) {
  const max = field.config?.ratingMax ?? 5;
  const icon = ICONS[field.config?.ratingIcon ?? 'star'] ?? ICONS.star;
  const [hover, setHover] = useState(0);
  const v = typeof value === 'number' ? value : Number(value) || 0;
  const shown = hover || v;
  return (
    <div id={inputId} className="fgl-rating" role="radiogroup" aria-label={field.label} aria-describedby={describedBy} onMouseLeave={() => setHover(0)}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={v === n}
          aria-label={`${n} of ${max}`}
          className={`fgl-rate${n <= shown ? ' on' : ''}${n === v ? ' picked' : ''}`}
          onMouseEnter={() => setHover(n)}
          onFocus={() => setHover(n)}
          onBlur={() => setHover(0)}
          onClick={() => {
            onChange(n === v ? null : n);
            sfx.select();
          }}
          style={{ ['--i' as string]: n }}
        >
          <svg viewBox="0 0 24 24">{icon(n <= shown)}</svg>
        </button>
      ))}
      {v > 0 && (
        <span className="fgl-rate-value" aria-hidden>
          {v}/{max}
        </span>
      )}
    </div>
  );
}

export function Scale({ field, value, onChange, inputId, describedBy }: FieldProps) {
  const nps = field.type === 'nps';
  const min = field.config?.scaleMin ?? (nps ? 0 : 1);
  const max = field.config?.scaleMax ?? (nps ? 10 : 5);
  const v = value == null ? null : Number(value);
  const nums = Array.from({ length: Math.max(1, max - min + 1) }, (_, i) => min + i);
  return (
    <div className={`fgl-scale${nps ? ' nps' : ''}`}>
      <div id={inputId} className="fgl-scale-row" role="radiogroup" aria-label={field.label} aria-describedby={describedBy} style={{ ['--n' as string]: nums.length }}>
        {nums.map((n) => {
          const tone = nps ? (n <= 6 ? 'low' : n <= 8 ? 'mid' : 'high') : '';
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={v === n}
              className={`fgl-scale-btn ${tone}${v === n ? ' on' : ''}`}
              onClick={() => {
                onChange(n);
                sfx.select();
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
      {(field.config?.minLabel || field.config?.maxLabel) && (
        <div className="fgl-scale-labels" aria-hidden>
          <span>{field.config?.minLabel}</span>
          <span>{field.config?.maxLabel}</span>
        </div>
      )}
    </div>
  );
}

export function Slider({ field, value, onChange, inputId, describedBy }: FieldProps) {
  const min = field.validation?.min ?? field.config?.scaleMin ?? 0;
  const max = field.validation?.max ?? field.config?.scaleMax ?? 100;
  const step = field.validation?.step ?? 1;
  const has = value != null && value !== '';
  const v = has ? Number(value) : Math.round((min + max) / 2);
  const pct = ((v - min) / Math.max(1e-6, max - min)) * 100;
  return (
    <div className={`fgl-slider${has ? ' touched' : ''}`} style={{ ['--pct' as string]: `${pct}%` }}>
      <output className="fgl-slider-value" htmlFor={inputId}>
        {field.config?.prefix}
        {has ? v : '—'}
        {field.config?.suffix}
      </output>
      <input
        id={inputId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        aria-describedby={describedBy}
        aria-valuetext={`${v}${field.config?.suffix ?? ''}`}
        onChange={(e) => {
          onChange(Number(e.target.value));
          sfx.pencil();
        }}
      />
      <div className="fgl-scale-labels" aria-hidden>
        <span>{field.config?.minLabel ?? `${field.config?.prefix ?? ''}${min}${field.config?.suffix ?? ''}`}</span>
        <span>{field.config?.maxLabel ?? `${field.config?.prefix ?? ''}${max}${field.config?.suffix ?? ''}`}</span>
      </div>
    </div>
  );
}

export function Ranking({ field, value, onChange, inputId, describedBy }: FieldProps) {
  const options = useOptions(field);
  const order: string[] = Array.isArray(value) && value.length ? (value as string[]) : options.map((o) => o.label);
  const [drag, setDrag] = useState<number | null>(null);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    onChange(next);
    sfx.pencil();
  };
  return (
    <ol id={inputId} className="fgl-ranking" aria-describedby={describedBy} aria-label={`${field.label} — use the arrow buttons to reorder`}>
      {order.map((label, i) => (
        <li
          key={label}
          className={`fgl-rank${drag === i ? ' dragging' : ''}`}
          draggable
          onDragStart={(e) => {
            setDrag(i);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (drag != null && drag !== i) {
              move(drag, i);
              setDrag(i);
            }
          }}
          onDragEnd={() => setDrag(null)}
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('button')) return;
            if (e.pointerType === 'mouse') return; // native DnD handles mouse
            const startY = e.clientY;
            const li = e.currentTarget;
            const h = li.getBoundingClientRect().height + 8;
            let cur = i;
            li.setPointerCapture(e.pointerId);
            const onMove = (ev: PointerEvent) => {
              const target = Math.max(0, Math.min(order.length - 1, i + Math.round((ev.clientY - startY) / h)));
              if (target !== cur) {
                cur = target;
                li.style.transform = `translateY(${(target - i) * h}px)`;
              }
            };
            const onUp = () => {
              li.style.transform = '';
              li.removeEventListener('pointermove', onMove);
              li.removeEventListener('pointerup', onUp);
              li.removeEventListener('pointercancel', onUp);
              move(i, cur);
            };
            li.addEventListener('pointermove', onMove);
            li.addEventListener('pointerup', onUp);
            li.addEventListener('pointercancel', onUp);
          }}
        >
          <span className="fgl-rank-n">{i + 1}</span>
          <span className="fgl-rank-label">{label}</span>
          <span className="fgl-rank-btns">
            <button type="button" aria-label={`Move ${label} up`} disabled={i === 0} onClick={() => move(i, i - 1)}>
              ↑
            </button>
            <button type="button" aria-label={`Move ${label} down`} disabled={i === order.length - 1} onClick={() => move(i, i + 1)}>
              ↓
            </button>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function Matrix({ field, value, onChange, inputId, describedBy }: FieldProps) {
  const rows = field.config?.rows ?? [];
  const cols = field.config?.columns ?? [];
  const multi = !!field.config?.matrixMultiple;
  const v = (value ?? {}) as Record<string, string | string[]>;
  const set = (row: string, col: string) => {
    sfx.select();
    if (!multi) return onChange({ ...v, [row]: col });
    const cur = Array.isArray(v[row]) ? (v[row] as string[]) : [];
    onChange({ ...v, [row]: cur.includes(col) ? cur.filter((c) => c !== col) : [...cur, col] });
  };
  const isOn = (row: string, col: string) => (multi ? Array.isArray(v[row]) && (v[row] as string[]).includes(col) : v[row] === col);
  return (
    <div id={inputId} className="fgl-matrix" aria-describedby={describedBy} style={{ ['--cols' as string]: cols.length }}>
      <div className="fgl-matrix-head" aria-hidden>
        <span />
        {cols.map((c) => (
          <span key={c.id}>{c.label}</span>
        ))}
      </div>
      {rows.map((r) => (
        <div key={r.id} className="fgl-matrix-row" role={multi ? 'group' : 'radiogroup'} aria-label={r.label}>
          <span className="fgl-matrix-label">{r.label}</span>
          {cols.map((c) => (
            <button
              key={c.id}
              type="button"
              role={multi ? 'checkbox' : 'radio'}
              aria-checked={isOn(r.label, c.label)}
              aria-label={`${r.label}: ${c.label}`}
              className={`fgl-matrix-cell${isOn(r.label, c.label) ? ' on' : ''}`}
              onClick={() => set(r.label, c.label)}
            >
              <span className="dot" aria-hidden />
              <span className="m-label">{c.label}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

'use client';
import { useMemo, useState } from 'react';
import type { FieldProps } from './common';
import { InkCheck, sanitize, useOptions } from './common';
import { sfx } from '../audio';

const OTHER = '__other__';

function otherValue(v: string) {
  return v.startsWith('Other: ') ? v.slice(7) : '';
}

export function ChoiceGroup({ field, value, onChange, inputId, describedBy, error }: FieldProps) {
  const multi = field.type === 'checkboxes';
  const options = useOptions(field);
  const layout = field.config?.layout ?? (options.some((o) => o.imageUrl) ? 'cards' : 'list');
  const selected: string[] = multi ? (Array.isArray(value) ? (value as string[]) : []) : value != null && value !== '' ? [String(value)] : [];
  const otherSel = selected.find((s) => s.startsWith('Other: ') || s === 'Other:');
  const [otherText, setOtherText] = useState(otherSel ? otherValue(otherSel) : '');
  const max = field.validation?.maxSelect;

  const toggle = (label: string) => {
    sfx.select();
    if (!multi) {
      onChange(label === OTHER ? `Other: ${otherText}` : label);
      return;
    }
    const key = label === OTHER ? selected.find((s) => s.startsWith('Other:')) : label;
    if (key && selected.includes(key)) onChange(selected.filter((s) => s !== key));
    else {
      if (max && selected.length >= max) return;
      onChange([...selected, label === OTHER ? `Other: ${otherText}` : label]);
    }
  };
  const isOn = (label: string) => (label === OTHER ? !!otherSel : selected.includes(label));

  return (
    <div
      id={inputId}
      className={`fgl-choices layout-${layout}`}
      role={multi ? 'group' : 'radiogroup'}
      aria-describedby={describedBy}
      aria-invalid={!!error}
      aria-required={field.required}
      aria-label={field.label}
    >
      {[...options.map((o) => ({ id: o.id, label: o.label, imageUrl: o.imageUrl })), ...(field.allowOther ? [{ id: OTHER, label: OTHER, imageUrl: undefined }] : [])].map((o, i) => {
        const on = isOn(o.label);
        return (
          <div key={o.id} className={`fgl-choice${on ? ' on' : ''}`} style={{ ['--i' as string]: i }}>
            <button
              type="button"
              role={multi ? 'checkbox' : 'radio'}
              aria-checked={on}
              className="fgl-choice-btn"
              onClick={() => toggle(o.label)}
              onKeyDown={(e) => {
                if (multi) return;
                const all = (e.currentTarget.closest('.fgl-choices')?.querySelectorAll('.fgl-choice-btn') ?? []) as NodeListOf<HTMLButtonElement>;
                const idx = Array.from(all).indexOf(e.currentTarget);
                if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                  e.preventDefault();
                  all[(idx + 1) % all.length]?.focus();
                } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                  e.preventDefault();
                  all[(idx - 1 + all.length) % all.length]?.focus();
                }
              }}
            >
              {o.imageUrl && (
                <span className="fgl-choice-img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={o.imageUrl} alt="" loading="lazy" />
                </span>
              )}
              <InkCheck on={on} round={!multi} />
              <span className="fgl-choice-label">{o.label === OTHER ? 'Other' : o.label}</span>
            </button>
            {o.label === OTHER && on && (
              <input
                className="fgl-input fgl-other"
                autoFocus
                aria-label="Other, please specify"
                placeholder="Tell us…"
                value={otherText}
                onChange={(e) => {
                  const t = e.target.value;
                  setOtherText(t);
                  if (multi) onChange(selected.map((s) => (s.startsWith('Other:') ? `Other: ${t}` : s)));
                  else onChange(`Other: ${t}`);
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Dropdown({ field, value, onChange, inputId, describedBy, error }: FieldProps) {
  const options = useOptions(field);
  return (
    <div className="fgl-input-wrap fgl-select-wrap">
      <select
        id={inputId}
        className="fgl-input fgl-select"
        value={value == null ? '' : String(value)}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        aria-required={field.required}
        onChange={(e) => {
          onChange(e.target.value);
          sfx.select();
        }}
      >
        <option value="">{field.placeholder || 'Choose one…'}</option>
        {options.map((o) => (
          <option key={o.id} value={o.label}>
            {o.label}
          </option>
        ))}
      </select>
      <svg className="fgl-select-caret" viewBox="0 0 24 24" aria-hidden>
        <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function MultiSelect({ field, value, onChange, inputId, describedBy }: FieldProps) {
  const options = useOptions(field);
  const selected: string[] = Array.isArray(value) ? (value as string[]) : [];
  const [q, setQ] = useState('');
  const filtered = useMemo(() => options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())), [options, q]);
  const max = field.validation?.maxSelect;
  return (
    <div className="fgl-multi" aria-describedby={describedBy}>
      {options.length > 8 && (
        <input className="fgl-input fgl-multi-search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter options" />
      )}
      <div id={inputId} className="fgl-tags" role="group" aria-label={field.label}>
        {filtered.map((o) => {
          const on = selected.includes(o.label);
          return (
            <button
              key={o.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              className={`fgl-tag${on ? ' on' : ''}`}
              onClick={() => {
                sfx.select();
                if (on) onChange(selected.filter((s) => s !== o.label));
                else if (!max || selected.length < max) onChange([...selected, o.label]);
              }}
            >
              <span className="fgl-tag-dot" aria-hidden />
              {o.label}
            </button>
          );
        })}
      </div>
      {max ? (
        <p className="fgl-hint-text">
          {selected.length}/{max} selected
        </p>
      ) : null}
    </div>
  );
}

export function YesNo({ field, value, onChange, inputId, describedBy }: FieldProps) {
  const yes = field.config?.yesLabel || 'Yes';
  const no = field.config?.noLabel || 'No';
  return (
    <div id={inputId} className="fgl-yesno" role="radiogroup" aria-describedby={describedBy} aria-label={field.label}>
      {[
        { v: true, l: yes },
        { v: false, l: no },
      ].map((o) => (
        <button
          key={String(o.v)}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          className={`fgl-pill${value === o.v ? ' on' : ''}`}
          onClick={() => {
            onChange(o.v);
            sfx.select();
          }}
        >
          <span className="fgl-pill-mark" aria-hidden>
            {o.v ? '✓' : '✕'}
          </span>
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function Consent({ field, value, onChange, inputId, describedBy, error }: FieldProps) {
  const on = value === true;
  return (
    <label className={`fgl-consent${on ? ' on' : ''}`}>
      <input
        id={inputId}
        type="checkbox"
        className="sr-only"
        checked={on}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        onChange={(e) => {
          onChange(e.target.checked);
          sfx.select();
        }}
      />
      <InkCheck on={on} />
      <span className="fgl-rich" dangerouslySetInnerHTML={{ __html: sanitize(field.config?.consentHtml || 'I agree') }} />
    </label>
  );
}

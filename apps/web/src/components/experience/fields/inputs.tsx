'use client';
import { useEffect, useRef, useState } from 'react';
import { COUNTRIES } from '@formgl/shared';
import type { FieldProps } from './common';
import { sfx } from '../audio';

const tick = () => sfx.pencil();

export function TextInput({ field, value, onChange, inputId, describedBy, error, onEnter }: FieldProps) {
  const type = field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : field.type === 'number' || field.type === 'currency' ? 'text' : 'text';
  const numeric = field.type === 'number' || field.type === 'currency';
  const auto =
    field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : field.label.toLowerCase().includes('name') ? 'name' : 'on';
  const prefix = field.type === 'currency' ? field.config?.prefix || '$' : field.config?.prefix;
  const suffix = field.config?.suffix;
  const v = value == null ? '' : String(value);
  return (
    <div className="fgl-input-wrap">
      {prefix && <span className="fgl-affix">{prefix}</span>}
      <input
        id={inputId}
        className="fgl-input"
        type={type}
        inputMode={numeric ? 'decimal' : field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : undefined}
        autoComplete={auto}
        placeholder={field.placeholder ?? ''}
        value={v}
        maxLength={field.validation?.maxLength}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        aria-required={field.required}
        onChange={(e) => {
          let nv: string | number | null = e.target.value;
          if (numeric) {
            const cleaned = e.target.value.replace(/[^0-9.,-]/g, '').replace(',', '.');
            nv = cleaned === '' ? null : cleaned.endsWith('.') || cleaned === '-' ? (cleaned as unknown as number) : Number(cleaned);
            if (typeof nv === 'number' && Number.isNaN(nv)) nv = cleaned as unknown as number;
          }
          onChange(nv as never);
          tick();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onEnter?.();
          }
        }}
      />
      {suffix && <span className="fgl-affix">{suffix}</span>}
    </div>
  );
}

export function PhoneInput({ field, value, onChange, inputId, describedBy, error, onEnter }: FieldProps) {
  const raw = value == null ? '' : String(value);
  const match = raw.match(/^\+(\d{1,4})\s?(.*)$/);
  const [dial, setDial] = useState(() => {
    if (match) return match[1];
    const dc = field.config?.defaultCountry;
    return COUNTRIES.find((c) => c.code === dc)?.dial ?? '';
  });
  const local = match ? match[2] : raw;
  const emit = (d: string, l: string) => onChange(l ? (d ? `+${d} ${l}` : l) : '');
  return (
    <div className="fgl-input-wrap fgl-phone">
      <label className="sr-only" htmlFor={`${inputId}-cc`}>
        Country code
      </label>
      <select id={`${inputId}-cc`} className="fgl-input fgl-cc" value={dial} onChange={(e) => { setDial(e.target.value); emit(e.target.value, local); }}>
        <option value="">+</option>
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.dial}>
            {c.code} +{c.dial}
          </option>
        ))}
      </select>
      <input
        id={inputId}
        className="fgl-input"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder={field.placeholder ?? '812 3456 7890'}
        value={local}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        onChange={(e) => {
          emit(dial, e.target.value.replace(/[^0-9 ()\-.]/g, ''));
          tick();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onEnter?.();
          }
        }}
      />
    </div>
  );
}

export function LongText({ field, value, onChange, inputId, describedBy, error }: FieldProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const v = value == null ? '' : String(value);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 96)}px`;
  }, [v]);
  const max = field.validation?.maxLength;
  return (
    <div className="fgl-input-wrap fgl-long">
      <textarea
        ref={ref}
        id={inputId}
        className="fgl-input fgl-textarea"
        rows={3}
        placeholder={field.placeholder ?? ''}
        value={v}
        maxLength={max}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        onChange={(e) => {
          onChange(e.target.value);
          tick();
        }}
      />
      {max ? (
        <span className="fgl-counter" aria-live="polite">
          {v.length}/{max}
        </span>
      ) : null}
    </div>
  );
}

export function DateInput({ field, value, onChange, inputId, describedBy, error }: FieldProps) {
  const type = field.type === 'time' ? 'time' : field.type === 'datetime' ? 'datetime-local' : 'date';
  return (
    <div className="fgl-input-wrap">
      <input
        id={inputId}
        className="fgl-input fgl-date"
        type={type}
        value={value == null ? '' : String(value)}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function DateRange({ value, onChange, inputId, describedBy, error }: FieldProps) {
  const v = (value ?? {}) as { start?: string; end?: string };
  return (
    <div className="fgl-grid-2">
      <label className="fgl-sub">
        <span>From</span>
        <input id={inputId} className="fgl-input fgl-date" type="date" value={v.start ?? ''} aria-invalid={!!error} aria-describedby={describedBy} onChange={(e) => onChange({ ...v, start: e.target.value })} />
      </label>
      <label className="fgl-sub">
        <span>Until</span>
        <input className="fgl-input fgl-date" type="date" value={v.end ?? ''} min={v.start} aria-invalid={!!error} onChange={(e) => onChange({ ...v, end: e.target.value })} />
      </label>
    </div>
  );
}

export function NameInput({ field, value, onChange, inputId, describedBy, error }: FieldProps) {
  const parts = field.config?.nameParts?.length ? field.config.nameParts : ['first', 'last'];
  const v = (value ?? {}) as Record<string, string>;
  const labels: Record<string, string> = { title: 'Title', first: 'First name', middle: 'Middle', last: 'Last name' };
  const autos: Record<string, string> = { title: 'honorific-prefix', first: 'given-name', middle: 'additional-name', last: 'family-name' };
  return (
    <div className={parts.length > 1 ? 'fgl-grid-2' : ''}>
      {parts.map((p, i) => (
        <label key={p} className="fgl-sub">
          <span>{labels[p]}</span>
          <input
            id={i === 0 ? inputId : undefined}
            className="fgl-input"
            autoComplete={autos[p]}
            value={v[p] ?? ''}
            aria-invalid={!!error}
            aria-describedby={i === 0 ? describedBy : undefined}
            onChange={(e) => {
              onChange({ ...v, [p]: e.target.value });
              tick();
            }}
          />
        </label>
      ))}
    </div>
  );
}

export function AddressInput({ field, value, onChange, inputId, describedBy, error }: FieldProps) {
  const parts = field.config?.addressParts?.length ? field.config.addressParts : ['line1', 'line2', 'city', 'state', 'zip', 'country'];
  const v = (value ?? {}) as Record<string, string>;
  const labels: Record<string, string> = { line1: 'Street address', line2: 'Apartment, suite…', city: 'City', state: 'State / province', zip: 'Postal code', country: 'Country' };
  const autos: Record<string, string> = { line1: 'address-line1', line2: 'address-line2', city: 'address-level2', state: 'address-level1', zip: 'postal-code', country: 'country-name' };
  return (
    <div className="fgl-grid-2">
      {parts.map((p, i) => (
        <label key={p} className={`fgl-sub${p === 'line1' || p === 'line2' ? ' span-2' : ''}`}>
          <span>{labels[p]}</span>
          {p === 'country' ? (
            <select className="fgl-input" value={v[p] ?? ''} autoComplete="country-name" onChange={(e) => onChange({ ...v, [p]: e.target.value })}>
              <option value="">—</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={i === 0 ? inputId : undefined}
              className="fgl-input"
              autoComplete={autos[p]}
              value={v[p] ?? ''}
              aria-invalid={!!error}
              aria-describedby={i === 0 ? describedBy : undefined}
              onChange={(e) => {
                onChange({ ...v, [p]: e.target.value });
                tick();
              }}
            />
          )}
        </label>
      ))}
    </div>
  );
}

export function CountrySelect({ field, value, onChange, inputId, describedBy, error }: FieldProps) {
  return (
    <div className="fgl-input-wrap fgl-select-wrap">
      <select id={inputId} className="fgl-input fgl-select" value={value == null ? '' : String(value)} aria-invalid={!!error} aria-describedby={describedBy} onChange={(e) => onChange(e.target.value)}>
        <option value="">{field.placeholder || 'Choose a country'}</option>
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}

const SWATCHES = ['#8e1b1b', '#c2572b', '#e0a43a', '#6f9346', '#2f6f73', '#34507a', '#6b4d8a', '#b24c7c', '#2b2320', '#f4efe6'];

export function ColorInput({ value, onChange, inputId, describedBy }: FieldProps) {
  const v = value == null ? '' : String(value);
  return (
    <div className="fgl-colors" role="radiogroup" aria-describedby={describedBy}>
      {SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={v === c}
          aria-label={c}
          className={`fgl-swatch${v === c ? ' on' : ''}`}
          style={{ background: c }}
          onClick={() => {
            onChange(c);
            sfx.select();
          }}
        />
      ))}
      <label className="fgl-swatch custom" title="Custom colour">
        <input id={inputId} type="color" value={v && v.startsWith('#') ? v : '#8e1b1b'} onChange={(e) => onChange(e.target.value)} aria-label="Custom colour" />
      </label>
      {v && <span className="fgl-color-value">{v}</span>}
    </div>
  );
}

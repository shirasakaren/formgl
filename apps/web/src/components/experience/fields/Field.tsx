'use client';
import { memo } from 'react';
import { isContentBlock, type AnswerValue, type FieldAnimation, type FormField } from '@formgl/shared';
import { Rich, type FieldProps } from './common';
import { AddressInput, ColorInput, CountrySelect, DateInput, DateRange, LongText, NameInput, PhoneInput, TextInput } from './inputs';
import { ChoiceGroup, Consent, Dropdown, MultiSelect, YesNo } from './choices';
import { Matrix, Ranking, Rating, Scale, Slider } from './scales';
import { FileUpload, Signature } from './media';
import { ContentBlock } from './content';

const CONTROLS: Partial<Record<FormField['type'], (p: FieldProps) => React.ReactNode>> = {
  short_text: TextInput,
  email: TextInput,
  url: TextInput,
  number: TextInput,
  currency: TextInput,
  phone: PhoneInput,
  long_text: LongText,
  multiple_choice: ChoiceGroup,
  checkboxes: ChoiceGroup,
  dropdown: Dropdown,
  multiselect: MultiSelect,
  yes_no: YesNo,
  consent: Consent,
  rating: Rating,
  scale: Scale,
  nps: Scale,
  slider: Slider,
  ranking: Ranking,
  matrix: Matrix,
  date: DateInput,
  time: DateInput,
  datetime: DateInput,
  date_range: DateRange,
  file_upload: FileUpload,
  image_upload: FileUpload,
  signature: Signature,
  color: ColorInput,
  name: NameInput,
  address: AddressInput,
  country: CountrySelect,
};

interface Props {
  field: FormField;
  value: AnswerValue | undefined;
  error?: string;
  index: number;
  animation: FieldAnimation;
  slug: string;
  demo: boolean;
  onChange: (id: string, v: AnswerValue) => void;
  onEnter?: () => void;
  /** a gentle nudge toward the field to fill next */
  hint?: 'start' | 'next';
}

function isFilled(v: AnswerValue | undefined): boolean {
  if (v === undefined || v === null || v === '' || v === false) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.values(v as Record<string, unknown>).some((x) => x !== '' && x !== undefined && x !== null);
  return true;
}

/** clicking anywhere on a field's row puts the caret in it */
function focusRow(e: React.MouseEvent<HTMLDivElement>) {
  const t = e.target as HTMLElement;
  if (t.closest('input, textarea, select, button, a, label, canvas, [role="slider"], [contenteditable]')) return;
  e.currentTarget.querySelector<HTMLElement>('input:not([type=hidden]), textarea, select, button, [tabindex="0"]')?.focus();
}

function FieldImpl({ field, value, error, index, animation, slug, demo, onChange, onEnter, hint }: Props) {
  const anim = field.animation ?? animation;
  const filled = isFilled(value);
  const cls = `fgl-field anim-${anim} w-${field.width ?? 'full'} t-${field.type}${error ? ' has-error' : ''}${filled ? ' is-filled' : ''}${hint ? ` is-next hint-${hint}` : ''}${field.required ? ' is-required' : ''}`;
  const style = { ['--i' as string]: index } as React.CSSProperties;
  if (isContentBlock(field.type)) {
    return (
      <div className={cls} style={style}>
        <ContentBlock field={field} />
      </div>
    );
  }
  const Control = CONTROLS[field.type];
  if (!Control) return null;
  const inputId = `fgl-${field.id}`;
  const descId = field.description ? `${inputId}-desc` : undefined;
  const errId = error ? `${inputId}-err` : undefined;
  const describedBy = [descId, errId].filter(Boolean).join(' ') || undefined;
  const isGroup = ['multiple_choice', 'checkboxes', 'multiselect', 'yes_no', 'rating', 'scale', 'nps', 'ranking', 'matrix', 'color'].includes(field.type);
  const Label = isGroup ? 'p' : 'label';
  return (
    <div className={cls} style={style} data-field={field.id} onClick={focusRow}>
      <span className="fgl-marker" aria-hidden>
        <span className="n">{index + 1}</span>
        <svg className="tick" viewBox="0 0 24 24">
          <path d="M5 12.5 L10 17 L19.5 6.5" fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {hint && (
        <span className="fgl-nudge" aria-hidden>
          {hint === 'start' ? 'Start here' : 'Next'}
          <svg viewBox="0 0 40 16">
            <path d="M2 10 C 12 2, 24 14, 36 6 M30 3 L36 6 L31 11" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
      {field.type !== 'consent' || field.label ? (
        <Label className="fgl-label" {...(isGroup ? { id: `${inputId}-label` } : { htmlFor: inputId })}>
          <span className="fgl-label-text">{field.label}</span>
          {field.required && (
            <span className="fgl-req" aria-label="required" title="Required">
              *
            </span>
          )}
        </Label>
      ) : null}
      {field.description && <Rich html={field.description} className="fgl-desc" />}
      {field.description && <span id={descId} className="sr-only">{field.description.replace(/<[^>]+>/g, ' ')}</span>}
      <div className="fgl-control">
        <Control field={field} value={value} onChange={(v) => onChange(field.id, v)} error={error} inputId={inputId} describedBy={describedBy} slug={slug} demo={demo} onEnter={onEnter} />
      </div>
      <p id={errId} className="fgl-error" role={error ? 'alert' : undefined} aria-live="polite">
        {error ?? ''}
      </p>
    </div>
  );
}

export const Field = memo(FieldImpl);

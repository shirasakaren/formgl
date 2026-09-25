'use client';

import type { ReactNode } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Copy, MousePointerClick, Trash2 } from 'lucide-react';
import { COUNTRIES, FIELD_META, isInputField, type FieldConfig, type FieldValidation, type FormField } from '@formgl/shared';
import { useEditor } from '@/lib/admin/editor-store';
import { Button, EmptyState, Field, Input, NumberInput, Segmented, Select, ToggleRow } from '../ui';
import { RichTextEditor } from '../RichTextEditor';
import { MediaInput } from '../UploadButton';
import { FieldIcon } from '../FieldIcon';
import { OptionsEditor } from './OptionsEditor';
import { LogicEditor } from './LogicEditor';

const ANIMATIONS = ['none', 'fade', 'rise', 'ink', 'typewriter', 'blur'] as const;
const PLACEHOLDER_TYPES = new Set(['short_text', 'long_text', 'email', 'phone', 'url', 'number', 'currency', 'dropdown', 'multiselect', 'country']);

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-(--line) px-4 py-4 first:border-t-0">
      <h4 className="text-[11px] font-semibold tracking-[0.08em] text-(--ink-3) uppercase">{title}</h4>
      {children}
    </section>
  );
}
const Grid2 = ({ children }: { children: ReactNode }) => <div className="grid grid-cols-2 gap-3">{children}</div>;

export function FieldProperties() {
  const form = useEditor((s) => s.form);
  const selectedId = useEditor((s) => s.selectedId);
  const updateField = useEditor((s) => s.updateField);
  const duplicateField = useEditor((s) => s.duplicateField);
  const removeField = useEditor((s) => s.removeField);
  const field = form?.fields.find((f) => f.id === selectedId);

  if (!form || !field)
    return (
      <EmptyState icon={MousePointerClick} title="Nothing selected">
        Choose a question on the letter to edit its details.
      </EmptyState>
    );

  const up = (patch: Partial<FormField>) => updateField(field.id, patch);
  const cfg = (patch: Partial<FieldConfig>) => up({ config: { ...field.config, ...patch } });
  const val = (patch: Partial<FieldValidation>) => up({ validation: { ...field.validation, ...patch } });
  const c = field.config ?? {};
  const v = field.validation ?? {};
  const meta = FIELD_META[field.type];
  const input = isInputField(field.type);
  const t = field.type;

  return (
    <div key={field.id}>
      <div className="flex items-center gap-2.5 border-b border-(--line) px-4 py-3">
        <span className="grid size-8 place-items-center rounded-lg bg-(--accent-soft) text-(--accent)">
          <FieldIcon type={t} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{meta?.label}</p>
          <p className="truncate text-xs text-(--ink-3)">{meta?.description}</p>
        </div>
        <Button size="sm" variant="ghost" icon={Copy} onClick={() => duplicateField(field.id)} aria-label="Duplicate field" title="Duplicate" />
        <Button size="sm" variant="ghost" icon={Trash2} onClick={() => removeField(field.id)} aria-label="Delete field" title="Delete" />
      </div>

      {/* ── Basics ── */}
      {t !== 'page_break' && (
        <Section title={input ? 'Question' : 'Content'}>
          {(input || t === 'heading') && (
            <Field label={t === 'heading' ? 'Heading text' : 'Label'}>
              {(id) => <Input id={id} value={field.label} onChange={(e) => up({ label: e.target.value })} placeholder="Ask something…" />}
            </Field>
          )}
          {input && t !== 'hidden' && (
            <div className="space-y-1.5">
              <p className="text-[13px] font-medium">Description</p>
              <RichTextEditor compact minHeight={56} label="Description" value={field.description ?? ''} onChange={(html) => up({ description: html || undefined })} placeholder="Optional help text…" />
            </div>
          )}
          {PLACEHOLDER_TYPES.has(t) && (
            <Field label="Placeholder">{(id) => <Input id={id} value={field.placeholder ?? ''} onChange={(e) => up({ placeholder: e.target.value || undefined })} />}</Field>
          )}
          {input && t !== 'hidden' && <ToggleRow label="Required" checked={!!field.required} onChange={(required) => up({ required })} />}
          {t !== 'hidden' && (
            <Grid2>
              <Field label="Width">
                {(id) => (
                  <Select id={id} value={field.width ?? 'full'} onChange={(e) => up({ width: e.target.value as FormField['width'] })}>
                    <option value="full">Full</option>
                    <option value="half">Half</option>
                  </Select>
                )}
              </Field>
              <Field label="Animation">
                {(id) => (
                  <Select id={id} value={field.animation ?? ''} onChange={(e) => up({ animation: (e.target.value || undefined) as FormField['animation'] })}>
                    <option value="">Theme default</option>
                    {ANIMATIONS.map((a) => (
                      <option key={a} value={a}>
                        {a[0].toUpperCase() + a.slice(1)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </Grid2>
          )}
        </Section>
      )}

      {t === 'page_break' && (
        <Section title="Page break">
          <p className="text-[13px] text-(--ink-2)">Everything after this starts on a fresh letter page.</p>
        </Section>
      )}

      {/* ── Options ── */}
      {meta?.hasOptions && (
        <Section title="Options">
          <OptionsEditor options={field.options ?? []} onChange={(options) => up({ options })} allowImages={t !== 'dropdown' && t !== 'ranking'} />
          {t !== 'ranking' && <ToggleRow label="Allow “Other”" hint="Adds a free-text option" checked={!!field.allowOther} onChange={(allowOther) => up({ allowOther })} />}
          <ToggleRow label="Shuffle order" checked={!!field.shuffle} onChange={(shuffle) => up({ shuffle })} />
          {(t === 'multiple_choice' || t === 'checkboxes') && (
            <Field label="Layout">
              {(id) => (
                <Select id={id} value={c.layout ?? 'list'} onChange={(e) => cfg({ layout: e.target.value as FieldConfig['layout'] })}>
                  <option value="list">List</option>
                  <option value="grid">Grid</option>
                  <option value="inline">Inline</option>
                  <option value="cards">Picture cards</option>
                </Select>
              )}
            </Field>
          )}
        </Section>
      )}

      {/* ── Type specific ── */}
      <TypeConfig field={field} cfg={cfg} val={val} c={c} v={v} />

      {/* ── Validation ── */}
      {(t === 'short_text' || t === 'long_text') && (
        <Section title="Validation">
          <Grid2>
            <Field label="Min length">{(id) => <NumberInput id={id} min={0} value={v.minLength} onValue={(minLength) => val({ minLength })} />}</Field>
            <Field label="Max length">{(id) => <NumberInput id={id} min={0} value={v.maxLength} onValue={(maxLength) => val({ maxLength })} />}</Field>
          </Grid2>
          <Field label="Pattern (regex)" hint="e.g. ^[A-Z]{3}\d{3}$">
            {(id) => <Input id={id} className="font-mono text-xs" value={v.pattern ?? ''} onChange={(e) => val({ pattern: e.target.value || undefined })} />}
          </Field>
          {v.pattern && <Field label="Pattern error message">{(id) => <Input id={id} value={v.patternMessage ?? ''} onChange={(e) => val({ patternMessage: e.target.value || undefined })} />}</Field>}
        </Section>
      )}
      {(t === 'number' || t === 'currency') && (
        <Section title="Validation">
          <div className="grid grid-cols-3 gap-2">
            <Field label="Min">{(id) => <NumberInput id={id} value={v.min} onValue={(min) => val({ min })} />}</Field>
            <Field label="Max">{(id) => <NumberInput id={id} value={v.max} onValue={(max) => val({ max })} />}</Field>
            <Field label="Step">{(id) => <NumberInput id={id} value={v.step} onValue={(step) => val({ step })} />}</Field>
          </div>
        </Section>
      )}
      {(t === 'checkboxes' || t === 'multiselect') && (
        <Section title="Validation">
          <Grid2>
            <Field label="Min selections">{(id) => <NumberInput id={id} min={0} value={v.minSelect} onValue={(minSelect) => val({ minSelect })} />}</Field>
            <Field label="Max selections">{(id) => <NumberInput id={id} min={0} value={v.maxSelect} onValue={(maxSelect) => val({ maxSelect })} />}</Field>
          </Grid2>
        </Section>
      )}
      {(t === 'file_upload' || t === 'image_upload') && (
        <Section title="Uploads">
          <Grid2>
            <Field label="Max files">{(id) => <NumberInput id={id} min={1} value={v.maxFiles} onValue={(maxFiles) => val({ maxFiles })} />}</Field>
            <Field label="Max size (MB)">{(id) => <NumberInput id={id} min={1} value={v.maxSizeMb} onValue={(maxSizeMb) => val({ maxSizeMb })} />}</Field>
          </Grid2>
          <Field label="Accepted types" hint="Comma separated, e.g. image/*, .pdf, .docx">
            {(id) => (
              <Input
                id={id}
                value={(v.accept ?? []).join(', ')}
                onChange={(e) => val({ accept: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                placeholder="Any file"
              />
            )}
          </Field>
        </Section>
      )}

      {/* ── Logic ── */}
      {t !== 'page_break' && t !== 'hidden' && (
        <Section title="Conditional logic">
          <LogicEditor field={field} fields={form.fields} onChange={(logic) => up({ logic })} />
        </Section>
      )}
    </div>
  );
}

function TypeConfig({ field, cfg, val, c, v }: { field: FormField; cfg: (p: Partial<FieldConfig>) => void; val: (p: Partial<FieldValidation>) => void; c: FieldConfig; v: FieldValidation }) {
  const t = field.type;
  const alignOpts = [
    { value: 'left' as const, label: '', icon: AlignLeft },
    { value: 'center' as const, label: '', icon: AlignCenter },
    { value: 'right' as const, label: '', icon: AlignRight },
  ];
  switch (t) {
    case 'rating':
      return (
        <Section title="Rating">
          <Grid2>
            <Field label="Maximum">{(id) => <NumberInput id={id} min={2} max={10} value={c.ratingMax ?? 5} onValue={(n) => cfg({ ratingMax: Math.min(10, Math.max(2, n ?? 5)) })} />}</Field>
            <Field label="Icon">
              {(id) => (
                <Select id={id} value={c.ratingIcon ?? 'star'} onChange={(e) => cfg({ ratingIcon: e.target.value as FieldConfig['ratingIcon'] })}>
                  {['star', 'heart', 'circle', 'thumb', 'flower'].map((x) => (
                    <option key={x} value={x}>
                      {x[0].toUpperCase() + x.slice(1)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </Grid2>
        </Section>
      );
    case 'scale':
    case 'nps':
    case 'slider':
      return (
        <Section title={t === 'nps' ? 'Labels' : 'Range'}>
          {t !== 'nps' && (
            <Grid2>
              <Field label="From">{(id) => <NumberInput id={id} value={c.scaleMin} onValue={(scaleMin) => cfg({ scaleMin })} />}</Field>
              <Field label="To">{(id) => <NumberInput id={id} value={c.scaleMax} onValue={(scaleMax) => cfg({ scaleMax })} />}</Field>
            </Grid2>
          )}
          {t === 'slider' ? (
            <div className="grid grid-cols-3 gap-2">
              <Field label="Step">{(id) => <NumberInput id={id} value={v.step} onValue={(step) => val({ step })} />}</Field>
              <Field label="Prefix">{(id) => <Input id={id} value={c.prefix ?? ''} onChange={(e) => cfg({ prefix: e.target.value })} />}</Field>
              <Field label="Suffix">{(id) => <Input id={id} value={c.suffix ?? ''} onChange={(e) => cfg({ suffix: e.target.value })} />}</Field>
            </div>
          ) : (
            <Grid2>
              <Field label="Low label">{(id) => <Input id={id} value={c.minLabel ?? ''} onChange={(e) => cfg({ minLabel: e.target.value })} />}</Field>
              <Field label="High label">{(id) => <Input id={id} value={c.maxLabel ?? ''} onChange={(e) => cfg({ maxLabel: e.target.value })} />}</Field>
            </Grid2>
          )}
        </Section>
      );
    case 'number':
    case 'currency':
      return (
        <Section title="Format">
          <div className="grid grid-cols-3 gap-2">
            {t === 'currency' && <Field label="Currency">{(id) => <Input id={id} maxLength={3} value={c.currency ?? ''} onChange={(e) => cfg({ currency: e.target.value.toUpperCase() })} placeholder="USD" />}</Field>}
            <Field label="Prefix">{(id) => <Input id={id} value={c.prefix ?? ''} onChange={(e) => cfg({ prefix: e.target.value })} />}</Field>
            <Field label="Suffix">{(id) => <Input id={id} value={c.suffix ?? ''} onChange={(e) => cfg({ suffix: e.target.value })} />}</Field>
          </div>
        </Section>
      );
    case 'matrix':
      return (
        <Section title="Grid">
          <p className="text-[13px] font-medium">Rows</p>
          <OptionsEditor options={c.rows ?? []} onChange={(rows) => cfg({ rows })} allowImages={false} noun="row" />
          <p className="pt-1 text-[13px] font-medium">Columns</p>
          <OptionsEditor options={c.columns ?? []} onChange={(columns) => cfg({ columns })} allowImages={false} noun="column" />
          <ToggleRow label="Multiple answers per row" checked={!!c.matrixMultiple} onChange={(matrixMultiple) => cfg({ matrixMultiple })} />
        </Section>
      );
    case 'yes_no':
      return (
        <Section title="Labels">
          <Grid2>
            <Field label="Yes label">{(id) => <Input id={id} value={c.yesLabel ?? ''} onChange={(e) => cfg({ yesLabel: e.target.value })} />}</Field>
            <Field label="No label">{(id) => <Input id={id} value={c.noLabel ?? ''} onChange={(e) => cfg({ noLabel: e.target.value })} />}</Field>
          </Grid2>
        </Section>
      );
    case 'hidden':
      return (
        <Section title="Hidden value">
          <Field label="URL parameter" hint={`Filled from ?${c.param || 'ref'}=value in the link`}>
            {(id) => <Input id={id} className="font-mono" value={c.param ?? ''} onChange={(e) => cfg({ param: e.target.value.replace(/[^\w-]/g, '') })} />}
          </Field>
        </Section>
      );
    case 'consent':
      return (
        <Section title="Agreement text">
          <RichTextEditor compact minHeight={56} label="Consent text" value={c.consentHtml ?? ''} onChange={(consentHtml) => cfg({ consentHtml })} />
        </Section>
      );
    case 'long_text':
      return (
        <Section title="Appearance">
          <Field label="Visible rows">{(id) => <NumberInput id={id} min={2} max={20} value={c.rows_} onValue={(rows_) => cfg({ rows_ })} placeholder="4" />}</Field>
        </Section>
      );
    case 'phone':
    case 'country':
      return (
        <Section title="Defaults">
          <Field label="Default country">
            {(id) => (
              <Select id={id} value={c.defaultCountry ?? ''} onChange={(e) => cfg({ defaultCountry: e.target.value || undefined })}>
                <option value="">Auto-detect</option>
                {COUNTRIES.map((x) => (
                  <option key={x.code} value={x.code}>
                    {x.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </Section>
      );
    case 'date':
      return (
        <Section title="Date">
          <ToggleRow label="Include time" checked={!!c.includeTime} onChange={(includeTime) => cfg({ includeTime })} />
        </Section>
      );
    case 'name':
    case 'address': {
      const all = t === 'name' ? (['title', 'first', 'middle', 'last'] as const) : (['line1', 'line2', 'city', 'state', 'zip', 'country'] as const);
      const key = t === 'name' ? 'nameParts' : 'addressParts';
      const cur = ((t === 'name' ? c.nameParts : c.addressParts) ?? []) as string[];
      return (
        <Section title="Parts">
          <div className="flex flex-wrap gap-1.5">
            {all.map((p) => {
              const on = cur.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={on}
                  onClick={() => cfg({ [key]: all.filter((x) => (x === p ? !on : cur.includes(x))) } as Partial<FieldConfig>)}
                  className={on ? 'rounded-full bg-(--accent) px-2.5 py-1 text-xs text-white' : 'rounded-full bg-(--paper-2) px-2.5 py-1 text-xs text-(--ink-2) hover:text-(--ink)'}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </Section>
      );
    }
    case 'heading':
      return (
        <Section title="Style">
          <div className="flex flex-wrap items-center gap-3">
            <Segmented label="Level" size="sm" value={c.level ?? 2} onChange={(level) => cfg({ level })} options={[1, 2, 3].map((l) => ({ value: l as 1 | 2 | 3, label: `H${l}` }))} />
            <Segmented label="Alignment" size="sm" value={c.align ?? 'left'} onChange={(align) => cfg({ align })} options={alignOpts} />
          </div>
        </Section>
      );
    case 'paragraph':
    case 'quote':
      return (
        <Section title={t === 'quote' ? 'Quote' : 'Text'}>
          <RichTextEditor minHeight={120} label={t === 'quote' ? 'Quote text' : 'Paragraph text'} value={c.html ?? ''} onChange={(html) => cfg({ html })} />
          {t === 'quote' && <Field label="Attribution">{(id) => <Input id={id} value={c.caption ?? ''} onChange={(e) => cfg({ caption: e.target.value })} placeholder="— Someone wise" />}</Field>}
        </Section>
      );
    case 'image':
    case 'video':
      return (
        <Section title={t === 'image' ? 'Image' : 'Video'}>
          <MediaInput
            label={t === 'image' ? 'Image source' : 'Video source'}
            kind={t}
            accept={t === 'image' ? 'image/*' : 'video/*'}
            placeholder={t === 'image' ? 'https://… or upload' : 'YouTube, Vimeo, .mp4 or upload'}
            value={c.src}
            onChange={(src) => cfg({ src: src ?? '' })}
          />
          {t === 'image' && <Field label="Alt text" hint="Describe the image for screen readers">{(id) => <Input id={id} value={c.alt ?? ''} onChange={(e) => cfg({ alt: e.target.value })} />}</Field>}
          <Field label="Caption">{(id) => <Input id={id} value={c.caption ?? ''} onChange={(e) => cfg({ caption: e.target.value })} />}</Field>
          <Field label={`Width · ${c.mediaWidth ?? 100}%`}>
            {(id) => <input id={id} type="range" min={20} max={100} step={5} value={c.mediaWidth ?? 100} onChange={(e) => cfg({ mediaWidth: Number(e.target.value) })} className="w-full" />}
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segmented label="Alignment" size="sm" value={c.align ?? 'center'} onChange={(align) => cfg({ align })} options={alignOpts} />
          </div>
          <ToggleRow label="Rounded corners" checked={c.rounded ?? true} onChange={(rounded) => cfg({ rounded })} />
          {t === 'video' && (
            <>
              <ToggleRow label="Autoplay" hint="Browsers require muted autoplay" checked={!!c.autoplay} onChange={(autoplay) => cfg({ autoplay, muted: autoplay ? true : c.muted })} />
              <ToggleRow label="Loop" checked={!!c.loop} onChange={(loop) => cfg({ loop })} />
              <ToggleRow label="Muted" checked={!!c.muted} onChange={(muted) => cfg({ muted })} />
            </>
          )}
        </Section>
      );
    case 'spacer':
      return (
        <Section title="Spacer">
          <Field label={`Height · ${c.height ?? 32}px`}>
            {(id) => <input id={id} type="range" min={8} max={200} step={4} value={c.height ?? 32} onChange={(e) => cfg({ height: Number(e.target.value) })} className="w-full" />}
          </Field>
        </Section>
      );
    case 'divider':
      return (
        <Section title="Divider">
          <Segmented label="Divider style" size="sm" value={c.divider ?? 'line'} onChange={(divider) => cfg({ divider })} options={(['line', 'dots', 'flourish', 'wave'] as const).map((d) => ({ value: d, label: d[0].toUpperCase() + d.slice(1) }))} />
        </Section>
      );
    default:
      return null;
  }
}

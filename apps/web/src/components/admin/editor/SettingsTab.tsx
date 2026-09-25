'use client';

import type { ReactNode } from 'react';
import type { FormSettings } from '@formgl/shared';
import { useEditor } from '@/lib/admin/editor-store';
import { fromLocalInput, toLocalInput } from '@/lib/admin/utils';
import { Card, Field, Input, NumberInput, Textarea, ToggleRow } from '../ui';
import { RichTextEditor } from '../RichTextEditor';
import { MediaInput } from '../UploadButton';

function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      {description && <p className="mt-0.5 text-[13px] text-(--ink-2)">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </Card>
  );
}
const G2 = ({ children }: { children: ReactNode }) => <div className="grid gap-4 sm:grid-cols-2">{children}</div>;

export function SettingsTab() {
  const form = useEditor((s) => s.form);
  const setSettings = useEditor((s) => s.setSettings);
  const setMeta = useEditor((s) => s.setMeta);
  if (!form) return null;
  const s = form.settings;
  const set = (p: Partial<FormSettings>) => setSettings(p);
  const text = (k: keyof FormSettings, label: string, hint?: string, placeholder?: string) => (
    <Field label={label} hint={hint}>
      {(id) => <Input id={id} value={(s[k] as string | undefined) ?? ''} placeholder={placeholder} onChange={(e) => set({ [k]: e.target.value } as Partial<FormSettings>)} />}
    </Field>
  );

  return (
    <div className="fgl-scroll min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
        <Panel title="Details">
          <Field label="Form title">{(id) => <Input id={id} value={form.title} onChange={(e) => setMeta({ title: e.target.value })} />}</Field>
          <Field label="Internal description" hint="Only visible to you">
            {(id) => <Textarea id={id} value={form.description ?? ''} onChange={(e) => setMeta({ description: e.target.value })} rows={2} />}
          </Field>
        </Panel>

        <Panel title="The letter" description="Framing words that make it feel handwritten.">
          <G2>
            {text('greeting', 'Greeting', undefined, 'Dear friend,')}
            <Field label="Questions per page" hint="Content blocks don’t count">
              {(id) => <NumberInput id={id} min={1} max={20} value={s.fieldsPerPage} onValue={(n) => set({ fieldsPerPage: Math.max(1, Math.min(20, n ?? 1)) })} />}
            </Field>
          </G2>
          <div className="space-y-1.5">
            <p className="text-[13px] font-medium">Introduction</p>
            <RichTextEditor label="Introduction" value={s.introHtml ?? ''} onChange={(introHtml) => set({ introHtml })} placeholder="A few words at the top of the first page…" />
          </div>
          <G2>
            {text('signOff', 'Sign off', undefined, 'With warmth,')}
            {text('signature', 'Signature', 'Written in script at the end')}
          </G2>
          <div className="grid gap-4 sm:grid-cols-3">
            {text('nextLabel', 'Next button')}
            {text('backLabel', 'Back button')}
            {text('submitLabel', 'Submit button')}
          </div>
          <div className="grid gap-x-6 sm:grid-cols-2">
            <ToggleRow label="Show progress" checked={s.showProgress} onChange={(showProgress) => set({ showProgress })} />
            <ToggleRow label="Show page numbers" checked={s.showPageNumbers} onChange={(showPageNumbers) => set({ showPageNumbers })} />
            <ToggleRow label="Allow saving progress" hint="Resume later on the same device" checked={s.allowSaveProgress} onChange={(allowSaveProgress) => set({ allowSaveProgress })} />
          </div>
        </Panel>

        <Panel title="After sending" description="What happens once the letter is sealed.">
          {text('thankYouHeading', 'Thank-you heading')}
          <div className="space-y-1.5">
            <p className="text-[13px] font-medium">Thank-you message</p>
            <RichTextEditor label="Thank-you message" value={s.thankYouHtml ?? ''} onChange={(thankYouHtml) => set({ thankYouHtml })} />
          </div>
          {text('redirectUrl', 'Redirect URL', 'Optional — send people somewhere after a few seconds', 'https://…')}
          <ToggleRow label="Confetti" checked={s.confetti} onChange={(confetti) => set({ confetti })} />
        </Panel>

        <Panel title="Availability & limits">
          <G2>
            <Field label="Opens at">
              {(id) => <Input id={id} type="datetime-local" value={toLocalInput(s.opensAt)} onChange={(e) => set({ opensAt: fromLocalInput(e.target.value) })} />}
            </Field>
            <Field label="Closes at">
              {(id) => <Input id={id} type="datetime-local" value={toLocalInput(s.closesAt)} onChange={(e) => set({ closesAt: fromLocalInput(e.target.value) })} />}
            </Field>
            <Field label="Response limit" hint="Leave empty for unlimited">
              {(id) => <NumberInput id={id} min={1} value={s.responseLimit ?? undefined} onValue={(n) => set({ responseLimit: n ?? null })} placeholder="Unlimited" />}
            </Field>
          </G2>
          {text('closedMessage', 'Closed message')}
          <div className="grid gap-x-6 sm:grid-cols-2">
            <ToggleRow label="One response per device" checked={s.onePerDevice} onChange={(onePerDevice) => set({ onePerDevice })} />
            <ToggleRow label="Collect location" hint="Approximate, from IP" checked={s.collectGeo} onChange={(collectGeo) => set({ collectGeo })} />
          </div>
        </Panel>

        <Panel title="Sharing & SEO">
          <Field label="Meta description">
            {(id) => <Textarea id={id} rows={2} maxLength={300} value={s.metaDescription ?? ''} onChange={(e) => set({ metaDescription: e.target.value || undefined })} placeholder="Shown in link previews" />}
          </Field>
          <Field label="Social preview image">{() => <MediaInput label="Social preview image" value={s.ogImageUrl} onChange={(ogImageUrl) => set({ ogImageUrl })} />}</Field>
          <ToggleRow label="Hide FormGL branding" checked={!!s.hideBranding} onChange={(hideBranding) => set({ hideBranding })} />
        </Panel>
      </div>
    </div>
  );
}

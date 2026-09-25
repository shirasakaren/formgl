'use client';

import { useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { ENVIRONMENTS, FONT_FAMILIES, type EnvironmentKey, type FontKey, type FormTheme, type LetterRuling, type LoaderStyle, type PageTransition, type PaperKind, type TimeOfDay } from '@formgl/shared';
import { useEditor } from '@/lib/admin/editor-store';
import { cn } from '@/lib/admin/utils';
import { Card, ColorField, Field, Input, Segmented, Select, ToggleRow } from '../ui';
import { MediaInput } from '../UploadButton';
import { PAPER_TEXTURE, SKY, ThemePreview, font } from './ThemePreview';

const PAPERS: PaperKind[] = ['cotton', 'laid', 'linen', 'kraft', 'parchment', 'watercolor'];
const LOADERS: LoaderStyle[] = ['mixed', 'ink', 'stamp', 'plane', 'leaves', 'minimal'];
const TRANSITIONS: PageTransition[] = ['flip', 'slide', 'fold', 'stack', 'fade'];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      {description && <p className="mt-0.5 text-[13px] text-(--ink-2)">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </Card>
  );
}

export function DesignTab({ livePreview = false }: { livePreview?: boolean }) {
  const form = useEditor((s) => s.form);
  const setTheme = useEditor((s) => s.setTheme);
  const [fontRole, setFontRole] = useState<'titleFont' | 'bodyFont' | 'labelFont'>('titleFont');
  if (!form) return null;
  const t = form.theme;
  const set = (p: Partial<FormTheme>) => setTheme(p);

  return (
    <div className="fgl-scroll min-h-0 flex-1 overflow-y-auto">
      <div className={cn('mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6', !livePreview && 'lg:grid-cols-[minmax(0,1fr)_340px]')}>
        <div className="order-2 space-y-5 lg:order-1">
          <Panel title="World" description="Where the letter is found. Each world has its own opening, loading scenes, sounds and send-off.">
            <div role="radiogroup" aria-label="Environment" className="grid gap-3 sm:grid-cols-2">
              {ENVIRONMENTS.map((env) => {
                const on = (t.environment ?? 'park') === env.key;
                return (
                  <button
                    key={env.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set({ environment: env.key as EnvironmentKey })}
                    className={cn('group overflow-hidden rounded-2xl border bg-white text-left transition-all', on ? 'border-(--accent) ring-2 ring-(--accent)/20' : 'border-(--line) hover:border-(--line-2)')}
                  >
                    <span className="relative block h-20" style={{ background: env.preview }}>
                      <span className="absolute bottom-2 left-3 rounded-full bg-white/85 px-2 py-0.5 text-[11px] font-medium text-(--ink-2)">{env.vessel}</span>
                      {on && <Check className="absolute top-2 right-2 size-5 rounded-full bg-white p-0.5 text-(--accent)" />}
                    </span>
                    <span className="block px-3 pt-2 pb-3">
                      <span className="block font-display text-[17px] font-semibold">{env.label}</span>
                      <span className="block text-[12.5px] text-(--ink-2)">{env.tagline}</span>
                      <span className="mt-1.5 block text-[12px] leading-snug text-(--ink-3) line-clamp-3">{env.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {(() => {
              const env = ENVIRONMENTS.find((e) => e.key === (t.environment ?? 'park'))!;
              const matches = Object.entries(env.suggest).every(([k, v]) => (t as unknown as Record<string, string>)[k]?.toLowerCase() === v.toLowerCase());
              return matches ? null : (
                <button type="button" onClick={() => set({ ...env.suggest })} className="inline-flex items-center gap-2 rounded-full border border-(--line) bg-white px-3 py-1.5 text-[13px] font-medium hover:border-(--line-2)">
                  <span className="flex -space-x-1">
                    {Object.values(env.suggest).map((c, i) => (
                      <span key={i} className="size-4 rounded-full border border-white" style={{ background: c }} />
                    ))}
                  </span>
                  Use this world’s colours
                </button>
              );
            })()}
            <Field label="Opening hint" hint={`Shown over the ${ENVIRONMENTS.find((e) => e.key === (t.environment ?? 'park'))!.vessel.toLowerCase()} — leave empty for the world’s own`}>
              {(id) => <Input id={id} value={t.openHint === 'Tap to open' ? '' : (t.openHint ?? '')} onChange={(e) => set({ openHint: e.target.value })} placeholder={ENVIRONMENTS.find((e) => e.key === (t.environment ?? 'park'))!.hint} />}
            </Field>
          </Panel>
          <Panel title="Scene" description="Light and atmosphere around the letter.">
            <div role="radiogroup" aria-label="Time of day" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {(Object.keys(SKY) as TimeOfDay[]).map((k) => {
                const [a, b, label] = SKY[k];
                const on = t.timeOfDay === k;
                return (
                  <button key={k} type="button" role="radio" aria-checked={on} onClick={() => set({ timeOfDay: k })} className={cn('overflow-hidden rounded-xl border bg-white text-left transition-all', on ? 'border-(--accent) ring-2 ring-(--accent)/20' : 'border-(--line) hover:border-(--line-2)')}>
                    <span className="relative block h-12" style={{ background: `linear-gradient(170deg, ${a}, ${b})` }}>
                      {on && <Check className="absolute top-1.5 right-1.5 size-4 rounded-full bg-white p-0.5 text-(--accent)" />}
                    </span>
                    <span className="block px-2 py-1.5 text-xs font-medium">{label}</span>
                  </button>
                );
              })}
            </div>
            <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              <ToggleRow label="Floating dust" checked={t.dust} onChange={(dust) => set({ dust })} />
              <ToggleRow label="Falling leaves" checked={t.fallingLeaves} onChange={(fallingLeaves) => set({ fallingLeaves })} />
              <ToggleRow label="Petals" checked={t.petals} onChange={(petals) => set({ petals })} />
              <ToggleRow label="Butterflies" checked={t.butterflies} onChange={(butterflies) => set({ butterflies })} />
              <ToggleRow label="Camera sway" checked={t.cameraSway} onChange={(cameraSway) => set({ cameraSway })} />
              <ToggleRow label="Ambient sound" hint="Birds & breeze" checked={t.ambientSound} onChange={(ambientSound) => set({ ambientSound })} />
            </div>
            <Field label={`Wind · ${Math.round(t.wind * 100)}%`}>
              {(id) => <input id={id} type="range" min={0} max={1} step={0.05} value={t.wind} onChange={(e) => set({ wind: Number(e.target.value) })} className="w-full" />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Background music URL" hint="mp3 / ogg — plays after the envelope opens">
                {(id) => <Input id={id} value={t.musicUrl ?? ''} onChange={(e) => set({ musicUrl: e.target.value || undefined })} placeholder="https://…" />}
              </Field>
              <Field label="Loading screen">
                {(id) => (
                  <Select id={id} value={t.loaderStyle} onChange={(e) => set({ loaderStyle: e.target.value as LoaderStyle })}>
                    {LOADERS.map((l) => (
                      <option key={l} value={l}>
                        {cap(l)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </Panel>

          <Panel title="Envelope" description="What respondents see first on the bench.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Envelope title" hint="Defaults to the form title">
                {(id) => <Input id={id} value={t.envelopeTitle ?? ''} onChange={(e) => set({ envelopeTitle: e.target.value || undefined })} placeholder={form.title} />}
              </Field>
              <Field label="Subtitle">{(id) => <Input id={id} value={t.envelopeSubtitle ?? ''} onChange={(e) => set({ envelopeSubtitle: e.target.value || undefined })} />}</Field>
              <Field label="Open hint">{(id) => <Input id={id} value={t.openHint ?? ''} onChange={(e) => set({ openHint: e.target.value || undefined })} />}</Field>
              <Field label="Seal monogram" hint="Used when there’s no logo">
                {(id) => <Input id={id} maxLength={2} value={t.sealMonogram ?? ''} onChange={(e) => set({ sealMonogram: e.target.value || undefined })} placeholder={form.title?.[0]} />}
              </Field>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <ColorField label="Envelope" value={t.envelopeColor} onChange={(envelopeColor) => set({ envelopeColor })} />
              <ColorField label="Liner" value={t.linerColor} onChange={(linerColor) => set({ linerColor })} />
              <ColorField label="Wax seal" value={t.sealColor} onChange={(sealColor) => set({ sealColor })} />
              <ColorField label="Loading screen" value={t.loaderColor} onChange={(loaderColor) => set({ loaderColor })} />
            </div>
            <PaperPicker label="Envelope paper" value={t.envelopePaper} color={t.envelopeColor} onChange={(envelopePaper) => set({ envelopePaper })} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Seal logo (stamp)">{() => <MediaInput label="Seal logo" value={t.logoUrl} onChange={(logoUrl) => set({ logoUrl })} />}</Field>
              <Field label="Cover image">{() => <MediaInput label="Cover image" value={t.coverImageUrl} onChange={(coverImageUrl) => set({ coverImageUrl })} />}</Field>
            </div>
            <Field label="Cover video" hint="YouTube, Vimeo or mp4 — shown on the first page of the letter">
              {() => <MediaInput label="Cover video" kind="video" accept="video/*" placeholder="https://youtube.com/…" value={t.coverVideoUrl} onChange={(coverVideoUrl) => set({ coverVideoUrl })} />}
            </Field>
          </Panel>

          <Panel title="Letter paper" description="The page your questions are written on.">
            <div className="grid gap-2 sm:grid-cols-2">
              <ColorField label="Paper" value={t.paperColor} onChange={(paperColor) => set({ paperColor })} />
              <ColorField label="Ink" value={t.inkColor} onChange={(inkColor) => set({ inkColor })} />
              <ColorField label="Accent" value={t.accentColor} onChange={(accentColor) => set({ accentColor })} />
              <ColorField label="Highlight" value={t.highlightColor} onChange={(highlightColor) => set({ highlightColor })} />
            </div>
            <PaperPicker label="Paper texture" value={t.paper} color={t.paperColor} onChange={(paper) => set({ paper })} />
            <Field label="Ruling">
              {() => <Segmented label="Ruling" value={t.ruling} onChange={(ruling: LetterRuling) => set({ ruling })} options={(['plain', 'lined', 'dotted', 'grid'] as const).map((r) => ({ value: r, label: cap(r) }))} />}
            </Field>
          </Panel>

          <Panel title="Typography" description="Fonts are handwritten on the letter — pick a voice for each role.">
            <Segmented
              label="Font role"
              value={fontRole}
              onChange={setFontRole}
              options={[
                { value: 'titleFont', label: 'Titles' },
                { value: 'bodyFont', label: 'Body & answers' },
                { value: 'labelFont', label: 'Question labels' },
              ]}
            />
            <div role="radiogroup" aria-label="Font" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(Object.keys(FONT_FAMILIES) as FontKey[]).map((k) => {
                const on = t[fontRole] === k;
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set({ [fontRole]: k } as Partial<FormTheme>)}
                    className={cn('rounded-xl border bg-white px-3 py-2.5 text-left transition-all', on ? 'border-(--accent) ring-2 ring-(--accent)/15' : 'border-(--line) hover:border-(--line-2)')}
                  >
                    <span className="block truncate text-[22px] leading-tight" style={{ fontFamily: font(k) }}>
                      Dear friend
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-(--ink-3)">{FONT_FAMILIES[k].label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-(--ink-3)">
              Titles: <b className="font-medium text-(--ink-2)">{FONT_FAMILIES[t.titleFont]?.family}</b> · Body: <b className="font-medium text-(--ink-2)">{FONT_FAMILIES[t.bodyFont]?.family}</b> · Labels:{' '}
              <b className="font-medium text-(--ink-2)">{FONT_FAMILIES[t.labelFont]?.family}</b>
            </p>
          </Panel>

          <Panel title="Inputs & motion">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Input style">
                {() => <Segmented label="Input style" value={t.inputStyle} onChange={(inputStyle) => set({ inputStyle })} options={(['underline', 'boxed', 'soft'] as const).map((s) => ({ value: s, label: cap(s) }))} />}
              </Field>
              <Field label={`Corner radius · ${t.inputRadius}px`}>
                {(id) => <input id={id} type="range" min={0} max={24} value={t.inputRadius} onChange={(e) => set({ inputRadius: Number(e.target.value) })} className="w-full" disabled={t.inputStyle === 'underline'} />}
              </Field>
              <Field label="Field animation">
                {(id) => (
                  <Select id={id} value={t.fieldAnimation} onChange={(e) => set({ fieldAnimation: e.target.value as FormTheme['fieldAnimation'] })}>
                    {['none', 'fade', 'rise', 'ink', 'typewriter', 'blur'].map((a) => (
                      <option key={a} value={a}>
                        {cap(a)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Page transition">
                {(id) => (
                  <Select id={id} value={t.pageTransition} onChange={(e) => set({ pageTransition: e.target.value as PageTransition })}>
                    {TRANSITIONS.map((a) => (
                      <option key={a} value={a}>
                        {cap(a)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </Panel>
        </div>

        <div className={cn('order-1 lg:order-2', livePreview && 'lg:hidden')}>
          <div className="lg:sticky lg:top-4">
            <p className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-(--ink-3) uppercase">Quick look</p>
            <ThemePreview theme={t} title={form.title} />
          </div>
        </div>
      </div>
    </div>
  );
}

function PaperPicker({ label, value, color, onChange }: { label: string; value: PaperKind; color: string; onChange: (p: PaperKind) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium">{label}</p>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {PAPERS.map((p) => {
          const on = value === p;
          return (
            <button key={p} type="button" role="radio" aria-checked={on} onClick={() => onChange(p)} className={cn('overflow-hidden rounded-lg border text-left transition-all', on ? 'border-(--accent) ring-2 ring-(--accent)/15' : 'border-(--line) hover:border-(--line-2)')}>
              <span className="block h-9" style={{ background: color, backgroundImage: PAPER_TEXTURE[p], backgroundSize: '5px 5px' }} />
              <span className="block bg-white px-1.5 py-1 text-[11px] font-medium">{cap(p)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Globe, Laptop, Link2, MapPin, Monitor, Smartphone, Star, Tablet, Trash2, Wifi } from 'lucide-react';
import { isInputField, type FormField, type FormResponse } from '@formgl/shared';
import { api } from '@/lib/admin/api';
import { cn, fmtDateTime, fmtDuration } from '@/lib/admin/utils';
import { Button, Chip, Drawer, IconButton, Input, Textarea } from '../ui';
import { AnswerView } from './AnswerView';

interface Props {
  response: FormResponse | null;
  fields: FormField[];
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onPatch: (id: string, patch: Partial<Pick<FormResponse, 'starred' | 'tags' | 'note'>>) => void;
  onDelete: (id: string) => void;
  position?: string;
}

export function ResponseDrawer({ response, fields, onClose, onPrev, onNext, onPatch, onDelete, position }: Props) {
  const [note, setNote] = useState('');
  const [tag, setTag] = useState('');
  useEffect(() => setNote(response?.note ?? ''), [response?.id, response?.note]);

  useEffect(() => {
    if (!response) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea')) return;
      if (e.key === 'ArrowLeft' || e.key === 'k') onPrev?.();
      if (e.key === 'ArrowRight' || e.key === 'j') onNext?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [response, onPrev, onNext]);

  if (!response) return null;
  const m = response.meta ?? {};
  const DeviceIcon = m.device === 'mobile' ? Smartphone : m.device === 'tablet' ? Tablet : m.device === 'desktop' ? Monitor : Laptop;
  const addTag = () => {
    const t = tag.trim();
    if (!t) return;
    const tags = Array.from(new Set([...(response.tags ?? []), t]));
    onPatch(response.id, { tags });
    setTag('');
  };
  const inputFields = fields.filter((f) => isInputField(f.type));
  const extraKeys = Object.keys(response.answers).filter((k) => !fields.some((f) => f.id === k));

  return (
    <Drawer
      open
      onClose={onClose}
      width="max-w-2xl"
      title={
        <div className="flex items-center gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{fmtDateTime(response.createdAt)}</p>
            {position && <p className="text-xs text-(--ink-3)">Response {position}</p>}
          </div>
          <div className="ml-auto flex items-center gap-0.5">
            <IconButton icon={ChevronLeft} label="Previous response" onClick={onPrev} disabled={!onPrev} />
            <IconButton icon={ChevronRight} label="Next response" onClick={onNext} disabled={!onNext} />
            <IconButton icon={Star} label={response.starred ? 'Unstar' : 'Star'} active={!!response.starred} onClick={() => onPatch(response.id, { starred: !response.starred })} className={response.starred ? '[&_svg]:fill-current' : ''} />
          </div>
        </div>
      }
      footer={
        <div className="flex justify-between">
          <Button variant="danger" size="sm" icon={Trash2} onClick={() => onDelete(response.id)}>
            Delete response
          </Button>
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-5 p-5">
        <section className="rounded-xl border border-(--line) bg-white">
          <ol className="divide-y divide-(--line)">
            {inputFields.map((f, i) => (
              <li key={f.id} className="px-4 py-3.5">
                <p className="text-xs font-medium text-(--ink-3)">
                  {i + 1}. {f.label || f.type}
                </p>
                <div className="mt-1 text-[15px] text-(--ink)">
                  <AnswerView field={f} value={response.answers[f.id]} />
                </div>
              </li>
            ))}
            {extraKeys.map((k) => (
              <li key={k} className="px-4 py-3.5">
                <p className="text-xs font-medium text-(--ink-3)">{k} <span className="italic">(removed field)</span></p>
                <div className="mt-1 text-[15px]">
                  <AnswerView value={response.answers[k]} />
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="resp-note" className="text-[13px] font-medium">Private note</label>
            <Textarea id="resp-note" value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (response.note ?? '') && onPatch(response.id, { note })} rows={3} placeholder="Only you can see this…" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="resp-tag" className="text-[13px] font-medium">Tags</label>
            <div className="flex gap-1.5">
              <Input id="resp-tag" value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="Add a tag…" />
              <Button onClick={addTag} disabled={!tag.trim()}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {(response.tags ?? []).map((t) => (
                <Chip key={t} className="bg-(--accent-soft) text-(--accent)" onRemove={() => onPatch(response.id, { tags: (response.tags ?? []).filter((x) => x !== t) })}>
                  {t}
                </Chip>
              ))}
            </div>
          </div>
        </section>

        <Journey id={response.id} submittedAt={response.createdAt} />
        <section className="rounded-xl border border-(--line) bg-white p-4">
          <h4 className="mb-3 text-[11px] font-semibold tracking-[0.08em] text-(--ink-3) uppercase">Details</h4>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Meta icon={Clock} label="Submitted" value={fmtDateTime(response.createdAt)} />
            <Meta icon={Clock} label="Time to complete" value={fmtDuration(m.durationMs)} />
            <Meta icon={MapPin} label="Location" value={[m.city, m.region, m.country].filter(Boolean).join(', ') || '—'} />
            <Meta icon={Wifi} label="IP address" value={m.ip || '—'} mono />
            <Meta icon={DeviceIcon} label="Device" value={[m.device, m.screen].filter(Boolean).join(' · ') || '—'} capitalize />
            <Meta icon={Globe} label="Browser / OS" value={[m.browser, m.os].filter(Boolean).join(' on ') || '—'} />
            <Meta icon={Link2} label="Referrer" value={m.referrer || 'Direct'} />
            <Meta icon={Globe} label="Locale / timezone" value={[m.locale, m.timezone].filter(Boolean).join(' · ') || '—'} />
            {m.utm && Object.keys(m.utm).length > 0 && <Meta icon={Link2} label="UTM" value={Object.entries(m.utm).map(([k, v]) => `${k}=${v}`).join(' · ')} />}
          </dl>
          {m.userAgent && <p className="mt-3 border-t border-(--line) pt-3 font-mono text-[11px] break-all text-(--ink-3)">{m.userAgent}</p>}
        </section>
      </div>
    </Drawer>
  );
}

function Meta({ icon: Icon, label, value, mono, capitalize }: { icon: typeof Clock; label: string; value: string; mono?: boolean; capitalize?: boolean }) {
  return (
    <div className="flex min-w-0 gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-(--ink-3)" aria-hidden />
      <div className="min-w-0">
        <dt className="text-xs text-(--ink-3)">{label}</dt>
        <dd className={cn('break-words', mono && 'font-mono text-[13px]', capitalize && 'capitalize')}>{value}</dd>
      </div>
    </div>
  );
}

const STEP: Record<string, string> = {
  view: 'Arrived',
  loaded: 'Scene loaded',
  open: 'Opened the letter',
  start: 'Started writing',
  page: 'Turned to page',
  abandon: 'Left the page',
  submit: 'Sent the reply',
};

/** the respondent's path: arrival → opening → pages → reply, with the time each step took */
function Journey({ id, submittedAt }: { id: string; submittedAt: string }) {
  const [steps, setSteps] = useState<Array<{ type: string; page: number | null; at: string }> | null>(null);
  useEffect(() => {
    setSteps(null);
    api.responses
      .journey(id)
      .then(setSteps)
      .catch(() => setSteps([]));
  }, [id]);
  if (!steps || steps.length === 0) return null;
  const list = steps.some((s) => s.type === 'submit') ? steps : [...steps, { type: 'submit', page: null, at: submittedAt }];
  const t0 = new Date(list[0].at).getTime();
  return (
    <section className="rounded-xl border border-(--line) bg-white p-4">
      <h3 className="mb-3 text-[11px] font-semibold tracking-[0.12em] text-(--ink-3) uppercase">Journey</h3>
      <ol className="relative space-y-2.5 border-l border-(--line) pl-4">
        {list.map((s, i) => {
          const at = new Date(s.at).getTime();
          const next = list[i + 1] ? new Date(list[i + 1].at).getTime() : null;
          return (
            <li key={i} className="relative text-[13px]">
              <span className={cn('absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-white', s.type === 'submit' ? 'bg-[#2f7a4a]' : s.type === 'abandon' ? 'bg-(--accent)' : 'bg-(--line-2)')} aria-hidden />
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">
                  {STEP[s.type] ?? s.type}
                  {s.type === 'page' && s.page != null ? ` ${s.page}` : ''}
                </span>
                <span className="shrink-0 text-[11.5px] tabular-nums text-(--ink-3)">+{fmtDuration(at - t0) || '0s'}</span>
              </div>
              {next != null && next - at > 1000 && <p className="text-[11.5px] text-(--ink-3)">{fmtDuration(next - at)} here</p>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

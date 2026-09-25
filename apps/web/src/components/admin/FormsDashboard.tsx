'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { BarChart3, Copy, CopyPlus, ExternalLink, Eye, FileText, Inbox, LayoutGrid, List, MoreHorizontal, PenSquare, Pin, PinOff, Plus, Search, Trash2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { environmentMeta, type FormStatus, type FormSummary } from '@formgl/shared';
import { api, errorMessage, type OverviewData } from '@/lib/admin/api';
import { CHART_COLORS, cn, copyText, fmtAgo, fmtCompact, fmtDate, fmtNum, fmtPct, publicUrl } from '@/lib/admin/utils';
import { PageHeader } from './AdminShell';
import { Button, Card, ConfirmDialog, EmptyState, IconButton, Input, Menu, MenuItem, PageLoader, Segmented, StatusBadge } from './ui';
import { WorldSwatch } from './WorldSwatch';
import { TemplateGallery } from './TemplateGallery';

export function FormsDashboard() {
  const router = useRouter();
  const [forms, setForms] = useState<FormSummary[] | null>(null);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | FormStatus>('all');
  const [sort, setSort] = useState<'updated' | 'responses' | 'recent' | 'az'>('updated');
  const [view, setViewState] = useState<'grid' | 'list'>('grid');
  useEffect(() => {
    try {
      const v = window.localStorage.getItem('fgl_admin_view');
      if (v === 'list' || v === 'grid') setViewState(v);
    } catch {
      /* noop */
    }
  }, []);
  const setView = (v: 'grid' | 'list') => {
    setViewState(v);
    try {
      window.localStorage.setItem('fgl_admin_view', v);
    } catch {
      /* noop */
    }
  };
  const [gallery, setGallery] = useState(false);
  const [toDelete, setToDelete] = useState<FormSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    api.forms.list().then(setForms).catch((e) => {
      toast.error(errorMessage(e));
      setForms([]);
    });
    api.overview().then(setOverview).catch(() => setOverview(null));
  }, []);
  useEffect(load, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = (forms ?? []).filter((f) => (status === 'all' || f.status === status) && (!s || f.title.toLowerCase().includes(s) || f.slug.toLowerCase().includes(s)));
    const by: Record<typeof sort, (a: FormSummary, b: FormSummary) => number> = {
      updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      responses: (a, b) => b.responseCount - a.responseCount,
      recent: (a, b) => (b.lastResponseAt ?? '').localeCompare(a.lastResponseAt ?? ''),
      az: (a, b) => (a.title || '').localeCompare(b.title || ''),
    };
    // pinned letters always stay on top
    return list.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || by[sort](a, b));
  }, [forms, q, status, sort]);

  const togglePin = async (f: FormSummary) => {
    const pinned = !f.pinned;
    setForms((l) => (l ?? []).map((x) => (x.id === f.id ? { ...x, pinned } : x)));
    try {
      await api.forms.pin(f.id, pinned);
    } catch (e) {
      setForms((l) => (l ?? []).map((x) => (x.id === f.id ? { ...x, pinned: !pinned } : x)));
      toast.error(errorMessage(e));
    }
  };

  const duplicate = async (f: FormSummary) => {
    try {
      const copy = await api.forms.duplicate(f.id);
      toast.success('Duplicated');
      router.push(`/admin/forms/${copy.id}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.forms.remove(toDelete.id);
      setForms((l) => (l ?? []).filter((x) => x.id !== toDelete.id));
      toast.success('Form deleted');
      setToDelete(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  const counts = useMemo(() => {
    const c = { all: forms?.length ?? 0, draft: 0, published: 0, closed: 0 };
    forms?.forEach((f) => c[f.status]++);
    return c;
  }, [forms]);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <PageHeader
        title="Your letters"
        subtitle="Craft, send and read immersive forms."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setGallery(true)}>
            New form
          </Button>
        }
      />

      <Overview data={overview} forms={forms} />
      <LatestReplies data={overview} />

      <section aria-label="Forms" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--ink-3)" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search forms…" aria-label="Search forms" className="pl-9" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              label="Filter by status"
              value={status}
              onChange={setStatus}
              size="sm"
              options={(['all', 'published', 'draft', 'closed'] as const).map((s) => ({ value: s, label: `${s[0].toUpperCase()}${s.slice(1)} · ${counts[s]}` }))}
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              aria-label="Sort forms"
              className="h-8 rounded-lg border border-(--line) bg-white px-2 text-[12.5px] text-(--ink-2) hover:border-(--line-2) focus:outline-none"
            >
              <option value="updated">Recently edited</option>
              <option value="recent">Latest reply</option>
              <option value="responses">Most replies</option>
              <option value="az">A → Z</option>
            </select>
            <Segmented
              label="View"
              value={view}
              onChange={setView}
              size="sm"
              options={[
                { value: 'grid', label: '', icon: LayoutGrid },
                { value: 'list', label: '', icon: List },
              ]}
            />
          </div>
        </div>

        {forms === null ? (
          <PageLoader label="Gathering your letters…" />
        ) : filtered.length === 0 ? (
          <Card>
            {forms.length === 0 ? (
              <EmptyState icon={Mail} title="No letters yet" action={<Button variant="primary" icon={Plus} onClick={() => setGallery(true)}>Create your first form</Button>}>
                Start from a template — a wedding RSVP, feedback survey, guest book — or a blank sheet.
              </EmptyState>
            ) : (
              <EmptyState icon={Search} title="Nothing matches">
                Try a different search or status filter.
              </EmptyState>
            )}
          </Card>
        ) : (
          view === 'grid' ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((f) => (
                <FormCard key={f.id} form={f} onDuplicate={() => duplicate(f)} onDelete={() => setToDelete(f)} onPin={() => togglePin(f)} />
              ))}
            </div>
          ) : (
            <FormTable forms={filtered} onPin={togglePin} onDuplicate={duplicate} onDelete={setToDelete} />
          )
        )}
      </section>

      <TemplateGallery open={gallery} onClose={() => setGallery(false)} />
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={remove}
        loading={deleting}
        title="Delete this form?"
        confirmLabel="Delete forever"
        message={
          <>
            <strong className="text-(--ink)">{toDelete?.title}</strong> and all of its {fmtNum(toDelete?.responseCount ?? 0)} responses and analytics will be permanently removed.
          </>
        }
      />
    </div>
  );
}

function Overview({ data, forms }: { data: OverviewData | null; forms: FormSummary[] | null }) {
  const totalForms = data?.forms ?? forms?.length ?? 0;
  const published = data?.published ?? forms?.filter((f) => f.status === 'published').length ?? 0;
  const responses = data?.responses ?? forms?.reduce((a, f) => a + f.responseCount, 0) ?? 0;
  const views = data?.views ?? forms?.reduce((a, f) => a + f.viewCount, 0) ?? 0;
  const last30 = data?.last30 ?? [];
  const sum30 = last30.reduce((a, d) => ({ v: a.v + d.views, s: a.s + d.submissions }), { v: 0, s: 0 });
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1.6fr]">
      <Stat icon={FileText} label="Forms" value={fmtNum(totalForms)} sub={`${published} published`} />
      <Stat icon={Inbox} label="Responses" value={fmtCompact(responses)} sub={`${fmtNum(sum30.s)} in the last 30 days`} />
      <Stat icon={Eye} label="Views" value={fmtCompact(views)} sub={views ? `${fmtPct(responses / Math.max(views, 1))} reply rate` : 'No views yet'} />
      <Card className="p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[13px] font-medium text-(--ink-2)">Last 30 days</p>
          <p className="flex items-center gap-3 text-xs text-(--ink-2)">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded" style={{ background: CHART_COLORS[3] }} /> Views
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded" style={{ background: CHART_COLORS[0] }} /> Responses
            </span>
          </p>
        </div>
        <div className="mt-2 h-[72px]">
          {last30.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={last30} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="ov-v" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor={CHART_COLORS[3]} stopOpacity={0.18} />
                    <stop offset="1" stopColor={CHART_COLORS[3]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <Tooltip
                  cursor={{ stroke: '#d8ccbc' }}
                  contentStyle={{ borderRadius: 10, border: '1px solid #e6ddd0', fontSize: 12 }}
                  labelFormatter={(l) => fmtDate(String(l))}
                />
                <Area type="monotone" dataKey="views" name="Views" stroke={CHART_COLORS[3]} strokeWidth={2} fill="url(#ov-v)" dot={false} />
                <Area type="monotone" dataKey="submissions" name="Responses" stroke={CHART_COLORS[0]} strokeWidth={2} fill="transparent" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-full place-items-center rounded-lg bg-(--paper) text-xs text-(--ink-3)">Activity will appear here</div>
          )}
        </div>
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: typeof Eye; label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-[13px] font-medium text-(--ink-2)">
        <Icon className="size-4 text-(--accent)" aria-hidden />
        {label}
      </div>
      <p className="font-display mt-2 text-4xl leading-none font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-1.5 text-xs text-(--ink-3)">{sub}</p>}
    </Card>
  );
}

/** 14-day reply sparkline */
function Spark({ values, color = '#8e1b1b', className }: { values?: number[]; color?: string; className?: string }) {
  const v = values?.length ? values : new Array(14).fill(0);
  const max = Math.max(1, ...v);
  const pts = v.map((n, i) => `${(i / (v.length - 1)) * 100},${28 - (n / max) * 24}`).join(' ');
  const total = v.reduce((a, b) => a + b, 0);
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={cn('h-7 w-full overflow-visible', className)} role="img" aria-label={`${total} replies in the last 14 days`}>
      <polyline points={`0,30 ${pts} 100,30`} fill={color} fillOpacity=".08" stroke="none" />
      <polyline points={pts} fill="none" stroke={color} strokeOpacity={total ? 1 : 0.25} strokeDasharray={total ? undefined : '2 3'} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

function FormCard({ form, onDuplicate, onDelete, onPin }: { form: FormSummary; onDuplicate: () => void; onDelete: () => void; onPin: () => void }) {
  const url = publicUrl(form.slug);
  const isLive = form.status === 'published';
  const copy = async () => ((await copyText(url)) ? toast.success('Link copied') : toast.error('Could not copy'));
  const t = form.theme ?? ({} as FormSummary['theme']);
  return (
    <Card className="group relative flex flex-col overflow-hidden transition-shadow hover:shadow-[0_16px_36px_-18px_rgba(60,40,20,.35)]">
      <Link
        href={`/admin/forms/${form.id}`}
        className="relative flex h-32 items-center justify-center overflow-hidden"
        style={{ background: `${environmentMeta(t.environment).preview}` }}
        aria-label={`Edit ${form.title}`}
      >
        <span className="absolute inset-0 bg-white/35" aria-hidden />
        <WorldSwatch
          world={t.environment}
          envelope={t.envelopeColor || '#efe6d6'}
          seal={t.sealColor || '#8e1b1b'}
          paper={t.paperColor}
          accent={t.accentColor}
          logoUrl={t.logoUrl}
          monogram={form.title?.[0]}
          className="relative w-32 transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-[-2deg]"
        />
        <span className="absolute top-3 left-3 flex items-center gap-1.5">
          <StatusBadge status={form.status} />
          {form.hasUnpublishedChanges && form.status === 'published' && (
            <span className="rounded-full bg-[#fdf3dc] px-2 py-0.5 text-[11px] font-medium text-[#8a6412]" title="The draft has edits respondents don’t see yet">
              Unpublished edits
            </span>
          )}
        </span>
        <span className="absolute right-3 bottom-2.5 rounded-full bg-white/80 px-2 py-0.5 text-[10.5px] font-medium text-(--ink-2)">{environmentMeta(t.environment).label}</span>
      </Link>
      <button
        onClick={onPin}
        aria-label={form.pinned ? 'Unpin' : 'Pin to top'}
        title={form.pinned ? 'Unpin' : 'Pin to top'}
        className={cn(
          'absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-full bg-white/85 text-(--ink-2) shadow-sm transition-opacity hover:text-(--accent)',
          form.pinned ? 'text-(--accent) opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
        )}
      >
        <Pin className={cn('size-4', form.pinned && 'fill-current')} />
      </button>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/admin/forms/${form.id}`} className="block truncate text-[15px] font-semibold hover:text-(--accent)">
              {form.title || 'Untitled'}
            </Link>
            {isLive ? (
              <a href={`/${form.slug}`} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate font-mono text-xs text-(--ink-2) hover:text-(--accent)">
                /{form.slug} <ExternalLink className="size-3 shrink-0" aria-hidden />
              </a>
            ) : (
              <span className="mt-0.5 block truncate font-mono text-xs text-(--ink-3)">/{form.slug}</span>
            )}
          </div>
          <Menu trigger={(p) => <IconButton icon={MoreHorizontal} label="More actions" size="sm" {...p} />}>
            {(close) => (
              <>
                <MenuItem icon={PenSquare} href={`/admin/forms/${form.id}`}>Edit</MenuItem>
                <MenuItem icon={Inbox} href={`/admin/forms/${form.id}/responses`}>Responses</MenuItem>
                <MenuItem icon={BarChart3} href={`/admin/forms/${form.id}/analytics`}>Analytics</MenuItem>
                <MenuItem icon={Copy} onClick={() => { close(); copy(); }}>Copy link</MenuItem>
                <MenuItem icon={ExternalLink} href={isLive ? `/${form.slug}` : `/${form.slug}?preview=1`} target="_blank" onClick={close}>{isLive ? 'Open' : 'Preview'}</MenuItem>
                <MenuItem icon={form.pinned ? PinOff : Pin} onClick={() => { close(); onPin(); }}>{form.pinned ? 'Unpin' : 'Pin to top'}</MenuItem>
                <MenuItem icon={CopyPlus} onClick={() => { close(); onDuplicate(); }}>Duplicate</MenuItem>
                <div className="my-1 h-px bg-(--line)" />
                <MenuItem icon={Trash2} danger onClick={() => { close(); onDelete(); }}>Delete</MenuItem>
              </>
            )}
          </Menu>
        </div>
        <Spark values={form.spark} color={t.sealColor || '#8e1b1b'} className="mt-3" />
        <dl className="mt-2 grid grid-cols-3 gap-2 border-t border-(--line) pt-3 text-xs">
          <div>
            <dt className="text-(--ink-3)">Responses</dt>
            <dd className="mt-0.5 text-[15px] font-semibold tabular-nums">{fmtNum(form.responseCount)}</dd>
          </div>
          <div>
            <dt className="text-(--ink-3)">Views</dt>
            <dd className="mt-0.5 text-[15px] font-semibold tabular-nums">{fmtNum(form.viewCount)}</dd>
          </div>
          <div>
            <dt className="text-(--ink-3)">Last reply</dt>
            <dd className="mt-0.5 truncate text-[13px] font-medium" title={form.lastResponseAt ? fmtDate(form.lastResponseAt) : undefined}>
              {form.lastResponseAt ? fmtAgo(form.lastResponseAt).replace(' ago', '') : '—'}
            </dd>
          </div>
        </dl>
        <div className="mt-3 flex gap-1.5">
          <Link href={`/admin/forms/${form.id}/responses`} className={cn('flex-1 rounded-lg bg-(--paper) py-1.5 text-center text-xs font-medium text-(--ink-2) transition-colors hover:bg-(--paper-2) hover:text-(--ink)')}>
            Responses
          </Link>
          <Link href={`/admin/forms/${form.id}/analytics`} className="flex-1 rounded-lg bg-(--paper) py-1.5 text-center text-xs font-medium text-(--ink-2) transition-colors hover:bg-(--paper-2) hover:text-(--ink)">
            Analytics
          </Link>
          <button onClick={copy} className="rounded-lg bg-(--paper) px-2.5 text-(--ink-2) transition-colors hover:bg-(--paper-2) hover:text-(--ink)" aria-label="Copy link" title="Copy link">
            <Copy className="size-3.5" />
          </button>
        </div>
      </div>
    </Card>
  );
}

function FormTable({ forms, onPin, onDuplicate, onDelete }: { forms: FormSummary[]; onPin: (f: FormSummary) => void; onDuplicate: (f: FormSummary) => void; onDelete: (f: FormSummary) => void }) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-[13px]">
        <thead className="border-b border-(--line) text-[11.5px] tracking-wide text-(--ink-3) uppercase">
          <tr>
            <th className="w-10 px-3 py-2.5" aria-label="Pinned" />
            <th className="px-3 py-2.5 font-semibold">Letter</th>
            <th className="px-3 py-2.5 font-semibold">World</th>
            <th className="px-3 py-2.5 font-semibold">Status</th>
            <th className="px-3 py-2.5 text-right font-semibold">Replies</th>
            <th className="w-32 px-3 py-2.5 font-semibold">14 days</th>
            <th className="px-3 py-2.5 font-semibold">Last reply</th>
            <th className="w-10 px-3 py-2.5" aria-label="Actions" />
          </tr>
        </thead>
        <tbody className="divide-y divide-(--line)">
          {forms.map((f) => (
            <tr key={f.id} className="group hover:bg-(--paper)">
              <td className="px-3 py-2">
                <button onClick={() => onPin(f)} aria-label={f.pinned ? 'Unpin' : 'Pin to top'} className={cn('grid size-7 place-items-center rounded-md hover:bg-white', f.pinned ? 'text-(--accent)' : 'text-(--ink-3) opacity-0 group-hover:opacity-100 focus-visible:opacity-100')}>
                  <Pin className={cn('size-3.5', f.pinned && 'fill-current')} />
                </button>
              </td>
              <td className="max-w-[280px] px-3 py-2">
                <Link href={`/admin/forms/${f.id}`} className="block truncate font-semibold hover:text-(--accent)">
                  {f.title || 'Untitled'}
                </Link>
                <span className="block truncate font-mono text-[11.5px] text-(--ink-3)">/{f.slug}</span>
              </td>
              <td className="px-3 py-2 text-(--ink-2)">{environmentMeta(f.theme?.environment).label}</td>
              <td className="px-3 py-2">
                <span className="flex items-center gap-1.5">
                  <StatusBadge status={f.status} />
                  {f.hasUnpublishedChanges && f.status === 'published' && <span className="size-2 rounded-full bg-[#d9a520]" title="Unpublished edits" />}
                </span>
              </td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtNum(f.responseCount)}</td>
              <td className="px-3 py-2">
                <Spark values={f.spark} color={f.theme?.sealColor || '#8e1b1b'} />
              </td>
              <td className="px-3 py-2 text-(--ink-2)">{f.lastResponseAt ? fmtAgo(f.lastResponseAt) : '—'}</td>
              <td className="px-3 py-2">
                <Menu trigger={(p) => <IconButton icon={MoreHorizontal} label="More actions" size="sm" {...p} />}>
                  {(close) => (
                    <>
                      <MenuItem icon={PenSquare} href={`/admin/forms/${f.id}`}>Edit</MenuItem>
                      <MenuItem icon={Inbox} href={`/admin/forms/${f.id}/responses`}>Responses</MenuItem>
                      <MenuItem icon={BarChart3} href={`/admin/forms/${f.id}/analytics`}>Analytics</MenuItem>
                      <MenuItem icon={CopyPlus} onClick={() => { close(); onDuplicate(f); }}>Duplicate</MenuItem>
                      <div className="my-1 h-px bg-(--line)" />
                      <MenuItem icon={Trash2} danger onClick={() => { close(); onDelete(f); }}>Delete</MenuItem>
                    </>
                  )}
                </Menu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/** the newest replies across every letter */
function LatestReplies({ data }: { data: OverviewData | null }) {
  const items = data?.recent?.slice(0, 6) ?? [];
  if (!items.length) return null;
  return (
    <section aria-label="Latest replies">
      <div className="mb-2 flex items-center gap-2">
        <Inbox className="size-4 text-(--accent)" aria-hidden />
        <h2 className="text-[13px] font-semibold text-(--ink-2)">Latest replies</h2>
      </div>
      <div className="fgl-scroll -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {items.map((r) => {
          const first = Object.values(r.answers ?? {}).find((v) => typeof v === 'string' && v.trim().length > 0) as string | undefined;
          const where = [r.meta?.city, r.meta?.country].filter(Boolean).join(', ');
          return (
            <Link
              key={r.id}
              href={`/admin/forms/${r.formId}/responses?r=${r.id}`}
              className="w-60 shrink-0 rounded-xl border border-(--line) bg-white p-3 transition-shadow hover:shadow-[0_10px_24px_-14px_rgba(60,40,20,.35)]"
            >
              <p className="truncate text-[12px] font-semibold text-(--ink-2)">{r.formTitle || 'A letter'}</p>
              <p className="mt-1 line-clamp-2 min-h-[2.5em] font-display text-[15px] leading-snug text-(--ink)">{first ? `“${first}”` : 'A new reply'}</p>
              <p className="mt-1.5 truncate text-[11.5px] text-(--ink-3)">
                {fmtAgo(r.createdAt)}
                {where ? ` · ${where}` : ''}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { BarChart3, Copy, CopyPlus, ExternalLink, Eye, FileText, Inbox, MoreHorizontal, PenSquare, Plus, Search, Trash2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import type { FormStatus, FormSummary } from '@formgl/shared';
import { api, errorMessage, type OverviewData } from '@/lib/admin/api';
import { CHART_COLORS, cn, copyText, fmtAgo, fmtCompact, fmtDate, fmtNum, fmtPct, publicUrl } from '@/lib/admin/utils';
import { PageHeader } from './AdminShell';
import { Button, Card, ConfirmDialog, EmptyState, IconButton, Input, Menu, MenuItem, PageLoader, Segmented, StatusBadge } from './ui';
import { EnvelopeSwatch } from './EnvelopeSwatch';
import { TemplateGallery } from './TemplateGallery';

export function FormsDashboard() {
  const router = useRouter();
  const [forms, setForms] = useState<FormSummary[] | null>(null);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | FormStatus>('all');
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
    return (forms ?? []).filter((f) => (status === 'all' || f.status === status) && (!s || f.title.toLowerCase().includes(s) || f.slug.toLowerCase().includes(s)));
  }, [forms, q, status]);

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

      <section aria-label="Forms" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--ink-3)" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search forms…" aria-label="Search forms" className="pl-9" />
          </div>
          <Segmented
            label="Filter by status"
            value={status}
            onChange={setStatus}
            size="sm"
            options={(['all', 'published', 'draft', 'closed'] as const).map((s) => ({ value: s, label: `${s[0].toUpperCase()}${s.slice(1)} · ${counts[s]}` }))}
          />
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
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((f) => (
              <FormCard key={f.id} form={f} onDuplicate={() => duplicate(f)} onDelete={() => setToDelete(f)} />
            ))}
          </div>
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

function FormCard({ form, onDuplicate, onDelete }: { form: FormSummary; onDuplicate: () => void; onDelete: () => void }) {
  const url = publicUrl(form.slug);
  const isLive = form.status === 'published';
  const copy = async () => ((await copyText(url)) ? toast.success('Link copied') : toast.error('Could not copy'));
  const t = form.theme ?? ({} as FormSummary['theme']);
  return (
    <Card className="group flex flex-col overflow-hidden transition-shadow hover:shadow-[0_16px_36px_-18px_rgba(60,40,20,.35)]">
      <Link href={`/admin/forms/${form.id}`} className="relative flex h-32 items-center justify-center" style={{ background: `linear-gradient(155deg, ${t.loaderColor || '#f3e9dc'} 0%, ${t.paperColor || '#fbf7ef'} 100%)` }} aria-label={`Edit ${form.title}`}>
        <EnvelopeSwatch envelope={t.envelopeColor || '#efe6d6'} seal={t.sealColor || '#8e1b1b'} paper={t.paperColor} logoUrl={t.logoUrl} monogram={form.title?.[0]} className="w-28 transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-[-2deg]" />
        <span className="absolute top-3 left-3">
          <StatusBadge status={form.status} />
        </span>
      </Link>
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
                <MenuItem icon={CopyPlus} onClick={() => { close(); onDuplicate(); }}>Duplicate</MenuItem>
                <div className="my-1 h-px bg-(--line)" />
                <MenuItem icon={Trash2} danger onClick={() => { close(); onDelete(); }}>Delete</MenuItem>
              </>
            )}
          </Menu>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-(--line) pt-3 text-xs">
          <div>
            <dt className="text-(--ink-3)">Responses</dt>
            <dd className="mt-0.5 text-[15px] font-semibold tabular-nums">{fmtNum(form.responseCount)}</dd>
          </div>
          <div>
            <dt className="text-(--ink-3)">Views</dt>
            <dd className="mt-0.5 text-[15px] font-semibold tabular-nums">{fmtNum(form.viewCount)}</dd>
          </div>
          <div>
            <dt className="text-(--ink-3)">Updated</dt>
            <dd className="mt-0.5 truncate text-[13px] font-medium" title={fmtDate(form.updatedAt)}>{fmtAgo(form.updatedAt).replace(' ago', '')}</dd>
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

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Inbox, PenSquare, RefreshCw } from 'lucide-react';
import { subDays } from 'date-fns';
import { isInputField, type AnalyticsSummary, type FormDoc, type FormResponse } from '@formgl/shared';
import { api, errorMessage } from '@/lib/admin/api';
import { CHART_COLORS, fmtDate, fmtDuration, fmtNum, fmtPct } from '@/lib/admin/utils';
import { PageHeader } from '../AdminShell';
import { Button, Card, EmptyState, PageLoader, Segmented, StatusBadge } from '../ui';
import { AXIS, BarList, ChartCard, Columns, Donut, Kpi, NoData, tooltipProps } from './charts';
import { WorldMap } from './WorldMap';
import { QuestionInsights } from './QuestionInsights';
import { CrossTab } from './CrossTab';
import { VisitsTable } from './VisitsTable';

type Range = '7d' | '30d' | '90d' | 'all';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SERIES = [
  { key: 'views', name: 'Views', color: CHART_COLORS[3] },
  { key: 'opens', name: 'Opens', color: CHART_COLORS[2] },
  { key: 'submissions', name: 'Submissions', color: CHART_COLORS[0] },
] as const;

export function AnalyticsView({ formId }: { formId: string }) {
  const [form, setForm] = useState<FormDoc | null>(null);
  const [responses, setResponses] = useState<FormResponse[] | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [range, setRange] = useState<Range>('30d');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    Promise.all([api.forms.get(formId), api.responses.all(formId)])
      .then(([f, r]) => {
        setForm(f);
        setResponses(r);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [formId, tick]);

  const bounds = useMemo(() => {
    const to = new Date();
    const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 0;
    const from = days ? subDays(to, days) : new Date(form?.createdAt ?? '2020-01-01');
    return { from: from.toISOString(), to: to.toISOString() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, form?.createdAt, tick]);

  useEffect(() => {
    if (!form) return;
    let alive = true;
    setLoading(true);
    api.analytics
      .summary(formId, bounds.from, bounds.to)
      .then((s) => alive && setSummary(s))
      .catch((e) => alive && setError(errorMessage(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [formId, bounds, form]);

  const inRange = useMemo(() => (responses ?? []).filter((r) => r.createdAt >= bounds.from && r.createdAt <= bounds.to), [responses, bounds]);
  const inputFields = useMemo(() => (form?.fields ?? []).filter((f) => isInputField(f.type) && f.type !== 'hidden'), [form]);

  if (error && !form) return <EmptyState icon={BarChart3} title="Couldn’t load analytics">{error}</EmptyState>;
  if (!form || !responses) return <PageLoader label="Reading the tea leaves…" />;

  const t = summary?.totals;
  const funnel = summary?.funnel ?? [];
  const funnelMax = Math.max(1, ...funnel.map((s) => s.count));

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        eyebrow={<Link href="/admin" className="hover:text-(--ink)">All forms</Link>}
        title={form.title}
        subtitle={<span className="flex items-center gap-2"><StatusBadge status={form.status} /> Analytics · {fmtDate(bounds.from)} – {fmtDate(bounds.to)}</span>}
        actions={
          <>
            <Segmented label="Date range" value={range} onChange={setRange} options={[{ value: '7d', label: '7d' }, { value: '30d', label: '30d' }, { value: '90d', label: '90d' }, { value: 'all', label: 'All' }]} />
            <Button icon={RefreshCw} loading={loading} onClick={() => setTick((x) => x + 1)} aria-label="Refresh" />
            <Link href={`/admin/forms/${formId}/responses`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-(--line) bg-white px-3.5 text-sm font-medium hover:border-(--line-2)">
              <Inbox className="size-4" /> Responses
            </Link>
            <Link href={`/admin/forms/${formId}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-(--line) bg-white px-3.5 text-sm font-medium hover:border-(--line-2)">
              <PenSquare className="size-4" /> Edit
            </Link>
          </>
        }
      />

      {!summary ? (
        <PageLoader label="Crunching numbers…" />
      ) : (
        <>
          {/* KPIs */}
          <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Kpi label="Views" value={fmtNum(t?.views)} sub={`${fmtNum(t?.uniqueVisitors)} unique visitors`} />
            <Kpi label="Envelopes opened" value={fmtNum(t?.opens)} sub={`${fmtPct(t?.openRate)} open rate`} />
            <Kpi label="Started" value={fmtNum(t?.starts)} sub="Began answering" />
            <Kpi label="Submissions" value={fmtNum(t?.submissions)} sub={`${fmtPct(t?.completionRate)} completion`} accent />
            <Kpi label="Time to complete" value={fmtDuration(t?.medianDurationMs)} sub={`median · avg ${fmtDuration(t?.avgDurationMs)}`} />
          </section>

          <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
            <ChartCard title="Funnel" subtitle="From first glance to sealed reply">
              {funnel.length && funnel[0].count ? (
                <ol className="space-y-2.5">
                  {funnel.map((s, i) => {
                    const prev = i > 0 ? funnel[i - 1].count : 0;
                    return (
                      <li key={s.step}>
                        <div className="mb-1 flex items-baseline justify-between text-[13px]">
                          <span className="font-medium capitalize">{s.step}</span>
                          <span className="tabular-nums">
                            <b className="font-semibold">{fmtNum(s.count)}</b>
                            {i > 0 && <span className="ml-1.5 text-xs text-(--ink-3)">{fmtPct(prev ? s.count / prev : 0, 0)} of previous</span>}
                          </span>
                        </div>
                        <div className="h-7 rounded-md bg-(--paper)">
                          <div className="h-full rounded-md" style={{ width: `${Math.max(1.5, (s.count / funnelMax) * 100)}%`, background: CHART_COLORS[0], opacity: 1 - i * 0.14 }} />
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <NoData />
              )}
            </ChartCard>
            <ChartCard title="Over time" subtitle="Daily views, opens and submissions">
              {summary.timeseries.length ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={summary.timeseries} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                      <defs>
                        {SERIES.map((s) => (
                          <linearGradient key={s.key} id={`g-${s.key}`} x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0" stopColor={s.color} stopOpacity={0.16} />
                            <stop offset="1" stopColor={s.color} stopOpacity={0} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid stroke="#efe8dc" vertical={false} />
                      <XAxis dataKey="date" {...AXIS} tickFormatter={(d) => fmtDate(String(d), 'MMM d')} minTickGap={24} />
                      <YAxis {...AXIS} allowDecimals={false} width={44} />
                      <Tooltip {...tooltipProps} labelFormatter={(d) => fmtDate(String(d), 'EEE, MMM d')} />
                      <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, paddingTop: 4 }} />
                      {SERIES.map((s) => (
                        <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} fill={`url(#g-${s.key})`} dot={false} isAnimationActive={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <NoData h={256} />
              )}
            </ChartCard>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard title="By hour of day" subtitle="When people visit (server time)">
              <Columns data={Array.from({ length: 24 }, (_, h) => ({ hour: `${h}`, count: summary.byHour.find((x) => x.hour === h)?.count ?? 0 }))} xKey="hour" yKey="count" label="Visits" highlightMax />
            </ChartCard>
            <ChartCard title="By weekday">
              <Columns data={WEEKDAYS.map((d, i) => ({ day: d, count: summary.byWeekday.find((x) => x.weekday === i)?.count ?? 0 }))} xKey="day" yKey="count" label="Visits" highlightMax color={CHART_COLORS[3]} />
            </ChartCard>
          </div>

          {/* Audience */}
          <h2 className="font-display pt-2 text-2xl font-semibold">Audience</h2>
          <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
            <ChartCard title="Where readers are" subtitle="Countries shaded by visits; dots are individual visits">
              <WorldMap countries={summary.countries} points={summary.points} />
            </ChartCard>
            <ChartCard title="Top countries">
              <BarList data={summary.countries.map((c) => ({ label: c.country || c.countryCode || 'Unknown', value: c.count }))} showPct />
            </ChartCard>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard title="Cities" className="lg:col-span-1">
              {summary.cities.length ? (
                <div className="fgl-scroll max-h-72 overflow-y-auto">
                  <table className="w-full text-[13px]">
                    <thead className="sticky top-0 bg-white text-left text-xs text-(--ink-3)">
                      <tr>
                        <th className="pb-1.5 font-medium">City</th>
                        <th className="pb-1.5 font-medium">Country</th>
                        <th className="pb-1.5 text-right font-medium">Visits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.cities.slice(0, 50).map((c, i) => (
                        <tr key={`${c.city}-${i}`} className="border-t border-(--line)">
                          <td className="py-1.5 pr-2">{c.city || '—'}</td>
                          <td className="py-1.5 pr-2 text-(--ink-2)">{c.country || '—'}</td>
                          <td className="py-1.5 text-right font-medium tabular-nums">{fmtNum(c.count)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <NoData />
              )}
            </ChartCard>
            <ChartCard title="Referrers" className="lg:col-span-2">
              <BarList data={summary.referrers.map((r) => ({ label: r.referrer || 'Direct', value: r.count }))} color={CHART_COLORS[1]} showPct />
            </ChartCard>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <ChartCard title="Devices"><Donut data={summary.devices.map((d) => ({ label: d.device, value: d.count }))} /></ChartCard>
            <ChartCard title="Browsers"><Donut data={summary.browsers.map((d) => ({ label: d.browser, value: d.count }))} /></ChartCard>
            <ChartCard title="Operating systems"><Donut data={summary.os.map((d) => ({ label: d.os, value: d.count }))} /></ChartCard>
          </div>
          <ChartCard title="Page drop-off" subtitle="How many readers reached each letter page">
            <Columns data={summary.pageDropoff.map((p, _i, all) => ({ page: `Page ${p.page + (all.some((x) => x.page === 0) ? 1 : 0)}`, count: p.count }))} xKey="page" yKey="count" label="Readers" color={CHART_COLORS[2]} />
          </ChartCard>
        </>
      )}

      {/* Questions */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 pt-2">
        <h2 className="font-display text-2xl font-semibold">Question insights</h2>
        <p className="text-xs text-(--ink-3)">{fmtNum(inRange.length)} responses in this range</p>
      </div>
      <QuestionInsights fields={inputFields} responses={inRange} />

      <ChartCard title="Compare two questions" subtitle="Contingency table, correlation or grouped averages — depending on the question types">
        <CrossTab fields={inputFields} responses={inRange} />
      </ChartCard>

      <h2 className="font-display pt-2 text-2xl font-semibold">Raw visits</h2>
      <Card className="p-4 sm:p-5">
        <VisitsTable formId={formId} />
      </Card>
    </div>
  );
}

'use client';

import type { ReactNode } from 'react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { CHART_COLORS, OTHER_COLOR, cn, fmtNum, fmtPct } from '@/lib/admin/utils';
import { Card } from '../ui';

export const AXIS = { stroke: '#b3a79c', fontSize: 11, tickLine: false, axisLine: false } as const;
export const GRID = <CartesianGrid stroke="#efe8dc" vertical={false} />;
export const tooltipProps = {
  contentStyle: { borderRadius: 10, border: '1px solid #e6ddd0', fontSize: 12, boxShadow: '0 8px 24px -12px rgba(60,40,20,.35)', padding: '6px 10px' },
  labelStyle: { color: '#6b5f57', marginBottom: 2 },
  itemStyle: { color: '#2b2320', padding: 0 },
  cursor: { fill: 'rgba(142,27,27,.05)', stroke: '#d8ccbc' },
} as const;

export function ChartCard({ title, subtitle, children, className, action }: { title: string; subtitle?: ReactNode; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <Card className={cn('flex min-w-0 flex-col p-4 sm:p-5', className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-(--ink-3)">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </Card>
  );
}

export function NoData({ label = 'No data yet', h = 160 }: { label?: string; h?: number }) {
  return (
    <div className="grid place-items-center rounded-lg bg-[repeating-linear-gradient(135deg,#faf7f2_0_8px,#f6f1e9_8px_16px)] text-xs text-(--ink-3)" style={{ height: h }}>
      {label}
    </div>
  );
}

/** Horizontal bar list — labels on the left, values on the right (readable at any width) */
export function BarList({ data, color = CHART_COLORS[0], max = 8, format = fmtNum, showPct }: { data: Array<{ label: string; value: number }>; color?: string; max?: number; format?: (n: number) => string; showPct?: boolean }) {
  if (!data.length) return <NoData h={120} />;
  const rows = [...data].sort((a, b) => b.value - a.value);
  const top = rows.slice(0, max);
  const rest = rows.slice(max).reduce((a, r) => a + r.value, 0);
  if (rest > 0) top.push({ label: 'Other', value: rest });
  const peak = Math.max(...top.map((r) => r.value), 1);
  const total = rows.reduce((a, r) => a + r.value, 0) || 1;
  return (
    <ul className="space-y-1.5">
      {top.map((r) => (
        <li key={r.label} className="group relative flex items-center gap-3 text-[13px]" title={`${r.label}: ${format(r.value)}`}>
          <div className="relative h-7 min-w-0 flex-1 overflow-hidden rounded-md">
            <div className="absolute inset-y-0 left-0 rounded-md transition-all group-hover:opacity-90" style={{ width: `${Math.max(2, (r.value / peak) * 100)}%`, background: r.label === 'Other' ? OTHER_COLOR : color, opacity: 0.16 }} />
            <div className="absolute inset-y-0 left-0 w-[3px] rounded-l-md" style={{ background: r.label === 'Other' ? OTHER_COLOR : color }} />
            <span className="relative block truncate px-2.5 leading-7">{r.label || '(unknown)'}</span>
          </div>
          <span className="w-16 shrink-0 text-right font-medium tabular-nums">
            {format(r.value)}
            {showPct && <span className="ml-1 text-[11px] font-normal text-(--ink-3)">{fmtPct(r.value / total, 0)}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Donut({ data, height = 180 }: { data: Array<{ label: string; value: number }>; height?: number }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  if (!total) return <NoData h={height} />;
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, 5);
  const rest = sorted.slice(5).reduce((a, d) => a + d.value, 0);
  if (rest) top.push({ label: 'Other', value: rest });
  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: height * 0.8, height: height * 0.8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={top} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="100%" stroke="#fff" strokeWidth={2} paddingAngle={top.length > 1 ? 1 : 0} isAnimationActive={false}>
              {top.map((d, i) => (
                <Cell key={d.label} fill={d.label === 'Other' ? OTHER_COLOR : CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip {...tooltipProps} formatter={(v) => [`${fmtNum(Number(v))} (${fmtPct(Number(v) / total, 0)})`, '']} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <span className="text-lg leading-none font-semibold tabular-nums">{fmtNum(total)}</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5 text-[13px]">
        {top.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: d.label === 'Other' ? OTHER_COLOR : CHART_COLORS[i % CHART_COLORS.length] }} />
            <span className="min-w-0 flex-1 truncate capitalize">{d.label || 'Unknown'}</span>
            <span className="font-medium tabular-nums">{fmtPct(d.value / total, 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Vertical column chart (single series) */
export function Columns({ data, xKey, yKey, height = 180, color = CHART_COLORS[0], label = 'Count', highlightMax }: { data: Array<Record<string, string | number>>; xKey: string; yKey: string; height?: number; color?: string; label?: string; highlightMax?: boolean }) {
  if (!data.length || data.every((d) => !Number(d[yKey]))) return <NoData h={height} />;
  const peak = Math.max(...data.map((d) => Number(d[yKey])));
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: -18 }} barCategoryGap="18%">
          {GRID}
          <XAxis dataKey={xKey} {...AXIS} interval="preserveStartEnd" minTickGap={4} />
          <YAxis {...AXIS} allowDecimals={false} width={40} />
          <Tooltip {...tooltipProps} formatter={(v) => [fmtNum(Number(v)), label]} />
          <Bar dataKey={yKey} radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={i} fill={color} fillOpacity={highlightMax ? (Number(d[yKey]) === peak ? 1 : 0.45) : 0.9} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <Card className={cn('p-4', accent && 'border-(--accent)/25 bg-[linear-gradient(160deg,#fff,#fbf1ee)]')}>
      <p className="text-xs font-medium text-(--ink-2)">{label}</p>
      <p className="font-display mt-1.5 text-[32px] leading-none font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-1.5 truncate text-[11px] text-(--ink-3)">{sub}</p>}
    </Card>
  );
}

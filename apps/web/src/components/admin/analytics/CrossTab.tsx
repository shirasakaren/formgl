'use client';

import { useMemo, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import type { FormField, FormResponse } from '@formgl/shared';
import { fieldKind, mean, pearson, toCategories, toNumber } from '@/lib/admin/stats';
import { CHART_COLORS, fmtNum, fmtPct, seqColor } from '@/lib/admin/utils';
import { IconButton, Select } from '../ui';
import { AXIS, BarList, NoData, tooltipProps } from './charts';

export function CrossTab({ fields, responses }: { fields: FormField[]; responses: FormResponse[] }) {
  const eligible = fields.filter((f) => ['choice', 'numeric'].includes(fieldKind(f)));
  const [a, setA] = useState(eligible[0]?.id ?? '');
  const [b, setB] = useState(eligible[1]?.id ?? '');
  const fa = eligible.find((f) => f.id === a);
  const fb = eligible.find((f) => f.id === b);

  if (eligible.length < 2) return <NoData label="Add at least two choice or number questions to compare them" h={120} />;

  const picker = (value: string, set: (v: string) => void, label: string) => (
    <Select value={value} onChange={(e) => set(e.target.value)} aria-label={label} className="min-w-0 flex-1">
      {eligible.map((f) => (
        <option key={f.id} value={f.id}>
          {f.label || f.type}
        </option>
      ))}
    </Select>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {picker(a, setA, 'First question')}
        <IconButton icon={ArrowLeftRight} label="Swap" onClick={() => { setA(b); setB(a); }} className="self-center" />
        {picker(b, setB, 'Second question')}
      </div>
      {!fa || !fb || fa.id === fb.id ? (
        <NoData label="Pick two different questions" h={120} />
      ) : fieldKind(fa) === 'choice' && fieldKind(fb) === 'choice' ? (
        <Contingency fa={fa} fb={fb} responses={responses} />
      ) : fieldKind(fa) === 'numeric' && fieldKind(fb) === 'numeric' ? (
        <Correlation fa={fa} fb={fb} responses={responses} />
      ) : fieldKind(fa) === 'choice' ? (
        <GroupedMeans fc={fa} fn={fb} responses={responses} />
      ) : (
        <GroupedMeans fc={fb} fn={fa} responses={responses} />
      )}
    </div>
  );
}

function Contingency({ fa, fb, responses }: { fa: FormField; fb: FormField; responses: FormResponse[] }) {
  const { rows, cols, m, rowTot, total } = useMemo(() => {
    const m = new Map<string, number>();
    const rs = new Set<string>(fa.options?.map((o) => o.label));
    const cs = new Set<string>(fb.options?.map((o) => o.label));
    let total = 0;
    for (const r of responses) {
      const ca = toCategories(fa, r.answers[fa.id]);
      const cb = toCategories(fb, r.answers[fb.id]);
      if (!ca.length || !cb.length) continue;
      total++;
      for (const x of ca)
        for (const y of cb) {
          rs.add(x);
          cs.add(y);
          m.set(`${x}\u0000${y}`, (m.get(`${x}\u0000${y}`) ?? 0) + 1);
        }
    }
    const rows = [...rs];
    const cols = [...cs];
    const rowTot = new Map(rows.map((x) => [x, cols.reduce((s, y) => s + (m.get(`${x}\u0000${y}`) ?? 0), 0)]));
    return { rows, cols, m, rowTot, total };
  }, [fa, fb, responses]);
  if (!total) return <NoData label="No responses answered both questions" h={120} />;
  return (
    <div>
      <div className="fgl-scroll overflow-x-auto">
        <table className="w-full border-separate border-spacing-0.5 text-[12px]">
          <thead>
            <tr>
              <th className="p-1.5 text-left text-[11px] font-normal text-(--ink-3)">
                {fa.label} ↓ / {fb.label} →
              </th>
              {cols.map((c) => (
                <th key={c} className="max-w-28 truncate p-1.5 text-center font-medium text-(--ink-2)" title={c}>
                  {c}
                </th>
              ))}
              <th className="p-1.5 text-center font-medium text-(--ink-3)">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const rt = rowTot.get(r) ?? 0;
              return (
                <tr key={r}>
                  <td className="max-w-40 truncate p-1.5 font-medium text-(--ink-2)" title={r}>
                    {r}
                  </td>
                  {cols.map((c) => {
                    const n = m.get(`${r}\u0000${c}`) ?? 0;
                    const p = rt ? n / rt : 0;
                    return (
                      <td key={c} className="rounded-md p-1.5 text-center tabular-nums" style={{ background: n ? seqColor(p) : '#faf7f2', color: p > 0.55 ? '#fff' : '#2b2320' }} title={`${r} × ${c}: ${n} (${fmtPct(p, 0)} of row)`}>
                        <span className="font-semibold">{n}</span>
                        <span className="ml-1 opacity-70">{rt ? fmtPct(p, 0) : ''}</span>
                      </td>
                    );
                  })}
                  <td className="p-1.5 text-center text-(--ink-3) tabular-nums">{rt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-(--ink-3)">Cells show count and share of the row. {fmtNum(total)} responses answered both.</p>
    </div>
  );
}

function Correlation({ fa, fb, responses }: { fa: FormField; fb: FormField; responses: FormResponse[] }) {
  const pairs = useMemo(
    () =>
      responses
        .map((r) => [toNumber(r.answers[fa.id]), toNumber(r.answers[fb.id])] as const)
        .filter((p): p is readonly [number, number] => p[0] !== null && p[1] !== null)
        .map(([x, y]) => [x, y] as [number, number]),
    [fa, fb, responses],
  );
  if (pairs.length < 2) return <NoData label="Not enough paired numeric answers" h={120} />;
  const r = pearson(pairs);
  const strength = !Number.isFinite(r) ? 'undefined' : Math.abs(r) >= 0.7 ? 'strong' : Math.abs(r) >= 0.4 ? 'moderate' : Math.abs(r) >= 0.2 ? 'weak' : 'negligible';
  // aggregate identical points so overlapping answers read as bigger dots
  const agg = new Map<string, { x: number; y: number; n: number }>();
  for (const [x, y] of pairs) {
    const k = `${x}|${y}`;
    const cur = agg.get(k);
    if (cur) cur.n++;
    else agg.set(k, { x, y, n: 1 });
  }
  return (
    <div className="grid gap-4 md:grid-cols-[180px_1fr]">
      <div className="rounded-xl bg-(--paper) p-4">
        <p className="text-xs text-(--ink-2)">Pearson r</p>
        <p className="font-display text-5xl leading-none font-semibold tabular-nums">{Number.isFinite(r) ? r.toFixed(2) : '—'}</p>
        <p className="mt-2 text-[13px] text-(--ink-2)">
          {Number.isFinite(r) ? (
            <>
              A <b className="font-semibold text-(--ink)">{strength}</b> {r >= 0 ? 'positive' : 'negative'} relationship across {fmtNum(pairs.length)} responses.
            </>
          ) : (
            'One of the questions has no variation.'
          )}
        </p>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 8, bottom: 16, left: -8 }}>
            <CartesianGrid stroke="#efe8dc" />
            <XAxis type="number" dataKey="x" name={fa.label} {...AXIS} label={{ value: fa.label, position: 'insideBottom', offset: -8, fontSize: 11, fill: '#6b5f57' }} />
            <YAxis type="number" dataKey="y" name={fb.label} {...AXIS} width={44} />
            <ZAxis type="number" dataKey="n" range={[40, 400]} name="Responses" />
            <Tooltip {...tooltipProps} />
            <Scatter data={[...agg.values()]} fill={CHART_COLORS[0]} fillOpacity={0.6} stroke="#fff" strokeWidth={1.5} isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function GroupedMeans({ fc, fn, responses }: { fc: FormField; fn: FormField; responses: FormResponse[] }) {
  const groups = useMemo(() => {
    const g = new Map<string, number[]>();
    for (const r of responses) {
      const n = toNumber(r.answers[fn.id]);
      if (n === null) continue;
      for (const c of toCategories(fc, r.answers[fc.id])) g.set(c, [...(g.get(c) ?? []), n]);
    }
    return [...g.entries()].map(([label, xs]) => ({ label, mean: mean(xs), n: xs.length })).sort((a, b) => b.mean - a.mean);
  }, [fc, fn, responses]);
  if (!groups.length) return <NoData label="No responses answered both questions" h={120} />;
  return (
    <div>
      <p className="mb-2 text-xs text-(--ink-2)">
        Average <b className="font-medium text-(--ink)">{fn.label}</b> by <b className="font-medium text-(--ink)">{fc.label}</b>
      </p>
      <BarList data={groups.map((g) => ({ label: `${g.label}  (n=${g.n})`, value: g.mean }))} format={(v) => fmtNum(v, 2)} color={CHART_COLORS[3]} max={12} />
    </div>
  );
}

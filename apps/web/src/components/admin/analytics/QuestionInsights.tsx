'use client';

import { useMemo } from 'react';
import { formatAnswer, isEmptyAnswer, type FormField, type FormResponse } from '@formgl/shared';
import { distribution, fieldKind, histogram, mean, median, nps, stdDev, toNumber, topWords } from '@/lib/admin/stats';
import { CHART_COLORS, cn, fmtNum, fmtPct } from '@/lib/admin/utils';
import { FieldIcon } from '../FieldIcon';
import { BarList, ChartCard, Columns, NoData } from './charts';

export function QuestionInsights({ fields, responses }: { fields: FormField[]; responses: FormResponse[] }) {
  if (!fields.length) return <NoData label="This form has no questions" />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {fields.map((f, i) => (
        <Insight key={f.id} field={f} index={i} responses={responses} />
      ))}
    </div>
  );
}

function Insight({ field, index, responses }: { field: FormField; index: number; responses: FormResponse[] }) {
  const kind = fieldKind(field);
  const answered = useMemo(() => responses.filter((r) => !isEmptyAnswer(r.answers[field.id])).length, [responses, field.id]);
  const rate = responses.length ? answered / responses.length : 0;
  return (
    <ChartCard
      title={`${index + 1}. ${field.label || field.type}`}
      subtitle={`${fmtNum(answered)} answered · ${fmtPct(rate, 0)} response rate`}
      action={
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-(--paper) text-(--ink-3)">
          <FieldIcon type={field.type} className="size-3.5" />
        </span>
      }
    >
      {answered === 0 ? (
        <NoData label="No answers yet" h={100} />
      ) : kind === 'choice' ? (
        <ChoiceInsight field={field} responses={responses} />
      ) : kind === 'numeric' ? (
        <NumericInsight field={field} responses={responses} />
      ) : kind === 'text' ? (
        <TextInsight field={field} responses={responses} />
      ) : (
        <OtherInsight field={field} responses={responses} />
      )}
    </ChartCard>
  );
}

function ChoiceInsight({ field, responses }: { field: FormField; responses: FormResponse[] }) {
  const { rows } = useMemo(() => distribution(field, responses), [field, responses]);
  if (field.type === 'yes_no') {
    const [yes, no] = rows;
    const total = (yes?.count ?? 0) + (no?.count ?? 0) || 1;
    return (
      <div className="space-y-3 pt-1">
        <div className="flex h-9 overflow-hidden rounded-lg" role="img" aria-label={`${yes.label} ${fmtPct(yes.count / total)}, ${no.label} ${fmtPct(no.count / total)}`}>
          <div className="flex items-center px-3 text-xs font-semibold text-white" style={{ width: `${(yes.count / total) * 100}%`, background: CHART_COLORS[1], minWidth: yes.count ? 36 : 0 }}>
            {yes.count ? fmtPct(yes.count / total, 0) : ''}
          </div>
          <div className="ml-0.5 flex flex-1 items-center justify-end px-3 text-xs font-semibold text-white" style={{ background: CHART_COLORS[0], display: no.count ? 'flex' : 'none' }}>
            {fmtPct(no.count / total, 0)}
          </div>
        </div>
        <div className="flex justify-between text-[13px]">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: CHART_COLORS[1] }} /> {yes.label} · <b className="font-semibold">{fmtNum(yes.count)}</b>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: CHART_COLORS[0] }} /> {no.label} · <b className="font-semibold">{fmtNum(no.count)}</b>
          </span>
        </div>
      </div>
    );
  }
  return (
    <>
      {field.type === 'ranking' && <p className="mb-2 text-xs text-(--ink-3)">Showing how often each option was ranked first.</p>}
      <BarList data={rows.map((r) => ({ label: r.label, value: r.count }))} max={10} showPct color={CHART_COLORS[0]} />
      {(field.type === 'checkboxes' || field.type === 'multiselect') && <p className="mt-2 text-[11px] text-(--ink-3)">Percentages are of respondents — multiple picks allowed.</p>}
    </>
  );
}

function NumericInsight({ field, responses }: { field: FormField; responses: FormResponse[] }) {
  const xs = useMemo(() => responses.map((r) => toNumber(r.answers[field.id])).filter((n): n is number => n !== null), [responses, field.id]);
  const hist = useMemo(() => histogram(xs, field), [xs, field]);
  const n = field.type === 'nps' ? nps(xs) : null;
  const stats = [
    ['Mean', mean(xs)],
    ['Median', median(xs)],
    ['Std dev', stdDev(xs)],
    ['Min', Math.min(...xs)],
    ['Max', Math.max(...xs)],
  ] as const;
  return (
    <div className="space-y-4">
      {n && (
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-xs text-(--ink-2)">NPS</p>
            <p className={cn('font-display text-5xl leading-none font-semibold tabular-nums', n.score >= 30 ? 'text-[#276640]' : n.score >= 0 ? 'text-[#8a6412]' : 'text-(--accent)')}>
              {n.score > 0 ? '+' : ''}
              {n.score}
            </p>
          </div>
          <div className="min-w-48 flex-1">
            <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
              <span style={{ flex: n.detractors, background: CHART_COLORS[0] }} />
              <span style={{ flex: n.passives, background: '#c9bba9' }} />
              <span style={{ flex: n.promoters, background: CHART_COLORS[1] }} />
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-(--ink-2)">
              <span>Detractors {fmtNum(n.detractors)}</span>
              <span>Passives {fmtNum(n.passives)}</span>
              <span>Promoters {fmtNum(n.promoters)}</span>
            </div>
          </div>
        </div>
      )}
      <dl className="grid grid-cols-5 gap-1 rounded-lg bg-(--paper) p-2 text-center">
        {stats.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[10px] tracking-wide text-(--ink-3) uppercase">{k}</dt>
            <dd className="text-sm font-semibold tabular-nums">{fmtNum(v, 2)}</dd>
          </div>
        ))}
      </dl>
      <Columns data={hist} xKey="bucket" yKey="count" height={150} color={field.type === 'nps' ? CHART_COLORS[3] : CHART_COLORS[0]} label="Responses" />
    </div>
  );
}

function TextInsight({ field, responses }: { field: FormField; responses: FormResponse[] }) {
  const texts = useMemo(() => responses.map((r) => formatAnswer(field, r.answers[field.id]).trim()).filter(Boolean), [responses, field]);
  const words = useMemo(() => topWords(texts, 10), [texts]);
  const avg = mean(texts.map((t) => t.length));
  const unique = new Set(texts.map((t) => t.toLowerCase())).size;
  const recent = texts.slice(-3).reverse();
  const showWords = field.type === 'long_text' || field.type === 'short_text';
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-3 gap-1 rounded-lg bg-(--paper) p-2 text-center">
        <div>
          <dt className="text-[10px] tracking-wide text-(--ink-3) uppercase">Responses</dt>
          <dd className="text-sm font-semibold tabular-nums">{fmtNum(texts.length)}</dd>
        </div>
        <div>
          <dt className="text-[10px] tracking-wide text-(--ink-3) uppercase">Avg length</dt>
          <dd className="text-sm font-semibold tabular-nums">{fmtNum(avg, 0)} chars</dd>
        </div>
        <div>
          <dt className="text-[10px] tracking-wide text-(--ink-3) uppercase">Unique</dt>
          <dd className="text-sm font-semibold tabular-nums">{fmtNum(unique)}</dd>
        </div>
      </dl>
      {showWords && words.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-(--ink-2)">Top words</p>
          <BarList data={words.map((w) => ({ label: w.word, value: w.count }))} max={8} color={CHART_COLORS[3]} />
        </div>
      )}
      <div>
        <p className="mb-1.5 text-xs font-medium text-(--ink-2)">Latest answers</p>
        <ul className="space-y-1.5">
          {recent.map((t, i) => (
            <li key={i} className="line-clamp-2 rounded-md border-l-2 border-(--line-2) bg-[#fdfbf7] px-2.5 py-1.5 text-[13px] text-(--ink)">
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function OtherInsight({ field, responses }: { field: FormField; responses: FormResponse[] }) {
  const values = useMemo(() => responses.map((r) => r.answers[field.id]).filter((v) => !isEmptyAnswer(v)), [responses, field.id]);
  if (field.type === 'matrix') {
    const rows = field.config?.rows ?? [];
    const cols = field.config?.columns ?? [];
    const cell = (row: string, col: string) => values.filter((v) => {
      const x = (v as Record<string, string | string[]>)[row];
      return Array.isArray(x) ? x.includes(col) : x === col;
    }).length;
    return (
      <div className="fgl-scroll overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr>
              <th />
              {cols.map((c) => (
                <th key={c.id} className="px-1.5 pb-1 text-center font-medium text-(--ink-2)">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const counts = cols.map((c) => cell(r.label, c.label));
              const tot = counts.reduce((a, b) => a + b, 0) || 1;
              return (
                <tr key={r.id}>
                  <td className="py-0.5 pr-2 text-(--ink-2)">{r.label}</td>
                  {counts.map((n, i) => (
                    <td key={i} className="p-0.5">
                      <div className="rounded py-1 text-center tabular-nums" style={{ background: `rgba(168,50,45,${(n / tot) * 0.85})`, color: n / tot > 0.5 ? '#fff' : '#2b2320' }}>
                        {fmtPct(n / tot, 0)}
                      </div>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
  if (field.type === 'color') {
    return (
      <div className="flex flex-wrap gap-1.5">
        {values.slice(0, 60).map((v, i) => (
          <span key={i} title={String(v)} className="size-6 rounded ring-1 ring-black/10" style={{ background: String(v) }} />
        ))}
      </div>
    );
  }
  const date = field.type === 'date' || field.type === 'datetime';
  if (date) {
    const byMonth = new Map<string, number>();
    values.forEach((v) => {
      const k = String(v).slice(0, 7);
      byMonth.set(k, (byMonth.get(k) ?? 0) + 1);
    });
    return <Columns data={[...byMonth.entries()].sort().map(([k, count]) => ({ k, count }))} xKey="k" yKey="count" height={140} />;
  }
  return <p className="text-[13px] text-(--ink-2)">{fmtNum(values.length)} answers collected. Open the responses table to see each one.</p>;
}

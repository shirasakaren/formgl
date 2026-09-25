'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Paginated } from '@formgl/shared';
import { api, errorMessage, type VisitEvent } from '@/lib/admin/api';
import { cn, fmtDateTime, fmtNum } from '@/lib/admin/utils';
import { Button, Select, Spinner } from '../ui';

const TYPES = ['', 'view', 'loaded', 'open', 'start', 'page', 'submit', 'abandon'];
const TYPE_STYLE: Record<string, string> = {
  view: 'bg-(--paper-2) text-(--ink-2)',
  open: 'bg-[#eef3f8] text-[#3f63b0]',
  start: 'bg-[#f6efdc] text-[#8a6412]',
  submit: 'bg-[#e3f1e7] text-[#276640]',
  abandon: 'bg-[#f7e6e3] text-[#8e1b1b]',
};

export function VisitsTable({ formId }: { formId: string }) {
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [data, setData] = useState<Paginated<VisitEvent> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pageSize = 20;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.analytics
      .events(formId, { page, pageSize, type: type || undefined })
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e) => alive && setError(errorMessage(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [formId, page, type]);

  const pages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="w-40" aria-label="Event type">
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t ? t[0].toUpperCase() + t.slice(1) : 'All events'}
            </option>
          ))}
        </Select>
        {loading && <Spinner className="size-4" />}
      </div>
      <div className="fgl-scroll overflow-x-auto rounded-lg border border-(--line)">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead className="bg-[#fbf8f3] text-left text-xs text-(--ink-2)">
            <tr>
              {['Time', 'Event', 'IP', 'City', 'Country', 'Device', 'Browser', 'Referrer'].map((h) => (
                <th key={h} className="border-b border-(--line) px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {error ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-(--ink-3)">{error}</td>
              </tr>
            ) : data && data.items.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-(--ink-3)">No visits recorded yet.</td>
              </tr>
            ) : (
              data?.items.map((e) => (
                <tr key={e.id} className="border-b border-(--line) last:border-0 hover:bg-[#fcfaf6]">
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">{fmtDateTime(e.createdAt)}</td>
                  <td className="px-3 py-2">
                    <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', TYPE_STYLE[e.type] ?? 'bg-(--paper-2) text-(--ink-2)')}>
                      {e.type}
                      {e.type === 'page' && e.page != null ? ` #${e.page}` : ''}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{e.ip || '—'}</td>
                  <td className="px-3 py-2">{e.city || '—'}</td>
                  <td className="px-3 py-2">{e.country || e.countryCode || '—'}</td>
                  <td className="px-3 py-2 capitalize">{e.device || '—'}</td>
                  <td className="px-3 py-2">{[e.browser, e.os].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="max-w-48 truncate px-3 py-2 text-(--ink-2)" title={e.referrer ?? ''}>{e.referrer || 'Direct'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-[13px] text-(--ink-2)">
        <span>{data ? `${fmtNum(data.total)} events` : ''}</span>
        <div className="flex items-center gap-2">
          <Button size="sm" icon={ChevronLeft} aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)} />
          <span className="tabular-nums">
            {page} / {pages}
          </span>
          <Button size="sm" icon={ChevronRight} aria-label="Next page" disabled={page >= pages} onClick={() => setPage(page + 1)} />
        </div>
      </div>
    </div>
  );
}

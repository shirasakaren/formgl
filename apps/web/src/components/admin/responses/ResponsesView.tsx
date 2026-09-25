'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  columnFilteringFeature, columnResizingFeature, columnSizingFeature, columnVisibilityFeature, createColumnHelper, createFilteredRowModel,
  createPaginatedRowModel, createSortedRowModel, globalFilteringFeature, rowPaginationFeature, rowSelectionFeature, rowSortingFeature,
  sortFn_alphanumeric, sortFn_basic, sortFn_datetime, tableFeatures, useTable, type ColumnVisibilityState, type Row,
} from '@tanstack/react-table';
import {
  ArrowDown, ArrowUp, ArrowUpDown, BarChart3, ChevronLeft, ChevronRight, ClipboardCopy, Columns3, Download, FileJson, FileSpreadsheet, Filter, Inbox,
  PenSquare, Search, Sparkles, Star, Trash2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatAnswer, isInputField, type FormDoc, type FormField, type FormResponse } from '@formgl/shared';
import { api, errorMessage } from '@/lib/admin/api';
import { buildExportColumns, exportCsv, exportJson, exportXlsx, toDelimited } from '@/lib/admin/export';
import { NUMERIC_TYPES } from '@/lib/admin/stats';
import { cn, copyText, fmtDate, fmtDateTime, fmtNum } from '@/lib/admin/utils';
import { PageHeader } from '../AdminShell';
import { Button, Card, ConfirmDialog, EmptyState, Menu, MenuItem, PageLoader, Select, StatusBadge } from '../ui';
import { AnswerView, Lightbox } from './AnswerView';
import { ResponseDrawer } from './ResponseDrawer';
import { CleanPanel, applyClean, DEFAULT_CLEAN, type CleanOptions } from './CleanPanel';

const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  columnVisibilityFeature,
  columnSizingFeature,
  columnResizingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic, datetime: sortFn_datetime },
  filterFns: {
    text: (row: Row<any, any>, columnId: string, filterValue: unknown) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const q = String(filterValue ?? '').trim().toLowerCase();
      if (!q) return true;
      return String(row.getValue(columnId) ?? '').toLowerCase().includes(q);
    },
  },
});
type F = typeof features;
const helper = createColumnHelper<F, FormResponse>();
const EMPTY: FormResponse[] = [];

export function ResponsesView({ formId }: { formId: string }) {
  const [form, setForm] = useState<FormDoc | null>(null);
  const [responses, setResponses] = useState<FormResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clean, setClean] = useState<CleanOptions>(DEFAULT_CLEAN);
  const [showClean, setShowClean] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | { ids: string[]; title: string }>(null);
  const [deleting, setDeleting] = useState(false);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({});

  useEffect(() => {
    Promise.all([api.forms.get(formId), api.responses.all(formId)])
      .then(([f, r]) => {
        setForm(f);
        setResponses(r);
        // deep link: /responses?r=<id> opens that reply (from notifications, webhooks, the dashboard)
        const rid = new URLSearchParams(window.location.search).get('r');
        if (rid && r.some((x) => x.id === rid)) setOpenId(rid);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [formId]);

  const fields = useMemo(() => (form?.fields ?? []).filter((f) => isInputField(f.type)), [form]);
  const view = useMemo(() => applyClean(responses ?? EMPTY, fields, clean), [responses, fields, clean]);

  const patch = useCallback(async (id: string, p: Partial<Pick<FormResponse, 'starred' | 'tags' | 'note'>>) => {
    setResponses((l) => l?.map((r) => (r.id === id ? { ...r, ...p } : r)) ?? l);
    try {
      await api.responses.update(id, p);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, []);

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor((r) => r.createdAt, {
          id: 'createdAt',
          header: 'Submitted',
          size: 210,
          minSize: 180,
          sortFn: 'datetime',
          enableHiding: false,
          filterFn: 'text',
          cell: (c) => {
            const r = c.row.original;
            return (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={c.row.getIsSelected()}
                  onChange={c.row.getToggleSelectedHandler()}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Select response"
                  className="size-4 accent-(--accent)"
                />
                <button
                  type="button"
                  aria-label={r.starred ? 'Unstar' : 'Star'}
                  aria-pressed={!!r.starred}
                  onClick={(e) => {
                    e.stopPropagation();
                    patch(r.id, { starred: !r.starred });
                  }}
                  className="rounded p-0.5 hover:bg-(--paper-2)"
                >
                  <Star className={cn('size-4', r.starred ? 'fill-[#c7861c] text-[#c7861c]' : 'text-[#cfc3b4]')} />
                </button>
                <span className="truncate tabular-nums">{fmtDate(r.createdAt, 'MMM d, HH:mm')}</span>
              </div>
            );
          },
        }),
        ...fields.map((f: FormField) =>
          helper.accessor((r) => (NUMERIC_TYPES.has(f.type) ? (r.answers[f.id] == null || r.answers[f.id] === '' ? null : Number(r.answers[f.id])) : formatAnswer(f, r.answers[f.id])), {
            id: f.id,
            header: f.label || f.type,
            size: f.type === 'long_text' ? 280 : ['file_upload', 'image_upload', 'checkboxes', 'multiselect', 'matrix', 'address'].includes(f.type) ? 240 : 180,
            minSize: 90,
            filterFn: 'text',
            sortFn: NUMERIC_TYPES.has(f.type) ? 'basic' : 'alphanumeric',
            sortUndefined: 'last',
            cell: (c) => <AnswerView compact field={f} value={c.row.original.answers[f.id]} />,
          }),
        ),
        helper.accessor((r) => [r.meta?.city, r.meta?.country].filter(Boolean).join(', '), { id: 'location', header: 'Location', size: 160, filterFn: 'text', cell: (c) => <span className="block truncate">{c.getValue() || '—'}</span> }),
        helper.accessor((r) => r.meta?.device ?? '', { id: 'device', header: 'Device', size: 110, filterFn: 'text', cell: (c) => <span className="capitalize">{c.getValue() || '—'}</span> }),
        helper.accessor((r) => r.meta?.browser ?? '', { id: 'browser', header: 'Browser', size: 120, filterFn: 'text' }),
        helper.accessor((r) => (r.tags ?? []).join(', '), {
          id: 'tags',
          header: 'Tags',
          size: 150,
          filterFn: 'text',
          cell: (c) => (
            <span className="flex gap-1 overflow-hidden">
              {(c.row.original.tags ?? []).map((t) => (
                <span key={t} className="shrink-0 rounded bg-(--accent-soft) px-1.5 py-0.5 text-[11px] text-(--accent)">
                  {t}
                </span>
              ))}
            </span>
          ),
        }),
        helper.accessor((r) => r.meta?.ip ?? '', { id: 'ip', header: 'IP', size: 130, filterFn: 'text', cell: (c) => <span className="font-mono text-xs">{c.getValue() || '—'}</span> }),
      ]),
    [fields, patch],
  );

  const table = useTable({
    features,
    columns,
    data: view.rows,
    getRowId: (r) => r.id,
    state: { globalFilter, columnVisibility },
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    globalFilterFn: 'text',
    getColumnCanGlobalFilter: () => true,
    columnResizeMode: 'onChange',
    enableRowSelection: true,
    autoResetPageIndex: true,
    initialState: { sorting: [{ id: 'createdAt', desc: true }], pagination: { pageIndex: 0, pageSize: 25 } },
  });

  if (error) return <EmptyState icon={Inbox} title="Couldn’t load responses">{error}</EmptyState>;
  if (!form || !responses) return <PageLoader label="Opening the mailbox…" />;

  const filteredRows = table.getPrePaginatedRowModel().rows.map((r) => r.original);
  const selected = table.getSelectedRowModel().rows.map((r) => r.original.id);
  const pageRows = table.getRowModel().rows;
  const { pageIndex, pageSize } = table.state.pagination;
  const total = filteredRows.length;
  const exportCols = buildExportColumns(fields);
  const openIndex = openId ? filteredRows.findIndex((r) => r.id === openId) : -1;
  const openResponse = openIndex >= 0 ? filteredRows[openIndex] : (responses.find((r) => r.id === openId) ?? null);

  const doDelete = async () => {
    if (!confirm) return;
    setDeleting(true);
    try {
      if (confirm.ids.length === 1) await api.responses.remove(confirm.ids[0]);
      else await api.responses.bulkDelete(formId, confirm.ids);
      const gone = new Set(confirm.ids);
      setResponses((l) => l?.filter((r) => !gone.has(r.id)) ?? l);
      table.resetRowSelection();
      if (openId && gone.has(openId)) setOpenId(null);
      toast.success(`Deleted ${confirm.ids.length} ${confirm.ids.length === 1 ? 'response' : 'responses'}`);
      setConfirm(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  const hidableColumns = table.getAllLeafColumns().filter((c) => c.getCanHide());
  const cleanActive = JSON.stringify(clean) !== JSON.stringify(DEFAULT_CLEAN);

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        eyebrow={
          <Link href="/admin" className="hover:text-(--ink)">
            All forms
          </Link>
        }
        title={form.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={form.status} /> {fmtNum(responses.length)} responses
            {view.rows.length !== responses.length && <span className="text-(--ink-3)">· {fmtNum(view.rows.length)} after cleaning</span>}
          </span>
        }
        actions={
          <>
            <Link href={`/admin/forms/${formId}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-(--line) bg-white px-3.5 text-sm font-medium hover:border-(--line-2)">
              <PenSquare className="size-4" /> Edit
            </Link>
            <Link href={`/admin/forms/${formId}/analytics`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-(--line) bg-white px-3.5 text-sm font-medium hover:border-(--line-2)">
              <BarChart3 className="size-4" /> Analytics
            </Link>
          </>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-60">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--ink-3)" aria-hidden />
          <input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search all answers…"
            aria-label="Search responses"
            className="h-9 w-full rounded-lg border border-(--line) bg-white pr-3 pl-9 text-sm focus:border-(--accent) focus:ring-3 focus:ring-(--accent)/10 focus:outline-none"
          />
        </div>
        <Button icon={Filter} onClick={() => setShowFilters(!showFilters)} aria-pressed={showFilters} className={cn(showFilters && 'border-(--accent)/50 bg-(--accent-soft)/50')}>
          Filters
        </Button>
        <Button icon={Sparkles} onClick={() => setShowClean(!showClean)} aria-pressed={showClean} className={cn((showClean || cleanActive) && 'border-(--accent)/50 bg-(--accent-soft)/50')}>
          Clean{cleanActive && <span className="size-1.5 rounded-full bg-(--accent)" />}
        </Button>
        <Menu trigger={(p) => <Button icon={Columns3} {...p}>Columns</Button>}>
          {() => (
            <div className="fgl-scroll max-h-80 w-64 overflow-y-auto p-1">
              {hidableColumns.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-(--paper)">
                  <input type="checkbox" checked={c.getIsVisible()} onChange={c.getToggleVisibilityHandler()} className="accent-(--accent)" />
                  <span className="truncate">{String(c.columnDef.header)}</span>
                </label>
              ))}
            </div>
          )}
        </Menu>
        <Menu trigger={(p) => <Button variant="primary" icon={Download} {...p}>Export</Button>}>
          {(close) => (
            <>
              <p className="px-2.5 pt-1.5 pb-1 text-[11px] text-(--ink-3)">{fmtNum(total)} rows in current view</p>
              <MenuItem icon={FileSpreadsheet} onClick={() => { close(); exportCsv(form.title, filteredRows, exportCols); }}>CSV</MenuItem>
              <MenuItem icon={FileSpreadsheet} onClick={() => { close(); void exportXlsx(form.title, filteredRows, exportCols); }}>Excel (.xlsx)</MenuItem>
              <MenuItem icon={FileJson} onClick={() => { close(); exportJson(form.title, filteredRows, fields); }}>JSON</MenuItem>
              <MenuItem
                icon={ClipboardCopy}
                onClick={async () => {
                  close();
                  (await copyText(toDelimited(filteredRows, exportCols, '\t'))) ? toast.success('Copied — paste into any spreadsheet') : toast.error('Could not copy');
                }}
              >
                Copy as TSV
              </MenuItem>
            </>
          )}
        </Menu>
      </div>

      {showClean && <CleanPanel fields={fields} value={clean} onChange={setClean} dupExtras={view.dupExtras} onDeleteDuplicates={(ids) => setConfirm({ ids, title: `Delete ${ids.length} duplicate ${ids.length === 1 ? 'response' : 'responses'}?` })} onClose={() => setShowClean(false)} />}

      {selected.length > 0 && (
        <div className="fgl-anim-pop flex flex-wrap items-center gap-3 rounded-xl border border-(--accent)/25 bg-(--accent-soft)/60 px-4 py-2 text-sm">
          <span className="font-medium">{selected.length} selected</span>
          <Button size="sm" variant="danger" icon={Trash2} onClick={() => setConfirm({ ids: selected, title: `Delete ${selected.length} ${selected.length === 1 ? 'response' : 'responses'}?` })}>
            Delete
          </Button>
          <Button size="sm" variant="ghost" icon={X} onClick={() => table.resetRowSelection()}>
            Clear selection
          </Button>
        </div>
      )}

      {/* Table */}
      <Card className="overflow-hidden">
        {responses.length === 0 ? (
          <EmptyState icon={Inbox} title="No replies yet">
            Once people start sending your letter back, their answers will gather here.
          </EmptyState>
        ) : (
          <>
            <div className="fgl-scroll overflow-x-auto">
              <table className="table-fixed border-separate border-spacing-0 text-[13px]" style={{ width: table.getTotalSize(), minWidth: '100%' }}>
                <thead>
                  <tr>
                    {table.getFlatHeaders().filter((h) => h.column.getIsVisible()).map((h, i) => {
                      const sorted = h.column.getIsSorted();
                      const SortIcon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown;
                      return (
                        <th
                          key={h.id}
                          style={{ width: h.getSize() }}
                          aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                          className={cn('relative border-b border-(--line) bg-[#fbf8f3] px-3 py-2 text-left align-top font-medium text-(--ink-2)', i === 0 && 'sticky left-0 z-20 border-r')}
                        >
                          <div className="flex items-center gap-2">
                            {i === 0 && (
                              <input
                                type="checkbox"
                                aria-label="Select all on this page"
                                checked={table.getIsAllPageRowsSelected()}
                                ref={(el) => {
                                  if (el) el.indeterminate = table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected();
                                }}
                                onChange={table.getToggleAllPageRowsSelectedHandler()}
                                className="size-4 accent-(--accent)"
                              />
                            )}
                            <button type="button" onClick={h.column.getToggleSortingHandler()} className="group flex min-w-0 items-center gap-1 text-left hover:text-(--ink)" title={String(h.column.columnDef.header)}>
                              <span className="truncate">{String(h.column.columnDef.header)}</span>
                              <SortIcon className={cn('size-3 shrink-0', sorted ? 'text-(--accent)' : 'opacity-0 group-hover:opacity-60')} aria-hidden />
                            </button>
                          </div>
                          {showFilters && (
                            <input
                              value={String(h.column.getFilterValue() ?? '')}
                              onChange={(e) => h.column.setFilterValue(e.target.value || undefined)}
                              placeholder="Filter…"
                              aria-label={`Filter ${String(h.column.columnDef.header)}`}
                              className="mt-1.5 h-7 w-full rounded-md border border-(--line) bg-white px-2 text-xs font-normal focus:border-(--accent) focus:outline-none"
                            />
                          )}
                          <div
                            onMouseDown={h.getResizeHandler()}
                            onTouchStart={h.getResizeHandler()}
                            onDoubleClick={() => h.column.resetSize()}
                            role="separator"
                            aria-orientation="vertical"
                            aria-label={`Resize ${String(h.column.columnDef.header)}`}
                            className={cn('absolute top-0 right-0 h-full w-1.5 cursor-col-resize touch-none select-none hover:bg-(--accent)/30', h.column.getIsResizing() && 'bg-(--accent)/50')}
                          />
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => {
                    const dup = view.dupKeys.has(row.original.id);
                    const extra = view.dupExtras.includes(row.original.id);
                    return (
                      <tr
                        key={row.id}
                        onClick={() => setOpenId(row.original.id)}
                        className={cn('group cursor-pointer', row.getIsSelected() ? 'bg-[#fbf1ee]' : extra ? 'bg-[#fdf6e7]' : 'hover:bg-[#fcfaf6]')}
                      >
                        {row.getVisibleCells().map((cell, i) => (
                          <td
                            key={cell.id}
                            style={{ width: cell.column.getSize(), maxWidth: cell.column.getSize() }}
                            className={cn(
                              'h-12 overflow-hidden border-b border-(--line) px-3 py-2 align-middle',
                              i === 0 && 'sticky left-0 z-10 border-r bg-inherit',
                              i === 0 && dup && 'shadow-[inset_3px_0_0_#c7861c]',
                            )}
                          >
                            {i === 0 ? (
                              <div className={cn('-mx-3 -my-2 flex h-12 items-center px-3', row.getIsSelected() ? 'bg-[#fbf1ee]' : extra ? 'bg-[#fdf6e7]' : 'bg-white group-hover:bg-[#fcfaf6]')}>
                                <table.FlexRender cell={cell} />
                                {extra && <span className="ml-1.5 shrink-0 rounded bg-[#f3e2bd] px-1 text-[10px] font-medium text-[#8a6412]">dup</span>}
                              </div>
                            ) : (
                              <table.FlexRender cell={cell} />
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  {pageRows.length === 0 && (
                    <tr>
                      <td colSpan={99} className="py-12 text-center text-sm text-(--ink-3)">
                        No responses match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--line) px-4 py-2.5 text-[13px] text-(--ink-2)">
              <span>
                {total === 0 ? 'No rows' : `${fmtNum(pageIndex * pageSize + 1)}–${fmtNum(Math.min(total, (pageIndex + 1) * pageSize))} of ${fmtNum(total)}`}
              </span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5">
                  <span className="hidden sm:inline">Rows</span>
                  <Select value={pageSize} onChange={(e) => table.setPageSize(Number(e.target.value))} className="h-8 w-20" aria-label="Rows per page">
                    {[10, 25, 50, 100].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </Select>
                </label>
                <Button size="sm" icon={ChevronLeft} onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page" />
                <span className="tabular-nums">
                  {pageIndex + 1} / {Math.max(1, table.getPageCount())}
                </span>
                <Button size="sm" icon={ChevronRight} onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page" />
              </div>
            </div>
          </>
        )}
      </Card>

      {openResponse && (
        <ResponseDrawer
          response={openResponse}
          fields={form.fields}
          onClose={() => setOpenId(null)}
          position={openIndex >= 0 ? `${openIndex + 1} of ${filteredRows.length}` : undefined}
          onPrev={openIndex > 0 ? () => setOpenId(filteredRows[openIndex - 1].id) : undefined}
          onNext={openIndex >= 0 && openIndex < filteredRows.length - 1 ? () => setOpenId(filteredRows[openIndex + 1].id) : undefined}
          onPatch={patch}
          onDelete={(id) => setConfirm({ ids: [id], title: 'Delete this response?' })}
        />
      )}
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ''}
        message={`This permanently removes ${confirm?.ids.length === 1 ? 'the response' : 'these responses'} and can’t be undone.`}
        onConfirm={doDelete}
        onClose={() => setConfirm(null)}
        loading={deleting}
      />
      <Lightbox />
      <p className="text-center text-xs text-(--ink-3)">Last response {responses[0] ? fmtDateTime([...responses].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0].createdAt) : '—'}</p>
    </div>
  );
}

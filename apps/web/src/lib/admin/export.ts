import { formatAnswer, isInputField, type FormField, type FormResponse } from '@formgl/shared';
import { downloadBlob, slugifyFilename } from './utils';

export interface ExportColumn {
  id: string;
  header: string;
  value: (r: FormResponse) => string | number | boolean | null;
}

export function buildExportColumns(fields: FormField[]): ExportColumn[] {
  const cols: ExportColumn[] = [
    { id: 'id', header: 'Response ID', value: (r) => r.id },
    { id: 'createdAt', header: 'Submitted at', value: (r) => r.createdAt },
  ];
  for (const f of fields.filter((x) => isInputField(x.type))) {
    cols.push({ id: f.id, header: f.label || f.type, value: (r) => formatAnswer(f, r.answers[f.id]) });
  }
  cols.push(
    { id: 'starred', header: 'Starred', value: (r) => !!r.starred },
    { id: 'tags', header: 'Tags', value: (r) => (r.tags ?? []).join(', ') },
    { id: 'note', header: 'Note', value: (r) => r.note ?? '' },
    { id: 'ip', header: 'IP', value: (r) => r.meta?.ip ?? '' },
    { id: 'city', header: 'City', value: (r) => r.meta?.city ?? '' },
    { id: 'country', header: 'Country', value: (r) => r.meta?.country ?? '' },
    { id: 'device', header: 'Device', value: (r) => r.meta?.device ?? '' },
    { id: 'browser', header: 'Browser', value: (r) => r.meta?.browser ?? '' },
    { id: 'os', header: 'OS', value: (r) => r.meta?.os ?? '' },
    { id: 'referrer', header: 'Referrer', value: (r) => r.meta?.referrer ?? '' },
    { id: 'durationSec', header: 'Duration (s)', value: (r) => (r.meta?.durationMs ? Math.round(r.meta.durationMs / 1000) : '') },
  );
  return cols;
}

function matrix(rows: FormResponse[], cols: ExportColumn[]) {
  return [cols.map((c) => c.header), ...rows.map((r) => cols.map((c) => c.value(r)))];
}

const csvCell = (v: unknown, sep: string) => {
  const s = v == null ? '' : String(v);
  if (sep === '\t') return s.replace(/[\t\r\n]+/g, ' ');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toDelimited(rows: FormResponse[], cols: ExportColumn[], sep = ',') {
  return matrix(rows, cols)
    .map((line) => line.map((v) => csvCell(v, sep)).join(sep))
    .join('\r\n');
}

export function exportCsv(title: string, rows: FormResponse[], cols: ExportColumn[]) {
  downloadBlob(new Blob(['﻿' + toDelimited(rows, cols)], { type: 'text/csv;charset=utf-8' }), `${slugifyFilename(title)}-responses.csv`);
}

export function exportJson(title: string, rows: FormResponse[], fields: FormField[]) {
  const byId = new Map(fields.map((f) => [f.id, f]));
  const data = rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    starred: !!r.starred,
    tags: r.tags ?? [],
    note: r.note ?? '',
    answers: Object.fromEntries(Object.entries(r.answers).map(([k, v]) => [byId.get(k)?.label || k, v])),
    meta: r.meta,
  }));
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `${slugifyFilename(title)}-responses.json`);
}

export async function exportXlsx(title: string, rows: FormResponse[], cols: ExportColumn[]) {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet(matrix(rows, cols));
  ws['!cols'] = cols.map((c) => ({ wch: Math.min(48, Math.max(10, c.header.length + 2)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Responses');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  downloadBlob(
    new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${slugifyFilename(title)}-responses.xlsx`,
  );
}

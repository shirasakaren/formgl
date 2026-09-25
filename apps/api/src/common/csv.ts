/** RFC 4180 cell escaping with basic spreadsheet formula-injection protection. */
export function csvCell(value: unknown): string {
  if (value == null) return '';
  let s = typeof value === 'string' ? value : String(value);
  if (/^[=+@\t\r]/.test(s) || /^-[^\d.\s]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: unknown[][]): string {
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

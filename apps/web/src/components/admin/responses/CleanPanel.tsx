'use client';

import { RotateCcw, Sparkles, Trash2, X } from 'lucide-react';
import { formatAnswer, isEmptyAnswer, type AnswerValue, type FormField, type FormResponse } from '@formgl/shared';
import { TEXT_TYPES } from '@/lib/admin/stats';
import { Button, Card, Field, IconButton, Input, Select, ToggleRow } from '../ui';

export interface CleanOptions {
  trim: boolean;
  caseField: string;
  caseMode: 'none' | 'lower' | 'upper' | 'title' | 'sentence';
  dupField: string;
  onlyDuplicates: boolean;
  hideEmpty: boolean;
  starredOnly: boolean;
  from: string;
  to: string;
}
export const DEFAULT_CLEAN: CleanOptions = { trim: false, caseField: '', caseMode: 'none', dupField: '', onlyDuplicates: false, hideEmpty: false, starredOnly: false, from: '', to: '' };

const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();
function recase(s: string, mode: CleanOptions['caseMode']) {
  switch (mode) {
    case 'lower':
      return s.toLowerCase();
    case 'upper':
      return s.toUpperCase();
    case 'title':
      return s.toLowerCase().replace(/(^|[\s\-'])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());
    case 'sentence':
      return s.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());
    default:
      return s;
  }
}
function mapStrings(v: AnswerValue, fn: (s: string) => string): AnswerValue {
  if (typeof v === 'string') return fn(v);
  if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return (v as string[]).map(fn);
  if (v && typeof v === 'object' && !Array.isArray(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typeof x === 'string' ? fn(x) : x])) as AnswerValue;
  return v;
}

/** Non-destructive view transform. Returns transformed rows + duplicate info. */
export function applyClean(responses: FormResponse[], fields: FormField[], o: CleanOptions) {
  const fromT = o.from ? new Date(`${o.from}T00:00:00`).getTime() : -Infinity;
  const toT = o.to ? new Date(`${o.to}T23:59:59.999`).getTime() : Infinity;
  let rows = responses.filter((r) => {
    const t = new Date(r.createdAt).getTime();
    if (t < fromT || t > toT) return false;
    if (o.starredOnly && !r.starred) return false;
    if (o.hideEmpty && fields.every((f) => isEmptyAnswer(r.answers[f.id]))) return false;
    return true;
  });
  if (o.trim || (o.caseField && o.caseMode !== 'none')) {
    rows = rows.map((r) => {
      const answers = { ...r.answers };
      for (const k of Object.keys(answers)) {
        if (answers[k] == null) continue;
        if (o.trim) answers[k] = mapStrings(answers[k], tidy);
        if (k === o.caseField && o.caseMode !== 'none') answers[k] = mapStrings(answers[k], (s) => recase(s, o.caseMode));
      }
      return { ...r, answers };
    });
  }
  const dupKeys = new Set<string>();
  const dupExtras: string[] = [];
  if (o.dupField) {
    const f = fields.find((x) => x.id === o.dupField);
    const groups = new Map<string, FormResponse[]>();
    for (const r of rows) {
      const key = tidy(formatAnswer(f, r.answers[o.dupField])).toLowerCase();
      if (!key) continue;
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      g.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      g.forEach((r, i) => {
        dupKeys.add(r.id);
        if (i > 0) dupExtras.push(r.id);
      });
    }
    if (o.onlyDuplicates) rows = rows.filter((r) => dupKeys.has(r.id));
  }
  return { rows, dupKeys, dupExtras };
}

export function CleanPanel({ fields, value, onChange, dupExtras, onDeleteDuplicates, onClose }: { fields: FormField[]; value: CleanOptions; onChange: (o: CleanOptions) => void; dupExtras: string[]; onDeleteDuplicates: (ids: string[]) => void; onClose: () => void }) {
  const set = (p: Partial<CleanOptions>) => onChange({ ...value, ...p });
  const textFields = fields.filter((f) => TEXT_TYPES.has(f.type) || f.type === 'dropdown' || f.type === 'multiple_choice');
  return (
    <Card className="fgl-anim-pop p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <Sparkles className="size-4 text-(--accent)" /> Clean up the view
          </h3>
          <p className="text-xs text-(--ink-2)">These only change what you see and export — your stored responses stay untouched (except explicit deletes).</p>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => onChange(DEFAULT_CLEAN)}>
            Reset
          </Button>
          <IconButton icon={X} label="Close clean panel" onClick={onClose} size="sm" />
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1">
          <p className="mb-1 text-[11px] font-semibold tracking-[0.08em] text-(--ink-3) uppercase">Tidy</p>
          <ToggleRow label="Trim whitespace" hint="Collapse extra spaces" checked={value.trim} onChange={(trim) => set({ trim })} />
          <ToggleRow label="Hide empty responses" checked={value.hideEmpty} onChange={(hideEmpty) => set({ hideEmpty })} />
          <ToggleRow label="Starred only" checked={value.starredOnly} onChange={(starredOnly) => set({ starredOnly })} />
        </div>
        <div className="space-y-3">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-(--ink-3) uppercase">Normalize case</p>
          <Field label="Column">
            {(id) => (
              <Select id={id} value={value.caseField} onChange={(e) => set({ caseField: e.target.value })}>
                <option value="">Choose a text column…</option>
                {textFields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label || f.type}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Case">
            {(id) => (
              <Select id={id} value={value.caseMode} disabled={!value.caseField} onChange={(e) => set({ caseMode: e.target.value as CleanOptions['caseMode'] })}>
                <option value="none">As written</option>
                <option value="lower">lowercase</option>
                <option value="upper">UPPERCASE</option>
                <option value="title">Title Case</option>
                <option value="sentence">Sentence case</option>
              </Select>
            )}
          </Field>
        </div>
        <div className="space-y-3">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-(--ink-3) uppercase">Duplicates</p>
          <Field label="Find duplicates by">
            {(id) => (
              <Select id={id} value={value.dupField} onChange={(e) => set({ dupField: e.target.value, onlyDuplicates: e.target.value ? value.onlyDuplicates : false })}>
                <option value="">Off</option>
                {fields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label || f.type}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {value.dupField && (
            <>
              <ToggleRow label="Show only duplicates" checked={value.onlyDuplicates} onChange={(onlyDuplicates) => set({ onlyDuplicates })} />
              {dupExtras.length > 0 ? (
                <Button size="sm" variant="danger" icon={Trash2} onClick={() => onDeleteDuplicates(dupExtras)} className="w-full">
                  Delete {dupExtras.length} extra {dupExtras.length === 1 ? 'copy' : 'copies'} (keep oldest)
                </Button>
              ) : (
                <p className="text-xs text-[#2f7a4a]">No duplicates found ✓</p>
              )}
            </>
          )}
        </div>
        <div className="space-y-3">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-(--ink-3) uppercase">Date range</p>
          <Field label="From">{(id) => <Input id={id} type="date" value={value.from} onChange={(e) => set({ from: e.target.value })} />}</Field>
          <Field label="To">{(id) => <Input id={id} type="date" value={value.to} onChange={(e) => set({ to: e.target.value })} />}</Field>
        </div>
      </div>
    </Card>
  );
}

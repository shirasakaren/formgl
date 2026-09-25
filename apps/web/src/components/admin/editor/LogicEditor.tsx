'use client';

import { GitBranch, Plus, Trash2 } from 'lucide-react';
import { isInputField, type FieldLogic, type FormField, type LogicOperator } from '@formgl/shared';
import { Button, IconButton, Input, Select } from '../ui';

const OPS: Array<{ value: LogicOperator; label: string; needsValue: boolean }> = [
  { value: 'eq', label: 'is', needsValue: true },
  { value: 'neq', label: 'is not', needsValue: true },
  { value: 'contains', label: 'contains', needsValue: true },
  { value: 'not_contains', label: 'does not contain', needsValue: true },
  { value: 'gt', label: 'is greater than', needsValue: true },
  { value: 'lt', label: 'is less than', needsValue: true },
  { value: 'empty', label: 'is empty', needsValue: false },
  { value: 'not_empty', label: 'is answered', needsValue: false },
];

export function LogicEditor({ field, fields, onChange }: { field: FormField; fields: FormField[]; onChange: (logic: FieldLogic | undefined) => void }) {
  const sources = fields.filter((f) => f.id !== field.id && isInputField(f.type));
  const logic = field.logic;

  if (!logic || !logic.conditions?.length) {
    return (
      <div className="rounded-lg border border-dashed border-(--line-2) p-3 text-center">
        <p className="text-xs text-(--ink-2)">Always shown. Add a rule to show or hide this based on earlier answers.</p>
        <Button
          size="sm"
          variant="ghost"
          icon={GitBranch}
          className="mt-2"
          disabled={!sources.length}
          onClick={() => onChange({ action: 'show', match: 'all', conditions: [{ fieldId: sources[0]?.id ?? '', op: 'eq', value: '' }] })}
        >
          Add condition
        </Button>
      </div>
    );
  }

  const setCond = (i: number, patch: Partial<FieldLogic['conditions'][number]>) =>
    onChange({ ...logic, conditions: logic.conditions.map((c, k) => (k === i ? { ...c, ...patch } : c)) });

  return (
    <div className="space-y-2 rounded-lg border border-(--line) bg-[#fdfbf7] p-2.5">
      <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
        <Select value={logic.action} onChange={(e) => onChange({ ...logic, action: e.target.value as FieldLogic['action'] })} className="h-8 w-auto" aria-label="Action">
          <option value="show">Show</option>
          <option value="hide">Hide</option>
        </Select>
        <span>this when</span>
        <Select value={logic.match} onChange={(e) => onChange({ ...logic, match: e.target.value as FieldLogic['match'] })} className="h-8 w-auto" aria-label="Match">
          <option value="all">all</option>
          <option value="any">any</option>
        </Select>
        <span>of these match:</span>
      </div>
      <ul className="space-y-2">
        {logic.conditions.map((c, i) => {
          const src = fields.find((f) => f.id === c.fieldId);
          const op = OPS.find((o) => o.value === c.op);
          const choices =
            src?.type === 'yes_no'
              ? [
                  { v: 'true', l: src.config?.yesLabel || 'Yes' },
                  { v: 'false', l: src.config?.noLabel || 'No' },
                ]
              : src?.options?.length && (c.op === 'eq' || c.op === 'neq')
                ? src.options.map((o) => ({ v: o.label, l: o.label }))
                : null;
          return (
            <li key={i} className="space-y-1.5 rounded-md bg-white p-2 ring-1 ring-(--line)">
              <div className="flex gap-1.5">
                <Select value={c.fieldId} onChange={(e) => setCond(i, { fieldId: e.target.value, value: '' })} className="h-8" aria-label="Question">
                  {sources.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label || f.type}
                    </option>
                  ))}
                </Select>
                <IconButton size="sm" icon={Trash2} label="Remove condition" onClick={() => {
                  const next = logic.conditions.filter((_, k) => k !== i);
                  onChange(next.length ? { ...logic, conditions: next } : undefined);
                }} />
              </div>
              <div className="flex gap-1.5">
                <Select value={c.op} onChange={(e) => setCond(i, { op: e.target.value as LogicOperator })} className="h-8" aria-label="Operator">
                  {OPS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                {op?.needsValue &&
                  (choices ? (
                    <Select value={String(c.value ?? '')} onChange={(e) => setCond(i, { value: e.target.value })} className="h-8" aria-label="Value">
                      <option value="">Choose…</option>
                      {choices.map((o) => (
                        <option key={o.v} value={o.v}>
                          {o.l}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input value={String(c.value ?? '')} onChange={(e) => setCond(i, { value: e.target.value })} className="h-8" placeholder="Value" aria-label="Value" />
                  ))}
              </div>
            </li>
          );
        })}
      </ul>
      <Button size="sm" variant="ghost" icon={Plus} onClick={() => onChange({ ...logic, conditions: [...logic.conditions, { fieldId: sources[0]?.id ?? '', op: 'eq', value: '' }] })}>
        Add condition
      </Button>
    </div>
  );
}

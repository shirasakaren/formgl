'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { uid, type FieldOption } from '@formgl/shared';
import { cn } from '@/lib/admin/utils';
import { Button, IconButton, Input } from '../ui';
import { MediaInput } from '../UploadButton';

export function OptionsEditor({ options, onChange, allowImages = true, noun = 'option' }: { options: FieldOption[]; onChange: (o: FieldOption[]) => void; allowImages?: boolean; noun?: string }) {
  const [imageFor, setImageFor] = useState<string | null>(null);
  const update = (id: string, patch: Partial<FieldOption>) => onChange(options.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= options.length) return;
    const next = [...options];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => onChange([...options, { id: uid('o'), label: `${noun[0].toUpperCase()}${noun.slice(1)} ${options.length + 1}` }]);
  const bulk = (text: string, index: number) => {
    const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (lines.length < 2) return false;
    const next = [...options];
    next.splice(index, 1, ...lines.map((label, k) => (k === 0 ? { ...options[index], label } : { id: uid('o'), label })));
    onChange(next);
    return true;
  };

  return (
    <div className="space-y-1.5">
      <ul className="space-y-1.5">
        {options.map((o, i) => (
          <li key={o.id} className="rounded-lg border border-(--line) bg-[#fdfbf7] p-1.5">
            <div className="flex items-center gap-1">
              <span className="w-5 shrink-0 text-center text-[11px] text-(--ink-3) tabular-nums">{i + 1}</span>
              <Input
                value={o.label}
                onChange={(e) => update(o.id, { label: e.target.value })}
                onPaste={(e) => {
                  if (bulk(e.clipboardData.getData('text'), i)) e.preventDefault();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    add();
                  }
                }}
                aria-label={`${noun} ${i + 1}`}
                className="h-8 bg-white"
              />
              {allowImages && <IconButton size="sm" icon={ImagePlus} label="Option image" active={!!o.imageUrl || imageFor === o.id} onClick={() => setImageFor(imageFor === o.id ? null : o.id)} />}
              <IconButton size="sm" icon={ArrowUp} label="Move up" disabled={i === 0} onClick={() => move(i, -1)} />
              <IconButton size="sm" icon={ArrowDown} label="Move down" disabled={i === options.length - 1} onClick={() => move(i, 1)} />
              <IconButton size="sm" icon={Trash2} label={`Remove ${noun}`} disabled={options.length <= 1} onClick={() => onChange(options.filter((x) => x.id !== o.id))} />
            </div>
            {allowImages && (imageFor === o.id || o.imageUrl) && (
              <div className={cn('mt-1.5 pl-6', imageFor !== o.id && 'hidden')}>
                <MediaInput label="Option image" value={o.imageUrl} onChange={(v) => update(o.id, { imageUrl: v })} />
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-2">
        <Button size="sm" variant="ghost" icon={Plus} onClick={add}>
          Add {noun}
        </Button>
        <span className="text-[11px] text-(--ink-3)">Tip: paste a list to add many</span>
      </div>
    </div>
  );
}

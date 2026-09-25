'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { DEFAULT_THEME, FIELD_META, TEMPLATES, isInputField, type FormTemplate } from '@formgl/shared';
import { api, errorMessage } from '@/lib/admin/api';
import { cn } from '@/lib/admin/utils';
import { Modal, Segmented, Spinner } from './ui';
import { EnvelopeSwatch } from './EnvelopeSwatch';

export function TemplateGallery({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [cat, setCat] = useState<string>('All');
  const [busy, setBusy] = useState<string | null>(null);
  const categories = useMemo(() => ['All', ...Array.from(new Set(TEMPLATES.map((t) => t.category)))], []);
  const list = TEMPLATES.filter((t) => t.id !== 'blank' && (cat === 'All' || t.category === cat));
  const grouped = useMemo(() => {
    const m = new Map<string, FormTemplate[]>();
    for (const t of list) m.set(t.category, [...(m.get(t.category) ?? []), t]);
    return [...m.entries()];
  }, [list]);

  const create = async (templateId?: string) => {
    setBusy(templateId ?? 'blank');
    try {
      const form = await api.forms.create(templateId && templateId !== 'blank' ? { templateId } : { templateId: 'blank' });
      toast.success('Your new letter is ready');
      router.push(`/admin/forms/${form.id}`);
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Start a new letter" description="Pick a template to begin — everything can be changed later." size="xl">
      <Segmented label="Category" value={cat} onChange={setCat} options={categories.map((c) => ({ value: c, label: c }))} size="sm" className="mb-5" />
      <div className="space-y-6">
        {cat === 'All' && (
          <button
            type="button"
            onClick={() => create('blank')}
            disabled={!!busy}
            className="group flex w-full items-center gap-4 rounded-xl border border-dashed border-(--line-2) bg-[#fdfbf7] p-4 text-left transition-colors hover:border-(--accent) hover:bg-white"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-white text-(--accent) ring-1 ring-(--line) transition-transform group-hover:scale-105">
              {busy === 'blank' ? <Spinner /> : <Plus className="size-5" />}
            </span>
            <span>
              <span className="block font-medium">Blank letter</span>
              <span className="block text-[13px] text-(--ink-2)">Start from an empty sheet of paper.</span>
            </span>
          </button>
        )}
        {grouped.map(([category, items]) => (
          <section key={category}>
            <h3 className="mb-2.5 text-[11px] font-semibold tracking-[0.08em] text-(--ink-3) uppercase">{category}</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((t) => {
                const theme = { ...DEFAULT_THEME, ...t.theme };
                const fields = t.fields();
                const inputs = fields.filter((f) => isInputField(f.type));
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={!!busy}
                    onClick={() => create(t.id)}
                    className={cn(
                      'group relative flex flex-col overflow-hidden rounded-xl border border-(--line) bg-white text-left transition-all hover:-translate-y-0.5 hover:border-(--line-2) hover:shadow-[0_12px_28px_-12px_rgba(60,40,20,.3)] disabled:opacity-60',
                      busy === t.id && 'ring-2 ring-(--accent)',
                    )}
                  >
                    <div className="relative flex h-28 items-center justify-center" style={{ background: `linear-gradient(160deg, ${theme.loaderColor}, ${theme.paperColor})` }}>
                      <EnvelopeSwatch envelope={theme.envelopeColor} seal={theme.sealColor} paper={theme.paperColor} className="w-24 transition-transform group-hover:scale-105" />
                      {busy === t.id && (
                        <div className="absolute inset-0 grid place-items-center bg-white/60">
                          <Spinner />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-3.5">
                      <span className="font-medium">{t.name}</span>
                      <span className="mt-0.5 line-clamp-2 text-[13px] text-(--ink-2)">{t.description}</span>
                      <span className="mt-2.5 flex flex-wrap gap-1">
                        {inputs.slice(0, 3).map((f) => (
                          <span key={f.id} className="rounded bg-(--paper) px-1.5 py-0.5 text-[11px] text-(--ink-2)">
                            {FIELD_META[f.type]?.label}
                          </span>
                        ))}
                        {inputs.length > 3 && <span className="px-1 py-0.5 text-[11px] text-(--ink-3)">+{inputs.length - 3}</span>}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  );
}

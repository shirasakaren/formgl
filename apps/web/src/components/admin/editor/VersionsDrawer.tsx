'use client';

import { useEffect, useState } from 'react';
import { History, RotateCcw, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { environmentMeta, type FormVersionSummary } from '@formgl/shared';
import { api, errorMessage } from '@/lib/admin/api';
import { useEditor } from '@/lib/admin/editor-store';
import { fmtAgo, fmtDate } from '@/lib/admin/utils';
import { Button, Drawer, EmptyState, Spinner } from '../ui';

/** Published versions of a form: see what is live, bring an old one back into the draft. */
export function VersionsDrawer({ open, onClose, saveNow }: { open: boolean; onClose: () => void; saveNow: () => Promise<boolean> }) {
  const form = useEditor((s) => s.form);
  const replaceDraft = useEditor((s) => s.replaceDraft);
  const syncServer = useEditor((s) => s.syncServer);
  const [items, setItems] = useState<FormVersionSummary[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !form) return;
    setItems(null);
    api.forms
      .versions(form.id)
      .then(setItems)
      .catch((e) => {
        toast.error(errorMessage(e));
        setItems([]);
      });
  }, [open, form?.id, form?.liveVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!form) return null;

  const restore = async (v: FormVersionSummary) => {
    setBusy(v.id);
    try {
      await saveNow();
      const doc = await api.forms.restoreVersion(form.id, v.id);
      replaceDraft(doc);
      syncServer(doc);
      toast.success(`Version ${v.version} is back in your draft — publish to make it live`);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const discard = async () => {
    setBusy('discard');
    try {
      await saveNow();
      const doc = await api.forms.discard(form.id);
      replaceDraft(doc);
      syncServer(doc);
      toast.success('Draft reset to the live version');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="max-w-md"
      title={
        <div className="flex items-center gap-2">
          <History className="size-4 text-(--accent)" />
          <span className="font-display text-lg font-semibold">Version history</span>
        </div>
      }
      footer={
        form.hasUnpublishedChanges && (form.liveVersion ?? 0) > 0 ? (
          <Button icon={Undo2} onClick={discard} loading={busy === 'discard'} className="w-full justify-center">
            Discard draft changes
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-3 p-5">
        <p className="text-[13px] leading-relaxed text-(--ink-2)">
          Edits are saved to a <strong>draft</strong>. Respondents keep seeing the live version until you publish your changes, and every publish is kept here.
        </p>
        {!items && (
          <div className="grid place-items-center py-10">
            <Spinner />
          </div>
        )}
        {items?.length === 0 && (
          <EmptyState icon={History} title="Nothing published yet">
            Publish this letter to create its first version.
          </EmptyState>
        )}
        <ol className="relative space-y-2 border-l border-(--line) pl-4">
          {items?.map((v) => (
            <li key={v.id} className="relative rounded-xl border border-(--line) bg-white p-3">
              <span className={`absolute top-4 -left-[21px] size-2.5 rounded-full border-2 border-white ${v.live ? 'bg-[#2f7a4a]' : 'bg-(--line-2)'}`} aria-hidden />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-[15px] font-semibold">Version {v.version}</span>
                    {v.live && <span className="rounded-full bg-[#e7f3ea] px-2 py-0.5 text-[11px] font-medium text-[#2f7a4a]">Live</span>}
                  </div>
                  <p className="truncate text-[12.5px] text-(--ink-2)">{v.title || 'Untitled'}</p>
                  {v.note && <p className="mt-1 text-[12.5px] text-(--ink)">“{v.note}”</p>}
                  <p className="mt-1 text-[11.5px] text-(--ink-3)">
                    {fmtDate(v.createdAt, 'MMM d, yyyy · HH:mm')} · {fmtAgo(v.createdAt)} · {v.questionCount} questions · {environmentMeta(v.environment).label}
                  </p>
                </div>
                {!v.live && (
                  <Button size="sm" icon={RotateCcw} onClick={() => restore(v)} loading={busy === v.id}>
                    Restore
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Drawer>
  );
}

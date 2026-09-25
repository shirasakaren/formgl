'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  CornerDownLeft,
  Eye,
  FilePlus2,
  History,
  Inbox,
  LayoutGrid,
  Link2,
  LogOut,
  Palette,
  PenSquare,
  Plug,
  Rocket,
  Search,
  Settings2,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import type { FormSummary } from '@formgl/shared';
import { api, errorMessage } from '@/lib/admin/api';
import { cn, copyText, publicUrl } from '@/lib/admin/utils';

interface Cmd {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  keywords?: string;
  run: () => void;
}

/** subsequence match with a bonus for word starts and contiguous runs; 0 = no match */
function score(q: string, text: string): number {
  if (!q) return 1;
  const t = text.toLowerCase();
  const ql = q.toLowerCase();
  if (t.includes(ql)) return 100 + (t.startsWith(ql) ? 20 : 0) - t.length * 0.01;
  let s = 0;
  let ti = 0;
  let run = 0;
  let first = -1;
  for (const ch of ql) {
    const i = t.indexOf(ch, ti);
    if (i < 0) return 0;
    if (first < 0) first = i;
    run = i === ti ? run + 1 : 0;
    s += 1 + run * 2 + (i === 0 || t[i - 1] === ' ' ? 3 : 0);
    ti = i + 1;
  }
  // letters scattered all over the text are not a match
  if (ti - first > ql.length * 3 + 2) return 0;
  return s - t.length * 0.01;
}

/** fire an editor action (the editor listens for these) */
export const editorAction = (action: string) => window.dispatchEvent(new CustomEvent('fgl:editor', { detail: action }));

/** ⌘K / Ctrl-K: jump to any form or action from anywhere in the studio. */
export function CommandPalette({ formId, onLogout }: { formId?: string; onLogout: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [forms, setForms] = useState<FormSummary[] | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('fgl:palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('fgl:palette', onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setSel(0);
    requestAnimationFrame(() => input.current?.focus());
    api.forms.list().then(setForms).catch(() => setForms([]));
  }, [open]);

  const go = (href: string) => () => router.push(href);
  const commands = useMemo<Cmd[]>(() => {
    const cmds: Cmd[] = [];
    if (formId) {
      const f = forms?.find((x) => x.id === formId);
      const here = f?.title || 'this form';
      cmds.push(
        { id: 'e-build', group: here, label: 'Edit questions', icon: PenSquare, run: () => (router.push(`/admin/forms/${formId}#build`), editorAction('tab:build')) },
        { id: 'e-design', group: here, label: 'Design & world', icon: Palette, keywords: 'theme colours environment', run: () => (router.push(`/admin/forms/${formId}#design`), editorAction('tab:design')) },
        { id: 'e-settings', group: here, label: 'Settings', icon: Settings2, keywords: 'limit schedule close', run: () => (router.push(`/admin/forms/${formId}#settings`), editorAction('tab:settings')) },
        { id: 'e-share', group: here, label: 'Share & link', icon: Link2, keywords: 'publish qr embed', run: () => (router.push(`/admin/forms/${formId}#share`), editorAction('tab:share')) },
        { id: 'e-connect', group: here, label: 'Webhooks & integrations', icon: Plug, keywords: 'slack discord zapier', run: () => (router.push(`/admin/forms/${formId}#connect`), editorAction('tab:connect')) },
        { id: 'e-publish', group: here, label: 'Publish changes', icon: Rocket, run: () => editorAction('publish') },
        { id: 'e-preview', group: here, label: 'Toggle live preview', icon: Eye, run: () => editorAction('preview') },
        { id: 'e-history', group: here, label: 'Version history', icon: History, run: () => editorAction('history') },
        { id: 'e-responses', group: here, label: 'Responses', icon: Inbox, run: go(`/admin/forms/${formId}/responses`) },
        { id: 'e-analytics', group: here, label: 'Analytics', icon: BarChart3, run: go(`/admin/forms/${formId}/analytics`) },
      );
      if (f && !f.slug.startsWith('draft-'))
        cmds.push({
          id: 'e-copy',
          group: here,
          label: 'Copy public link',
          icon: Link2,
          run: async () => ((await copyText(publicUrl(f.slug))) ? toast.success('Link copied') : toast.error('Could not copy')),
        });
    }
    cmds.push(
      { id: 'all', group: 'Studio', label: 'All forms', icon: LayoutGrid, run: go('/admin') },
      {
        id: 'new',
        group: 'Studio',
        label: 'New blank form',
        icon: FilePlus2,
        keywords: 'create',
        run: async () => {
          try {
            const doc = await api.forms.create({ templateId: 'blank' });
            router.push(`/admin/forms/${doc.id}`);
          } catch (e) {
            toast.error(errorMessage(e));
          }
        },
      },
      { id: 'logout', group: 'Studio', label: 'Sign out', icon: LogOut, run: onLogout },
    );
    for (const f of forms ?? []) {
      if (f.id === formId) continue;
      cmds.push({ id: `f-${f.id}`, group: 'Forms', label: f.title || 'Untitled', hint: `/${f.slug} · ${f.responseCount} replies`, icon: PenSquare, keywords: f.slug, run: go(`/admin/forms/${f.id}`) });
      cmds.push({ id: `r-${f.id}`, group: 'Forms', label: `${f.title || 'Untitled'} — responses`, icon: Inbox, keywords: `${f.slug} replies inbox`, run: go(`/admin/forms/${f.id}/responses`) });
    }
    return cmds;
  }, [forms, formId, router, onLogout]); // eslint-disable-line react-hooks/exhaustive-deps

  const results = useMemo(() => {
    const scored = commands.map((c) => ({ c, s: Math.max(score(q, c.label), score(q, `${c.label} ${c.keywords ?? ''} ${c.hint ?? ''}`) * 0.8) })).filter((x) => x.s > 0);
    if (q) scored.sort((a, b) => b.s - a.s);
    return scored.slice(0, 40).map((x) => x.c);
  }, [commands, q]);

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${sel}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  if (!open || typeof document === 'undefined') return null;
  const run = (c?: Cmd) => {
    if (!c) return;
    setOpen(false);
    c.run();
  };
  let lastGroup = '';

  return createPortal(
    <div className="fgl-admin fixed inset-0 z-[120] !min-h-0 !bg-transparent">
      <div className="fgl-anim-fade absolute inset-0 bg-[#2b2320]/35 backdrop-blur-[2px]" onClick={() => setOpen(false)} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="fgl-anim-pop absolute top-[12vh] left-1/2 w-[min(640px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-2xl border border-(--line) bg-white shadow-[0_30px_80px_-20px_rgba(43,35,32,.45)]"
      >
        <div className="flex items-center gap-3 border-b border-(--line) px-4">
          <Search className="size-4 text-(--ink-3)" aria-hidden />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSel((s) => Math.min(results.length - 1, s + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSel((s) => Math.max(0, s - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                run(results[sel]);
              } else if (e.key === 'Escape') setOpen(false);
            }}
            placeholder="Search forms and actions…"
            aria-label="Search forms and actions"
            role="combobox"
            aria-expanded
            aria-controls="fgl-palette-list"
            aria-activedescendant={results[sel] ? `cmd-${results[sel].id}` : undefined}
            className="h-13 min-w-0 flex-1 bg-transparent py-4 text-[15px] !outline-none placeholder:text-(--ink-3)"
          />
          <kbd className="rounded-md border border-(--line) px-1.5 py-0.5 text-[11px] text-(--ink-3)">esc</kbd>
        </div>
        <ul ref={list} id="fgl-palette-list" role="listbox" className="fgl-scroll max-h-[min(60vh,440px)] overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-(--ink-3)">Nothing matches “{q}”</li>}
          {results.map((c, i) => {
            const head = c.group !== lastGroup ? c.group : null;
            lastGroup = c.group;
            return (
              <li key={c.id}>
                {head && <p className="px-3 pt-2 pb-1 text-[10.5px] font-semibold tracking-[0.12em] text-(--ink-3) uppercase">{head}</p>}
                <button
                  id={`cmd-${c.id}`}
                  data-i={i}
                  role="option"
                  aria-selected={i === sel}
                  onMouseMove={() => setSel(i)}
                  onClick={() => run(c)}
                  className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px]', i === sel ? 'bg-(--paper-2) text-(--ink)' : 'text-(--ink-2)')}
                >
                  <c.icon className={cn('size-4 shrink-0', i === sel && 'text-(--accent)')} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{c.label}</span>
                  {c.hint && <span className="hidden truncate text-[12px] text-(--ink-3) sm:inline">{c.hint}</span>}
                  {i === sel && <CornerDownLeft className="size-3.5 text-(--ink-3)" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-4 border-t border-(--line) bg-[#fcfaf6] px-4 py-2 text-[11.5px] text-(--ink-3)">
          <span>↑↓ to move</span>
          <span>↵ to open</span>
          <span className="ml-auto">⌘K anywhere</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

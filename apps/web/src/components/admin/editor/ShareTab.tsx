'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Code2, Copy, Download, ExternalLink, Eye, Link2, Lock, Rocket, Shuffle, Undo2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { isValidSlug, normalizeSlug, type FormDoc } from '@formgl/shared';
import { api, errorMessage } from '@/lib/admin/api';
import { useEditor } from '@/lib/admin/editor-store';
import { qrSvgPath } from '@/lib/admin/qr';
import { cn, copyText, downloadBlob, fmtDateTime, publicUrl, slugifyFilename } from '@/lib/admin/utils';
import { Button, Card, Input, StatusBadge, Textarea } from '../ui';

type Check = { state: 'idle' | 'checking' | 'ok' | 'bad'; message?: string };

export function ShareTab({ saveNow }: { saveNow: () => Promise<boolean> }) {
  const form = useEditor((s) => s.form) as FormDoc;
  const syncServer = useEditor((s) => s.syncServer);
  const isDraftSlug = form.slug.startsWith('draft-');
  const [mode, setMode] = useState<'custom' | 'random'>(isDraftSlug ? 'custom' : 'custom');
  const [slug, setSlug] = useState(isDraftSlug ? normalizeSlug(form.title).slice(0, 40) : form.slug);
  const [check, setCheck] = useState<Check>({ state: 'idle' });
  const [busy, setBusy] = useState<null | 'publish' | 'unpublish' | 'close'>(null);
  const live = form.status === 'published';
  const url = publicUrl(form.slug);
  const normalized = normalizeSlug(slug);
  const unchanged = live && normalized === form.slug;

  useEffect(() => {
    if (mode !== 'custom') return setCheck({ state: 'idle' });
    if (!normalized) return setCheck({ state: 'bad', message: 'Enter a link name' });
    if (!isValidSlug(normalized)) return setCheck({ state: 'bad', message: 'That name is reserved or invalid' });
    if (normalized === form.slug && !isDraftSlug) return setCheck({ state: 'ok', message: live ? 'This is the current link' : 'Reserved for this form' });
    setCheck({ state: 'checking' });
    const t = setTimeout(async () => {
      try {
        const r = await api.forms.checkSlug(normalized, form.id);
        setCheck(r.available ? { state: 'ok', message: 'Available' } : { state: 'bad', message: r.reason || 'Already taken' });
      } catch (e) {
        setCheck({ state: 'bad', message: errorMessage(e) });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [normalized, mode, form.id, form.slug, live, isDraftSlug]);

  const run = async (kind: 'publish' | 'unpublish' | 'close') => {
    setBusy(kind);
    try {
      if (!(await saveNow())) throw new Error('Save your changes first');
      const doc = kind === 'publish' ? await api.forms.publish(form.id, mode === 'custom' ? normalized : undefined) : kind === 'unpublish' ? await api.forms.unpublish(form.id) : await api.forms.close(form.id);
      syncServer(doc);
      if (kind === 'publish') setSlug(doc.slug);
      toast.success(kind === 'publish' ? (live ? 'Link updated' : 'Your letter is live ✉︎') : kind === 'unpublish' ? 'Back to draft' : 'Closed to new responses');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const embed = `<iframe src="${url}" title="${form.title.replace(/"/g, '&quot;')}" style="width:100%;height:720px;border:0;border-radius:16px" allow="autoplay; fullscreen; clipboard-write" loading="lazy"></iframe>`;
  const qr = useMemo(() => {
    try {
      return qrSvgPath(url);
    } catch {
      return null;
    }
  }, [url]);
  const copy = async (text: string, what: string) => ((await copyText(text)) ? toast.success(`${what} copied`) : toast.error('Could not copy'));
  const origin = typeof window !== 'undefined' ? window.location.host : '';

  return (
    <div className="fgl-scroll min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-(--line) bg-[linear-gradient(135deg,#fffaf3,#f7efe3)] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <StatusBadge status={form.status} />
                {form.publishedAt && live && <span className="text-xs text-(--ink-3)">since {fmtDateTime(form.publishedAt)}</span>}
              </div>
              <h3 className="font-display mt-1.5 text-2xl font-semibold">{live ? 'Your letter is out in the world' : form.status === 'closed' ? 'This letter is closed' : 'Ready to send?'}</h3>
              <p className="text-[13px] text-(--ink-2)">{live ? 'Anyone with the link can reply.' : form.status === 'closed' ? 'The link shows your closed message.' : 'Choose a link, then publish.'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button icon={Eye} onClick={async () => { await saveNow(); window.open(`/${form.slug}?preview=1`, '_blank', 'noopener'); }}>
                Preview
              </Button>
              {live && (
                <>
                  <Button icon={Undo2} onClick={() => run('unpublish')} loading={busy === 'unpublish'}>
                    Unpublish
                  </Button>
                  <Button icon={Lock} onClick={() => run('close')} loading={busy === 'close'}>
                    Close
                  </Button>
                </>
              )}
              {form.status === 'closed' && (
                <Button icon={Undo2} onClick={() => run('unpublish')} loading={busy === 'unpublish'}>
                  Move to draft
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-4 p-5">
            <div role="radiogroup" aria-label="Link type" className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  { v: 'custom', icon: Link2, title: 'Custom link', desc: 'A memorable name you choose' },
                  { v: 'random', icon: Shuffle, title: 'Random short link', desc: 'Shortest free code, e.g. /k3p' },
                ] as const
              ).map((o) => (
                <button
                  key={o.v}
                  type="button"
                  role="radio"
                  aria-checked={mode === o.v}
                  onClick={() => setMode(o.v)}
                  className={cn('flex items-start gap-3 rounded-xl border p-3 text-left transition-all', mode === o.v ? 'border-(--accent) bg-(--accent-soft)/40 ring-2 ring-(--accent)/15' : 'border-(--line) hover:border-(--line-2)')}
                >
                  <o.icon className={cn('mt-0.5 size-4', mode === o.v ? 'text-(--accent)' : 'text-(--ink-3)')} />
                  <span>
                    <span className="block text-sm font-medium">{o.title}</span>
                    <span className="block text-xs text-(--ink-2)">{o.desc}</span>
                  </span>
                </button>
              ))}
            </div>

            {mode === 'custom' && (
              <div>
                <label htmlFor="slug" className="text-[13px] font-medium">
                  Link
                </label>
                <div className="mt-1.5 flex items-stretch overflow-hidden rounded-lg border border-(--line) bg-white focus-within:border-(--accent) focus-within:ring-3 focus-within:ring-(--accent)/10">
                  <span className="hidden items-center bg-(--paper) px-3 font-mono text-xs text-(--ink-3) sm:flex">{origin}/</span>
                  <input
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                    onBlur={() => setSlug(normalized)}
                    className="h-10 min-w-0 flex-1 px-3 font-mono text-sm focus:outline-none"
                    aria-describedby="slug-status"
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <span id="slug-status" className="flex items-center px-3" aria-live="polite">
                    {check.state === 'checking' && <Loader2 className="size-4 animate-spin text-(--ink-3)" aria-label="Checking" />}
                    {check.state === 'ok' && <CheckCircle2 className="size-4 text-[#2f8a52]" aria-label={check.message} />}
                    {check.state === 'bad' && <XCircle className="size-4 text-(--accent)" aria-label={check.message} />}
                  </span>
                </div>
                <p className={cn('mt-1.5 text-xs', check.state === 'bad' ? 'text-(--accent)' : check.state === 'ok' ? 'text-[#2f7a4a]' : 'text-(--ink-3)')}>
                  {check.message ?? 'Lowercase letters, numbers, dashes.'}
                  {normalized && normalized !== slug && check.state !== 'bad' && <span className="text-(--ink-3)"> · will be saved as “{normalized}”</span>}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="lg"
                icon={Rocket}
                loading={busy === 'publish'}
                disabled={mode === 'custom' && (check.state === 'bad' || check.state === 'checking' || unchanged)}
                onClick={() => run('publish')}
              >
                {live ? 'Update link' : form.status === 'closed' ? 'Reopen & publish' : 'Publish'}
              </Button>
              {unchanged && mode === 'custom' && <span className="text-xs text-(--ink-3)">Change the name above to move the link.</span>}
            </div>
          </div>
        </Card>

        {live || form.status === 'closed' ? (
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_240px]">
            <Card className="space-y-4 p-5">
              <div>
                <p className="text-[13px] font-medium">Public link</p>
                <div className="mt-1.5 flex gap-2">
                  <Input readOnly value={url} className="font-mono text-[13px]" onFocus={(e) => e.target.select()} aria-label="Public link" />
                  <Button icon={Copy} onClick={() => copy(url, 'Link')}>
                    Copy
                  </Button>
                  <a href={`/${form.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-(--line) bg-white px-3 text-sm font-medium hover:border-(--line-2)">
                    <ExternalLink className="size-4" /> <span className="hidden sm:inline">Open</span>
                  </a>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-[13px] font-medium">
                    <Code2 className="size-4 text-(--ink-3)" /> Embed on your site
                  </p>
                  <Button size="sm" variant="ghost" icon={Copy} onClick={() => copy(embed, 'Embed code')}>
                    Copy
                  </Button>
                </div>
                <Textarea readOnly value={embed} rows={4} className="mt-1.5 font-mono text-xs" onFocus={(e) => e.target.select()} aria-label="Embed code" />
              </div>
            </Card>
            <Card className="flex flex-col items-center p-5">
              <p className="self-start text-[13px] font-medium">QR code</p>
              {qr ? (
                <>
                  <svg viewBox={`0 0 ${qr.size} ${qr.size}`} className="mt-3 w-full max-w-[180px] rounded-lg bg-white" shapeRendering="crispEdges" role="img" aria-label={`QR code for ${url}`}>
                    <rect width="100%" height="100%" fill="#fff" />
                    <path d={qr.path} fill="#2b2320" />
                  </svg>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Download}
                    className="mt-3"
                    onClick={() =>
                      downloadBlob(
                        new Blob([`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${qr.size} ${qr.size}" width="512" height="512" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${qr.path}" fill="#2b2320"/></svg>`], { type: 'image/svg+xml' }),
                        `${slugifyFilename(form.title)}-qr.svg`,
                      )
                    }
                  >
                    Download SVG
                  </Button>
                </>
              ) : (
                <p className="mt-3 text-xs text-(--ink-3)">Unavailable</p>
              )}
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}

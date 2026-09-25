'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, Copy, KeyRound, Plug, Plus, Send, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { WebhookDeliveryDoc, WebhookDoc, WebhookKind } from '@formgl/shared';
import { api, errorMessage } from '@/lib/admin/api';
import { useEditor } from '@/lib/admin/editor-store';
import { cn, copyText, fmtAgo } from '@/lib/admin/utils';
import { Button, Card, ConfirmDialog, EmptyState, IconButton, Input, Segmented, Spinner, Switch } from '../ui';

const KIND_LABEL: Record<WebhookKind, string> = { json: 'JSON', slack: 'Slack', discord: 'Discord' };
const KIND_HINT: Record<WebhookKind, string> = {
  json: 'A signed JSON payload for your own server, Zapier, Make or n8n.',
  slack: 'A formatted message in a Slack channel (incoming webhook URL).',
  discord: 'An embed in a Discord channel (channel webhook URL).',
};

/** Integrations: be told about every new reply, wherever you work. */
export function ConnectTab() {
  const form = useEditor((s) => s.form);
  const [hooks, setHooks] = useState<WebhookDoc[] | null>(null);
  const [url, setUrl] = useState('');
  const [kind, setKind] = useState<WebhookKind>('json');
  const [adding, setAdding] = useState(false);
  const [fresh, setFresh] = useState<WebhookDoc | null>(null);

  const load = useCallback(() => {
    if (!form) return;
    api.webhooks
      .list(form.id)
      .then(setHooks)
      .catch((e) => {
        toast.error(errorMessage(e));
        setHooks([]);
      });
  }, [form]);
  useEffect(load, [load]);

  if (!form) return null;

  const add = async () => {
    setAdding(true);
    try {
      const h = await api.webhooks.create(form.id, { url: url.trim(), kind });
      setFresh(h);
      setUrl('');
      setHooks((xs) => [...(xs ?? []), h]);
      toast.success('Webhook added');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fgl-scroll min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-(--paper-2) text-(--accent)">
              <Plug className="size-5" />
            </span>
            <div>
              <h3 className="font-display text-xl font-semibold">Webhooks</h3>
              <p className="mt-0.5 text-[13px] text-(--ink-2)">
                Every new reply is sent to these addresses the moment it arrives. Failed deliveries are retried twice (after 10s and 1min).
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-3 rounded-xl border border-dashed border-(--line-2) bg-(--paper) p-4">
            <Segmented label="Destination" value={kind} onChange={setKind} size="sm" options={(['json', 'slack', 'discord'] as WebhookKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
            <p className="text-[12.5px] text-(--ink-2)">{KIND_HINT[kind]}</p>
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                if (url.trim()) void add();
              }}
            >
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={kind === 'slack' ? 'https://hooks.slack.com/services/…' : kind === 'discord' ? 'https://discord.com/api/webhooks/…' : 'https://example.com/formgl-webhook'}
                aria-label="Webhook URL"
                className="h-10 font-mono text-[13px]"
              />
              <Button type="submit" variant="primary" icon={Plus} loading={adding} disabled={!url.trim()} className="h-10">
                Add
              </Button>
            </form>
          </div>

          {fresh && fresh.kind === 'json' && (
            <div className="mt-4 rounded-xl border border-[#e8d9a8] bg-[#fdf8e9] p-4">
              <p className="flex items-center gap-2 text-[13px] font-medium">
                <KeyRound className="size-4 text-[#9a7a1a]" /> Signing secret — copy it now, it won’t be shown again
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 font-mono text-[12.5px]">{fresh.secret}</code>
                <IconButton icon={Copy} label="Copy secret" onClick={async () => ((await copyText(fresh.secret)) ? toast.success('Secret copied') : toast.error('Could not copy'))} />
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-(--ink-2)">
                Each request carries <code className="font-mono">X-FormGL-Signature: t=&lt;unix&gt;,v1=&lt;hex&gt;</code> — an HMAC-SHA256 of <code className="font-mono">t + &quot;.&quot; + body</code> with this secret. Check it before
                trusting a payload.
              </p>
            </div>
          )}

          <div className="mt-5 space-y-3">
            {!hooks && (
              <div className="grid place-items-center py-8">
                <Spinner />
              </div>
            )}
            {hooks?.length === 0 && (
              <EmptyState icon={Send} title="No webhooks yet" className="py-6">
                Add one above to get replies in Slack, Discord or your own systems.
              </EmptyState>
            )}
            {hooks?.map((h) => (
              <HookRow
                key={h.id}
                hook={h}
                onChange={(next) => setHooks((xs) => (xs ?? []).map((x) => (x.id === h.id ? next : x)))}
                onRemoved={() => setHooks((xs) => (xs ?? []).filter((x) => x.id !== h.id))}
                onSecret={setFresh}
              />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatusDot({ d }: { d?: WebhookDeliveryDoc | null }) {
  if (!d) return <span className="text-[12px] text-(--ink-3)">No deliveries yet</span>;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[12px]', d.ok ? 'text-[#2f7a4a]' : 'text-(--accent)')}>
      {d.ok ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
      {d.ok ? `Delivered ${fmtAgo(d.createdAt)}` : `${d.error || 'Failed'} · ${fmtAgo(d.createdAt)}`}
    </span>
  );
}

function HookRow({ hook, onChange, onRemoved, onSecret }: { hook: WebhookDoc; onChange: (h: WebhookDoc) => void; onRemoved: () => void; onSecret: (h: WebhookDoc) => void }) {
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<WebhookDeliveryDoc[] | null>(null);
  const [testing, setTesting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);

  const loadLog = useCallback(() => {
    api.webhooks.deliveries(hook.id).then(setLog).catch(() => setLog([]));
  }, [hook.id]);
  useEffect(() => {
    if (open) loadLog();
  }, [open, loadLog]);

  const test = async () => {
    setTesting(true);
    try {
      const d = await api.webhooks.test(hook.id);
      onChange({ ...hook, lastDelivery: d });
      if (d.ok) toast.success(`Test delivered (HTTP ${d.status}, ${d.durationMs}ms)`);
      else toast.error(`Test failed: ${d.error}`);
      if (open) loadLog();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-xl border border-(--line) bg-white">
      <div className="flex flex-wrap items-center gap-3 p-3.5">
        <span className="rounded-md bg-(--paper-2) px-2 py-0.5 text-[11px] font-semibold tracking-wide text-(--ink-2) uppercase">{KIND_LABEL[hook.kind]}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[12.5px]" title={hook.url}>
            {hook.url}
          </p>
          <StatusDot d={hook.lastDelivery} />
        </div>
        <Switch
          checked={hook.active}
          label={hook.active ? 'Active' : 'Paused'}
          onChange={async (active) => {
            try {
              onChange({ ...(await api.webhooks.update(hook.id, { active })), lastDelivery: hook.lastDelivery });
            } catch (e) {
              toast.error(errorMessage(e));
            }
          }}
        />
        <Button size="sm" icon={Send} onClick={test} loading={testing}>
          Send test
        </Button>
        <IconButton icon={ChevronDown} label={open ? 'Hide deliveries' : 'Show deliveries'} onClick={() => setOpen((o) => !o)} className={cn('transition-transform', open && 'rotate-180')} />
      </div>
      {open && (
        <div className="border-t border-(--line) bg-(--paper) p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[12px] font-semibold tracking-wide text-(--ink-3) uppercase">Recent deliveries</p>
            <div className="flex gap-1">
              {hook.kind === 'json' && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={KeyRound}
                  onClick={async () => {
                    try {
                      onSecret(await api.webhooks.rotate(hook.id));
                      toast.success('New signing secret created');
                    } catch (e) {
                      toast.error(errorMessage(e));
                    }
                  }}
                >
                  Rotate secret
                </Button>
              )}
              <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setConfirm(true)}>
                Remove
              </Button>
            </div>
          </div>
          {!log && <Spinner />}
          {log?.length === 0 && <p className="text-[12.5px] text-(--ink-3)">Nothing sent yet. Use “Send test” to try it.</p>}
          <ul className="divide-y divide-(--line) text-[12.5px]">
            {log?.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-1.5">
                {d.ok ? <CheckCircle2 className="size-3.5 shrink-0 text-[#2f7a4a]" /> : <XCircle className="size-3.5 shrink-0 text-(--accent)" />}
                <span className="w-28 shrink-0 font-mono text-(--ink-2)">{d.event.replace('response.', '')}</span>
                <span className="w-14 shrink-0 tabular-nums">{d.status ?? '—'}</span>
                <span className="w-16 shrink-0 tabular-nums text-(--ink-3)">{d.durationMs != null ? `${d.durationMs}ms` : ''}</span>
                <span className="min-w-0 flex-1 truncate text-(--ink-3)" title={d.error || d.responseBody || ''}>
                  {d.error || d.responseBody || ''}
                  {d.attempt > 1 ? ` · retry ${d.attempt - 1}` : ''}
                </span>
                <span className="shrink-0 text-(--ink-3)">{fmtAgo(d.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        title="Remove this webhook?"
        message="Replies will no longer be sent to this address."
        confirmLabel="Remove"
        loading={removing}
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          setRemoving(true);
          try {
            await api.webhooks.remove(hook.id);
            onRemoved();
            toast.success('Webhook removed');
          } catch (e) {
            toast.error(errorMessage(e));
          } finally {
            setRemoving(false);
            setConfirm(false);
          }
        }}
      />
    </div>
  );
}

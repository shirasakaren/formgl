import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import {
  isInputField,
  type AnswerValue,
  type FormField,
  type WebhookDeliveryDoc,
  type WebhookDoc,
  type WebhookKind,
} from '@formgl/shared';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { AppConfig } from '../config/app-config';
import { DbService } from '../db/db.service';
import { forms, webhookDeliveries, webhooks, type DeliveryRow, type FormRow, type ResponseRow, type WebhookRow } from '../db/schema';
import { liveRow } from '../forms/serialize';

export const CreateWebhookBody = z.object({
  url: z.string().trim().url('Enter a full URL, starting with https://').max(2_000),
  kind: z.enum(['json', 'slack', 'discord']).default('json'),
});
export const PatchWebhookBody = z.object({
  url: z.string().trim().url().max(2_000).optional(),
  kind: z.enum(['json', 'slack', 'discord']).optional(),
  active: z.boolean().optional(),
});

const TIMEOUT_MS = 8_000;
const RETRY_DELAYS_MS = [10_000, 60_000];
const KEEP_DELIVERIES = 50;

/** is this address somewhere a webhook must never reach (loopback, private, link-local…)? */
function privateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::') return true;
    if (v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')) return true;
    const m = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return m ? privateAddress(m[1]) : false;
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

function formatValue(v: AnswerValue | undefined, field?: FormField): string {
  if (v === undefined || v === null || v === '') return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v))
    return v
      .map((x) => {
        if (x && typeof x === 'object' && 'name' in (x as object)) return String((x as { name: string }).name);
        const opt = field?.options?.find((o) => o.id === x || o.label === x);
        return opt?.label ?? String(x);
      })
      .join(', ');
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.name === 'string' && typeof o.url === 'string') return `${o.name} (${o.url})`;
    return Object.entries(o)
      .filter(([, x]) => x !== '' && x != null)
      .map(([k, x]) => `${k}: ${typeof x === 'object' ? JSON.stringify(x) : String(x)}`)
      .join(', ');
  }
  const opt = field?.options?.find((o) => o.id === v);
  return opt?.label ?? String(v);
}

const mask = (s: string) => `${s.slice(0, 10)}${'•'.repeat(8)}${s.slice(-4)}`;
const plain = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger('Webhooks');
  constructor(
    private readonly dbs: DbService,
    private readonly config: AppConfig,
  ) {}

  private get db() {
    return this.dbs.db;
  }

  private toDoc(row: WebhookRow, last?: DeliveryRow | null, reveal = false): WebhookDoc {
    return {
      id: row.id,
      url: row.url,
      kind: row.kind,
      active: row.active,
      secret: reveal ? row.secret : mask(row.secret),
      createdAt: row.createdAt.toISOString(),
      lastDelivery: last ? this.deliveryDoc(last) : null,
    };
  }

  private deliveryDoc(d: DeliveryRow): WebhookDeliveryDoc {
    return {
      id: d.id,
      event: d.event,
      attempt: d.attempt,
      status: d.status,
      ok: d.ok,
      durationMs: d.durationMs,
      error: d.error,
      responseBody: d.responseBody,
      createdAt: d.createdAt.toISOString(),
    };
  }

  private async getRow(id: string): Promise<WebhookRow> {
    const [row] = await this.db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);
    if (!row) throw new NotFoundException('Webhook not found');
    return row;
  }

  /** refuse URLs that would make the server call itself or the private network (SSRF) */
  private async assertSafeUrl(raw: string) {
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      throw new BadRequestException('That is not a valid URL');
    }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new BadRequestException('Webhooks must use http(s)');
    if (!this.config.isProd || process.env.ALLOW_PRIVATE_WEBHOOKS === '1') return;
    if (u.protocol !== 'https:') throw new BadRequestException('Webhooks must use https in production');
    const host = u.hostname.replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new BadRequestException('That address is not reachable from the internet');
    const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
    if (!addrs.length) throw new BadRequestException('That host could not be resolved');
    if (addrs.some((a) => privateAddress(a.address))) throw new BadRequestException('That address is not reachable from the internet');
  }

  async list(formId: string): Promise<WebhookDoc[]> {
    const rows = await this.db.select().from(webhooks).where(eq(webhooks.formId, formId)).orderBy(webhooks.createdAt);
    const out: WebhookDoc[] = [];
    for (const r of rows) {
      const [last] = await this.db.select().from(webhookDeliveries).where(eq(webhookDeliveries.webhookId, r.id)).orderBy(desc(webhookDeliveries.createdAt)).limit(1);
      out.push(this.toDoc(r, last));
    }
    return out;
  }

  async create(formId: string, body: z.infer<typeof CreateWebhookBody>): Promise<WebhookDoc> {
    const [form] = await this.db.select({ id: forms.id }).from(forms).where(eq(forms.id, formId)).limit(1);
    if (!form) throw new NotFoundException('Form not found');
    await this.assertSafeUrl(body.url);
    const kind = body.kind === 'json' ? guessKind(body.url) : body.kind;
    const [row] = await this.db
      .insert(webhooks)
      .values({ formId, url: body.url, kind, secret: `whsec_${randomBytes(24).toString('base64url')}` })
      .returning();
    return this.toDoc(row, null, true);
  }

  async update(id: string, patch: z.infer<typeof PatchWebhookBody>): Promise<WebhookDoc> {
    await this.getRow(id);
    if (patch.url) await this.assertSafeUrl(patch.url);
    const [row] = await this.db.update(webhooks).set(patch).where(eq(webhooks.id, id)).returning();
    return this.toDoc(row);
  }

  async remove(id: string) {
    await this.getRow(id);
    await this.db.delete(webhooks).where(eq(webhooks.id, id));
    return { ok: true };
  }

  async rotateSecret(id: string): Promise<WebhookDoc> {
    await this.getRow(id);
    const [row] = await this.db.update(webhooks).set({ secret: `whsec_${randomBytes(24).toString('base64url')}` }).where(eq(webhooks.id, id)).returning();
    return this.toDoc(row, null, true);
  }

  async deliveries(id: string): Promise<WebhookDeliveryDoc[]> {
    await this.getRow(id);
    const rows = await this.db.select().from(webhookDeliveries).where(eq(webhookDeliveries.webhookId, id)).orderBy(desc(webhookDeliveries.createdAt)).limit(30);
    return rows.map((d) => this.deliveryDoc(d));
  }

  /** send a sample reply so the admin can check the endpoint */
  async test(id: string): Promise<WebhookDeliveryDoc> {
    const hook = await this.getRow(id);
    const [raw] = await this.db.select().from(forms).where(eq(forms.id, hook.formId)).limit(1);
    const form = liveRow(raw);
    const inputs = (form.fields ?? []).filter((f) => isInputField(f.type) && f.type !== 'hidden');
    const answers: Record<string, AnswerValue> = {};
    for (const f of inputs.slice(0, 8)) {
      answers[f.id] = f.options?.length ? f.options[0].id : f.type === 'email' ? 'someone@example.com' : f.type === 'rating' ? 5 : 'Sample answer';
    }
    const fake = { id: randomUUID(), formId: form.id, answers, meta: { country: 'Wonderland', device: 'desktop', durationMs: 94_000 }, createdAt: new Date() } as unknown as ResponseRow;
    return this.deliver(hook, form, fake, 'response.test', 1);
  }

  /** fire-and-forget: tell every active hook of the form about a new reply */
  dispatch(form: FormRow, response: ResponseRow) {
    void (async () => {
      const hooks = await this.db.select().from(webhooks).where(and(eq(webhooks.formId, form.id), eq(webhooks.active, true)));
      for (const h of hooks) {
        const run = async (attempt: number) => {
          const d = await this.deliver(h, form, response, 'response.created', attempt);
          if (!d.ok && attempt <= RETRY_DELAYS_MS.length) setTimeout(() => void run(attempt + 1).catch(() => undefined), RETRY_DELAYS_MS[attempt - 1]).unref?.();
        };
        void run(1).catch((e) => this.logger.warn(`webhook ${h.id} failed: ${(e as Error).message}`));
      }
    })().catch((e) => this.logger.warn(`webhook dispatch failed: ${(e as Error).message}`));
  }

  private payload(hook: WebhookRow, form: FormRow, r: ResponseRow, event: string) {
    const fields = (form.fields ?? []).filter((f) => isInputField(f.type) && f.type !== 'hidden');
    const rows = fields
      .filter((f) => r.answers[f.id] !== undefined)
      .map((f) => ({ id: f.id, label: plain(f.label || f.type), type: f.type, value: r.answers[f.id], text: formatValue(r.answers[f.id], f) }));
    const origin = this.config.webOrigins[0] ?? '';
    const link = origin ? `${origin.replace(/\/$/, '')}/admin/forms/${form.id}/responses?r=${r.id}` : undefined;
    const title = plain(form.title || 'Untitled letter');
    if (hook.kind === 'slack') {
      return {
        text: `New reply to “${title}”`,
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: `:envelope_with_arrow: *New reply to ${title}*${event === 'response.test' ? ' _(test)_' : ''}` } },
          ...rows.slice(0, 20).map((x) => ({ type: 'section', text: { type: 'mrkdwn', text: `*${x.label}*\n${x.text || '—'}`.slice(0, 2_900) } })),
          ...(link ? [{ type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: 'Open in FormGL' }, url: link }] }] : []),
        ],
      };
    }
    if (hook.kind === 'discord') {
      return {
        content: `✉️ New reply to **${title}**${event === 'response.test' ? ' *(test)*' : ''}`,
        embeds: [
          {
            title: 'Reply',
            url: link,
            color: 0x8e1b1b,
            fields: rows.slice(0, 25).map((x) => ({ name: x.label.slice(0, 256), value: (x.text || '—').slice(0, 1_024) })),
            timestamp: r.createdAt.toISOString(),
          },
        ],
      };
    }
    return {
      event,
      createdAt: new Date().toISOString(),
      form: { id: form.id, slug: form.slug, title, version: form.liveVersion ?? null },
      response: {
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        answers: r.answers,
        fields: rows,
        meta: {
          country: r.meta?.country,
          city: r.meta?.city,
          device: r.meta?.device,
          browser: r.meta?.browser,
          durationMs: r.meta?.durationMs,
          referrer: r.meta?.referrer,
          utm: r.meta?.utm,
        },
        url: link,
      },
    };
  }

  private async deliver(hook: WebhookRow, form: FormRow, r: ResponseRow, event: string, attempt: number): Promise<WebhookDeliveryDoc> {
    const body = JSON.stringify(this.payload(hook, form, r, event));
    const ts = Math.floor(Date.now() / 1000);
    const sig = createHmac('sha256', hook.secret).update(`${ts}.${body}`).digest('hex');
    const started = Date.now();
    let status: number | null = null;
    let ok = false;
    let error: string | null = null;
    let responseBody: string | null = null;
    try {
      await this.assertSafeUrl(hook.url);
      const res = await fetch(hook.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'FormGL-Webhooks/1.0',
          'x-formgl-event': event,
          'x-formgl-delivery': randomUUID(),
          'x-formgl-signature': `t=${ts},v1=${sig}`,
        },
        body,
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      status = res.status;
      ok = res.ok;
      responseBody = (await res.text().catch(() => '')).slice(0, 500) || null;
      if (!ok) error = `HTTP ${res.status}`;
    } catch (e) {
      const err = e as Error;
      error = err.name === 'TimeoutError' ? `Timed out after ${TIMEOUT_MS / 1000}s` : (err.message || 'Request failed').slice(0, 300);
    }
    const [row] = await this.db
      .insert(webhookDeliveries)
      .values({ webhookId: hook.id, event, attempt, status, ok, durationMs: Date.now() - started, error, responseBody })
      .returning();
    // keep the log short
    const [cut] = await this.db
      .select({ id: webhookDeliveries.id })
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, hook.id))
      .orderBy(desc(webhookDeliveries.id))
      .offset(KEEP_DELIVERIES)
      .limit(1);
    if (cut) await this.db.delete(webhookDeliveries).where(and(eq(webhookDeliveries.webhookId, hook.id), lt(webhookDeliveries.id, cut.id + 1)));
    void sql;
    return this.deliveryDoc(row);
  }
}

function guessKind(url: string): WebhookKind {
  if (/hooks\.slack\.com/.test(url)) return 'slack';
  if (/discord(app)?\.com\/api\/webhooks/.test(url)) return 'discord';
  return 'json';
}

import {
  FIELD_META,
  formatAnswer,
  isInputField,
  type AnswerValue,
  type Answers,
  type FormField,
  type FormResponse,
  type Paginated,
} from '@formgl/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq, gte, inArray, lt, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { toCsv } from '../common/csv';
import { DbService } from '../db/db.service';
import { events, responses } from '../db/schema';
import { FormsService } from '../forms/forms.service';
import { toFormResponse } from '../forms/serialize';

export const ListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
  q: z.string().max(200).optional(),
  from: z.string().max(40).optional(),
  to: z.string().max(40).optional(),
  starred: z.enum(['true', 'false', '1', '0']).optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
});

export const PatchResponseBody = z.object({
  starred: z.boolean().optional(),
  tags: z.array(z.string().max(60)).max(50).optional(),
  note: z.string().max(20_000).nullable().optional(),
  answers: z.record(z.unknown()).optional(),
});

export const BulkDeleteBody = z.object({ ids: z.array(z.string().uuid()).max(5_000) });

/** Parses an ISO date/time; a date-only `to` bound is inclusive of that whole day. */
export function parseBound(v: string | undefined, name: string, endOfDay = false): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new BadRequestException(`Invalid "${name}" date`);
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(v)) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

const META_HEADERS = ['Country', 'City', 'Device', 'Browser', 'OS', 'IP', 'Referrer', 'Duration (s)'] as const;

@Injectable()
export class ResponsesService {
  constructor(
    private readonly dbs: DbService,
    private readonly forms: FormsService,
  ) {}

  private get db() {
    return this.dbs.db;
  }

  async list(formId: string, q: z.infer<typeof ListQuery>): Promise<Paginated<FormResponse>> {
    await this.forms.getRow(formId);
    const where: SQL[] = [eq(responses.formId, formId)];
    if (q.q?.trim()) {
      const like = `%${q.q.trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
      where.push(sql`(${responses.answers}::text ILIKE ${like} OR coalesce(${responses.note}, '') ILIKE ${like})`);
    }
    const from = parseBound(q.from, 'from');
    const to = parseBound(q.to, 'to', true);
    if (from) where.push(gte(responses.createdAt, from));
    if (to) where.push(lt(responses.createdAt, to));
    if (q.starred === 'true' || q.starred === '1') where.push(eq(responses.starred, true));
    if (q.starred === 'false' || q.starred === '0') where.push(eq(responses.starred, false));
    const cond = and(...where);
    const [{ total }] = await this.db.select({ total: count() }).from(responses).where(cond);
    const rows = await this.db
      .select()
      .from(responses)
      .where(cond)
      .orderBy(q.sort === 'oldest' ? asc(responses.createdAt) : desc(responses.createdAt), asc(responses.id))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize);
    return { items: rows.map(toFormResponse), total: Number(total), page: q.page, pageSize: q.pageSize };
  }

  async all(formId: string): Promise<FormResponse[]> {
    await this.forms.getRow(formId);
    const rows = await this.db
      .select()
      .from(responses)
      .where(eq(responses.formId, formId))
      .orderBy(desc(responses.createdAt))
      .limit(100_000);
    return rows.map(toFormResponse);
  }

  /** what this respondent did before replying: the tracked events of their session */
  async journey(rid: string): Promise<Array<{ type: string; page: number | null; at: string }>> {
    const [r] = await this.db.select().from(responses).where(eq(responses.id, rid)).limit(1);
    if (!r) throw new NotFoundException('Response not found');
    if (!r.sessionId) return [];
    const rows = await this.db
      .select({ type: events.type, page: events.page, at: events.createdAt })
      .from(events)
      .where(and(eq(events.formId, r.formId), eq(events.sessionId, r.sessionId)))
      .orderBy(events.createdAt)
      .limit(200);
    return rows.map((e) => ({ type: e.type, page: e.page, at: e.at.toISOString() }));
  }

  async update(rid: string, patch: z.infer<typeof PatchResponseBody>): Promise<FormResponse> {
    const [current] = await this.db.select().from(responses).where(eq(responses.id, rid)).limit(1);
    if (!current) throw new NotFoundException('Response not found');
    const set: Partial<typeof responses.$inferInsert> = {};
    if (patch.starred !== undefined) set.starred = patch.starred;
    if (patch.tags !== undefined) set.tags = [...new Set(patch.tags.map((t) => t.trim()).filter(Boolean))];
    if (patch.note !== undefined) set.note = patch.note?.trim() ? patch.note : null;
    if (patch.answers !== undefined) {
      if (Buffer.byteLength(JSON.stringify(patch.answers)) > 2_000_000) throw new BadRequestException('Answers too large');
      set.answers = { ...current.answers, ...(patch.answers as Answers) };
    }
    if (!Object.keys(set).length) return toFormResponse(current);
    const [row] = await this.db.update(responses).set(set).where(eq(responses.id, rid)).returning();
    return toFormResponse(row);
  }

  async remove(rid: string): Promise<{ ok: true }> {
    const r = await this.db.delete(responses).where(eq(responses.id, rid)).returning({ id: responses.id });
    if (!r.length) throw new NotFoundException('Response not found');
    return { ok: true };
  }

  async bulkDelete(formId: string, ids: string[]): Promise<{ deleted: number }> {
    await this.forms.getRow(formId);
    if (!ids.length) return { deleted: 0 };
    const r = await this.db
      .delete(responses)
      .where(and(eq(responses.formId, formId), inArray(responses.id, ids)))
      .returning({ id: responses.id });
    return { deleted: r.length };
  }

  async export(formId: string, format: 'csv' | 'json'): Promise<{ filename: string; contentType: string; body: string }> {
    const form = await this.forms.getRow(formId);
    const rows = await this.db
      .select()
      .from(responses)
      .where(eq(responses.formId, formId))
      .orderBy(desc(responses.createdAt));
    const inputs = (form.fields ?? []).filter((f) => isInputField(f.type));
    const labels = dedupeLabels(inputs);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `${form.slug}-responses-${date}.${format}`;
    const header = ['Submitted at', 'Response ID', ...labels, ...META_HEADERS];

    const metaValues = (m: FormResponse['meta']) => [
      m.country ?? m.countryCode ?? '',
      m.city ?? '',
      m.device ?? '',
      m.browser ?? '',
      m.os ?? '',
      m.ip ?? '',
      m.referrer ?? '',
      m.durationMs != null ? Math.round(m.durationMs / 100) / 10 : '',
    ];

    if (format === 'json') {
      const out = rows.map((r) => {
        const o: Record<string, unknown> = { 'Submitted at': r.createdAt.toISOString(), 'Response ID': r.id };
        inputs.forEach((f, i) => (o[labels[i]] = (r.answers?.[f.id] as AnswerValue | undefined) ?? null));
        const mv = metaValues(r.meta ?? {});
        META_HEADERS.forEach((h, i) => (o[h] = mv[i] === '' ? null : mv[i]));
        return o;
      });
      return { filename, contentType: 'application/json; charset=utf-8', body: JSON.stringify(out, null, 2) };
    }

    const table: unknown[][] = [header];
    for (const r of rows) {
      table.push([
        r.createdAt.toISOString(),
        r.id,
        ...inputs.map((f) => formatAnswer(f, r.answers?.[f.id] as AnswerValue | undefined)),
        ...metaValues(r.meta ?? {}),
      ]);
    }
    return { filename, contentType: 'text/csv; charset=utf-8', body: toCsv(table) };
  }
}

export function dedupeLabels(fields: FormField[]): string[] {
  const seen = new Map<string, number>();
  const reserved = new Set(['Submitted at', 'Response ID', ...META_HEADERS]);
  return fields.map((f) => {
    const base = (f.label || '').trim() || FIELD_META[f.type]?.label || f.type;
    let label = base;
    let n = seen.get(base.toLowerCase()) ?? 0;
    if (reserved.has(label)) n = Math.max(n, 1);
    if (n > 0) label = `${base} (${n + 1})`;
    seen.set(base.toLowerCase(), n + 1);
    return label;
  });
}


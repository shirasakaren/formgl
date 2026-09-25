import {
  isFieldVisible,
  isInputField,
  validateAnswers,
  withSettingsDefaults,
  type AnswerValue,
  type Answers,
  type FileRef,
  type FormField,
  type PublicForm,
  type ResponseMeta,
} from '@formgl/shared';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { and, count, eq, inArray } from 'drizzle-orm';
import type { Request } from 'express';
import { z } from 'zod';
import { AuthService } from '../auth/auth.service';
import { clientInfo, type ClientInfo } from '../common/client-info';
import { clampStr, safeName } from '../common/text';
import { UUID_RE } from '../common/validation';
import { AppConfig } from '../config/app-config';
import { DbService } from '../db/db.service';
import { events, files, forms, responses, type FormRow } from '../db/schema';
import { FilesService, toFileRef } from '../files/files.service';
import { matchesAccept, resolveMime } from '../files/upload';
import { publicCacheKey } from '../forms/forms.service';
import { computeAvailability, liveRow, toPublicForm, type Availability } from '../forms/serialize';
import { RedisService } from '../redis/redis.service';
import { WebhooksService } from '../webhooks/webhooks.service';

const CACHE_TTL_SEC = 30;
const MAX_DURATION_MS = 7 * 24 * 3600 * 1000;
const UPLOAD_TYPES = new Set(['file_upload', 'image_upload', 'signature']);

const utmSchema = z
  .record(z.string().max(300))
  .refine((o) => Object.keys(o).length <= 20, 'Too many utm keys')
  .optional()
  .catch(undefined);
const sessionIdSchema = z.string().trim().min(1).max(128);

export const TrackEventBody = z.object({
  type: z.enum(['view', 'loaded', 'open', 'start', 'page', 'submit', 'abandon']),
  sessionId: sessionIdSchema,
  page: z.coerce.number().int().min(0).max(10_000).optional().catch(undefined),
  referrer: z.string().max(2_000).optional().catch(undefined),
  screen: z.string().max(40).optional().catch(undefined),
  locale: z.string().max(40).optional().catch(undefined),
  timezone: z.string().max(80).optional().catch(undefined),
  utm: utmSchema,
});

export const SubmitBody = z.object({
  answers: z.record(z.unknown()),
  sessionId: sessionIdSchema,
  startedAt: z.number().finite().optional().catch(undefined),
  referrer: z.string().max(2_000).optional().catch(undefined),
  screen: z.string().max(40).optional().catch(undefined),
  locale: z.string().max(40).optional().catch(undefined),
  timezone: z.string().max(80).optional().catch(undefined),
  utm: utmSchema,
});

export const UploadBody = z.object({
  fieldId: z.string().trim().min(1, 'fieldId is required').max(100),
  sessionId: sessionIdSchema,
});

@Injectable()
export class PublicService {
  private readonly logger = new Logger('Public');
  constructor(
    private readonly dbs: DbService,
    private readonly redis: RedisService,
    private readonly auth: AuthService,
    private readonly config: AppConfig,
    private readonly filesSvc: FilesService,
    private readonly webhooks: WebhooksService,
  ) {}

  private get db() {
    return this.dbs.db;
  }

  private async findBySlug(slug: string): Promise<FormRow | undefined> {
    const s = slug.trim().toLowerCase();
    if (!s || s.length > 100) return undefined;
    const [row] = await this.db.select().from(forms).where(eq(forms.slug, s)).limit(1);
    // respondents always get the published snapshot, never the work-in-progress draft
    return row ? liveRow(row) : undefined;
  }

  private async responseCount(formId: string): Promise<number> {
    const [r] = await this.db.select({ n: count() }).from(responses).where(eq(responses.formId, formId));
    return Number(r?.n ?? 0);
  }

  async availability(row: FormRow, asPublished = false): Promise<Availability> {
    const settings = withSettingsDefaults(row.settings);
    const needsCount = settings.responseLimit != null && settings.responseLimit > 0;
    const n = needsCount ? await this.responseCount(row.id) : 0;
    return computeAvailability(asPublished && row.status === 'draft' ? 'published' : row.status, settings, n);
  }

  /* ───────────── GET form ───────────── */

  async getForm(slug: string, preview: boolean, req: Request): Promise<{ form: PublicForm; cacheable: boolean }> {
    if (preview && (await this.auth.isAuthenticated(req))) {
      // previews show the draft being edited
      const s = slug.trim().toLowerCase();
      const row = (await this.db.select().from(forms).where(UUID_RE.test(slug) ? eq(forms.id, slug) : eq(forms.slug, s)).limit(1))[0];
      if (!row) throw new NotFoundException('Form not found');
      return { form: toPublicForm(row, await this.availability(row, true)), cacheable: false };
    }
    const key = publicCacheKey(slug.trim().toLowerCase());
    const cached = await this.redis.getJson<PublicForm>(key);
    if (cached) return { form: cached, cacheable: true };
    const row = await this.findBySlug(slug);
    if (!row || row.status === 'draft') throw new NotFoundException('Form not found');
    const form = toPublicForm(row, await this.availability(row));
    await this.redis.setJson(key, form, CACHE_TTL_SEC);
    return { form, cacheable: true };
  }

  /* ───────────── events ───────────── */

  async track(slug: string, body: z.infer<typeof TrackEventBody>, req: Request): Promise<void> {
    const row = await this.findBySlug(slug);
    if (!row) throw new NotFoundException('Form not found');
    // drafts (admin previews) are not tracked; 'submit' is recorded server side on submission
    if (row.status === 'draft' || body.type === 'submit') return;
    const settings = withSettingsDefaults(row.settings);
    const info = clientInfo(req, { trustProxy: this.config.trustProxy, collectGeo: settings.collectGeo !== false });
    await this.insertEvent(row.id, body.type, body.sessionId, info, { page: body.page, referrer: body.referrer });
  }

  private async insertEvent(
    formId: string,
    type: string,
    sessionId: string,
    info: ClientInfo,
    extra: { page?: number; referrer?: string },
  ) {
    await this.db.insert(events).values({
      formId,
      type,
      sessionId,
      page: extra.page ?? null,
      ip: info.ip ?? null,
      country: info.country ?? null,
      countryCode: info.countryCode ?? null,
      region: info.region ?? null,
      city: info.city ?? null,
      lat: info.lat ?? null,
      lon: info.lon ?? null,
      device: info.device ?? null,
      browser: info.browser ?? null,
      os: info.os ?? null,
      referrer: clampStr(extra.referrer, 2_000) ?? null,
    });
  }

  /* ───────────── submit ───────────── */

  async submit(slug: string, body: z.infer<typeof SubmitBody>, req: Request): Promise<{ ok: true; id: string }> {
    const row = await this.findBySlug(slug);
    if (!row || row.status === 'draft') throw new NotFoundException('Form not found');
    const settings = withSettingsDefaults(row.settings);
    const availability = await this.availability(row);
    if (availability !== 'open') throw new ForbiddenException(closedMessage(availability, settings.closedMessage));

    if (settings.onePerDevice) {
      const [dupe] = await this.db
        .select({ id: responses.id })
        .from(responses)
        .where(and(eq(responses.formId, row.id), eq(responses.sessionId, body.sessionId)))
        .limit(1);
      if (dupe) throw new ConflictException('You have already replied to this form');
    }

    const answers = await this.cleanAnswers(row, body.answers as Answers);
    const errors = validateAnswers(row.fields ?? [], answers);
    if (Object.keys(errors).length) {
      throw new UnprocessableEntityException({ message: 'Some answers need another look', details: errors });
    }

    const info = clientInfo(req, { trustProxy: this.config.trustProxy, collectGeo: settings.collectGeo !== false });
    const now = Date.now();
    const meta: ResponseMeta = {
      ip: info.ip,
      country: info.country,
      countryCode: info.countryCode,
      region: info.region,
      city: info.city,
      lat: info.lat,
      lon: info.lon,
      timezone: clampStr(body.timezone, 80) ?? info.timezone,
      userAgent: info.userAgent,
      browser: info.browser,
      os: info.os,
      device: info.device,
      referrer: clampStr(body.referrer, 2_000),
      utm: body.utm && Object.keys(body.utm).length ? body.utm : undefined,
      locale: clampStr(body.locale, 40),
      screen: clampStr(body.screen, 40),
      durationMs: durationFrom(body.startedAt, now),
      formVersion: row.liveVersion || undefined,
      sessionId: body.sessionId,
    };
    for (const k of Object.keys(meta) as (keyof ResponseMeta)[]) if (meta[k] === undefined) delete meta[k];

    const [saved] = await this.db
      .insert(responses)
      .values({
        formId: row.id,
        answers,
        meta,
        sessionId: body.sessionId,
        ip: info.ip ?? null,
        countryCode: info.countryCode ?? null,
      })
      .returning();
    this.webhooks.dispatch(row, saved);

    await this.insertEvent(row.id, 'submit', body.sessionId, info, { referrer: body.referrer }).catch((e) =>
      this.logger.warn(`could not record submit event: ${(e as Error).message}`),
    );
    if (settings.responseLimit) await this.redis.del(publicCacheKey(row.slug));
    return { ok: true, id: saved.id };
  }

  /** Keeps only answers for known input fields that are visible; re-derives file references from our own records. */
  private async cleanAnswers(row: FormRow, input: Answers): Promise<Answers> {
    const fields = (row.fields ?? []).filter((f) => isInputField(f.type));
    const out: Answers = {};
    const fileKeys: string[] = [];
    for (const f of fields) {
      if (!Object.prototype.hasOwnProperty.call(input, f.id)) continue;
      const v = input[f.id];
      if (f.type === 'hidden') {
        out[f.id] = v == null ? null : String(typeof v === 'object' ? JSON.stringify(v) : v).slice(0, 2_000);
      } else if (UPLOAD_TYPES.has(f.type) && Array.isArray(v)) {
        const refs = (v as unknown[]).filter(
          (x): x is FileRef =>
            !!x && typeof x === 'object' && typeof (x as FileRef).key === 'string' &&
            (x as FileRef).key.startsWith(`forms/${row.id}/${safeName(f.id)}/`),
        );
        fileKeys.push(...refs.map((r) => r.key));
        out[f.id] = refs;
      } else if (f.type === 'signature' && typeof v === 'string') {
        // inline data-url signatures are accepted as-is (capped)
        out[f.id] = /^data:image\/(png|svg\+xml|jpeg);base64,/.test(v) && v.length <= 2_000_000 ? v : null;
      } else {
        out[f.id] = capValue(v);
      }
    }
    if (fileKeys.length) {
      const known = await this.db
        .select()
        .from(files)
        .where(and(eq(files.formId, row.id), inArray(files.key, fileKeys.slice(0, 200))));
      const byKey = new Map(known.map((k) => [k.key, toFileRef(k)]));
      for (const f of fields) {
        const v = out[f.id];
        if (UPLOAD_TYPES.has(f.type) && Array.isArray(v)) {
          out[f.id] = (v as FileRef[]).map((r) => byKey.get(r.key)).filter((r): r is FileRef => !!r);
        }
      }
    }
    // drop answers of questions hidden by conditional logic
    const hidden = fields.filter((f) => f.type !== 'hidden' && !isFieldVisible(f, out)).map((f) => f.id);
    for (const id of hidden) delete out[id];
    return out;
  }

  /* ───────────── uploads ───────────── */

  async upload(slug: string, file: Express.Multer.File | undefined, body: z.infer<typeof UploadBody>): Promise<FileRef> {
    const row = await this.findBySlug(slug);
    if (!row || row.status === 'draft') throw new NotFoundException('Form not found');
    const settings = withSettingsDefaults(row.settings);
    const availability = await this.availability(row);
    if (availability !== 'open') throw new ForbiddenException(closedMessage(availability, settings.closedMessage));
    const field: FormField | undefined = (row.fields ?? []).find((f) => f.id === body.fieldId);
    if (!field || !UPLOAD_TYPES.has(field.type)) throw new BadRequestException('This question does not accept files');
    if (!file) throw new BadRequestException('No file uploaded (multipart field "file")');

    const name = file.originalname || 'file';
    const mime = resolveMime(file.mimetype, name);
    const accept =
      field.type === 'signature'
        ? ['image/png']
        : field.validation?.accept?.length
          ? field.validation.accept
          : field.type === 'image_upload'
            ? ['image/*']
            : [];
    if (!matchesAccept(mime, name, accept)) {
      throw new UnsupportedMediaTypeException(`That file type is not accepted here (${accept.join(', ')})`);
    }
    const globalMb = this.config.env.MAX_UPLOAD_MB;
    const maxMb = Math.min(field.validation?.maxSizeMb && field.validation.maxSizeMb > 0 ? field.validation.maxSizeMb : globalMb, globalMb);
    if (file.size > maxMb * 1024 * 1024) throw new PayloadTooLargeException(`File is too large (max ${maxMb} MB)`);
    if (file.size === 0) throw new BadRequestException('The file is empty');

    return this.filesSvc.store(file, `forms/${row.id}/${safeName(field.id)}`, {
      formId: row.id,
      fieldId: field.id,
      sessionId: body.sessionId,
      mime,
    });
  }
}

/** ms since `startedAt`, clamped at 0; dropped when the client clock is clearly bogus. */
function durationFrom(startedAt: number | undefined, now: number): number | undefined {
  if (startedAt == null || !(startedAt > 0)) return undefined;
  const d = now - startedAt;
  if (d < -60_000 || d > MAX_DURATION_MS) return undefined;
  return Math.round(Math.max(0, d));
}

function closedMessage(a: Availability, custom?: string): string {
  if (a === 'not_yet') return 'This form is not open yet.';
  if (a === 'limit') return custom || 'This form has reached its response limit.';
  return custom || 'This form is no longer accepting responses.';
}

/** caps oversized strings / arrays in free-form answers */
function capValue(v: unknown, depth = 0): AnswerValue {
  if (v == null) return null;
  if (typeof v === 'string') return v.slice(0, 100_000);
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v;
  if (depth > 3) return null;
  if (Array.isArray(v)) return v.slice(0, 500).map((x) => capValue(x, depth + 1)) as AnswerValue;
  if (typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>).slice(0, 500)) o[k.slice(0, 300)] = capValue(x, depth + 1);
    return o as AnswerValue;
  }
  return null;
}

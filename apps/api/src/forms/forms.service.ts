import {
  CONTENT_BLOCK_TYPES,
  INPUT_FIELD_TYPES,
  isValidSlug,
  normalizeSlug,
  randomSlug,
  RESERVED_SLUGS,
  TEMPLATES,
  templateToForm,
  withSettingsDefaults,
  withThemeDefaults,
  type FormDoc,
  type FormField,
  type FormSettings,
  type FormSummary,
  type FormTheme,
} from '@formgl/shared';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { and, count, desc, eq, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { UUID_RE } from '../common/validation';
import { DbService } from '../db/db.service';
import { events, files, forms, responses, type FormRow } from '../db/schema';
import { REDIS_PREFIX, RedisService } from '../redis/redis.service';
import { StorageService } from '../storage/storage.service';
import { toFormDoc } from './serialize';

export const publicCacheKey = (slug: string) => `${REDIS_PREFIX}pf:${slug}`;

const FIELD_TYPES = [...INPUT_FIELD_TYPES, ...CONTENT_BLOCK_TYPES] as unknown as [string, ...string[]];

export const FieldSchema = z
  .object({
    id: z.string().min(1).max(100),
    type: z.enum(FIELD_TYPES, { errorMap: () => ({ message: 'Unknown field type' }) }),
    label: z.string().max(5_000).default(''),
  })
  .passthrough();

export const CreateFormBody = z.object({
  templateId: z.string().max(100).optional(),
  title: z.string().max(300).optional(),
});

export const PatchFormBody = z.object({
  title: z.string().max(300).optional(),
  description: z.string().max(10_000).nullable().optional(),
  fields: z.array(FieldSchema).max(500).optional(),
  theme: z.record(z.unknown()).nullable().optional(),
  settings: z.record(z.unknown()).nullable().optional(),
});

export const PublishBody = z.object({ slug: z.string().max(200).nullable().optional() });

const LIMITS = { fields: 2_000_000, theme: 64_000, settings: 256_000 };
const byteLen = (v: unknown) => Buffer.byteLength(JSON.stringify(v ?? null), 'utf8');

function isUniqueViolation(e: unknown) {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === '23505' || err?.cause?.code === '23505';
}

@Injectable()
export class FormsService {
  private readonly logger = new Logger('Forms');
  constructor(
    private readonly dbs: DbService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
  ) {}

  private get db() {
    return this.dbs.db;
  }

  /* ───────────── reads ───────────── */

  async getRow(id: string): Promise<FormRow> {
    const [row] = await this.db.select().from(forms).where(eq(forms.id, id)).limit(1);
    if (!row) throw new NotFoundException('Form not found');
    return row;
  }

  async findBySlug(slug: string): Promise<FormRow | undefined> {
    const [row] = await this.db.select().from(forms).where(eq(forms.slug, slug)).limit(1);
    return row;
  }

  async get(id: string): Promise<FormDoc> {
    return toFormDoc(await this.getRow(id));
  }

  async list(): Promise<FormSummary[]> {
    const rc = this.db
      .select({ formId: responses.formId, n: count().as('rc_n') })
      .from(responses)
      .groupBy(responses.formId)
      .as('rc');
    const vc = this.db
      .select({ formId: events.formId, n: count().as('vc_n') })
      .from(events)
      .where(eq(events.type, 'view'))
      .groupBy(events.formId)
      .as('vc');
    const rows = await this.db
      .select({
        id: forms.id,
        slug: forms.slug,
        title: forms.title,
        status: forms.status,
        theme: forms.theme,
        createdAt: forms.createdAt,
        updatedAt: forms.updatedAt,
        publishedAt: forms.publishedAt,
        responseCount: sql<number>`coalesce(${rc.n}, 0)::int`,
        viewCount: sql<number>`coalesce(${vc.n}, 0)::int`,
      })
      .from(forms)
      .leftJoin(rc, eq(rc.formId, forms.id))
      .leftJoin(vc, eq(vc.formId, forms.id))
      .orderBy(desc(forms.updatedAt));
    return rows.map((r) => {
      const t = withThemeDefaults(r.theme);
      return {
        id: r.id,
        slug: r.slug,
        title: r.title,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        publishedAt: r.publishedAt?.toISOString() ?? null,
        responseCount: Number(r.responseCount),
        viewCount: Number(r.viewCount),
        theme: {
          envelopeColor: t.envelopeColor,
          sealColor: t.sealColor,
          loaderColor: t.loaderColor,
          paperColor: t.paperColor,
          logoUrl: t.logoUrl,
        },
      };
    });
  }

  /* ───────────── writes ───────────── */

  async create(body: z.infer<typeof CreateFormBody>): Promise<FormDoc> {
    const tpl = TEMPLATES.find((t) => t.id === (body.templateId || 'blank'));
    if (!tpl) throw new BadRequestException(`Unknown template "${body.templateId}"`);
    const base = templateToForm(tpl);
    const title = body.title?.trim() || base.title;
    return toFormDoc(
      await this.insertDraft({ title, fields: base.fields, theme: base.theme, settings: base.settings }),
    );
  }

  private async insertDraft(v: {
    title: string;
    description?: string | null;
    fields: FormField[];
    theme: Partial<FormTheme>;
    settings: Partial<FormSettings>;
  }): Promise<FormRow> {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const [row] = await this.db
          .insert(forms)
          .values({ ...v, slug: `draft-${randomSlug(8)}`, status: 'draft' })
          .returning();
        return row;
      } catch (e) {
        if (!isUniqueViolation(e)) throw e;
      }
    }
    throw new ConflictException('Could not allocate a draft slug, please retry');
  }

  async update(id: string, patch: z.infer<typeof PatchFormBody>): Promise<FormDoc> {
    const current = await this.getRow(id);
    const set: Partial<typeof forms.$inferInsert> = { updatedAt: new Date() };
    if (patch.title !== undefined) set.title = patch.title;
    if (patch.description !== undefined) set.description = patch.description || null;
    if (patch.fields !== undefined) {
      if (byteLen(patch.fields) > LIMITS.fields) throw new PayloadTooLargeException('Too much content in fields');
      const ids = new Set<string>();
      for (const f of patch.fields) {
        if (ids.has(f.id)) throw new BadRequestException(`Duplicate field id "${f.id}"`);
        ids.add(f.id);
      }
      set.fields = patch.fields as unknown as FormField[];
    }
    if (patch.theme !== undefined) {
      if (byteLen(patch.theme) > LIMITS.theme) throw new PayloadTooLargeException('Theme is too large');
      set.theme = withThemeDefaults((patch.theme ?? {}) as Partial<FormTheme>);
    }
    if (patch.settings !== undefined) {
      if (byteLen(patch.settings) > LIMITS.settings) throw new PayloadTooLargeException('Settings are too large');
      set.settings = sanitizeSettings(withSettingsDefaults((patch.settings ?? {}) as Partial<FormSettings>));
    }
    const [row] = await this.db.update(forms).set(set).where(eq(forms.id, id)).returning();
    await this.bust(current.slug, row.slug);
    return toFormDoc(row);
  }

  async publish(id: string, slugInput?: string | null): Promise<FormDoc> {
    const current = await this.getRow(id);
    const wanted = slugInput?.trim();
    let row: FormRow | undefined;
    if (wanted) {
      const slug = normalizeSlug(wanted);
      const problem = slugProblem(slug);
      if (problem) throw new BadRequestException(problem);
      if (await this.slugTaken(slug, id)) throw new ConflictException('That link is already taken');
      try {
        row = await this.setPublished(id, slug, current);
      } catch (e) {
        if (isUniqueViolation(e)) throw new ConflictException('That link is already taken');
        throw e;
      }
    } else if (!current.slug.startsWith('draft-')) {
      // previously published: keep the link people already have
      row = await this.setPublished(id, current.slug, current);
    } else {
      for (let attempt = 0; attempt < 5 && !row; attempt++) {
        const slug = await this.freeRandomSlug();
        try {
          row = await this.setPublished(id, slug, current);
        } catch (e) {
          if (!isUniqueViolation(e)) throw e;
        }
      }
      if (!row) throw new ConflictException('Could not allocate a link, please retry');
    }
    await this.bust(current.slug, row.slug);
    return toFormDoc(row);
  }

  private async setPublished(id: string, slug: string, current: FormRow): Promise<FormRow> {
    const now = new Date();
    const [row] = await this.db
      .update(forms)
      .set({ slug, status: 'published', publishedAt: current.publishedAt ?? now, updatedAt: now })
      .where(eq(forms.id, id))
      .returning();
    return row;
  }

  /** Shortest free random slug: 3 chars first, growing on collisions. */
  private async freeRandomSlug(): Promise<string> {
    for (let len = 3; len <= 16; len++) {
      for (let i = 0; i < 6; i++) {
        const s = randomSlug(len);
        if (!isValidSlug(s) || RESERVED_SLUGS.has(s)) continue;
        if (!(await this.slugTaken(s))) return s;
      }
    }
    throw new ConflictException('Could not allocate a link');
  }

  async slugTaken(slug: string, exceptFormId?: string): Promise<boolean> {
    const where = exceptFormId ? and(eq(forms.slug, slug), ne(forms.id, exceptFormId)) : eq(forms.slug, slug);
    const [r] = await this.db.select({ id: forms.id }).from(forms).where(where).limit(1);
    return !!r;
  }

  async checkSlug(input: string, formId?: string) {
    const slug = normalizeSlug(input ?? '');
    const problem = slugProblem(slug);
    if (problem) return { available: false, slug, reason: problem };
    if (await this.slugTaken(slug, formId)) return { available: false, slug, reason: 'That link is already taken' };
    return { available: true, slug };
  }

  async setStatus(id: string, status: 'draft' | 'closed'): Promise<FormDoc> {
    const current = await this.getRow(id);
    const [row] = await this.db
      .update(forms)
      .set({ status, updatedAt: new Date() })
      .where(eq(forms.id, id))
      .returning();
    await this.bust(current.slug);
    return toFormDoc(row);
  }

  async duplicate(id: string): Promise<FormDoc> {
    const src = await this.getRow(id);
    const row = await this.insertDraft({
      title: `${src.title || 'Untitled'} (copy)`.slice(0, 300),
      description: src.description,
      fields: src.fields,
      theme: src.theme,
      settings: src.settings,
    });
    return toFormDoc(row);
  }

  async remove(id: string): Promise<{ ok: true }> {
    const current = await this.getRow(id);
    await this.db.delete(files).where(eq(files.formId, id));
    await this.db.delete(forms).where(eq(forms.id, id));
    await this.bust(current.slug);
    // respondent uploads live under forms/<id>/ — clean them up in the background
    this.storage
      .deletePrefix(`forms/${id}/`)
      .then((n) => n && this.logger.log(`Removed ${n} uploaded file(s) of form ${id}`))
      .catch((e) => this.logger.warn(`Could not remove uploads of form ${id}: ${(e as Error).message}`));
    return { ok: true };
  }

  async bust(...slugs: (string | undefined)[]) {
    const keys = [...new Set(slugs.filter((s): s is string => !!s))].map(publicCacheKey);
    await this.redis.del(...keys);
  }
}

export function slugProblem(slug: string): string | undefined {
  if (!slug) return 'Pick a link name';
  if (slug.startsWith('draft-')) return 'Links starting with "draft-" are reserved';
  if (RESERVED_SLUGS.has(slug) || UUID_RE.test(slug)) return 'That link is reserved';
  if (!isValidSlug(slug)) return 'Use letters, numbers, dashes or underscores (max 64)';
  return undefined;
}

function sanitizeSettings(s: FormSettings): FormSettings {
  const date = (v: unknown) => {
    if (v == null || v === '') return null;
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };
  const limit = s.responseLimit == null || (s.responseLimit as unknown) === '' ? null : Math.floor(Number(s.responseLimit));
  const per = Math.floor(Number(s.fieldsPerPage));
  return {
    ...s,
    opensAt: date(s.opensAt),
    closesAt: date(s.closesAt),
    responseLimit: limit != null && Number.isFinite(limit) && limit > 0 ? limit : null,
    fieldsPerPage: Number.isFinite(per) && per > 0 ? Math.min(per, 50) : 4,
  };
}

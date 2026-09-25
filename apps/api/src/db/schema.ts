import type { Answers, FormField, FormSettings, FormStatus, FormTheme, ResponseMeta } from '@formgl/shared';
import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const forms = pgTable(
  'forms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull().default(''),
    description: text('description'),
    status: text('status').$type<FormStatus>().notNull().default('draft'),
    fields: jsonb('fields').$type<FormField[]>().notNull().default(sql`'[]'::jsonb`),
    theme: jsonb('theme').$type<Partial<FormTheme>>().notNull().default(sql`'{}'::jsonb`),
    settings: jsonb('settings').$type<Partial<FormSettings>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
    publishedAt: ts('published_at'),
    /** what respondents see: a snapshot of the draft taken on publish */
    live: jsonb('live').$type<FormSnapshot>(),
    liveVersion: integer('live_version').notNull().default(0),
    liveHash: text('live_hash'),
    livePublishedAt: ts('live_published_at'),
    /** pinned to the top of the dashboard */
    pinned: boolean('pinned').notNull().default(false),
  },
  (t) => [index('forms_updated_at_idx').on(t.updatedAt), index('forms_status_idx').on(t.status)],
);

export interface FormSnapshot {
  title: string;
  description: string | null;
  fields: FormField[];
  theme: Partial<FormTheme>;
  settings: Partial<FormSettings>;
}

export const formVersions = pgTable(
  'form_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    formId: uuid('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    snapshot: jsonb('snapshot').$type<FormSnapshot>().notNull(),
    note: text('note'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('form_versions_form_idx').on(t.formId, t.version)],
);

export const webhooks = pgTable(
  'webhooks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    formId: uuid('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    /** generic JSON, or a chat-friendly message for Slack / Discord */
    kind: text('kind').$type<'json' | 'slack' | 'discord'>().notNull().default('json'),
    secret: text('secret').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('webhooks_form_idx').on(t.formId)],
);

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    webhookId: uuid('webhook_id')
      .notNull()
      .references(() => webhooks.id, { onDelete: 'cascade' }),
    event: text('event').notNull(),
    attempt: integer('attempt').notNull().default(1),
    status: integer('status'),
    ok: boolean('ok').notNull().default(false),
    durationMs: integer('duration_ms'),
    error: text('error'),
    responseBody: text('response_body'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('webhook_deliveries_hook_idx').on(t.webhookId, t.createdAt)],
);

export const responses = pgTable(
  'responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    formId: uuid('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    answers: jsonb('answers').$type<Answers>().notNull().default(sql`'{}'::jsonb`),
    meta: jsonb('meta').$type<ResponseMeta>().notNull().default(sql`'{}'::jsonb`),
    starred: boolean('starred').notNull().default(false),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    note: text('note'),
    sessionId: text('session_id'),
    ip: text('ip'),
    countryCode: text('country_code'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('responses_form_created_idx').on(t.formId, t.createdAt),
    index('responses_form_session_idx').on(t.formId, t.sessionId),
  ],
);

export const events = pgTable(
  'events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    formId: uuid('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    sessionId: text('session_id'),
    page: integer('page'),
    ip: text('ip'),
    country: text('country'),
    countryCode: text('country_code'),
    region: text('region'),
    city: text('city'),
    lat: doublePrecision('lat'),
    lon: doublePrecision('lon'),
    device: text('device'),
    browser: text('browser'),
    os: text('os'),
    referrer: text('referrer'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('events_form_created_idx').on(t.formId, t.createdAt),
    index('events_form_type_idx').on(t.formId, t.type),
  ],
);

export const files = pgTable(
  'files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull().unique(),
    formId: uuid('form_id').references(() => forms.id, { onDelete: 'set null' }),
    fieldId: text('field_id'),
    sessionId: text('session_id'),
    name: text('name').notNull(),
    mime: text('mime').notNull(),
    size: integer('size').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('files_form_idx').on(t.formId)],
);

export type FormRow = typeof forms.$inferSelect;
export type ResponseRow = typeof responses.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type FileRow = typeof files.$inferSelect;
export type VersionRow = typeof formVersions.$inferSelect;
export type WebhookRow = typeof webhooks.$inferSelect;
export type DeliveryRow = typeof webhookDeliveries.$inferSelect;

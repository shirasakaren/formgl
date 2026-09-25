import {
  withSettingsDefaults,
  withThemeDefaults,
  type FormDoc,
  type FormResponse,
  type FormSettings,
  type PublicForm,
} from '@formgl/shared';
import { createHash } from 'node:crypto';
import type { FormRow, FormSnapshot, ResponseRow } from '../db/schema';

const iso = (d: Date | string | null | undefined) => (d == null ? null : new Date(d).toISOString());

/** JSON with sorted keys, so equal content always hashes the same */
function stable(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
    .join(',')}}`;
}

export function snapshotOf(row: Pick<FormRow, 'title' | 'description' | 'fields' | 'theme' | 'settings'>): FormSnapshot {
  return {
    title: row.title,
    description: row.description ?? null,
    fields: row.fields ?? [],
    theme: row.theme ?? {},
    settings: row.settings ?? {},
  };
}

export function hashSnapshot(s: FormSnapshot): string {
  return createHash('sha1').update(stable({ ...s, description: s.description || null })).digest('hex');
}

/** the draft differs from what respondents see */
export function hasUnpublishedChanges(row: FormRow): boolean {
  if (!row.live) return row.status !== 'draft';
  const live = row.liveHash ?? hashSnapshot(row.live);
  return live !== hashSnapshot(snapshotOf(row));
}

/** The row as respondents see it: published forms serve their live snapshot, not the draft. */
export function liveRow(row: FormRow): FormRow {
  if (row.status === 'draft' || !row.live) return row;
  const l = row.live;
  return { ...row, title: l.title, description: l.description, fields: l.fields ?? [], theme: l.theme ?? {}, settings: l.settings ?? {} };
}

export function toFormDoc(row: FormRow): FormDoc {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status,
    fields: row.fields ?? [],
    theme: withThemeDefaults(row.theme),
    settings: withSettingsDefaults(row.settings),
    createdAt: iso(row.createdAt)!,
    updatedAt: iso(row.updatedAt)!,
    publishedAt: iso(row.publishedAt),
    liveVersion: row.liveVersion ?? 0,
    livePublishedAt: iso(row.livePublishedAt),
    hasUnpublishedChanges: hasUnpublishedChanges(row),
    pinned: row.pinned,
  };
}

export type Availability = PublicForm['availability'];

/** Availability from status, schedule and response limit. */
export function computeAvailability(
  status: FormRow['status'],
  settings: FormSettings,
  responseCount: number | (() => number),
  now = new Date(),
): Availability {
  if (status !== 'published') return 'closed';
  const opens = settings.opensAt ? new Date(settings.opensAt) : null;
  const closes = settings.closesAt ? new Date(settings.closesAt) : null;
  if (opens && !Number.isNaN(opens.getTime()) && now < opens) return 'not_yet';
  if (closes && !Number.isNaN(closes.getTime()) && now >= closes) return 'closed';
  const limit = settings.responseLimit;
  if (limit != null && limit > 0) {
    const n = typeof responseCount === 'function' ? responseCount() : responseCount;
    if (n >= limit) return 'limit';
  }
  return 'open';
}

export function toPublicForm(row: FormRow, availability: Availability): PublicForm {
  const doc = toFormDoc(row);
  return {
    id: doc.id,
    slug: doc.slug,
    title: doc.title,
    description: doc.description,
    fields: doc.fields,
    theme: doc.theme,
    settings: doc.settings,
    availability,
  };
}

export function toFormResponse(row: ResponseRow): FormResponse {
  return {
    id: row.id,
    formId: row.formId,
    answers: row.answers ?? {},
    meta: row.meta ?? {},
    starred: row.starred,
    tags: row.tags ?? [],
    note: row.note ?? undefined,
    createdAt: iso(row.createdAt)!,
  };
}

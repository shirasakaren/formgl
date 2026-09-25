import {
  withSettingsDefaults,
  withThemeDefaults,
  type FormDoc,
  type FormResponse,
  type FormSettings,
  type PublicForm,
} from '@formgl/shared';
import type { FormRow, ResponseRow } from '../db/schema';

const iso = (d: Date | string | null | undefined) => (d == null ? null : new Date(d).toISOString());

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

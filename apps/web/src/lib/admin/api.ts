import type {
  AnalyticsSummary,
  FileRef,
  FormDoc,
  FormResponse,
  FormSummary,
  FormVersionSummary,
  Paginated,
  WebhookDeliveryDoc,
  WebhookDoc,
  WebhookKind,
} from '@formgl/shared';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init.body && !isForm ? { 'Content-Type': 'application/json' } : {}),
      Accept: 'application/json',
      ...init.headers,
    },
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const body = (data ?? {}) as { message?: string | string[]; details?: unknown };
    const msg = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    const err = new ApiError(res.status, msg || res.statusText || 'Request failed', body.details);
    if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/admin/auth')) {
      window.dispatchEvent(new CustomEvent('fgl:unauthorized'));
    }
    throw err;
  }
  return data as T;
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body ?? {}) });

export interface OverviewData {
  forms: number;
  published: number;
  responses: number;
  views: number;
  last30: Array<{ date: string; views: number; submissions: number }>;
  recent: Array<FormResponse & { formTitle?: string }>;
}

export interface VisitEvent {
  id: string;
  type: string;
  sessionId?: string;
  page?: number | null;
  ip?: string | null;
  country?: string | null;
  countryCode?: string | null;
  region?: string | null;
  city?: string | null;
  lat?: number | null;
  lon?: number | null;
  device?: string | null;
  browser?: string | null;
  os?: string | null;
  referrer?: string | null;
  createdAt: string;
}

export type FormPatch = Partial<Pick<FormDoc, 'title' | 'description' | 'fields' | 'theme' | 'settings'>>;

const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const api = {
  auth: {
    me: () => request<{ authenticated: boolean }>('/admin/auth/me'),
    login: (passphrase: string) => request<{ ok: true }>('/admin/auth/login', { method: 'POST', ...json({ passphrase }) }),
    logout: () => request<{ ok: true }>('/admin/auth/logout', { method: 'POST' }),
  },
  overview: () => request<OverviewData>('/admin/overview'),
  forms: {
    list: () => request<FormSummary[]>('/admin/forms'),
    create: (body: { templateId?: string; title?: string }) => request<FormDoc>('/admin/forms', { method: 'POST', ...json(body) }),
    get: (id: string) => request<FormDoc>(`/admin/forms/${id}`),
    update: (id: string, patch: FormPatch) => request<FormDoc>(`/admin/forms/${id}`, { method: 'PATCH', ...json(patch) }),
    publish: (id: string, slug?: string, note?: string) =>
      request<FormDoc>(`/admin/forms/${id}/publish`, { method: 'POST', ...json({ ...(slug ? { slug } : {}), ...(note ? { note } : {}) }) }),
    versions: (id: string) => request<FormVersionSummary[]>(`/admin/forms/${id}/versions`),
    restoreVersion: (id: string, vid: string) => request<FormDoc>(`/admin/forms/${id}/versions/${vid}/restore`, { method: 'POST' }),
    discard: (id: string) => request<FormDoc>(`/admin/forms/${id}/discard`, { method: 'POST' }),
    pin: (id: string, pinned: boolean) => request<FormDoc>(`/admin/forms/${id}/pin`, { method: 'POST', ...json({ pinned }) }),
    unpublish: (id: string) => request<FormDoc>(`/admin/forms/${id}/unpublish`, { method: 'POST' }),
    close: (id: string) => request<FormDoc>(`/admin/forms/${id}/close`, { method: 'POST' }),
    duplicate: (id: string) => request<FormDoc>(`/admin/forms/${id}/duplicate`, { method: 'POST' }),
    remove: (id: string) => request<{ ok: true }>(`/admin/forms/${id}`, { method: 'DELETE' }),
    checkSlug: (slug: string, formId?: string) =>
      request<{ available: boolean; slug: string; reason?: string }>(`/admin/slugs/check${qs({ slug, formId })}`),
  },
  responses: {
    all: (formId: string) => request<FormResponse[]>(`/admin/forms/${formId}/responses/all`),
    page: (formId: string, params: Record<string, string | number | boolean | undefined>) =>
      request<Paginated<FormResponse>>(`/admin/forms/${formId}/responses${qs(params)}`),
    update: (rid: string, patch: Partial<Pick<FormResponse, 'starred' | 'tags' | 'note' | 'answers'>>) =>
      request<FormResponse>(`/admin/responses/${rid}`, { method: 'PATCH', ...json(patch) }),
    remove: (rid: string) => request<{ ok: true }>(`/admin/responses/${rid}`, { method: 'DELETE' }),
    bulkDelete: (formId: string, ids: string[]) =>
      request<{ deleted: number }>(`/admin/forms/${formId}/responses/bulk-delete`, { method: 'POST', ...json({ ids }) }),
  },
  analytics: {
    summary: (formId: string, from?: string, to?: string) =>
      request<AnalyticsSummary>(`/admin/forms/${formId}/analytics${qs({ from, to })}`),
    events: (formId: string, params: { page?: number; pageSize?: number; type?: string }) =>
      request<Paginated<VisitEvent>>(`/admin/forms/${formId}/events${qs(params)}`),
  },
  webhooks: {
    list: (formId: string) => request<WebhookDoc[]>(`/admin/forms/${formId}/webhooks`),
    create: (formId: string, body: { url: string; kind?: WebhookKind }) => request<WebhookDoc>(`/admin/forms/${formId}/webhooks`, { method: 'POST', ...json(body) }),
    update: (wid: string, patch: Partial<Pick<WebhookDoc, 'url' | 'kind' | 'active'>>) => request<WebhookDoc>(`/admin/webhooks/${wid}`, { method: 'PATCH', ...json(patch) }),
    remove: (wid: string) => request<{ ok: true }>(`/admin/webhooks/${wid}`, { method: 'DELETE' }),
    rotate: (wid: string) => request<WebhookDoc>(`/admin/webhooks/${wid}/rotate`, { method: 'POST' }),
    test: (wid: string) => request<WebhookDeliveryDoc>(`/admin/webhooks/${wid}/test`, { method: 'POST' }),
    deliveries: (wid: string) => request<WebhookDeliveryDoc[]>(`/admin/webhooks/${wid}/deliveries`),
  },
  upload: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<FileRef>('/admin/uploads', { method: 'POST', body: fd });
  },
};

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong';
}

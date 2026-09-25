import 'server-only';
import { cookies } from 'next/headers';
import type { PublicForm } from '@formgl/shared';

const API = process.env.API_INTERNAL_URL || 'http://localhost:4000';

export async function getPublicForm(slug: string, preview = false): Promise<PublicForm | null> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (preview) {
    const jar = await cookies();
    const c = jar.get('fgl_admin');
    if (c) headers.Cookie = `fgl_admin=${c.value}`;
  }
  try {
    const res = await fetch(`${API}/api/public/forms/${encodeURIComponent(slug)}${preview ? '?preview=1' : ''}`, {
      headers,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as PublicForm;
  } catch {
    return null;
  }
}

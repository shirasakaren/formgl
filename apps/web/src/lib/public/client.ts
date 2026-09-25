'use client';
import type { Answers, FileRef, TrackEventInput, TrackEventType } from '@formgl/shared';

function safeStorage(kind: 'local' | 'session'): Storage | null {
  try {
    const s = kind === 'local' ? window.localStorage : window.sessionStorage;
    const k = '__fgl_t';
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}

export function getSessionId(): string {
  const s = safeStorage('local');
  const key = 'fgl_sid';
  let id = s?.getItem(key) ?? '';
  if (!id) {
    id = (crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replace(/-/g, '');
    s?.setItem(key, id);
  }
  return id;
}

export function readUtm(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const p = new URLSearchParams(window.location.search);
    p.forEach((v, k) => {
      if (k.startsWith('utm_')) out[k] = v.slice(0, 200);
    });
  } catch {
    /* noop */
  }
  return out;
}

function context() {
  return {
    referrer: document.referrer || undefined,
    screen: `${window.screen?.width ?? 0}x${window.screen?.height ?? 0}@${window.devicePixelRatio ?? 1}`,
    locale: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    utm: readUtm(),
  };
}

export function track(slug: string, type: TrackEventType, extra: Partial<TrackEventInput> = {}, demo = false) {
  if (demo || !slug) return;
  const body: TrackEventInput = { type, sessionId: getSessionId(), ...context(), ...extra };
  const url = `/api/public/forms/${encodeURIComponent(slug)}/events`;
  const json = JSON.stringify(body);
  try {
    if ((type === 'abandon' || type === 'page') && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([json], { type: 'text/plain' }));
      return;
    }
    void fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json, keepalive: true }).catch(() => {});
  } catch {
    /* analytics must never break the experience */
  }
}

export class SubmitError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: Record<string, string>,
  ) {
    super(message);
  }
}

export async function submitAnswers(slug: string, answers: Answers, startedAt: number, demo = false): Promise<{ id: string }> {
  if (demo) {
    await new Promise((r) => setTimeout(r, 700));
    return { id: 'demo' };
  }
  const res = await fetch(`/api/public/forms/${encodeURIComponent(slug)}/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers, sessionId: getSessionId(), startedAt, ...context() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message.join(', ') : data?.message || 'Something went wrong';
    throw new SubmitError(msg, res.status, data?.details);
  }
  return data as { id: string };
}

export function uploadFile(
  slug: string,
  fieldId: string,
  file: Blob,
  name: string,
  onProgress?: (p: number) => void,
  demo = false,
): Promise<FileRef> {
  if (demo) {
    return new Promise((resolve) => {
      let p = 0;
      const t = setInterval(() => {
        p = Math.min(1, p + 0.2);
        onProgress?.(p);
        if (p >= 1) {
          clearInterval(t);
          resolve({ id: `demo-${Date.now()}`, key: 'demo', name, size: file.size, mime: file.type, url: URL.createObjectURL(file) });
        }
      }, 120);
    });
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/public/forms/${encodeURIComponent(slug)}/uploads`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      let data: { message?: string } & Partial<FileRef> = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* noop */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as FileRef);
      else reject(new Error(data?.message || 'Upload failed'));
    };
    xhr.onerror = () => reject(new Error('Network error while uploading'));
    const fd = new FormData();
    fd.append('fieldId', fieldId);
    fd.append('sessionId', getSessionId());
    fd.append('file', file, name);
    xhr.send(fd);
  });
}

export const progressStore = {
  load(slug: string): { answers: Answers; page: number } | null {
    const s = safeStorage('local');
    try {
      const raw = s?.getItem(`fgl_progress_${slug}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  save(slug: string, answers: Answers, page: number) {
    try {
      safeStorage('local')?.setItem(`fgl_progress_${slug}`, JSON.stringify({ answers, page }));
    } catch {
      /* quota */
    }
  },
  clear(slug: string) {
    try {
      safeStorage('local')?.removeItem(`fgl_progress_${slug}`);
    } catch {
      /* noop */
    }
  },
  markSubmitted(slug: string) {
    try {
      safeStorage('local')?.setItem(`fgl_sent_${slug}`, String(Date.now()));
    } catch {
      /* noop */
    }
  },
  wasSubmitted(slug: string): boolean {
    try {
      return !!safeStorage('local')?.getItem(`fgl_sent_${slug}`);
    } catch {
      return false;
    }
  },
};

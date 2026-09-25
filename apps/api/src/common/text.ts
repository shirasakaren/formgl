import { randomUUID } from 'node:crypto';

/** Multer / busboy decode filenames as latin1 — recover UTF-8 names when that is what the client sent. */
export function fixFilename(name: string | undefined): string {
  if (!name) return 'file';
  try {
    const re = Buffer.from(name, 'latin1').toString('utf8');
    if (re !== name && !re.includes('�') && /[^\x00-\x7f]/.test(name)) return re;
  } catch {
    /* keep original */
  }
  return name;
}

/** S3 / URL safe file name, keeps the extension. */
export function safeName(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  if (!cleaned) return 'file';
  if (cleaned.length <= 100) return cleaned;
  const dot = cleaned.lastIndexOf('.');
  const ext = dot > 0 && cleaned.length - dot <= 12 ? cleaned.slice(dot) : '';
  return cleaned.slice(0, 100 - ext.length) + ext;
}

export const newId = () => randomUUID();

export function clampStr(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s ? s.slice(0, max) : undefined;
}

/** Hostname of a referrer url (without www.), or undefined */
export function referrerHost(ref?: string | null): string | undefined {
  if (!ref) return undefined;
  try {
    const u = new URL(ref.includes('://') ? ref : `https://${ref}`);
    return u.hostname.replace(/^www\./, '') || undefined;
  } catch {
    return undefined;
  }
}

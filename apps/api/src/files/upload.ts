import {
  BadRequestException,
  type CallHandler,
  type ExecutionContext,
  Injectable,
  mixin,
  type NestInterceptor,
  PayloadTooLargeException,
  type Type,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import multer from 'multer';
import { AppConfig } from '../config/app-config';

/**
 * Multer memory-storage interceptor whose size limit is resolved from config at request time
 * (Nest's FileInterceptor options are fixed at decoration time, before env is loaded).
 */
export function MemoryUpload(field: string, limitBytes: (cfg: AppConfig) => number): Type<NestInterceptor> {
  @Injectable()
  class MemoryUploadInterceptor implements NestInterceptor {
    constructor(private readonly config: AppConfig) {}

    async intercept(ctx: ExecutionContext, next: CallHandler) {
      const req = ctx.switchToHttp().getRequest<Request>();
      const res = ctx.switchToHttp().getResponse<Response>();
      const max = limitBytes(this.config);
      const handler = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: max, files: 1, fields: 20, fieldSize: 64 * 1024 },
      }).single(field);
      await new Promise<void>((resolve, reject) =>
        handler(req, res, (err: unknown) => {
          if (!err) return resolve();
          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              return reject(new PayloadTooLargeException(`File is too large (max ${Math.round((max / 1048576) * 10) / 10} MB)`));
            }
            if (err.code === 'LIMIT_UNEXPECTED_FILE') return reject(new BadRequestException(`Upload the file in the "${field}" field`));
            return reject(new BadRequestException(err.message));
          }
          reject(new BadRequestException((err as Error)?.message || 'Malformed upload'));
        }),
      );
      return next.handle();
    }
  }
  return mixin(MemoryUploadInterceptor);
}

const EXT_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
  zip: 'application/zip',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  ogv: 'video/ogg',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
  json: 'application/json',
};

export const extOf = (name: string) => {
  const m = /\.([a-z0-9]{1,10})$/i.exec(name);
  return m ? m[1].toLowerCase() : '';
};

/** Normalised mime type: trusts a sane client type, falls back to the extension. */
export function resolveMime(clientMime: string | undefined, filename: string): string {
  const m = (clientMime ?? '').toLowerCase().split(';')[0].trim();
  if (m && m !== 'application/octet-stream' && /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(m)) return m;
  return EXT_MIME[extOf(filename)] ?? 'application/octet-stream';
}

/** Matches `accept` tokens like `image/*`, `.pdf`, `application/pdf`. Empty accept ⇒ anything. */
export function matchesAccept(mime: string, filename: string, accept: string[] | undefined): boolean {
  const tokens = (accept ?? []).map((a) => a.trim().toLowerCase()).filter(Boolean);
  if (!tokens.length) return true;
  const ext = extOf(filename);
  return tokens.some((t) => {
    if (t === '*' || t === '*/*') return true;
    if (t.startsWith('.')) return ext !== '' && `.${ext}` === t;
    if (t.endsWith('/*')) return mime.startsWith(t.slice(0, -1));
    return mime === t;
  });
}

/** Types that are safe to render inline from our origin. Everything else downloads. */
export function isInlineSafe(mime: string): boolean {
  return /^(image\/(png|jpe?g|gif|webp|avif|x-icon|vnd\.microsoft\.icon)|video\/[\w.+-]+|audio\/[\w.+-]+|application\/pdf|font\/[\w.+-]+|text\/plain)$/.test(
    mime,
  );
}

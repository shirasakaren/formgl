import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { AdminGuard } from '../auth/admin.guard';
import { StorageService } from '../storage/storage.service';
import { FilesService } from './files.service';
import { isInlineSafe, MemoryUpload } from './upload';

const ADMIN_MAX_BYTES = 100 * 1024 * 1024;
const FILE_CSP = "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox";

@Controller('admin/uploads')
@UseGuards(AdminGuard)
export class AdminUploadsController {
  constructor(private readonly files: FilesService) {}

  @Post()
  @UseInterceptors(MemoryUpload('file', () => ADMIN_MAX_BYTES))
  upload(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('No file uploaded (multipart field "file")');
    return this.files.store(file, 'assets');
  }
}

@Controller('files')
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  @Get('*key')
  async get(@Param('key') keyParam: string | string[], @Req() req: Request, @Res() res: Response) {
    const key = Array.isArray(keyParam) ? keyParam.join('/') : String(keyParam ?? '');
    if (!/^(assets|forms)\/[\w./-]+$/.test(key) || key.includes('..') || key.length > 1024) {
      throw new NotFoundException('File not found');
    }
    const rawRange = req.headers.range;
    // S3 supports a single byte range; anything else is served in full
    const range = rawRange && /^bytes=(\d+-\d*|-\d+)$/.test(rawRange.trim()) ? rawRange.trim() : undefined;
    const ifNoneMatch = typeof req.headers['if-none-match'] === 'string' ? req.headers['if-none-match'] : undefined;

    const abort = new AbortController();
    res.on('close', () => abort.abort());
    let obj;
    try {
      obj = await this.storage.get(key, range, ifNoneMatch, abort.signal);
    } catch (e) {
      const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
      const status = err.$metadata?.httpStatusCode;
      if (status === 304 || err.name === 'NotModified') {
        res.status(304).end();
        return;
      }
      if (status === 404 || err.name === 'NoSuchKey' || err.name === 'NotFound') throw new NotFoundException('File not found');
      if (status === 416 || err.name === 'InvalidRange') {
        throw new HttpException('Requested range not satisfiable', HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE);
      }
      if (abort.signal.aborted) return;
      throw new HttpException('Storage is unavailable', HttpStatus.BAD_GATEWAY);
    }

    const mime = (obj.ContentType || 'application/octet-stream').toLowerCase();
    const filename = key.split('/').pop() || 'file';
    res.status(obj.ContentRange ? 206 : 200);
    res.setHeader('Content-Type', obj.ContentType || 'application/octet-stream');
    if (obj.ContentLength != null) res.setHeader('Content-Length', String(obj.ContentLength));
    if (obj.ContentRange) res.setHeader('Content-Range', obj.ContentRange);
    res.setHeader('Accept-Ranges', 'bytes');
    if (obj.ETag) res.setHeader('ETag', obj.ETag);
    if (obj.LastModified) res.setHeader('Last-Modified', obj.LastModified.toUTCString());
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Security-Policy', FILE_CSP);
    res.setHeader(
      'Content-Disposition',
      `${isInlineSafe(mime.split(';')[0].trim()) ? 'inline' : 'attachment'}; filename="${filename.replace(/"/g, '')}"`,
    );

    const body = obj.Body as Readable | undefined;
    if (!body || req.method === 'HEAD') {
      body?.destroy?.();
      res.end();
      return;
    }
    try {
      await pipeline(body, res);
    } catch {
      /* client went away mid-stream */
    }
  }
}

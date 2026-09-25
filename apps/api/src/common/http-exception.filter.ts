import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { STATUS_CODES } from 'node:http';

interface ErrorBody {
  statusCode: number;
  message: string;
  error: string;
  details?: unknown;
}

/** Every error leaves the API as `{ statusCode, message, error, details? }`. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const body = this.toBody(exception);
    if (body.statusCode >= 500) {
      this.logger.error(
        `${req.method} ${req.originalUrl} → ${body.statusCode}: ${(exception as Error)?.message ?? exception}`,
        (exception as Error)?.stack,
      );
    }
    if (res.headersSent) {
      res.end();
      return;
    }
    res.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const r = exception.getResponse();
      const out: ErrorBody = { statusCode, message: exception.message, error: STATUS_CODES[statusCode] ?? 'Error' };
      if (typeof r === 'string') out.message = r;
      else if (r && typeof r === 'object') {
        const o = r as Record<string, unknown>;
        if (Array.isArray(o.message)) out.message = o.message.join(', ');
        else if (typeof o.message === 'string') out.message = o.message;
        if (typeof o.error === 'string' && o.error !== out.message) out.error = o.error;
        if (o.details !== undefined) out.details = o.details;
      }
      return out;
    }
    const e = exception as { code?: string; status?: number; statusCode?: number; type?: string; message?: string };
    // body-parser / multer style errors
    const status = e?.statusCode ?? e?.status;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      const message =
        e.type === 'entity.too.large'
          ? 'Request body is too large'
          : e.type === 'entity.parse.failed'
            ? 'Malformed JSON body'
            : (e.message ?? 'Bad request');
      return { statusCode: status, message, error: STATUS_CODES[status] ?? 'Error' };
    }
    // postgres errors
    if (e?.code === '23505') return { statusCode: 409, message: 'Already exists', error: 'Conflict' };
    if (e?.code === '22P02') return { statusCode: 400, message: 'Invalid input', error: 'Bad Request' };
    if (e?.code === '23503') return { statusCode: 404, message: 'Related record not found', error: 'Not Found' };
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    };
  }
}

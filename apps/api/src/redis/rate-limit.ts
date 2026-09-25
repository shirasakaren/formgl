import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { getClientIp } from '../common/client-info';
import { AppConfig } from '../config/app-config';
import { RedisService } from './redis.service';

export interface RateLimitOptions {
  /** bucket name, e.g. 'login' */
  name: string;
  limit: number;
  windowSec: number;
  message?: string;
}

const RATE_LIMIT_KEY = 'fgl:rate-limit';

/** Redis fixed-window rate limit per client IP. */
export const RateLimit = (opts: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, opts);

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger('RateLimit');
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
    private readonly config: AppConfig,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const opts = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(RATE_LIMIT_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!opts) return true;
    const req = ctx.switchToHttp().getRequest<Request>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const ip = getClientIp(req, this.config.trustProxy) ?? 'unknown';
    let result: { count: number; resetSec: number };
    try {
      result = await this.redis.hit(`${opts.name}:${ip}`, opts.windowSec);
    } catch (e) {
      // fail open — a redis outage must not take the public forms down
      this.logger.warn(`rate limiter unavailable: ${(e as Error).message}`);
      return true;
    }
    res.setHeader('X-RateLimit-Limit', String(opts.limit));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, opts.limit - result.count)));
    res.setHeader('X-RateLimit-Reset', String(result.resetSec));
    if (result.count > opts.limit) {
      res.setHeader('Retry-After', String(result.resetSec));
      throw new HttpException(
        opts.message ?? 'Too many requests — please slow down and try again in a moment.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}

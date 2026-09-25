import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { AppConfig } from '../config/app-config';
import { REDIS_PREFIX, RedisService } from '../redis/redis.service';

export const SESSION_COOKIE = 'fgl_admin';
export const SESSION_TTL_SEC = 7 * 24 * 60 * 60;
const SESSION_ID_RE = /^[A-Za-z0-9_-]{43}$/; // 32 random bytes, base64url

const sessionKey = (id: string) => `${REDIS_PREFIX}sess:${id}`;
const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest();

@Injectable()
export class AuthService {
  constructor(
    private readonly redis: RedisService,
    private readonly config: AppConfig,
  ) {}

  /** Constant time comparison of sha256 digests (length independent). */
  checkPassphrase(input: string): boolean {
    return timingSafeEqual(sha256(input), sha256(this.config.env.ADMIN_PASSPHRASE));
  }

  async createSession(meta: { ip?: string; userAgent?: string }): Promise<string> {
    const id = randomBytes(32).toString('base64url');
    await this.redis.client.set(
      sessionKey(id),
      JSON.stringify({ createdAt: new Date().toISOString(), ...meta }),
      'EX',
      SESSION_TTL_SEC,
    );
    return id;
  }

  async destroySession(id: string | undefined) {
    if (id && SESSION_ID_RE.test(id)) await this.redis.client.del(sessionKey(id));
  }

  sessionIdFrom(req: Request): string | undefined {
    const raw = (req.cookies as Record<string, unknown> | undefined)?.[SESSION_COOKIE];
    return typeof raw === 'string' && SESSION_ID_RE.test(raw) ? raw : undefined;
  }

  /** true when the request carries a live admin session */
  async isAuthenticated(req: Request): Promise<boolean> {
    const id = this.sessionIdFrom(req);
    if (!id) return false;
    return (await this.redis.client.exists(sessionKey(id))) === 1;
  }

  setCookie(res: Response, id: string) {
    res.cookie(SESSION_COOKIE, id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.isProd,
      path: '/',
      maxAge: SESSION_TTL_SEC * 1000,
    });
  }

  clearCookie(res: Response) {
    res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: this.config.isProd, path: '/' });
  }
}

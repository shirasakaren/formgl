import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfig } from '../config/app-config';

export const REDIS_PREFIX = 'fgl:';

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private readonly logger = new Logger('Redis');
  readonly client: Redis;
  private lastError = 0;

  constructor(config: AppConfig) {
    this.client = new Redis(config.env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: true,
      connectTimeout: 5_000,
      retryStrategy: (times) => Math.min(times * 200, 5_000),
    });
    this.client.on('error', (err) => {
      // avoid log floods while redis is down
      if (Date.now() - this.lastError > 10_000) {
        this.lastError = Date.now();
        this.logger.warn(`Redis error: ${err.message}`);
      }
    });
    this.client.on('ready', () => this.logger.log('Redis connected'));
  }

  async ping(): Promise<boolean> {
    try {
      return (await withTimeout(this.client.ping(), 2_000)) === 'PONG';
    } catch {
      return false;
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSec: number): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSec);
    } catch (e) {
      this.logger.warn(`cache set failed: ${(e as Error).message}`);
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (!keys.length) return;
    try {
      await this.client.del(...keys);
    } catch (e) {
      this.logger.warn(`cache del failed: ${(e as Error).message}`);
    }
  }

  /**
   * Fixed window counter. Returns the current count and seconds until the window resets.
   * Throws when redis is unavailable (caller decides to fail open).
   */
  async hit(bucket: string, windowSec: number): Promise<{ count: number; resetSec: number }> {
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - (now % windowSec);
    const key = `${REDIS_PREFIX}rl:${bucket}:${windowStart}`;
    const res = await this.client.multi().incr(key).expire(key, windowSec + 1).exec();
    const count = Number(res?.[0]?.[1] ?? 0);
    return { count, resetSec: windowStart + windowSec - now };
  }

  async onApplicationShutdown() {
    await this.client.quit().catch(() => this.client.disconnect());
  }
}

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

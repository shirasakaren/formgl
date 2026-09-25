import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { DbService } from '../db/db.service';
import { RedisService } from '../redis/redis.service';
import { StorageService } from '../storage/storage.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly db: DbService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
  ) {}

  /** `{ ok, db, redis, s3 }` — HTTP 503 when a dependency is down (handy for container health checks). */
  @Get()
  async check(@Res({ passthrough: true }) res: Response) {
    const [db, redis, s3] = await Promise.all([this.db.ping(), this.redis.ping(), this.storage.ping()]);
    const ok = db && redis && s3;
    res.status(ok ? 200 : 503);
    res.setHeader('Cache-Control', 'no-store');
    return { ok, db, redis, s3 };
  }
}

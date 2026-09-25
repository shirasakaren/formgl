import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { AppConfig } from '../config/app-config';
import { runMigrations } from './migrate';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class DbService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('Database');
  readonly pool: Pool;
  readonly db: Db;

  constructor(config: AppConfig) {
    this.pool = new Pool({
      connectionString: config.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    this.pool.on('error', (err) => this.logger.error(`Idle client error: ${err.message}`));
    this.db = drizzle(this.pool, { schema });
  }

  async onModuleInit() {
    if (process.env.SKIP_MIGRATIONS === 'true') return;
    await runMigrations(this.pool, (m) => this.logger.log(m));
  }

  async ping(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async onApplicationShutdown() {
    await this.pool.end().catch(() => undefined);
  }
}

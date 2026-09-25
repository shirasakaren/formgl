import { existsSync } from 'node:fs';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { MIGRATIONS_DIR } from '../config/paths';

const LOCK_ID = 7_310_442_901; // arbitrary, app specific advisory lock id

/** Runs pending drizzle migrations, serialised across instances with a pg advisory lock. */
export async function runMigrations(pool: Pool, log: (msg: string) => void = console.log): Promise<void> {
  if (!existsSync(MIGRATIONS_DIR)) throw new Error(`Migrations folder not found: ${MIGRATIONS_DIR}`);
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    const db: NodePgDatabase = drizzle(pool);
    await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
    log(`Database migrations applied (${MIGRATIONS_DIR})`);
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => undefined);
    client.release();
  }
}

/* `pnpm db:migrate` → node dist/db/migrate.js */
if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { config } = require('dotenv') as typeof import('dotenv');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ENV_FILES } = require('../config/paths') as typeof import('../config/paths');
  for (const p of ENV_FILES) if (existsSync(p)) config({ path: p, quiet: true });
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });
  runMigrations(pool)
    .then(() => pool.end())
    .catch(async (e) => {
      console.error(e);
      await pool.end().catch(() => undefined);
      process.exit(1);
    });
}

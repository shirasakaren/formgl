import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

for (const p of [resolve(__dirname, '.env'), resolve(__dirname, '../../.env')]) {
  if (existsSync(p)) config({ path: p, quiet: true });
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://formgl:formgl@localhost:5432/formgl' },
  strict: true,
  verbose: true,
});

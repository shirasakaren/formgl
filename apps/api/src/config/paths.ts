import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** Walks up from this file until it finds apps/api/package.json — works from src (ts) and dist (js). */
function findPackageRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const pkg = join(dir, 'package.json');
    if (existsSync(pkg)) {
      try {
        if (JSON.parse(readFileSync(pkg, 'utf8')).name === '@formgl/api') return dir;
      } catch {
        /* keep walking */
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(__dirname, '..', '..');
}

export const PACKAGE_ROOT = findPackageRoot();
export const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR || join(PACKAGE_ROOT, 'drizzle');
/** apps/api/.env first (wins), then the monorepo root .env */
export const ENV_FILES = [join(PACKAGE_ROOT, '.env'), resolve(PACKAGE_ROOT, '..', '..', '.env')];

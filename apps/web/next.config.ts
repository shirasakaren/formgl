import fs from 'node:fs';
import path from 'node:path';
import type { NextConfig } from 'next';

// share the monorepo root .env with the web app (apps/web/.env.local still wins)
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (fs.existsSync(rootEnv)) {
  try {
    process.loadEnvFile(rootEnv);
  } catch {
    /* ignore malformed env */
  }
}

const API = process.env.API_INTERNAL_URL || 'http://localhost:4000';

const nextConfig: NextConfig = {
  output: 'standalone',
  // monorepo: trace workspace deps (@formgl/shared) into the standalone bundle
  outputFileTracingRoot: path.resolve(process.cwd(), '../../'),
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@formgl/shared'],
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API}/api/:path*` }];
  },
  images: { unoptimized: true },
  // @ts-expect-error — not yet in the public type
  agentRules: false,
};

export default nextConfig;

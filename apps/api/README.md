# @formgl/api

NestJS 11 (Express) backend for FormGL. The HTTP contract lives in [`docs/API.md`](../../docs/API.md);
shared types and validation come from `@formgl/shared`.

**Stack:** Postgres (Drizzle ORM), Redis (admin sessions, public form cache, rate limits), S3 compatible
storage (uploads, streamed back through `/api/files/*`), geoip-lite + ua-parser-js for analytics.

## Run locally

```bash
docker compose up -d                 # postgres, redis, minio (from the repo root)
cp .env.example .env                 # at the repo root; the API also reads apps/api/.env
pnpm install
pnpm --filter @formgl/shared build
pnpm --filter @formgl/api dev        # http://localhost:4000/api  (or: pnpm build && pnpm start)
curl localhost:4000/api/health
```

Env is validated with zod at boot (`src/config/env.ts`); `ADMIN_PASSPHRASE` and `DATABASE_URL` are required.

## Database & migrations

- Schema: `src/db/schema.ts` → SQL migrations in `drizzle/` (committed).
- After changing the schema: `pnpm db:generate` (drizzle-kit).
- Migrations run **automatically on boot** (guarded by a Postgres advisory lock, so several instances can start
  at once). Run them manually with `pnpm build && pnpm db:migrate`. Set `SKIP_MIGRATIONS=true` to disable.
- The migrations folder is resolved relative to the package root (`apps/api/drizzle`), from both `src` and `dist`;
  override with `MIGRATIONS_DIR`.

## Layout

```
src/
  main.ts               bootstrap: prefix /api, helmet, compression, cookies, CORS, body limits
  app.module.ts         CoreModule (config, db, redis, s3) + feature controllers
  config/               zod env schema, typed AppConfig, path helpers
  db/                   drizzle schema, DbService (pool + migrations), migrate script
  redis/                RedisService, fixed-window @RateLimit guard
  storage/              S3 client (bucket bootstrap, put/get/delete)
  auth/                 passphrase login, Redis sessions, AdminGuard
  forms/                admin form CRUD, publish / slugs, serializers
  responses/            listing, search, edit, export (CSV / JSON)
  analytics/            analytics summary (SQL aggregation), raw events, overview
  public/               public form, events, submissions, respondent uploads
  files/                admin uploads, /api/files streaming (Range), upload helpers
  common/               exception filter, zod helpers, client ip / geo / UA, csv
```

## Docker

```bash
docker build -f apps/api/Dockerfile -t formgl-api .   # from the repo root
docker run --env-file .env -e NODE_ENV=production -p 4000:4000 formgl-api
```

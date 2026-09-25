import { z } from 'zod';

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const opt = <T extends z.ZodTypeAny>(schema: T) => z.preprocess(emptyToUndefined, schema.optional());
const bool = (def: boolean) =>
  z.preprocess(
    emptyToUndefined,
    z
      .union([z.boolean(), z.enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'])])
      .optional()
      .transform((v) => (v === undefined ? def : v === true || ['true', '1', 'yes', 'on'].includes(String(v)))),
  );

export const envSchema = z.object({
  NODE_ENV: z.preprocess(emptyToUndefined, z.enum(['development', 'production', 'test']).default('development')),
  ADMIN_PASSPHRASE: z.preprocess(
    emptyToUndefined,
    z.string({ required_error: 'ADMIN_PASSPHRASE is required — set it in .env (the passphrase for /admin)' }).min(1),
  ),
  SESSION_SECRET: opt(z.string()),
  API_PORT: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(65535).default(4000)),
  WEB_ORIGIN: z.preprocess(emptyToUndefined, z.string().default('http://localhost:3000')),
  DATABASE_URL: z.preprocess(
    emptyToUndefined,
    z
      .string({ required_error: 'DATABASE_URL is required, e.g. postgres://formgl:formgl@localhost:5432/formgl' })
      .regex(/^postgres(ql)?:\/\//, 'DATABASE_URL must start with postgres:// or postgresql://'),
  ),
  REDIS_URL: z.preprocess(
    emptyToUndefined,
    z.string().regex(/^rediss?:\/\//, 'REDIS_URL must start with redis:// or rediss://').default('redis://localhost:6379'),
  ),
  /** 'true' | 'false' | hop count | comma separated subnets — passed to express `trust proxy` */
  TRUST_PROXY: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .default('false')
      .transform((v): boolean | number | string => {
        const s = v.trim().toLowerCase();
        if (['true', 'yes', 'on'].includes(s)) return true;
        if (['false', 'no', 'off', '0'].includes(s)) return false;
        if (/^\d+$/.test(s)) return Number(s);
        return v.trim();
      }),
  ),
  S3_ENDPOINT: opt(z.string().url('S3_ENDPOINT must be a URL, e.g. http://localhost:9000')),
  S3_REGION: z.preprocess(emptyToUndefined, z.string().default('us-east-1')),
  S3_BUCKET: z.preprocess(emptyToUndefined, z.string().min(1).default('formgl')),
  S3_ACCESS_KEY: opt(z.string()),
  S3_SECRET_KEY: opt(z.string()),
  S3_FORCE_PATH_STYLE: bool(true),
  MAX_UPLOAD_MB: z.preprocess(emptyToUndefined, z.coerce.number().positive().max(1024).default(25)),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new Error(
      `\n\nFormGL API — invalid environment configuration:\n${lines.join('\n')}\n\n` +
        `The API reads apps/api/.env and the monorepo root .env (see .env.example).\n`,
    );
  }
  validated = parsed.data;
  return parsed.data;
}

let validated: Env | undefined;
/** The env validated by ConfigModule at boot (falls back to validating process.env). */
export function getEnv(): Env {
  return validated ?? validateEnv(process.env);
}

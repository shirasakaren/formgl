import { BadRequestException, Param, ParseUUIDPipe, type PipeTransform } from '@nestjs/common';
import type { ZodTypeAny, z } from 'zod';

/** Parses `value` with a zod schema or throws a 400 with a readable message + issue details. */
export function parseOrThrow<T extends ZodTypeAny>(schema: T, value: unknown, what = 'request body'): z.infer<T> {
  const r = schema.safeParse(value);
  if (r.success) return r.data;
  const issues = r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  const first = issues[0];
  throw new BadRequestException({
    message: `Invalid ${what}${first ? `: ${first.path ? `${first.path} — ` : ''}${first.message}` : ''}`,
    details: issues,
  });
}

export class ZodPipe<T extends ZodTypeAny> implements PipeTransform<unknown, z.infer<T>> {
  constructor(
    private readonly schema: T,
    private readonly what = 'request body',
  ) {}
  transform(value: unknown): z.infer<T> {
    return parseOrThrow(this.schema, value ?? {}, this.what);
  }
}

/** `@UuidParam('id')` → 400 on malformed ids instead of a 500 from postgres. */
export const UuidParam = (name: string) =>
  Param(
    name,
    new ParseUUIDPipe({
      exceptionFactory: () => new BadRequestException(`Invalid ${name}: expected a UUID`),
    }),
  );

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

import type { AnalyticsSummary, FormResponse, Paginated } from '@formgl/shared';
import { BadRequestException, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { DbService } from '../db/db.service';
import { FormsService } from '../forms/forms.service';
import { toFormResponse } from '../forms/serialize';
import { parseBound } from '../responses/responses.service';
import type { ResponseRow } from '../db/schema';

const DAY = 86_400_000;

export const AnalyticsQuery = z.object({
  from: z.string().max(40).optional(),
  to: z.string().max(40).optional(),
  /** IANA timezone used for day / hour / weekday buckets (default UTC) */
  tz: z.string().max(64).optional(),
});

export const EventsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
  type: z.enum(['view', 'loaded', 'open', 'start', 'page', 'submit', 'abandon']).optional(),
});

function validTz(tz?: string): string {
  if (!tz) return 'UTC';
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return tz;
  } catch {
    throw new BadRequestException(`Unknown timezone "${tz}"`);
  }
}

/** offset (ms) of `tz` from UTC at instant `t` */
function tzOffset(t: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(t));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - t;
}

/** A date-only bound (YYYY-MM-DD) → midnight of that day (+addDays) in `tz`. */
function zonedDay(v: string | undefined, tz: string, addDays: number): Date | undefined {
  const m = v && /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return undefined;
  const guess = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + addDays);
  let t = guess - tzOffset(guess, tz);
  t = guess - tzOffset(t, tz);
  return new Date(t);
}

const n = (v: unknown) => (v == null ? 0 : Number(v));
const r4 = (v: number) => Math.round(v * 10_000) / 10_000;

/** SQL expression: referrer hostname without www., 'Direct' when empty */
const REFERRER_HOST = `coalesce(nullif(regexp_replace(lower(substring(referrer from '^(?:[a-zA-Z][a-zA-Z0-9+.-]*://)?([^/:?#\\s]+)')), '^www\\.', ''), ''), 'Direct')`;

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly dbs: DbService,
    private readonly forms: FormsService,
  ) {}

  private q<T = Record<string, unknown>>(text: string, params: unknown[]): Promise<T[]> {
    return this.dbs.pool.query(text, params).then((r) => r.rows as T[]);
  }

  resolveRange(fromS?: string, toS?: string, tz = 'UTC') {
    const to = zonedDay(toS, tz, 1) ?? parseBound(toS, 'to', true) ?? new Date(Date.now() + 1);
    let from = zonedDay(fromS, tz, 0) ?? parseBound(fromS, 'from') ?? new Date(to.getTime() - 30 * DAY);
    if (from >= to) throw new BadRequestException('"from" must be before "to"');
    if (to.getTime() - from.getTime() > 366 * DAY) from = new Date(to.getTime() - 366 * DAY);
    return { from, to };
  }

  async summary(formId: string, query: z.infer<typeof AnalyticsQuery>): Promise<AnalyticsSummary> {
    await this.forms.getRow(formId);
    const tz = validTz(query.tz);
    const { from, to } = this.resolveRange(query.from, query.to, tz);
    const p = [formId, from, to];
    const EV = `form_id = $1 AND created_at >= $2 AND created_at < $3`;

    const [totalsRows, respRows, series, hours, weekdays, countries, cities, devices, browsers, oses, referrers, pages, points] =
      await Promise.all([
        this.q(
          `SELECT count(*) FILTER (WHERE type = 'view') AS views,
                  count(DISTINCT session_id) FILTER (WHERE type = 'view') AS unique_visitors,
                  count(DISTINCT session_id) FILTER (WHERE type = 'loaded') AS loaded,
                  count(DISTINCT session_id) FILTER (WHERE type = 'open') AS opens,
                  count(DISTINCT session_id) FILTER (WHERE type = 'start') AS starts
             FROM events WHERE ${EV}`,
          p,
        ),
        this.q(
          `SELECT count(*) AS submissions,
                  count(DISTINCT coalesce(session_id, id::text)) AS submit_sessions,
                  avg(d) AS avg_ms,
                  percentile_cont(0.5) WITHIN GROUP (ORDER BY d) AS median_ms
             FROM (SELECT id, session_id,
                          CASE WHEN jsonb_typeof(meta->'durationMs') = 'number' THEN (meta->>'durationMs')::float8 END AS d
                     FROM responses WHERE ${EV}) r`,
          p,
        ),
        this.q<{ date: string; views: string; opens: string; submissions: string }>(
          `WITH days AS (
             SELECT generate_series(($2::timestamptz AT TIME ZONE $4)::date,
                                    (($3::timestamptz - interval '1 millisecond') AT TIME ZONE $4)::date,
                                    interval '1 day')::date AS d),
           ev AS (SELECT (created_at AT TIME ZONE $4)::date AS d,
                         count(*) FILTER (WHERE type = 'view') AS views,
                         count(DISTINCT session_id) FILTER (WHERE type = 'open') AS opens
                    FROM events WHERE ${EV} GROUP BY 1),
           rs AS (SELECT (created_at AT TIME ZONE $4)::date AS d, count(*) AS submissions
                    FROM responses WHERE ${EV} GROUP BY 1)
           SELECT to_char(days.d, 'YYYY-MM-DD') AS date,
                  coalesce(ev.views, 0) AS views, coalesce(ev.opens, 0) AS opens, coalesce(rs.submissions, 0) AS submissions
             FROM days LEFT JOIN ev ON ev.d = days.d LEFT JOIN rs ON rs.d = days.d
            ORDER BY days.d`,
          [...p, tz],
        ),
        this.q<{ k: number; c: string }>(
          `SELECT extract(hour FROM created_at AT TIME ZONE $4)::int AS k, count(*) AS c FROM responses WHERE ${EV} GROUP BY 1`,
          [...p, tz],
        ),
        this.q<{ k: number; c: string }>(
          `SELECT extract(dow FROM created_at AT TIME ZONE $4)::int AS k, count(*) AS c FROM responses WHERE ${EV} GROUP BY 1`,
          [...p, tz],
        ),
        this.q<{ country: string; country_code: string; c: string }>(
          `SELECT max(country) AS country, country_code, count(DISTINCT coalesce(session_id, id::text)) AS c
             FROM events WHERE ${EV} AND type = 'view' AND country_code IS NOT NULL
            GROUP BY country_code ORDER BY c DESC LIMIT 100`,
          p,
        ),
        this.q<{ city: string; country: string; c: string; lat: number; lon: number }>(
          `SELECT city, max(country) AS country, count(DISTINCT coalesce(session_id, id::text)) AS c, avg(lat) AS lat, avg(lon) AS lon
             FROM events WHERE ${EV} AND type = 'view' AND city IS NOT NULL AND city <> ''
            GROUP BY city, country_code ORDER BY c DESC LIMIT 100`,
          p,
        ),
        this.dim('device', EV, p),
        this.dim('browser', EV, p),
        this.dim('os', EV, p),
        this.q<{ k: string; c: string }>(
          `SELECT ${REFERRER_HOST} AS k, count(DISTINCT coalesce(session_id, id::text)) AS c
             FROM events WHERE ${EV} AND type = 'view' GROUP BY 1 ORDER BY c DESC LIMIT 50`,
          p,
        ),
        this.q<{ page: number; c: string }>(
          `SELECT max_page AS page, count(*) AS c FROM (
             SELECT session_id, max(page) AS max_page FROM events
              WHERE ${EV} AND type = 'page' AND page IS NOT NULL GROUP BY session_id) t
            GROUP BY max_page ORDER BY max_page`,
          p,
        ),
        this.q<{ lat: number; lon: number; city: string | null; country: string | null; type: string }>(
          `(SELECT lat, lon, city, country, 'submit' AS type, created_at FROM (
              SELECT (meta->>'lat')::float8 AS lat, (meta->>'lon')::float8 AS lon, meta->>'city' AS city,
                     meta->>'country' AS country, created_at
                FROM responses WHERE ${EV} AND jsonb_typeof(meta->'lat') = 'number' AND jsonb_typeof(meta->'lon') = 'number'
               ORDER BY created_at DESC LIMIT 500) s)
           UNION ALL
           (SELECT lat, lon, city, country, 'view' AS type, created_at FROM (
              SELECT DISTINCT ON (coalesce(session_id, id::text)) lat, lon, city, country, created_at
                FROM events WHERE ${EV} AND type = 'view' AND lat IS NOT NULL AND lon IS NOT NULL
               ORDER BY coalesce(session_id, id::text), created_at DESC) v
             ORDER BY created_at DESC LIMIT 1000)
           LIMIT 1000`,
          p,
        ),
      ]);

    const t = totalsRows[0] ?? {};
    const rsp = respRows[0] ?? {};
    const uniqueVisitors = n(t.unique_visitors);
    const submissions = n(rsp.submissions);
    const opens = n(t.opens);
    const hourMap = new Map(hours.map((h) => [n(h.k), n(h.c)]));
    const dowMap = new Map(weekdays.map((h) => [n(h.k), n(h.c)]));

    return {
      totals: {
        views: n(t.views),
        uniqueVisitors,
        opens,
        starts: n(t.starts),
        submissions,
        completionRate: uniqueVisitors ? r4(Math.min(1, submissions / uniqueVisitors)) : 0,
        openRate: uniqueVisitors ? r4(Math.min(1, opens / uniqueVisitors)) : 0,
        avgDurationMs: Math.round(n(rsp.avg_ms)),
        medianDurationMs: Math.round(n(rsp.median_ms)),
      },
      funnel: [
        { step: 'Viewed', count: uniqueVisitors },
        { step: 'Loaded', count: n(t.loaded) },
        { step: 'Opened envelope', count: opens },
        { step: 'Started', count: n(t.starts) },
        { step: 'Submitted', count: n(rsp.submit_sessions) },
      ],
      timeseries: series.map((s) => ({
        date: s.date,
        views: n(s.views),
        opens: n(s.opens),
        submissions: n(s.submissions),
      })),
      byHour: Array.from({ length: 24 }, (_, hour) => ({ hour, count: hourMap.get(hour) ?? 0 })),
      byWeekday: Array.from({ length: 7 }, (_, weekday) => ({ weekday, count: dowMap.get(weekday) ?? 0 })),
      countries: countries.map((c) => ({
        country: c.country || c.country_code,
        countryCode: c.country_code,
        count: n(c.c),
      })),
      cities: cities.map((c) => ({
        city: c.city,
        country: c.country ?? undefined,
        count: n(c.c),
        lat: c.lat == null ? undefined : Number(c.lat),
        lon: c.lon == null ? undefined : Number(c.lon),
      })),
      devices: devices.map((d) => ({ device: d.k, count: n(d.c) })),
      browsers: browsers.map((d) => ({ browser: d.k, count: n(d.c) })),
      os: oses.map((d) => ({ os: d.k, count: n(d.c) })),
      referrers: referrers.map((d) => ({ referrer: d.k, count: n(d.c) })),
      pageDropoff: pages.map((d) => ({ page: n(d.page), count: n(d.c) })),
      points: points.map((d) => ({
        lat: Number(d.lat),
        lon: Number(d.lon),
        city: d.city ?? undefined,
        country: d.country ?? undefined,
        type: d.type,
      })),
    };
  }

  private dim(col: 'device' | 'browser' | 'os', where: string, p: unknown[]) {
    return this.q<{ k: string; c: string }>(
      `SELECT coalesce(nullif(${col}, ''), 'Unknown') AS k, count(DISTINCT coalesce(session_id, id::text)) AS c
         FROM events WHERE ${where} AND type = 'view' GROUP BY 1 ORDER BY c DESC LIMIT 50`,
      p,
    );
  }

  async events(formId: string, query: z.infer<typeof EventsQuery>): Promise<Paginated<Record<string, unknown>>> {
    await this.forms.getRow(formId);
    const params: unknown[] = [formId];
    let where = 'form_id = $1';
    if (query.type) {
      params.push(query.type);
      where += ` AND type = $2`;
    }
    const [{ total }] = await this.q<{ total: string }>(`SELECT count(*) AS total FROM events WHERE ${where}`, params);
    const rows = await this.q<Record<string, unknown>>(
      `SELECT id::text AS id, type, session_id AS "sessionId", page, ip, country, country_code AS "countryCode", region, city,
              lat, lon, device, browser, os, referrer, created_at AS "createdAt"
         FROM events WHERE ${where}
        ORDER BY created_at DESC, id DESC
        LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
      params,
    );
    return {
      items: rows.map((r) => ({ ...r, createdAt: new Date(r.createdAt as string).toISOString() })),
      total: n(total),
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async overview() {
    const since = new Date(Date.now() - 29 * DAY);
    since.setUTCHours(0, 0, 0, 0);
    const [[counts], series, recent] = await Promise.all([
      this.q<{ forms: string; published: string; responses: string; views: string }>(
        `SELECT (SELECT count(*) FROM forms) AS forms,
                (SELECT count(*) FROM forms WHERE status = 'published') AS published,
                (SELECT count(*) FROM responses) AS responses,
                (SELECT count(*) FROM events WHERE type = 'view') AS views`,
        [],
      ),
      this.q<{ date: string; views: string; submissions: string }>(
        `WITH days AS (SELECT generate_series($1::date, (now() AT TIME ZONE 'UTC')::date, interval '1 day')::date AS d),
              ev AS (SELECT (created_at AT TIME ZONE 'UTC')::date AS d, count(*) AS views
                       FROM events WHERE type = 'view' AND created_at >= $1::date GROUP BY 1),
              rs AS (SELECT (created_at AT TIME ZONE 'UTC')::date AS d, count(*) AS submissions
                       FROM responses WHERE created_at >= $1::date GROUP BY 1)
         SELECT to_char(days.d, 'YYYY-MM-DD') AS date, coalesce(ev.views, 0) AS views, coalesce(rs.submissions, 0) AS submissions
           FROM days LEFT JOIN ev ON ev.d = days.d LEFT JOIN rs ON rs.d = days.d ORDER BY days.d`,
        [since.toISOString().slice(0, 10)],
      ),
      this.q<Record<string, unknown>>(
        `SELECT r.id, r.form_id, r.answers, r.meta, r.starred, r.tags, r.note, r.session_id, r.ip, r.country_code,
                r.created_at, f.title AS form_title
           FROM responses r JOIN forms f ON f.id = r.form_id
          ORDER BY r.created_at DESC LIMIT 10`,
        [],
      ),
    ]);
    return {
      forms: n(counts.forms),
      published: n(counts.published),
      responses: n(counts.responses),
      views: n(counts.views),
      last30: series.map((s) => ({ date: s.date, views: n(s.views), submissions: n(s.submissions) })),
      recent: recent.map(
        (r): FormResponse & { formTitle: string } => ({
          ...toFormResponse({
            id: r.id,
            formId: r.form_id,
            answers: r.answers,
            meta: r.meta,
            starred: r.starred,
            tags: r.tags,
            note: r.note,
            sessionId: r.session_id,
            ip: r.ip,
            countryCode: r.country_code,
            createdAt: r.created_at,
          } as ResponseRow),
          formTitle: String(r.form_title ?? ''),
        }),
      ),
    };
  }
}

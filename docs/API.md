# FormGL HTTP API

All routes are served by the NestJS app (`apps/api`) under the global prefix `/api`.
The Next.js app rewrites `/api/*` → `API_INTERNAL_URL/api/*`, so the browser always talks
same-origin (cookies just work). Types referenced below live in `@formgl/shared`.

Errors are JSON: `{ statusCode, message, error, details? }` (`message` is always a single string;
`details` carries zod issues on `400`s and the per-field error map on submit `422`s).
Malformed ids in `:id` / `:rid` return `400`.

## Auth (admin)

The admin passphrase is `ADMIN_PASSPHRASE` in `.env`. Sessions live in Redis
(`fgl:sess:<id>`, 7 day TTL) and the id is sent in an httpOnly cookie `fgl_admin`
(`SameSite=Lax`, `Secure` in production). Login is rate limited (5/min per IP).

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/api/admin/auth/login` | `{ passphrase }` | `{ ok: true }` + cookie, `401` on mismatch |
| POST | `/api/admin/auth/logout` | – | `{ ok: true }` |
| GET | `/api/admin/auth/me` | – | `{ authenticated: true }` or `401` |

Every other `/api/admin/*` route requires the session cookie (`401` otherwise).

## Forms (admin)

| Method | Path | Body / query | Returns |
| --- | --- | --- | --- |
| GET | `/api/admin/overview` | – | `{ forms, published, responses, views, last30: {date, views, submissions}[] , recent: FormResponse & {formTitle} [] }` |
| GET | `/api/admin/forms` | – | `FormSummary[]` (newest updated first) |
| POST | `/api/admin/forms` | `{ templateId?: string, title?: string }` | `FormDoc` (draft, temp slug `draft-xxxxxx`) |
| GET | `/api/admin/forms/:id` | – | `FormDoc` |
| PATCH | `/api/admin/forms/:id` | `Partial<{ title, description, fields, theme, settings }>` — each key given replaces the stored value; `theme` / `settings` are filled with defaults (send the whole object) | `FormDoc` |
| POST | `/api/admin/forms/:id/publish` | `{ slug?: string }` — omitted/empty ⇒ shortest free random slug (3 chars, grows on collision); a form that was published before keeps its current slug | `FormDoc` (`status: 'published'`) — `409` if slug taken, `400` if invalid/reserved |
| POST | `/api/admin/forms/:id/unpublish` | – | `FormDoc` (`draft`) |
| POST | `/api/admin/forms/:id/close` | – | `FormDoc` (`closed`) |
| POST | `/api/admin/forms/:id/duplicate` | – | `FormDoc` |
| DELETE | `/api/admin/forms/:id` | – | `{ ok: true }` (cascades responses/events) |
| GET | `/api/admin/slugs/check` | `?slug=&formId=` | `{ available: boolean, slug: string (normalized), reason?: string }` |

## Responses (admin)

| Method | Path | Body / query | Returns |
| --- | --- | --- | --- |
| GET | `/api/admin/forms/:id/responses` | `?page=1&pageSize=50&q=&from=&to=&starred=true&sort=newest\|oldest` | `Paginated<FormResponse>` |
| GET | `/api/admin/forms/:id/responses/all` | – | `FormResponse[]` (for client side analysis) |
| PATCH | `/api/admin/responses/:rid` | `{ starred?, tags?, note?, answers? }` — `answers` is merged key by key | `FormResponse` |
| DELETE | `/api/admin/responses/:rid` | – | `{ ok: true }` |
| POST | `/api/admin/forms/:id/responses/bulk-delete` | `{ ids: string[] }` | `{ deleted: number }` |
| GET | `/api/admin/forms/:id/export` | `?format=csv\|json` | file download (one column per field + meta columns) |

## Analytics (admin)

| Method | Path | Query | Returns |
| --- | --- | --- | --- |
| GET | `/api/admin/forms/:id/analytics` | `?from=ISO&to=ISO&tz=IANA` (default last 30 days, max 366; `tz` default `UTC`) | `AnalyticsSummary` |
| GET | `/api/admin/forms/:id/events` | `?page=&pageSize=&type=` | `Paginated<{ id, type, sessionId, page, ip, country, countryCode, region, city, lat, lon, device, browser, os, referrer, createdAt }>` |

## Uploads & files

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/api/admin/uploads` | multipart `file` (≤ 100 MB) | `FileRef` — admin assets (logo, cover, images, video) |
| POST | `/api/public/forms/:slug/uploads` | multipart `file`, `fieldId`, `sessionId` | `FileRef` — validated against the field's `accept` / `maxSizeMb` and `MAX_UPLOAD_MB`; rate limited |
| GET | `/api/files/*key` | – | streams the object from S3 (supports `Range`, long cache headers) |

`FileRef.url` is always the relative `/api/files/<key>` URL.

## Public

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/api/public/forms/:slug` | `?preview=1` (admin cookie required for drafts) | `PublicForm` (`404` when missing/unpublished) — cached in Redis 30s, busted on update |
| POST | `/api/public/forms/:slug/events` | `TrackEventInput` | `204` — IP, geo (geoip-lite + CDN headers), UA parsed server-side |
| POST | `/api/public/forms/:slug/responses` | `SubmitInput` | `{ ok: true, id }` — server re-validates with `validateAnswers`, enforces availability / limit / onePerDevice, rate limited 10/min per IP |

## Health

`GET /api/health` → `{ ok: true, db: boolean, redis: boolean, s3: boolean }` (HTTP `503` with `ok: false` when a dependency is down)

## Implementation notes

Details of the NestJS implementation that clients may rely on (additions only — nothing above changed shape).

- **Rate limits** (Redis fixed window, per client IP): login 5/min, submit 10/min, public upload 30/min,
  events 120/min. Limited routes send `X-RateLimit-Limit/Remaining/Reset`; over the limit ⇒ `429` + `Retry-After`.
  The limiter fails open if Redis is unreachable.
- **Slugs**: lower-cased and normalized with `normalizeSlug`. Besides `RESERVED_SLUGS`, slugs starting with `draft-`
  and UUID-shaped slugs are rejected (`400`). Drafts use a temporary `draft-xxxxxxxx` slug. Unpublish keeps the slug.
- **Public form**: published *and closed* forms are returned (closed ⇒ `availability: 'closed'`); drafts and unknown
  slugs ⇒ `404`. With `?preview=1` + admin cookie any status is returned, drafts computed as if published, never
  cached; in preview `:slug` may also be the form id.
- **Events**: body may be sent as `text/plain` JSON (`navigator.sendBeacon`). Events for drafts are accepted but not
  stored. Client-sent `submit` events are ignored — the API records `submit` itself on a successful submission.
- **Submit**: `404` unknown/draft, `403` not open (`message` = `settings.closedMessage` or a not-yet/limit message),
  `409` onePerDevice duplicate (by `sessionId`), `422` validation (`details` = `{ [fieldId]: message }`), `400` bad shape.
  Answers for unknown ids, content blocks and logic-hidden questions are dropped. File answers are rebuilt from
  the server's upload records (only files uploaded to this form + field are kept). `meta.durationMs` = now − `startedAt`
  (dropped when the client clock is clearly wrong). With `settings.collectGeo === false` no IP / geo is stored.
- **Respondent uploads**: `413` too large (`min(field.validation.maxSizeMb, MAX_UPLOAD_MB)`), `415` type not in
  `field.validation.accept` (`image/*`, `.pdf`, exact mime; `image_upload` defaults to `image/*`; `signature` accepts
  `image/png`), `400` unknown/non-upload `fieldId`, `403` form not open. Keys:
  `forms/<formId>/<fieldId>/<uuid>/<name>`; admin assets: `assets/<uuid>/<name>`.
- **Files**: `GET /api/files/*key` supports single `Range` (`206`), `If-None-Match` (`304`) and `HEAD`. Types that are not
  safe to render inline (html, svg, …) are served with `Content-Disposition: attachment` and a sandboxing CSP.
- **Responses list**: `pageSize` ≤ 500; `q` searches answers and the note (case-insensitive); a date-only `to` includes that day;
  `starred=true|false`.
- **Export**: CSV has a UTF-8 BOM, CRLF lines, RFC 4180 quoting; cells starting with `=`, `+`, `@` are prefixed with `'`
  (formula injection guard). JSON export uses the same column names with raw answer values.
- **Analytics**: `byHour` / `byWeekday` (0 = Sunday) count submissions; `countries`, `cities`, `devices`, `browsers`, `os`,
  `referrers` count distinct sessions among `view` events; `completionRate` / `openRate` are 0–1 ratios (capped at 1);
  `pageDropoff` = sessions by the highest page reached; buckets use `tz`, and date-only `from` / `to` are whole days in `tz`.
  `GET …/events` items have a string `id`.

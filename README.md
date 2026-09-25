# FormGL — letters, not forms

FormGL is a form builder whose forms arrive as **hand-sealed letters in a 3D park**.
Respondents find an envelope resting on an old wooden bench under a tree. Sunlight falls through the
leaves and moves across the bench. They break the wax seal, the flap curls open, and the letter slides out
and unfolds in front of them. Then they answer on real paper, one page at a time.

Admins get a full dashboard at `/admin`: templates, a visual editor, theming, publishing with custom or random
short links, a responses table with data tools, and analytics.

```
apps/
  web/     Next.js 16 (App Router, React 19) — public 3D experience + /admin dashboard
  api/     NestJS 11 on Express — REST API (Postgres · Redis · S3)
packages/
  shared/  @formgl/shared — field catalog, types, validation, pagination, templates
docs/
  API.md   the HTTP contract
```

---

## Quick start

Requirements: Node ≥ 20.11 (22 recommended), pnpm 10, Docker (for Postgres / Redis / MinIO).

```bash
pnpm install
cp .env.example .env                  # set ADMIN_PASSPHRASE + SESSION_SECRET (read by both apps)
docker compose up -d                  # postgres:5432, redis:6379, minio:9000 (bucket "formgl")
pnpm --filter @formgl/shared build
pnpm dev                              # web → http://localhost:3000   api → http://localhost:4000/api
```

- `http://localhost:3000/` shows a **demo letter**. It needs no backend and sends nothing.
- `http://localhost:3000/admin` asks for the passphrase in `ADMIN_PASSPHRASE`.
- Published forms live at `http://localhost:3000/<slug>`.

Database migrations run automatically when the API boots.

### Run everything in Docker

```bash
docker compose --profile app up -d --build     # infra + api + web
```

### Environment

Every key is listed in [`.env.example`](.env.example).

| Key | Purpose |
| --- | --- |
| `ADMIN_PASSPHRASE` | Passphrase for `/admin` (required) |
| `SESSION_SECRET` | Long random string |
| `DATABASE_URL` | Postgres connection string |
| `REDIS_URL` | Redis. Used for admin sessions, the public form cache and rate limits |
| `S3_*` | Any S3 compatible bucket (MinIO, R2, B2, Wasabi, AWS…) · `S3_FORCE_PATH_STYLE=true` for MinIO |
| `MAX_UPLOAD_MB` | Largest file a respondent may upload |
| `TRUST_PROXY` | Trust `X-Forwarded-For` and CDN geo headers behind a proxy |
| `API_INTERNAL_URL` | Where Next.js reaches the API. `/api/*` is rewritten to it |
| `NEXT_PUBLIC_SITE_URL` | Public URL, used for OG tags |

---

## The public experience (`apps/web/src/components/experience`)

Everything you see is generated in the browser. There are no downloaded models, HDRs or textures: wood grain,
paper fibre, gravel, bark, leaves, the wax emboss and the liner pattern are all painted procedurally on canvases.

| Stage | What happens |
| --- | --- |
| **Loader** | A solid page in the theme's colour cycles through small hand-drawn vignettes: ink writing a flourish, a wax stamp pressing, a paper plane, falling leaves, an envelope sealing, a dandelion. It shows real progress as the fonts, textures and shaders load. |
| **Dandelion reveal** | The solid colour breaks into thousands of GPU dandelion seeds. Each seed carries the colour away on the wind, uncovering the park. |
| **Establishing shot** | The camera glides from a wide view of the park to the envelope leaning on the bench. |
| **Scene** | A cast-iron and wood bench. Moving *komorebi* light: a live leaf-canopy mask projected by the sun (a spotlight `map` plus soft shadows). Swaying grass and meadow flowers, billboard foliage, a hero tree, dandelions, dust motes, falling leaves, butterflies, light shafts and bokeh. Depth of field, bloom, AgX tone mapping, AO and grain. |
| **Envelope** | A paper envelope with a real flap geometry that bends. The title is handwritten in the theme's font. The wax seal is embossed with the admin's **logo**, or a monogram. |
| **Opening** | Tap: the envelope lifts and turns toward you. The seal trembles, **cracks in two** and throws wax crumbs onto the bench. The flap curls open to show a botanical liner. The folded letter slides out, rises into the light and **unfolds**, and the camera brings it close to read. |
| **Letter** | The questions are written **on the 3D sheet itself**. The real, accessible DOM form is laid out at a fixed page size and pinned onto the paper every frame with a CSS `matrix3d` homography of the sheet's projected corners (`scene/PaperProjector.tsx`), so it tilts, breathes, catches the scene's light and shadows (its ink is multiplied into the lit paper) and turns with it. Inputs are native, so keyboards, IME, autofill and screen readers all work. |
| **Filling in** | Each field is a numbered row in the margin. The row you're writing in gets a highlighter wash and an accent rule, answered rows get an inked tick, and a pencilled *Start here / Next* note (with a moving underline) points at the next empty field. Required fields say so in words. Clicking anywhere on a row puts the caret in it. Errors show as wavy red ink and the sheet shakes. A "more below" cue appears when a page runs past the bottom of the sheet. |
| **Pages** | "Fields per page" (plus manual page breaks) splits the letter into sheets. The 3D sheet swings edge-on, the next page is written and it swings back (*fade* just crossfades). Fields appear with *ink*, *typewriter*, *rise*, *blur* or *fade* animations. Without WebGL the letter is a flat paper page with the classic *flip*, *slide*, *fold*, *stack* transitions. |
| **Send** | The letter folds back into the envelope and the flap closes. A fresh seal is stamped on, and the envelope flies off into the trees. A thank-you card follows, with falling petals and an optional redirect. |

**Worlds.** Admins pick one of five environments in *Design → World*. Each has its own loading vignettes and
quotes, reveal transition, soundscape, 3D scene, opening and send-off. Every world is a separate lazy chunk, and
only its textures are painted.

| World | Vessel | Opening | Send-off |
| --- | --- | --- | --- |
| **The Park Bench** | Wax-sealed envelope on a bench under a tree | The seal cracks, the flap curls open, the letter unfolds | Folded back, resealed, flies into the trees |
| **Message in a Bottle** | A corked bottle at the waterline of a morning beach | A wave washes in, the bottle is lifted, the cork twists out and the scroll slides from the neck, slips its ribbon and unrolls | The scroll goes back in, the cork is pushed home, the sea carries it to the horizon |
| **The Writing Desk** | A ribbon-tied letter on a desk by an open window with sheer curtains | A breeze billows the curtains, the silk bow unties, the pressed violet drifts aside, the letter lifts and opens | The reply folds itself into a paper plane and glides out of the window |
| **Above the Clouds** | A scroll carried by party balloons beside your hot-air balloon basket | The balloons drift over, you catch the string, let them go and the scroll unrolls | The reply is rolled and tied, a new balloon blows up and carries it off toward the sun |
| **Lantern Lake** | A glowing paper lantern drifting by a wooden jetty on a moonlit lake | The lantern floats in to the jetty, its paper lid folds open and the letter rises out of the candlelight | The reply is folded back inside, the lid closes, and the lantern lifts off the water into the stars with the others on the lake |

Reveal transitions: dandelion seeds (park), a wave of sea foam (seaside), parting curtains (desk), parting clouds
(sky) and drifting embers (lake). Soundscapes: wind and birds; waves and gulls; a ticking clock, far birds and curtains; high wind, chimes and
the burner; crickets, lapping water and a far-off owl.

**Themes.** Five times of day (morning, noon, golden hour, dusk, overcast) change the sun, sky, fog, foliage and
bokeh. Admins also choose the colours, paper type, fonts, particles, wind strength and camera sway.

**Sound.** A procedural WebAudio soundscape: wind in the leaves and distant birds, plus paper, wax and pen sounds
for each interaction. It can be muted, and the choice is remembered. Admins can add their own music URL.

**Performance.** Everything is baked before the scene is shown, and nothing heavy happens after:

- **Textures are baked off the main thread.** The procedural textures (wood, paper, wax seal, gravel, bark, sand,
  wallpaper, wicker…) are painted in a pool of Web Workers on `OffscreenCanvas` and sent back as `ImageBitmap`s
  (`scene/bake/`). Results are cached in IndexedDB, so a returning visitor's textures load in a fraction of a
  second. Only the text-bearing textures (envelope title, letter face) are drawn on the page, one per frame.
- **The GPU is warmed up during loading** (`scene/Warmup.tsx`): every texture is uploaded, and every shader
  program is compiled and linked a little per frame — for the exact render target and tone mapping it will be
  used with, including hidden props (the paper plane, the reply balloon) and each post-processing effect. With
  `KHR_parallel_shader_compile` this happens on the driver's threads. Nothing compiles once the scene is visible.
- **The scene doesn't render while the loader is up**, except for the warm-up's frames, so the loading screen
  stays smooth. Its main motion is compositor-only (transform animations), and the progress bar eases and
  creeps instead of jumping.
- **Baked lighting.** The reflection environment is a PMREM map baked once at mount. Shadow maps are not
  re-rendered every frame: they refresh only when something that casts a shadow moves, plus at a low rate in
  worlds with swaying casters.
- **Steady frame rate.** Rendering is capped at 60 fps (so 120/144 Hz screens don't double the work) and 30 fps
  while reading. Resolution follows a pixel budget per quality tier. Under sustained load only the resolution
  steps down, never the quality tier, because switching tiers would rebuild the world.
- **Quality is chosen once, before loading,** from the GPU name, memory and cores. Only strong GPUs get *high*
  (AO, SMAA, real glass refraction). Force a tier with `?quality=low|medium|high`, and add `?perf` to log bake
  and warm-up timings.

**Accessibility & devices.**

- Works from small phones to ultrawide screens. The camera framing adapts to the screen shape, and safe-area
  insets are respected.
- The envelope hint is a real `<button>`, there is a "Skip to the questions" link, and every field is labelled.
- Errors are announced, and focus is managed between pages.
- Keyboard: Enter moves to the next page, and arrow keys work in radio groups.
- `prefers-reduced-motion` gets a faster, calmer version.
- Devices without WebGL get an illustrated 2D envelope.

**QA helpers.** `?fgl=idle` skips the intro and `?fgl=letter` opens the envelope straight away. On the demo page
`?env=park|seaside|atelier|skies|lantern` switches worlds. Adding either
also keeps animations running in real time on slow software renderers.

### Field types

Short answer · long answer · email · phone (with country code) · link · number · currency · multiple choice
(list/grid/cards/picture choice, "Other") · checkboxes · dropdown · multiselect tags · yes/no · rating (stars,
hearts, circles, thumbs, flowers) · linear scale · NPS · slider · ranking (drag or buttons) · matrix · date · time ·
date & time · date range · file upload · image upload (previews, progress) · signature pad · colour · full name ·
address · country · consent · hidden (filled from `?param=`).

Content blocks: heading, rich text (highlight, colours, links, lists, alignment), image, video (YouTube, Vimeo,
mp4), quote, divider (line, dots, flourish, wave), spacer, page break.

Every field supports: required, help text, placeholder, width (full or half), per-field animation, validation
(length, range, pattern, selection count, file type and size) and **conditional logic** (show or hide when
all/any conditions match). Validation runs in both the browser and the API, using the same code from
`@formgl/shared`.

---

## Admin dashboard (`/admin`)

- **Passphrase login.** The session lives in Redis behind an httpOnly cookie. Login is rate limited.
- **Forms.** Search, status filter, stats and 11 templates: wedding RSVP, birthday wishes, event registration,
  customer feedback, job application, secret admirer, class reflection, volunteer sign-up, product waitlist,
  guest book, and blank.
- **Editor.**
  - **Build:** drag-and-drop fields, page separators, a properties panel and a logic builder.
  - **Design:** every theme option, uploads for the logo seal and cover image, and a live preview.
  - **Settings:** greeting, intro, labels, thank-you message, schedule, response limit, one reply per device,
    save progress, SEO.
  - **Share:** a custom slug with a live availability check, or the shortest free random slug (3 characters
    and up). Also a QR code, an embed snippet and a preview link.
  - Changes autosave.
- **Responses.**
  - A sortable, filterable table with column visibility and resizing, a sticky first column and bulk delete.
  - Rich cells show images in a lightbox, play video, and display file chips, signatures, colour swatches and
    star ratings.
  - A detail drawer shows metadata (IP, location, device, browser, OS, referrer, duration), notes and tags.
  - Export CSV, XLSX or JSON, or copy as TSV.
  - Cleaning tools: trim, change case, hide empty, date range, and find and delete duplicates.
- **Analytics.**
  - Views and unique visitors, open, start and completion rates, and average and median time to complete.
  - A funnel, activity over time, and breakdowns by hour and weekday.
  - A world map with country shading and visit dots, plus cities, referrers, devices, browsers and operating
    systems.
  - Page drop-off.
  - Per-question insights: distributions, mean, median and standard deviation, histograms, NPS, top words.
  - A tool to compare two questions: contingency tables, correlation and grouped means.
  - A raw visit log.

---

## API

NestJS on Express, under `/api`. The full contract is in [`docs/API.md`](docs/API.md).

- **Postgres (Drizzle ORM):** forms, responses, events, files. Migrations are in `apps/api/drizzle`.
- **Redis:** admin sessions, a 30-second public form cache, fixed-window rate limits.
- **S3:** uploads go through the API. `GET /api/files/*` streams them back with `Range` support, so videos can
  be seeked.
- **Analytics:** IP geolocation (CDN headers, then geoip-lite) and user-agent parsing. Tracked events: view,
  loaded, open, start, page, submit and abandon.

## Scripts

```bash
pnpm dev            # web + api in watch mode
pnpm build          # build everything (turbo)
pnpm typecheck
pnpm db:generate    # drizzle-kit: new migration after editing apps/api/src/db/schema.ts
```

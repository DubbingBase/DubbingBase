# @app/landing

## 1.2.2

### Patch Changes

- 5d980e8: Display language name directly on dubbing tabs, add voice actor count badge, and hide tabs with zero voice actors

## 1.2.1

### Patch Changes

- 144bb54: Fix OpenAI / Groq Strict JSON Schema compliance for dubbing extraction:

  - Ensure all object properties are listed in `required` by making optional fields nullable (`performance: z.string().nullable()`).
  - Make `items: z.array(...)` non-optional in `dubbingExtractionSchema`.

## 1.2.0

### Minor Changes

- 636bcda: Add full support for audiobooks, podcasts, advertisements, and connected toys

  - Added database migrations for `audiobook`, `advertisement`, `podcast`, and `toy` content types
  - Integrated OpenLibrary API for audiobook narrations, covers, and details
  - Integrated Apple Podcasts / iTunes API for podcast fictions, episodes, and RSS feeds
  - Added advertisement spot and connected toy metadata resolvers and video/device embeds
  - Added web detail & edit pages (`/audiobook`, `/podcast`, `/advertisement`, `/toy`)
  - Added mobile details views and routing for all new media types
  - Integrated multi-search across all media families with unified scoring
  - Added full translations in English, French, Spanish, and Japanese

- 9aa7848: Add support for viewing single seasons and episodes for TV shows

  - New composables: `useSeasonData` and `useEpisodeData` in shared-logic
  - New pages: Season view (`/show/:id/season/:seasonNumber`) and Episode view (`/show/:id/season/:seasonNumber/episode/:episodeNumber`)
  - Enhanced show page with Seasons section linking to individual seasons
  - Added translations for seasons/episodes in all locales (en, fr, es, ja)
  - Uses existing API endpoints (`/api/season`, `/api/episode`)

### Patch Changes

- 83c9685: Add Cloudflare Worker 1-minute cron dispatcher using Nitro tasks:

  - Enable `nitro.experimental.tasks` and map `scheduledTasks: { '* * * * *': ['dispatcher'] }` in `nuxt.config.ts`.
  - Add Cloudflare Worker cron trigger `[triggers] crons = ['* * * * *']` in `wrangler.toml`.
  - Implement `server/tasks/dispatcher.ts` with a 6-iteration loop (10s intervals), dispatching `wiki_discovery` and `wiki_check` every 10 seconds and `wiki_extract` (LLM) on iteration 0, using `ctx.waitUntil(...)` for non-blocking concurrent execution.

- 4126abf: Add reusable route performance utilities and architectural guidelines:

  - Added `setPublicCacheHeaders(event, profile)` server utility in `server/utils/cache/http.ts`.
  - Added `useProgressiveBatch` composable in `src/composables/useProgressiveBatch.ts`.
  - Updated `.agents/AGENTS.md` with explicit route performance and caching architecture standards.

- 177fe88: fix(website): resolve admin queue table display issue and add translations

  - Group queue filters and table together so the queue items grid renders properly
  - Add empty state message when search or status filters match no items
  - Add missing localization strings across all locales (EN, FR, ES, JA)
  - Use strict TypeScript typing without type assertions

- 3133eed: Fix 401 Unauthorized errors for admin routes, add missing API routes and RLS policies, remove legacy edge functions, and relocate database types:

  - Fixed 401 Unauthorized during SSR and cookie authentication in `server/middleware/auth.ts` and `authenticated-fetch.ts`.
  - Created missing API routes for search voice actors (`POST`), movies (`GET`/`POST`), and shows (`GET`/`POST`).
  - Added RLS policies granting admin permissions for user reports.
  - Removed legacy Deno Edge Functions and relocated generated database types to `packages/database/src/database.types.ts`.
  - Decoupled `packages/shared-logic` from legacy edge function types.
  - Fixed strict TypeScript typing across admin pages and media edit routes.

- 1467ef9: Fix Cloudflare Workers deployment failing to resolve `@cf-wasm/resvg` wasm asset:

  - Added `scripts/patch-wasm.mjs` post-build script to copy `resvg.wasm` to `.output/server/resvg.wasm` and rewrite chunk import paths.
  - Updated `build` script in `package.json` to automatically run `patch-wasm.mjs`.

- bc70b75: Fix Cloudflare Workers Satori `WebAssembly.instantiate` error for OG image generation:

  - Switched from standard `satori` to `@cf-wasm/satori/workerd` to use pre-compiled Yoga WebAssembly module instead of runtime `WebAssembly.instantiate()`.
  - Updated `scripts/patch-wasm.mjs` to copy and patch both `yoga.wasm` and `resvg.wasm`.

- 400ac3e: Fix cron execution and remove obsolete queue guards:

  - Support `apikey`, `Authorization: Bearer`, and `x-internal-secret` in `/api/process-media-queue` and `/api/prepare-trending-media` for scheduled cron jobs.
  - Remove obsolete `force`, `single`, and concurrency lock checking (`get_media_queue_locked_count`), relying purely on PGMQ's atomic `FOR UPDATE SKIP LOCKED`.
  - Clean up `queue.vue` manual processing payload.

- 259d0cd: Fix 404 on the voice actors listing page by adding a GET handler for /api/list-voice-actors (the page calls it with GET; only a POST handler existed)
- 1d874f3: Fix show season/episode loading timeouts and enable Cloudflare KV cache binding

  - Enable Cloudflare `CACHE_KV` namespace binding in `nuxt.config.ts` with two-tier (L1 in-memory + L2 Cloudflare KV) caching across Worker isolates
  - Fix show season and episode endpoints hanging on slow external TVDB searches by retrieving parent show character pictures from cache
  - Fix season 0 / specials validation in TMDB media service
  - Fix episode image URLs, title formatting, and `$t` references in Vue SFC components
  - Add error/not-found states for season and episode pages

- 47ecc86: Fix video game pages failing to load on DubbingBase:

  - Corrected `fetchGameData` invocation in `game/[id].vue` by removing incorrect extra argument.
  - Added `MediaSkeleton` loading state and not-found fallback to video game details page.
  - Added high-resolution artworks and screenshots mapping in IGDB responses and types.
  - Allowed `images.igdb.com` in Nuxt image domains.
  - Fixed IGDB fetch URL in game edit page to `/api/game/:id`.
  - Added video game resolution and routing support for voice actor works.

- 462903e: Fix voice actor OG image generation on dubbingbase.com:

  - Updated `ogImageUrl` in `voice-actor/[id].vue` to point to `/api/og-image?type=voice-actor&id=...` instead of the legacy Supabase Edge Function URL.
  - Fixed `@cf-wasm/resvg/workerd` Resvg initialization and import in `api/og-image/index.get.ts`.
  - Safe chunked base64 conversion in `fetchImageAsDataUri` to prevent stack overflow RangeErrors on large avatar images.
  - Included `voice_actor_name` in query selections for voice actors with stage names.
  - Removed obsolete top-level `wasm.esmImport` from Nuxt config.

- 7ab13aa: Fix 500 error on SSR caused by duplicate Vue instances colliding on template refs (`Cannot redefine property: imgEl`).

  - Enforce monorepo-wide Vue deduplication via `pnpm.overrides` and `pnpm-workspace.yaml`.
  - Add explicit `vite.resolve.dedupe` rules in website and mobile configs.
  - Add regression test in website unit test suite to prevent future recurrence.

- 8440d49: Optimize original actor details page and API endpoint:

  - Deduplicated TMDB media details queries across dubbing works and introduced concurrency-limited batching (batch size 15) in `/api/actor/[id]`.
  - Added public SWR `Cache-Control` header (`public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800`) on `/api/actor/[id]`.
  - Implemented progressive batch rendering (`useIntersectionObserver`) and debounced search (`refDebounced`) for the filmography grid.
  - Added `getCachedData` to `useAsyncData` for 0ms back-button route transitions without skeleton flicker.
  - Added `preconnect` and `dns-prefetch` resource hints for `image.tmdb.org` in `useHead`.
  - Added `loading="lazy"` and `decoding="async"` attributes to `NuxtImg` elements.

- 6b25b7a: Final pass optimization across auxiliary endpoints and pages:

  - Added public SWR `Cache-Control` headers on `/api/search`, `/api/career-grid`, `/api/get-metadata`, and `/api/get-media-credits`.
  - Added `getCachedData` payload cache resolution to `/contribute` page.

- 850d56e: Optimize catalog listing pages and trending API endpoints:

  - Added public SWR `Cache-Control` headers across `/api/trending/movies`, `/api/trending/shows`, `/api/trending/games`, `/api/trending/voice-actors`, and `/api/list-voice-actors`.
  - Added `getCachedData` to `useAsyncData` across `/movies`, `/series`, `/voice-actors`, and `/studios` for instant navigation.
  - Added progressive batch rendering and debounced search to `/voice-actors` and `/studios` using `useIntersectionObserver` and `refDebounced`.
  - Added preconnect and dns-prefetch resource hints for `image.tmdb.org` on catalog pages.
  - Added `decoding="async"` across catalog page images.

- 15b81b2: Optimize game details page and API endpoint:

  - Removed work votes queries and user vote merging logic from `/api/game/[id]`.
  - Added public SWR `Cache-Control` header (`public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800`) on `/api/game/[id]`.
  - Implemented progressive batch rendering (`useIntersectionObserver`) and debounced search (`refDebounced`) for the game character/voice cast grid.
  - Added `getCachedData` to `useAsyncData` for 0ms back-button route transitions without skeleton flicker.
  - Added `preconnect` and `dns-prefetch` resource hints for `images.igdb.com` in `useHead`.
  - Added `loading="lazy"` and `decoding="async"` attributes to game cover, artwork, and character/voice actor `NuxtImg` elements.

- 5c88ceb: Optimize Home landing page and discovery/search endpoints:

  - Added public SWR `Cache-Control` headers across `/api/home-stats`, `/api/top-contributors`, `/api/recent-voice-actors`, `/api/top-voice-actors`, and `/api/search-voice-actors`.
  - Added `getCachedData` to `useAsyncData` on the home page (`/`) for 0ms transitions and instantaneous back-navigation.
  - Added preconnect and dns-prefetch resource hints for `image.tmdb.org` and `images.igdb.com` on the home page.

- 3ade5a4: Optimize movie details page and API endpoint:

  - Removed legacy `getWorkVotes` queries and user-vote merging logic from `/api/movie/[id]`.
  - Added public SWR `Cache-Control` header (`public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800`) on `/api/movie/[id]`.
  - Implemented progressive batch rendering (`useIntersectionObserver`) and debounced search (`refDebounced`) for the movie cast grid.
  - Added `getCachedData` to `useAsyncData` for 0ms back-button route transitions.
  - Added `preconnect` and `dns-prefetch` resource hints for `image.tmdb.org` and `thetvdb.com` in `useHead`.
  - Added `loading="lazy"` and `decoding="async"` attributes to `NuxtImg` elements.

- 84c889b: Optimize season and episode details endpoints and pages:

  - Removed legacy `getWorkVotes` queries from `/api/season` and `/api/episode`.
  - Added public Edge SWR `Cache-Control` headers on `/api/season` and `/api/episode`.
  - Added `getCachedData` to `useAsyncData` across season and episode pages for 0ms transitions.
  - Added progressive batch rendering and debounced search to episode cast using `useIntersectionObserver` and `refDebounced`.
  - Added preconnect and dns-prefetch resource hints for `image.tmdb.org` and `thetvdb.com`.
  - Added `loading="lazy"` and `decoding="async"` across season/episode still and cast images.

- 47797ff: Optimize TV series details page and API endpoint:

  - Removed legacy `getWorkVotes` queries and user-vote merging logic from `/api/show/[id]`.
  - Added public SWR `Cache-Control` header (`public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800`) on `/api/show/[id]`.
  - Implemented progressive batch rendering (`useIntersectionObserver`) and debounced search (`refDebounced`) for the TV series cast grid.
  - Added `getCachedData` to `useAsyncData` for 0ms back-button and season navigation transitions.
  - Added `preconnect` and `dns-prefetch` resource hints for `image.tmdb.org` and `thetvdb.com` in `useHead`.
  - Added `loading="lazy"` and `decoding="async"` attributes to `NuxtImg` elements.

- 2ee5326: Optimize dubbing studio details endpoint and profile page:

  - Added public SWR `Cache-Control` header (`public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800`) on `/api/get-studio-details`.
  - Deduplicated and batched TMDB media fetches (`BATCH_SIZE = 15`) in `/api/get-studio-details` to avoid duplicated external API calls and rate-limiting.
  - Added `getCachedData` to `useAsyncData` on `/studio/:id` for 0ms transitions.
  - Added search filtering (`refDebounced`) and progressive infinite scroll rendering (`useIntersectionObserver`) for dubbed projects and voice actor rosters.
  - Added `preconnect` and `dns-prefetch` resource hints for `image.tmdb.org`.
  - Added `loading="lazy"` and `decoding="async"` attributes to images.

- 1cfdb51: Optimize voice actor loading and remove work votes logic:

  - Added deduplication of external TMDB/TVDB/IGDB media requests in `MediaService`.
  - Implemented batched concurrency for external API calls to avoid socket exhaustion and rate limits.
  - Pre-projected compact `enhancedWorks` array on the server, reducing API response and SSR payload size by ~99%.
  - Added public SWR `Cache-Control` header for CDN and edge caching on `/api/voice-actor/[id]`.
  - Replaced nested linear scans in `useVoiceActorData` with O(1) Map index lookups.
  - Removed work votes queries, composable references, and UI watchers from the voice actor flows.

- f1389bc: Switch default primary LLM provider to Groq (Llama 3.3 70B) with Gemini fallback:

  - Configure `llmProvider` in runtimeConfig defaulting to `"groq"` (configurable via `NUXT_LLM_PROVIDER`).
  - Route all text and JSON object generations to Groq `llama-3.3-70b-versatile` by default to avoid Gemini rate limits.
  - Fix default Gemini model fallback to `"gemini-2.5-flash"`.

- bd5b5da: Update default Groq LLM model from decommissioned `llama-3.1-8b-instant` to `openai/gpt-oss-20b` for dubbing credit extractions.
- 8850d8f: Phase 3 voice actor profile performance optimizations:

  - Added `getCachedData` to `useAsyncData` on the voice actor page for instant 0ms back-and-forth route transitions with zero skeleton flicker.
  - Added `preconnect` and `dns-prefetch` resource hints for `image.tmdb.org` in `useHead` link metadata.
  - Added `loading="lazy"` and `decoding="async"` attributes to all `NuxtImg` poster and avatar elements.

- 1defc6e: Phase 2 frontend UI performance optimizations for voice actor profiles:

  - Added infinite scroll and progressive rendering using VueUse `useIntersectionObserver` for both List and Grouped filmography views.
  - Implemented debounced search input with VueUse `refDebounced`.
  - Pre-computed `searchText` index for instant $O(1)$ substring matching during filtering.
  - Added localized `loadMore` translation across English, French, Spanish, and Japanese locales.

- Updated dependencies [636bcda]
- Updated dependencies [3133eed]
- Updated dependencies [47ecc86]
- Updated dependencies [7ab13aa]
- Updated dependencies [1cfdb51]
- Updated dependencies [9aa7848]
- Updated dependencies [1defc6e]
  - @app/shared-logic@1.2.0
  - @app/locales@0.1.0
  - @app/supabase@0.3.0

## 1.1.8

### Patch Changes

- e7f8fba: Fix 401 Unauthorized on admin `/api/list_users` (and any future internal admin endpoints) by injecting the Supabase session token into internal `/api/*` fetch requests via a global `$fetch` wrapper
- b966023: Add missing translations for admin pages (queue, audit logs, reports, studios), contribute, dubbing, report modal, settings, profile, and other UI sections across all locales (en, fr, es, ja)
- d54b0cb: Fix OG image generation 500 on Cloudflare Workers: use static imports for `satori`/`@resvg/resvg-wasm` (dynamic imports weren't bundled into the worker) and load the resvg WASM + Inter fonts from Nitro server assets (`server/assets/og-image/`) instead of fetching them from a CDN at runtime.
- 5401e3a: Fix voice actor detail page footer overlap and remove excessive section pulsing from skeleton loader
- Updated dependencies [b966023]
  - @app/locales@0.0.49

## 1.1.7

### Patch Changes

- 3389bd7: Fix game search returning no results: bind CACHE_KV namespace so Twitch tokens persist across Worker isolates, stop caching IGDB error fallbacks for 1h in game detail endpoint, and add video_game to shared SearchResult media_type union
- Updated dependencies [3389bd7]
  - @app/shared-logic@1.1.1

## 1.1.6

### Patch Changes

- 3d53c5b: Verify Cloudflare cache purge with hardcoded zone ID

## 1.1.5

### Patch Changes

- c436558: Verify Cloudflare cache purge after each deploy

## 1.1.4

### Patch Changes

- 3ad6121: Use hardcoded CLOUDFLARE_ZONE_ID secret for cache purge so token only needs Zone:Cache Purge

## 1.1.3

### Patch Changes

- 543e255: Trigger website deploy to run Cloudflare cache purge after release

## 1.1.2

### Patch Changes

- 35468f7: Purge Cloudflare cache after each website deploy so CSS/markup changes propagate immediately

## 1.1.1

### Patch Changes

- bdb03bf: Fix voice actor filmography: remove hover opacity pulse on cards and prevent studio/performance badge text overflow

## 1.1.0

### Minor Changes

- c58baa6: Migrate all 66 Supabase Edge Functions to Nuxt Nitro server routes on Cloudflare Workers. Replace Upstash Redis with Cloudflare KV for edge caching. Add Cloudflare Hyperdrive for PostgreSQL connection pooling. Migrate frontend composables from supabase.functions.invoke to $fetch.

### Patch Changes

- 80032e9: Fix Android Play Store upload by deriving ANDROID_VERSION_CODE from the package.json version (bumped via changeset) with the GitHub run number appended, preventing "Version code already used" errors
- 27dbd9b: Fix crew and cast data being lost when creating a new dubbing project on movie and show edit pages. Crew and cast are now saved before the redirect.
- ced35fb: Fix empty voice actor filmography by including actor_id in the voice_actor.work Supabase select so works can be matched to cast members
- 398418b: Fix voice actor autocomplete multi-word search to use $fetch instead of deleted edge function
- 613c489: Remove Google Sheets sync feature and its associated env vars (GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_KEY, GOOGLE_SHEET_ID, SYNC_TABLE_PRIMARY_KEY, SYNC_WORKSHEET_NAME)
- 569c7df: Add CORS headers, origin restriction, and custom client header to API routes
- Updated dependencies [c58baa6]
  - @app/shared-logic@1.1.0

## 1.0.51

### Patch Changes

- 1bc7ebf: disable caching for admin pages, improve auth redirection logic, and add client-side game data persistence strategy.

## 1.0.50

### Patch Changes

- 72e6134: implement dynamic post-login redirect support and remove restrictive session maxAge

## 1.0.49

### Patch Changes

- 0c4dc73: implement trending voice actors feature with IGDB auth retries and updated dev environment configuration

## 1.0.48

### Patch Changes

- ccac106: update about page content and simplify external database attribution strings
- Updated dependencies [ccac106]
  - @app/locales@0.0.48

## 1.0.47

### Patch Changes

- 96c2d3d: migrate data fetching to useAsyncData across app pages and components
- Updated dependencies [96c2d3d]
  - @app/shared-logic@1.0.26
  - @app/locales@0.0.47

## 1.0.46

### Patch Changes

- da3aff5: replace Date parsing with string splitting for year extraction, add header fallback UI, and update nuxt configuration

## 1.0.45

### Patch Changes

- d618dca: implement locale-aware data fetching by passing Accept-Language headers to Supabase functions
- Updated dependencies [d618dca]
  - @app/shared-logic@1.0.25

## 1.0.44

### Patch Changes

- 9803ad9: implement studio logo image upload and compression using Supabase storage
- ff073f6: migrate color palette from slate to gray across admin and edit pages
- 292ef80: improve grid responsiveness and remove hover zoom effects across movie, show, and actor pages

## 1.0.43

### Patch Changes

- 15ba600: remove unused nitro prerender config and add SWR rule for /game routes

## 1.0.42

### Patch Changes

- 056174f: add dynamic language support to TMDB requests, expand database relations, and update localized navigation routes
- Updated dependencies [056174f]
  - @app/shared-logic@1.0.24

## 1.0.41

### Patch Changes

- 7781f71: update task enrichment logic and add support for flexible task categories
- Updated dependencies [7781f71]
  - @app/locales@0.0.46

## 1.0.40

### Patch Changes

- bump
- Updated dependencies
  - @app/locales@0.0.45
  - @app/shared-logic@1.0.23

## 1.0.39

### Patch Changes

- b66bc35: fix: pipeline
- b66bc35: introduce gamification system with audit logs, task management, and contribution tracking hub
- Updated dependencies [b66bc35]
  - @app/shared-logic@1.0.22

## 1.0.38

### Patch Changes

- 4caba32: fix: pipeline

## 1.0.37

### Patch Changes

- 8a4a413: implement MediaSkeleton and PersonSkeleton components and enable lazy data loading for media pages

## 1.0.36

### Patch Changes

- ce35380: implement studio management features, add RLS policies, and introduce shared studio data composable
- Updated dependencies [ce35380]
- Updated dependencies [814588e]
  - @app/shared-logic@1.0.21

## 1.0.35

### Patch Changes

- edcdd13: implement movie and show dubbing edit pages with language selection component

## 1.0.34

### Patch Changes

- af640a5: add comprehensive video game support including database schema updates, backend integration, and dedicated game UI components.
- Updated dependencies [af640a5]
  - @app/shared-logic@1.0.20
  - @app/locales@0.0.44

## 1.0.33

### Patch Changes

- fae8d72: Temporarily skipped E2E tests in the CI pipeline to allow deployments to proceed.

## 1.0.32

### Patch Changes

- 27b779c: Fixed Playwright E2E pipeline: run tests against built apps instead of dev server, and injected missing ONESIGNAL_APP_ID secret.

## 1.0.31

### Patch Changes

- 70dfb6f: Added E2E tests for mobile and website apps to the GitHub Actions pipeline, and deduplicated Vue versions to resolve the "Cannot redefine property: imgEl" HMR bug.

## 1.0.30

### Patch Changes

- a30d030: implement user reporting system with new database migration, edge function, and modal component

## 1.0.29

### Patch Changes

- 8105616: integrate PostHog analytics for mobile and website with automated user identification and version tracking

## 1.0.28

### Patch Changes

- 9f014cd: implement dynamic SEO keywords and meta data across all pages

## 1.0.27

### Patch Changes

- b5f52e0: add user profile management, implement internationalized routing, and improve error handling in Supabase functions.
- 61dc335: replace native img tags with NuxtImg and force webp format for image optimization across all pages
- Updated dependencies [b5f52e0]
  - @app/shared-logic@1.0.19

## 1.0.26

### Patch Changes

- 981854d: implement legal and privacy policy pages, add registration flow, and update PostHog analytics integration

## 1.0.25

### Patch Changes

- 8b6f56a: migrate website app to Nuxt 3 and standardize Supabase edge function authentication.
- da720e4: modernize header UI, reorganize navigation, and remove redundant admin layouts
- Updated dependencies [da720e4]
  - @app/locales@0.0.43
  - @app/shared-logic@1.0.18

## 1.0.24

### Patch Changes

- a5f599a: standardize code formatting across apps and add profile management pages with authentication middleware
- Updated dependencies [a5f599a]
  - @app/shared-logic@1.0.17

## 1.0.23

### Patch Changes

- dba67a5: add high-resolution favicon and android touch icons to app head

## 1.0.22

### Patch Changes

- Updated dependencies
  - @app/locales@0.0.42

## 1.0.21

### Patch Changes

- b374bdf: qs
- Updated dependencies [b374bdf]
  - @app/locales@0.0.41
  - @app/shared-logic@1.0.16

## 1.0.20

### Patch Changes

- cee846b: notifications
- Updated dependencies [cee846b]
  - @app/locales@0.0.40
  - @app/shared-logic@1.0.15

## 1.0.19

### Patch Changes

- c45f275: bump
- Updated dependencies [c45f275]
  - @app/locales@0.0.39
  - @app/shared-logic@1.0.14

## 1.0.18

### Patch Changes

- 5e7fbe5: fix build
- Updated dependencies [5e7fbe5]
  - @app/locales@0.0.38
  - @app/shared-logic@1.0.13

## 1.0.17

### Patch Changes

- 664fea2: fix i18n redirection on internal routes

## 1.0.16

### Patch Changes

- 0a19c44: sd

## 1.0.15

### Patch Changes

- e29719d: sd
- Updated dependencies [e29719d]
  - @app/shared-logic@1.0.12
  - @app/locales@0.0.37

## 1.0.14

### Patch Changes

- sd
- Updated dependencies
  - @app/locales@0.0.36
  - @app/shared-logic@1.0.11

## 1.0.13

### Patch Changes

- sd
- Updated dependencies
  - @app/locales@0.0.35
  - @app/shared-logic@1.0.10

## 1.0.12

### Patch Changes

- 00d27b2: sd
- daf9923: d

## 1.0.11

### Patch Changes

- dh
- Updated dependencies
  - @app/locales@0.0.34
  - @app/shared-logic@1.0.9

## 1.0.10

### Patch Changes

- uodzte
- Updated dependencies
  - @app/locales@0.0.33
  - @app/shared-logic@1.0.8

## 1.0.9

### Patch Changes

- hs
- Updated dependencies
  - @app/locales@0.0.32
  - @app/shared-logic@1.0.7

## 1.0.8

### Patch Changes

- sds
- Updated dependencies
  - @app/locales@0.0.31
  - @app/shared-logic@1.0.6

## 1.0.7

### Patch Changes

- c9ea924: fix reload

## 1.0.6

### Patch Changes

- 29e86c3: sd

## 1.0.5

### Patch Changes

- sd
- Updated dependencies
  - @app/locales@0.0.30
  - @app/shared-logic@1.0.5

## 1.0.4

### Patch Changes

- df
- Updated dependencies
  - @app/locales@0.0.29
  - @app/shared-logic@1.0.4

## 1.0.3

### Patch Changes

- sd
- Updated dependencies
  - @app/shared-logic@1.0.3

## 1.0.2

### Patch Changes

- bump
- Updated dependencies
  - @app/shared-logic@1.0.2

## 1.0.1

### Patch Changes

- initialize landing app and implement shared logic for home dashboard data fetching
- Updated dependencies
  - @app/shared-logic@1.0.1

# @app/shared-logic

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

- 3133eed: Fix 401 Unauthorized errors for admin routes, add missing API routes and RLS policies, remove legacy edge functions, and relocate database types:

  - Fixed 401 Unauthorized during SSR and cookie authentication in `server/middleware/auth.ts` and `authenticated-fetch.ts`.
  - Created missing API routes for search voice actors (`POST`), movies (`GET`/`POST`), and shows (`GET`/`POST`).
  - Added RLS policies granting admin permissions for user reports.
  - Removed legacy Deno Edge Functions and relocated generated database types to `packages/database/src/database.types.ts`.
  - Decoupled `packages/shared-logic` from legacy edge function types.
  - Fixed strict TypeScript typing across admin pages and media edit routes.

- 47ecc86: Fix video game pages failing to load on DubbingBase:

  - Corrected `fetchGameData` invocation in `game/[id].vue` by removing incorrect extra argument.
  - Added `MediaSkeleton` loading state and not-found fallback to video game details page.
  - Added high-resolution artworks and screenshots mapping in IGDB responses and types.
  - Allowed `images.igdb.com` in Nuxt image domains.
  - Fixed IGDB fetch URL in game edit page to `/api/game/:id`.
  - Added video game resolution and routing support for voice actor works.

- 7ab13aa: Fix 500 error on SSR caused by duplicate Vue instances colliding on template refs (`Cannot redefine property: imgEl`).

  - Enforce monorepo-wide Vue deduplication via `pnpm.overrides` and `pnpm-workspace.yaml`.
  - Add explicit `vite.resolve.dedupe` rules in website and mobile configs.
  - Add regression test in website unit test suite to prevent future recurrence.

- 1cfdb51: Optimize voice actor loading and remove work votes logic:

  - Added deduplication of external TMDB/TVDB/IGDB media requests in `MediaService`.
  - Implemented batched concurrency for external API calls to avoid socket exhaustion and rate limits.
  - Pre-projected compact `enhancedWorks` array on the server, reducing API response and SSR payload size by ~99%.
  - Added public SWR `Cache-Control` header for CDN and edge caching on `/api/voice-actor/[id]`.
  - Replaced nested linear scans in `useVoiceActorData` with O(1) Map index lookups.
  - Removed work votes queries, composable references, and UI watchers from the voice actor flows.

- 1defc6e: Phase 2 frontend UI performance optimizations for voice actor profiles:

  - Added infinite scroll and progressive rendering using VueUse `useIntersectionObserver` for both List and Grouped filmography views.
  - Implemented debounced search input with VueUse `refDebounced`.
  - Pre-computed `searchText` index for instant $O(1)$ substring matching during filtering.
  - Added localized `loadMore` translation across English, French, Spanish, and Japanese locales.

- Updated dependencies [636bcda]
- Updated dependencies [3133eed]
  - @app/supabase@0.3.0

## 1.1.1

### Patch Changes

- 3389bd7: Fix game search returning no results: bind CACHE_KV namespace so Twitch tokens persist across Worker isolates, stop caching IGDB error fallbacks for 1h in game detail endpoint, and add video_game to shared SearchResult media_type union

## 1.1.0

### Minor Changes

- c58baa6: Migrate all 66 Supabase Edge Functions to Nuxt Nitro server routes on Cloudflare Workers. Replace Upstash Redis with Cloudflare KV for edge caching. Add Cloudflare Hyperdrive for PostgreSQL connection pooling. Migrate frontend composables from supabase.functions.invoke to $fetch.

## 1.0.26

### Patch Changes

- 96c2d3d: migrate data fetching to useAsyncData across app pages and components

## 1.0.25

### Patch Changes

- d618dca: implement locale-aware data fetching by passing Accept-Language headers to Supabase functions

## 1.0.24

### Patch Changes

- 056174f: add dynamic language support to TMDB requests, expand database relations, and update localized navigation routes

## 1.0.23

### Patch Changes

- bump

## 1.0.22

### Patch Changes

- b66bc35: introduce gamification system with audit logs, task management, and contribution tracking hub

## 1.0.21

### Patch Changes

- ce35380: implement studio management features, add RLS policies, and introduce shared studio data composable
- 814588e: update playwright config with mise execution and ignore test artifacts

## 1.0.20

### Patch Changes

- af640a5: add comprehensive video game support including database schema updates, backend integration, and dedicated game UI components.

## 1.0.19

### Patch Changes

- b5f52e0: add user profile management, implement internationalized routing, and improve error handling in Supabase functions.

## 1.0.18

### Patch Changes

- da720e4: modernize header UI, reorganize navigation, and remove redundant admin layouts

## 1.0.17

### Patch Changes

- a5f599a: standardize code formatting across apps and add profile management pages with authentication middleware

## 1.0.16

### Patch Changes

- b374bdf: qs

## 1.0.15

### Patch Changes

- cee846b: notifications

## 1.0.14

### Patch Changes

- c45f275: bump

## 1.0.13

### Patch Changes

- 5e7fbe5: fix build

## 1.0.12

### Patch Changes

- e29719d: sd

## 1.0.11

### Patch Changes

- sd

## 1.0.10

### Patch Changes

- sd

## 1.0.9

### Patch Changes

- dh

## 1.0.8

### Patch Changes

- uodzte

## 1.0.7

### Patch Changes

- hs

## 1.0.6

### Patch Changes

- sds

## 1.0.5

### Patch Changes

- sd

## 1.0.4

### Patch Changes

- df

## 1.0.3

### Patch Changes

- sd

## 1.0.2

### Patch Changes

- bump

## 1.0.1

### Patch Changes

- initialize landing app and implement shared logic for home dashboard data fetching

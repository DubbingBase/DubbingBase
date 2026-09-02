# DB Cleanup — Option 1: Composite Source Key for `dubbing_projects`

> Replaces `content_id bigint` with composite `(source, source_id)` so every external/internal namespace is isolated at the schema level.

---

## Why

`dubbing_projects.content_id` currently conflates IDs from fundamentally different namespaces:

- TMDB movie IDs (~10k–700k)
- TMDB TV IDs (~100k–200k)
- IGDB game IDs (millions)
- OpenLibrary keys (`OL...`) — already not pure bigint-compatible
- iTunes podcast IDs
- Internal ad/toy IDs

The current `9000` band-aid, then negative-ID hack, then any future fix all treat the symptom. The disease is a single bigint column holding heterogeneous values.

---

## Migration

```sql
-- Migration: YYYYMMDD_composite_source_key.sql

-- 1. Add new columns
ALTER TABLE public.dubbing_projects
  ADD COLUMN source text NOT NULL DEFAULT 'tmdb',
  ADD COLUMN source_id text NOT NULL DEFAULT '0';

-- 2. Backfill source from content_type
UPDATE public.dubbing_projects SET source = 'tmdb'       WHERE content_type IN ('movie', 'tv');
UPDATE public.dubbing_projects SET source = 'igdb'       WHERE content_type = 'video_game';
UPDATE public.dubbing_projects SET source = 'openlibrary' WHERE content_type = 'audiobook';
UPDATE public.dubbing_projects SET source = 'itunes'     WHERE content_type = 'podcast';
UPDATE public.dubbing_projects SET source = 'internal'   WHERE content_type IN ('advertisement', 'toy');

-- 3. Backfill source_id from content_id (text to support ISBN, OL-prefix, future UUIDs)
UPDATE public.dubbing_projects SET source_id = content_id::text;

-- 4. Drop PK and re-add as composite
ALTER TABLE public.dubbing_projects DROP CONSTRAINT dubbing_projects_pkey;
ALTER TABLE public.dubbing_projects
  ADD PRIMARY KEY (source, source_id);

-- 5. Add CHECK on source values
ALTER TABLE public.dubbing_projects
  ADD CONSTRAINT dubbing_projects_source_check
  CHECK (source IN ('tmdb', 'igdb', 'openlibrary', 'itunes', 'internal'));

-- 6. Drop content_id (now redundant)
ALTER TABLE public.dubbing_projects DROP COLUMN content_id;

-- 7. Replace idx_dubbing_projects_type_content (was on content_type, content_id)
DROP INDEX IF EXISTS public.idx_dubbing_projects_type_content;
CREATE INDEX idx_dubbing_projects_type_source
  ON public.dubbing_projects (content_type, source, source_id);
```

---

## Code Changes (estimated ~20 files)

### Server APIs (queries against `dubbing_projects`)

For each file, replace `content_id` references with `(source, source_id)`:

| File                                                  | Change                                                         |
| ----------------------------------------------------- | -------------------------------------------------------------- |
| `server/api/get-dubbing-project.get.ts:22`            | `.or("...")` → use `source` + `source_id`                      |
| `server/api/notify-subscribers.post.ts:36,49`         | project lookup by composite                                    |
| `server/api/prepare-trending-media.post.ts:91,92,102` | trending join                                                  |
| `server/api/process-credits.post.ts:82,91`            | insert + lookup                                                |
| `server/api/save-dubbing-project.post.ts:11,14`       | payload shape                                                  |
| `server/api/trending/voice-actors.get.ts:56,58`       | join filter                                                    |
| `server/api/update-review-status.post.ts:82`          | join lookup                                                    |
| `server/api/get-studio-details.get.ts:90,166`         | dedup key                                                      |
| `server/api/career-grid.get.ts:661`                   | join                                                           |
| `server/api/get-user-voice-actor.ts:118,142`          | join + insert                                                  |
| `server/api/actor/[id].get.ts:56,99`                  | join                                                           |
| `server/api/internal-media-create.post.ts`            | drop the `-1`/`9000` ID generator entirely; `source_id = uuid` |
| `server/api/internal-media-metadata.get.ts`           | return `source` + `source_id` in response                      |
| `server/api/internal-media-credits.get.ts`            | no schema change needed                                        |
| `server/api/link-voice-actor.post.ts`                 | use composite in `findOrCreateDubbingProject`                  |
| `server/utils/db/dubbing-project.ts`                  | signature change: `findOrCreate(source, source_id, ...)`       |

### Mobile app

| File                              | Change                                           |
| --------------------------------- | ------------------------------------------------ |
| `apps/mobile/src/types/models.ts` | type definition: `DubbingProject.source: string` |

### Database types regen

```bash
supabase gen types typescript --local > packages/database/src/database.types.ts
```

---

## Coupling with Existing Plan

This Option 1 subsumes the following tasks from `db-cleanup-plan.md`:

- **Task 1** (drop `work.content_id`/`content_type`) — still needed, separate concern
- **Task 2** (`actor_id` NULL) — still needed
- **Task 3** (ENUM on `content_type`) — also add ENUM on `source`
- **Task 7** (work_unique constraint) — easier with composite keys

It also obsoletes:

- The `-1` content_id hack in `internal-media-create.post.ts`
- The `9000` magic number
- The `idx_dubbing_projects_type_content` index (replaced)

---

## Risks

- **Type regen mandatory** — every TS file that touches `dubbing_projects` will fail to compile until types are regenerated.
- **Existing rows have `content_id` as their unique key** — backfill must be lossless.
- **External API clients (TMDB, IGDB) return numeric IDs as numbers** — must cast to string before insert.
- **Apps store `content_id` in local storage / URLs** — search-and-replace pass on mobile + website routes.
- **Rollback is hard** — once `content_id` is dropped, you can't easily revert without a backup.

---

## Verification

- [ ] `supabase db reset` runs cleanly with the migration
- [ ] `supabase gen types typescript` produces clean types
- [ ] `nuxt typecheck` passes
- [ ] `deno check` on edge functions passes
- [ ] Browser smoke: create ad, create toy, link voice actor, view dubbing project
- [ ] Mobile smoke: same flows on iOS/Android
- [ ] No query that read `content_id` remains in the codebase (grep)

---

## Estimated Effort

- Migration: 1 file, ~30 lines SQL
- Code changes: ~20 files, ~3-5 hours of careful refactor
- Testing: 1-2 hours
- **Total: ~1 working day**

---

## Out of Scope (deferred)

- Splitting `dubbing_projects` into `media` + `dubbing_projects` (Option 2 from brainstorm)
- Adding `attraction` / `station_imaging` / `web_video` / `voice_identity` types (separate work)
- `character_id` propagation (TODO line 12)

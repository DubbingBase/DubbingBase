# dubbing-base-monorepo — Overview

> **Navigation aid.** This article shows WHERE things live (routes, models, files). Read actual source files before implementing new features or making changes.

**dubbing-base-monorepo** is a typescript project built with nuxt, organized as a monorepo.

**Workspaces:** `@app/website` (`apps/website`), `@app/supabase` (`packages/database`), `@app/locales` (`packages/locales`), `@app/og-image` (`packages/og-image`), `@app/shared-logic` (`packages/shared-logic`)

## Scale

67 API routes · 28 database models · 143 UI components · 131 library files · 14 middleware layers · 59 environment variables

## Subsystems

- **[[id].get](./[id].get.md)** — 11 routes — touches: auth, cache, queue
- **[[id].put](./[id].put.md)** — 1 routes — touches: auth
- **[About-preference.get](./about-preference.get.md)** — 1 routes
- **[Admin](./admin.md)** — 5 routes — touches: auth, queue, cache
- **[Career-grid.get](./career-grid.get.md)** — 1 routes
- **[Character-images.get](./character-images.get.md)** — 1 routes — touches: cache
- **[Count-voice-actor-works.post](./count-voice-actor-works.post.md)** — 1 routes
- **[Dashboard-stats.get](./dashboard-stats.get.md)** — 1 routes — touches: auth
- **[Delete_user.post](./delete_user.post.md)** — 1 routes — touches: auth
- **[Detail-collections.get](./detail-collections.get.md)** — 1 routes
- **[Find_duplicate_voice_actors.get](./find_duplicate_voice_actors.get.md)** — 1 routes — touches: auth
- **[Game-characters.post](./game-characters.post.md)** — 1 routes — touches: auth
- **[Games.get](./games.get.md)** — 1 routes — touches: cache
- **[Get-random-task.get](./get-random-task.get.md)** — 1 routes
- **[Get-random-task.post](./get-random-task.post.md)** — 1 routes — touches: auth
- **[Get-studio-details.get](./get-studio-details.get.md)** — 1 routes
- **[Home-stats.get](./home-stats.get.md)** — 1 routes
- **[Index.get](./index.get.md)** — 4 routes — touches: cache, db
- **[Internal-media-create.post](./internal-media-create.post.md)** — 1 routes — touches: auth
- **[Internal-media-credits.get](./internal-media-credits.get.md)** — 1 routes
- **[Link-user-voice-actor.post](./link-user-voice-actor.post.md)** — 1 routes — touches: auth
- **[Link-voice-actor.post](./link-voice-actor.post.md)** — 1 routes — touches: auth
- **[List-voice-actors.get](./list-voice-actors.get.md)** — 1 routes
- **[List_users.get](./list_users.get.md)** — 1 routes — touches: auth
- **[Media-catalog.get](./media-catalog.get.md)** — 1 routes — touches: db
- **[Media-queue.post](./media-queue.post.md)** — 1 routes — touches: auth, queue
- **[Merge_voice_actor_duplicates.post](./merge_voice_actor_duplicates.post.md)** — 1 routes — touches: auth
- **[Movies.get](./movies.get.md)** — 1 routes — touches: cache
- **[Prepare-trending-media.post](./prepare-trending-media.post.md)** — 1 routes — touches: auth, queue
- **[Prepare_game.post](./prepare_game.post.md)** — 1 routes — touches: auth
- **[Process-media-queue.post](./process-media-queue.post.md)** — 1 routes — touches: auth, cache, queue
- **[Recent-voice-actors.get](./recent-voice-actors.get.md)** — 1 routes
- **[Revert-task.post](./revert-task.post.md)** — 1 routes — touches: auth, db
- **[Save-dubbing-project.post](./save-dubbing-project.post.md)** — 1 routes — touches: auth
- **[Save-metadata.post](./save-metadata.post.md)** — 1 routes — touches: auth
- **[Save-studio.post](./save-studio.post.md)** — 1 routes — touches: auth
- **[Save-toy-metadata.post](./save-toy-metadata.post.md)** — 1 routes — touches: auth
- **[Search-voice-actors.get](./search-voice-actors.get.md)** — 1 routes
- **[Shows.get](./shows.get.md)** — 1 routes — touches: cache
- **[Sitemap.xml](./sitemap.xml.md)** — 1 routes
- **[Sitemaps](./sitemaps.md)** — 2 routes
- **[Submit-task.post](./submit-task.post.md)** — 1 routes — touches: auth, db, upload
- **[Submit-user-report.post](./submit-user-report.post.md)** — 1 routes — touches: auth, db
- **[Top-contributors.get](./top-contributors.get.md)** — 1 routes
- **[Top-voice-actors.get](./top-voice-actors.get.md)** — 1 routes
- **[Update-voice-actor.post](./update-voice-actor.post.md)** — 1 routes — touches: auth, upload
- **[Update_user_role.post](./update_user_role.post.md)** — 1 routes — touches: auth
- **[Upload-profile-picture.post](./upload-profile-picture.post.md)** — 1 routes — touches: auth, db, upload
- **[Voice-actors.get](./voice-actors.get.md)** — 1 routes

**Database:** unknown, 28 models — see [database.md](./database.md)

**UI:** 143 components (vue) — see [ui.md](./ui.md)

**Libraries:** 131 files — see [libraries.md](./libraries.md)

## High-Impact Files

Changes to these files have the widest blast radius across the codebase:

- `apps/website/server/utils/db/client.ts` — imported by **54** files
- `apps/website/server/utils/index.ts` — imported by **28** files
- `apps/website/server/utils/auth-handlers.ts` — imported by **23** files
- `apps/website/server/utils/cache/index.ts` — imported by **20** files
- `apps/website/server/utils/api/igdb.ts` — imported by **13** files
- `packages/shared-logic/src/types/index.ts` — imported by **12** files

## Required Environment Variables

- `CI` — `playwright.config.ts`
- `DISCORD_ADMIN_WEBHOOK_LOG_URL` — `.env.example`
- `DISCORD_CHECK_WEBHOOK_URL` — `apps/website/server/utils/notifications/discord.ts`
- `DISCORD_DISCOVERY_WEBHOOK_URL` — `apps/website/server/utils/notifications/discord.ts`
- `DISCORD_EXTRACT_WEBHOOK_URL` — `apps/website/server/utils/notifications/discord.ts`
- `DISCORD_NOTIFY_ROUTINE` — `apps/website/server/utils/notifications/discord.ts`
- `DISCORD_WEBHOOK_CHECK_URL` — `apps/website/server/utils/notifications/discord.ts`
- `DISCORD_WEBHOOK_DISCOVERY_URL` — `apps/website/server/utils/notifications/discord.ts`
- `DISCORD_WEBHOOK_EXTRACT_URL` — `apps/website/server/utils/notifications/discord.ts`
- `DISCORD_WEBHOOK_URL` — `apps/website/server/utils/notifications/discord.ts`
- `DISCORD_WEBHOOK_URL_1` — `apps/website/server/utils/notifications/discord.ts`
- `DISCORD_WEBHOOK_URL_2` — `apps/website/server/utils/notifications/discord.ts`
- _...28 more_

---
_Back to [index.md](./index.md) · Generated 2026-11-16_
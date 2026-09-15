# dubbing-base-monorepo — Overview

> **Navigation aid.** This article shows WHERE things live (routes, models, files). Read actual source files before implementing new features or making changes.

**dubbing-base-monorepo** is a typescript project built with nuxt, organized as a monorepo.

**Workspaces:** `@app/mobile` (`apps/mobile`), `@app/website` (`apps/website`), `@app/supabase` (`packages/database`), `@app/locales` (`packages/locales`), `@app/og-image` (`packages/og-image`), `@app/shared-logic` (`packages/shared-logic`)

## Scale

75 API routes · 16 database models · 195 UI components · 77 library files · 12 middleware layers · 63 environment variables

## Subsystems

- **[[id].get](./[id].get.md)** — 9 routes — touches: cache, queue
- **[Career-grid.get](./career-grid.get.md)** — 1 routes — touches: cache
- **[Cast-vote.post](./cast-vote.post.md)** — 1 routes
- **[Count-voice-actor-works.post](./count-voice-actor-works.post.md)** — 1 routes
- **[Create-user-profile.post](./create-user-profile.post.md)** — 1 routes — touches: auth, db
- **[Dashboard-stats.get](./dashboard-stats.get.md)** — 1 routes — touches: auth, cache
- **[Delete-user-voice-actor-link.post](./delete-user-voice-actor-link.post.md)** — 1 routes — touches: db
- **[Delete-voice-actor-link.post](./delete-voice-actor-link.post.md)** — 1 routes — touches: auth, db
- **[Delete-work-entry.post](./delete-work-entry.post.md)** — 1 routes — touches: auth, db
- **[Delete_user.post](./delete_user.post.md)** — 1 routes — touches: auth
- **[Detail-collections.get](./detail-collections.get.md)** — 1 routes — touches: cache
- **[Extract-credits-from-image.post](./extract-credits-from-image.post.md)** — 1 routes — touches: upload
- **[Extract-voice-actor-info.post](./extract-voice-actor-info.post.md)** — 1 routes — touches: auth
- **[Find_duplicate_voice_actors.get](./find_duplicate_voice_actors.get.md)** — 1 routes — touches: auth, cache
- **[Find_duplicate_work.get](./find_duplicate_work.get.md)** — 1 routes — touches: auth, cache
- **[Games.get](./games.get.md)** — 1 routes — touches: cache
- **[Generate-social-content.post](./generate-social-content.post.md)** — 1 routes — touches: auth, email
- **[Get-dubbing-project.get](./get-dubbing-project.get.md)** — 1 routes — touches: cache
- **[Get-media-credits.get](./get-media-credits.get.md)** — 1 routes — touches: cache
- **[Get-metadata.get](./get-metadata.get.md)** — 1 routes — touches: cache
- **[Get-random-task.get](./get-random-task.get.md)** — 1 routes — touches: auth, cache
- **[Get-studio-details.get](./get-studio-details.get.md)** — 1 routes — touches: cache
- **[Get-user-profile.get](./get-user-profile.get.md)** — 1 routes — touches: auth, cache
- **[Get-user-voice-actor](./get-user-voice-actor.md)** — 1 routes — touches: auth, cache
- **[Get-user-voice-actors.get](./get-user-voice-actors.get.md)** — 1 routes — touches: auth, cache
- **[Get-work-votes.get](./get-work-votes.get.md)** — 1 routes — touches: cache
- **[Home-stats.get](./home-stats.get.md)** — 1 routes — touches: cache
- **[Index.get](./index.get.md)** — 4 routes — touches: cache, db
- **[Internal-media-create.post](./internal-media-create.post.md)** — 1 routes — touches: auth, db
- **[Internal-media-credits.get](./internal-media-credits.get.md)** — 1 routes — touches: cache
- **[Internal-media-metadata.get](./internal-media-metadata.get.md)** — 1 routes — touches: cache
- **[Link-user-voice-actor.post](./link-user-voice-actor.post.md)** — 1 routes — touches: db
- **[Link-voice-actor.post](./link-voice-actor.post.md)** — 1 routes — touches: auth, db
- **[List-voice-actors.get](./list-voice-actors.get.md)** — 1 routes — touches: cache
- **[List_users.get](./list_users.get.md)** — 1 routes — touches: auth, cache
- **[Manage-subscription.post](./manage-subscription.post.md)** — 1 routes — touches: db
- **[Media-queue.post](./media-queue.post.md)** — 1 routes — touches: auth, cache, queue
- **[Merge_voice_actor_duplicates.post](./merge_voice_actor_duplicates.post.md)** — 1 routes — touches: auth
- **[Movies.get](./movies.get.md)** — 1 routes — touches: cache
- **[Notify-subscribers.post](./notify-subscribers.post.md)** — 1 routes — touches: auth, webhook
- **[Prepare-trending-media.post](./prepare-trending-media.post.md)** — 1 routes — touches: auth, queue
- **[Prepare_game.post](./prepare_game.post.md)** — 1 routes — touches: auth
- **[Prepare_media.post](./prepare_media.post.md)** — 1 routes — touches: auth
- **[Process-credits.post](./process-credits.post.md)** — 1 routes — touches: db
- **[Process-media-queue.post](./process-media-queue.post.md)** — 1 routes — touches: auth, cache, queue
- **[Recent-voice-actors.get](./recent-voice-actors.get.md)** — 1 routes — touches: cache
- **[Request-voice-actor-page.post](./request-voice-actor-page.post.md)** — 1 routes — touches: auth, email
- **[Revert-task.post](./revert-task.post.md)** — 1 routes — touches: db
- **[Save-dubbing-project.post](./save-dubbing-project.post.md)** — 1 routes — touches: auth, db
- **[Save-metadata.post](./save-metadata.post.md)** — 1 routes — touches: db
- **[Save-studio.post](./save-studio.post.md)** — 1 routes — touches: db
- **[Search-voice-actors.get](./search-voice-actors.get.md)** — 1 routes — touches: cache
- **[Shows.get](./shows.get.md)** — 1 routes — touches: cache
- **[Submit-task.post](./submit-task.post.md)** — 1 routes — touches: db, upload
- **[Submit-user-report.post](./submit-user-report.post.md)** — 1 routes — touches: db
- **[Top-contributors.get](./top-contributors.get.md)** — 1 routes — touches: cache
- **[Top-voice-actors.get](./top-voice-actors.get.md)** — 1 routes — touches: cache
- **[Update-review-status.post](./update-review-status.post.md)** — 1 routes — touches: db, cache
- **[Update-user-profile.post](./update-user-profile.post.md)** — 1 routes
- **[Update-voice-actor.post](./update-voice-actor.post.md)** — 1 routes — touches: auth, db, upload
- **[Update_user_role.post](./update_user_role.post.md)** — 1 routes — touches: auth
- **[Update_voice_actor_link.post](./update_voice_actor_link.post.md)** — 1 routes — touches: auth, db
- **[Upload-profile-picture.post](./upload-profile-picture.post.md)** — 1 routes — touches: auth, db, upload
- **[Voice-actors.get](./voice-actors.get.md)** — 1 routes — touches: cache

**Database:** unknown, 16 models — see [database.md](./database.md)

**UI:** 195 components (vue) — see [ui.md](./ui.md)

**Libraries:** 77 files — see [libraries.md](./libraries.md)

## High-Impact Files

Changes to these files have the widest blast radius across the codebase:

- `apps/website/server/utils/db/client.ts` — imported by **59** files
- `apps/website/server/utils/cache/http.ts` — imported by **39** files
- `apps/website/server/utils/auth.ts` — imported by **26** files
- `apps/website/server/utils/index.ts` — imported by **24** files
- `apps/website/server/utils/db/queries.ts` — imported by **12** files
- `apps/website/server/utils/notifications/discord.ts` — imported by **11** files

## Required Environment Variables

- `ANDROID_HOME` — `.env.example`
- `CI` — `apps/mobile/capacitor.config.ts`
- `DEV` — `apps/mobile/src/api/supabase.ts`
- `DISCORD_ADMIN_WEBHOOK_LOG_URL` — `.env.example`
- `DISCORD_CHECK_WEBHOOK_URL` — `apps/website/server/utils/notifications/discord.ts`
- `DISCORD_DISCOVERY_WEBHOOK_URL` — `apps/website/server/utils/notifications/discord.ts`
- `DISCORD_EXTRACT_WEBHOOK_URL` — `apps/website/server/utils/notifications/discord.ts`
- `DISCORD_WEBHOOK_CHECK_URL` — `apps/website/server/utils/notifications/discord.ts`
- `DISCORD_WEBHOOK_DISCOVERY_URL` — `apps/website/server/utils/notifications/discord.ts`
- `DISCORD_WEBHOOK_EXTRACT_URL` — `apps/website/server/utils/notifications/discord.ts`
- `DISCORD_WEBHOOK_URL` — `apps/website/server/utils/notifications/discord.ts`
- `DISCORD_WEBHOOK_URL_1` — `apps/website/server/utils/notifications/discord.ts`
- _...33 more_

---
_Back to [index.md](./index.md) · Generated 2026-09-15_
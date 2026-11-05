# Dependency Graph

## Most Imported Files (change these carefully)

- `apps/website/server/utils/db/client.ts` — imported by **72** files
- `apps/website/server/utils/auth-handlers.ts` — imported by **37** files
- `apps/website/server/utils/index.ts` — imported by **27** files
- `apps/website/server/utils/cache/index.ts` — imported by **19** files
- `apps/website/server/utils/auth.ts` — imported by **16** files
- `apps/website/server/utils/notifications/discord.ts` — imported by **12** files
- `apps/website/server/utils/api/igdb.ts` — imported by **12** files
- `packages/shared-logic/src/types/index.ts` — imported by **12** files
- `apps/website/server/utils/urls/supabase.ts` — imported by **11** files
- `apps/website/server/utils/dubbing-language.ts` — imported by **10** files
- `apps/website/server/utils/cache/http.ts` — imported by **10** files
- `apps/website/server/utils/db/queries.ts` — imported by **9** files
- `apps/website/server/utils/urls/tmdb.ts` — imported by **9** files
- `apps/website/server/utils/media-request.ts` — imported by **9** files
- `apps/website/server/utils/cache/constants.ts` — imported by **8** files
- `e2e/helpers/mock-api.ts` — imported by **8** files
- `apps/website/server/utils/background.ts` — imported by **7** files
- `apps/website/server/utils/narrow.ts` — imported by **7** files
- `apps/website/server/utils/services/media.ts` — imported by **7** files
- `apps/website/server/utils/cache/wikipedia.ts` — imported by **5** files

## Import Map (who imports what)

- `apps/website/server/utils/db/client.ts` ← `apps/website/server/api/admin/dubbing-project.get.ts`, `apps/website/server/api/admin/dubbing-project.post.ts`, `apps/website/server/api/admin/queue/clear.post.ts`, `apps/website/server/api/admin/queue/item.delete.ts`, `apps/website/server/api/admin/queue/reprocess-legacy-wiki-check-reviews.post.ts` +67 more
- `apps/website/server/utils/auth-handlers.ts` ← `apps/website/server/api/admin/dubbing-project.get.ts`, `apps/website/server/api/admin/dubbing-project.post.ts`, `apps/website/server/api/admin/queue/clear.post.ts`, `apps/website/server/api/admin/queue/item.delete.ts`, `apps/website/server/api/admin/queue/reprocess-legacy-wiki-check-reviews.post.ts` +32 more
- `apps/website/server/utils/index.ts` ← `apps/website/server/api/actor/[id].get.ts`, `apps/website/server/api/advertisement/[id].get.ts`, `apps/website/server/api/audiobook/[id].get.ts`, `apps/website/server/api/career-grid.get.ts`, `apps/website/server/api/episode/index.get.ts` +22 more
- `apps/website/server/utils/cache/index.ts` ← `apps/website/server/api/episode/index.get.ts`, `apps/website/server/api/season/index.get.ts`, `apps/website/server/utils/api/igdb.test.ts`, `apps/website/server/utils/api/igdb.ts`, `apps/website/server/utils/api/openlibrary.test.ts` +14 more
- `apps/website/server/utils/auth.ts` ← `apps/website/server/api/admin/work-duplicates.get.ts`, `apps/website/server/api/cast-vote.post.ts`, `apps/website/server/api/generate-social-content.post.ts`, `apps/website/server/api/get-work-votes.get.ts`, `apps/website/server/api/manage-subscription.post.ts` +11 more
- `apps/website/server/utils/notifications/discord.ts` ← `apps/website/server/api/advertisement/[id].get.ts`, `apps/website/server/api/audiobook/[id].get.ts`, `apps/website/server/api/game/[id].get.ts`, `apps/website/server/api/media-queue.post.ts`, `apps/website/server/api/movie/[id].get.ts` +7 more
- `apps/website/server/utils/api/igdb.ts` ← `apps/website/server/api/game/[id].get.ts`, `apps/website/server/api/internal-media-credits.get.ts`, `apps/website/server/api/internal-media-metadata.get.ts`, `apps/website/server/api/media-catalog.get.ts`, `apps/website/server/api/search/index.get.ts` +7 more
- `packages/shared-logic/src/types/index.ts` ← `packages/shared-logic/src/composables/useAdvertisementData.ts`, `packages/shared-logic/src/composables/useAudiobookData.ts`, `packages/shared-logic/src/composables/useDetailCollections.ts`, `packages/shared-logic/src/composables/useDetailCollections.ts`, `packages/shared-logic/src/composables/useGameData.ts` +7 more
- `apps/website/server/utils/urls/supabase.ts` ← `apps/website/server/api/actor/[id].get.ts`, `apps/website/server/api/dashboard-stats.get.ts`, `apps/website/server/api/find_duplicate_voice_actors.get.ts`, `apps/website/server/api/list-voice-actors.get.ts`, `apps/website/server/api/recent-voice-actors.get.ts` +6 more
- `apps/website/server/utils/dubbing-language.ts` ← `apps/website/server/api/admin/dubbing-project.get.ts`, `apps/website/server/api/admin/dubbing-project.post.ts`, `apps/website/server/api/internal-media-create.post.ts`, `apps/website/server/api/link-voice-actor.post.ts`, `apps/website/server/api/media-queue.post.ts` +5 more

# Dependency Graph

## Most Imported Files (change these carefully)

- `apps/website/server/utils/db/client.ts` — imported by **57** files
- `apps/website/server/utils/index.ts` — imported by **28** files
- `apps/website/server/utils/auth-handlers.ts` — imported by **24** files
- `apps/website/server/utils/cache/index.ts` — imported by **20** files
- `apps/website/server/utils/api/igdb.ts` — imported by **13** files
- `apps/website/server/utils/urls/supabase.ts` — imported by **12** files
- `apps/website/server/utils/notifications/discord.ts` — imported by **12** files
- `packages/shared-logic/src/types/index.ts` — imported by **12** files
- `apps/website/server/utils/cache/http.ts` — imported by **11** files
- `apps/website/server/utils/auth.ts` — imported by **11** files
- `apps/website/server/utils/media-request.ts` — imported by **10** files
- `apps/website/server/utils/services/media.ts` — imported by **10** files
- `apps/website/server/utils/db/queries.ts` — imported by **9** files
- `apps/website/server/utils/urls/tmdb.ts` — imported by **8** files
- `apps/website/server/utils/cache/constants.ts` — imported by **8** files
- `e2e/helpers/mock-api.ts` — imported by **8** files
- `apps/website/server/utils/background.ts` — imported by **7** files
- `apps/website/server/utils/dubbing-language.ts` — imported by **7** files
- `apps/website/server/utils/narrow.ts` — imported by **5** files
- `apps/website/server/utils/with-timeout.ts` — imported by **5** files

## Import Map (who imports what)

- `apps/website/server/utils/db/client.ts` ← `apps/website/server/api/admin/queue/clear.post.ts`, `apps/website/server/api/admin/queue/item.delete.ts`, `apps/website/server/api/admin/queue.get.ts`, `apps/website/server/api/admin/work-duplicates/merge.post.ts`, `apps/website/server/api/admin/work-duplicates.get.ts` +52 more
- `apps/website/server/utils/index.ts` ← `apps/website/server/api/actor/[id].get.ts`, `apps/website/server/api/advertisement/[id].get.ts`, `apps/website/server/api/audiobook/[id].get.ts`, `apps/website/server/api/career-grid.get.ts`, `apps/website/server/api/character/[source]/[id].get.ts` +23 more
- `apps/website/server/utils/auth-handlers.ts` ← `apps/website/server/api/admin/queue/clear.post.ts`, `apps/website/server/api/admin/queue/item.delete.ts`, `apps/website/server/api/admin/queue.get.ts`, `apps/website/server/api/admin/work-duplicates/merge.post.ts`, `apps/website/server/api/dashboard-stats.get.ts` +19 more
- `apps/website/server/utils/cache/index.ts` ← `apps/website/server/utils/api/igdb.test.ts`, `apps/website/server/utils/api/igdb.ts`, `apps/website/server/utils/api/openlibrary.test.ts`, `apps/website/server/utils/api/openlibrary.ts`, `apps/website/server/utils/api/podcast.test.ts` +15 more
- `apps/website/server/utils/api/igdb.ts` ← `apps/website/server/api/character/[source]/[id].get.ts`, `apps/website/server/api/game/[id].get.ts`, `apps/website/server/api/internal-media-credits.get.ts`, `apps/website/server/api/media-catalog.get.ts`, `apps/website/server/api/search/index.get.ts` +8 more
- `apps/website/server/utils/urls/supabase.ts` ← `apps/website/server/api/actor/[id].get.ts`, `apps/website/server/api/dashboard-stats.get.ts`, `apps/website/server/api/entity-history.get.ts`, `apps/website/server/api/find_duplicate_voice_actors.get.ts`, `apps/website/server/api/list-voice-actors.get.ts` +7 more
- `apps/website/server/utils/notifications/discord.ts` ← `apps/website/server/api/advertisement/[id].get.ts`, `apps/website/server/api/audiobook/[id].get.ts`, `apps/website/server/api/media-queue.post.ts`, `apps/website/server/api/movie/[id].get.ts`, `apps/website/server/api/podcast/[id].get.ts` +7 more
- `packages/shared-logic/src/types/index.ts` ← `packages/shared-logic/src/composables/useAdvertisementData.ts`, `packages/shared-logic/src/composables/useAudiobookData.ts`, `packages/shared-logic/src/composables/useDetailCollections.ts`, `packages/shared-logic/src/composables/useDetailCollections.ts`, `packages/shared-logic/src/composables/useGameData.ts` +7 more
- `apps/website/server/utils/cache/http.ts` ← `apps/website/server/api/actor/[id].get.ts`, `apps/website/server/api/admin/work-duplicates.get.ts`, `apps/website/server/api/character-images.get.ts`, `apps/website/server/api/og-image/index.get.ts`, `apps/website/server/api/trending/games.get.ts` +6 more
- `apps/website/server/utils/auth.ts` ← `apps/website/server/api/admin/work-duplicates.get.ts`, `apps/website/server/api/entity-history.get.ts`, `apps/website/server/api/media-queue.post.ts`, `apps/website/server/api/prepare-trending-media.post.ts`, `apps/website/server/api/process-media-queue.post.ts` +6 more

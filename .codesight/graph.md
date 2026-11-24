# Dependency Graph

## Most Imported Files (change these carefully)

- `apps/website/server/utils/db/client.ts` — imported by **68** files
- `apps/website/server/utils/auth-handlers.ts` — imported by **29** files
- `apps/website/server/utils/index.ts` — imported by **28** files
- `apps/website/server/utils/cache/index.ts` — imported by **18** files
- `apps/website/server/utils/api-v1/define.ts` — imported by **17** files
- `packages/shared-logic/src/types/index.ts` — imported by **12** files
- `apps/website/server/utils/api-v1/errors.ts` — imported by **11** files
- `apps/website/server/utils/db/queries.ts` — imported by **10** files
- `apps/website/server/utils/media-request.ts` — imported by **10** files
- `apps/website/server/utils/services/media.ts` — imported by **10** files
- `apps/website/server/utils/api-v1/voice-actors.ts` — imported by **10** files
- `apps/website/server/utils/cache/http.ts` — imported by **9** files
- `apps/website/server/utils/auth.ts` — imported by **9** files
- `apps/website/server/utils/api-v1/credits.ts` — imported by **9** files
- `apps/website/server/utils/api-v1/media.ts` — imported by **8** files
- `apps/website/server/utils/cache/constants.ts` — imported by **8** files
- `e2e/helpers/mock-api.ts` — imported by **8** files
- `apps/website/server/utils/narrow.ts` — imported by **7** files
- `apps/website/server/utils/dubbing-language.ts` — imported by **7** files
- `apps/website/server/utils/cache/edge.ts` — imported by **7** files

## Import Map (who imports what)

- `apps/website/server/utils/db/client.ts` ← `apps/website/server/api/admin/queue/clear.post.ts`, `apps/website/server/api/admin/queue/item.delete.ts`, `apps/website/server/api/admin/queue.get.ts`, `apps/website/server/api/admin/work-duplicates/merge.post.ts`, `apps/website/server/api/admin/work-duplicates.get.ts` +63 more
- `apps/website/server/utils/auth-handlers.ts` ← `apps/website/server/api/admin/queue/clear.post.ts`, `apps/website/server/api/admin/queue/item.delete.ts`, `apps/website/server/api/admin/queue.get.ts`, `apps/website/server/api/admin/work-duplicates/merge.post.ts`, `apps/website/server/api/admin/work-duplicates.get.ts` +24 more
- `apps/website/server/utils/index.ts` ← `apps/website/server/api/actor/[id].get.ts`, `apps/website/server/api/advertisement/[id].get.ts`, `apps/website/server/api/audiobook/[id].get.ts`, `apps/website/server/api/career-grid.get.ts`, `apps/website/server/api/character/[source]/[id].get.ts` +23 more
- `apps/website/server/utils/cache/index.ts` ← `apps/website/server/utils/api/igdb.test.ts`, `apps/website/server/utils/api/igdb.ts`, `apps/website/server/utils/api/openlibrary.test.ts`, `apps/website/server/utils/api/openlibrary.ts`, `apps/website/server/utils/api/podcast.test.ts` +13 more
- `apps/website/server/utils/api-v1/define.ts` ← `apps/website/server/api/v1/[type]/[id]/characters/[characterId].patch.ts`, `apps/website/server/api/v1/[type]/[id]/characters.get.ts`, `apps/website/server/api/v1/[type]/[id]/characters.post.ts`, `apps/website/server/api/v1/[type]/[id]/credits/[workId].get.ts`, `apps/website/server/api/v1/[type]/[id]/credits/[workId].patch.ts` +12 more
- `packages/shared-logic/src/types/index.ts` ← `packages/shared-logic/src/composables/useAdvertisementData.ts`, `packages/shared-logic/src/composables/useAudiobookData.ts`, `packages/shared-logic/src/composables/useDetailCollections.ts`, `packages/shared-logic/src/composables/useDetailCollections.ts`, `packages/shared-logic/src/composables/useGameData.ts` +7 more
- `apps/website/server/utils/api-v1/errors.ts` ← `apps/website/server/api/v1/[type]/[id]/characters/[characterId].patch.ts`, `apps/website/server/api/v1/[type]/[id]/characters.post.ts`, `apps/website/server/api/v1/[type]/[id]/credits/batch.post.ts`, `apps/website/server/api/v1/[type]/index.post.ts`, `apps/website/server/api/v1/voice-actors/[id]/credits.get.ts` +6 more
- `apps/website/server/utils/db/queries.ts` ← `apps/website/server/api/actor/[id].get.ts`, `apps/website/server/api/advertisement/[id].get.ts`, `apps/website/server/api/audiobook/[id].get.ts`, `apps/website/server/api/character/[source]/[id].get.ts`, `apps/website/server/api/detail-collections.get.ts` +5 more
- `apps/website/server/utils/media-request.ts` ← `apps/website/server/api/actor/[id].get.ts`, `apps/website/server/api/audiobook/[id].get.ts`, `apps/website/server/api/character-portraits.get.ts`, `apps/website/server/api/episode/index.get.ts`, `apps/website/server/api/game/[id].get.ts` +5 more
- `apps/website/server/utils/services/media.ts` ← `apps/website/server/api/career-grid.get.ts`, `apps/website/server/api/character/[source]/[id].get.ts`, `apps/website/server/api/character-portraits.get.ts`, `apps/website/server/api/episode/index.get.ts`, `apps/website/server/api/movie/[id].get.ts` +5 more

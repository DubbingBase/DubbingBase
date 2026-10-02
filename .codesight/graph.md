# Dependency Graph

## Most Imported Files (change these carefully)

- `apps/website/server/utils/db/client.ts` — imported by **65** files
- `apps/website/server/utils/auth.ts` — imported by **34** files
- `apps/website/server/utils/index.ts` — imported by **23** files
- `apps/website/server/utils/cache/index.ts` — imported by **22** files
- `apps/website/server/utils/db/queries.ts` — imported by **12** files
- `apps/website/server/utils/cache/constants.ts` — imported by **12** files
- `apps/website/server/utils/dubbing-language.ts` — imported by **11** files
- `apps/website/server/utils/notifications/discord.ts` — imported by **11** files
- `apps/website/server/utils/api/igdb.ts` — imported by **11** files
- `apps/website/server/utils/urls/supabase.ts` — imported by **10** files
- `apps/website/server/utils/urls/tmdb.ts` — imported by **10** files
- `e2e/helpers/mock-api.ts` — imported by **8** files
- `packages/shared-logic/src/types/index.ts` — imported by **8** files
- `apps/website/server/utils/background.ts` — imported by **7** files
- `apps/website/server/utils/cache/http.ts` — imported by **7** files
- `apps/website/server/utils/services/media.ts` — imported by **6** files
- `apps/website/server/utils/api/cache-options.ts` — imported by **6** files
- `apps/website/server/utils/error-message.ts` — imported by **5** files
- `apps/website/server/utils/with-timeout.ts` — imported by **4** files
- `apps/website/server/utils/llm.ts` — imported by **4** files

## Import Map (who imports what)

- `apps/website/server/utils/db/client.ts` ← `apps/website/server/api/admin/dubbing-project.get.ts`, `apps/website/server/api/admin/dubbing-project.post.ts`, `apps/website/server/api/admin/queue/clear.post.ts`, `apps/website/server/api/admin/queue/item.delete.ts`, `apps/website/server/api/admin/queue/review.post.ts` +60 more
- `apps/website/server/utils/auth.ts` ← `apps/website/server/api/admin/dubbing-project.get.ts`, `apps/website/server/api/admin/dubbing-project.post.ts`, `apps/website/server/api/admin/queue/clear.post.ts`, `apps/website/server/api/admin/queue/item.delete.ts`, `apps/website/server/api/admin/queue/review.post.ts` +29 more
- `apps/website/server/utils/index.ts` ← `apps/website/server/api/actor/[id].get.ts`, `apps/website/server/api/advertisement/[id].get.ts`, `apps/website/server/api/audiobook/[id].get.ts`, `apps/website/server/api/career-grid.get.ts`, `apps/website/server/api/episode/index.get.ts` +18 more
- `apps/website/server/utils/cache/index.ts` ← `apps/website/server/api/episode/index.get.ts`, `apps/website/server/api/season/index.get.ts`, `apps/website/server/utils/api/cache-options.ts`, `apps/website/server/utils/api/igdb.test.ts`, `apps/website/server/utils/api/igdb.ts` +17 more
- `apps/website/server/utils/db/queries.ts` ← `apps/website/server/api/actor/[id].get.ts`, `apps/website/server/api/advertisement/[id].get.ts`, `apps/website/server/api/audiobook/[id].get.ts`, `apps/website/server/api/episode/index.get.ts`, `apps/website/server/api/game/[id].get.ts` +7 more
- `apps/website/server/utils/cache/constants.ts` ← `apps/website/server/api/episode/index.get.ts`, `apps/website/server/api/season/index.get.ts`, `apps/website/server/utils/api/igdb.ts`, `apps/website/server/utils/api/openlibrary.ts`, `apps/website/server/utils/api/podcast.ts` +7 more
- `apps/website/server/utils/dubbing-language.ts` ← `apps/website/server/api/admin/dubbing-project.get.ts`, `apps/website/server/api/admin/dubbing-project.post.ts`, `apps/website/server/api/admin/queue/review.post.ts`, `apps/website/server/api/internal-media-create.post.ts`, `apps/website/server/api/link-voice-actor.post.ts` +6 more
- `apps/website/server/utils/notifications/discord.ts` ← `apps/website/server/api/advertisement/[id].get.ts`, `apps/website/server/api/audiobook/[id].get.ts`, `apps/website/server/api/game/[id].get.ts`, `apps/website/server/api/media-queue.post.ts`, `apps/website/server/api/movie/[id].get.ts` +6 more
- `apps/website/server/utils/api/igdb.ts` ← `apps/website/server/api/game/[id].get.ts`, `apps/website/server/api/internal-media-credits.get.ts`, `apps/website/server/api/internal-media-metadata.get.ts`, `apps/website/server/api/search/index.get.ts`, `apps/website/server/api/trending/games.get.ts` +6 more
- `apps/website/server/utils/urls/supabase.ts` ← `apps/website/server/api/actor/[id].get.ts`, `apps/website/server/api/dashboard-stats.get.ts`, `apps/website/server/api/find_duplicate_voice_actors.get.ts`, `apps/website/server/api/recent-voice-actors.get.ts`, `apps/website/server/api/search/index.get.ts` +5 more

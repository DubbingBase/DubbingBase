# Dependency Graph

## Most Imported Files (change these carefully)

- `apps/website/server/utils/db/client.ts` — imported by **59** files
- `apps/website/server/utils/cache/http.ts` — imported by **39** files
- `apps/website/server/utils/auth.ts` — imported by **26** files
- `apps/website/server/utils/index.ts` — imported by **23** files
- `apps/website/server/utils/db/queries.ts` — imported by **12** files
- `apps/website/server/utils/notifications/discord.ts` — imported by **11** files
- `apps/website/server/utils/urls/supabase.ts` — imported by **10** files
- `apps/website/server/utils/urls/tmdb.ts` — imported by **10** files
- `apps/website/server/utils/cache/index.ts` — imported by **10** files
- `apps/website/server/utils/api/igdb.ts` — imported by **8** files
- `e2e/helpers/mock-api.ts` — imported by **8** files
- `packages/shared-logic/src/types/index.ts` — imported by **8** files
- `apps/website/server/utils/background.ts` — imported by **7** files
- `apps/website/server/utils/services/media.ts` — imported by **6** files
- `apps/website/server/utils/error-message.ts` — imported by **5** files
- `apps/website/server/utils/llm.ts` — imported by **4** files
- `apps/website/server/utils/db/dubbing-project.ts` — imported by **3** files
- `apps/website/server/utils/normalize.ts` — imported by **3** files
- `apps/mobile/src/api/supabase.ts` — imported by **2** files
- `apps/mobile/src/views/voice-actor-profile.vue` — imported by **2** files

## Import Map (who imports what)

- `apps/website/server/utils/db/client.ts` ← `apps/website/server/api/admin/work-duplicates/merge.post.ts`, `apps/website/server/api/admin/work-duplicates.get.ts`, `apps/website/server/api/advertisement/[id].get.ts`, `apps/website/server/api/audiobook/[id].get.ts`, `apps/website/server/api/career-grid.get.ts` +54 more
- `apps/website/server/utils/cache/http.ts` ← `apps/website/server/api/actor/[id].get.ts`, `apps/website/server/api/admin/work-duplicates.get.ts`, `apps/website/server/api/advertisement/[id].get.ts`, `apps/website/server/api/audiobook/[id].get.ts`, `apps/website/server/api/career-grid.get.ts` +34 more
- `apps/website/server/utils/auth.ts` ← `apps/website/server/api/admin/work-duplicates/merge.post.ts`, `apps/website/server/api/admin/work-duplicates.get.ts`, `apps/website/server/api/create-user-profile.post.ts`, `apps/website/server/api/dashboard-stats.get.ts`, `apps/website/server/api/delete-voice-actor-link.post.ts` +21 more
- `apps/website/server/utils/index.ts` ← `apps/website/server/api/actor/[id].get.ts`, `apps/website/server/api/advertisement/[id].get.ts`, `apps/website/server/api/audiobook/[id].get.ts`, `apps/website/server/api/career-grid.get.ts`, `apps/website/server/api/episode/index.get.ts` +18 more
- `apps/website/server/utils/db/queries.ts` ← `apps/website/server/api/actor/[id].get.ts`, `apps/website/server/api/advertisement/[id].get.ts`, `apps/website/server/api/audiobook/[id].get.ts`, `apps/website/server/api/episode/index.get.ts`, `apps/website/server/api/game/[id].get.ts` +7 more
- `apps/website/server/utils/notifications/discord.ts` ← `apps/website/server/api/advertisement/[id].get.ts`, `apps/website/server/api/audiobook/[id].get.ts`, `apps/website/server/api/game/[id].get.ts`, `apps/website/server/api/media-queue.post.ts`, `apps/website/server/api/movie/[id].get.ts` +6 more
- `apps/website/server/utils/urls/supabase.ts` ← `apps/website/server/api/actor/[id].get.ts`, `apps/website/server/api/dashboard-stats.get.ts`, `apps/website/server/api/find_duplicate_voice_actors.get.ts`, `apps/website/server/api/recent-voice-actors.get.ts`, `apps/website/server/api/search/index.get.ts` +5 more
- `apps/website/server/utils/urls/tmdb.ts` ← `apps/website/server/api/actor/[id].get.ts`, `apps/website/server/api/movie/[id].get.ts`, `apps/website/server/api/notify-subscribers.post.ts`, `apps/website/server/api/prepare-trending-media.post.ts`, `apps/website/server/api/search/index.get.ts` +5 more
- `apps/website/server/utils/cache/index.ts` ← `apps/website/server/utils/api/igdb.ts`, `apps/website/server/utils/api/openlibrary.ts`, `apps/website/server/utils/api/podcast.ts`, `apps/website/server/utils/api/tmdb.ts`, `apps/website/server/utils/api/tvdb.ts` +5 more
- `apps/website/server/utils/api/igdb.ts` ← `apps/website/server/api/game/[id].get.ts`, `apps/website/server/api/internal-media-credits.get.ts`, `apps/website/server/api/internal-media-metadata.get.ts`, `apps/website/server/api/search/index.get.ts`, `apps/website/server/api/trending/games.get.ts` +3 more

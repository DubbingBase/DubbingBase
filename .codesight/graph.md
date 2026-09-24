# Dependency Graph

## Most Imported Files (change these carefully)

- `apps/website/server/utils/db/client.ts` — imported by **59** files
- `apps/website/server/utils/cache/http.ts` — imported by **37** files
- `apps/website/server/utils/auth.ts` — imported by **26** files
- `apps/website/server/utils/index.ts` — imported by **23** files
- `apps/website/server/utils/cache/index.ts` — imported by **13** files
- `apps/website/server/utils/db/queries.ts` — imported by **12** files
- `apps/website/server/utils/notifications/discord.ts` — imported by **11** files
- `apps/website/server/utils/cache/constants.ts` — imported by **11** files
- `apps/website/server/utils/urls/supabase.ts` — imported by **10** files
- `apps/website/server/utils/urls/tmdb.ts` — imported by **10** files
- `apps/website/server/utils/api/igdb.ts` — imported by **9** files
- `apps/website/server/utils/api/cache-options.ts` — imported by **8** files
- `e2e/helpers/mock-api.ts` — imported by **8** files
- `packages/shared-logic/src/types/index.ts` — imported by **8** files
- `apps/website/server/utils/background.ts` — imported by **7** files
- `apps/website/server/utils/services/media.ts` — imported by **6** files
- `apps/website/server/utils/error-message.ts` — imported by **5** files
- `apps/website/server/utils/with-timeout.ts` — imported by **4** files
- `apps/website/server/utils/llm.ts` — imported by **4** files
- `apps/website/src/utils/media-cast.ts` — imported by **3** files

## Import Map (who imports what)

- `apps/website/server/utils/db/client.ts` ← `apps/website/server/api/advertisement/[id].get.ts`, `apps/website/server/api/audiobook/[id].get.ts`, `apps/website/server/api/career-grid.get.ts`, `apps/website/server/api/cast-vote.post.ts`, `apps/website/server/api/count-voice-actor-works.post.ts` +54 more
- `apps/website/server/utils/cache/http.ts` ← `apps/website/server/api/actor/[id].get.ts`, `apps/website/server/api/advertisement/[id].get.ts`, `apps/website/server/api/audiobook/[id].get.ts`, `apps/website/server/api/career-grid.get.ts`, `apps/website/server/api/dashboard-stats.get.ts` +32 more
- `apps/website/server/utils/auth.ts` ← `apps/website/server/api/create-user-profile.post.ts`, `apps/website/server/api/dashboard-stats.get.ts`, `apps/website/server/api/delete-voice-actor-link.post.ts`, `apps/website/server/api/delete-work-entry.post.ts`, `apps/website/server/api/delete_user.post.ts` +21 more
- `apps/website/server/utils/index.ts` ← `apps/website/server/api/actor/[id].get.ts`, `apps/website/server/api/advertisement/[id].get.ts`, `apps/website/server/api/audiobook/[id].get.ts`, `apps/website/server/api/career-grid.get.ts`, `apps/website/server/api/episode/index.get.ts` +18 more
- `apps/website/server/utils/cache/index.ts` ← `apps/website/server/api/episode/index.get.ts`, `apps/website/server/api/season/index.get.ts`, `apps/website/server/utils/api/igdb.test.ts`, `apps/website/server/utils/api/igdb.ts`, `apps/website/server/utils/api/openlibrary.ts` +8 more
- `apps/website/server/utils/db/queries.ts` ← `apps/website/server/api/actor/[id].get.ts`, `apps/website/server/api/advertisement/[id].get.ts`, `apps/website/server/api/audiobook/[id].get.ts`, `apps/website/server/api/episode/index.get.ts`, `apps/website/server/api/game/[id].get.ts` +7 more
- `apps/website/server/utils/notifications/discord.ts` ← `apps/website/server/api/advertisement/[id].get.ts`, `apps/website/server/api/audiobook/[id].get.ts`, `apps/website/server/api/game/[id].get.ts`, `apps/website/server/api/media-queue.post.ts`, `apps/website/server/api/movie/[id].get.ts` +6 more
- `apps/website/server/utils/cache/constants.ts` ← `apps/website/server/api/episode/index.get.ts`, `apps/website/server/api/season/index.get.ts`, `apps/website/server/utils/api/igdb.ts`, `apps/website/server/utils/api/openlibrary.ts`, `apps/website/server/utils/api/podcast.ts` +6 more
- `apps/website/server/utils/urls/supabase.ts` ← `apps/website/server/api/actor/[id].get.ts`, `apps/website/server/api/dashboard-stats.get.ts`, `apps/website/server/api/find_duplicate_voice_actors.get.ts`, `apps/website/server/api/recent-voice-actors.get.ts`, `apps/website/server/api/search/index.get.ts` +5 more
- `apps/website/server/utils/urls/tmdb.ts` ← `apps/website/server/api/actor/[id].get.ts`, `apps/website/server/api/movie/[id].get.ts`, `apps/website/server/api/notify-subscribers.post.ts`, `apps/website/server/api/prepare-trending-media.post.ts`, `apps/website/server/api/search/index.get.ts` +5 more

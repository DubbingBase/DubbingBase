# dubbing-base-monorepo — Project Context

**Stack:** nuxt | none | typescript
**Monorepo:** @app/website, @app/supabase, @app/locales, @app/shared-logic

86 routes | 30 models | 53 env vars | 617 import links

**API areas:** /api/actor, /api/admin, /api/advertisement, /api/audiobook, /api/career-grid, /api/character, /api/character-portraits, /api/count-voice-actor-works, /api/dashboard-stats, /api/delete_user

**High-impact files** (change carefully):
- apps/website/server/utils/db/client.ts (imported by 68 files)
- apps/website/server/utils/auth-handlers.ts (imported by 29 files)
- apps/website/server/utils/index.ts (imported by 28 files)
- apps/website/server/utils/cache/index.ts (imported by 18 files)
- apps/website/server/utils/api-v1/define.ts (imported by 17 files)

**Required env vars:** CI, DISCORD_ADMIN_WEBHOOK_LOG_URL, DISCORD_CHECK_WEBHOOK_URL, DISCORD_DISCOVERY_WEBHOOK_URL, DISCORD_EXTRACT_WEBHOOK_URL, DISCORD_NOTIFY_ROUTINE, DISCORD_WEBHOOK_CHECK_URL, DISCORD_WEBHOOK_DISCOVERY_URL, DISCORD_WEBHOOK_EXTRACT_URL, DISCORD_WEBHOOK_URL, DISCORD_WEBHOOK_URL_1, DISCORD_WEBHOOK_URL_2, DISCORD_WEBHOOK_URL_3, E2E_TEST, GEMINI_MODELS, GOOGLE_AI_KEY, IGDB_CLIENT_ID, IGDB_CLIENT_SECRET, NUXT_DISCORD_WEBHOOK_CHECK_URL, NUXT_DISCORD_WEBHOOK_DISCOVERY_URL, NUXT_DISCORD_WEBHOOK_EXTRACT_URL, NUXT_DISCORD_WEBHOOK_URL, NUXT_DISCORD_WEBHOOK_URL_1, NUXT_DISCORD_WEBHOOK_URL_2, NUXT_DISCORD_WEBHOOK_URL_3, NUXT_GOOGLE_AI_KEY, ROUTE_CPU_BASE_WEBSITE_DIR, ROUTE_CPU_BENCHMARK, ROUTE_CPU_DATASET, ROUTE_CPU_HOST_NETWORK_NAMESPACE, ROUTE_CPU_METRICS_PATH, ROUTE_CPU_PROFILE_DIR, ROUTE_CPU_ROUTES, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, TMDB_API_KEY, TVDB_API_KEY

---

## Agent Instructions

This project uses codesight for structured AI context. Follow these steps before implementing:
1. Read `.codesight/wiki/index.md` for project orientation (~200 tokens)
2. Read `.codesight/wiki/overview.md` for architecture overview (~500 tokens)
3. Read the relevant domain article, then open the source files listed in it
4. Read `.codesight/CODESIGHT.md` for the full context map

**Do not explore the file tree blindly.** The codesight context map already contains:
routes, schema, components, libraries, config, middleware, and dependency graph.

**Before modifying any file:** check `.codesight/graph.md` for blast radius.
Files with high import counts affect many downstream modules — change carefully.

Routes marked `[inferred]` were detected via regex and may have lower precision.
If any source file shows ⚠ in a wiki article, re-run `npx codesight --wiki` before proceeding.
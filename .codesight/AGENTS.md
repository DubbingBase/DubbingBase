# Project Context

This is a typescript project using nuxt.
It is a monorepo with workspaces: @app/mobile (apps/mobile), @app/website (apps/website), @app/supabase (packages/database), @app/locales (packages/locales), @app/og-image (packages/og-image), @app/shared-logic (packages/shared-logic).

The API has 79 routes. See routes.md for the full route map with methods, paths, and tags.
The database has 16 models. See schema.md for the full schema with fields, types, and relations.
The UI has 178 components. See components.md for the full list with props.
Middleware includes: auth, custom, cors.

High-impact files (most imported, changes here affect many other files):

- apps/website/server/utils/db/client.ts (imported by 61 files)
- apps/website/server/utils/auth.ts (imported by 26 files)
- apps/website/server/utils/index.ts (imported by 22 files)
- apps/website/server/utils/db/queries.ts (imported by 12 files)
- apps/website/server/utils/notifications/discord.ts (imported by 11 files)
- apps/website/server/utils/urls/supabase.ts (imported by 10 files)
- apps/website/server/utils/urls/tmdb.ts (imported by 10 files)
- apps/website/server/utils/api/igdb.ts (imported by 8 files)

Required environment variables (no defaults):

- ANDROID_HOME (.env.example)
- CI (apps/mobile/capacitor.config.ts)
- DEV (apps/mobile/src/api/supabase.ts)
- DISCORD_ADMIN_WEBHOOK_LOG_URL (.env.example)
- DISCORD_CHECK_WEBHOOK_URL (apps/website/nuxt.config.ts)
- DISCORD_DISCOVERY_WEBHOOK_URL (apps/website/nuxt.config.ts)
- DISCORD_EXTRACT_WEBHOOK_URL (apps/website/nuxt.config.ts)
- DISCORD_WEBHOOK_URL_1 (apps/website/server/utils/notifications/discord.ts)
- DISCORD_WEBHOOK_URL_2 (apps/website/server/utils/notifications/discord.ts)
- DISCORD_WEBHOOK_URL_3 (apps/website/server/utils/notifications/discord.ts)
- E2E_TEST (apps/website/server/middleware/00-e2e-mock.ts)
- GOOGLE_AI_KEY (.env.example)
- GROQ_API_KEY (.env.example)
- IGDB_CLIENT_ID (.env.example)
- IGDB_CLIENT_SECRET (.env.example)

See cicd.md for additional cicd context.
See githooks.md for additional githooks context.

Read wiki/index.md for orientation (WHERE things live). Then read actual source files before implementing. Wiki articles are navigation aids, not implementation guides.
Read CODESIGHT.md for the complete AI context map including all routes, schema, components, libraries, config, middleware, and dependency graph.

# AI Agent Instructions and Rules - DubbingBase

This file defines the project architecture, key development commands, and coding rules/best practices that must be strictly followed when making any changes to the codebase.

---

## 🏗️ Project Architecture & Hierarchy

The project is structured as a **Monorepo** managed by `pnpm workspaces` and `turbo`. The global system tool configurations (Node.js, Deno, etc.) are managed by **Mise** via [mise.toml](file:///run/media/armaldio/SSD/Projects/DubbingBase/App/mise.toml).

```
├── apps/
│   ├── mobile/       # Mobile application (Vue 3, Capacitor)
│   └── website/      # Web application / admin dashboard (Vue 3, Tailwind v4)
├── packages/
│   ├── database/     # Supabase configuration, local migrations, seeds, and generated TypeScript types
│   └── common/       # Shared package (currently empty, intended for common types/utilities)
├── package.json      # Global monorepo configuration
├── mise.toml         # Environment and task manager (Mise)
└── turbo.json        # Turbo Repo configuration to orchestrate builds and tasks
```

---

## 🛠️ Development Commands (via `mise`)

All development tasks MUST be run via **Mise** to ensure environment consistency. Always check `mise.toml` first to see if a command exists before attempting to run raw bash commands or `pnpm` scripts directly. If a task is defined in `mise.toml` (e.g. `gen-types`), you must run it using `mise run <task>`.

| Command                 | Description                                                                           |
| :---------------------- | :------------------------------------------------------------------------------------ |
| `mise run dev`          | Starts the entire development environment (local Supabase backend + app dev servers). |
| `mise run backend`      | Starts the local Supabase database and environment.                                   |
| `mise run backend-stop` | Stops the local Supabase backend.                                                     |
| `mise run app`          | Starts only the development server for the mobile app in web mode (`apps/mobile`).    |
| `mise run website`      | Starts only the development server for the website (`apps/website`).                  |
| `mise run db-reset`     | Resets the local database, applies local migrations, and loads seed data.             |
| `mise run migrate-up`   | Applies pending migrations to the local database.                                     |
| `mise run migrate-down` | Rolls back the last applied migration.                                                |
| `mise run sync`         | Synchronizes mobile app builds with Capacitor platforms (Android, etc.).              |
| `mise run android-dev`  | Launches the Android emulator and runs the app in development mode.                   |

### Generating Database TypeScript Types:

After making any database schema changes, run the following command to update TypeScript types in the app:

```bash
mise run gen-types
```

_(This command generates types to `packages/database/src/database.types.ts`)._

### Remote / Mobile Testing via Tailscale or LAN:

When testing the website from a mobile device or other clients over Tailscale/LAN:

- Ensure the Supabase backend is running (`mise run backend`).
- Run the website dev server bound to all network interfaces with `mise run website` (or `HOST=0.0.0.0 pnpm --filter @app/website dev --host 0.0.0.0`).
- Find your Tailscale IP on the `tailscale0` interface using `ip a` (e.g. `100.111.167.123`).
- Connect from the client browser at `http://<tailscale-ip>:3000` (or `3001` if port 3000 is occupied).

---

## 💡 Best Practices by Component

### 1. Global / Front-end (Common Rules)

- **Strict TypeScript**: Always type variables, function signatures, and props. Types should strictly follow database types. Never cast using `as` and never use `any`.
- **Data Fetching Rules**:
  - **Simple single-table DB queries** (e.g. a single `supabase.from('table').select(...)`) MAY be performed directly without an API route, but **must always be encapsulated inside a dedicated API utility composable** (e.g. `useVoiceActorSubscription`). Never inline `supabase.from(...)` calls directly in Vue component `<script setup>` blocks.
  - **Complex requests** (multi-table joins, mutations with side effects, calls to external APIs, or any logic requiring elevated privileges) **MUST go through a Nuxt Nitro Server Route (`/api/...`)**.
  - If a composable is wrapping only simple DB queries, it does not need to route through a server API route. If the composable's logic grows in complexity, migrate it to a Nitro server route at that point.
- **Vue 3**: Use the **Composition API** exclusively with `<script setup lang="ts">` syntax.
- **Formatting**: Always run `pnpm format` to format code with Prettier before committing.
- **Design & Theme**: The app follows a premium dark theme. Ensure consistent UI/UX when creating or modifying components. Avoid using default Ionic variables if they result in poor contrast. Instead, explicitly use the established dark theme colors (e.g., `#1d1d1d` for card backgrounds, `#e0e0e0` for primary text, `#a0a0a0` for secondary text, `#2a2a2a` for borders) or the app's custom CSS variables to maintain a cohesive design.
- **Presentation Layer Unified Types**: Create unified interfaces for display purposes (e.g., `DisplayMedia`, `DisplayVoiceActor`) instead of passing raw, complex database types (like union types such as `Movie | Serie`) directly to UI components. This allows the presentation layer to have unified and clean types, and isolates UI templates from underlying database schema complexities.

### 2. Mobile Application (`apps/mobile`)

- **UI Framework**:
  - **IMPORTANT**: The project is migrating away from Ionic, but **it is OK to use basic Ionic components** (like `ion-content`, `ion-refresher`, `ion-router`, `ion-action-sheet`, etc.). Avoid introducing or relying heavily on complex Ionic components.
  - Use standard HTML/Vue elements styled with Tailwind CSS or Sass where possible for new UI features.
- **Capacitor**:
  - Keep Capacitor for native features/APIs (Camera, Haptics, Keyboard, StatusBar, etc.).
- **State Management**: Use **Pinia** for all global stores.
- **Styles**: Use scoped SCSS (`<style scoped lang="scss">`) or Tailwind CSS.
- **Translations/i18n**: All new user-facing strings must be localized using `vue-i18n`. Use the `useI18n` composable and the `t()` function rather than hardcoding text in templates. Do NOT use fallback strings in the `t()` function; you must implement actual translations in the locale files.
- **Feature Flags & Permissions**: Use `useFeatureFlags` for PostHog-driven feature toggles. Use `usePermissions` and `authStore` for role-based access control.
- **Browser APIs over Plugins**: Prefer standard HTML5/Browser APIs over Capacitor plugins where applicable (e.g., standard `<input type="file">` over the Capacitor Camera plugin) to ensure seamless cross-platform functionality on the web.

### 3. Web Application (`apps/website`)

- **Styling**: The website uses **Tailwind CSS v4**. Use Tailwind classes for all layouts and UI.
- **Data Grids**: Use **RevoGrid** (`@revolist/vue3-datagrid`) for complex tables.
- **Charts**: Use **Chart.js** via `vue-chartjs`.
- **Route Performance & Caching Architecture**:
  - **Dynamic Edge SWR Route Rules**: All public media paths (e.g. `/movie/**`, `/show/**`, `/game/**`, etc.) and all localized prefixes (`/fr/**`, `/es/**`, `/ja/**`) are dynamically generated in `apps/website/nuxt.config.ts` via `MEDIA_ROUTE_PREFIXES`. When adding a new media category or discovery route, always register its prefix in `MEDIA_ROUTE_PREFIXES` so that all localized variants automatically receive Cloudflare Edge SWR caching.
  - **Global Worker KV Resolver**: `apps/website/server/middleware/00-cache.ts` automatically runs on every request to prime the Cloudflare KV cache binding for the isolate. In server routes and composables, always use `useCache(event)` or `useCache()` to interact with the two-tier (L1 In-Memory + L2 Cloudflare KV) cache.
  - **Edge SWR Caching on Server APIs**: Every public GET endpoint MUST set a standardized Edge & Browser SWR `Cache-Control` header using `setPublicCacheHeaders(event, profile)` (`detail`, `catalog`, `discovery`, `search`, or `static`).
  - **0ms Instant Navigation Hydration**: When calling `useAsyncData` on public/detail pages, always provide `getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]` to eliminate loading spinners on client-side route transitions and back-navigation.
  - **Progressive DOM Windowing**: When rendering dynamic rosters or long lists of cards (cast, episodes, filmography, etc.), never render hundreds of DOM nodes at once. Use the `useProgressiveBatch` composable or `useIntersectionObserver` with a batch size of 24–36 and a bottom sentinel element.
  - **Client-side Search Filtering**: When filtering in-memory arrays via text search inputs, always debounce the query with `refDebounced(query, 150)` from `@vueuse/core` to prevent frame drops while typing.
  - **Resource Hints & Image Optimization**: Media pages must declare `preconnect` and `dns-prefetch` links in `useHead.link` for external CDNs (`https://image.tmdb.org`, `https://thetvdb.com`, `https://images.igdb.com`). Always add `loading="lazy"` and `decoding="async"` to non-hero `NuxtImg` elements.

### 4. Database & Supabase (`packages/database`)

- **SQL Migrations**:
  - Never modify the local/remote schema directly. All database schema changes must go through a migration file.
  - To create a new migration: Run `pnpm supabase migration new <migration_name>` in the appropriate directory.
  - Migration files are stored in `packages/database/supabase/migrations`.
- **Querying Local Database**:
  - The local Supabase database runs on port `55322` (you can verify this by running `npx supabase status`).
  - To query the local DB from the terminal, use: `PGPASSWORD=postgres psql -h 127.0.0.1 -p 55322 -U postgres -d postgres -c "<query>"`.
- **Seed Data**:
  - Keep `packages/database/supabase/seed.sql` up to date if you add new tables or reference data.

---

### 5. External APIs (TMDB, TVDB, IGDB)

Backend routes in `apps/website/server/api/` handle integration with TMDB, TVDB, and IGDB with server-side caching.

---

## 🤖 AI Agent Behavior Guidelines

1. **Research First**: Before writing code, inspect existing files, imports, and state to understand the setup.
2. **Preserve Comments**: Keep existing comments and docstrings unless explicitly told to remove them.
3. **Precise Code Changes**: Make targeted edits instead of rewriting large files.
4. **Validation**: Test compilation and run formatter tools before completing your turn.
5. **Wrangler / Cloudflare deploys**: `apps/website` deploys via `git push` to `main` (CI/CD pipeline). Do NOT run `wrangler deploy` locally — `CLOUDFLARE_API_TOKEN` is not set in the dev environment. To pause or resume cron triggers, edit `crons` in `apps/website/wrangler.toml`, commit, and push to `main`.
6. **Local Environment Only**: NEVER execute or run production environment commands or actions (e.g., production database pushes, live deployments, remote mutations). Only target local development environments, and do NOT suggest production actions unless strictly and explicitly asked by the user. **Specifically, NEVER run `supabase db push` or `supabase functions deploy` directly.** All remote deployments must happen strictly through the CI/CD pipeline on the `main` branch.
7. **Token Saving**: Use `rtk` (binary) (https://github.com/rtk-ai/rtk) to save tokens whenever possible.
8. **Scratch & Test Scripts**: Do NOT leave one-off test scripts (like `test_*.ts`) in the root of the project. If you need a script to test an external API or debug a function, place it in `scripts/scratch/` or use the `.gemini/scratch` folder.
9. **Caching Rules**:
   - Remember that there is no local Redis cache in the development environment.
   - When doing your fetches (e.g. testing APIs via scratch scripts), save the output locally (e.g. in JSON files in the scratch folder) so you don't have to fetch it again repeatedly.
10. **GitHub Actions — Use `gh run watch <run-id>` to monitor CI**: After getting a run ID via `gh run list`, always use `gh run watch <run-id>` instead of repeatedly polling `gh run view` or `gh run list`. `gh run watch` streams live job status and blocks until the run finishes.

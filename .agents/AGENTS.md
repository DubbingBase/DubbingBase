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
│   ├── database/     # Supabase configuration, local migrations, seeds, and Edge Functions
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
| `mise run curl-function <name> [--body <json> | --body @<file>]` | Curl an edge function locally. Reads `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` from `.env.development`. Supports `--body` for inline JSON, `--body @<file>` for file-based JSON, and stdin piping. |

### Generating Database TypeScript Types:

After making any database schema changes, run the following command to update TypeScript types in the app:

```bash
mise run gen-types
```

_(This command generates types to `packages/database/supabase/functions/_shared/database.types.ts`)._

---

## 💡 Best Practices by Component

### 1. Global / Front-end (Common Rules)

- **Strict TypeScript**: Always type variables, function signatures, and props. Types should strictly follow database types. Never cast using `as` and never use `any`.
- **Strict Edge Function Data Fetching**: NEVER perform inline Supabase database fetches (e.g. `supabase.from(...)`) directly from Vue components. All data fetching logic MUST go through centralized Supabase Edge Functions. Components should only call edge functions or receive data via props/Pinia stores. If an edge function does not return the data you need, update the edge function instead.
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

### 4. Database & Supabase (`packages/database`)

- **SQL Migrations**:
  - Never modify the local/remote schema directly. All database schema changes must go through a migration file.
  - To create a new migration: Run `pnpm supabase migration new <migration_name>` in the appropriate directory.
  - Migration files are stored in `packages/database/supabase/migrations`.
- **Querying Local Database**:
  - The local Supabase database runs on port `55322` (you can verify this by running `npx supabase status`).
  - To query the local DB from the terminal, use: `PGPASSWORD=postgres psql -h 127.0.0.1 -p 55322 -U postgres -d postgres -c "<query>"`.
- **Schema Cache (PostgREST)**:
  - If you encounter a `PGRST` error (e.g., "Could not find a relationship in the schema cache") when developing Edge Functions, it means the PostgREST cache is stale.
  - To reload the schema cache locally, run: `PGPASSWORD=postgres psql -h 127.0.0.1 -p 55322 -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';"`.
- **Seed Data**:
  - Keep `packages/database/supabase/seed.sql` up to date if you add new tables or reference data.
- **Edge Functions (Deno)**:
   - Written in TypeScript for Deno.
   - **No Import Map**: The `import_map.json` file has been deleted. Import dependencies directly from standard URLs (e.g., `https://esm.sh/...`) or native Deno/npm specifiers.
   - VS Code Deno configuration is active for `packages/database/functions`.
- **Curl Edge Functions Locally**:
  - Use `mise run curl-function <function-name> [--body <json> | --body @<file>]` to test edge functions from the CLI.
  - Reads `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` from `.env.development` (injected by mise).
  - Supports `--body` for inline JSON, `--body @<file>` for file-based JSON, and stdin piping.
  - Script location: `packages/database/curl-function.sh`
  - Examples:
    - `mise run curl-function search --body '{"query": "actor name"}'`
    - `echo '{"query": "actor"}' | mise run curl-function search`
    - `mise run curl-function extract-voice-actor-info --body '{"wikipediaUrl": "..."}'`

---

## 🤖 AI Agent Behavior Guidelines

1. **Research First**: Before writing code, inspect existing files, imports, and state to understand the setup.
2. **Preserve Comments**: Keep existing comments and docstrings unless explicitly told to remove them.
3. **Precise Code Changes**: Make targeted edits instead of rewriting large files.
4. **Validation**: Test compilation and run formatter tools before completing your turn.
5. **Local Environment Only**: NEVER execute or run production environment commands or actions (e.g., production database pushes, live deployments, remote mutations). Only target local development environments, and do NOT suggest production actions unless strictly and explicitly asked by the user.
6. **Token Saving**: Use `rtk` (binary) (https://github.com/rtk-ai/rtk) to save tokens whenever possible.

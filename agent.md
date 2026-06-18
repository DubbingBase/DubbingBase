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

All development tasks should ideally be run via **Mise** to ensure environment consistency:

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
pnpm sup:types
```

_(This command is defined in `apps/mobile/package.json` and outputs types to `packages/database/functions/_shared/database.types.ts`)._

---

## 💡 Best Practices by Component

### 1. Global / Front-end (Common Rules)

- **Strict TypeScript**: Always type variables, function signatures, and props. Avoid using `any`.
- **Vue 3**: Use the **Composition API** exclusively with `<script setup lang="ts">` syntax.
- **Formatting**: Always run `pnpm format` to format code with Prettier before committing.

### 2. Mobile Application (`apps/mobile`)

- **Transitioning Away from Ionic**:
  - **IMPORTANT**: The project is migrating **away from Ionic**. Do NOT introduce new Ionic components (`ion-*`) or Ionic router (`ion-router`).
  - Use standard HTML/Vue elements styled with Tailwind CSS or Sass for new features.
  - When editing existing screens, progressively refactor Ionic components into standard Vue/Tailwind components.
- **Capacitor**:
  - Keep Capacitor for native features/APIs (Camera, Haptics, Keyboard, StatusBar, etc.).
- **State Management**: Use **Pinia** for all global stores.
- **Styles**: Use scoped SCSS (`<style scoped lang="scss">`) or Tailwind CSS.

### 3. Web Application (`apps/website`)

- **Styling**: The website uses **Tailwind CSS v4**. Use Tailwind classes for all layouts and UI.
- **Data Grids**: Use **RevoGrid** (`@revolist/vue3-datagrid`) for complex tables.
- **Charts**: Use **Chart.js** via `vue-chartjs`.

### 4. Database & Supabase (`packages/database`)

- **SQL Migrations**:
  - Never modify the local/remote schema directly. All database schema changes must go through a migration file.
  - To create a new migration: Run `pnpm supabase migration new <migration_name>` in the appropriate directory.
  - Migration files are stored in `packages/database/supabase/migrations`.
- **Seed Data**:
  - Keep `packages/database/supabase/seed.sql` up to date if you add new tables or reference data.
- **Edge Functions (Deno)**:
  - Written in TypeScript for Deno.
  - **No Import Map**: The `import_map.json` file has been deleted. Import dependencies directly from standard URLs (e.g., `https://esm.sh/...`) or native Deno/npm specifiers.
  - VS Code Deno configuration is active for `packages/database/functions`.

---

## 🤖 AI Agent Behavior Guidelines

1. **Research First**: Before writing code, inspect existing files, imports, and state to understand the setup.
2. **Preserve Comments**: Keep existing comments and docstrings unless explicitly told to remove them.
3. **Precise Code Changes**: Make targeted edits instead of rewriting large files.
4. **Validation**: Test compilation and run formatter tools before completing your turn.

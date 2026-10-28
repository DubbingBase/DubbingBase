# AI Agent Instructions and Rules - DubbingBase

This file defines the project architecture, key development commands, and coding rules/best practices that must be strictly followed when making any changes to the codebase.

> **Precedence:** this root `AGENTS.md` is the repository’s single source of agent instructions. For generated codebase orientation (routes, schema, components, hot files), see [.codesight/AGENTS.md](.codesight/AGENTS.md) (codesight output — context only, not rules) and [.codesight/wiki/index.md](.codesight/wiki/index.md).

## Scope Boundary: Mobile Excluded

The mobile application is permanently out of scope for agent work. Agents MUST NOT inspect, search, edit, format, test, build, run, or otherwise include `apps/mobile`. Do not run repository-wide commands that transitively include the mobile workspace; use website-scoped validation instead. If a task would require a mobile change, stop and report the scope conflict.

---

## 🏗️ Project Architecture & Hierarchy

The project is a **pnpm workspace** orchestrated by Turborepo. Node.js and Deno versions are managed by Mise in [mise.toml](mise.toml).

```
apps/website/             # Nuxt website and admin dashboard
packages/database/        # Supabase configuration, migrations, seeds, generated types
packages/locales/
packages/og-image/
packages/shared-logic/
```

---

## 🛠️ Development Commands (via `mise`)

Use **Mise** for development tasks. Check `mise.toml` first; if it defines the task, run it with `mise run <task>`. Agent-safe scoped tasks include:

| Command                      | Description                                                       |
| :--------------------------- | :---------------------------------------------------------------- |
| `mise run website`           | Runs the website with Doppler and checks local Supabase settings. |
| `mise run website-typecheck` | Type checks only the website workspace.                           |
| `mise run build-web`         | Builds only the website workspace.                                |
| `mise run backend`           | Starts the local Supabase backend.                                |
| `mise run backend-stop`      | Stops the local Supabase backend.                                 |
| `mise run db-reset`          | Resets the local schema without seed data.                        |
| `mise run migrate-up`        | Applies pending local migrations.                                 |
| `mise run migrate-down`      | Rolls back the last local migration.                              |
| `mise run gen-types`         | Regenerates local database TypeScript types.                      |

Do not run repository-wide install, dev, formatting, build, or typecheck tasks: they include the excluded mobile workspace. The website and database install tasks are workspace-filtered.

### Generating Database TypeScript Types:

After making any database schema changes, run the following command to update TypeScript types in the app:

```bash
mise run gen-types
```

_(This command generates types to `packages/database/src/database.types.ts`)._

### Remote Website Testing via Tailscale or LAN:

When testing the website from a mobile device or other clients over Tailscale/LAN:

- Ensure the Supabase backend is running (`mise run backend`).
- Run the website dev server bound to all network interfaces with `mise run website`.
- Find your Tailscale IP on the `tailscale0` interface using `ip a` (e.g. `100.111.167.123`).
- Connect from the client browser at `http://<tailscale-ip>:3000` (or `3001` if port 3000 is occupied).

### Website Development with Doppler

Doppler is the source of truth for website environment variables. Use the unprefixed secret names consumed by `apps/website/nuxt.config.ts` (for example, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `TMDB_API_KEY`, `TVDB_API_KEY`, `IGDB_CLIENT_ID`, and `IGDB_CLIENT_SECRET`); do not duplicate values under `NUXT_*` names.

Configure once from the repository root with `doppler setup`, selecting project `dubbingbase` and config `dev` for local development. Never print secret values; inspect names only with `doppler secrets --only-names`.

The website requires both the local Supabase backend and the website server. Start them separately:

```bash
mise run backend
mise run website
```

The website task starts Doppler and checks the local Supabase environment; it does not start the backend. Stop the local backend with `mise run backend-stop` when finished.

---

## 💡 Best Practices by Component

### 1. Global / Front-end (Common Rules)

- **Strict TypeScript**: Always type variables, function signatures, and props. Types should strictly follow database types. Never cast using `as` and never use `any`.
- **Data Fetching Rules**:
  - **Simple single-table DB queries** (e.g. a single `supabase.from('table').select(...)`) MAY be performed directly without an API route, but **must always be encapsulated inside a dedicated API utility composable** (e.g. `useVoiceActorSubscription`). Never inline `supabase.from(...)` calls directly in Vue component `<script setup>` blocks.
  - **Complex requests** (multi-table joins, mutations with side effects, calls to external APIs, or any logic requiring elevated privileges) **MUST go through a Nuxt Nitro Server Route (`/api/...`)**.
  - If a composable is wrapping only simple DB queries, it does not need to route through a server API route. If the composable's logic grows in complexity, migrate it to a Nitro server route at that point.
- **Vue 3**: Use the **Composition API** exclusively with `<script setup lang="ts">` syntax.
- **Formatting**: Format only changed, in-scope files with the applicable formatter. `mise run format-staged` is suitable when the staged set is in scope. Do not run repository-wide `pnpm format` for agent work: it can touch excluded `apps/mobile` and unrelated files.
- **Design & Theme**: The website supports dark, light, and system themes. Use its semantic CSS tokens and preserve contrast across themes; avoid hard-coded palette values and default framework variables that do not match the active theme.
- **Presentation Layer Unified Types**: Create unified interfaces for display purposes (e.g., `DisplayMedia`, `DisplayVoiceActor`) instead of passing raw, complex database types (like union types such as `Movie | Serie`) directly to UI components. This allows the presentation layer to have unified and clean types, and isolates UI templates from underlying database schema complexities.

### 2. Web Application (`apps/website`)

- **Styling**: The website uses **Tailwind CSS v4**. Use Tailwind classes for all layouts and UI.
- **Data Grids**: Use **RevoGrid** (`@revolist/vue3-datagrid`) for complex tables.
- **Charts**: Use **Chart.js** via `vue-chartjs`.
- **Route Performance & Caching**: Follow [the website cache architecture skill](.agents/skills/website-cache-architecture/SKILL.md) when changing freshness, response headers, or persistent provider caching.
- **Progressive DOM Windowing**: Keep dynamic rosters and long card lists bounded. Use `PaginatedResponsiveGrid` or an equivalent bounded rendering pattern; do not render hundreds of cards at once.
  - **Client-side Search Filtering**: When filtering in-memory arrays via text search inputs, always debounce the query with `refDebounced(query, 150)` from `@vueuse/core` to prevent frame drops while typing.
  - **Resource Hints & Image Optimization**: Media pages must declare `preconnect` and `dns-prefetch` links in `useHead.link` for external CDNs (`https://image.tmdb.org`, `https://thetvdb.com`, `https://images.igdb.com`). Always add `loading="lazy"` and `decoding="async"` to non-hero `NuxtImg` elements.

### 3. Database & Supabase (`packages/database`)

- **SQL Migrations**:
  - Never modify the local/remote schema directly. All database schema changes must go through a migration file.
  - To create a new migration: Run `pnpm supabase migration new <migration_name>` in the appropriate directory.
  - Migration files are stored in `packages/database/supabase/migrations`.
- **Querying Local Database**:
  - The local Supabase database runs on port `55322` (you can verify this by running `npx supabase status`).
  - To query the local DB from the terminal, use: `PGPASSWORD=postgres psql -h 127.0.0.1 -p 55322 -U postgres -d postgres -c "<query>"`.
- **Seed Data**:
  - `seed.sql` is a production-derived local copy of mutable business data. Migrations own schema and constrain `dubbing_projects.language` to the supported regional dubbing-language set; shared TypeScript validates membership in the same set at application boundaries.

### Production-backed local refresh

Production-backed local refresh is opt-in and production access stays read-only. Follow [the production-backed local refresh skill](.agents/skills/production-backed-local-refresh/SKILL.md) for credentials, migration checkpoint checks, data dumps, and local reset/storage sync steps. Do not infer production migration status from the files in this repository.

---

### 4. External APIs (TMDB, TVDB, IGDB)

Backend routes in `apps/website/server/api/` handle integration with TMDB, TVDB, and IGDB with server-side caching.

---

## ✅ Verification — ship efficiently, protect production data

Shipping correct changes is the goal. Verification should provide useful
confidence in the affected behavior, not grow into repetitive test runs.
Use the smallest risk-appropriate checks that establish the task's acceptance
criteria. The mobile exclusion, production safety rules, and area-specific
mandatory regressions in this file always remain in force.

### Iteration and stopping rule

- Implement a coherent change before routine validation. Run a focused
  check sooner only when it resolves a concrete uncertainty.
- Plan one focused verification pass near completion. Do not run tests,
  typechecks, formatting or builds after every small edit.
- If a check fails, fix the cause and rerun the failed check and any other
  checks affected by that fix. Do not repeat previously successful checks
  when their relevant inputs have not changed.
- Prefer existing focused tests and meaningful regression assertions over
  testing incidental implementation details. Use browser journeys or
  screenshots when the actual user-facing interaction needs checking, not
  as an automatic second test suite.
- **Stop** when the acceptance criteria are met and the appropriate checks
  pass. Do not add a full build or another test round merely for reassurance.
  A genuine failure or unverified material risk is a reason to continue,
  not a reason to declare success.

### Choose verification by risk

- **Low risk** — docs, copy, isolated styling, and nonfunctional edits:
  inspect the diff and relevant rendered output if needed. Application
  tests, typechecks and builds are not required without a specific reason.
- **Normal risk** — website UI behavior, ordinary read-only API logic,
  typed interfaces, and bug fixes: run focused relevant tests; typecheck
  the affected website/package when types or contracts might be affected.
  Run a targeted browser check when unit tests cannot validate the changed
  interaction. Avoid unrelated workspace-wide checks.
- **High risk** — authentication/authorization, RLS or grants, privileged
  server routes, writes to user or editorial data, bulk imports, workflow
  queues, data transformations, schema migrations, backfills, and release
  behavior: use targeted integration/SQL tests in an isolated local
  environment, the affected typechecks/builds, and additional verification
  for plausible failure modes. These checks are required where relevant;
  shipping-first is not permission to skip data-safety evidence.

Prefer Mise tasks and scoped website/database commands over broad monorepo
commands. CI should handle routine full-suite verification; do not duplicate
it locally unless the change's risk, scope, or a failing CI job requires
investigation. Do not run commands that include `apps/mobile`.

### Database migrations and production-data safeguards

For any migration, backfill, destructive update, constraint, RLS/grant, or
data-integrity change, complete these gates **before claiming readiness**:

1. Inspect the existing migrations, current intended schema, dependencies,
   and deployment ordering. Review affected rows, constraints, foreign keys,
   triggers, permissions/RLS, and compatibility with the running website.
2. Rehearse migrations on isolated **local** Supabase, starting from the
   applicable prior schema or migration checkpoint. For data-dependent
   changes, use synthetic edge-case fixtures or a representative,
   authorized local snapshot. Check before/after row counts, relationships,
   uniqueness, security denials, and preservation of unrelated or manually
   curated data. A clean-schema migration pass alone is not sufficient
   evidence for a risky data transformation.
3. Inspect destructive or irreversible operations and define a practical
   rollback or forward-recovery strategy, including backup/restore
   considerations and whether the migration can safely coexist with a
   rolling application deployment. Regenerate database types with
   `mise run gen-types` when the schema changes.
4. Before any local reset or data-replacement command, confirm that the
   target is local and that disposable test data, not work worth preserving,
   will be erased. Never test writes against production or a linked remote
   database. No production write, remote migration, or manual deployment is
   authorized by this verification policy.
5. Production-derived fixtures are **not required by default**. Read-only
   production access or refresh requires the user's explicit request under
   the existing production-backed refresh rules. Never log, commit, or
   expose production records, dumps, tokens, or personal data.

If the needed local rehearsal or critical integrity evidence is unavailable,
report the gap and keep the high-risk change unverified; do not replace it
with repetitive unrelated tests. Preserve any more specific validation
requirements, including the revision-pinned Wikipedia dubbing corpus
regressions for relevant classifier/evidence changes.

### Report verification once

Summarize checks actually run, what passed or failed, material omissions,
and residual risk. Do not claim a check passed unless it ran successfully.
Reviewers should inspect the diff, Plane acceptance criteria, and available
evidence before repeating expensive checks. Shipping-first changes only
the amount of redundant validation, never the required product behavior,
security, or data-integrity guarantees.

---

## 🤖 AI Agent Behavior Guidelines

For changes to Wikipedia dubbing section selection, wikitext processing, regional
evidence classification, or queue evidence handling, read
[the Wikipedia corpus skill](.agents/skills/wikipedia-dubbing-corpus/SKILL.md) and run the
relevant revision-pinned real-page regressions described there.

For production Worker CPU investigations and optimizations, follow the
[Worker CPU profiling skill](.agents/skills/worker-cpu-profiling/SKILL.md), which owns
the capture, attribution, comparison, and reporting procedures.

For local CPU profiling of a website route with deterministic upstream mocks, follow
the [local route CPU profiling skill](.agents/skills/local-route-cpu-profiling/SKILL.md).
It covers both API handlers and full Nuxt SSR routes and requires verifying that test
middleware did not bypass the real route code.

1. **Research First**: Before writing code, inspect existing files, imports, and state to understand the setup.
2. **Preserve Comments**: Keep existing comments and docstrings unless explicitly told to remove them.
3. **Precise Code Changes**: Make targeted edits instead of rewriting large files.
4. **Validation**: Follow the risk-based **Verification** policy below. Do not require compilation or a repository-wide formatter run for every change; use the relevant focused checks and changed-file formatting.
5. **Wrangler / Cloudflare deploys**: Website deployments run through CI/CD on `main`. Do NOT run `wrangler deploy` locally. To pause or resume cron triggers, edit `crons` in `apps/website/wrangler.toml` and use the `main` branch deployment process.
6. **Production and local environments**: Never perform production writes, remote migrations, or live deployments. By default, target local development only. A production read to refresh local data is allowed only when the user explicitly requests it and the destination is local. **Never run `supabase db push` or `supabase functions deploy` directly.** All remote deployments must happen strictly through the CI/CD pipeline on the `main` branch.
7. **Scratch & Test Scripts**: Do NOT leave one-off test scripts (like `test_*.ts`) in the root of the project. If you need a script to test an external API or debug a function, place it in `scripts/scratch/` or use the `.gemini/scratch` folder.
8. **Caching Rules**: There is no local Redis cache. Save external fetch responses in `scripts/scratch/` when they need to be reused during the task.
9. **GitHub Actions — Use `gh run watch <run-id>` to monitor CI**: After getting a run ID via `gh run list`, always use `gh run watch <run-id>` instead of repeatedly polling `gh run view` or `gh run list`. `gh run watch` streams live job status and blocks until the run finishes.
10. **Changesets**: Every code or configuration change must include an appropriate Changesets file in `.changeset/`, scoped to the affected package(s). Never include `@app/mobile` unless mobile work is explicitly authorized.
11. **GitHub reviewers**: Never assign or request reviewers on GitHub pull requests.

---
name: production-backed-local-refresh
description: Safely refresh local DubbingBase database or Storage data from production after explicit user authorization.
---

# Production-backed local refresh

Use this only when the user explicitly asks to read production data for a local refresh. Production access is read-only. Resets, file replacement, and Storage writes must target local Supabase. Never push migrations, mutate remote data, or deploy as part of a refresh.

## Before the refresh

- Confirm the linked Supabase project and Doppler config are the intended production source; never print, persist, or commit credentials or production records.
- Use Doppler project `dubbingbase`, config `prd`. Required CLI secret names are `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD`; inspect names only.
- For a fresh checkout, link from `packages/database` with:

  ```sh
  doppler run --project dubbingbase --config prd -- mise exec -- npx supabase link --project-ref rrjgbneefiwoqvsjwzrz
  ```

- Check the remote applied migration history using read-only access before choosing a refresh path. Repository migration files alone do not prove production deployment status. Use the normal full data dump and local reset only after the production project has completed the regional mapping migration. Otherwise use the migration-checkpoint rehearsal documented in `docs/release-pipeline.md`.
- If `db dump` fails while initializing a temporary login role with `401 Unauthorized`, or asks for a database password, verify it is running with the `prd` Doppler config. If the CLI is already authenticated and linked, no login or link step is needed.

## Refresh local data

The repository database tasks use `database-install`, which installs only `@app/supabase` and its workspace dependencies. After confirming the destination is local and disposable data can be replaced, run:

```sh
doppler run --project dubbingbase --config prd -- mise run reseed
```

`fetch-seed` writes the full data-only production dump to ignored `packages/database/supabase/seed.sql`; `reseed` applies the normal local Supabase reset. Run `mise run sync-storage` separately when the user also requested a Storage refresh. Use `mise run db-reset` when only a fresh local schema is needed.

Migrations own the schema and supported regional dubbing-language constraint. Shared TypeScript validates the same language set. Preserve unrelated or manually curated local data unless the user confirmed it is disposable. Never expose production records, dumps, tokens, or personal data in logs, commits, or reports.

Apply production migrations through the CI/CD deployment workflow. Do not run `supabase db push` directly.

For a normal local database reset with local development seed data:

```bash
mise run db-reset
```

For an explicitly requested production-backed local rehearsal, fetches are read-only and all resets/imports target local Supabase:

```bash
doppler run --project dubbingbase --config prd -- mise run reseed
```

`fetch-seed` writes a data-only production dump to the ignored `packages/database/supabase/seed.sql`, excluding only `public.dubbing_languages`. Migrations own that deterministic reference table; the production snapshot supplies mutable application data. This is not a local/production merge: `db reset` recreates the local database from scratch before loading the selected seed.

To fetch a production seed without resetting local data:

```bash
doppler run --project dubbingbase --config prd -- mise run fetch-seed
```

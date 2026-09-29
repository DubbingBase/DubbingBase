Apply production migrations through the CI/CD deployment workflow. Do not run `supabase db push` directly.

For a normal local database reset with local development seed data:

```bash
mise run db-reset
```

For an explicitly requested production-backed local rehearsal, fetches are read-only and all resets/imports target local Supabase:

```bash
doppler run --project dubbingbase --config prd -- mise run reseed
```

The full production snapshot is stored at `packages/database/.local/production-data.sql`. `packages/database/supabase/seed.sql` is reserved for local development fixtures and is never overwritten by production data.

To fetch a production snapshot without resetting local data:

```bash
doppler run --project dubbingbase --config prd -- mise run fetch-seed
```

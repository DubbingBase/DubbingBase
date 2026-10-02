Apply production migrations through the CI/CD deployment workflow. Do not run `supabase db push` directly.

`mise run db-reset` builds the local schema from migrations without production data. `dubbing_projects.language` is non-null text constrained by the supported regional-code set in `public.is_valid_dubbing_language(text)`. Shared TypeScript uses the same supported-code list at request boundaries; this is a product-supported list, not a full CLDR/IANA registry.

For a production-backed local refresh, reset the local database with the complete production data dump, then synchronize Storage separately:

```bash
doppler run --project dubbingbase --config prd -- mise run reseed
doppler run --project dubbingbase --config prd -- mise run sync-storage
```

`reseed` runs the normal local `supabase db reset`; migrations run before the configured `seed.sql`. `sync-storage` downloads production objects and replaces configured local buckets through Supabase Storage CLI operations. Bucket definitions remain in `supabase/config.toml`; bucket files are not part of SQL seed preparation.

`fetch-seed` runs `supabase db dump --data-only --file supabase/seed.sql --linked`. It writes the full production dump to ignored `packages/database/supabase/seed.sql`; generated SQL is not rewritten. Production remains read-only; database reset and Storage synchronization write only to local Supabase.

The linked production database has not yet applied the regional mapping migration. Do not run `reseed` until that migration has been deployed through CI/CD, because current production project rows still use legacy codes rejected by the final local CHECK. Until then, use `mise run db-reset` and SQL fixtures for local validation.

To fetch a production seed without resetting local data:

```bash
doppler run --project dubbingbase --config prd -- mise run fetch-seed
```

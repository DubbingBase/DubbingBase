# Goal

Remove `public.dubbing_languages` as a data table.

Supported dubbing languages are application/schema rules, not mutable production data.

End state:

```text
dubbing_projects.language
→ text column
→ database CHECK constraint
→ matching TypeScript language list
```

And local reseeding becomes completely standard:

```text
supabase db dump --data-only
→ supabase db reset
```

No exclusions. No checkpoints. No `--sql-paths`. No seed rewriting.

## 1. Keep the lock-exhaustion fix

- [x] Keep the existing fix in `20260926130158_map_legacy_dubbing_project_regions.sql`.
- [x] Disable only `dubbing_project_regional_language_guard` during the controlled bulk migration.
- [x] Keep existing collision handling, dependency merging, snapshots and validation.
- [x] Keep the SQL regression proving the guard is disabled during mapping.

## 2. Remove `dubbing_languages` as a permanent table

The table is currently only acting as an allow-list.

- [x] Stop treating supported language codes as production rows.
- [x] Remove the final FK from `dubbing_projects.language` to `dubbing_languages`.
- [x] Replace it with a final `CHECK` constraint containing the supported regional codes.
- [x] Keep `language` as `text`.
- [x] Do not introduce a PostgreSQL enum.
- [x] Drop `public.dubbing_languages` once the migration no longer depends on it.

The final database invariant should be roughly:

```text
language IS NOT NULL
AND language is one of the supported regional codes
```

## 3. Adapt the regional migration

During `20260926130158`:

- [x] Keep whatever temporary registry/data is required while migrating legacy rows.
- [x] Map every legacy language code to its regional code.
- [x] Merge colliding projects exactly as today.
- [x] Verify no legacy or invalid language remains.
- [x] Install the final `NOT NULL` constraint.
- [x] Install the media + regional-language uniqueness constraint.
- [x] Install the final language `CHECK`.
- [x] Remove the temporary guard.
- [x] Remove the `dubbing_languages` table.

After this migration, the table must no longer exist.

## 4. Remove runtime DB lookups against `dubbing_languages`

Find every function/RPC that currently does:

```text
SELECT ... FROM public.dubbing_languages
```

and replace that validation with the schema-owned allowed-language rule.

- [x] Update `apply_reviewed_dubbing_languages`.
- [x] Update queue/resume functions.
- [x] Update regional project save/assignment functions.
- [x] Update any later migration redefining those functions.
- [x] Remove all FK/reference-table assumptions from generated types and SQL tests.

Prefer one reusable database validation helper if that avoids copying the full language list across many SQL functions.

For example:

```text
public.is_valid_dubbing_language(text) → boolean
```

Then:

- the column `CHECK` can call the helper if appropriate;
- RPCs can call the same helper;
- the supported-code list has one SQL definition.

Do not duplicate a giant `IN (...)` list across every function.

## 5. Keep TypeScript as the application-side source

- [x] Keep `DubbingLanguage`.
- [x] Keep `DUBBING_LANGUAGES`.
- [x] Keep `validateDubbingLanguage`.
- [x] Keep UI selections based on that shared list.
- [x] Add/keep a test proving the TypeScript list matches the SQL-supported list.

There should be two representations only:

```text
SQL schema rule
TypeScript application rule
```

No third production-data representation.

## 6. Remove all reseed special cases

- [x] Remove `--exclude public.dubbing_languages`.
- [x] Remove `--version 20260926094824`.
- [x] Remove `--sql-paths`.
- [x] Restore normal Supabase seed configuration.
- [x] Remove checkpoint-specific logic.
- [x] Remove seed SQL post-processing.
- [x] Remove any remaining custom restore machinery.

`fetch-seed` should become a plain production dump.

`reseed` should become a plain local reset.

Target:

```text
fetch-seed:
    supabase db dump --data-only --file supabase/seed.sql --linked

reseed:
    supabase db reset --local
```

Use the exact CLI syntax already supported by the installed Supabase version.

## 7. Simplify `prepare-seed.sh`

- [x] Remove all database/SQL manipulation.
- [x] Remove Perl regex rewriting.
- [x] Do not inspect or modify the generated seed.
- [x] If the file only exists for Storage, remove or rename it.

Database reseeding and Storage synchronization must be separate concerns.

## 8. Keep Storage simple and separate

- [x] Reuse/simplify `sync-storage.sh`.
- [x] Keep bucket declarations in `supabase/config.toml`.
- [x] Use Supabase Storage CLI operations instead of custom filesystem transaction machinery where possible.
- [x] Do not make Storage preparation part of SQL seed preparation.

Target:

```text
database → dump/reset
storage  → storage sync
```

## 9. Fix tests

Update tests to assert the new architecture.

- [x] Mapping migration still maps every supported legacy code.
- [x] Collision merges still preserve dependencies correctly.
- [x] Temporary regional guard is disabled during mapping.
- [x] Temporary guard is absent afterward.
- [x] `dubbing_projects.language` is `NOT NULL`.
- [x] Invalid regional codes are rejected by the final schema constraint.
- [x] Valid regional codes are accepted.
- [x] Media + region uniqueness still holds.
- [x] `public.dubbing_languages` no longer exists after the migration.
- [x] RPC validation still rejects unsupported codes.
- [x] TypeScript supported codes match the database-supported codes.

Remove tests whose only purpose was validating the registry table/FK.

## 10. Regenerate database types

Because a table is being removed:

- [x] Run `mise run gen-types`.
- [x] Confirm `dubbing_languages` disappears from generated Supabase table types.
- [x] Fix any code still referencing its generated type.

## 11. Clean documentation/config

- [x] Remove documentation describing `dubbing_languages` as migration-owned reference rows.
- [x] Remove seed exclusions from docs.
- [x] Remove checkpoint/rehearsal instructions from the permanent workflow.
- [x] Document the simple ownership model:

```text
Migrations
→ schema + allowed-language rules

Application
→ mutable business data

Seed
→ production-derived application data

Storage
→ separate sync
```

- [x] Keep one concise changeset for the Supabase package.

## 12. Validate the clean architecture

Fresh database:

```text
empty DB
→ all migrations
→ valid schema
```

Verify:

- [x] no seed is required for migrations to succeed;
- [x] supported-language validation exists;
- [x] no `dubbing_languages` table exists;
- [x] all DB functions compile.

Then test normal seeding:

```text
production dump
→ normal supabase db reset
```

Verify:

- [x] no excluded tables;
- [x] no duplicate-key workaround;
- [x] no checkpoint;
- [x] no custom SQL import path;
- [ ] production application data loads successfully.

## 13. Full verification

- [x] Regional SQL fixtures.
- [x] Queue/requester SQL fixtures.
- [x] Website tests.
- [x] Website typecheck.
- [x] Supabase typecheck.
- [x] `mise run gen-types`.
- [x] `mise run check`.
- [x] `mise run format-staged`.
- [x] `git diff --check`.
- [x] No production writes during development validation.
- [x] Leave `apps/mobile` untouched.

# Final architecture

```text
Supported dubbing languages
        │
        ├── SQL schema validation
        │
        └── shared TypeScript constants

Production DB
        │
        └── actual projects / works / votes / users / etc.

Local refresh
        │
        ├── plain production data dump
        ├── plain supabase db reset
        └── separate Storage sync
```

The key invariant is:

**Supported dubbing languages are schema/application configuration, not production rows. Therefore no reference table, seed exclusion, checkpoint, or restore special case is needed.**

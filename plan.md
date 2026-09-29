# Goal

Keep the migration lock fix from PR #136, and simplify the local reseed workflow so it has one clear semantic:

**Production data completely replaces local data before pending migrations are applied.**

No merging. No table exclusions. No temporary mutation of `supabase/config.toml`.

`apps/mobile` remains out of scope.

---

## 1. Keep the migration fix

Keep the change in:

`20260926130158_map_legacy_dubbing_project_regions.sql`

The temporary regional-language guard must be disabled during the controlled bulk mapping so the migration does not accumulate thousands of transaction-scoped advisory locks.

Keep the existing regression coverage proving:

- the guard exists before the mapping migration;
- it is disabled during language updates;
- it is removed by finalization;
- all regional-language constraints are installed afterward.

Do not change PostgreSQL lock settings.

Do not weaken the existing migration validation or merge logic.

---

## 2. Restore `fetch-seed` to a full production dump

`fetch-seed` should fetch the complete intended production data snapshot.

Remove the `dubbing_languages` exclusion.

The task should not know about migration-specific tables or pending migration implementation details.

Its responsibility is only:

**production → snapshot file**

---

## 3. Stop using the production snapshot as an automatic Supabase seed

The production snapshot should not live at a path automatically executed by `supabase start` or normal `supabase db reset`.

Use a dedicated local snapshot path instead.

For example:

`packages/database/.local/production-data.sql`

The exact path can differ, but the distinction must be clear:

- normal Supabase seed data is normal local/dev seed data;
- production snapshot data is used only by the production-reseed workflow.

This removes the need to modify `[db.seed]` dynamically.

---

## 4. Remove the `config.toml` mutation workaround

Delete the reseed logic that:

- reads `[db.seed].enabled`;
- rewrites `supabase/config.toml`;
- installs an exit trap;
- restores the previous value afterward.

The reseed task should never modify tracked configuration files just to control execution order.

`--no-seed` remains appropriate when resetting to the migration checkpoint.

---

## 5. Reset local schema to the production checkpoint

The reseed flow should still reset the local database to:

`20260926094824`

This establishes the same schema version production currently has before the regional mapping migration.

The reset should not automatically import any seed data.

After this step:

- schema matches the production migration checkpoint;
- local application data is not considered authoritative;
- any data created by checkpoint migrations will be replaced by the production snapshot.

---

## 6. Replace local data with the production snapshot

Before importing the production snapshot, clear the local rows for every table represented by that snapshot.

This must be a generic replacement mechanism.

Do not special-case:

- `dubbing_languages`;
- regional migration tables;
- individual business tables.

The set of tables to clear should be derived from the production snapshot itself, or from another authoritative representation of what the snapshot contains.

The restore contract is:

**all snapshot-owned local rows are removed first, then the production snapshot is imported.**

---

## 7. Preserve schema objects while replacing data

The reseed operation should replace data only.

It must not recreate or overwrite:

- tables;
- constraints;
- functions;
- triggers;
- policies;
- migration history.

Those belong to migrations.

The production snapshot remains data-only.

---

## 8. Handle the temporary regional guard only where necessary

At the checkpoint, production still contains legacy language values.

The temporary regional-language guard therefore needs to be bypassed while restoring the production snapshot.

Only that specific trigger should be disabled.

Once the production snapshot has been restored, return the checkpoint schema to its expected state before continuing with pending migrations.

Do not disable all triggers.

Do not globally bypass trigger execution.

---

## 9. Make the restore atomic

The data replacement should happen as one controlled restore operation:

1. prepare the checkpoint schema;
2. temporarily bypass the regional guard;
3. clear snapshot-owned local data;
4. import the complete production snapshot;
5. restore the expected trigger state;
6. finish the restore successfully or roll it back.

A failed import must not leave a half-replaced local database.

---

## 10. Apply pending migrations afterward

Only after the production snapshot has fully replaced local data should the remaining migrations run.

This means the local database passes through two explicit states:

### Before pending migrations

**Schema:** production checkpoint

**Data:** production snapshot

### After pending migrations

**Schema:** PR head

**Data:** production snapshot transformed by the PR migrations

This is the state the migration rehearsal is intended to test.

---

## 11. Keep Storage restoration separate

Keep the existing Storage download/restore mechanism separate from PostgreSQL data restoration.

The same replacement principle applies:

- stale local Storage objects should not be merged indefinitely with production;
- the local Storage state should represent the fetched production snapshot.

Do not mix Storage object handling into the database restore implementation.

---

## 12. Simplify task responsibilities

The resulting task model should be easy to understand.

### `fetch-seed`

Fetch the complete production data snapshot.

### `prepare-seed`

Prepare downloaded production data and Storage assets for local restoration.

No migration-specific data filtering.

### `reseed`

- rebuild local schema to the production checkpoint;
- replace local data with the production snapshot;
- restore production Storage state;
- apply pending migrations.

No configuration rewriting.

No production writes.

---

## 13. Avoid depending on Supabase Docker internals

Do not rely on a hard-coded container name derived from `project_id` unless there is no supported alternative.

Prefer connecting to the local Postgres service through the normal local database connection details.

The reseed workflow should depend on the local database interface, not on an implementation detail of how Supabase names Docker containers.

---

## 14. Verify replacement semantics explicitly

Add validation proving that reseed is a replacement operation.

Test from a dirty local database containing:

- local-only rows;
- modified production-derived rows;
- extra reference rows.

After the production snapshot restore, before pending migrations:

- local-only rows must be gone;
- modified rows must match production again;
- production rows must be present;
- reference tables such as `dubbing_languages` must match production exactly.

This is the key regression test for the new reseed semantics.

---

## 15. Verify the production checkpoint

Immediately after restoring the snapshot and before applying pending migrations, compare important local data against production read-only.

At minimum verify:

- `dubbing_projects` count;
- `work` count;
- `dubbing_languages` count and code set;
- any other tables materially involved in the regional migration.

At this point, local should match production data, not a mixture of production and local migration-generated rows.

---

## 16. Validate the regional migration afterward

Apply all pending migrations locally.

Verify the expected final invariants:

- no null dubbing-project languages;
- no unregistered dubbing-project languages;
- no duplicate media/type/region projects;
- regional-language foreign key present;
- regional-language column non-null;
- media/type/region uniqueness present;
- temporary regional guard removed.

The previously validated production-derived counts should remain consistent unless a justified change is introduced.

---

## 17. Run the existing SQL regression suite

Run the relevant fixtures, including:

- regional dubbing languages;
- legacy region mapping;
- regional voice-cast assignments;
- regional review queue;
- requester provenance.

Keep the new trigger-state assertions from PR #136.

---

## 18. Update the Changeset

Update the existing PR #136 Changeset to describe both fixes:

- prevent lock exhaustion during regional mapping;
- make production-derived reseeding replace local data rather than merge with it.

Do not add a mobile Changeset.

---

## 19. Final validation

Run the production-derived reseed from a deliberately dirty local database.

Then run:

- website tests;
- website typecheck;
- Supabase typecheck;
- website build/check;
- format-staged;
- `git diff --check`.

Regenerate database types only if the schema contract changes.

Do not run mobile tasks.

---

# Definition of done

PR #136 is ready when:

- the migration lock fix remains intact;
- `fetch-seed` produces a complete production data snapshot;
- no production table is excluded solely to avoid local duplicate rows;
- the production snapshot is no longer treated as an automatic Supabase seed;
- `config.toml` is never rewritten by reseed;
- local snapshot-owned data is cleared before import;
- the clear/restore behavior is generic rather than table-specific;
- reseed removes local-only data;
- immediately before pending migrations, local data matches production;
- pending regional migrations succeed against that production snapshot;
- all final regional constraints and invariants pass;
- SQL fixtures pass;
- website/Supabase validation passes;
- production remains read-only during development validation;
- `apps/mobile` remains untouched.

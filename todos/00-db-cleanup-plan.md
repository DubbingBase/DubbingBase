# DB Model Cleanup — Plan

## Severity Legend

- 🔴 HIGH — can cause runtime bugs or data integrity issues
- 🟡 MEDIUM — affects maintainability / performance
- 🟢 LOW — polish / edge cases

---

## Task 1: 🔴 HIGH — Remove redundant `work.content_id` / `work.content_type` columns

**Why**: `work` should reference `dubbing_projects` (the canonical table) via `dubbing_project_id`. The two columns on `work` are stale denormalization that drift over time. Some APIs read from the join, some read the stale columns.

**Steps**:

1. Audit all code that reads/writes `work.content_id` or `work.content_type` directly
2. Replace those reads/writes with joins to `dubbing_projects`
3. Create a migration that drops the columns after all code paths are verified
4. Verify with typecheck

**Files to audit**:

- `apps/website/server/api/get-user-voice-actor.ts:142`
- `apps/website/server/api/process-credits.post.ts:82,91`
- Any other file using `work.content_id` or `work.content_type`

**Skipped**: keeping the unique constraint `work_unique(voice_actor_id, content_id, actor_id, content_type)` until Task 5 is resolved.

---

## Task 2: 🔴 HIGH — Fix `work.actor_id = 0` sentinel vs NOT NULL constraint

**Why**: `work.actor_id` is `NOT NULL` but my recent voice-actor-edit flow uses `actor_id = 0` to mean "manual entry, no external actor". This either violates the constraint at runtime, or `0` silently means "no actor" while a real actor with id=0 would conflict.

**Options**:

- **A** (preferred): make `work.actor_id` nullable, set to `NULL` for manual entries
- **B**: keep `NOT NULL`, use a real placeholder row in `actors` table

**Steps**:

1. Decide on A or B
2. Update schema (migration)
3. Update `link-voice-actor.post.ts` to insert `null` (or placeholder id)
4. Update `internal-media-create.post.ts` similarly
5. Update `add-voice-cast/[id].vue` to send `null`
6. Update `voice-actor/[id]/edit.vue` modal to send `null`
7. Verify with typecheck + browser smoke test

---

## Task 3: 🟡 MEDIUM — Add ENUM or CHECK constraint on `content_type`

**Why**: Plain TEXT allows typos. An enum makes invalid states unrepresentable.

**Steps**:

1. Choose: `CREATE TYPE content_type_enum AS ENUM ('movie', 'tv', 'video_game', 'audiobook', 'podcast', 'advertisement', 'toy')` OR `CHECK (content_type IN (...))`
2. Apply to `dubbing_projects.content_type` and `work.content_type`
3. Update DB types via `supabase gen types` (if regenerated)
4. Update any code that passes non-standard values
5. Verify with `psql` insert test

**Recommendation**: CHECK constraint — easier to evolve without needing ALTER TYPE.

---

## Task 4: 🟡 MEDIUM — Add ON DELETE behavior to `work.source_id` FK

**Why**: Current FK has no `ON DELETE` clause → orphaned work rows possible.

**Steps**:

1. Migration: `ALTER TABLE work DROP CONSTRAINT work_source_id_fkey; ALTER TABLE work ADD CONSTRAINT work_source_id_fkey FOREIGN KEY (source_id) REFERENCES source(id) ON DELETE SET NULL;`
2. Decide: SET NULL vs CASCADE (work rows have no value without a source → SET NULL)

---

## Task 5: 🟡 MEDIUM — Add missing indexes

**Why**: Joins from `work → dubbing_projects` and `work → voice_actors` are common; without indexes they full-scan.

**Migration**:

```sql
CREATE INDEX IF NOT EXISTS idx_work_dubbing_project_id ON work(dubbing_project_id);
CREATE INDEX IF NOT EXISTS idx_work_voice_actor_id ON work(voice_actor_id);
CREATE INDEX IF NOT EXISTS idx_work_voice_actor_status ON work(voice_actor_id, status);
CREATE INDEX IF NOT EXISTS idx_work_actor_id ON work(actor_id);
```

**Verify**: `EXPLAIN ANALYZE` on common queries before/after.

---

## Task 6: 🟢 LOW — Fix `work.performance` default for non-dubbing media

**Why**: `DEFAULT 'dialogues'` is wrong for ad/toy/podcast/audiobook which may be narration/singing/voice-only.

**Steps**:

1. Migration: `ALTER TABLE work ALTER COLUMN performance DROP DEFAULT;`
2. Make the column NULL-able OR set `NULL` as default
3. Update any inserts that rely on the default

---

## Task 7: 🟢 LOW — Resolve work_unique constraint vs manual entries

**Why**: `UNIQUE (voice_actor_id, content_id, actor_id, content_type)` — with `actor_id = NULL` (after Task 2), NULLs are not deduplicated in Postgres unique constraints by default. Two manual entries for the same voice actor + media could both succeed.

**Options**:

- **A**: use `UNIQUE NULLS NOT DISTINCT` (PG 15+)
- **B**: drop the constraint, enforce in app code
- **C**: change to a partial unique index `WHERE actor_id IS NOT NULL`

**Recommendation**: C — keep the original constraint strict for actor-backed entries, allow unlimited manual entries.

**Migration**:

```sql
ALTER TABLE work DROP CONSTRAINT work_unique;
CREATE UNIQUE INDEX work_unique_actor
  ON work (voice_actor_id, content_id, content_type, actor_id)
  WHERE actor_id IS NOT NULL;
CREATE UNIQUE INDEX work_unique_manual
  ON work (voice_actor_id, content_id, content_type, character_name)
  WHERE actor_id IS NULL;
```

(Note: requires `work.character_name` — verify it exists; if not, add the column first.)

---

## Execution Order

1. Task 2 (actor_id NULL) — **blocks Task 7**, unblocks manual-entry flow
2. Task 1 (remove redundant columns) — depends on Task 2 to avoid losing manual-entry data
3. Task 3 (ENUM/CHECK) — independent, can run in parallel
4. Task 4 (FK ON DELETE) — independent
5. Task 5 (indexes) — independent, zero-risk
6. Task 6 (default) — independent
7. Task 7 (unique constraint) — depends on Task 2

---

## Verification Checklist (per task)

- [ ] `nuxt typecheck` passes
- [ ] Migration runs cleanly on a fresh DB
- [ ] No data loss: existing rows preserved
- [ ] Browser smoke test: link new work for each media type
- [ ] No new lint errors (existing ones OK)

---

## Out of Scope

- Renaming `content_id` to `media_id` (cosmetic, low value)
- Splitting `dubbing_projects` into `media` + `dubbing_projects` (over-engineering for current scale)
- Materialized views / analytics tables (premature)

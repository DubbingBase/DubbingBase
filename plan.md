# Goal

Replace the current per-project migration loop with a simple two-path migration:

```text
simple rename → bulk UPDATE
real collision → merge
```

Current production shape:

```text
12,057 legacy projects
11,952 simple renames
105 merges
  - 104 en + simple → en-US
  - 1 fr + fr-FR → fr-FR
```

## 1. Remove the temporary guard immediately

At the start of `20260926130158`:

```sql
DROP TRIGGER dubbing_project_regional_language_guard
ON public.dubbing_projects;
```

Do not disable it first.

This removes the advisory-lock problem completely.

## 2. Keep one temporary legacy mapping table

Keep only:

```text
legacy_code → regional_code
```

for the one-time migration.

Examples:

```text
fr     → fr-FR
en     → en-US
simple → en-US
zh-yue → yue-HK
```

No permanent language registry.

## 3. Identify collision groups first

Before changing rows, determine which projects would collide after mapping:

```text
same content_id
same content_type
same final regional language
```

These projects are excluded from the bulk update.

The migration must detect collisions generically rather than hardcoding the current count of 105.

## 4. Bulk-update all non-colliding projects

Replace thousands of calls to `apply_reviewed_dubbing_languages()` with one set-based update:

```sql
UPDATE dubbing_projects
SET language = mapping.regional_code
FROM mapping
WHERE ...
  AND project does not belong to a collision group;
```

Expected production effect:

```text
~11,952 rows
→ one ordinary UPDATE
```

No snapshots.  
No JSON decisions.  
No merge helper calls.

## 5. Merge only actual collisions

Use the existing safe merge logic only for collision groups.

Expected production:

```text
105 source projects merged
```

Survivor rule:

- existing regional project wins when one exists;
- otherwise choose one deterministic legacy survivor;
- for `en` + `simple`, prefer `en`, then regionalize it to `en-US`.

Preserve:

- work;
- votes;
- crew;
- attachments;
- audit-log references;
- conflicting metadata handling.

Keep review snapshots only for these actual merges.

## 6. Finalize directly

After rename + merges:

Validate:

```text
no legacy language remains
no NULL language
all languages match ^[a-z]{2,3}-[A-Z]{2}$
no duplicate content/type/language groups
```

Then directly install:

```text
language NOT NULL
CHECK (language ~ '^[a-z]{2,3}-[A-Z]{2}$')
UNIQUE (content_id, content_type, language)
```

No finalizer function.

## 7. Remove temporary migration machinery

At the end drop:

```text
dubbing_languages
guard_dubbing_project_language()
finalize_dubbing_language_constraints()
apply_reviewed_dubbing_languages()
dubbing_language_review_snapshot()
```

Keep `dubbing_language_reviews` only if we want historical snapshots of the actual merges.

## 8. Simplify tests

Test three things:

```text
ordinary legacy row
→ bulk renamed correctly

en + simple collision
→ safely merged into en-US

legacy + existing regional collision
→ existing regional project survives
```

Also verify:

```text
final CHECK
NOT NULL
UNIQUE
temporary table/functions/trigger absent
dependencies preserved
```

Do not test permanent registry behavior because there is no registry.

## 9. Keep the rest of the PR simple

Keep:

```text
plain production data dump
plain supabase db reset
separate Storage sync
regex validation in TypeScript
UI options separate from validity
```

Also clean remaining wording like:

```text
"registered regional language"
```

to:

```text
"regional dubbing language"
```

## Final migration shape

```text
DROP temporary guard
        ↓
calculate collisions
        ↓
bulk rename ~11,952 projects
        ↓
merge ~105 collision projects
        ↓
validate
        ↓
install final constraints
        ↓
drop temporary migration machinery
```

The main invariant is:

**Do simple data transformations with set-based SQL. Use complex merge machinery only for rows that actually need merging.**

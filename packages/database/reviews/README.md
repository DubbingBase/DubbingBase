# Regional dubbing language review

The initial migration blocks new regionless projects. The unapplied base-region migration converts legacy language-only project codes using the user's approved default-region rule, merges into an existing target project when one exists, snapshots the original data, and finalizes regional constraints. It leaves UI locale codes, Wikipedia editions, and TMDB original languages in their own formats.

Generate the local report after applying the initial migration:

```sh
mise exec -- python3 scripts/audit-dubbing-languages.py
```

The report is saved in `scripts/scratch/dubbing-language-audit.json`. It includes complete dependency snapshots, hashes, source-job identifiers, and any existing regional sibling. Source language and studio/cast nationality alone do not establish the dubbing market. The base-region migration records the user's explicit default-region policy; use project-level evidence when a different region is known.

Record approved decisions in `dubbing-languages.json`:

```json
{
  "decisions": [
    {
      "project_id": 123,
      "target_language": "fr-FR",
      "approved_by": "user review, YYYY-MM-DD",
      "evidence_url": "https://source.example/confirmed-regional-credits",
      "evidence_quote": "The source's explicit regional identification",
      "expected_snapshot_hash": "hash from the reviewed audit",
      "survivor_id": 456,
      "expected_target_snapshot_hash": "hash from the reviewed survivor",
      "keep_project_metadata": "survivor",
      "work_decisions": [],
      "vote_decisions": []
    }
  ],
  "finalize": false
}
```

Omit `survivor_id` and its hash for reclassification without a merge. Conflicting assignments require `{ "source_work_id": 1, "survivor_work_id": 2, "keep": "source" }` or `"survivor"`. Conflicting votes use the corresponding `source_vote_id` and `survivor_vote_id` keys. No conflict is silently resolved. Add newly verified regional codes to the shared registry and a migration before using them.

Create an empty migration through the CLI, then render the approved manifest into it:

```sh
mise exec -- pnpm --filter @app/supabase exec supabase migration new reviewed_dubbing_regions
mise exec -- python3 scripts/audit-dubbing-languages.py \
  --approved-manifest packages/database/reviews/dubbing-languages.json \
  --output-migration packages/database/supabase/migrations/<CLI-created-file>.sql
```

Application is transactional and records complete before snapshots in the owner-only `dubbing_language_reviews` table. Changed snapshots, conflicting values, or unsupported regional codes abort the migration. Audit records are reparented while their original JSON evidence and the snapshots retain history. Merge decisions retain all crew and attachments; repeated equivalent credits/votes become one assignment/vote, with originals preserved in snapshots.

The base-region migration finalizes after converting every mapped legacy code. It aborts transactionally if an unmapped code or duplicate media/region remains. Later reviewed migrations may set `finalize` only after their own audit. Finalization installs the foreign key, non-null requirement, and unique constraint. Regenerate types with `mise run --skip-deps gen-types` after schema changes. Local schema changes always use migration files. Remote application remains exclusively through CI when explicitly authorized.

Recovery: restore an affected project's snapshot in a new reviewed migration, including its dependent records and audit identifiers. The original snapshots remain immutable review records; never rewrite migration history or discard the remaining backlog to enable finalization.

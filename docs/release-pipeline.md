# Production release pipeline

`.github/workflows/pipeline.yml` runs for branch pushes and manual dispatches. Branch runs validate changes, but production migrations and production deployments are limited to `main`.

## Validation and deployment order

Changes under `packages/database/**` trigger an isolated local Supabase replay, generated-type verification, database package typecheck, pgTAP, and the website E2E, unit, typecheck, i18n, whitespace, and build checks. Website source changes run the same website checks and lint the changed website source files with Vue rules. The release lint job also scans the full website against the base revision and fails on new diagnostics; existing diagnostics in untouched files remain separate lint-debt work. Pipeline-only changes also run local migration replay and website validation, but do not trigger a production migration or website deployment.

`release-validation` requires every applicable check to finish successfully, including a successful website lint job for website, database, and pipeline validation. Oxlint scans the full website against the base revision and separately applies the normal lint check to changed website source files. Only changes under `packages/database/**` can trigger `deploy-supabase` on `main`, and only after the local migration replay and all applicable release checks pass. The production access token is scoped to the project-link and migration steps.

A migration that is already on `main` but was never applied (for example because the push that merged it touched no `packages/database/**` files) can be applied without a dummy change: dispatch the pipeline on `main` with `force_database_deploy` (`gh workflow run pipeline.yml --ref main -f force_database_deploy=true`). It runs the full database and website validation on the current commit, then `deploy-supabase` applies every pending migration with `supabase db push --include-all --yes --remote`. It does not deploy the Worker, and it is ignored when `force_website_deploy` is also set. Check which migrations are pending first, and take a backup or PITR marker before a destructive one.

The production-compatible website build is created before the gate. Branch builds use mock values; only the main-branch production build receives website secrets. The E2E server uses its local mock configuration without production credentials. On `main`, `deploy-website` waits for the validation gate and either a successful migration or an intentional migration skip when no database files changed. It deploys that artifact without building a second time.

Only the website PWA is deployed. Native mobile builds and the Android Play Store deployment have been retired.

## Failure, cancellation, and migration safety

Required checks must report `success`; a skipped or cancelled check cannot satisfy the validation gate. A failed or skipped preflight prevents the production migration job from starting. A failed or cancelled migration prevents the website deployment. A migration job may be skipped for a website-only release, but that skip is accepted only when path detection reports no database changes.

Main-branch runs are not cancelled by newer commits, so a production migration is not interrupted by the workflow concurrency setting. Non-main runs remain cancellable. The production Supabase token is scoped to the main-only migration job; local migration validation has no production credentials.

CI replays migrations on an empty local database and runs the repository's pgTAP tests. Data-dependent migrations still need realistic isolated local fixtures or a migration-checkpoint rehearsal. Production migrations should use backwards-compatible expand/contract steps when the current website may continue serving requests during the schema change. Do not assume a production migration can be rolled back.

## Media identity cut-over (`20261123160000_media_identity.sql`)

This migration drops `dubbing_projects.content_id/content_type`, `toy_metadata.content_id` and `game_characters.igdb_game_id`, so it is not an expand/contract change: the previous website build reads those columns and returns errors on uncached media, actor, studio, search and admin routes from the moment the migration commits until the new Worker is live. The RPC signatures are unchanged, so old callers of the save functions keep working.

- Deploy the migration and the Worker back to back, during low traffic, and pause the cron triggers in `apps/website/wrangler.toml` and the queue consumers around the switch.
- The migration sets `lock_timeout = '5s'` and runs in one transaction: if it cannot take its table locks it applies nothing and can simply be rerun.
- There is no down migration. Take a database backup or PITR marker first; recovery is a restore.
- Toys and advertisements keep their positive legacy ids as `media.id`; negative legacy ids get new ids.
- `mise run reseed` loads the production dump at production's schema version and then applies newer migrations on top of the data, so a column-changing migration can be rehearsed against real data locally.

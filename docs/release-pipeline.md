# Production release pipeline

`.github/workflows/pipeline.yml` runs for branch pushes and manual dispatches. Branch runs validate changes, but production migrations and production deployments are limited to `main`.

## Validation and deployment order

Changes under `packages/database/**` trigger an isolated local Supabase replay, generated-type verification, database package typecheck, pgTAP, and the website E2E, unit, lint, typecheck, i18n, whitespace, and build checks. Website source changes run the same website checks. Pipeline-only changes also run local migration replay and website validation, but do not trigger a production migration or website deployment.

`release-validation` requires every applicable check to finish successfully. Website lint runs when website source or database migration files change; documentation, test configuration, and workflow-only changes do not re-lint the unchanged website source. Only changes under `packages/database/**` can trigger `deploy-supabase` on `main`, and only after the local migration replay and all applicable release checks pass. The production access token is scoped to the project-link and migration steps.

The production-compatible website build is created before the gate. For deployable website changes on `main`, CI verifies the required `assetlinks.json` and rejects unexpected hidden build paths before uploading the short-lived artifact, so the `.well-known` file survives artifact transfer. Branch builds use mock values; only the main-branch production build receives website secrets. The E2E server uses its local mock configuration without production credentials. On `main`, `deploy-website` waits for the validation gate and either a successful migration or an intentional migration skip when no database files changed. It deploys that artifact without building a second time.

The mobile web deployment remains tied to mobile-path changes. It waits for the same validation gate when website or database paths also changed, and accepts a skipped migration only when no database paths changed. The Android Play Store job is currently disabled with `if: false`.

## Failure, cancellation, and migration safety

Required checks must report `success`; a skipped or cancelled check cannot satisfy the validation gate. A failed or skipped preflight prevents the production migration job from starting. A failed or cancelled migration prevents the website deployment. A migration job may be skipped for a website-only release, but that skip is accepted only when path detection reports no database changes.

Main-branch runs are not cancelled by newer commits, so a production migration is not interrupted by the workflow concurrency setting. Non-main runs remain cancellable. The production Supabase token is scoped to the main-only migration job; local migration validation has no production credentials.

CI replays migrations on an empty local database and runs the repository's pgTAP tests. Data-dependent migrations still need realistic isolated local fixtures or a migration-checkpoint rehearsal. Production migrations should use backwards-compatible expand/contract steps when the current website may continue serving requests during the schema change. Do not assume a production migration can be rolled back.

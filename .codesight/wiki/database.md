# Database

> **Navigation aid.** Schema shapes and field types extracted via AST. Read the actual schema source files before writing migrations or query logic.

**unknown** — 27 models

### voice_actors

fk: tmdb_id

- `id`: bigint _(required)_
- `tmdb_id`: bigint _(fk)_

### source

fk: user_id

- `id`: bigint _(required)_
- `user_id`: bigint _(fk)_
- `suggested_at`: timestamp without time zone _(default)_

### work

fk: content_id, actor_id, voice_actor_id, source_id

- `id`: bigint _(required)_
- `content_id`: bigint _(required, fk)_
- `actor_id`: bigint _(required, fk)_
- `voice_actor_id`: bigint _(fk)_
- `highlight`: boolean _(default)_
- `source_id`: bigint _(fk)_

### user_profiles

pk: `id` (uuid) · fk: user_id

- `id`: uuid _(pk)_
- `user_id`: uuid _(required, fk)_
- `bio`: text
- `nationality`: text
- `date_of_birth`: date
- `social_media_links`: jsonb

### user_profile_links

pk: `id` (uuid) · fk: user_id, profile_id

- `id`: uuid _(pk)_
- `user_id`: uuid _(required, fk)_
- `profile_id`: uuid _(required, fk)_

### user_voice_actor_links

pk: `id` (uuid) · fk: user_id, voice_actor_id

- `id`: uuid _(pk)_
- `user_id`: uuid _(required, fk)_
- `voice_actor_id`: integer _(required, fk)_

### votes

pk: `id` (bigint) · fk: user_id, work_id

- `id`: bigint _(pk)_
- `user_id`: uuid _(required, fk)_
- `work_id`: bigint _(required, fk)_
- `vote_type`: text _(required)_

### dubbing_projects

pk: `id` (bigint) · fk: content_id

- `id`: bigint _(pk)_
- `content_id`: bigint _(required, fk)_
- `content_type`: text _(required)_
- `language`: text _(default)_
- `studio`: text
- `artistic_director`: text
- `adaptation`: text
- `recording`: text
- `editing`: text
- `mixing`: text
- `project_manager`: text
- `creative_supervision`: text
- `status`: text

### studios

pk: `id` (bigint)

- `id`: bigint _(pk)_
- `name`: text _(required)_
- `description`: text
- `country`: text
- `city`: text
- `website_url`: text
- `logo_url`: text

### dubbing_project_crew

pk: `id` (bigint) · fk: dubbing_project_id, person_id

- `id`: bigint _(pk)_
- `dubbing_project_id`: bigint _(required, fk)_
- `person_id`: bigint _(required, fk)_
- `job`: text _(required)_

### jobs

pk: `id` (bigint)

- `id`: bigint _(pk)_
- `name`: text _(required)_

### project_attachments

pk: `id` (bigint) · fk: dubbing_project_id

- `id`: bigint _(pk)_
- `dubbing_project_id`: bigint _(required, fk)_
- `file_path`: text _(required)_
- `file_name`: text _(required)_
- `description`: text
- `created_by`: uuid _(default)_

### voice_actor_subscriptions

fk: user_id, voice_actor_id

- `user_id`: uuid _(required, fk)_
- `voice_actor_id`: bigint _(required, fk)_

### user_reports

pk: `id` (uuid) · fk: reporter_id

- `id`: uuid _(pk)_
- `reporter_id`: uuid _(required, fk)_
- `target_url`: text _(required)_
- `reason`: text _(required)_
- `details`: text

### audit_logs

pk: `id` (uuid) · fk: user_id, entity_id

- `id`: uuid _(pk)_
- `user_id`: uuid _(fk)_
- `entity_type`: text _(required)_
- `entity_id`: text _(required, fk)_
- `previous_value`: jsonb
- `new_value`: jsonb
- `points_awarded`: integer _(default)_
- `reverted_at`: timestamp(tz)

### gamification_task_locks

fk: entity_id

- `category`: text _(required)_
- `entity_id`: text _(required, fk)_
- `locked_at`: timestamp(tz) _(default)_

### dubbing_languages

pk: `code` (text)

- `code`: text _(pk)_

### dubbing_language_reviews

pk: `id` (bigint)

- `id`: bigint _(pk)_
- `decision`: jsonb _(required)_
- `source_snapshot`: jsonb _(required)_
- `target_snapshot`: jsonb
- `applied_at`: timestamp(tz) _(required)_

### legacy_wiki_check_reprocesses

pk: `archived_msg_id` (bigint) · fk: archived_msg_id, tmdb_id, queued_msg_id

- `archived_msg_id`: bigint _(pk, fk)_
- `tmdb_id`: bigint _(required, fk)_
- `outcome`: text _(required)_
- `queued_msg_id`: bigint _(required, fk)_
- `processed_at`: timestamp(tz) _(required)_

### metadata_write_requests

fk: actor_id, request_id, entity_id, audit_log_id

- `actor_id`: uuid _(required, fk)_
- `request_id`: uuid _(required, fk)_
- `entity_type`: text _(required)_
- `payload_fingerprint`: text _(required)_
- `entity_id`: text _(required, fk)_
- `audit_log_id`: uuid _(required, fk)_
- `result`: jsonb _(required)_

### voice_actor_write_requests

fk: actor_id, request_id, voice_actor_id, audit_log_id

- `actor_id`: uuid _(required, fk)_
- `request_id`: uuid _(required, fk)_
- `voice_actor_id`: bigint _(required, fk)_
- `payload_fingerprint`: text _(required)_
- `audit_log_id`: uuid _(fk)_
- `result`: jsonb _(required)_

### regional_assignment_requests

fk: actor_id, request_id, result_project_id

- `actor_id`: uuid _(required, fk)_
- `request_id`: uuid _(required, fk)_
- `request_fingerprint`: text _(required)_
- `result_project_id`: bigint _(required, fk)_
- `metadata`: jsonb _(required)_

### regional_assignment_request_audits

fk: actor_id, request_id, audit_log_id

- `actor_id`: uuid _(required, fk)_
- `request_id`: uuid _(required, fk)_
- `audit_log_id`: uuid _(required, fk)_
- `metadata`: jsonb _(required)_

### toy_metadata

pk: `content_id` (bigint) · fk: content_id

- `content_id`: bigint _(pk, fk)_
- `name`: text _(required)_
- `manufacturer`: text check (manufacturer is
- `product_line`: text check (product_line is
- `release_year`: integer check (release_year is
- `cover_url`: text check (
    cover_url is

### gamification_task_submission_results

pk: `claim_id` (uuid) · fk: claim_id, user_id

- `claim_id`: uuid _(pk, fk)_
- `user_id`: uuid _(required, fk)_
- `submission_fingerprint`: text _(required)_
- `points_awarded`: integer _(required)_

### admin_credit_import_requests

fk: admin_id, request_id

- `admin_id`: uuid _(required, fk)_
- `request_id`: uuid _(required, fk)_
- `request_fingerprint`: text _(required)_
- `result`: jsonb _(required)_

### user_voice_actor_link_requests

fk: actor_id, request_id, target_user_id, voice_actor_id, expected_link_id, result_link_id, audit_log_id

- `actor_id`: uuid _(required, fk)_
- `request_id`: uuid _(required, fk)_
- `operation`: text _(required)_
- `payload_fingerprint`: text _(required)_
- `target_user_id`: uuid _(required, fk)_
- `voice_actor_id`: integer _(required, fk)_
- `expected_link_id`: uuid _(fk)_
- `result_link_id`: uuid _(fk)_
- `result_changed`: boolean
- `audit_log_id`: uuid _(fk)_
- `completed_at`: timestamp(tz)

## Schema Source Files

Read and edit these files when adding columns, creating migrations, or changing relations:

- `apps/website/server/utils/db/client.ts` — imported by **68** files
- `apps/website/server/utils/db/queries.ts` — imported by **8** files

---
_Back to [overview.md](./overview.md)_
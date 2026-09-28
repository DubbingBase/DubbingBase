# Schema

### voice_actors
- id: bigint (required)
- tmdb_id: bigint (fk)

### source
- id: bigint (required)
- user_id: bigint (fk)
- suggested_at: timestamp without time zone (default)

### work
- id: bigint (required)
- content_id: bigint (required, fk)
- actor_id: bigint (required, fk)
- voice_actor_id: bigint (fk)
- highlight: boolean (default)
- source_id: bigint (fk)

### user_profiles
- id: uuid (pk)
- user_id: uuid (required, fk)
- bio: text
- nationality: text
- date_of_birth: date
- social_media_links: jsonb

### user_profile_links
- id: uuid (pk)
- user_id: uuid (required, fk)
- profile_id: uuid (required, fk)

### user_voice_actor_links
- id: uuid (pk)
- user_id: uuid (required, fk)
- voice_actor_id: integer (required, fk)

### votes
- id: bigint (pk)
- user_id: uuid (required, fk)
- work_id: bigint (required, fk)
- vote_type: text (required)

### dubbing_projects
- id: bigint (pk)
- content_id: bigint (required, fk)
- content_type: text (required)
- language: text (default)
- studio: text
- artistic_director: text
- adaptation: text
- recording: text
- editing: text
- mixing: text
- project_manager: text
- creative_supervision: text
- status: text

### studios
- id: bigint (pk)
- name: text (required)
- description: text
- country: text
- city: text
- website_url: text
- logo_url: text

### dubbing_project_crew
- id: bigint (pk)
- dubbing_project_id: bigint (required, fk)
- person_id: bigint (required, fk)
- job: text (required)

### jobs
- id: bigint (pk)
- name: text (required)

### project_attachments
- id: bigint (pk)
- dubbing_project_id: bigint (required, fk)
- file_path: text (required)
- file_name: text (required)
- description: text
- created_by: uuid (default)

### voice_actor_subscriptions
- user_id: uuid (required, fk)
- voice_actor_id: bigint (required, fk)

### user_reports
- id: uuid (pk)
- reporter_id: uuid (required, fk)
- target_url: text (required)
- reason: text (required)
- details: text

### audit_logs
- id: uuid (pk)
- user_id: uuid (fk)
- entity_type: text (required)
- entity_id: text (required, fk)
- previous_value: jsonb
- new_value: jsonb
- points_awarded: integer (default)
- reverted_at: timestamp(tz)

### gamification_task_locks
- category: text (required)
- entity_id: text (required, fk)
- locked_at: timestamp(tz) (default)

### dubbing_languages
- code: text (pk)

### dubbing_language_reviews
- id: bigint (pk)
- decision: jsonb (required)
- source_snapshot: jsonb (required)
- target_snapshot: jsonb
- applied_at: timestamp(tz) (required)

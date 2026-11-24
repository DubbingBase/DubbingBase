-- DubbingBase-owned media identity.
--
-- Until now a media item was identified only by (content_type, content_id) on dubbing_projects (and content_id on
-- toy_metadata, igdb_game_id on game_characters), with no foreign key. This migration:
--   * adds public.media (own id, kind, the id the website uses for it, and an optional Wikidata id);
--   * backfills one media row per distinct legacy (content_type, content_id) pair;
--   * keys dubbing_projects, toy_metadata and game_characters by media_id with real foreign keys;
--   * rewrites every function that took or returned the legacy pair so they resolve through media;
--   * drops the legacy columns.
--
-- media.content_id is the id the website and URLs use for the kind (TMDB id for movie/tv, IGDB id for video_game, Open
-- Library work number for audiobook, iTunes id for podcast), unique per kind (TMDB movie 550 and tv 550 are different
-- works). Toys and advertisements are DubbingBase's own media: their content_id is media.id itself (/toy/{id}).
-- wikidata_qid only enriches existing media. A further provider is a nullable column away.
--
-- The functions keep accepting a reference (content_id, content_type) as input where the website and API already
-- speak it. They resolve it to media_id through private.resolve_media / private.find_media_id, and report it back with
-- private.media_content_id.
--
-- Media rows are permanent: application code never deletes them (all media foreign keys are ON DELETE RESTRICT).
-- Existing audit snapshots keep the legacy content_id/content_type; replaying a pre-migration request id through
-- save_dubbing_project_editor/controlled_save_toy_metadata raises the existing "changed after this save" error.

-- The first ALTER takes ACCESS EXCLUSIVE locks on dubbing_projects, toy_metadata and game_characters: fail fast instead
-- of queueing behind a long query (the migration is one transaction, so a timeout leaves nothing applied; rerun it).
-- Deploy it back to back with the website and pause the crons (apps/website/wrangler.toml) around the switch.
set local lock_timeout = '5s';

-- Abort cleanly instead of guessing if the legacy data is not what this migration assumes.
do $$
begin
  if exists (
    select 1
    from public.dubbing_projects
    where content_type not in ('movie', 'tv', 'video_game', 'audiobook', 'podcast', 'advertisement', 'toy')
       or content_id = 0
       or (content_id < 0 and content_type not in ('advertisement', 'toy'))
  ) then
    raise exception 'dubbing_projects holds a content_type or content_id outside the supported media model'
      using errcode = '22023';
  end if;
  if exists (
    select 1 from public.toy_metadata as metadata
    where not exists (
      select 1 from public.dubbing_projects as project
      where project.content_type = 'toy' and project.content_id = metadata.content_id
    )
  ) then
    raise exception 'toy_metadata holds a row without a toy dubbing project'
      using errcode = '22023';
  end if;
end;
$$;

create table public.media (
  id bigint generated always as identity primary key,
  kind text not null check (
    kind in ('movie', 'tv', 'video_game', 'audiobook', 'podcast', 'advertisement', 'toy')
  ),
  -- The id the website uses for this kind; media.id itself for toy/advertisement.
  content_id bigint not null check (content_id > 0),
  wikidata_qid text unique check (wikidata_qid ~ '^Q[1-9][0-9]*$'),
  created_at timestamptz not null default now(),
  unique (kind, content_id),
  check (kind not in ('toy', 'advertisement') or content_id = id)
);

-- Existing media for a reference (content_id, content_type), or NULL. Never creates.
create function private.find_media_id(p_kind text, p_content_id bigint)
returns bigint
language sql
stable
set search_path = ''
as $$
  select media.id from public.media as media where media.kind = p_kind and media.content_id = p_content_id
$$;

-- Find or create the media row for a reference. Only provider-backed kinds are created here (the advisory lock makes
-- concurrent creators of the same reference share one row); toy/advertisement media must already exist
-- (private.create_internal_media).
create function private.resolve_media(p_kind text, p_content_id bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_media_id bigint := private.find_media_id(p_kind, p_content_id);
begin
  if v_media_id is not null then
    return v_media_id;
  end if;
  if p_kind in ('toy', 'advertisement') then
    raise exception 'Internal media must be created before it can be used' using errcode = '23503';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('media:' || p_kind || ':' || p_content_id::text, 0)
  );

  v_media_id := private.find_media_id(p_kind, p_content_id);
  if v_media_id is null then
    insert into public.media (kind, content_id) values (p_kind, p_content_id) returning id into v_media_id;
  end if;
  return v_media_id;
end;
$$;

-- New DubbingBase-owned media (toy or advertisement); its id is the id used in URLs and by the RPCs.
create function private.create_internal_media(p_kind text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_media_id bigint;
begin
  if p_kind not in ('toy', 'advertisement') then
    raise exception 'Only toy and advertisement media are created internally' using errcode = '22023';
  end if;
  select pg_catalog.nextval(pg_catalog.pg_get_serial_sequence('public.media', 'id')) into v_media_id;
  insert into public.media (id, kind, content_id) overriding system value
  values (v_media_id, p_kind, v_media_id);
  return v_media_id;
end;
$$;

create function private.media_content_id(p_media_id bigint)
returns bigint
language sql
stable
set search_path = ''
as $$
  select media.content_id from public.media as media where media.id = p_media_id
$$;

create function private.media_kind(p_media_id bigint)
returns text
language sql
stable
set search_path = ''
as $$
  select media.kind from public.media as media where media.id = p_media_id
$$;

revoke all on function private.find_media_id(text, bigint) from public, anon, authenticated;
revoke all on function private.resolve_media(text, bigint) from public, anon, authenticated;
revoke all on function private.create_internal_media(text) from public, anon, authenticated;
revoke all on function private.media_content_id(bigint) from public, anon, authenticated;
revoke all on function private.media_kind(bigint) from public, anon, authenticated;

-- Backfill, set-based: one media row per distinct legacy pair, with explicit ids (the identity sequence is advanced
-- afterwards).
alter table public.dubbing_projects add column media_id bigint;
alter table public.toy_metadata add column media_id bigint;
alter table public.game_characters add column media_id bigint;

-- Toys and advertisements that already have a positive id keep it as media.id, so /toy/{id} links and audit entries
-- stay valid; every other media (and a toy/advertisement whose id is taken, or negative) is numbered after them.
create temporary table media_backfill as
with legacy as (
  select distinct content_type as kind, content_id from public.dubbing_projects
),
kept as (
  select kind, content_id, content_id as media_id
  from (
    select kind, content_id, row_number() over (partition by content_id order by kind) as position
    from legacy
    where kind in ('toy', 'advertisement') and content_id > 0
  ) as candidates
  where position = 1
),
rest as (
  select kind, content_id from legacy
  except
  select kind, content_id from kept
)
select media_id, kind, content_id from kept
union all
select
  row_number() over (order by kind, content_id)::bigint + (select coalesce(max(media_id), 0) from kept),
  kind,
  content_id
from rest;

insert into public.media (id, kind, content_id)
overriding system value
select media_id, kind,
  case when kind in ('toy', 'advertisement') then media_id else content_id end
from media_backfill;

select pg_catalog.setval(
  pg_catalog.pg_get_serial_sequence('public.media', 'id'),
  greatest((select coalesce(max(id), 0) from public.media), 1),
  (select count(*) > 0 from public.media)
);

update public.dubbing_projects as project
set media_id = backfill.media_id
from media_backfill as backfill
where backfill.kind = project.content_type and backfill.content_id = project.content_id;

update public.toy_metadata as metadata
set media_id = backfill.media_id
from media_backfill as backfill
where backfill.kind = 'toy' and backfill.content_id = metadata.content_id;

drop table media_backfill;

-- game_characters belong to an IGDB game; the game may not have a project yet, so create its media row.
update public.game_characters
set media_id = private.resolve_media('video_game', igdb_game_id);

-- ---------------------------------------------------------------------------
-- Function rewrites: resolve the legacy-style reference through media / media_id.
-- ---------------------------------------------------------------------------

-- sql1: save_dubbing_project_editor resolves the (content_id, content_type) payload to media_id.
CREATE OR REPLACE FUNCTION public.save_dubbing_project_editor(p_actor_id uuid, p_request_id uuid, p_project_id bigint, p_expected_updated_at timestamp without time zone, p_project jsonb, p_crew jsonb, p_cast jsonb)
 RETURNS TABLE(project_id bigint, updated_at timestamp without time zone, audit_log_id uuid, replayed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_actor_metadata JSONB;
  v_project public.dubbing_projects%ROWTYPE;
  v_existing_audit public.audit_logs%ROWTYPE;
  v_work public.work%ROWTYPE;
  v_crew public.dubbing_project_crew%ROWTYPE;
  v_media_type TEXT;
  v_content_id BIGINT;
  v_media_id BIGINT;
  v_studio_id BIGINT;
  v_language TEXT;
  v_status TEXT;
  v_managed_jobs BIGINT[];
  v_job_id BIGINT;
  v_person_id BIGINT;
  v_has_person BOOLEAN;
  v_before JSONB;
  v_after JSONB;
  v_before_project JSONB;
  v_before_crew JSONB;
  v_before_cast JSONB;
  v_after_crew JSONB;
  v_after_cast JSONB;
  v_fingerprint TEXT;
  v_audit_id UUID;
  v_updated_at TIMESTAMP WITHOUT TIME ZONE;
  v_expected_work_updated_at TIMESTAMPTZ;
  v_expected_work JSONB;
  v_item JSONB;
  v_key TEXT;
  v_lock_key BIGINT;
BEGIN
  IF p_actor_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'An authenticated administrator and request id are required'
      USING ERRCODE = '28000';
  END IF;

  SELECT users.raw_app_meta_data
  INTO v_actor_metadata
  FROM auth.users AS users
  WHERE users.id = p_actor_id;

  IF NOT FOUND OR COALESCE(v_actor_metadata ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'Only an administrator can save dubbing projects'
      USING ERRCODE = '42501';
  END IF;

  IF p_project IS NULL OR jsonb_typeof(p_project) IS DISTINCT FROM 'object'
     OR p_project = '{}'::JSONB
     OR EXISTS (
       SELECT 1 FROM jsonb_object_keys(p_project) AS field_name(name)
       WHERE field_name.name <> ALL (ARRAY[
         'content_id', 'content_type', 'language', 'studio_id', 'status'
       ]::TEXT[])
     ) THEN
    RAISE EXCEPTION 'Project contains an unknown or protected field'
      USING ERRCODE = '22023';
  END IF;

  IF NOT (p_project ?& ARRAY['content_id', 'content_type', 'language', 'studio_id', 'status']::TEXT[])
     OR jsonb_typeof(p_project -> 'content_id') IS DISTINCT FROM 'number'
     OR (p_project ->> 'content_id') !~ '^-?[1-9][0-9]{0,17}$'
     OR jsonb_typeof(p_project -> 'content_type') IS DISTINCT FROM 'string'
     OR p_project ->> 'content_type' <> ALL (ARRAY[
       'movie', 'tv', 'video_game', 'audiobook', 'podcast', 'advertisement', 'toy'
     ]::TEXT[])
     OR ((p_project ->> 'content_id')::BIGINT < 0
       AND p_project ->> 'content_type' NOT IN ('advertisement', 'toy'))
     OR jsonb_typeof(p_project -> 'language') IS DISTINCT FROM 'string'
     OR NOT public.is_valid_dubbing_language(p_project ->> 'language')
     OR jsonb_typeof(p_project -> 'status') IS DISTINCT FROM 'string'
     OR p_project ->> 'status' <> ALL (ARRAY['validated', 'pending', 'draft']::TEXT[])
     OR (p_project -> 'studio_id' <> 'null'::JSONB AND (
       jsonb_typeof(p_project -> 'studio_id') IS DISTINCT FROM 'number'
       OR (p_project ->> 'studio_id') !~ '^[1-9][0-9]{0,17}$'
     )) THEN
    RAISE EXCEPTION 'Project fields or references are invalid'
      USING ERRCODE = '22023';
  END IF;

  v_content_id := (p_project ->> 'content_id')::BIGINT;
  v_media_type := p_project ->> 'content_type';
  v_language := p_project ->> 'language';
  v_status := p_project ->> 'status';
  v_studio_id := CASE WHEN p_project -> 'studio_id' = 'null'::JSONB
    THEN NULL ELSE (p_project ->> 'studio_id')::BIGINT END;

  IF v_studio_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.studios AS studio WHERE studio.id = v_studio_id
  ) THEN
    RAISE EXCEPTION 'Selected studio does not exist' USING ERRCODE = '23503';
  END IF;

  IF jsonb_typeof(p_crew) IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_cast) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Crew and cast must be arrays within the supported size limits'
      USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_crew) > 100 OR jsonb_array_length(p_cast) > 1000 THEN
    RAISE EXCEPTION 'Crew and cast must be arrays within the supported size limits'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_crew) AS item(value)
    WHERE jsonb_typeof(item.value) IS DISTINCT FROM 'object'
       OR EXISTS (
         SELECT 1 FROM jsonb_object_keys(item.value) AS field_name(name)
         WHERE field_name.name <> ALL (ARRAY['job_id', 'person_id']::TEXT[])
       )
       OR NOT (item.value ?& ARRAY['job_id', 'person_id']::TEXT[])
       OR jsonb_typeof(item.value -> 'job_id') IS DISTINCT FROM 'number'
       OR (item.value ->> 'job_id') !~ '^[1-9][0-9]{0,17}$'
       OR jsonb_typeof(item.value -> 'person_id') IS DISTINCT FROM 'number'
       OR (item.value ->> 'person_id') !~ '^[1-9][0-9]{0,17}$'
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_crew) AS crew(job_id BIGINT, person_id BIGINT)
    GROUP BY crew.job_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Crew contains an invalid or duplicate job assignment'
      USING ERRCODE = '22023';
  END IF;

  v_managed_jobs := CASE WHEN v_media_type IN ('movie', 'tv', 'video_game')
    THEN ARRAY[1, 2, 3, 4, 5, 6, 7]::BIGINT[]
    ELSE ARRAY[1, 3, 5]::BIGINT[] END;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_crew) AS crew(job_id BIGINT, person_id BIGINT)
    LEFT JOIN public.jobs AS job ON job.id = crew.job_id
    LEFT JOIN public.voice_actors AS person ON person.id = crew.person_id
    WHERE crew.job_id <> ALL (v_managed_jobs)
       OR job.id IS NULL
       OR person.id IS NULL
  ) THEN
    RAISE EXCEPTION 'A selected crew member or job does not exist or is not editable in this media editor'
      USING ERRCODE = '23503';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_cast) AS item(value)
    WHERE jsonb_typeof(item.value) IS DISTINCT FROM 'object'
       OR EXISTS (
         SELECT 1 FROM jsonb_object_keys(item.value) AS field_name(name)
         WHERE field_name.name <> ALL (ARRAY[
           'id', 'expected_updated_at', 'expected', 'actor_id', 'character_id', 'character_name',
           'game_character_id', 'voice_actor_id', 'performance', 'note', 'highlight', 'status'
         ]::TEXT[])
       )
       OR (item.value ? 'id' AND (
         jsonb_typeof(item.value -> 'id') IS DISTINCT FROM 'number'
         OR (item.value ->> 'id') !~ '^[1-9][0-9]{0,17}$'
         OR NOT (item.value ? 'expected_updated_at')
         OR NOT (item.value ? 'expected')
       ))
       OR (item.value ? 'expected' AND (
         jsonb_typeof(item.value -> 'expected') IS DISTINCT FROM 'object'
         OR NOT ((item.value -> 'expected') ?& ARRAY[
           'actor_id', 'character_id', 'character_name', 'voice_actor_id',
           'performance', 'note', 'highlight', 'status'
         ]::TEXT[])
         OR EXISTS (
           SELECT 1 FROM jsonb_object_keys(item.value -> 'expected') AS expected_field(name)
           WHERE expected_field.name <> ALL (ARRAY[
             'actor_id', 'character_id', 'character_name', 'game_character_id', 'voice_actor_id',
             'performance', 'note', 'highlight', 'status'
           ]::TEXT[])
         )
         OR jsonb_typeof(item.value -> 'expected' -> 'actor_id') NOT IN ('number', 'null')
         OR jsonb_typeof(item.value -> 'expected' -> 'character_id') NOT IN ('number', 'null')
         OR jsonb_typeof(item.value -> 'expected' -> 'voice_actor_id') NOT IN ('number', 'null')
         OR jsonb_typeof(item.value -> 'expected' -> 'character_name') NOT IN ('string', 'null')
         OR jsonb_typeof(item.value -> 'expected' -> 'performance') NOT IN ('string', 'null')
         OR jsonb_typeof(item.value -> 'expected' -> 'note') NOT IN ('string', 'null')
         OR jsonb_typeof(item.value -> 'expected' -> 'highlight') NOT IN ('boolean', 'null')
         OR jsonb_typeof(item.value -> 'expected' -> 'status') NOT IN ('string', 'null')
         OR ((item.value -> 'expected') ? 'game_character_id' AND
           jsonb_typeof(item.value -> 'expected' -> 'game_character_id') NOT IN ('string', 'null'))
         OR ((item.value -> 'expected' ->> 'game_character_id') IS NOT NULL AND
           (item.value -> 'expected' ->> 'game_character_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
       ))
       OR (NOT (item.value ? 'id') AND (item.value ? 'expected' OR item.value ? 'expected_updated_at'))
       OR (item.value ? 'expected_updated_at' AND
         jsonb_typeof(item.value -> 'expected_updated_at') NOT IN ('string', 'null'))
       OR (item.value ? 'actor_id' AND item.value -> 'actor_id' <> 'null'::JSONB AND (
         jsonb_typeof(item.value -> 'actor_id') IS DISTINCT FROM 'number'
         OR (item.value ->> 'actor_id') !~ '^[1-9][0-9]{0,17}$'
       ))
       OR (item.value ? 'character_id' AND item.value -> 'character_id' <> 'null'::JSONB AND (
         jsonb_typeof(item.value -> 'character_id') IS DISTINCT FROM 'number'
         OR (item.value ->> 'character_id') !~ '^[1-9][0-9]{0,17}$'
       ))
       OR (item.value ? 'game_character_id' AND item.value -> 'game_character_id' <> 'null'::JSONB AND (
         jsonb_typeof(item.value -> 'game_character_id') IS DISTINCT FROM 'string'
         OR (item.value ->> 'game_character_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       ))
       OR (item.value ? 'voice_actor_id' AND item.value -> 'voice_actor_id' <> 'null'::JSONB AND (
         jsonb_typeof(item.value -> 'voice_actor_id') IS DISTINCT FROM 'number'
         OR (item.value ->> 'voice_actor_id') !~ '^[1-9][0-9]{0,17}$'
       ))
       OR (item.value ? 'character_name' AND jsonb_typeof(item.value -> 'character_name') NOT IN ('string', 'null'))
       OR (item.value ? 'performance' AND jsonb_typeof(item.value -> 'performance') NOT IN ('string', 'null'))
       OR (item.value ? 'note' AND jsonb_typeof(item.value -> 'note') NOT IN ('string', 'null'))
       OR (item.value ? 'highlight' AND jsonb_typeof(item.value -> 'highlight') NOT IN ('boolean', 'null'))
       OR length(COALESCE(item.value ->> 'character_name', '')) > 500
       OR length(COALESCE(item.value ->> 'performance', '')) > 100
       OR length(COALESCE(item.value ->> 'note', '')) > 10000
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_cast) AS cast_row(id BIGINT)
    WHERE cast_row.id IS NOT NULL
    GROUP BY cast_row.id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cast contains invalid fields or duplicate work ids'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_cast) AS item(value)
    WHERE item.value ? 'game_character_id'
      AND item.value -> 'game_character_id' <> 'null'::JSONB
      AND v_media_type <> 'video_game'
  ) THEN
    RAISE EXCEPTION 'Local game characters can only be assigned to video games'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_cast) AS item(value)
    LEFT JOIN public.game_characters AS character
      ON character.id = (item.value ->> 'game_character_id')::UUID
     AND character.media_id = private.find_media_id('video_game', v_content_id)
    WHERE item.value ? 'game_character_id'
      AND item.value -> 'game_character_id' <> 'null'::JSONB
      AND character.id IS NULL
  ) THEN
    RAISE EXCEPTION 'A selected local character does not belong to this game'
      USING ERRCODE = '23503';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_cast) AS item(value)
    LEFT JOIN public.voice_actors AS voice_actor
      ON voice_actor.id = CASE WHEN item.value -> 'voice_actor_id' = 'null'::JSONB
        THEN NULL ELSE NULLIF(item.value ->> 'voice_actor_id', '')::BIGINT END
    WHERE item.value ? 'voice_actor_id'
      AND item.value -> 'voice_actor_id' <> 'null'::JSONB
      AND voice_actor.id IS NULL
  ) THEN
    RAISE EXCEPTION 'A selected voice actor does not exist' USING ERRCODE = '23503';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_id::TEXT || ':' || p_request_id::TEXT, 0)
  );
  v_fingerprint := md5(jsonb_build_object(
    'project_id', p_project_id,
    'expected_updated_at', p_expected_updated_at,
    'project', p_project,
    'crew', p_crew,
    'cast', p_cast
  )::TEXT);

  SELECT audit.* INTO v_existing_audit
  FROM public.audit_logs AS audit
  WHERE audit.user_id = p_actor_id
    AND audit.request_id = p_request_id;

  IF FOUND THEN
    IF v_existing_audit.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'Request id was already used with different project data'
        USING ERRCODE = '23505';
    END IF;
    SELECT project.* INTO v_project
    FROM public.dubbing_projects AS project
    WHERE project.id = v_existing_audit.entity_id::BIGINT
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The project changed after this save; reload before retrying'
        USING ERRCODE = '55000';
    END IF;
    PERFORM 1
    FROM public.dubbing_project_crew AS crew
    WHERE crew.dubbing_project_id = v_project.id
    ORDER BY crew.id
    FOR UPDATE;
    PERFORM 1
    FROM public.work AS work
    WHERE work.dubbing_project_id = v_project.id
    ORDER BY work.id
    FOR UPDATE;
    SELECT COALESCE(jsonb_agg(to_jsonb(crew_row) ORDER BY crew_row.id), '[]'::JSONB)
    INTO v_after_crew
    FROM public.dubbing_project_crew AS crew_row
    WHERE crew_row.dubbing_project_id = v_project.id;
    SELECT COALESCE(jsonb_agg(to_jsonb(work_row) ORDER BY work_row.id), '[]'::JSONB)
    INTO v_after_cast
    FROM public.work AS work_row
    WHERE work_row.dubbing_project_id = v_project.id;
    IF v_project.updated_at IS DISTINCT FROM
         (v_existing_audit.new_value -> 'project' ->> 'updated_at')::TIMESTAMP WITHOUT TIME ZONE
       OR to_jsonb(v_project) IS DISTINCT FROM v_existing_audit.new_value -> 'project'
       OR v_after_crew IS DISTINCT FROM v_existing_audit.new_value -> 'crew'
       OR v_after_cast IS DISTINCT FROM v_existing_audit.new_value -> 'cast' THEN
      RAISE EXCEPTION 'The project changed after this save; reload before retrying'
        USING ERRCODE = '55000';
    END IF;
    RETURN QUERY SELECT v_project.id, v_project.updated_at, v_existing_audit.id, TRUE;
    RETURN;
  END IF;

  IF p_project_id IS NULL THEN
    IF p_expected_updated_at IS NOT NULL THEN
      RAISE EXCEPTION 'New projects cannot have an expected update timestamp'
        USING ERRCODE = '22023';
    END IF;
    IF v_media_type IN ('advertisement', 'toy') AND NOT EXISTS (
      SELECT 1 FROM public.dubbing_projects AS internal_project
      WHERE internal_project.media_id = private.find_media_id(v_media_type, v_content_id)
    ) THEN
      RAISE EXCEPTION 'Internal media must be created before adding a language project'
        USING ERRCODE = '23503';
    END IF;
    v_media_id := private.resolve_media(v_media_type, v_content_id);
    INSERT INTO public.dubbing_projects (
      media_id, language, studio_id, status
    ) VALUES (
      v_media_id, v_language, v_studio_id, v_status
    ) RETURNING * INTO v_project;
    v_before_project := NULL;
  ELSE
    SELECT project.* INTO v_project
    FROM public.dubbing_projects AS project
    WHERE project.id = p_project_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Dubbing project does not exist' USING ERRCODE = '55000';
    END IF;
    IF v_project.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'The project changed since it was loaded; reload before saving'
        USING ERRCODE = '55000';
    END IF;
    IF v_project.media_id IS DISTINCT FROM private.find_media_id(v_media_type, v_content_id) THEN
      RAISE EXCEPTION 'A project cannot be moved to a different content record'
        USING ERRCODE = '22023';
    END IF;
    v_before_project := to_jsonb(v_project);
    UPDATE public.dubbing_projects AS project
    SET language = v_language,
        studio_id = v_studio_id,
        status = v_status
    WHERE project.id = p_project_id
    RETURNING * INTO v_project;
  END IF;

  PERFORM 1
  FROM public.dubbing_project_crew AS crew
  WHERE crew.dubbing_project_id = v_project.id
  ORDER BY crew.id
  FOR UPDATE;

  -- The duplicate-work merge RPC takes role advisory locks before row locks.
  -- Take the same locks in a stable order before locking cast rows so the two
  -- operations cannot form a row-lock/advisory-lock cycle.
  FOR v_lock_key IN
    SELECT lock_keys.lock_key
    FROM (
      SELECT DISTINCT identity_locks.lock_key
      FROM (
        SELECT pg_catalog.hashtextextended(
          pg_catalog.jsonb_build_array(
            work.dubbing_project_id,
            work.actor_id,
            work.voice_actor_id,
            public.work_assignment_role_identity_key(
              work.game_character_id, work.character_id, work.character_name
            )
          )::TEXT,
          0
        ) AS lock_key
        FROM public.work AS work
        WHERE work.dubbing_project_id = v_project.id
          AND public.work_assignment_role_identity_key(
            work.game_character_id, work.character_id, work.character_name
          ) IS NOT NULL

        UNION

        SELECT pg_catalog.hashtextextended(
          pg_catalog.jsonb_build_array(
            v_project.id,
            CASE WHEN item.value ? 'actor_id'
              THEN CASE WHEN item.value -> 'actor_id' = 'null'::JSONB
                THEN NULL ELSE (item.value ->> 'actor_id')::BIGINT END
              ELSE existing.actor_id END,
            CASE WHEN item.value ? 'voice_actor_id'
              THEN CASE WHEN item.value -> 'voice_actor_id' = 'null'::JSONB
                THEN NULL ELSE (item.value ->> 'voice_actor_id')::BIGINT END
              ELSE existing.voice_actor_id END,
            public.work_assignment_role_identity_key(
              CASE WHEN item.value ? 'game_character_id'
                THEN CASE WHEN item.value -> 'game_character_id' = 'null'::JSONB
                  THEN NULL ELSE (item.value ->> 'game_character_id')::UUID END
                ELSE existing.game_character_id END,
              CASE WHEN item.value ? 'character_id'
                THEN CASE WHEN item.value -> 'character_id' = 'null'::JSONB
                  THEN NULL ELSE (item.value ->> 'character_id')::BIGINT END
                ELSE existing.character_id END,
              CASE WHEN item.value ? 'character_name'
                THEN item.value ->> 'character_name'
                ELSE existing.character_name END
            )
          )::TEXT,
          0
        ) AS lock_key
        FROM jsonb_array_elements(p_cast) AS item(value)
        LEFT JOIN public.work AS existing
          ON existing.id = CASE WHEN item.value ? 'id'
            THEN (item.value ->> 'id')::BIGINT ELSE NULL END
         AND existing.dubbing_project_id = v_project.id
        WHERE public.work_assignment_role_identity_key(
          CASE WHEN item.value ? 'game_character_id'
            THEN CASE WHEN item.value -> 'game_character_id' = 'null'::JSONB
              THEN NULL ELSE (item.value ->> 'game_character_id')::UUID END
            ELSE existing.game_character_id END,
          CASE WHEN item.value ? 'character_id'
            THEN CASE WHEN item.value -> 'character_id' = 'null'::JSONB
              THEN NULL ELSE (item.value ->> 'character_id')::BIGINT END
            ELSE existing.character_id END,
          CASE WHEN item.value ? 'character_name'
            THEN item.value ->> 'character_name'
            ELSE existing.character_name END
        ) IS NOT NULL
      ) AS identity_locks
    ) AS lock_keys
    ORDER BY lock_keys.lock_key
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(v_lock_key);
  END LOOP;

  PERFORM 1
  FROM public.work AS work
  WHERE work.dubbing_project_id = v_project.id
  ORDER BY work.id
  FOR UPDATE;

  SELECT COALESCE(jsonb_agg(to_jsonb(crew_row) ORDER BY crew_row.id), '[]'::JSONB)
  INTO v_before_crew
  FROM public.dubbing_project_crew AS crew_row
  WHERE crew_row.dubbing_project_id = v_project.id;
  SELECT COALESCE(jsonb_agg(to_jsonb(work_row) ORDER BY work_row.id), '[]'::JSONB)
  INTO v_before_cast
  FROM public.work AS work_row
  WHERE work_row.dubbing_project_id = v_project.id;

  IF EXISTS (
    SELECT 1
    FROM public.dubbing_project_crew AS existing
    WHERE existing.dubbing_project_id = v_project.id
      AND existing.job_id = ANY (v_managed_jobs)
    GROUP BY existing.job_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'This editor cannot represent multiple crew members for the same job; resolve the crew rows before saving'
      USING ERRCODE = '55000';
  END IF;

  FOREACH v_job_id IN ARRAY v_managed_jobs LOOP
    SELECT crew.* INTO v_crew
    FROM public.dubbing_project_crew AS crew
    WHERE crew.dubbing_project_id = v_project.id
      AND crew.job_id = v_job_id
    FOR UPDATE;
    v_has_person := FOUND;

    SELECT assignment.person_id INTO v_person_id
    FROM jsonb_to_recordset(p_crew) AS assignment(job_id BIGINT, person_id BIGINT)
    WHERE assignment.job_id = v_job_id;
    IF FOUND THEN
      IF v_has_person THEN
        IF v_crew.person_id IS DISTINCT FROM v_person_id THEN
          UPDATE public.dubbing_project_crew AS crew
          SET person_id = v_person_id
          WHERE crew.id = v_crew.id;
        END IF;
      ELSE
        INSERT INTO public.dubbing_project_crew(dubbing_project_id, job_id, person_id)
        VALUES (v_project.id, v_job_id, v_person_id);
      END IF;
    ELSIF v_has_person THEN
      DELETE FROM public.dubbing_project_crew AS crew WHERE crew.id = v_crew.id;
    END IF;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_cast) AS cast_item(value)
  LOOP
    IF v_item ? 'id' THEN
      SELECT work.* INTO v_work
      FROM public.work AS work
      WHERE work.id = (v_item ->> 'id')::BIGINT
        AND work.dubbing_project_id = v_project.id
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Work id % is stale or does not belong to this project', v_item ->> 'id'
          USING ERRCODE = '55000';
      END IF;
      v_expected_work_updated_at := CASE WHEN v_item -> 'expected_updated_at' = 'null'::JSONB
        THEN NULL ELSE (v_item ->> 'expected_updated_at')::TIMESTAMPTZ END;
      v_expected_work := v_item -> 'expected';
      IF v_work.updated_at IS DISTINCT FROM v_expected_work_updated_at THEN
        RAISE EXCEPTION 'Work id % changed since it was loaded; reload before saving', v_work.id
          USING ERRCODE = '55000';
      END IF;
      IF v_work.actor_id IS DISTINCT FROM (CASE WHEN v_expected_work -> 'actor_id' = 'null'::JSONB
           THEN NULL ELSE (v_expected_work ->> 'actor_id')::BIGINT END)
         OR v_work.character_id IS DISTINCT FROM (CASE WHEN v_expected_work -> 'character_id' = 'null'::JSONB
           THEN NULL ELSE (v_expected_work ->> 'character_id')::BIGINT END)
         OR v_work.game_character_id IS DISTINCT FROM (CASE
           WHEN v_expected_work ? 'game_character_id' AND v_expected_work -> 'game_character_id' <> 'null'::JSONB
             THEN (v_expected_work ->> 'game_character_id')::UUID ELSE NULL END)
         OR v_work.character_name IS DISTINCT FROM (CASE WHEN v_expected_work -> 'character_name' = 'null'::JSONB
           THEN NULL ELSE v_expected_work ->> 'character_name' END)
         OR v_work.voice_actor_id IS DISTINCT FROM (CASE WHEN v_expected_work -> 'voice_actor_id' = 'null'::JSONB
           THEN NULL ELSE (v_expected_work ->> 'voice_actor_id')::BIGINT END)
         OR v_work.performance IS DISTINCT FROM (CASE WHEN v_expected_work -> 'performance' = 'null'::JSONB
           THEN NULL ELSE v_expected_work ->> 'performance' END)
         OR v_work.note IS DISTINCT FROM (CASE WHEN v_expected_work -> 'note' = 'null'::JSONB
           THEN NULL ELSE v_expected_work ->> 'note' END)
         OR v_work.highlight IS DISTINCT FROM (CASE WHEN v_expected_work -> 'highlight' = 'null'::JSONB
           THEN NULL ELSE (v_expected_work ->> 'highlight')::BOOLEAN END)
         OR v_work.status IS DISTINCT FROM (CASE WHEN v_expected_work -> 'status' = 'null'::JSONB
           THEN NULL ELSE v_expected_work ->> 'status' END) THEN
        RAISE EXCEPTION 'Work id % changed since it was loaded; reload before saving', v_work.id
          USING ERRCODE = '55000';
      END IF;

      UPDATE public.work AS work
      SET game_character_id = CASE WHEN v_item ? 'game_character_id'
            THEN CASE WHEN v_item -> 'game_character_id' = 'null'::JSONB THEN NULL ELSE (v_item ->> 'game_character_id')::UUID END
            ELSE work.game_character_id END,
          actor_id = CASE WHEN v_item ? 'actor_id'
            THEN CASE WHEN v_item -> 'actor_id' = 'null'::JSONB THEN NULL ELSE (v_item ->> 'actor_id')::BIGINT END
            ELSE work.actor_id END,
          character_id = CASE WHEN v_item ? 'character_id'
            THEN CASE WHEN v_item -> 'character_id' = 'null'::JSONB THEN NULL ELSE (v_item ->> 'character_id')::BIGINT END
            ELSE work.character_id END,
          character_name = CASE WHEN v_item ? 'character_name' THEN v_item ->> 'character_name' ELSE work.character_name END,
          voice_actor_id = CASE WHEN v_item ? 'voice_actor_id'
            THEN CASE WHEN v_item -> 'voice_actor_id' = 'null'::JSONB THEN NULL ELSE (v_item ->> 'voice_actor_id')::BIGINT END
            ELSE work.voice_actor_id END,
          performance = CASE WHEN v_item ? 'performance' THEN v_item ->> 'performance' ELSE work.performance END,
          note = CASE WHEN v_item ? 'note' THEN v_item ->> 'note' ELSE work.note END,
          highlight = CASE WHEN v_item ? 'highlight'
            THEN CASE WHEN v_item -> 'highlight' = 'null'::JSONB THEN NULL ELSE (v_item ->> 'highlight')::BOOLEAN END
            ELSE work.highlight END,
          status = CASE WHEN v_media_type IN ('audiobook', 'podcast', 'advertisement', 'toy')
            THEN 'validated' ELSE work.status END,
          updated_at = clock_timestamp(),
          updated_by = p_actor_id
      WHERE work.id = v_work.id;
    ELSE
      INSERT INTO public.work (
        dubbing_project_id, game_character_id, actor_id, character_id, character_name,
        voice_actor_id, performance, note, highlight, status, created_by
      ) VALUES (
        v_project.id,
        CASE WHEN v_item -> 'game_character_id' IS NULL OR v_item -> 'game_character_id' = 'null'::JSONB
          THEN NULL ELSE (v_item ->> 'game_character_id')::UUID END,
        CASE WHEN v_item -> 'actor_id' IS NULL OR v_item -> 'actor_id' = 'null'::JSONB
          THEN NULL ELSE (v_item ->> 'actor_id')::BIGINT END,
        CASE WHEN v_item -> 'character_id' IS NULL OR v_item -> 'character_id' = 'null'::JSONB
          THEN NULL ELSE (v_item ->> 'character_id')::BIGINT END,
        CASE WHEN v_item -> 'character_name' IS NULL THEN NULL ELSE v_item ->> 'character_name' END,
        CASE WHEN v_item -> 'voice_actor_id' IS NULL OR v_item -> 'voice_actor_id' = 'null'::JSONB
          THEN NULL ELSE (v_item ->> 'voice_actor_id')::BIGINT END,
        CASE WHEN v_item -> 'performance' IS NULL THEN 'dialogues' ELSE v_item ->> 'performance' END,
        CASE WHEN v_item -> 'note' IS NULL THEN NULL ELSE v_item ->> 'note' END,
        CASE WHEN v_item -> 'highlight' IS NULL THEN FALSE ELSE (v_item ->> 'highlight')::BOOLEAN END,
        'validated',
        p_actor_id
      );
    END IF;
  END LOOP;

  IF p_project_id IS NOT NULL THEN
    UPDATE public.dubbing_projects AS project
    SET updated_at = clock_timestamp()
    WHERE project.id = v_project.id
    RETURNING project.updated_at INTO v_updated_at;
    SELECT project.* INTO v_project FROM public.dubbing_projects AS project WHERE project.id = v_project.id;
  ELSE
    v_updated_at := v_project.updated_at;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(crew_row) ORDER BY crew_row.id), '[]'::JSONB)
  INTO v_after_crew
  FROM public.dubbing_project_crew AS crew_row
  WHERE crew_row.dubbing_project_id = v_project.id;
  SELECT COALESCE(jsonb_agg(to_jsonb(work_row) ORDER BY work_row.id), '[]'::JSONB)
  INTO v_after_cast
  FROM public.work AS work_row
  WHERE work_row.dubbing_project_id = v_project.id;

  v_before := jsonb_build_object(
    'project', v_before_project,
    'crew', v_before_crew,
    'cast', v_before_cast
  );
  v_after := jsonb_build_object(
    'project', to_jsonb(v_project),
    'crew', v_after_crew,
    'cast', v_after_cast
  );
  v_audit_id := pg_catalog.gen_random_uuid();

  INSERT INTO public.audit_logs (
    id, user_id, entity_type, entity_id, action,
    previous_value, new_value, changed_fields,
    request_id, request_fingerprint, metadata
  ) VALUES (
    v_audit_id, p_actor_id, 'dubbing_project', v_project.id::TEXT,
    CASE WHEN p_project_id IS NULL THEN 'create' ELSE 'update' END,
    v_before, v_after, ARRAY[]::TEXT[],
    p_request_id, v_fingerprint,
    jsonb_build_object(
      'source', 'save_dubbing_project_editor',
      'media_type', v_media_type,
      'transaction_id', pg_catalog.pg_current_xact_id()::TEXT
    )
  );

  RETURN QUERY SELECT v_project.id, v_project.updated_at, v_audit_id, FALSE;
END;
$function$;

-- sql1: save_dubbing_project_editor_with_characters is unchanged (it only forwards the legacy-style IGDB id to create_game_character).
CREATE OR REPLACE FUNCTION public.save_dubbing_project_editor_with_characters(p_actor_id uuid, p_request_id uuid, p_project_id bigint, p_expected_updated_at timestamp without time zone, p_project jsonb, p_crew jsonb, p_cast jsonb, p_new_game_characters jsonb)
 RETURNS TABLE(project_id bigint, updated_at timestamp without time zone, audit_log_id uuid, replayed boolean)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_draft RECORD;
  v_character_id UUID;
  v_created_ids JSONB := '{}'::JSONB;
  v_cast JSONB;
BEGIN
  IF p_project ->> 'content_type' IS DISTINCT FROM 'video_game'
     OR jsonb_typeof(p_cast) IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_new_game_characters) IS DISTINCT FROM 'object'
     OR p_new_game_characters = '{}'::JSONB THEN
    RAISE EXCEPTION 'New game characters require a video game cast'
      USING ERRCODE = '22023';
  END IF;

  -- Stable draft IDs are creation request IDs. Acquire their audit locks in order
  -- and let both writers use their existing authorization and replay checks.
  FOR v_draft IN SELECT key AS id, value AS name FROM jsonb_each(p_new_game_characters) ORDER BY key
  LOOP
    IF v_draft.id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       OR v_draft.id = p_request_id::TEXT
       OR jsonb_typeof(v_draft.name) IS DISTINCT FROM 'string'
       OR NOT p_cast @> jsonb_build_array(jsonb_build_object('game_character_id', v_draft.id))
       OR EXISTS (
         SELECT 1 FROM jsonb_array_elements(p_cast) AS item(value)
         WHERE item.value ->> 'game_character_id' = v_draft.id
           AND (item.value ->> 'character_id' IS NOT NULL
                OR item.value -> 'character_name' IS DISTINCT FROM v_draft.name)
       ) THEN
      RAISE EXCEPTION 'Invalid assignment for a new game character'
        USING ERRCODE = '22023';
    END IF;

    SELECT created.game_character_id INTO STRICT v_character_id
    FROM public.create_game_character(
      p_actor_id, v_draft.id::UUID, (p_project ->> 'content_id')::BIGINT, v_draft.name #>> '{}'
    ) AS created;
    v_created_ids := v_created_ids || jsonb_build_object(v_draft.id, v_character_id);
  END LOOP;

  SELECT jsonb_agg(
    CASE WHEN v_created_ids ? (item.value ->> 'game_character_id')
      THEN jsonb_set(item.value, '{game_character_id}', v_created_ids -> (item.value ->> 'game_character_id'))
      ELSE item.value END
    ORDER BY item.position
  ) INTO v_cast
  FROM jsonb_array_elements(p_cast) WITH ORDINALITY AS item(value, position);

  -- A save error rolls back both the new characters and their audit entries.
  RETURN QUERY SELECT * FROM public.save_dubbing_project_editor(
    p_actor_id, p_request_id, p_project_id, p_expected_updated_at, p_project, p_crew, v_cast
  );
END;
$function$;

-- sql2: save_regional_project_actor_assignments rewritten to resolve media_id (legacy-style content_id/content_type inputs unchanged)
CREATE OR REPLACE FUNCTION public.save_regional_project_actor_assignments(p_content_id bigint, p_content_type text, p_dubbing_language text, p_operations jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RAISE EXCEPTION 'The legacy regional assignment RPC cannot write without an audited request id'
    USING ERRCODE = '55000';
END;
$function$
;
CREATE OR REPLACE FUNCTION public.save_regional_project_actor_assignments(p_content_id bigint, p_content_type text, p_dubbing_language text, p_operations jsonb, p_actor_id uuid, p_request_id uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_actor_role TEXT;
  v_prior_auth_sub TEXT;
  v_project_id BIGINT;
  v_media_id BIGINT;
  v_project public.dubbing_projects%ROWTYPE;
  v_project_created BOOLEAN := FALSE;
  v_operation RECORD;
  v_work_ids BIGINT[];
  v_work_count INTEGER;
  v_affected_rows INTEGER;
  v_current_work public.work%ROWTYPE;
  v_new_work public.work%ROWTYPE;
  v_previous_work JSONB;
  v_new_work_json JSONB;
  v_changed_fields TEXT[];
  v_action TEXT;
  v_audit_log_id UUID;
  v_audit_events JSONB := '[]'::JSONB;
  v_event JSONB;
  v_payload JSONB;
  v_fingerprint TEXT;
  v_existing_request private.regional_assignment_requests%ROWTYPE;
BEGIN
  IF p_actor_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'A verified admin and request id are required' USING ERRCODE = '28000';
  END IF;

  SELECT actor.raw_app_meta_data ->> 'role'
  INTO v_actor_role
  FROM auth.users AS actor
  WHERE actor.id = p_actor_id
  FOR SHARE;

  IF NOT FOUND OR v_actor_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'An administrator is required for regional assignment writes'
      USING ERRCODE = '42501';
  END IF;

  v_prior_auth_sub := pg_catalog.current_setting('request.jwt.claim.sub', TRUE);

  IF p_content_id IS NULL OR p_content_id <= 0
    OR p_content_type IS NULL
    OR p_content_type NOT IN ('movie', 'tv', 'video_game', 'audiobook', 'podcast', 'advertisement', 'toy')
    OR p_dubbing_language IS NULL
    OR NOT public.is_valid_dubbing_language(p_dubbing_language) THEN
    RAISE EXCEPTION 'A valid media selection and regional dubbing language are required'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_operations) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Assignment operations must be a JSON array'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(p_operations) = 0 THEN
    RAISE EXCEPTION 'At least one assignment operation is required'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_operations) AS item(value)
    WHERE jsonb_typeof(item.value) IS DISTINCT FROM 'object'
      OR NOT (item.value ?& ARRAY['actor_id', 'work_id', 'expected_voice_actor_id', 'voice_actor_id'])
      OR (item.value - ARRAY['actor_id', 'work_id', 'expected_voice_actor_id', 'voice_actor_id']) <> '{}'::JSONB
  ) THEN
    RAISE EXCEPTION 'Each assignment operation must use only the supported fields'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_operations) AS item(value)
    WHERE jsonb_typeof(item.value -> 'actor_id') IS DISTINCT FROM 'number'
      OR (item.value ->> 'actor_id') !~ '^[0-9]+$'
      OR (
        jsonb_typeof(item.value -> 'work_id') IS DISTINCT FROM 'null'
        AND (
          jsonb_typeof(item.value -> 'work_id') IS DISTINCT FROM 'number'
          OR (item.value ->> 'work_id') !~ '^[0-9]+$'
        )
      )
      OR (
        jsonb_typeof(item.value -> 'expected_voice_actor_id') IS DISTINCT FROM 'null'
        AND (
          jsonb_typeof(item.value -> 'expected_voice_actor_id') IS DISTINCT FROM 'number'
          OR (item.value ->> 'expected_voice_actor_id') !~ '^[0-9]+$'
        )
      )
      OR (
        jsonb_typeof(item.value -> 'voice_actor_id') IS DISTINCT FROM 'null'
        AND (
          jsonb_typeof(item.value -> 'voice_actor_id') IS DISTINCT FROM 'number'
          OR (item.value ->> 'voice_actor_id') !~ '^[0-9]+$'
        )
      )
  ) THEN
    RAISE EXCEPTION 'Assignment IDs must be positive integer values or null where allowed'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_operations) AS operation(
      actor_id BIGINT,
      work_id BIGINT,
      expected_voice_actor_id BIGINT,
      voice_actor_id BIGINT
    )
    WHERE operation.actor_id IS NULL
      OR operation.actor_id <= 0
      OR (operation.work_id IS NOT NULL AND operation.work_id <= 0)
      OR (operation.expected_voice_actor_id IS NOT NULL AND operation.expected_voice_actor_id <= 0)
      OR (operation.voice_actor_id IS NOT NULL AND operation.voice_actor_id <= 0)
      OR (operation.work_id IS NULL AND operation.voice_actor_id IS NULL)
      OR (operation.work_id IS NULL AND operation.expected_voice_actor_id IS NOT NULL)
      OR (operation.work_id IS NOT NULL
        AND operation.expected_voice_actor_id IS NOT DISTINCT FROM operation.voice_actor_id)
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_operations) AS operation(
      actor_id BIGINT,
      work_id BIGINT,
      expected_voice_actor_id BIGINT,
      voice_actor_id BIGINT
    )
    GROUP BY operation.actor_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Each assignment operation must describe one actual change for a unique actor'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_operations) AS operation(
      actor_id BIGINT,
      work_id BIGINT,
      expected_voice_actor_id BIGINT,
      voice_actor_id BIGINT
    )
    LEFT JOIN public.voice_actors AS voice_actor ON voice_actor.id = operation.voice_actor_id
    WHERE operation.voice_actor_id IS NOT NULL AND voice_actor.id IS NULL
  ) THEN
    RAISE EXCEPTION 'A selected voice actor does not exist' USING ERRCODE = '23503';
  END IF;

  v_payload := jsonb_build_object(
    'content_id', p_content_id,
    'content_type', p_content_type,
    'dubbing_language', p_dubbing_language,
    'operations', p_operations
  );
  -- Store the canonical JSONB form rather than a short hash. Request IDs are
  -- idempotency keys, so a collision must never make a different payload look
  -- like a successful retry.
  v_fingerprint := v_payload::TEXT;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_id::TEXT || ':' || p_request_id::TEXT, 0)
  );

  SELECT request.*
  INTO v_existing_request
  FROM private.regional_assignment_requests AS request
  WHERE request.actor_id = p_actor_id AND request.request_id = p_request_id;

  IF FOUND THEN
    IF v_existing_request.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'Request id was already used with a different assignment payload'
        USING ERRCODE = 'PT409';
    END IF;
    RETURN v_existing_request.result_project_id;
  END IF;

  -- The unique media+region key makes project creation race safe. A conflict
  -- leaves the existing project's status untouched.
  v_media_id := private.resolve_media(p_content_type, p_content_id);

  INSERT INTO public.dubbing_projects(media_id, language, status)
  VALUES (v_media_id, p_dubbing_language, 'validated')
  ON CONFLICT (media_id, language) DO NOTHING
  RETURNING * INTO v_project;
  v_project_created := FOUND;

  IF v_project_created THEN
    v_project_id := v_project.id;
  ELSE
    SELECT project.* INTO v_project
    FROM public.dubbing_projects AS project
    WHERE project.media_id = v_media_id
      AND project.language = p_dubbing_language
    FOR UPDATE;
    v_project_id := v_project.id;
  END IF;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Unable to lock the regional dubbing project';
  END IF;

  IF v_project_created THEN
    SELECT ARRAY(SELECT jsonb_object_keys(to_jsonb(v_project)) ORDER BY 1)
    INTO v_changed_fields;
    INSERT INTO public.audit_logs (
      user_id, entity_type, entity_id, action, previous_value, new_value
    ) VALUES (
      p_actor_id, 'dubbing_project', v_project_id::TEXT, 'create', NULL, to_jsonb(v_project)
    ) RETURNING id INTO v_audit_log_id;
    v_audit_events := v_audit_events || jsonb_build_array(jsonb_build_object(
      'audit_log_id', v_audit_log_id,
      'changed_fields', to_jsonb(v_changed_fields),
      'metadata', jsonb_build_object('source', '/api/admin/dubbing-project', 'entity', 'dubbing_project')
    ));
  END IF;

  FOR v_operation IN
    SELECT operation.actor_id,
           operation.work_id,
           operation.expected_voice_actor_id,
           operation.voice_actor_id
    FROM jsonb_to_recordset(p_operations) AS operation(
      actor_id BIGINT,
      work_id BIGINT,
      expected_voice_actor_id BIGINT,
      voice_actor_id BIGINT
    )
    ORDER BY operation.actor_id
  LOOP
    SELECT coalesce(array_agg(locked_work.id ORDER BY locked_work.id), ARRAY[]::BIGINT[])
      INTO v_work_ids
    FROM (
      SELECT work.id
      FROM public.work AS work
      WHERE work.dubbing_project_id = v_project_id
        AND work.actor_id = v_operation.actor_id
      ORDER BY work.id
      FOR UPDATE
    ) AS locked_work;

    v_work_count := cardinality(v_work_ids);
    IF v_work_count > 1 THEN
      RAISE EXCEPTION 'Actor % has multiple works in this regional project and cannot be edited through this form',
        v_operation.actor_id
        USING ERRCODE = '55000';
    END IF;

    IF v_operation.work_id IS NULL THEN
      IF v_work_count <> 0 THEN
        RAISE EXCEPTION 'The assignment changed since it was loaded; reload before saving'
          USING ERRCODE = 'PT409';
      END IF;

      INSERT INTO public.work(
        dubbing_project_id,
        actor_id,
        voice_actor_id,
        performance,
        status,
        created_by,
        updated_by
      ) VALUES (
        v_project_id,
        v_operation.actor_id,
        v_operation.voice_actor_id,
        'voice',
        'validated',
        p_actor_id,
        p_actor_id
      ) RETURNING * INTO v_new_work;

      v_action := 'create';
      v_previous_work := NULL;
      v_new_work_json := to_jsonb(v_new_work);
      SELECT ARRAY(SELECT jsonb_object_keys(v_new_work_json) ORDER BY 1)
      INTO v_changed_fields;
    ELSE
      IF v_work_count <> 1 OR v_work_ids[1] IS DISTINCT FROM v_operation.work_id THEN
        RAISE EXCEPTION 'Work % is stale or does not belong to actor % in this regional project',
          v_operation.work_id, v_operation.actor_id
          USING ERRCODE = 'PT409';
      END IF;

      SELECT work.* INTO v_current_work
      FROM public.work AS work
      WHERE work.id = v_operation.work_id
        AND work.dubbing_project_id = v_project_id
        AND work.actor_id = v_operation.actor_id
      FOR UPDATE;

      IF NOT FOUND OR v_current_work.voice_actor_id IS DISTINCT FROM v_operation.expected_voice_actor_id THEN
        RAISE EXCEPTION 'Assignment changed since it was loaded; reload before saving'
          USING ERRCODE = 'PT409';
      END IF;

      v_previous_work := to_jsonb(v_current_work);
      IF v_operation.voice_actor_id IS NULL THEN
        DELETE FROM public.work
        WHERE id = v_operation.work_id
          AND dubbing_project_id = v_project_id
          AND actor_id = v_operation.actor_id;
        GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
        IF v_affected_rows <> 1 THEN
          RAISE EXCEPTION 'Work % changed while the assignment was being saved', v_operation.work_id
            USING ERRCODE = 'PT409';
        END IF;
        v_action := 'delete';
        v_new_work_json := NULL;
        SELECT ARRAY(SELECT jsonb_object_keys(v_previous_work) ORDER BY 1)
        INTO v_changed_fields;
      ELSE
        -- The service-role RPC has no user subject in auth.uid(). Set the
        -- verified caller only while the existing work timestamp trigger runs.
        PERFORM pg_catalog.set_config('request.jwt.claim.sub', p_actor_id::TEXT, TRUE);
        UPDATE public.work
        SET voice_actor_id = v_operation.voice_actor_id
        WHERE id = v_operation.work_id
          AND dubbing_project_id = v_project_id
          AND actor_id = v_operation.actor_id
        RETURNING * INTO v_new_work;
        GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
        IF v_affected_rows <> 1 THEN
          RAISE EXCEPTION 'Work % changed while the assignment was being saved', v_operation.work_id
            USING ERRCODE = 'PT409';
        END IF;
        PERFORM pg_catalog.set_config('request.jwt.claim.sub', coalesce(v_prior_auth_sub, ''), TRUE);
        v_action := 'update';
        v_new_work_json := to_jsonb(v_new_work);
        SELECT ARRAY(
          SELECT field_name
          FROM (
            SELECT jsonb_object_keys(v_previous_work) AS field_name
            UNION
            SELECT jsonb_object_keys(v_new_work_json) AS field_name
          ) AS fields
          WHERE v_previous_work -> field_name IS DISTINCT FROM v_new_work_json -> field_name
          ORDER BY field_name
        ) INTO v_changed_fields;
      END IF;
    END IF;

    INSERT INTO public.audit_logs (
      user_id, entity_type, entity_id, action, previous_value, new_value
    ) VALUES (
      p_actor_id,
      'work',
      CASE WHEN v_action = 'create' THEN v_new_work.id::TEXT ELSE v_operation.work_id::TEXT END,
      v_action,
      v_previous_work,
      v_new_work_json
    ) RETURNING id INTO v_audit_log_id;
    v_audit_events := v_audit_events || jsonb_build_array(jsonb_build_object(
      'audit_log_id', v_audit_log_id,
      'changed_fields', to_jsonb(v_changed_fields),
      'metadata', jsonb_build_object(
        'source', '/api/admin/dubbing-project',
        'actor_id', v_operation.actor_id,
        'operation', v_action
      )
    ));
  END LOOP;

  INSERT INTO private.regional_assignment_requests (
    actor_id, request_id, request_fingerprint, result_project_id, metadata
  ) VALUES (
    p_actor_id,
    p_request_id,
    v_fingerprint,
    v_project_id,
    jsonb_build_object(
      'source', '/api/admin/dubbing-project',
      'content_id', p_content_id,
      'content_type', p_content_type,
      'dubbing_language', p_dubbing_language,
      'operation_count', jsonb_array_length(p_operations)
    )
  );

  FOR v_event IN SELECT value FROM jsonb_array_elements(v_audit_events) AS event(value)
  LOOP
    INSERT INTO private.regional_assignment_request_audits (
      actor_id, request_id, audit_log_id, changed_fields, metadata
    ) VALUES (
      p_actor_id,
      p_request_id,
      (v_event ->> 'audit_log_id')::UUID,
      ARRAY(SELECT jsonb_array_elements_text(v_event -> 'changed_fields')),
      v_event -> 'metadata'
    );
  END LOOP;

  RETURN v_project_id;
END;
$function$
;

-- sql2: apply_extracted_credits rewritten to resolve media_id (legacy-style content_id/content_type inputs unchanged)
CREATE OR REPLACE FUNCTION public.apply_extracted_credits(p_content_id bigint, p_content_type text, p_dubbing_language text, p_credits jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_project_id bigint;
  v_media_id bigint;
  v_inserted_actors integer := 0;
  v_inserted_works integer := 0;
  v_overlapped_works integer := 0;
  v_mismatched_works integer := 0;
BEGIN
  IF p_content_id IS NULL OR p_content_id <= 0
    OR p_content_type IS NULL OR p_content_type NOT IN ('movie', 'tv', 'video_game')
    OR p_dubbing_language IS NULL
    OR NOT public.is_valid_dubbing_language(p_dubbing_language) THEN
    RAISE EXCEPTION 'Invalid extracted credit batch' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_credits) IS DISTINCT FROM 'array' OR jsonb_array_length(p_credits) > 1000 THEN
    RAISE EXCEPTION 'Extracted credits must be a JSON array of at most 1000 items' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_credits) AS item(value)
    WHERE jsonb_typeof(item.value) IS DISTINCT FROM 'object'
      OR NULLIF(btrim(item.value->>'firstname'), '') IS NULL
      OR NULLIF(btrim(item.value->>'lastname'), '') IS NULL
      OR COALESCE(item.value->>'actor_id', '') !~ '^[0-9]+$'
      OR (item.value->>'actor_id')::numeric <= 0
      OR (item.value ? 'character_id' AND item.value->>'character_id' IS NOT NULL
          AND (item.value->>'character_id' !~ '^[0-9]+$'
            OR (item.value->>'character_id')::numeric <= 0))
  ) THEN
    RAISE EXCEPTION 'Malformed extracted credit' USING ERRCODE = '22023';
  END IF;

  v_media_id := private.resolve_media(p_content_type, p_content_id);
  INSERT INTO public.dubbing_projects(media_id, language)
  VALUES (v_media_id, p_dubbing_language)
  ON CONFLICT (media_id, language) DO NOTHING;
  SELECT project.id INTO STRICT v_project_id
  FROM public.dubbing_projects AS project
  WHERE project.media_id = v_media_id
    AND project.language = p_dubbing_language
  FOR UPDATE;

  PERFORM pg_advisory_xact_lock(hashtextextended(names.normalized_name, 0))
  FROM (
    SELECT DISTINCT lower(btrim(item.value->>'firstname')) || E'\x1f' ||
      lower(btrim(item.value->>'lastname')) AS normalized_name
    FROM jsonb_array_elements(p_credits) WITH ORDINALITY AS item(value, ordinal)
    ORDER BY normalized_name
  ) AS names;

  WITH names AS (
    SELECT DISTINCT ON (lower(btrim(item.value->>'firstname')),
                        lower(btrim(item.value->>'lastname')))
      btrim(item.value->>'firstname') AS firstname,
      btrim(item.value->>'lastname') AS lastname
    FROM jsonb_array_elements(p_credits) WITH ORDINALITY AS item(value, ordinal)
    ORDER BY lower(btrim(item.value->>'firstname')),
             lower(btrim(item.value->>'lastname')),
             btrim(item.value->>'firstname'), btrim(item.value->>'lastname')
  )
  INSERT INTO public.voice_actors(firstname, lastname)
  SELECT names.firstname, names.lastname FROM names
  WHERE NOT EXISTS (
    SELECT 1 FROM public.voice_actors AS actor
    WHERE lower(actor.firstname) = lower(names.firstname)
      AND lower(actor.lastname) = lower(names.lastname)
  )
  ON CONFLICT (firstname, lastname) DO NOTHING;
  GET DIAGNOSTICS v_inserted_actors = ROW_COUNT;

  WITH raw_credits AS (
    SELECT
      btrim(item.value->>'firstname') AS firstname,
      btrim(item.value->>'lastname') AS lastname,
      (item.value->>'actor_id')::bigint AS actor_id,
      NULLIF(item.value->>'character_id', '')::bigint AS character_id,
      NULLIF(item.value->>'character_name', '') AS character_name,
      NULLIF(item.value->>'performance', '') AS incoming_performance,
      COALESCE(NULLIF(item.value->>'performance', ''), 'dialogues') AS performance,
      item.ordinal,
      public.work_role_identity_key(NULLIF(item.value->>'character_id', '')::bigint,
        NULLIF(item.value->>'character_name', '')) AS role_key
    FROM jsonb_array_elements(p_credits) WITH ORDINALITY AS item(value, ordinal)
  ), credits AS (
    SELECT DISTINCT ON (
      lower(firstname), lower(lastname), actor_id,
      COALESCE(role_key, 'ambiguous:' || ordinal::text)
    ) *
    FROM raw_credits
    ORDER BY lower(firstname), lower(lastname), actor_id,
      COALESCE(role_key, 'ambiguous:' || ordinal::text), ordinal DESC
  ), actor_resolved AS (
    SELECT credits.*, actor.id AS voice_actor_id,
      row_number() OVER (
        PARTITION BY actor.id, credits.actor_id, credits.role_key
        ORDER BY credits.ordinal
      ) AS match_ordinal
    FROM credits
    JOIN LATERAL (
      SELECT candidate.id FROM public.voice_actors AS candidate
      WHERE lower(candidate.firstname) = lower(credits.firstname)
        AND lower(candidate.lastname) = lower(credits.lastname)
      ORDER BY (candidate.firstname = credits.firstname AND candidate.lastname = credits.lastname) DESC,
        candidate.id
      LIMIT 1
    ) AS actor ON true
  ), resolved AS (
    SELECT credits.*, existing.id AS existing_work_id
    FROM actor_resolved AS credits
    LEFT JOIN LATERAL (
      SELECT candidate.id FROM public.work AS candidate
      WHERE candidate.dubbing_project_id = v_project_id
        AND candidate.game_character_id IS NULL
        AND candidate.voice_actor_id = credits.voice_actor_id
        AND candidate.actor_id = credits.actor_id
        AND public.work_role_identity_key(candidate.character_id, candidate.character_name)
          IS NOT DISTINCT FROM credits.role_key
      ORDER BY candidate.id
      OFFSET (credits.match_ordinal - 1)
      LIMIT 1
    ) AS existing ON true
  ), inserted AS (
    INSERT INTO public.work(
      dubbing_project_id, voice_actor_id, actor_id, character_id, character_name, performance
    )
    SELECT v_project_id, resolved.voice_actor_id, resolved.actor_id, resolved.character_id,
      resolved.character_name, resolved.performance
    FROM resolved
    WHERE resolved.existing_work_id IS NULL
    ORDER BY resolved.actor_id, resolved.voice_actor_id, resolved.role_key, resolved.match_ordinal
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  SELECT count(*) FILTER (WHERE resolved.existing_work_id IS NOT NULL),
    count(*) FILTER (
      WHERE existing.id IS NOT NULL
        AND (
          (resolved.incoming_performance IS NOT NULL AND existing.performance IS DISTINCT FROM resolved.incoming_performance)
          OR (resolved.character_id IS NOT NULL AND existing.character_id IS DISTINCT FROM resolved.character_id)
          OR (resolved.character_name IS NOT NULL AND lower(btrim(existing.character_name)) IS DISTINCT FROM lower(btrim(resolved.character_name)))
        )
    ),
    (SELECT count(*) FROM inserted)
  INTO v_overlapped_works, v_mismatched_works, v_inserted_works
  FROM resolved
  LEFT JOIN public.work AS existing ON existing.id = resolved.existing_work_id;

  RETURN jsonb_build_object('new_voice_actors', v_inserted_actors,
    'credits_added', v_inserted_works,
    'credits_overlapped', v_overlapped_works,
    'credits_mismatched', v_mismatched_works);
END;
$function$
;

-- sql2: save_admin_credit_import unchanged: it only forwards the legacy-style reference to find_or_create_dubbing_project (sibling worker)
CREATE OR REPLACE FUNCTION public.save_admin_credit_import(p_admin_id uuid, p_request_id uuid, p_content_id bigint, p_content_type text, p_language text, p_voice_actor_id bigint, p_voice_actor_firstname text, p_voice_actor_lastname text, p_work_actor_id bigint, p_character_id bigint, p_character_name text)
 RETURNS TABLE(work_id bigint, project_id bigint, voice_actor_id bigint, audit_log_id uuid, replayed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_admin_role TEXT;
  v_project_id BIGINT;
  v_project_request_id UUID;
  v_voice_actor_id BIGINT;
  v_voice_actor_request_id UUID;
  v_work_request_id UUID;
  v_legacy_voice_actor_id BIGINT;
  v_voice_actor_result JSONB;
  v_voice_actor_firstname TEXT;
  v_voice_actor_lastname TEXT;
  v_fingerprint TEXT;
  v_role_identity TEXT;
  v_role_match_count BIGINT;
  v_work public.work%ROWTYPE;
  v_work_before public.work%ROWTYPE;
  v_existing_audit public.audit_logs%ROWTYPE;
  v_existing_request private.admin_credit_import_requests%ROWTYPE;
  v_result JSONB;
  v_audit_id UUID;
  v_action TEXT;
BEGIN
  IF p_admin_id IS NULL OR p_request_id IS NULL
     OR p_content_id IS NULL OR p_content_id = 0
     OR p_content_type IS NULL
     OR p_content_type NOT IN (
       'movie', 'tv', 'video_game', 'audiobook', 'podcast', 'advertisement', 'toy'
     )
     OR (p_content_id < 0 AND p_content_type NOT IN ('advertisement', 'toy'))
     OR p_language IS NULL OR NOT public.is_valid_dubbing_language(p_language)
     OR (p_voice_actor_id IS NOT NULL AND p_voice_actor_id <= 0)
     OR (p_voice_actor_id IS NULL AND (
       p_voice_actor_firstname IS NULL
       OR pg_catalog.length(pg_catalog.btrim(p_voice_actor_firstname)) NOT BETWEEN 1 AND 120
       OR p_voice_actor_lastname IS NULL
       OR pg_catalog.length(pg_catalog.btrim(p_voice_actor_lastname)) NOT BETWEEN 1 AND 120
     ))
     OR (p_work_actor_id IS NOT NULL AND p_work_actor_id <= 0)
     OR (p_character_id IS NOT NULL AND p_character_id <= 0)
     OR (p_character_name IS NOT NULL AND (
       pg_catalog.length(p_character_name) > 300
       OR pg_catalog.btrim(p_character_name) = ''
     )) THEN
    RAISE EXCEPTION 'Admin credit import fields are invalid'
      USING ERRCODE = '22023';
  END IF;

  SELECT users.raw_app_meta_data ->> 'role'
  INTO v_admin_role
  FROM auth.users AS users
  WHERE users.id = p_admin_id
  FOR SHARE;
  IF NOT FOUND OR v_admin_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only an administrator can import credits'
      USING ERRCODE = '42501';
  END IF;

  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'operation', 'save_admin_credit_import',
    'content_id', p_content_id,
    'content_type', p_content_type,
    'language', p_language,
    'voice_actor_id', p_voice_actor_id,
    'voice_actor_name', CASE WHEN p_voice_actor_id IS NULL THEN
      pg_catalog.jsonb_build_object(
        'firstname', pg_catalog.btrim(p_voice_actor_firstname),
        'lastname', pg_catalog.btrim(p_voice_actor_lastname)
      )
      ELSE NULL::JSONB
    END,
    'work_actor_id', p_work_actor_id,
    'character_id', p_character_id,
    'character_name', p_character_name,
    'performance', 'dialogues',
    'status', 'validated'
  )::TEXT);

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'admin-credit-import-request:' || p_admin_id::TEXT || ':' || p_request_id::TEXT,
      0
    )
  );

  SELECT request.*
  INTO v_existing_request
  FROM private.admin_credit_import_requests AS request
  WHERE request.admin_id = p_admin_id
    AND request.request_id = p_request_id;
  IF FOUND THEN
    IF v_existing_request.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'Request id was already used with different credit data'
        USING ERRCODE = '23505';
    END IF;
    RETURN QUERY SELECT
      (v_existing_request.result ->> 'work_id')::BIGINT,
      (v_existing_request.result ->> 'project_id')::BIGINT,
      (v_existing_request.result ->> 'voice_actor_id')::BIGINT,
      (v_existing_request.result ->> 'audit_log_id')::UUID,
      TRUE;
    RETURN;
  END IF;

  SELECT audit.*
  INTO v_existing_audit
  FROM public.audit_logs AS audit
  WHERE audit.user_id = p_admin_id
    AND audit.request_id = p_request_id;
  IF FOUND THEN
    IF v_existing_audit.entity_type = 'voice_actor'
       AND v_existing_audit.action = 'create'
       AND p_voice_actor_id IS NULL
       AND pg_catalog.lower(v_existing_audit.new_value ->> 'firstname')
         = pg_catalog.lower(pg_catalog.btrim(p_voice_actor_firstname))
       AND pg_catalog.lower(v_existing_audit.new_value ->> 'lastname')
         = pg_catalog.lower(pg_catalog.btrim(p_voice_actor_lastname)) THEN
      -- Before this RPC existed, process-credits used the credit request ID
      -- for controlled actor creation. Resume that request without creating
      -- another actor, then record the completed work under its own audit ID.
      v_legacy_voice_actor_id := v_existing_audit.entity_id::BIGINT;
    ELSE
      RAISE EXCEPTION 'Request id was already used for a different operation'
        USING ERRCODE = '23505';
    END IF;
  END IF;

  v_work_request_id := pg_catalog.md5(
    'admin-credit-import-work:' || p_admin_id::TEXT || ':' || p_request_id::TEXT
  )::UUID;
  v_project_request_id := pg_catalog.md5(
    'admin-credit-import-project:' || p_admin_id::TEXT || ':' || p_request_id::TEXT
  )::UUID;
  SELECT project.project_id
  INTO v_project_id
  FROM public.find_or_create_dubbing_project(
    p_admin_id, NULL, v_project_request_id,
    p_content_id, p_content_type, p_language
  ) AS project;

  IF v_legacy_voice_actor_id IS NOT NULL THEN
    v_voice_actor_id := v_legacy_voice_actor_id;
  ELSIF p_voice_actor_id IS NOT NULL THEN
    SELECT actor.id
    INTO v_voice_actor_id
    FROM public.voice_actors AS actor
    WHERE actor.id = p_voice_actor_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Selected voice actor does not exist'
        USING ERRCODE = '23503';
    END IF;
  ELSE
    v_voice_actor_firstname := pg_catalog.btrim(p_voice_actor_firstname);
    v_voice_actor_lastname := pg_catalog.btrim(p_voice_actor_lastname);
    IF pg_catalog.length(v_voice_actor_firstname) NOT BETWEEN 1 AND 120
       OR pg_catalog.length(v_voice_actor_lastname) NOT BETWEEN 1 AND 120 THEN
      RAISE EXCEPTION 'Voice actor first and last names are required'
        USING ERRCODE = '22023';
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'admin-credit-import-voice-actor:' ||
          pg_catalog.lower(v_voice_actor_firstname) || E'\x1f' ||
          pg_catalog.lower(v_voice_actor_lastname),
        0
      )
    );

    SELECT actor.id
    INTO v_voice_actor_id
    FROM public.voice_actors AS actor
    WHERE pg_catalog.lower(actor.firstname) = pg_catalog.lower(v_voice_actor_firstname)
      AND pg_catalog.lower(actor.lastname) = pg_catalog.lower(v_voice_actor_lastname)
    ORDER BY (
      actor.firstname = v_voice_actor_firstname
      AND actor.lastname = v_voice_actor_lastname
    ) DESC, actor.id
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      v_voice_actor_request_id := pg_catalog.md5(
        'admin-credit-import-voice-actor:' || p_admin_id::TEXT || ':' || p_request_id::TEXT
      )::UUID;
      BEGIN
        v_voice_actor_result := public.controlled_save_metadata(
          p_admin_id,
          'voice_actor',
          pg_catalog.jsonb_build_object(
            'firstname', v_voice_actor_firstname,
            'lastname', v_voice_actor_lastname
          ),
          v_voice_actor_request_id
        );
      EXCEPTION WHEN unique_violation THEN
        -- A legacy metadata writer may not use this importer lock. Reuse the
        -- actor it inserted if the exact or case-folded name now exists.
        SELECT actor.id
        INTO v_voice_actor_id
        FROM public.voice_actors AS actor
        WHERE pg_catalog.lower(actor.firstname) = pg_catalog.lower(v_voice_actor_firstname)
          AND pg_catalog.lower(actor.lastname) = pg_catalog.lower(v_voice_actor_lastname)
        ORDER BY (
          actor.firstname = v_voice_actor_firstname
          AND actor.lastname = v_voice_actor_lastname
        ) DESC, actor.id
        LIMIT 1
        FOR UPDATE;
        IF NOT FOUND THEN
          RAISE;
        END IF;
      END;

      IF v_voice_actor_id IS NULL THEN
        v_voice_actor_id := (v_voice_actor_result #>> '{record,id}')::BIGINT;
      END IF;
      IF v_voice_actor_id IS NULL THEN
        RAISE EXCEPTION 'Metadata creation returned an invalid voice actor'
          USING ERRCODE = '22023';
      END IF;
    END IF;
  END IF;

  v_role_identity := public.work_role_identity_key(
    p_character_id, p_character_name
  );
  IF v_role_identity IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        pg_catalog.jsonb_build_array(
          v_project_id, p_work_actor_id, v_voice_actor_id, v_role_identity
        )::TEXT,
        0
      )
    );

    SELECT pg_catalog.count(*)
    INTO v_role_match_count
    FROM public.work AS work
    WHERE work.dubbing_project_id = v_project_id
      AND work.actor_id IS NOT DISTINCT FROM p_work_actor_id
      AND work.voice_actor_id = v_voice_actor_id
      AND work.game_character_id IS NULL
      AND public.work_role_identity_key(work.character_id, work.character_name)
        = v_role_identity;
    IF v_role_match_count > 1 THEN
      RAISE EXCEPTION 'Multiple work records match this credit role'
        USING ERRCODE = '55000';
    END IF;
  ELSE
    v_role_match_count := 0;
  END IF;

  PERFORM pg_catalog.set_config(
    'app.controlled_voice_actor_work_mutation', 'true', TRUE
  );
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', p_admin_id::TEXT, TRUE);

  IF v_role_match_count = 1 THEN
    SELECT work.*
    INTO v_work_before
    FROM public.work AS work
    WHERE work.dubbing_project_id = v_project_id
      AND work.actor_id IS NOT DISTINCT FROM p_work_actor_id
      AND work.voice_actor_id = v_voice_actor_id
      AND work.game_character_id IS NULL
      AND public.work_role_identity_key(work.character_id, work.character_name)
        = v_role_identity
    FOR UPDATE;

    UPDATE public.work AS work
    SET performance = 'dialogues',
        status = 'validated',
        character_name = p_character_name
    WHERE work.id = v_work_before.id
    RETURNING work.* INTO v_work;
    v_action := 'update';
  ELSE
    INSERT INTO public.work (
      dubbing_project_id, actor_id, voice_actor_id, character_id,
      character_name, performance, status
    ) VALUES (
      v_project_id, p_work_actor_id, v_voice_actor_id, p_character_id,
      p_character_name, 'dialogues', 'validated'
    )
    RETURNING * INTO v_work;
    v_action := 'create';
  END IF;

  v_audit_id := public.audit_voice_actor_work_mutation(
    p_admin_id,
    v_work_request_id,
    v_fingerprint,
    v_work.id,
    v_action,
    CASE WHEN v_action = 'create' THEN 'null'::JSONB
      ELSE pg_catalog.to_jsonb(v_work_before) END,
    pg_catalog.to_jsonb(v_work),
    pg_catalog.jsonb_build_object(
      'import_source', 'process_credits',
      'dubbing_project_id', v_project_id,
      'voice_actor_id', v_voice_actor_id,
      'work_actor_id', p_work_actor_id,
      'role_identity', v_role_identity
    )
  );

  v_result := pg_catalog.jsonb_build_object(
    'work_id', v_work.id,
    'project_id', v_project_id,
    'voice_actor_id', v_voice_actor_id,
    'audit_log_id', v_audit_id
  );
  INSERT INTO private.admin_credit_import_requests (
    admin_id, request_id, request_fingerprint, result
  ) VALUES (
    p_admin_id, p_request_id, v_fingerprint, v_result
  );

  RETURN QUERY SELECT v_work.id, v_project_id, v_voice_actor_id, v_audit_id, FALSE;
END;
$function$
;

-- create_voice_actor_work_link (with p_game_character_id): media_id based identity
CREATE OR REPLACE FUNCTION public.create_voice_actor_work_link(p_user_id uuid, p_request_id uuid, p_voice_actor_id bigint, p_content_id bigint, p_content_type text, p_language text, p_actor_person_id bigint, p_game_character_id uuid, p_character_name text, p_performance text)
 RETURNS TABLE(work_id bigint, project_id bigint, audit_log_id uuid, replayed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_project_id BIGINT;
  v_media_id BIGINT;
  v_verified BOOLEAN;
  v_project_count BIGINT;
  v_project_request_id UUID;
  v_role TEXT;
  v_role_lock BIGINT;
  v_fingerprint TEXT;
  v_match_count BIGINT;
  v_work public.work%ROWTYPE;
  v_existing_audit public.audit_logs%ROWTYPE;
  v_audit_id UUID;
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL
     OR p_voice_actor_id IS NULL OR p_voice_actor_id <= 0
     OR p_content_id IS NULL OR p_content_id = 0
     OR p_content_type IS NULL
     OR p_content_type NOT IN ('movie', 'tv', 'video_game', 'audiobook', 'podcast', 'advertisement', 'toy')
     OR (p_content_id < 0 AND p_content_type NOT IN ('advertisement', 'toy'))
     OR p_language IS NULL OR NOT public.is_valid_dubbing_language(p_language)
     OR (p_actor_person_id IS NOT NULL AND p_actor_person_id <= 0)
     OR (p_game_character_id IS NOT NULL AND p_content_type <> 'video_game')
     OR p_character_name IS NULL OR length(pg_catalog.btrim(p_character_name)) = 0
     OR length(p_character_name) > 300
     OR p_performance IS NULL
     OR p_performance NOT IN ('dialogues', 'chant', 'dialogues & chant', 'bruitages', 'narration', 'ambiances', 'voice') THEN
    RAISE EXCEPTION 'Voice actor work link fields are invalid' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('voice-work-request:' || p_user_id::TEXT || ':' || p_request_id::TEXT, 0)
  );
  v_verified := public.work_contribution_privilege(p_user_id, p_voice_actor_id);
  IF NOT EXISTS (
    SELECT 1 FROM public.voice_actors AS voice_actor WHERE voice_actor.id = p_voice_actor_id
  ) THEN
    RAISE EXCEPTION 'Voice actor does not exist' USING ERRCODE = '23503';
  END IF;
  IF p_game_character_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.game_characters AS character
    WHERE character.id = p_game_character_id
      AND character.media_id = private.find_media_id('video_game', p_content_id)
  ) THEN
    RAISE EXCEPTION 'Game character does not belong to this game' USING ERRCODE = '23503';
  END IF;

  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'operation', 'create_voice_actor_work_link',
    'voice_actor_id', p_voice_actor_id,
    'content_id', p_content_id,
    'content_type', p_content_type,
    'language', p_language,
    'actor_person_id', p_actor_person_id,
    'game_character_id', p_game_character_id,
    'character_name', p_character_name,
    'performance', p_performance
  )::TEXT);
  SELECT audit.* INTO v_existing_audit
  FROM public.audit_logs AS audit
  WHERE audit.user_id = p_user_id AND audit.request_id = p_request_id;
  IF FOUND THEN
    IF v_existing_audit.request_fingerprint IS DISTINCT FROM v_fingerprint
       OR v_existing_audit.entity_type <> 'work'
       OR v_existing_audit.action NOT IN ('create', 'ensure_link') THEN
      RAISE EXCEPTION 'Request id was already used with different work data'
        USING ERRCODE = '23505';
    END IF;
    SELECT work.* INTO v_work
    FROM public.work AS work
    WHERE work.id = v_existing_audit.entity_id::BIGINT;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The work created by this request no longer exists'
        USING ERRCODE = '55000';
    END IF;
    RETURN QUERY SELECT v_work.id, v_work.dubbing_project_id, v_existing_audit.id, TRUE;
    RETURN;
  END IF;

  v_project_request_id := pg_catalog.md5(
    'voice-actor-work-project:' || p_user_id::TEXT || ':' || p_request_id::TEXT
  )::UUID;
  PERFORM pg_catalog.set_config('app.controlled_voice_actor_work_mutation', 'true', TRUE);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', p_user_id::TEXT, TRUE);
  SELECT project.project_id INTO v_project_id
  FROM public.find_or_create_dubbing_project(
    p_user_id, p_voice_actor_id, v_project_request_id,
    p_content_id, p_content_type, p_language
  ) AS project;

  v_media_id := private.find_media_id(p_content_type, p_content_id);
  SELECT count(*) INTO v_project_count
  FROM public.dubbing_projects AS project
  WHERE project.media_id = v_media_id
    AND project.language = p_language;
  IF v_project_count <> 1 OR NOT EXISTS (
    SELECT 1 FROM public.dubbing_projects AS project
    WHERE project.id = v_project_id
      AND project.media_id = v_media_id
      AND project.language = p_language
  ) THEN
    RAISE EXCEPTION 'Dubbing project identity is ambiguous or invalid'
      USING ERRCODE = '55000';
  END IF;

  v_role := public.work_assignment_role_identity_key(p_game_character_id, NULL::BIGINT, p_character_name);
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'A character name is required to identify this role'
      USING ERRCODE = '22023';
  END IF;
  v_role_lock := pg_catalog.hashtextextended(
    pg_catalog.jsonb_build_array(v_project_id, p_actor_person_id, p_voice_actor_id, v_role)::TEXT,
    0
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(v_role_lock);

  SELECT count(*) INTO v_match_count
  FROM public.work AS work
  WHERE work.dubbing_project_id = v_project_id
    AND work.actor_id IS NOT DISTINCT FROM p_actor_person_id
    AND work.voice_actor_id = p_voice_actor_id
    AND public.work_assignment_role_identity_key(work.game_character_id, work.character_id, work.character_name) = v_role;
  IF v_match_count > 1 THEN
    RAISE EXCEPTION 'Multiple work records match this role identity'
      USING ERRCODE = '55000';
  END IF;
  IF v_match_count = 1 THEN
    SELECT work.* INTO v_work
    FROM public.work AS work
    WHERE work.dubbing_project_id = v_project_id
      AND work.actor_id IS NOT DISTINCT FROM p_actor_person_id
      AND work.voice_actor_id = p_voice_actor_id
      AND public.work_assignment_role_identity_key(work.game_character_id, work.character_id, work.character_name) = v_role
    FOR UPDATE;
    v_audit_id := public.audit_voice_actor_work_mutation(
      p_user_id, p_request_id, v_fingerprint, v_work.id, 'ensure_link',
      pg_catalog.to_jsonb(v_work), pg_catalog.to_jsonb(v_work),
      pg_catalog.jsonb_build_object('dubbing_project_id', v_project_id, 'voice_actor_id', p_voice_actor_id)
    );
    RETURN QUERY SELECT v_work.id, v_project_id, v_audit_id, FALSE;
    RETURN;
  END IF;

  INSERT INTO public.work (
    dubbing_project_id, game_character_id, actor_id, voice_actor_id, character_name,
    performance, status, reviewed_status, created_by
  ) VALUES (
    v_project_id, p_game_character_id, p_actor_person_id, p_voice_actor_id, p_character_name,
    p_performance, 'user', CASE WHEN v_verified THEN 'accepted' ELSE 'waiting' END, p_user_id
  )
  RETURNING * INTO v_work;
  v_audit_id := public.audit_voice_actor_work_mutation(
    p_user_id, p_request_id, v_fingerprint, v_work.id, 'create',
    'null'::JSONB, pg_catalog.to_jsonb(v_work),
    pg_catalog.jsonb_build_object('dubbing_project_id', v_project_id, 'voice_actor_id', p_voice_actor_id)
  );
  RETURN QUERY SELECT v_work.id, v_project_id, v_audit_id, FALSE;
END;
$function$
;

-- create_voice_actor_work_link (no game character): project identity checked through media_id
CREATE OR REPLACE FUNCTION public.create_voice_actor_work_link(p_user_id uuid, p_request_id uuid, p_voice_actor_id bigint, p_content_id bigint, p_content_type text, p_language text, p_actor_person_id bigint, p_character_name text, p_performance text)
 RETURNS TABLE(work_id bigint, project_id bigint, audit_log_id uuid, replayed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_project_id BIGINT;
  v_media_id BIGINT;
  v_project_count BIGINT;
  v_project_request_id UUID;
  v_role TEXT;
  v_role_lock BIGINT;
  v_fingerprint TEXT;
  v_match_count BIGINT;
  v_work public.work%ROWTYPE;
  v_existing_audit public.audit_logs%ROWTYPE;
  v_audit_id UUID;
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL
     OR p_voice_actor_id IS NULL OR p_voice_actor_id <= 0
     OR p_content_id IS NULL OR p_content_id = 0
     OR p_content_type IS NULL
     OR p_content_type NOT IN ('movie', 'tv', 'video_game', 'audiobook', 'podcast', 'advertisement', 'toy')
     OR (p_content_id < 0 AND p_content_type NOT IN ('advertisement', 'toy'))
     OR p_language IS NULL OR NOT public.is_valid_dubbing_language(p_language)
     OR (p_actor_person_id IS NOT NULL AND p_actor_person_id <= 0)
     OR p_character_name IS NULL OR length(pg_catalog.btrim(p_character_name)) = 0
     OR length(p_character_name) > 300
     OR p_performance IS NULL
     OR p_performance NOT IN ('dialogues', 'chant', 'dialogues & chant', 'bruitages', 'narration', 'ambiances', 'voice') THEN
    RAISE EXCEPTION 'Voice actor work link fields are invalid' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('voice-work-request:' || p_user_id::TEXT || ':' || p_request_id::TEXT, 0)
  );
  PERFORM public.require_voice_actor_work_permission(p_user_id, p_voice_actor_id);
  IF NOT EXISTS (
    SELECT 1 FROM public.voice_actors AS voice_actor WHERE voice_actor.id = p_voice_actor_id
  ) THEN
    RAISE EXCEPTION 'Voice actor does not exist' USING ERRCODE = '23503';
  END IF;

  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'operation', 'create_voice_actor_work_link',
    'voice_actor_id', p_voice_actor_id,
    'content_id', p_content_id,
    'content_type', p_content_type,
    'language', p_language,
    'actor_person_id', p_actor_person_id,
    'character_name', p_character_name,
    'performance', p_performance
  )::TEXT);
  SELECT audit.* INTO v_existing_audit
  FROM public.audit_logs AS audit
  WHERE audit.user_id = p_user_id AND audit.request_id = p_request_id;
  IF FOUND THEN
    IF v_existing_audit.request_fingerprint IS DISTINCT FROM v_fingerprint
       OR v_existing_audit.entity_type <> 'work'
       OR v_existing_audit.action NOT IN ('create', 'ensure_link') THEN
      RAISE EXCEPTION 'Request id was already used with different work data'
        USING ERRCODE = '23505';
    END IF;
    SELECT work.* INTO v_work
    FROM public.work AS work
    WHERE work.id = v_existing_audit.entity_id::BIGINT;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The work created by this request no longer exists'
        USING ERRCODE = '55000';
    END IF;
    RETURN QUERY SELECT v_work.id, v_work.dubbing_project_id, v_existing_audit.id, TRUE;
    RETURN;
  END IF;

  v_project_request_id := pg_catalog.md5(
    'voice-actor-work-project:' || p_user_id::TEXT || ':' || p_request_id::TEXT
  )::UUID;
  PERFORM pg_catalog.set_config('app.controlled_voice_actor_work_mutation', 'true', TRUE);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', p_user_id::TEXT, TRUE);
  SELECT project.project_id INTO v_project_id
  FROM public.find_or_create_dubbing_project(
    p_user_id, p_voice_actor_id, v_project_request_id,
    p_content_id, p_content_type, p_language
  ) AS project;

  v_media_id := private.find_media_id(p_content_type, p_content_id);
  SELECT count(*) INTO v_project_count
  FROM public.dubbing_projects AS project
  WHERE project.media_id = v_media_id
    AND project.language = p_language;
  IF v_project_count <> 1 OR NOT EXISTS (
    SELECT 1 FROM public.dubbing_projects AS project
    WHERE project.id = v_project_id
      AND project.media_id = v_media_id
      AND project.language = p_language
  ) THEN
    RAISE EXCEPTION 'Dubbing project identity is ambiguous or invalid'
      USING ERRCODE = '55000';
  END IF;

  v_role := public.work_role_identity_key(NULL::BIGINT, p_character_name);
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'A character name is required to identify this role'
      USING ERRCODE = '22023';
  END IF;
  v_role_lock := pg_catalog.hashtextextended(
    pg_catalog.jsonb_build_array(v_project_id, p_actor_person_id, p_voice_actor_id, v_role)::TEXT,
    0
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(v_role_lock);

  SELECT count(*) INTO v_match_count
  FROM public.work AS work
  WHERE work.dubbing_project_id = v_project_id
    AND work.actor_id IS NOT DISTINCT FROM p_actor_person_id
    AND work.voice_actor_id = p_voice_actor_id
    AND work.game_character_id IS NULL
    AND public.work_role_identity_key(work.character_id, work.character_name) = v_role;
  IF v_match_count > 1 THEN
    RAISE EXCEPTION 'Multiple work records match this role identity'
      USING ERRCODE = '55000';
  END IF;
  IF v_match_count = 1 THEN
    SELECT work.* INTO v_work
    FROM public.work AS work
    WHERE work.dubbing_project_id = v_project_id
      AND work.actor_id IS NOT DISTINCT FROM p_actor_person_id
      AND work.voice_actor_id = p_voice_actor_id
      AND work.game_character_id IS NULL
      AND public.work_role_identity_key(work.character_id, work.character_name) = v_role
    FOR UPDATE;
    v_audit_id := public.audit_voice_actor_work_mutation(
      p_user_id, p_request_id, v_fingerprint, v_work.id, 'ensure_link',
      pg_catalog.to_jsonb(v_work), pg_catalog.to_jsonb(v_work),
      pg_catalog.jsonb_build_object('dubbing_project_id', v_project_id, 'voice_actor_id', p_voice_actor_id)
    );
    RETURN QUERY SELECT v_work.id, v_project_id, v_audit_id, FALSE;
    RETURN;
  END IF;

  INSERT INTO public.work (
    dubbing_project_id, actor_id, voice_actor_id, character_name,
    performance, status, created_by
  ) VALUES (
    v_project_id, p_actor_person_id, p_voice_actor_id, p_character_name,
    p_performance, 'user', p_user_id
  )
  RETURNING * INTO v_work;
  v_audit_id := public.audit_voice_actor_work_mutation(
    p_user_id, p_request_id, v_fingerprint, v_work.id, 'create',
    'null'::JSONB, pg_catalog.to_jsonb(v_work),
    pg_catalog.jsonb_build_object('dubbing_project_id', v_project_id, 'voice_actor_id', p_voice_actor_id)
  );
  RETURN QUERY SELECT v_work.id, v_project_id, v_audit_id, FALSE;
END;
$function$
;

-- find_or_create_dubbing_project: resolves the reference to media_id (creating provider media on demand)
CREATE OR REPLACE FUNCTION public.find_or_create_dubbing_project(p_actor_id uuid, p_voice_actor_id bigint, p_request_id uuid, p_content_id bigint, p_content_type text, p_language text)
 RETURNS TABLE(project_id bigint, audit_log_id uuid, replayed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_actor_role TEXT;
  v_project public.dubbing_projects%ROWTYPE;
  v_existing_audit public.audit_logs%ROWTYPE;
  v_fingerprint TEXT;
  v_media_id BIGINT;
  v_audit_id UUID;
BEGIN
  SELECT users.raw_app_meta_data ->> 'role'
  INTO v_actor_role
  FROM auth.users AS users
  WHERE users.id = p_actor_id;
  IF p_actor_id IS NULL OR p_request_id IS NULL
     OR p_content_id IS NULL OR p_content_id = 0
     OR p_content_type IS NULL
     OR p_content_type NOT IN ('movie', 'tv', 'video_game', 'audiobook', 'podcast', 'advertisement', 'toy')
     OR (p_content_id < 0 AND p_content_type NOT IN ('advertisement', 'toy'))
     OR p_language IS NULL OR NOT public.is_valid_dubbing_language(p_language) THEN
    RAISE EXCEPTION 'Dubbing project references are invalid' USING ERRCODE = '22023';
  END IF;
  IF p_voice_actor_id IS NOT NULL
     AND current_setting('app.controlled_voice_actor_work_mutation', TRUE) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Voice actor project resolution must use a controlled work operation'
      USING ERRCODE = '42501';
  END IF;
  PERFORM private.assert_contributor(p_actor_id);
  IF v_actor_role IS DISTINCT FROM 'admin' AND p_voice_actor_id IS NULL THEN
    RAISE EXCEPTION 'A voice actor is required to resolve a dubbing project'
      USING ERRCODE = '42501';
  END IF;
  IF p_voice_actor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.voice_actors AS voice_actor WHERE voice_actor.id = p_voice_actor_id
  ) THEN
    RAISE EXCEPTION 'Selected voice actor does not exist' USING ERRCODE = '23503';
  END IF;
  IF p_content_type IN ('advertisement', 'toy') AND NOT EXISTS (
    SELECT 1 FROM public.dubbing_projects AS internal_project
    WHERE internal_project.media_id = private.find_media_id(p_content_type, p_content_id)
  ) THEN
    RAISE EXCEPTION 'Internal media must be created before a voice actor can link it'
      USING ERRCODE = '23503';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_id::TEXT || ':' || p_request_id::TEXT, 0)
  );
  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'voice_actor_id', p_voice_actor_id,
    'content_id', p_content_id,
    'content_type', p_content_type,
    'language', p_language
  )::TEXT);
  SELECT audit.* INTO v_existing_audit
  FROM public.audit_logs AS audit
  WHERE audit.user_id = p_actor_id AND audit.request_id = p_request_id;
  IF FOUND THEN
    IF v_existing_audit.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'Request id was already used with different project data'
        USING ERRCODE = '23505';
    END IF;
    SELECT project.* INTO v_project
    FROM public.dubbing_projects AS project
    WHERE project.id = v_existing_audit.entity_id::BIGINT;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The project created by this request no longer exists'
        USING ERRCODE = '55000';
    END IF;
    RETURN QUERY SELECT v_project.id, v_existing_audit.id, TRUE;
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_content_type || ':' || p_content_id::TEXT || ':' || p_language, 0
    )
  );
  v_media_id := private.resolve_media(p_content_type, p_content_id);
  SELECT project.* INTO v_project
  FROM public.dubbing_projects AS project
  WHERE project.media_id = v_media_id
    AND project.language = p_language
  FOR UPDATE;
  IF FOUND THEN
    RETURN QUERY SELECT v_project.id, NULL::UUID, FALSE;
    RETURN;
  END IF;

  INSERT INTO public.dubbing_projects(media_id, language)
  VALUES (v_media_id, p_language)
  RETURNING * INTO v_project;
  v_audit_id := pg_catalog.gen_random_uuid();
  INSERT INTO public.audit_logs (
    id, user_id, entity_type, entity_id, action,
    previous_value, new_value, changed_fields,
    request_id, request_fingerprint, metadata
  ) VALUES (
    v_audit_id, p_actor_id, 'dubbing_project', v_project.id::TEXT, 'create',
    pg_catalog.jsonb_build_object('project', NULL, 'crew', '[]'::JSONB, 'cast', '[]'::JSONB),
    pg_catalog.jsonb_build_object('project', pg_catalog.to_jsonb(v_project), 'crew', '[]'::JSONB, 'cast', '[]'::JSONB),
    ARRAY[]::TEXT[], p_request_id, v_fingerprint,
    pg_catalog.jsonb_build_object(
      'source', 'find_or_create_dubbing_project',
      'voice_actor_id', p_voice_actor_id,
      'transaction_id', pg_catalog.pg_current_xact_id()::TEXT
    )
  );
  RETURN QUERY SELECT v_project.id, v_audit_id, FALSE;
END;
$function$
;

-- controlled_save_toy_metadata: toy_metadata addressed by media_id (= p_content_id for toys)
CREATE OR REPLACE FUNCTION public.controlled_save_toy_metadata(p_actor_id uuid, p_request_id uuid, p_content_id bigint, p_expected_updated_at timestamp with time zone, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_actor_metadata JSONB;
  v_fingerprint TEXT;
  v_existing_audit public.audit_logs%ROWTYPE;
  v_toy public.toy_metadata%ROWTYPE;
  v_before JSONB;
  v_audit_id UUID;
BEGIN
  IF p_actor_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'An authenticated administrator and request id are required'
      USING ERRCODE = '28000';
  END IF;

  SELECT users.raw_app_meta_data
  INTO v_actor_metadata
  FROM auth.users AS users
  WHERE users.id = p_actor_id
  FOR SHARE OF users;

  IF NOT FOUND OR v_actor_metadata ->> 'role' IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only an administrator can save toy metadata'
      USING ERRCODE = '42501';
  END IF;

  IF p_content_id IS NULL OR p_content_id = 0
     OR p_payload IS NULL
     OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR NOT (p_payload ?& ARRAY[
       'name', 'manufacturer', 'product_line', 'release_year',
       'cover_url', 'description'
     ]::TEXT[])
     OR EXISTS (
       SELECT 1
       FROM jsonb_object_keys(p_payload) AS field(key)
       WHERE field.key <> ALL (ARRAY[
         'name', 'manufacturer', 'product_line', 'release_year',
         'cover_url', 'description'
       ]::TEXT[])
     ) THEN
    RAISE EXCEPTION 'Toy metadata contains an unknown, missing, or invalid field'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.dubbing_projects AS project
    WHERE project.media_id = p_content_id
      AND private.media_kind(project.media_id) = 'toy'
  ) THEN
    RAISE EXCEPTION 'Toy metadata must belong to an existing toy project'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_payload -> 'name') IS DISTINCT FROM 'string'
     OR length(btrim(p_payload ->> 'name')) NOT BETWEEN 1 AND 300
     OR jsonb_typeof(p_payload -> 'manufacturer') NOT IN ('string', 'null')
     OR jsonb_typeof(p_payload -> 'product_line') NOT IN ('string', 'null')
     OR jsonb_typeof(p_payload -> 'release_year') NOT IN ('number', 'null')
     OR jsonb_typeof(p_payload -> 'cover_url') NOT IN ('string', 'null')
     OR jsonb_typeof(p_payload -> 'description') NOT IN ('string', 'null') THEN
    RAISE EXCEPTION 'Toy metadata fields are invalid'
      USING ERRCODE = '22023';
  END IF;

  IF length(btrim(COALESCE(p_payload ->> 'manufacturer', ''))) > 300
     OR length(btrim(COALESCE(p_payload ->> 'product_line', ''))) > 300
     OR length(COALESCE(p_payload ->> 'description', '')) > 10000 THEN
    RAISE EXCEPTION 'Toy metadata text fields are too long'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_payload -> 'release_year') = 'number'
     AND (
       p_payload ->> 'release_year' !~ '^[0-9]{4}$'
       OR (p_payload ->> 'release_year')::INTEGER NOT BETWEEN 1800 AND 2200
     ) THEN
    RAISE EXCEPTION 'release_year must be between 1800 and 2200'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_payload -> 'cover_url') = 'string'
     AND (
       length(p_payload ->> 'cover_url') > 2048
       OR p_payload ->> 'cover_url' !~* '^https?://[^/[:space:]?#@]+(/[^[:space:]#?]*)?(\?[^[:space:]#]*)?(#[^[:space:]]*)?$'
       OR p_payload ->> 'cover_url' ~* '[?&](access[_-]?token|refresh[_-]?token|id[_-]?token|token|api[_-]?key|apikey|client[_-]?secret|secret|password|passwd|authorization)='
     ) THEN
    RAISE EXCEPTION 'cover_url must be a safe HTTP(S) URL'
      USING ERRCODE = '22023';
  END IF;

  v_fingerprint := md5(
    p_content_id::TEXT || ':' || COALESCE(p_expected_updated_at::TEXT, 'new') || ':' || p_payload::TEXT
  );

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_id::TEXT || ':' || p_request_id::TEXT, 0)
  );

  SELECT audit.*
  INTO v_existing_audit
  FROM public.audit_logs AS audit
  WHERE audit.user_id = p_actor_id
    AND audit.request_id = p_request_id;

  IF FOUND THEN
    IF v_existing_audit.entity_type IS DISTINCT FROM 'toy_metadata'
       OR v_existing_audit.entity_id IS DISTINCT FROM p_content_id::TEXT
       OR v_existing_audit.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'Request id was already used with different toy metadata'
        USING ERRCODE = '23505';
    END IF;

    SELECT metadata.*
    INTO v_toy
    FROM public.toy_metadata AS metadata
    WHERE metadata.media_id = p_content_id
    FOR UPDATE;

    IF NOT FOUND OR to_jsonb(v_toy) IS DISTINCT FROM v_existing_audit.new_value THEN
      RAISE EXCEPTION 'Toy metadata changed after this save; reload before retrying'
        USING ERRCODE = '55000';
    END IF;

    RETURN jsonb_build_object(
      'record', to_jsonb(v_toy),
      'audit_log_id', v_existing_audit.id,
      'replayed', TRUE
    );
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('toy-metadata:' || p_content_id::TEXT, 0)
  );

  SELECT metadata.*
  INTO v_toy
  FROM public.toy_metadata AS metadata
  WHERE metadata.media_id = p_content_id
  FOR UPDATE;

  IF FOUND THEN
    IF p_expected_updated_at IS NULL OR v_toy.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'Toy metadata changed since it was loaded; reload before saving'
        USING ERRCODE = '55000';
    END IF;

    v_before := to_jsonb(v_toy);
    UPDATE public.toy_metadata AS metadata
    SET name = btrim(p_payload ->> 'name'),
        manufacturer = NULLIF(btrim(p_payload ->> 'manufacturer'), ''),
        product_line = NULLIF(btrim(p_payload ->> 'product_line'), ''),
        release_year = CASE
          WHEN jsonb_typeof(p_payload -> 'release_year') = 'number'
            THEN (p_payload ->> 'release_year')::INTEGER
          ELSE NULL
        END,
        cover_url = NULLIF(btrim(p_payload ->> 'cover_url'), ''),
        description = NULLIF(btrim(p_payload ->> 'description'), ''),
        updated_by = p_actor_id,
        updated_at = clock_timestamp()
    WHERE metadata.media_id = p_content_id
    RETURNING metadata.* INTO v_toy;
  ELSE
    IF p_expected_updated_at IS NOT NULL THEN
      RAISE EXCEPTION 'Toy metadata changed since it was loaded; reload before saving'
        USING ERRCODE = '55000';
    END IF;

    INSERT INTO public.toy_metadata (
      media_id, name, manufacturer, product_line, release_year,
      cover_url, description, created_by, updated_by
    ) VALUES (
      p_content_id,
      btrim(p_payload ->> 'name'),
      NULLIF(btrim(p_payload ->> 'manufacturer'), ''),
      NULLIF(btrim(p_payload ->> 'product_line'), ''),
      CASE
        WHEN jsonb_typeof(p_payload -> 'release_year') = 'number'
          THEN (p_payload ->> 'release_year')::INTEGER
        ELSE NULL
      END,
      NULLIF(btrim(p_payload ->> 'cover_url'), ''),
      NULLIF(btrim(p_payload ->> 'description'), ''),
      p_actor_id,
      p_actor_id
    )
    RETURNING * INTO v_toy;
  END IF;

  v_audit_id := pg_catalog.gen_random_uuid();
  INSERT INTO public.audit_logs (
    id, user_id, entity_type, entity_id, action,
    previous_value, new_value, changed_fields,
    request_id, request_fingerprint, metadata
  ) VALUES (
    v_audit_id,
    p_actor_id,
    'toy_metadata',
    p_content_id::TEXT,
    CASE WHEN v_before IS NULL THEN 'create' ELSE 'update' END,
    v_before,
    to_jsonb(v_toy),
    ARRAY[]::TEXT[],
    p_request_id,
    v_fingerprint,
    jsonb_build_object(
      'source', 'controlled_save_toy_metadata',
      'transaction_id', pg_catalog.pg_current_xact_id()::TEXT
    )
  )
  RETURNING id INTO v_audit_id;

  RETURN jsonb_build_object(
    'record', to_jsonb(v_toy),
    'audit_log_id', v_audit_id,
    'replayed', FALSE
  );
END;
$function$
;

-- create_internal_dubbing_project_with_metadata: allocate the media row via private.create_internal_media
CREATE OR REPLACE FUNCTION public.create_internal_dubbing_project_with_metadata(p_actor_id uuid, p_request_id uuid, p_media_type text, p_language text, p_name text, p_brand text, p_manufacturer text, p_description text, p_product_line text, p_release_year integer, p_cover_url text)
 RETURNS TABLE(project_id bigint, content_id bigint, updated_at timestamp without time zone, metadata_updated_at timestamp with time zone, audit_log_id uuid, replayed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_role TEXT;
  v_project public.dubbing_projects%ROWTYPE;
  v_toy public.toy_metadata%ROWTYPE;
  v_existing_audit public.audit_logs%ROWTYPE;
  v_media_id BIGINT;
  v_fingerprint TEXT;
  v_audit_id UUID;
  v_metadata JSONB;
BEGIN
  SELECT users.raw_app_meta_data ->> 'role'
  INTO v_role
  FROM auth.users AS users
  WHERE users.id = p_actor_id;
  IF p_actor_id IS NULL OR v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only an administrator can create internal media'
      USING ERRCODE = '42501';
  END IF;

  IF p_request_id IS NULL OR p_media_type NOT IN ('advertisement', 'toy')
     OR p_language IS NULL OR NOT public.is_valid_dubbing_language(p_language)
     OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 300
     OR length(COALESCE(p_brand, '')) > 300
     OR length(COALESCE(p_manufacturer, '')) > 300
     OR length(COALESCE(p_description, '')) > 10000
     OR length(COALESCE(p_product_line, '')) > 300
     OR (p_release_year IS NOT NULL AND p_release_year NOT BETWEEN 1800 AND 2200)
     OR (p_cover_url IS NOT NULL AND (
       length(p_cover_url) > 2048
       OR p_cover_url !~* '^https?://[^/[:space:]?#@]+(/[^[:space:]#?]*)?(\?[^[:space:]#]*)?(#[^[:space:]]*)?$'
       OR p_cover_url ~* '[?&](access[_-]?token|refresh[_-]?token|id[_-]?token|token|api[_-]?key|apikey|client[_-]?secret|secret|password|passwd|authorization)='
     ))
     OR (p_media_type <> 'toy' AND (p_product_line IS NOT NULL OR p_release_year IS NOT NULL OR p_cover_url IS NOT NULL)) THEN
    RAISE EXCEPTION 'Internal media fields are invalid'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_id::TEXT || ':' || p_request_id::TEXT, 0)
  );
  v_metadata := jsonb_build_object(
    'name', p_name,
    'brand', p_brand,
    'manufacturer', p_manufacturer,
    'description', p_description
  );
  IF p_product_line IS NOT NULL THEN
    v_metadata := v_metadata || jsonb_build_object('product_line', p_product_line);
  END IF;
  IF p_release_year IS NOT NULL THEN
    v_metadata := v_metadata || jsonb_build_object('release_year', p_release_year);
  END IF;
  IF p_cover_url IS NOT NULL THEN
    v_metadata := v_metadata || jsonb_build_object('cover_url', p_cover_url);
  END IF;
  v_fingerprint := md5(jsonb_build_object(
    'media_type', p_media_type,
    'language', p_language,
    'metadata', v_metadata
  )::TEXT);

  SELECT audit.* INTO v_existing_audit
  FROM public.audit_logs AS audit
  WHERE audit.user_id = p_actor_id
    AND audit.request_id = p_request_id;
  IF FOUND THEN
    IF v_existing_audit.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'Request id was already used with different internal media data'
        USING ERRCODE = '23505';
    END IF;
    SELECT project.* INTO v_project
    FROM public.dubbing_projects AS project
    WHERE project.id = v_existing_audit.entity_id::BIGINT;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The project created by this request no longer exists'
        USING ERRCODE = '55000';
    END IF;
    IF p_media_type = 'toy' THEN
      SELECT metadata.* INTO v_toy
      FROM public.toy_metadata AS metadata
      WHERE metadata.media_id = v_project.media_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Toy metadata created by this request no longer exists'
          USING ERRCODE = '55000';
      END IF;
    END IF;
    RETURN QUERY SELECT v_project.id, v_project.media_id, v_project.updated_at, v_toy.updated_at, v_existing_audit.id, TRUE;
    RETURN;
  END IF;

  -- The media row gets its own identity; its id is the content id of toys and advertisements.
  v_media_id := private.create_internal_media(p_media_type);

  INSERT INTO public.dubbing_projects(media_id, language, status)
  VALUES (v_media_id, p_language, 'validated')
  RETURNING * INTO v_project;

  IF p_media_type = 'toy' THEN
    INSERT INTO public.toy_metadata (
      media_id, name, manufacturer, product_line, release_year,
      cover_url, description, created_by, updated_by
    ) VALUES (
      v_media_id,
      btrim(p_name),
      COALESCE(NULLIF(btrim(p_manufacturer), ''), NULLIF(btrim(p_brand), '')),
      NULLIF(btrim(p_product_line), ''),
      p_release_year,
      NULLIF(btrim(p_cover_url), ''),
      NULLIF(btrim(p_description), ''),
      p_actor_id,
      p_actor_id
    ) RETURNING * INTO v_toy;
  END IF;

  v_audit_id := pg_catalog.gen_random_uuid();
  INSERT INTO public.audit_logs (
    id, user_id, entity_type, entity_id, action,
    previous_value, new_value, changed_fields,
    request_id, request_fingerprint, metadata
  ) VALUES (
    v_audit_id, p_actor_id, 'dubbing_project', v_project.id::TEXT, 'create',
    jsonb_build_object(
      'project', NULL,
      'media_metadata', NULL,
      'crew', '[]'::JSONB,
      'cast', '[]'::JSONB
    ),
    jsonb_build_object(
      'project', to_jsonb(v_project),
      'media_metadata', v_metadata,
      'crew', '[]'::JSONB,
      'cast', '[]'::JSONB
    ),
    ARRAY[]::TEXT[], p_request_id, v_fingerprint,
    jsonb_build_object(
      'source', 'create_internal_dubbing_project',
      'media_type', p_media_type,
      'internal_media', v_metadata,
      'transaction_id', pg_catalog.pg_current_xact_id()::TEXT
    )
  );

  RETURN QUERY SELECT v_project.id, v_media_id, v_project.updated_at, v_toy.updated_at, v_audit_id, FALSE;
END;
$function$
;

-- page_media_catalog: join media directly (no private.* calls: SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.page_media_catalog(p_content_type text, p_page integer, p_page_size integer)
 RETURNS TABLE(content_ids bigint[], page integer, page_size integer, total_items bigint, total_pages integer)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  WITH newest_projects AS MATERIALIZED (
    SELECT DISTINCT ON (projects.media_id)
      media.content_id,
      projects.created_at,
      projects.id
    FROM public.dubbing_projects AS projects
    JOIN public.media AS media ON media.id = projects.media_id
    WHERE media.kind = p_content_type
    ORDER BY projects.media_id, projects.created_at DESC, projects.id DESC
  ),
  totals AS (
    SELECT count(*)::bigint AS total_items
    FROM newest_projects
  ),
  page_settings AS (
    SELECT
      LEAST(GREATEST(COALESCE(p_page_size, 12), 1), 48) AS page_size,
      GREATEST(COALESCE(p_page, 1), 1) AS requested_page,
      totals.total_items
    FROM totals
  ),
  page_info AS (
    SELECT
      page_settings.page_size,
      LEAST(
        page_settings.requested_page,
        GREATEST(
          1,
          ((page_settings.total_items + page_settings.page_size - 1)
            / page_settings.page_size)::integer
        )
      ) AS page,
      page_settings.total_items,
      GREATEST(
        1,
        ((page_settings.total_items + page_settings.page_size - 1)
          / page_settings.page_size)::integer
      ) AS total_pages
    FROM page_settings
  ),
  numbered_projects AS (
    SELECT
      projects.content_id,
      row_number() OVER (ORDER BY projects.created_at DESC, projects.id DESC) AS position
    FROM newest_projects AS projects
  )
  SELECT
    ARRAY(
      SELECT projects.content_id
      FROM numbered_projects AS projects
      WHERE projects.position > (page_info.page - 1)::bigint * page_info.page_size
        AND projects.position <= page_info.page::bigint * page_info.page_size
      ORDER BY projects.position
    ),
    page_info.page,
    page_info.page_size,
    page_info.total_items,
    page_info.total_pages
  FROM page_info;
$function$
;

-- find_duplicate_work_groups: project content reference via media (no private.* calls: SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.find_duplicate_work_groups(p_after_group_id bigint DEFAULT 0, p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  WITH duplicate_groups AS (
    SELECT
      w.dubbing_project_id,
      w.actor_id,
      w.voice_actor_id,
      public.work_assignment_role_identity_key(w.game_character_id, w.character_id, w.character_name) AS role_key,
      min(w.character_id) AS character_id,
      min(w.id) AS group_id,
      count(*) AS group_size
    FROM public.work AS w
    WHERE public.work_assignment_role_identity_key(w.game_character_id, w.character_id, w.character_name) IS NOT NULL
    GROUP BY w.dubbing_project_id, w.actor_id, w.voice_actor_id,
      public.work_assignment_role_identity_key(w.game_character_id, w.character_id, w.character_name)
    HAVING count(*) > 1
  ),
  page_groups AS (
    SELECT *
    FROM duplicate_groups
    WHERE group_id > GREATEST(COALESCE(p_after_group_id, 0), 0)
    ORDER BY group_id
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100) + 1
  ),
  page_items AS (
    SELECT
      g.*,
      jsonb_agg(
        to_jsonb(w) || jsonb_build_object(
          'voteCount', COALESCE(v.vote_count, 0),
          'upVotes', COALESCE(v.up_votes, 0),
          'downVotes', COALESCE(v.down_votes, 0),
          'sourceName', src.name,
          'voiceActor', CASE WHEN va.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', va.id, 'firstName', va.firstname, 'lastName', va.lastname
          ) END
        ) ORDER BY w.id
      ) AS works,
      jsonb_build_object(
        'id', dp.id,
        'contentId', media.content_id,
        'contentType', media.kind,
        'language', dp.language
      ) AS project
    FROM page_groups AS g
    JOIN public.work AS w
      ON w.dubbing_project_id IS NOT DISTINCT FROM g.dubbing_project_id
      AND w.actor_id IS NOT DISTINCT FROM g.actor_id
      AND w.voice_actor_id IS NOT DISTINCT FROM g.voice_actor_id
      AND public.work_assignment_role_identity_key(w.game_character_id, w.character_id, w.character_name) = g.role_key
    JOIN public.dubbing_projects AS dp ON dp.id = g.dubbing_project_id
    JOIN public.media AS media ON media.id = dp.media_id
    LEFT JOIN public.voice_actors AS va ON va.id = w.voice_actor_id
    LEFT JOIN public.source AS src ON src.id = w.source_id
    LEFT JOIN LATERAL (
      SELECT
        count(*) AS vote_count,
        count(*) FILTER (WHERE vote_type = 'up') AS up_votes,
        count(*) FILTER (WHERE vote_type = 'down') AS down_votes
      FROM public.votes
      WHERE work_id = w.id
    ) AS v ON true
    GROUP BY g.dubbing_project_id, g.actor_id, g.voice_actor_id, g.role_key,
      g.character_id, g.group_id, g.group_size, dp.id, media.id, media.kind, media.content_id, dp.language
    ORDER BY g.group_id
  ),
  limited AS (
    SELECT * FROM page_items ORDER BY group_id
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100)
  )
  SELECT jsonb_build_object(
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'groupId', group_id,
        'groupSize', group_size,
        'identity', jsonb_build_object(
          'dubbingProjectId', dubbing_project_id,
          'actorId', actor_id,
          'characterId', character_id,
          'voiceActorId', voice_actor_id,
          'roleKey', role_key
        ),
        'project', project,
        'works', works
      ) ORDER BY group_id)
      FROM limited
    ), '[]'::jsonb),
    'nextCursor', CASE
      WHEN (SELECT count(*) FROM page_items) > LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100)
      THEN (
        SELECT group_id FROM page_items
        ORDER BY group_id
        OFFSET GREATEST(LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100) - 1, 0) LIMIT 1
      )
      ELSE NULL
    END,
    'totalGroups', (SELECT count(*) FROM duplicate_groups)
  );
$function$
;

-- create_game_character: game_characters keyed by the video_game media_id
CREATE OR REPLACE FUNCTION public.create_game_character(p_actor_id uuid, p_request_id uuid, p_igdb_game_id bigint, p_name text)
 RETURNS TABLE(game_character_id uuid, audit_log_id uuid, replayed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_role TEXT;
  v_character public.game_characters%ROWTYPE;
  v_existing_audit public.audit_logs%ROWTYPE;
  v_fingerprint TEXT;
  v_audit_id UUID;
  v_media_id BIGINT;
BEGIN
  SELECT users.raw_app_meta_data ->> 'role'
  INTO v_role
  FROM auth.users AS users
  WHERE users.id = p_actor_id;

  IF p_actor_id IS NULL OR v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only an administrator can create a game character'
      USING ERRCODE = '42501';
  END IF;

  IF p_request_id IS NULL OR p_igdb_game_id IS NULL OR p_igdb_game_id <= 0
     OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 300 THEN
    RAISE EXCEPTION 'Game character fields are invalid'
      USING ERRCODE = '22023';
  END IF;

  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'igdb_game_id', p_igdb_game_id,
    'name', pg_catalog.btrim(p_name)
  )::TEXT);

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_id::TEXT || ':' || p_request_id::TEXT, 0)
  );

  SELECT audit.* INTO v_existing_audit
  FROM public.audit_logs AS audit
  WHERE audit.user_id = p_actor_id AND audit.request_id = p_request_id;
  IF FOUND THEN
    IF v_existing_audit.entity_type IS DISTINCT FROM 'game_character'
       OR v_existing_audit.action IS DISTINCT FROM 'create'
       OR v_existing_audit.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'Request id was already used for a different operation'
        USING ERRCODE = '23505';
    END IF;

    SELECT character.* INTO v_character
    FROM public.game_characters AS character
    WHERE character.id = v_existing_audit.entity_id::UUID;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The character created by this request no longer exists'
        USING ERRCODE = '55000';
    END IF;

    RETURN QUERY SELECT v_character.id, v_existing_audit.id, TRUE;
    RETURN;
  END IF;

  v_media_id := private.resolve_media('video_game', p_igdb_game_id);

  INSERT INTO public.game_characters (
    media_id, name, created_by, updated_by
  ) VALUES (
    v_media_id, pg_catalog.btrim(p_name), p_actor_id, p_actor_id
  ) RETURNING * INTO v_character;

  v_audit_id := pg_catalog.gen_random_uuid();
  INSERT INTO public.audit_logs (
    id, user_id, entity_type, entity_id, action,
    previous_value, new_value, changed_fields,
    request_id, request_fingerprint, metadata
  ) VALUES (
    v_audit_id, p_actor_id, 'game_character', v_character.id::TEXT, 'create',
    NULL, pg_catalog.to_jsonb(v_character),
    ARRAY['igdb_game_id', 'name']::TEXT[],
    p_request_id, v_fingerprint,
    pg_catalog.jsonb_build_object(
      'source', 'create_game_character',
      'provenance', 'dubbing_project_editor',
      'igdb_game_id', p_igdb_game_id,
      'transaction_id', pg_catalog.pg_current_xact_id()::TEXT
    )
  );

  RETURN QUERY SELECT v_character.id, v_audit_id, FALSE;
END;
$function$
;

-- update_game_character_references: report the IGDB game id through the media reference
CREATE OR REPLACE FUNCTION public.update_game_character_references(p_actor_id uuid, p_request_id uuid, p_game_character_id uuid, p_expected_updated_at timestamp with time zone, p_references jsonb)
 RETURNS TABLE(game_character_id uuid, updated_at timestamp with time zone, audit_log_id uuid, replayed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_character public.game_characters%ROWTYPE;
  v_existing_audit public.audit_logs%ROWTYPE;
  v_role TEXT;
  v_fingerprint TEXT;
  v_audit_id UUID;
  v_before JSONB;
  v_after JSONB;
BEGIN
  SELECT users.raw_app_meta_data ->> 'role'
  INTO v_role
  FROM auth.users AS users
  WHERE users.id = p_actor_id;
  IF p_actor_id IS NULL OR v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only an administrator can update game character references'
      USING ERRCODE = '42501';
  END IF;

  IF p_request_id IS NULL OR p_game_character_id IS NULL OR p_expected_updated_at IS NULL
     OR jsonb_typeof(p_references) IS DISTINCT FROM 'object'
     OR p_references = '{}'::JSONB
     OR EXISTS (
       SELECT 1 FROM jsonb_object_keys(p_references) AS field_name(name)
       WHERE field_name.name <> ALL (ARRAY['igdb_character_id', 'wikidata_qid']::TEXT[])
     )
     OR (p_references ? 'igdb_character_id' AND
       p_references -> 'igdb_character_id' <> 'null'::JSONB AND (
         jsonb_typeof(p_references -> 'igdb_character_id') IS DISTINCT FROM 'number'
         OR (p_references ->> 'igdb_character_id') !~ '^[1-9][0-9]{0,17}$'
       ))
     OR (p_references ? 'wikidata_qid' AND
       p_references -> 'wikidata_qid' <> 'null'::JSONB AND (
         jsonb_typeof(p_references -> 'wikidata_qid') IS DISTINCT FROM 'string'
         OR (p_references ->> 'wikidata_qid') !~ '^Q[1-9][0-9]*$'
       )) THEN
    RAISE EXCEPTION 'Game character references are invalid'
      USING ERRCODE = '22023';
  END IF;

  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'game_character_id', p_game_character_id,
    'expected_updated_at', p_expected_updated_at,
    'references', p_references
  )::TEXT);
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_id::TEXT || ':' || p_request_id::TEXT, 0)
  );

  SELECT audit.* INTO v_existing_audit
  FROM public.audit_logs AS audit
  WHERE audit.user_id = p_actor_id AND audit.request_id = p_request_id;
  IF FOUND THEN
    IF v_existing_audit.entity_type IS DISTINCT FROM 'game_character'
       OR v_existing_audit.entity_id IS DISTINCT FROM p_game_character_id::TEXT
       OR v_existing_audit.action IS DISTINCT FROM 'update'
       OR v_existing_audit.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'Request id was already used for a different operation'
        USING ERRCODE = '23505';
    END IF;

    SELECT character.* INTO v_character
    FROM public.game_characters AS character
    WHERE character.id = p_game_character_id;
    IF NOT FOUND OR to_jsonb(v_character) IS DISTINCT FROM v_existing_audit.new_value THEN
      RAISE EXCEPTION 'The character changed after this reference update; reload before retrying'
        USING ERRCODE = '55000';
    END IF;
    RETURN QUERY SELECT v_character.id, v_character.updated_at, v_existing_audit.id, TRUE;
    RETURN;
  END IF;

  SELECT character.* INTO v_character
  FROM public.game_characters AS character
  WHERE character.id = p_game_character_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game character does not exist' USING ERRCODE = '23503';
  END IF;
  IF v_character.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Game character references changed; reload before saving'
      USING ERRCODE = '55000';
  END IF;

  v_before := pg_catalog.to_jsonb(v_character);
  UPDATE public.game_characters AS character
  SET igdb_character_id = CASE WHEN p_references ? 'igdb_character_id'
        THEN CASE WHEN p_references -> 'igdb_character_id' = 'null'::JSONB
          THEN NULL ELSE (p_references ->> 'igdb_character_id')::BIGINT END
        ELSE character.igdb_character_id END,
      wikidata_qid = CASE WHEN p_references ? 'wikidata_qid'
        THEN p_references ->> 'wikidata_qid' ELSE character.wikidata_qid END,
      updated_by = p_actor_id,
      updated_at = pg_catalog.clock_timestamp()
  WHERE character.id = p_game_character_id
  RETURNING character.* INTO v_character;
  v_after := pg_catalog.to_jsonb(v_character);

  v_audit_id := pg_catalog.gen_random_uuid();
  INSERT INTO public.audit_logs (
    id, user_id, entity_type, entity_id, action,
    previous_value, new_value, changed_fields,
    request_id, request_fingerprint, metadata
  ) VALUES (
    v_audit_id, p_actor_id, 'game_character', v_character.id::TEXT, 'update',
    v_before, v_after, ARRAY(SELECT jsonb_object_keys(p_references))::TEXT[],
    p_request_id, v_fingerprint,
    pg_catalog.jsonb_build_object(
      'source', 'update_game_character_references',
      'provenance', 'manual_confirmation',
      'igdb_game_id', private.media_content_id(v_character.media_id),
      'transaction_id', pg_catalog.pg_current_xact_id()::TEXT
    )
  );

  RETURN QUERY SELECT v_character.id, v_character.updated_at, v_audit_id, FALSE;
END;
$function$
;

-- Enforce the new keys and drop the legacy columns (the function rewrites above no longer reference them).
alter table public.dubbing_projects
  alter column media_id set not null,
  add constraint dubbing_projects_media_id_fkey foreign key (media_id) references public.media (id) on delete restrict;
alter table public.dubbing_projects drop constraint dubbing_projects_media_region_key;
drop index if exists public.idx_dubbing_projects_type_content;
alter table public.dubbing_projects drop column content_id, drop column content_type;
alter table public.dubbing_projects
  add constraint dubbing_projects_media_language_key unique (media_id, language);

alter table public.toy_metadata
  alter column media_id set not null,
  add constraint toy_metadata_media_id_fkey foreign key (media_id) references public.media (id) on delete restrict;
alter table public.toy_metadata drop constraint toy_metadata_pkey;
alter table public.toy_metadata drop column content_id;
alter table public.toy_metadata add constraint toy_metadata_pkey primary key (media_id);

alter table public.game_characters
  alter column media_id set not null,
  add constraint game_characters_media_id_fkey foreign key (media_id) references public.media (id) on delete restrict;
drop index public.game_characters_game_name_idx;
drop index public.game_characters_igdb_reference_key;
drop index public.game_characters_wikidata_reference_key;
alter table public.game_characters drop column igdb_game_id;
create index game_characters_media_name_idx on public.game_characters (media_id, lower(name), id);
create unique index game_characters_igdb_reference_key
  on public.game_characters (media_id, igdb_character_id) where igdb_character_id is not null;
create unique index game_characters_wikidata_reference_key
  on public.game_characters (media_id, wikidata_qid) where wikidata_qid is not null;

-- Public read like the rest of the catalogue; writes only through the definer helpers and RPCs.
alter table public.media enable row level security;
revoke all on public.media from anon, authenticated;
grant select on public.media to anon, authenticated;
create policy "Allow public read access to media"
  on public.media for select using (true);

comment on table public.media is
  'DubbingBase-owned media identity. Rows are permanent. content_id is the id the website uses for the kind (a provider id, or media.id for toys and advertisements); wikidata_qid only enriches existing media.';

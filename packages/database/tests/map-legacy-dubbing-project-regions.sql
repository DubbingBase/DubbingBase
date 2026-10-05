-- Run with psql against a disposable database at the 20260926094824
-- checkpoint. The mapping migration commits its own transaction, so this
-- fixture leaves its test schema/data in place; reset the database afterward.
-- It verifies the intermediate queue compatibility boundary before applying
-- the final queue RPC replacement.
\set ON_ERROR_STOP on
SET statement_timeout = '60s';
TRUNCATE public.dubbing_language_reviews, public.dubbing_projects CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.dubbing_projects'::regclass
      AND tgname = 'dubbing_project_regional_language_guard'
      AND tgenabled = 'O'
  ) THEN
    RAISE EXCEPTION 'Regional language guard must be enabled before mapping';
  END IF;
END;
$$;

CREATE TEMP TABLE regional_guard_observations (
  old_language text NOT NULL,
  enabled_code text NOT NULL
);
CREATE FUNCTION public.test_observe_regional_guard_state() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  guard_state text;
BEGIN
  SELECT t.tgenabled::text INTO guard_state
  FROM pg_catalog.pg_trigger t
  WHERE t.tgrelid = 'public.dubbing_projects'::regclass
    AND t.tgname = 'dubbing_project_regional_language_guard';
  INSERT INTO pg_temp.regional_guard_observations(old_language, enabled_code)
  VALUES (OLD.language, COALESCE(guard_state, 'absent'));
  RETURN NEW;
END;
$$;
CREATE TRIGGER regional_guard_state_observer
BEFORE UPDATE OF language ON public.dubbing_projects
FOR EACH ROW EXECUTE FUNCTION public.test_observe_regional_guard_state();

INSERT INTO auth.users(id) VALUES
  ('00000000-0000-0000-0000-000000910001'),
  ('00000000-0000-0000-0000-000000910002');
INSERT INTO public.voice_actors(id, firstname, lastname) OVERRIDING SYSTEM VALUE VALUES
  (-910001, 'Regional', 'One'),
  (-910002, 'Regional', 'Two'),
  (-910003, 'Regional', 'Three');
INSERT INTO public.jobs(id, name) OVERRIDING SYSTEM VALUE
VALUES (-910001, 'Regional migration fixture');

-- en and simple map into en-US without a pre-existing regional project, so
-- the deterministic en survivor is regionalized and simple is merged into it.
-- For fr + fr-FR, the existing regional project must survive.
INSERT INTO public.dubbing_projects(id, content_id, content_type, language, status)
VALUES (-910005, 980202, 'movie', 'fr-FR', 'validated');

BEGIN;
ALTER TABLE public.dubbing_projects
  DISABLE TRIGGER dubbing_project_regional_language_guard;
INSERT INTO public.dubbing_projects(id, content_id, content_type, language, status)
VALUES
  (-910001, 980201, 'movie', 'en', 'validated'),
  (-910002, 980201, 'movie', 'simple', 'validated'),
  (-910004, 980202, 'movie', 'fr', 'validated'),
  (-910006, 980203, 'movie', 'pt', 'validated');
ALTER TABLE public.dubbing_projects
  ENABLE TRIGGER dubbing_project_regional_language_guard;
COMMIT;

INSERT INTO public.work(
  id, dubbing_project_id, actor_id, character_id, voice_actor_id,
  character_name, performance, status, reviewed_status
) VALUES
  (-910101, -910001, NULL, NULL, -910001, 'Target version', 'voice', 'validated', 'accepted'),
  (-910102, -910002, NULL, NULL, -910001, 'Simple English version', 'voice', 'validated', 'accepted'),
  (-910103, -910002, NULL, NULL, -910002, 'Simple English extra', 'voice', 'validated', 'accepted'),
  (-910106, -910005, NULL, NULL, -910002, 'French target version', 'voice', 'validated', 'accepted'),
  (-910107, -910004, NULL, NULL, -910002, 'Legacy French version', 'voice', 'validated', 'accepted');

INSERT INTO public.votes(id, work_id, user_id, vote_type) OVERRIDING SYSTEM VALUE VALUES
  (-910201, -910101, '00000000-0000-0000-0000-000000910001', 'up'),
  (-910202, -910102, '00000000-0000-0000-0000-000000910001', 'down'),
  (-910203, -910103, '00000000-0000-0000-0000-000000910002', 'up');

INSERT INTO public.dubbing_project_crew(id, dubbing_project_id, person_id, job_id)
  OVERRIDING SYSTEM VALUE VALUES
  (-910301, -910001, -910001, -910001),
  (-910302, -910002, -910001, -910001),
  (-910303, -910004, -910001, -910001);
INSERT INTO public.project_attachments(id, dubbing_project_id, file_path, file_name)
  OVERRIDING SYSTEM VALUE VALUES
  (-910401, -910001, 'regional-fixture/credits.pdf', 'credits.pdf'),
  (-910402, -910002, 'regional-fixture/credits.pdf', 'credits.pdf'),
  (-910403, -910004, 'regional-fixture/french.pdf', 'french.pdf');

INSERT INTO public.audit_logs(entity_type, entity_id, action, user_id) VALUES
  ('dubbing_projects', '-910002', 'source project', '00000000-0000-0000-0000-000000910001'),
  ('work', '-910102', 'source work', '00000000-0000-0000-0000-000000910001'),
  ('votes', '-910202', 'source vote', '00000000-0000-0000-0000-000000910001'),
  ('dubbing_project_crew', '-910302', 'source crew', '00000000-0000-0000-0000-000000910001'),
  ('project_attachments', '-910402', 'source attachment', '00000000-0000-0000-0000-000000910001'),
  ('dubbing_projects', '-910004', 'French source project', '00000000-0000-0000-0000-000000910001');

\ir ../supabase/migrations/20260926130158_map_legacy_dubbing_project_regions.sql

DO $$
DECLARE
  invalid_code text;
  old_queue_message_id bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_temp.regional_guard_observations) THEN
    RAISE EXCEPTION 'Mapping fixture did not exercise the language update observer';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_temp.regional_guard_observations
    WHERE enabled_code <> 'absent'
  ) THEN
    RAISE EXCEPTION 'Temporary regional-language guard was present during bulk mapping';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.dubbing_projects
    WHERE id IN (-910002, -910004)
  ) THEN
    RAISE EXCEPTION 'A merge source project was not removed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.dubbing_projects
    WHERE id = -910001 AND language = 'en-US'
  ) THEN
    RAISE EXCEPTION 'The deterministic en legacy survivor did not map to en-US';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.dubbing_projects
    WHERE id = -910005 AND language = 'fr-FR'
  ) THEN
    RAISE EXCEPTION 'The existing regional project did not survive the collision';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.dubbing_projects
    WHERE id = -910006 AND language = 'pt-BR'
  ) THEN
    RAISE EXCEPTION 'Legacy pt did not map to pt-BR';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.dubbing_projects
    WHERE language IN ('fr', 'en', 'pt', 'simple')
  ) THEN
    RAISE EXCEPTION 'Legacy project language remains unresolved';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.dubbing_projects p
    WHERE p.language IS NULL OR NOT public.is_valid_dubbing_language(p.language)
  ) THEN
    RAISE EXCEPTION 'A project language is not a supported regional language';
  END IF;
  IF to_regclass('public.dubbing_languages') IS NULL THEN
    RAISE EXCEPTION 'The temporary registry must remain until final queue RPCs are installed';
  END IF;
  IF to_regclass('pg_temp.legacy_dubbing_language_mapping') IS NOT NULL
    OR to_regclass('pg_temp.legacy_dubbing_project_collisions') IS NOT NULL THEN
    RAISE EXCEPTION 'Temporary migration mapping tables remain after mapping';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.dubbing_projects
    GROUP BY content_id, content_type, language HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate media+region projects remain';
  END IF;

  IF (SELECT count(*) FROM public.work WHERE dubbing_project_id = -910001) <> 2 THEN
    RAISE EXCEPTION 'Work union or conflict deduplication is incorrect';
  END IF;
  IF EXISTS (SELECT 1 FROM public.work WHERE id = -910102) THEN
    RAISE EXCEPTION 'Conflicting source work was not removed';
  END IF;
  IF (SELECT count(*) FROM public.votes WHERE work_id IN (-910101, -910103)) <> 2 THEN
    RAISE EXCEPTION 'Vote union or conflict deduplication is incorrect';
  END IF;
  IF EXISTS (SELECT 1 FROM public.votes WHERE id = -910202) THEN
    RAISE EXCEPTION 'Duplicate source votes were not removed';
  END IF;
  IF (SELECT count(*) FROM public.dubbing_project_crew WHERE dubbing_project_id = -910001) <> 2 THEN
    RAISE EXCEPTION 'Crew rows were lost or deduplicated unexpectedly';
  END IF;
  IF (SELECT count(*) FROM public.project_attachments WHERE dubbing_project_id = -910001) <> 2 THEN
    RAISE EXCEPTION 'Attachment rows were lost or deduplicated unexpectedly';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.audit_logs
    WHERE entity_type IN ('work', 'works', 'votes', 'dubbing_project', 'dubbing_projects')
      AND entity_id IN ('-910002', '-910004', '-910102', '-910202')
  ) THEN
    RAISE EXCEPTION 'Audit references to deleted rows were not reparented';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_logs
    WHERE entity_type = 'dubbing_project_crew' AND entity_id = '-910302'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.audit_logs
    WHERE entity_type = 'project_attachments' AND entity_id = '-910402'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.dubbing_project_crew
    WHERE id = -910302 AND dubbing_project_id = -910001
  ) OR NOT EXISTS (
    SELECT 1 FROM public.project_attachments
    WHERE id = -910402 AND dubbing_project_id = -910001
  ) THEN
    RAISE EXCEPTION 'Reparented crew/attachment rows lost their audit references';
  END IF;
  IF (SELECT count(*) FROM public.work WHERE dubbing_project_id = -910005) <> 1
    OR (SELECT count(*) FROM public.dubbing_project_crew WHERE dubbing_project_id = -910005) <> 1
    OR (SELECT count(*) FROM public.project_attachments WHERE dubbing_project_id = -910005) <> 1 THEN
    RAISE EXCEPTION 'Legacy-to-regional collision dependencies were not preserved';
  END IF;
  IF (SELECT count(*) FROM public.dubbing_language_reviews) <> 2 THEN
    RAISE EXCEPTION 'Source recovery snapshots are missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.dubbing_language_reviews
    WHERE source_snapshot->'project'->>'id' = '-910002'
      AND source_snapshot->'works' <> '[]'::jsonb
      AND source_snapshot->'votes' <> '[]'::jsonb
      AND source_snapshot->'crew' <> '[]'::jsonb
      AND source_snapshot->'attachments' <> '[]'::jsonb
      AND source_snapshot->'audit_logs' <> '[]'::jsonb
  ) THEN
    RAISE EXCEPTION 'Source recovery snapshot omitted a dependency';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.dubbing_language_reviews
    WHERE decision->>'survivor_original_language' = 'en'
      AND decision->'survivor_original_snapshot'->'project'->>'language' = 'en'
  ) THEN
    RAISE EXCEPTION 'Pre-rename survivor snapshot was not retained for the collision';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.dubbing_projects'::regclass
      AND conname = 'dubbing_projects_language_check'
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%is_valid_dubbing_language%'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.dubbing_projects'::regclass
      AND conname = 'dubbing_projects_media_region_key' AND contype = 'u'
  ) OR EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dubbing_projects'
      AND column_name = 'language' AND is_nullable = 'YES'
  ) OR EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.dubbing_projects'::regclass
      AND tgname = 'dubbing_project_regional_language_guard'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Final language constraints were not installed correctly';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.dubbing_projects'::regclass
      AND conname = 'dubbing_projects_language_fkey'
  ) THEN
    RAISE EXCEPTION 'The final schema still has a language foreign key';
  END IF;
  FOREACH invalid_code IN ARRAY ARRAY['fr', 'FR-fr', 'fr_fr', 'fr-FRA', 'fr-FR ', 'zz-ZZ'] LOOP
    BEGIN
      INSERT INTO public.dubbing_projects(content_id, content_type, language)
      VALUES (989999, 'movie', invalid_code);
      RAISE EXCEPTION 'Invalid regional shape % was accepted', invalid_code;
    EXCEPTION WHEN check_violation THEN NULL;
    END;
  END LOOP;
  INSERT INTO public.dubbing_projects(content_id, content_type, language)
  VALUES (989996, 'movie', 'fr-BE');
  INSERT INTO public.dubbing_projects(content_id, content_type, language)
  VALUES (989998, 'movie', 'ko-KR');

  IF to_regprocedure('public.is_valid_dubbing_language(text)') IS NULL
    OR to_regprocedure('public.guard_dubbing_project_language()') IS NOT NULL
    OR to_regprocedure('public.finalize_dubbing_language_constraints()') IS NOT NULL
    OR to_regprocedure('public.apply_reviewed_dubbing_languages(jsonb)') IS NOT NULL
    OR to_regprocedure('public.dubbing_language_review_snapshot(bigint)') IS NOT NULL THEN
    RAISE EXCEPTION 'Temporary dubbing-language migration helpers remain in the final schema';
  END IF;
  BEGIN
    INSERT INTO public.dubbing_projects(content_id, content_type, language)
    VALUES (989997, 'movie', 'FR-fR');
    RAISE EXCEPTION 'Invalid region casing was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  old_queue_message_id := public.enqueue_media_fetch(
    p_tmdb_id => 980204,
    p_media_type => 'movie',
    p_language => 'en',
    p_is_manual => true,
    p_wikipedia_language => 'en',
    p_dubbing_language => 'fr-FR'
  );
  IF NOT EXISTS (
    SELECT 1 FROM pgmq.q_wiki_check WHERE msg_id = old_queue_message_id
  ) THEN
    RAISE EXCEPTION 'The pre-28141305 enqueue RPC did not work after 30158';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.get_media_queue_items('wiki_check', 'active', 100, 0)
    WHERE id = old_queue_message_id
  ) THEN
    RAISE EXCEPTION 'The pre-28141305 queue read RPC did not work after 30158';
  END IF;
END;
$$;

\ir ../supabase/migrations/20260928141305_preserve_queue_requester_and_admin_read_security.sql

DO $$
BEGIN
  IF to_regclass('public.dubbing_languages') IS NOT NULL THEN
    RAISE EXCEPTION 'The registry remains after the final queue RPC migration';
  END IF;
  IF to_regprocedure('public.is_valid_dubbing_language(text)') IS NULL
    OR public.is_valid_dubbing_language('fr-BE') IS DISTINCT FROM true
    OR public.is_valid_dubbing_language('zz-ZZ') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'The final supported-language helper is missing or incorrect';
  END IF;

  BEGIN
    PERFORM public.enqueue_media_fetch(
      p_tmdb_id => 980206,
      p_media_type => 'movie',
      p_wikipedia_language => 'en',
      p_dubbing_language => 'zz-ZZ'
    );
    RAISE EXCEPTION 'The final fetch RPC accepted an unsupported dubbing language';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Invalid regional dubbing language' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.enqueue_media_extract(
      p_tmdb_id => 980207,
      p_media_type => 'movie',
      p_language => 'en',
      p_page_id => 980207,
      p_section_indexes => '[]'::jsonb,
      p_wikipedia_language => 'en',
      p_dubbing_language => 'zz-ZZ'
    );
    RAISE EXCEPTION 'The final extract RPC accepted an unsupported dubbing language';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'A regional dubbing language is required (for example fr-FR)' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.enqueue_media_fetch(
      p_tmdb_id => 980205,
      p_media_type => 'movie',
      p_language => 'simple',
      p_wikipedia_language => 'simple'
    );
    RAISE EXCEPTION 'The final queue RPC accepted Simple Wikipedia';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Invalid Wikipedia source language' THEN
      RAISE;
    END IF;
  END;
END;
$$;

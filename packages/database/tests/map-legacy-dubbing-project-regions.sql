-- Run with psql against an isolated database after applying the first two
-- regional-language migrations. This fixture applies the mapping migration
-- itself, verifies its merges and final constraints, and rolls everything back.
BEGIN;
SET LOCAL statement_timeout = '60s';
TRUNCATE public.dubbing_language_reviews, public.dubbing_projects CASCADE;

INSERT INTO auth.users(id) VALUES
  ('00000000-0000-0000-0000-000000910001'),
  ('00000000-0000-0000-0000-000000910002');
INSERT INTO public.voice_actors(id, firstname, lastname) OVERRIDING SYSTEM VALUE VALUES
  (-910001, 'Regional', 'One'),
  (-910002, 'Regional', 'Two'),
  (-910003, 'Regional', 'Three');
INSERT INTO public.jobs(id, name) OVERRIDING SYSTEM VALUE
VALUES (-910001, 'Regional migration fixture');

-- Existing regional projects survive merges. en and simple intentionally map
-- into the same existing en-US project for the same media item.
INSERT INTO public.dubbing_projects(id, content_id, content_type, language, status)
VALUES
  (-910001, 980201, 'movie', 'en-US', 'validated'),
  (-910005, 980202, 'movie', 'fr-FR', 'validated');

SET LOCAL session_replication_role = replica;
INSERT INTO public.dubbing_projects(id, content_id, content_type, language, status)
VALUES
  (-910002, 980201, 'movie', 'en', 'validated'),
  (-910003, 980201, 'movie', 'simple', 'validated'),
  (-910004, 980202, 'movie', 'fr', 'validated'),
  (-910006, 980203, 'movie', 'pt', 'validated'),
  (-910007, 980204, 'video_game', 'ko', 'validated');
SET LOCAL session_replication_role = origin;

INSERT INTO public.work(
  id, dubbing_project_id, actor_id, character_id, voice_actor_id,
  character_name, performance, status, reviewed_status
) VALUES
  (-910101, -910001, NULL, NULL, -910001, 'Target version', 'voice', 'validated', 'accepted'),
  (-910102, -910002, NULL, NULL, -910001, 'Legacy English version', 'voice', 'validated', 'accepted'),
  (-910103, -910002, NULL, NULL, -910002, 'English extra', 'voice', 'validated', 'accepted'),
  (-910104, -910003, NULL, NULL, -910001, 'Simple English version', 'voice', 'validated', 'accepted'),
  (-910105, -910003, NULL, NULL, -910003, 'Simple English extra', 'voice', 'validated', 'accepted'),
  (-910106, -910005, NULL, NULL, -910002, 'French target version', 'voice', 'validated', 'accepted'),
  (-910107, -910004, NULL, NULL, -910002, 'Legacy French version', 'voice', 'validated', 'accepted');

INSERT INTO public.votes(id, work_id, user_id, vote_type) OVERRIDING SYSTEM VALUE VALUES
  (-910201, -910101, '00000000-0000-0000-0000-000000910001', 'up'),
  (-910202, -910102, '00000000-0000-0000-0000-000000910001', 'down'),
  (-910203, -910103, '00000000-0000-0000-0000-000000910002', 'up'),
  (-910204, -910104, '00000000-0000-0000-0000-000000910001', 'down'),
  (-910205, -910105, '00000000-0000-0000-0000-000000910002', 'up');

INSERT INTO public.dubbing_project_crew(id, dubbing_project_id, person_id, job_id)
  OVERRIDING SYSTEM VALUE VALUES
  (-910301, -910001, -910001, -910001),
  (-910302, -910002, -910001, -910001),
  (-910303, -910003, -910001, -910001);
INSERT INTO public.project_attachments(id, dubbing_project_id, file_path, file_name)
  OVERRIDING SYSTEM VALUE VALUES
  (-910401, -910001, 'regional-fixture/credits.pdf', 'credits.pdf'),
  (-910402, -910002, 'regional-fixture/credits.pdf', 'credits.pdf'),
  (-910403, -910003, 'regional-fixture/credits.pdf', 'credits.pdf');

INSERT INTO public.audit_logs(entity_type, entity_id, action, user_id) VALUES
  ('dubbing_projects', '-910002', 'source project', '00000000-0000-0000-0000-000000910001'),
  ('dubbing_projects', '-910003', 'source project', '00000000-0000-0000-0000-000000910001'),
  ('work', '-910102', 'source work', '00000000-0000-0000-0000-000000910001'),
  ('work', '-910104', 'source work', '00000000-0000-0000-0000-000000910001'),
  ('votes', '-910202', 'source vote', '00000000-0000-0000-0000-000000910001'),
  ('votes', '-910204', 'source vote', '00000000-0000-0000-0000-000000910001'),
  ('dubbing_project_crew', '-910302', 'source crew', '00000000-0000-0000-0000-000000910001'),
  ('project_attachments', '-910402', 'source attachment', '00000000-0000-0000-0000-000000910001');

\ir ../supabase/migrations/20260926130158_map_legacy_dubbing_project_regions.sql

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.dubbing_projects
    WHERE id IN (-910002, -910003, -910004)
  ) THEN
    RAISE EXCEPTION 'A merge source project was not removed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.dubbing_projects
    WHERE id = -910001 AND language = 'en-US'
  ) THEN
    RAISE EXCEPTION 'The existing regional survivor did not survive';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.dubbing_projects
    WHERE id = -910007 AND language = 'ko-KR'
  ) THEN
    RAISE EXCEPTION 'Legacy ko did not map to registered ko-KR';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.dubbing_projects
    WHERE id = -910006 AND language = 'pt-BR'
  ) THEN
    RAISE EXCEPTION 'Legacy pt did not map to pt-BR';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.dubbing_projects
    WHERE language IN ('fr', 'en', 'pt', 'simple', 'ko')
  ) THEN
    RAISE EXCEPTION 'Legacy project language remains unresolved';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.dubbing_projects p
    WHERE NOT EXISTS (SELECT 1 FROM public.dubbing_languages l WHERE l.code = p.language)
  ) THEN
    RAISE EXCEPTION 'A project language is absent from the approved registry';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.dubbing_projects
    GROUP BY content_id, content_type, language HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate media+region projects remain';
  END IF;

  IF (SELECT count(*) FROM public.work WHERE dubbing_project_id = -910001) <> 3 THEN
    RAISE EXCEPTION 'Work union or conflict deduplication is incorrect';
  END IF;
  IF EXISTS (SELECT 1 FROM public.work WHERE id IN (-910102, -910104)) THEN
    RAISE EXCEPTION 'Conflicting source work was not removed';
  END IF;
  IF (SELECT count(*) FROM public.votes WHERE work_id IN (-910101, -910103, -910105)) <> 3 THEN
    RAISE EXCEPTION 'Vote union or conflict deduplication is incorrect';
  END IF;
  IF EXISTS (SELECT 1 FROM public.votes WHERE id IN (-910202, -910204)) THEN
    RAISE EXCEPTION 'Duplicate source votes were not removed';
  END IF;
  IF (SELECT count(*) FROM public.dubbing_project_crew WHERE dubbing_project_id = -910001) <> 3 THEN
    RAISE EXCEPTION 'Crew rows were lost or deduplicated unexpectedly';
  END IF;
  IF (SELECT count(*) FROM public.project_attachments WHERE dubbing_project_id = -910001) <> 3 THEN
    RAISE EXCEPTION 'Attachment rows were lost or deduplicated unexpectedly';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.audit_logs
    WHERE entity_type IN ('work', 'votes', 'dubbing_projects')
      AND entity_id IN ('-910002', '-910003', '-910102', '-910104', '-910202', '-910204')
  ) THEN
    RAISE EXCEPTION 'Audit references to deleted rows were not reparented';
  END IF;
  IF (SELECT count(*) FROM public.dubbing_language_reviews) <> 5 THEN
    RAISE EXCEPTION 'Source recovery snapshots are missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.dubbing_language_reviews
    WHERE source_snapshot->'project'->>'id' = '-910003'
      AND source_snapshot->'works' <> '[]'::jsonb
      AND source_snapshot->'votes' <> '[]'::jsonb
      AND source_snapshot->'crew' <> '[]'::jsonb
      AND source_snapshot->'attachments' <> '[]'::jsonb
      AND source_snapshot->'audit_logs' <> '[]'::jsonb
  ) THEN
    RAISE EXCEPTION 'Source recovery snapshot omitted a dependency';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.dubbing_projects'::regclass
      AND conname = 'dubbing_projects_language_fkey' AND contype = 'f'
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
END;
$$;

ROLLBACK;

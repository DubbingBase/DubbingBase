-- Run against an isolated database after
-- 20260926174116_atomic_regional_project_actor_assignments.sql and
-- 20260927171839_save_regional_project_actor_assignments.sql and
-- 20260928083958_harden_regional_assignment_concurrency_and_queue_metadata.sql.
-- The test exercises transaction rollback and leaves no fixture data behind.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout = '30s';

DO $$
DECLARE
  va_one bigint;
  va_two bigint;
  va_three bigint;
  va_four bigint;
  v_source_id bigint;
  actor_new bigint := 710100001;
  actor_rich bigint := 710100002;
  actor_ambiguous bigint := 710100003;
  actor_clear bigint := 710100004;
  actor_keep bigint := 710100005;
  actor_fr bigint := 710100006;
  actor_concurrent bigint := 710100007;
  project_id bigint;
  work_id bigint;
  rich_work_id bigint;
  ambiguous_work_one bigint;
  ambiguous_work_two bigint;
  clear_work_id bigint;
  keep_work_id bigint;
  france_work_id bigint;
  canada_work_id bigint;
  concurrent_work_id bigint;
  rollback_work_id bigint;
BEGIN
  INSERT INTO public.voice_actors(firstname, lastname)
  VALUES ('Regional RPC', 'One') RETURNING id INTO va_one;
  INSERT INTO public.voice_actors(firstname, lastname)
  VALUES ('Regional RPC', 'Two') RETURNING id INTO va_two;
  INSERT INTO public.voice_actors(firstname, lastname)
  VALUES ('Regional RPC', 'Three') RETURNING id INTO va_three;
  INSERT INTO public.voice_actors(firstname, lastname)
  VALUES ('Regional RPC', 'Four') RETURNING id INTO va_four;
  INSERT INTO public.source(name) VALUES ('Regional RPC fixture') RETURNING id INTO v_source_id;

  -- A new project and its first assignment are created atomically and validated.
  project_id := public.save_regional_project_actor_assignments(
    -980201,
    'movie',
    'fr-FR',
    jsonb_build_array(jsonb_build_object(
      'actor_id', actor_new,
      'work_id', NULL,
      'expected_voice_actor_id', NULL,
      'voice_actor_id', va_one
    ))
  );
  SELECT id INTO work_id FROM public.work
  WHERE dubbing_project_id = project_id AND actor_id = actor_new;
  IF work_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.dubbing_projects
    WHERE id = project_id AND status = 'validated'
  ) THEN
    RAISE EXCEPTION 'A valid first assignment did not create a validated project and work';
  END IF;

  -- An invalid voice actor on a new media selection must leave no project behind.
  BEGIN
    PERFORM public.save_regional_project_actor_assignments(
      -980202,
      'movie',
      'fr-FR',
      jsonb_build_array(jsonb_build_object(
        'actor_id', actor_new,
        'work_id', NULL,
        'expected_voice_actor_id', NULL,
        'voice_actor_id', -9223372036854770000
      ))
    );
    RAISE EXCEPTION 'An unknown voice actor was accepted';
  EXCEPTION WHEN SQLSTATE '22023' OR foreign_key_violation THEN
    NULL;
  END;
  IF EXISTS (
    SELECT 1 FROM public.dubbing_projects
    WHERE content_id = -980202 AND content_type = 'movie' AND language = 'fr-FR'
  ) THEN
    RAISE EXCEPTION 'A failed assignment left an empty project behind';
  END IF;

  -- Updating a rich existing work changes only voice_actor_id and preserves
  -- both the work identity and the existing project status.
  project_id := public.save_regional_project_actor_assignments(
    -980203,
    'tv',
    'fr-FR',
    jsonb_build_array(jsonb_build_object(
      'actor_id', actor_rich,
      'work_id', NULL,
      'expected_voice_actor_id', NULL,
      'voice_actor_id', va_one
    ))
  );
  UPDATE public.dubbing_projects SET status = 'in_progress' WHERE id = project_id;
  UPDATE public.work
  SET character_id = 80301,
      character_name = 'Rich character',
      source_id = v_source_id,
      note = 'Preserve this note',
      reviewed_status = 'accepted',
      suggestions = 'Existing suggestions',
      highlight = true,
      performance = 'singing',
      status = 'reviewed'
  WHERE dubbing_project_id = project_id AND actor_id = actor_rich
  RETURNING id INTO rich_work_id;

  PERFORM public.save_regional_project_actor_assignments(
    -980203,
    'tv',
    'fr-FR',
    jsonb_build_array(jsonb_build_object(
      'actor_id', actor_rich,
      'work_id', rich_work_id,
      'expected_voice_actor_id', va_one,
      'voice_actor_id', va_two
    ))
  );
  IF NOT EXISTS (
    SELECT 1
    FROM public.work AS work
    JOIN public.dubbing_projects AS project ON project.id = work.dubbing_project_id
    WHERE work.id = rich_work_id
      AND work.voice_actor_id = va_two
      AND work.character_id = 80301
      AND work.character_name = 'Rich character'
      AND work.source_id = v_source_id
      AND work.note = 'Preserve this note'
      AND work.reviewed_status = 'accepted'
      AND work.suggestions = 'Existing suggestions'
      AND work.highlight IS TRUE
      AND work.performance = 'singing'
      AND work.status = 'reviewed'
      AND project.status = 'in_progress'
  ) THEN
    RAISE EXCEPTION 'Voice actor update changed rich work metadata, identity, or project status';
  END IF;

  -- Multiple works for one actor are intentionally non-editable in this form.
  INSERT INTO public.dubbing_projects(content_id, content_type, language, status)
  VALUES (-980204, 'movie', 'fr-FR', 'validated') RETURNING id INTO project_id;
  INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id, character_id)
  VALUES (project_id, actor_ambiguous, va_one, 80401)
  RETURNING id INTO ambiguous_work_one;
  INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id, character_id)
  VALUES (project_id, actor_ambiguous, va_two, 80402)
  RETURNING id INTO ambiguous_work_two;
  BEGIN
    PERFORM public.save_regional_project_actor_assignments(
      -980204,
      'movie',
      'fr-FR',
      jsonb_build_array(jsonb_build_object(
        'actor_id', actor_ambiguous,
        'work_id', ambiguous_work_one,
        'expected_voice_actor_id', va_one,
        'voice_actor_id', va_three
      ))
    );
    RAISE EXCEPTION 'Ambiguous actor assignment was accepted';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    NULL;
  END;
  IF (SELECT count(*) FROM public.work
      WHERE id IN (ambiguous_work_one, ambiguous_work_two)
        AND voice_actor_id IN (va_one, va_two)) <> 2 THEN
    RAISE EXCEPTION 'Ambiguity rejection modified one of the actor works';
  END IF;

  -- Clearing one assignment deletes its exact work ID and leaves other actors alone.
  INSERT INTO public.dubbing_projects(content_id, content_type, language, status)
  VALUES (-980205, 'movie', 'fr-FR', 'validated') RETURNING id INTO project_id;
  INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id)
  VALUES (project_id, actor_clear, va_one) RETURNING id INTO clear_work_id;
  INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id)
  VALUES (project_id, actor_keep, va_two) RETURNING id INTO keep_work_id;
  PERFORM public.save_regional_project_actor_assignments(
    -980205,
    'movie',
    'fr-FR',
    jsonb_build_array(jsonb_build_object(
      'actor_id', actor_clear,
      'work_id', clear_work_id,
      'expected_voice_actor_id', va_one,
      'voice_actor_id', NULL
    ))
  );
  IF EXISTS (SELECT 1 FROM public.work WHERE id = clear_work_id)
    OR NOT EXISTS (
      SELECT 1 FROM public.work
      WHERE id = keep_work_id AND actor_id = actor_keep AND voice_actor_id = va_two
    ) THEN
    RAISE EXCEPTION 'Clearing one exact work removed or changed another assignment';
  END IF;

  -- A stale ID on a new project fails the whole transaction, including creation.
  BEGIN
    PERFORM public.save_regional_project_actor_assignments(
      -980206,
      'movie',
      'fr-CA',
      jsonb_build_array(jsonb_build_object(
        'actor_id', actor_new,
        'work_id', 999999999999,
        'expected_voice_actor_id', va_one,
        'voice_actor_id', va_three
      ))
    );
    RAISE EXCEPTION 'A stale work ID was accepted';
  EXCEPTION WHEN SQLSTATE '40001' THEN
    NULL;
  END;
  IF EXISTS (
    SELECT 1 FROM public.dubbing_projects
    WHERE content_id = -980206 AND content_type = 'movie' AND language = 'fr-CA'
  ) THEN
    RAISE EXCEPTION 'A stale work ID left a newly created project behind';
  END IF;

  -- France and Canada projects for one title keep exact work IDs and assignments isolated.
  INSERT INTO public.dubbing_projects(content_id, content_type, language, status)
  VALUES (-980207, 'movie', 'fr-FR', 'validated') RETURNING id INTO project_id;
  INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id)
  VALUES (project_id, actor_fr, va_one) RETURNING id INTO france_work_id;
  INSERT INTO public.dubbing_projects(content_id, content_type, language, status)
  VALUES (-980207, 'movie', 'fr-CA', 'validated') RETURNING id INTO project_id;
  INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id)
  VALUES (project_id, actor_fr, va_four) RETURNING id INTO canada_work_id;

  PERFORM public.save_regional_project_actor_assignments(
    -980207,
    'movie',
    'fr-FR',
    jsonb_build_array(jsonb_build_object(
      'actor_id', actor_fr,
      'work_id', france_work_id,
      'expected_voice_actor_id', va_one,
      'voice_actor_id', va_three
    ))
  );
  IF NOT EXISTS (
    SELECT 1 FROM public.work WHERE id = france_work_id AND voice_actor_id = va_three
  ) OR NOT EXISTS (
    SELECT 1 FROM public.work WHERE id = canada_work_id AND voice_actor_id = va_four
  ) THEN
    RAISE EXCEPTION 'Saving the France region changed the Canada work or lost the France work identity';
  END IF;

  -- The voice actor loaded by an admin is a compare-and-set guard against
  -- overwriting another admin's newer assignment.
  project_id := public.save_regional_project_actor_assignments(
    -980208,
    'movie',
    'fr-FR',
    jsonb_build_array(jsonb_build_object(
      'actor_id', actor_concurrent,
      'work_id', NULL,
      'expected_voice_actor_id', NULL,
      'voice_actor_id', va_one
    ))
  );
  UPDATE public.dubbing_projects SET status = 'in_progress' WHERE id = project_id;
  UPDATE public.work
  SET character_id = 80801,
      character_name = 'Concurrency character',
      note = 'Preserve after conflict'
  WHERE dubbing_project_id = project_id AND actor_id = actor_concurrent
  RETURNING id INTO concurrent_work_id;
  INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id)
  VALUES (project_id, actor_keep, va_one)
  RETURNING id INTO rollback_work_id;

  -- Simulate a second admin saving after the first admin loaded VA One.
  UPDATE public.work SET voice_actor_id = va_two WHERE id = concurrent_work_id;
  BEGIN
    PERFORM public.save_regional_project_actor_assignments(
      -980208,
      'movie',
      'fr-FR',
      jsonb_build_array(
        jsonb_build_object(
          'actor_id', actor_keep,
          'work_id', rollback_work_id,
          'expected_voice_actor_id', va_one,
          'voice_actor_id', va_four
        ),
        jsonb_build_object(
          'actor_id', actor_concurrent,
          'work_id', concurrent_work_id,
          'expected_voice_actor_id', va_one,
          'voice_actor_id', va_three
        )
      )
    );
    RAISE EXCEPTION 'A stale voice-cast edit overwrote a concurrent assignment';
  EXCEPTION WHEN SQLSTATE '40001' THEN
    NULL;
  END;
  IF NOT EXISTS (
    SELECT 1
    FROM public.work AS work
    JOIN public.dubbing_projects AS project ON project.id = work.dubbing_project_id
    WHERE work.id = concurrent_work_id
      AND work.voice_actor_id = va_two
      AND work.character_id = 80801
      AND work.character_name = 'Concurrency character'
      AND work.note = 'Preserve after conflict'
      AND project.content_id = -980208
      AND project.language = 'fr-FR'
      AND project.status = 'in_progress'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.work
    WHERE id = rollback_work_id AND voice_actor_id = va_one
  ) THEN
    RAISE EXCEPTION 'A stale voice-cast conflict changed work rows or the project';
  END IF;
END;
$$;

ROLLBACK;

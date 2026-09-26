-- Run against an isolated database after all regional-language migrations,
-- including 20260926174116_atomic_regional_project_actor_assignments.sql.
-- The fixture and its successful or rejected replacements are rolled back.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout = '30s';

DO $$
DECLARE
  v_project_id bigint;
  v_actor_id bigint;
  v_voice_actor_id bigint;
  v_original_work_id bigint;
BEGIN
  INSERT INTO public.voice_actors(firstname, lastname)
  VALUES ('Regional assignment', 'Fixture')
  RETURNING id INTO v_voice_actor_id;
  v_actor_id := v_voice_actor_id;

  INSERT INTO public.dubbing_projects(content_id, content_type, language)
  VALUES (-980108, 'movie', 'fr-FR')
  RETURNING id INTO v_project_id;
  INSERT INTO public.work(
    dubbing_project_id,
    actor_id,
    voice_actor_id,
    performance,
    status
  ) VALUES (v_project_id, v_actor_id, v_voice_actor_id, 'voice', 'validated')
  RETURNING id INTO v_original_work_id;

  BEGIN
    PERFORM public.replace_regional_project_actor_assignments(
      v_project_id,
      ARRAY[v_actor_id]::bigint[],
      jsonb_build_array(jsonb_build_object(
        'actor_id', v_actor_id,
        'voice_actor_id', -9223372036854775807
      ))
    );
    RAISE EXCEPTION 'Invalid voice actor assignment was accepted';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  IF NOT EXISTS (
    SELECT 1 FROM public.work
    WHERE id = v_original_work_id
      AND dubbing_project_id = v_project_id
      AND actor_id = v_actor_id
      AND voice_actor_id = v_voice_actor_id
  ) THEN
    RAISE EXCEPTION 'Failed replacement deleted the existing assignment';
  END IF;

  PERFORM public.replace_regional_project_actor_assignments(
    v_project_id,
    ARRAY[v_actor_id]::bigint[],
    jsonb_build_array(jsonb_build_object(
      'actor_id', v_actor_id,
      'voice_actor_id', v_voice_actor_id
    ))
  );
  IF EXISTS (SELECT 1 FROM public.work WHERE id = v_original_work_id) OR NOT EXISTS (
    SELECT 1 FROM public.work
    WHERE dubbing_project_id = v_project_id
      AND actor_id = v_actor_id
      AND voice_actor_id = v_voice_actor_id
  ) THEN
    RAISE EXCEPTION 'Successful replacement did not replace the selected actor assignment';
  END IF;

  PERFORM public.replace_regional_project_actor_assignments(
    v_project_id,
    ARRAY[v_actor_id]::bigint[],
    '[]'::jsonb
  );
  IF EXISTS (
    SELECT 1 FROM public.work
    WHERE dubbing_project_id = v_project_id AND actor_id = v_actor_id
  ) THEN
    RAISE EXCEPTION 'Empty assignments did not clear the selected actor';
  END IF;
END;
$$;

ROLLBACK;

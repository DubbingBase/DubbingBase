BEGIN;

DO $$
DECLARE
  v_actor_id bigint;
  v_first jsonb;
  v_replay jsonb;
  v_work_id bigint;
BEGIN
  v_actor_id := 999999998;

  v_first := public.apply_extracted_credits(
    991234567, 'movie', 'fr-FR',
    jsonb_build_array(jsonb_build_object(
      'firstname', 'Bulk', 'lastname', 'Fixture', 'actor_id', v_actor_id,
      'performance', 'voice', 'character_id', NULL, 'character_name', NULL
    ))
  );
  IF v_first->>'new_voice_actors' <> '1' OR v_first->>'credits_added' <> '1' THEN
    RAISE EXCEPTION 'Unexpected first persistence result: %', v_first;
  END IF;

  SELECT work.id INTO STRICT v_work_id
  FROM public.work AS work
  JOIN public.dubbing_projects AS project ON project.id = work.dubbing_project_id
  JOIN public.voice_actors AS voice_actor ON voice_actor.id = work.voice_actor_id
  WHERE project.content_id = 991234567
    AND project.content_type = 'movie'
    AND project.language = 'fr-FR'
    AND voice_actor.firstname = 'Bulk'
    AND voice_actor.lastname = 'Fixture';

  v_replay := public.apply_extracted_credits(
    991234567, 'movie', 'fr-FR',
    jsonb_build_array(jsonb_build_object(
      'firstname', 'Bulk', 'lastname', 'Fixture', 'actor_id', v_actor_id,
      'performance', 'updated suggestion', 'character_id', NULL, 'character_name', NULL
    ))
  );
  IF v_replay->>'new_voice_actors' <> '0' OR v_replay->>'credits_added' <> '1' THEN
    RAISE EXCEPTION 'Unexpected replay result: %', v_replay;
  END IF;
  IF (SELECT count(*) FROM public.work WHERE id = v_work_id) <> 1
    OR (SELECT performance FROM public.work WHERE id = v_work_id) <> 'updated suggestion' THEN
    RAISE EXCEPTION 'Suggestion replay was not idempotent';
  END IF;

  v_replay := public.apply_extracted_credits(
    991234567, 'movie', 'fr-FR',
    jsonb_build_array(jsonb_build_object(
      'firstname', 'bulk', 'lastname', 'fixture', 'actor_id', v_actor_id,
      'performance', 'case-insensitive replay', 'character_id', NULL, 'character_name', NULL
    ))
  );
  IF v_replay->>'new_voice_actors' <> '0'
    OR (SELECT count(*) FROM public.voice_actors WHERE lower(firstname) = 'bulk' AND lower(lastname) = 'fixture') <> 1
    OR (SELECT count(*) FROM public.work WHERE id = v_work_id) <> 1 THEN
    RAISE EXCEPTION 'Case-insensitive voice actor resolution created a duplicate';
  END IF;

  UPDATE public.work SET status = 'validated', performance = 'human edit'
  WHERE id = v_work_id;
  PERFORM public.apply_extracted_credits(
    991234567, 'movie', 'fr-FR',
    jsonb_build_array(jsonb_build_object(
      'firstname', 'Bulk', 'lastname', 'Fixture', 'actor_id', v_actor_id,
      'performance', 'must not overwrite', 'character_id', NULL, 'character_name', NULL
    ))
  );
  IF (SELECT status FROM public.work WHERE id = v_work_id) <> 'validated'
    OR (SELECT performance FROM public.work WHERE id = v_work_id) <> 'human edit' THEN
    RAISE EXCEPTION 'Human-reviewed work was overwritten';
  END IF;

  IF has_function_privilege('anon',
      'public.apply_extracted_credits(bigint,text,text,jsonb)', 'EXECUTE')
    OR has_function_privilege('authenticated',
      'public.apply_extracted_credits(bigint,text,text,jsonb)', 'EXECUTE')
    OR NOT has_function_privilege('service_role',
      'public.apply_extracted_credits(bigint,text,text,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Bulk persistence RPC permissions are not service-role only';
  END IF;
END;
$$;

ROLLBACK;

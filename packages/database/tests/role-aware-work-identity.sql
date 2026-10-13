-- Run against an isolated local database after all main and role-aware migrations.
-- Fixtures and schema-level trigger toggles are rolled back at the end.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout = '30s';
DO $$
DECLARE
  project_id bigint;
  alice_id bigint;
  alice_duplicate_id bigint;
  bob_id bigint;
  blank_id bigint;
  null_id bigint;
  identity_character_id bigint;
  admin_id uuid := gen_random_uuid();
  voter_id uuid := gen_random_uuid();
  scan_result jsonb;
  merge_result jsonb;
  vote_row record;
BEGIN
  IF public.work_role_identity_key(NULL, ' Alice ') <> 'name:alice'
    OR public.work_role_identity_key(NULL, 'alice') <> 'name:alice'
    OR public.work_role_identity_key(NULL, 'Bob') <> 'name:bob'
    OR public.work_role_identity_key(42, 'Alice') <> 'id:42'
    OR public.work_role_identity_key(NULL, '  ') IS NOT NULL
    OR public.work_role_identity_key(NULL, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'role key normalization failed';
  END IF;

  INSERT INTO public.dubbing_projects(content_id, content_type, language)
  VALUES (987654321, 'movie', 'fr-FR') RETURNING id INTO project_id;
  INSERT INTO auth.users(id) VALUES (admin_id), (voter_id);

  INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id, character_id, character_name)
  VALUES (project_id, NULL, NULL, NULL, 'Alice') RETURNING id INTO alice_id;
  INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id, character_id, character_name)
  VALUES (project_id, NULL, NULL, NULL, 'Bob') RETURNING id INTO bob_id;
  INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id, character_id, character_name)
  VALUES (project_id, NULL, NULL, 42, 'Alice') RETURNING id INTO identity_character_id;
  INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id, character_id, character_name)
  VALUES (project_id, NULL, NULL, NULL, '  ') RETURNING id INTO blank_id;
  INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id, character_id, character_name)
  VALUES (project_id, NULL, NULL, NULL, NULL) RETURNING id INTO null_id;

  BEGIN
    INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id, character_id, character_name)
    VALUES (project_id, NULL, NULL, NULL, ' alice ');
    RAISE EXCEPTION 'same normalized role was accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id, character_id, character_name)
  VALUES (project_id, NULL, NULL, NULL, '');
  INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id, character_id, character_name)
  VALUES (project_id, NULL, NULL, NULL, NULL);

  ALTER TABLE public.work DISABLE TRIGGER prevent_duplicate_work_assignment_trigger;
  INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id, character_id, character_name)
  VALUES (project_id, NULL, NULL, NULL, ' alice ') RETURNING id INTO alice_duplicate_id;
  ALTER TABLE public.work ENABLE TRIGGER prevent_duplicate_work_assignment_trigger;

  scan_result := public.find_duplicate_work_groups(0, 20);
  IF (scan_result->>'totalGroups')::integer <> 1
    OR scan_result->'items'->0->'identity'->>'roleKey' <> 'name:alice'
    OR (scan_result->'items'->0->>'groupSize')::integer <> 2 THEN
    RAISE EXCEPTION 'scan did not return only normalized Alice group: %', scan_result;
  END IF;

  INSERT INTO public.votes(user_id, work_id, vote_type, created_at)
  VALUES (voter_id, alice_id, 'up', '2026-01-01T00:00:00Z'),
    (voter_id, alice_duplicate_id, 'down', '2026-01-02T00:00:00Z');

  BEGIN
    PERFORM public.merge_work_duplicates_atomic(
      alice_id, ARRAY[alice_id, alice_duplicate_id],
      '{"performance":"dialogues","status":null,"reviewed_status":null,"note":null,"highlight":false,"source_id":null,"suggestions":null,"character_name":"Bob"}'::jsonb,
      admin_id
    );
    RAISE EXCEPTION 'merge changed free-text role identity';
  EXCEPTION WHEN invalid_parameter_value THEN
    NULL;
  END;

  merge_result := public.merge_work_duplicates_atomic(
    alice_id, ARRAY[alice_id, alice_duplicate_id],
    '{"performance":"dialogues","status":null,"reviewed_status":null,"note":null,"highlight":false,"source_id":null,"suggestions":null,"character_name":" alice "}'::jsonb,
    admin_id
  );
  IF (merge_result->>'preservedVotes')::integer <> 1
    OR (merge_result->>'collapsedVotes')::integer <> 1 THEN
    RAISE EXCEPTION 'merge vote counts are wrong: %', merge_result;
  END IF;
  SELECT * INTO vote_row FROM public.votes WHERE user_id = voter_id;
  IF vote_row.work_id <> alice_id OR vote_row.vote_type <> 'down'
    OR (SELECT count(*) FROM public.work WHERE id IN (alice_id, alice_duplicate_id)) <> 1
    OR (SELECT count(*) FROM public.audit_logs WHERE entity_id = alice_id::text AND action = 'merge_duplicate') <> 1 THEN
    RAISE EXCEPTION 'vote, data, or audit preservation failed';
  END IF;
  IF (SELECT work_role_identity_key(character_id, character_name) FROM public.work WHERE id = alice_id) <> 'name:alice'
    OR (SELECT character_id FROM public.work WHERE id = identity_character_id) <> 42
    OR (SELECT character_name FROM public.work WHERE id = bob_id) <> 'Bob'
    OR NOT EXISTS (SELECT 1 FROM public.work WHERE id = blank_id)
    OR NOT EXISTS (SELECT 1 FROM public.work WHERE id = null_id) THEN
    RAISE EXCEPTION 'distinct role or ambiguous row was lost';
  END IF;
END;
$$;
ROLLBACK;

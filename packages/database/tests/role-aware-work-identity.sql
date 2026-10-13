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
  tab_only_id bigint;
  newline_only_id bigint;
  null_id bigint;
  sigma_id bigint;
  dotted_i_id bigint;
  identity_character_id bigint;
  admin_id uuid := gen_random_uuid();
  voter_id uuid := gen_random_uuid();
  scan_result jsonb;
  merge_result jsonb;
  vote_row record;
BEGIN
  IF NOT has_function_privilege(
      'service_role',
      'public.find_work_role_identity_matches(bigint[], bigint, text)',
      'EXECUTE'
    )
    OR has_function_privilege(
      'anon',
      'public.find_work_role_identity_matches(bigint[], bigint, text)',
      'EXECUTE'
    )
    OR has_function_privilege(
      'authenticated',
      'public.find_work_role_identity_matches(bigint[], bigint, text)',
      'EXECUTE'
    ) THEN
    RAISE EXCEPTION 'work identity match RPC has unexpected execute grants';
  END IF;

  IF public.work_role_identity_key(NULL, ' Alice ') <> 'name:alice'
    OR public.work_role_identity_key(NULL, 'alice') <> 'name:alice'
    OR public.work_role_identity_key(NULL, 'Bob') <> 'name:bob'
    OR public.work_role_identity_key(42, 'Alice') <> 'id:42'
    OR public.work_role_identity_key(NULL, '  ') IS NOT NULL
    OR public.work_role_identity_key(NULL, E'\t\n\r\u00a0') IS NOT NULL
    OR public.work_role_identity_key(NULL, E'\t Alice \n') <> 'name:alice'
    OR public.work_role_identity_key(NULL, 'Élodie') <> 'name:élodie'
    OR public.work_role_identity_key(NULL, E' \u00a0éLODIE\t') <> 'name:élodie'
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
  VALUES (project_id, NULL, NULL, NULL, E'\t') RETURNING id INTO tab_only_id;
  INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id, character_id, character_name)
  VALUES (project_id, NULL, NULL, NULL, E'\n\r') RETURNING id INTO newline_only_id;
  INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id, character_id, character_name)
  VALUES (project_id, NULL, NULL, NULL, NULL) RETURNING id INTO null_id;
  INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id, character_id, character_name)
  VALUES (project_id, NULL, NULL, NULL, 'ΟΣ') RETURNING id INTO sigma_id;
  INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id, character_id, character_name)
  VALUES (project_id, NULL, NULL, NULL, 'İ') RETURNING id INTO dotted_i_id;

  IF public.find_work_role_identity_matches(
      ARRAY[alice_id, bob_id], NULL, E'\t ALICE \n'
    ) <> ARRAY[alice_id]
    OR public.find_work_role_identity_matches(
      ARRAY[identity_character_id], 42, 'Different name'
    ) <> ARRAY[identity_character_id]
    OR public.find_work_role_identity_matches(
      ARRAY[tab_only_id, newline_only_id], NULL, E'\t\n\r\u00a0'
    ) <> ARRAY[]::bigint[]
    OR (public.find_work_role_identity_matches(ARRAY[sigma_id], NULL, 'ος') = ARRAY[sigma_id])
      IS DISTINCT FROM (public.work_role_identity_key(NULL, 'ΟΣ') = public.work_role_identity_key(NULL, 'ος'))
    OR (public.find_work_role_identity_matches(ARRAY[dotted_i_id], NULL, E'i\u0307') = ARRAY[dotted_i_id])
      IS DISTINCT FROM (public.work_role_identity_key(NULL, 'İ') = public.work_role_identity_key(NULL, E'i\u0307')) THEN
    RAISE EXCEPTION 'database role matcher disagreed with the canonical role identity';
  END IF;

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
    OR NOT EXISTS (SELECT 1 FROM public.work WHERE id = tab_only_id)
    OR NOT EXISTS (SELECT 1 FROM public.work WHERE id = newline_only_id)
    OR NOT EXISTS (SELECT 1 FROM public.work WHERE id = null_id) THEN
    RAISE EXCEPTION 'distinct role or ambiguous row was lost';
  END IF;
END;
$$;

DO $$
DECLARE
  project_id bigint;
  keep_destination integer;
  source_destination integer;
  keep_two_sources integer;
  source_two_a integer;
  source_two_b integer;
  keep_three_sources integer;
  source_three_a integer;
  source_three_b integer;
  source_three_c integer;
  keep_error integer;
  source_error integer;
  keep_ambiguous integer;
  source_ambiguous_a integer;
  source_ambiguous_b integer;
  destination_work bigint;
  source_work bigint;
  source_two_work_a bigint;
  source_two_work_b bigint;
  source_three_work_a bigint;
  source_three_work_b bigint;
  source_three_work_c bigint;
  error_work bigint;
  ambiguous_work_a bigint;
  ambiguous_work_b bigint;
  voter_one uuid := gen_random_uuid();
  voter_two uuid := gen_random_uuid();
  merge_result jsonb;
BEGIN
  INSERT INTO public.dubbing_projects(content_id, content_type, language)
  VALUES (987654322, 'movie', 'fr-FR') RETURNING id INTO project_id;
  INSERT INTO auth.users(id) VALUES (voter_one), (voter_two);

  INSERT INTO public.voice_actors(firstname, lastname)
  VALUES ('MergeDestination', 'ExistingKeeper') RETURNING id INTO keep_destination;
  INSERT INTO public.voice_actors(firstname, lastname)
  VALUES ('MergeSource', 'ExistingKeeper') RETURNING id INTO source_destination;
  INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id, character_name)
  VALUES (project_id, NULL, keep_destination, 'Destination keeper') RETURNING id INTO destination_work;
  INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id, character_name)
  VALUES (project_id, NULL, source_destination, 'Destination keeper') RETURNING id INTO source_work;
  INSERT INTO public.votes(user_id, work_id, vote_type, created_at)
  VALUES
    (voter_one, destination_work, 'up', '2026-01-01T00:00:00Z'),
    (voter_one, source_work, 'down', '2026-01-02T00:00:00Z'),
    (voter_two, source_work, 'up', '2026-01-03T00:00:00Z');

  merge_result := public.merge_voice_actor_duplicates_atomic(
    keep_destination, ARRAY[source_destination], '{}'::jsonb
  );
  IF (SELECT count(*) FROM public.work
      WHERE dubbing_project_id = project_id AND character_name = 'Destination keeper'
        AND voice_actor_id = keep_destination) <> 1
    OR EXISTS (SELECT 1 FROM public.work WHERE id = source_work)
    OR (SELECT count(*) FROM public.votes WHERE work_id = destination_work) <> 2
    OR (SELECT vote_type FROM public.votes
        WHERE user_id = voter_one AND work_id = destination_work) <> 'down'
    OR (SELECT vote_type FROM public.votes
        WHERE user_id = voter_two AND work_id = destination_work) <> 'up' THEN
    RAISE EXCEPTION 'destination keeper collision did not preserve the newest votes: %', merge_result;
  END IF;

  INSERT INTO public.voice_actors(firstname, lastname)
  VALUES ('MergeDestination', 'TwoSources') RETURNING id INTO keep_two_sources;
  INSERT INTO public.voice_actors(firstname, lastname)
  VALUES ('MergeSourceA', 'TwoSources') RETURNING id INTO source_two_a;
  INSERT INTO public.voice_actors(firstname, lastname)
  VALUES ('MergeSourceB', 'TwoSources') RETURNING id INTO source_two_b;
  INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id, character_name)
  VALUES (project_id, NULL, source_two_a, 'Two source role') RETURNING id INTO source_two_work_a;
  INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id, character_name)
  VALUES (project_id, NULL, source_two_b, 'Two source role') RETURNING id INTO source_two_work_b;
  INSERT INTO public.votes(user_id, work_id, vote_type, created_at)
  VALUES
    (voter_one, source_two_work_a, 'up', '2026-02-01T00:00:00Z'),
    (voter_one, source_two_work_b, 'down', '2026-02-02T00:00:00Z'),
    (voter_two, source_two_work_b, 'up', '2026-02-03T00:00:00Z');

  merge_result := public.merge_voice_actor_duplicates_atomic(
    keep_two_sources, ARRAY[source_two_a, source_two_b], '{}'::jsonb
  );
  IF (SELECT count(*) FROM public.work
      WHERE dubbing_project_id = project_id AND character_name = 'Two source role'
        AND voice_actor_id = keep_two_sources) <> 1
    OR (SELECT count(*) FROM public.votes
        WHERE work_id = source_two_work_a) <> 2
    OR (SELECT vote_type FROM public.votes
        WHERE user_id = voter_one AND work_id = source_two_work_a) <> 'down'
    OR (SELECT vote_type FROM public.votes
        WHERE user_id = voter_two AND work_id = source_two_work_a) <> 'up'
    OR EXISTS (SELECT 1 FROM public.work WHERE id = source_two_work_b) THEN
    RAISE EXCEPTION 'two source-only collisions did not collapse with newest votes: %', merge_result;
  END IF;

  INSERT INTO public.voice_actors(firstname, lastname)
  VALUES ('MergeDestination', 'ThreeSources') RETURNING id INTO keep_three_sources;
  INSERT INTO public.voice_actors(firstname, lastname)
  VALUES ('MergeSourceA', 'ThreeSources') RETURNING id INTO source_three_a;
  INSERT INTO public.voice_actors(firstname, lastname)
  VALUES ('MergeSourceB', 'ThreeSources') RETURNING id INTO source_three_b;
  INSERT INTO public.voice_actors(firstname, lastname)
  VALUES ('MergeSourceC', 'ThreeSources') RETURNING id INTO source_three_c;
  INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id, character_name)
  VALUES (project_id, NULL, source_three_a, 'Three source role') RETURNING id INTO source_three_work_a;
  INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id, character_name)
  VALUES (project_id, NULL, source_three_b, 'Three source role') RETURNING id INTO source_three_work_b;
  INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id, character_name)
  VALUES (project_id, NULL, source_three_c, 'Three source role') RETURNING id INTO source_three_work_c;
  INSERT INTO public.votes(user_id, work_id, vote_type, created_at)
  VALUES
    (voter_one, source_three_work_a, 'up', '2026-03-01T00:00:00Z'),
    (voter_one, source_three_work_b, 'up', '2026-03-02T00:00:00Z'),
    (voter_one, source_three_work_c, 'down', '2026-03-03T00:00:00Z'),
    (voter_two, source_three_work_b, 'up', '2026-03-04T00:00:00Z');

  merge_result := public.merge_voice_actor_duplicates_atomic(
    keep_three_sources, ARRAY[source_three_a, source_three_b, source_three_c], '{}'::jsonb
  );
  IF (SELECT count(*) FROM public.work
      WHERE dubbing_project_id = project_id AND character_name = 'Three source role'
        AND voice_actor_id = keep_three_sources) <> 1
    OR (SELECT count(*) FROM public.votes
        WHERE work_id = source_three_work_a) <> 2
    OR (SELECT vote_type FROM public.votes
        WHERE user_id = voter_one AND work_id = source_three_work_a) <> 'down'
    OR (SELECT vote_type FROM public.votes
        WHERE user_id = voter_two AND work_id = source_three_work_a) <> 'up'
    OR EXISTS (SELECT 1 FROM public.work
        WHERE id IN (source_three_work_b, source_three_work_c)) THEN
    RAISE EXCEPTION 'three source-only collisions did not collapse with newest votes: %', merge_result;
  END IF;

  INSERT INTO public.voice_actors(firstname, lastname)
  VALUES ('MergeDestination', 'AmbiguousRoles') RETURNING id INTO keep_ambiguous;
  INSERT INTO public.voice_actors(firstname, lastname)
  VALUES ('MergeSourceA', 'AmbiguousRoles') RETURNING id INTO source_ambiguous_a;
  INSERT INTO public.voice_actors(firstname, lastname)
  VALUES ('MergeSourceB', 'AmbiguousRoles') RETURNING id INTO source_ambiguous_b;
  INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id, character_name)
  VALUES (project_id, NULL, source_ambiguous_a, E'\t') RETURNING id INTO ambiguous_work_a;
  INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id, character_name)
  VALUES (project_id, NULL, source_ambiguous_b, E'\n') RETURNING id INTO ambiguous_work_b;
  INSERT INTO public.votes(user_id, work_id, vote_type, created_at)
  VALUES
    (voter_one, ambiguous_work_a, 'up', '2026-03-05T00:00:00Z'),
    (voter_one, ambiguous_work_b, 'down', '2026-03-06T00:00:00Z');

  PERFORM public.merge_voice_actor_duplicates_atomic(
    keep_ambiguous, ARRAY[source_ambiguous_a, source_ambiguous_b], '{}'::jsonb
  );
  IF (SELECT count(*) FROM public.work
      WHERE id IN (ambiguous_work_a, ambiguous_work_b)
        AND voice_actor_id = keep_ambiguous
        AND public.work_role_identity_key(character_id, character_name) IS NULL) <> 2
    OR (SELECT count(*) FROM public.votes
        WHERE work_id IN (ambiguous_work_a, ambiguous_work_b)) <> 2
    OR (SELECT vote_type FROM public.votes
        WHERE user_id = voter_one AND work_id = ambiguous_work_a) <> 'up'
    OR (SELECT vote_type FROM public.votes
        WHERE user_id = voter_one AND work_id = ambiguous_work_b) <> 'down' THEN
    RAISE EXCEPTION 'voice actor merge collapsed or lost votes for ambiguous roles';
  END IF;

  INSERT INTO public.voice_actors(firstname, lastname)
  VALUES ('MergeDestination', 'Rollback') RETURNING id INTO keep_error;
  INSERT INTO public.voice_actors(firstname, lastname)
  VALUES ('MergeSource', 'Rollback') RETURNING id INTO source_error;
  INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id, character_name)
  VALUES (project_id, NULL, source_error, 'Rollback role') RETURNING id INTO error_work;
  INSERT INTO public.votes(user_id, work_id, vote_type, created_at)
  VALUES (voter_one, error_work, 'up', '2026-04-01T00:00:00Z');

  BEGIN
    PERFORM public.merge_voice_actor_duplicates_atomic(
      keep_error, ARRAY[source_error], '{"date_of_birth":"not-a-date"}'::jsonb
    );
    RAISE EXCEPTION 'invalid final voice actor data was accepted';
  EXCEPTION WHEN invalid_datetime_format THEN
    NULL;
  END;

  IF NOT EXISTS (SELECT 1 FROM public.voice_actors WHERE id = keep_error)
    OR NOT EXISTS (SELECT 1 FROM public.voice_actors WHERE id = source_error)
    OR NOT EXISTS (SELECT 1 FROM public.work
        WHERE id = error_work AND voice_actor_id = source_error)
    OR NOT EXISTS (SELECT 1 FROM public.votes
        WHERE user_id = voter_one AND work_id = error_work AND vote_type = 'up') THEN
    RAISE EXCEPTION 'failed voice actor merge left partial work or vote changes';
  END IF;
END;
$$;
ROLLBACK;

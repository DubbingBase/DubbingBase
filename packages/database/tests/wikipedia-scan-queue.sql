-- Run after migration 20261026195011_allow_enqueue_for_empty_projects.sql.
\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
  v_discovery_id bigint;
  v_scan_id bigint;
  v_extract_id bigint;
  v_message jsonb;
  v_ready text[];
  v_blocked boolean := false;
  v_empty_project_id bigint;
  v_populated_project_id bigint;
  v_empty_scan_id bigint;
  v_empty_extract_id bigint;
  v_populated_scan_id bigint;
  v_populated_extract_id bigint;
BEGIN
  IF to_regprocedure('public.enqueue_media_fetch(bigint,text,integer,integer,text,boolean,text,text,uuid)') IS NOT NULL
    OR to_regprocedure('public.enqueue_media_extract(bigint,text,text,bigint,jsonb,integer,integer,boolean,text,text,uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'Legacy queue enqueue overloads were retained';
  END IF;

  IF has_function_privilege('anon','public.get_ready_media_queues()','EXECUTE')
    OR has_function_privilege('authenticated','public.get_ready_media_queues()','EXECUTE')
    OR NOT has_function_privilege('service_role','public.get_ready_media_queues()','EXECUTE') THEN
    RAISE EXCEPTION 'Readiness permission is not service-role only';
  END IF;
  IF has_function_privilege('anon','public.archive_wiki_scan_with_outcome(bigint,text,text,jsonb,jsonb)','EXECUTE')
    OR has_function_privilege('authenticated','public.archive_wiki_scan_with_outcome(bigint,text,text,jsonb,jsonb)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.archive_wiki_scan_with_outcome(bigint,text,text,jsonb,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'Scan outcome archiving is not service-role only';
  END IF;

  v_discovery_id := public.enqueue_media_fetch(-980501,'movie');
  IF NOT EXISTS(SELECT 1 FROM pgmq.q_wiki_scan WHERE msg_id=v_discovery_id AND message->>'wikipedia_language' IS NULL) THEN
    RAISE EXCEPTION 'All-language discovery did not enter wiki_scan';
  END IF;

  v_scan_id := public.enqueue_media_fetch(
    p_tmdb_id=>-980502,p_media_type=>'movie',p_wikipedia_language=>'fr',p_requested_by=>'11111111-1111-4111-8111-111111111111',
    p_wiki_id=>'Q980502',p_title=>'Fixture title',p_page_title=>'Fixture page',p_poster_path=>'/fixture.jpg'
  );
  SELECT message INTO v_message FROM pgmq.q_wiki_scan WHERE msg_id=v_scan_id;
  IF v_message->>'wiki_id'<>'Q980502' OR v_message->>'page_title'<>'Fixture page'
    OR v_message->>'requested_by'<>'11111111-1111-4111-8111-111111111111' THEN
    RAISE EXCEPTION 'Resolved scan metadata or requester was not propagated';
  END IF;

  BEGIN
    PERFORM public.enqueue_media_fetch(-980502,'movie',p_wikipedia_language=>'fr',p_wiki_id=>'Q980502',p_title=>'Fixture title',p_page_title=>'Fixture page');
  EXCEPTION WHEN others THEN
    v_blocked := SQLERRM LIKE '%already in the wiki_scan queue%';
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Concurrent identity duplicate was not rejected'; END IF;

  v_extract_id := public.enqueue_media_extract(
    p_tmdb_id=>-980503,p_media_type=>'movie',p_language=>'fr',p_page_id=>1234,p_section_indexes=>'[2]'::jsonb,
    p_wikipedia_language=>'fr',p_dubbing_language=>'fr-FR',
    p_scan_metadata=>'{"title":"Pinned","wiki_id":"Q980503","page_title":"Pinned page","revision_id":123456,"section_headings":["Version française"],"poster_path":"/poster.jpg"}'::jsonb
  );
  SELECT message INTO v_message FROM pgmq.q_wiki_extract WHERE msg_id=v_extract_id;
  IF v_message->>'revision_id'<>'123456' OR v_message->'section_headings'<>'["Version française"]'::jsonb
    OR v_message->>'tmdb_id'<>'-980503' OR v_message->>'page_id'<>'1234' THEN
    RAISE EXCEPTION 'Extraction payload did not preserve scan revision or authoritative queue identity';
  END IF;

  v_blocked := false;
  BEGIN
    PERFORM public.enqueue_media_extract(
      p_tmdb_id=>-980504,p_media_type=>'movie',p_language=>'fr',p_page_id=>1234,p_section_indexes=>'[2]'::jsonb,
      p_wikipedia_language=>'fr',p_dubbing_language=>'fr-FR',p_scan_metadata=>'{"tmdb_id":7}'::jsonb
    );
  EXCEPTION WHEN others THEN
    v_blocked := SQLERRM LIKE '%unsupported fields%';
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Untrusted scan metadata overwrote protected extraction identity'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.dubbing_projects
    WHERE content_id IN (-980505, -980506) AND content_type = 'movie' AND language = 'fr-FR'
  ) THEN
    RAISE EXCEPTION 'Empty-project enqueue fixtures are already present';
  END IF;

  INSERT INTO public.dubbing_projects(content_id, content_type, language)
  VALUES (-980505, 'movie', 'fr-FR')
  RETURNING id INTO v_empty_project_id;

  v_empty_scan_id := public.enqueue_media_fetch(
    p_tmdb_id => -980505, p_media_type => 'movie',
    p_wikipedia_language => 'fr', p_dubbing_language => 'fr-FR'
  );
  v_empty_extract_id := public.enqueue_media_extract(
    p_tmdb_id => -980505, p_media_type => 'movie',
    p_language => 'fr', p_page_id => 12345, p_section_indexes => '[2]'::jsonb,
    p_wikipedia_language => 'fr', p_dubbing_language => 'fr-FR'
  );
  IF NOT EXISTS (SELECT 1 FROM pgmq.q_wiki_scan WHERE msg_id = v_empty_scan_id)
    OR NOT EXISTS (SELECT 1 FROM pgmq.q_wiki_extract WHERE msg_id = v_empty_extract_id)
    OR EXISTS (SELECT 1 FROM public.work WHERE dubbing_project_id = v_empty_project_id) THEN
    RAISE EXCEPTION 'An empty regional project did not allow both enqueue stages';
  END IF;

  INSERT INTO public.dubbing_projects(content_id, content_type, language)
  VALUES (-980506, 'movie', 'fr-FR')
  RETURNING id INTO v_populated_project_id;
  INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id, character_id, character_name)
  VALUES (v_populated_project_id, NULL, NULL, NULL, 'Existing fixture credit');

  v_populated_scan_id := public.enqueue_media_fetch(
    p_tmdb_id => -980506, p_media_type => 'movie',
    p_wikipedia_language => 'fr', p_dubbing_language => 'fr-FR'
  );
  v_populated_extract_id := public.enqueue_media_extract(
    p_tmdb_id => -980506, p_media_type => 'movie',
    p_language => 'fr', p_page_id => 12346, p_section_indexes => '[2]'::jsonb,
    p_wikipedia_language => 'fr', p_dubbing_language => 'fr-FR'
  );
  IF NOT EXISTS (SELECT 1 FROM pgmq.q_wiki_scan WHERE msg_id = v_populated_scan_id)
    OR NOT EXISTS (SELECT 1 FROM pgmq.q_wiki_extract WHERE msg_id = v_populated_extract_id)
    OR (SELECT count(*) FROM public.work WHERE dubbing_project_id = v_populated_project_id) <> 1
    OR NOT EXISTS (
      SELECT 1 FROM public.work
      WHERE dubbing_project_id = v_populated_project_id
        AND character_name = 'Existing fixture credit'
    ) THEN
    RAISE EXCEPTION 'A populated project did not allow enqueue while preserving its existing work';
  END IF;

  UPDATE pgmq.q_wiki_scan SET vt=clock_timestamp()-interval '1 second';
  UPDATE pgmq.q_wiki_extract SET vt=clock_timestamp()-interval '1 second';
  v_ready := public.get_ready_media_queues();
  IF NOT ('wiki_scan'=ANY(v_ready)) OR NOT ('wiki_extract'=ANY(v_ready))
    OR 'wiki_check'=ANY(v_ready) OR 'wiki_discovery'=ANY(v_ready) THEN
    RAISE EXCEPTION 'Readiness returned an incorrect active queue set: %',v_ready;
  END IF;

  IF NOT public.archive_wiki_scan_with_outcome(v_scan_id,'no_candidate_sections','fixture','[]'::jsonb,'[]'::jsonb) THEN
    RAISE EXCEPTION 'Could not archive wiki_scan terminal outcome';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pgmq.a_wiki_scan WHERE msg_id=v_scan_id AND message->>'archive_reason'='no_candidate_sections') THEN
    RAISE EXCEPTION 'Scan outcome was not retained in the scan archive';
  END IF;
END;
$$;

ROLLBACK;

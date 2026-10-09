-- Discovery and heading checks share one active queue. Historical queue tables
-- remain available for admin history and the immutable legacy reprocessor.
SELECT pgmq.create('wiki_scan');
ALTER TABLE pgmq.q_wiki_scan ADD COLUMN IF NOT EXISTS headers jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE pgmq.a_wiki_scan ADD COLUMN IF NOT EXISTS headers jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.lock_media_queue_identity(
  p_queue text, p_tmdb_id bigint, p_media_type text, p_wikipedia_language text,
  p_dubbing_language text, p_season_number integer, p_episode_number integer
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_queue NOT IN ('wiki_scan', 'wiki_extract') THEN
    RAISE EXCEPTION 'Invalid media queue identity: %', p_queue;
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.jsonb_build_array(
      p_queue, p_tmdb_id, p_media_type,
      CASE WHEN p_queue = 'wiki_scan' AND p_wikipedia_language IS NOT NULL THEN p_wikipedia_language END,
      CASE WHEN p_queue = 'wiki_extract' THEN p_wikipedia_language END,
      p_dubbing_language, p_season_number, p_episode_number
    )::text, 0
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.lock_media_queue_identity(text, bigint, text, text, text, integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;

DROP FUNCTION public.enqueue_media_fetch(bigint, text, integer, integer, text, boolean, text, text, uuid);
CREATE FUNCTION public.enqueue_media_fetch(
  p_tmdb_id bigint,
  p_media_type text,
  p_season_number integer DEFAULT NULL,
  p_episode_number integer DEFAULT NULL,
  p_language text DEFAULT NULL,
  p_is_manual boolean DEFAULT false,
  p_wikipedia_language text DEFAULT NULL,
  p_dubbing_language text DEFAULT NULL,
  p_requested_by uuid DEFAULT NULL,
  p_wiki_id text DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_page_title text DEFAULT NULL,
  p_poster_path text DEFAULT NULL
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_payload jsonb;
  v_msg_id bigint;
  v_lang text := nullif(trim(COALESCE(p_wikipedia_language, p_language)), '');
BEGIN
  IF v_lang IS NOT NULL AND (v_lang !~ '^[a-z][a-z0-9-]*$' OR v_lang = 'simple') THEN
    RAISE EXCEPTION 'Invalid Wikipedia source language';
  END IF;
  IF p_dubbing_language IS NOT NULL AND NOT public.is_valid_dubbing_language(p_dubbing_language) THEN
    RAISE EXCEPTION 'Invalid regional dubbing language';
  END IF;
  PERFORM public.lock_media_queue_identity(
    'wiki_scan', p_tmdb_id, p_media_type, v_lang, p_dubbing_language,
    p_season_number, p_episode_number
  );
  IF p_dubbing_language IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.dubbing_projects dp
    WHERE dp.content_id = p_tmdb_id
      AND dp.content_type IN (p_media_type, CASE WHEN p_media_type IN ('season', 'episode') THEN 'tv' ELSE '' END)
      AND dp.language = p_dubbing_language
  ) THEN
    RAISE EXCEPTION 'Dubbing project already exists for % % [%]', p_media_type, p_tmdb_id, v_lang;
  END IF;

  v_payload := jsonb_strip_nulls(jsonb_build_object(
    'tmdb_id', p_tmdb_id, 'media_type', p_media_type,
    'season_number', p_season_number, 'episode_number', p_episode_number,
    'language', v_lang, 'wikipedia_language', v_lang,
    'dubbing_language', p_dubbing_language, 'is_manual', COALESCE(p_is_manual, false),
    'priority', CASE WHEN COALESCE(p_is_manual, false) THEN 'high' ELSE 'normal' END,
    'requested_by', p_requested_by, 'wiki_id', p_wiki_id, 'title', p_title,
    'page_title', p_page_title, 'poster_path', p_poster_path
  ));

  IF EXISTS (
    SELECT 1 FROM pgmq.q_wiki_scan q
    WHERE (q.message->>'tmdb_id')::bigint = p_tmdb_id
      AND q.message->>'media_type' = p_media_type
      AND COALESCE(q.message->>'wikipedia_language', q.message->>'language') IS NOT DISTINCT FROM v_lang
      AND q.message->>'dubbing_language' IS NOT DISTINCT FROM p_dubbing_language
      AND COALESCE((q.message->>'season_number')::integer, -1) = COALESCE(p_season_number, -1)
      AND COALESCE((q.message->>'episode_number')::integer, -1) = COALESCE(p_episode_number, -1)
  ) THEN
    RAISE EXCEPTION 'Item is already in the wiki_scan queue';
  END IF;

  SELECT pgmq.send('wiki_scan', v_payload, 0) INTO v_msg_id;
  RETURN v_msg_id;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_media_fetch(bigint, text, integer, integer, text, boolean, text, text, uuid, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_media_fetch(bigint, text, integer, integer, text, boolean, text, text, uuid, text, text, text, text)
  TO service_role;

DROP FUNCTION public.enqueue_media_extract(bigint, text, text, bigint, jsonb, integer, integer, boolean, text, text, uuid);
CREATE FUNCTION public.enqueue_media_extract(
  p_tmdb_id bigint, p_media_type text, p_language text, p_page_id bigint,
  p_section_indexes jsonb, p_season_number integer DEFAULT NULL,
  p_episode_number integer DEFAULT NULL, p_is_manual boolean DEFAULT false,
  p_wikipedia_language text DEFAULT NULL, p_dubbing_language text DEFAULT NULL,
  p_requested_by uuid DEFAULT NULL, p_scan_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_payload jsonb;
  v_msg_id bigint;
  v_wikipedia_language text := nullif(trim(COALESCE(p_wikipedia_language, p_language)), '');
  v_metadata jsonb := COALESCE(p_scan_metadata, '{}'::jsonb);
BEGIN
  IF v_wikipedia_language IS NULL OR v_wikipedia_language !~ '^[a-z][a-z0-9-]*$' OR v_wikipedia_language = 'simple' THEN
    RAISE EXCEPTION 'Invalid Wikipedia source language';
  END IF;
  IF p_dubbing_language IS NULL OR NOT public.is_valid_dubbing_language(p_dubbing_language) THEN
    RAISE EXCEPTION 'A regional dubbing language is required (for example fr-FR)';
  END IF;
  IF jsonb_typeof(v_metadata) <> 'object' THEN RAISE EXCEPTION 'Scan metadata must be a JSON object'; END IF;
  IF jsonb_typeof(p_section_indexes) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Section indexes must be a JSON array'; END IF;
  IF jsonb_array_length(p_section_indexes)=0 THEN RAISE EXCEPTION 'Section indexes must not be empty'; END IF;
  IF v_metadata - ARRAY['title','wiki_id','page_title','revision_id','section_headings','poster_path']::text[] <> '{}'::jsonb THEN
    RAISE EXCEPTION 'Scan metadata contains unsupported fields';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_each(v_metadata) AS item(key,value) WHERE item.key<>'revision_id' AND jsonb_typeof(item.value)<>'string'
      AND item.key<>'section_headings') OR (v_metadata ? 'section_headings' AND jsonb_typeof(v_metadata->'section_headings')<>'array') THEN
    RAISE EXCEPTION 'Scan metadata fields have invalid types';
  END IF;
  IF v_metadata ? 'section_headings' AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_metadata->'section_headings') AS heading(value) WHERE jsonb_typeof(heading.value)<>'string'
  ) THEN RAISE EXCEPTION 'Section headings must contain strings'; END IF;
  IF v_metadata ? 'section_headings' AND jsonb_array_length(v_metadata->'section_headings')<>jsonb_array_length(p_section_indexes) THEN
    RAISE EXCEPTION 'Section headings must match the selected section indexes';
  END IF;
  IF v_metadata ? 'revision_id' AND (v_metadata->>'revision_id') !~ '^[1-9][0-9]*$' THEN
    RAISE EXCEPTION 'Invalid Wikipedia revision ID';
  END IF;

  PERFORM public.lock_media_queue_identity('wiki_extract', p_tmdb_id, p_media_type,
    v_wikipedia_language, p_dubbing_language, p_season_number, p_episode_number);
  IF EXISTS (
    SELECT 1 FROM public.dubbing_projects dp WHERE dp.content_id = p_tmdb_id
      AND dp.content_type IN (p_media_type, CASE WHEN p_media_type IN ('season', 'episode') THEN 'tv' ELSE '' END)
      AND dp.language = p_dubbing_language
  ) THEN RAISE EXCEPTION 'Dubbing project already exists for % % [%]', p_media_type, p_tmdb_id, v_wikipedia_language; END IF;

  v_payload := jsonb_strip_nulls(jsonb_build_object(
    'tmdb_id', p_tmdb_id, 'media_type', p_media_type, 'language', v_wikipedia_language,
    'wikipedia_language', v_wikipedia_language, 'dubbing_language', p_dubbing_language,
    'page_id', p_page_id, 'section_indexes', p_section_indexes,
    'season_number', p_season_number, 'episode_number', p_episode_number,
    'is_manual', COALESCE(p_is_manual, false),
    'priority', CASE WHEN COALESCE(p_is_manual, false) THEN 'high' ELSE 'normal' END,
    'requested_by', p_requested_by
  )) || jsonb_strip_nulls(jsonb_build_object(
    'title',v_metadata->>'title','wiki_id',v_metadata->>'wiki_id','page_title',v_metadata->>'page_title',
    'revision_id',CASE WHEN v_metadata ? 'revision_id' THEN (v_metadata->>'revision_id')::bigint END,
    'section_headings',v_metadata->'section_headings','poster_path',v_metadata->>'poster_path'
  ));

  IF EXISTS (
    SELECT 1 FROM pgmq.q_wiki_extract q
    WHERE (q.message->>'tmdb_id')::bigint = p_tmdb_id AND q.message->>'media_type' = p_media_type
      AND COALESCE(q.message->>'wikipedia_language', q.message->>'language') = v_wikipedia_language
      AND q.message->>'dubbing_language' = p_dubbing_language
      AND COALESCE((q.message->>'season_number')::integer, -1) = COALESCE(p_season_number, -1)
      AND COALESCE((q.message->>'episode_number')::integer, -1) = COALESCE(p_episode_number, -1)
  ) THEN RAISE EXCEPTION 'Item is already in the extract queue'; END IF;

  SELECT pgmq.send('wiki_extract', v_payload, 0) INTO v_msg_id;
  RETURN v_msg_id;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_media_extract(bigint, text, text, bigint, jsonb, integer, integer, boolean, text, text, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_media_extract(bigint, text, text, bigint, jsonb, integer, integer, boolean, text, text, uuid, jsonb)
  TO service_role;

CREATE OR REPLACE FUNCTION public.pop_media_queue_batch(p_queue_name text, p_vt_seconds integer, p_batch_size integer)
RETURNS TABLE(msg_id bigint, read_ct integer, enqueued_at timestamptz, vt timestamptz, message jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pgmq AS $$
BEGIN
  IF p_queue_name NOT IN ('wiki_extract', 'wiki_scan', 'wiki_check', 'wiki_discovery') THEN RAISE EXCEPTION 'Invalid queue name: %', p_queue_name; END IF;
  IF p_batch_size IS NULL OR p_batch_size < 1 OR p_batch_size > 5 THEN RAISE EXCEPTION 'Invalid batch size'; END IF;
  IF p_vt_seconds IS NULL OR p_vt_seconds < 1 THEN RAISE EXCEPTION 'Visibility timeout must be greater than zero'; END IF;
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.enqueued_at, r.vt, r.message FROM pgmq.read(p_queue_name, p_vt_seconds, p_batch_size) AS r;
END;
$$;
REVOKE ALL ON FUNCTION public.pop_media_queue_batch(text, integer, integer) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.pop_media_queue_batch(text, integer, integer) TO service_role;

-- Copy queue state atomically. pgmq.send allocates safe destination IDs; the
-- following update preserves retry count, enqueue time, visibility, payload,
-- and headers before the source row is removed.
DO $$
DECLARE v_row record; v_new_id bigint;
BEGIN
  FOR v_row IN SELECT 'wiki_discovery'::text AS queue_name, q.* FROM pgmq.q_wiki_discovery q
    UNION ALL SELECT 'wiki_check'::text, q.* FROM pgmq.q_wiki_check q
  LOOP
    IF EXISTS (
      SELECT 1 FROM pgmq.q_wiki_scan q
      WHERE q.message->>'tmdb_id' IS NOT DISTINCT FROM v_row.message->>'tmdb_id'
        AND q.message->>'media_type' IS NOT DISTINCT FROM v_row.message->>'media_type'
        AND COALESCE(q.message->>'wikipedia_language', q.message->>'language') IS NOT DISTINCT FROM
          COALESCE(v_row.message->>'wikipedia_language', v_row.message->>'language')
        AND q.message->>'dubbing_language' IS NOT DISTINCT FROM v_row.message->>'dubbing_language'
        AND q.message->>'season_number' IS NOT DISTINCT FROM v_row.message->>'season_number'
        AND q.message->>'episode_number' IS NOT DISTINCT FROM v_row.message->>'episode_number'
    ) THEN RAISE EXCEPTION 'Duplicate active Wikipedia scan identity found while migrating queue'; END IF;

    SELECT pgmq.send('wiki_scan', v_row.message, 0) INTO v_new_id;
    UPDATE pgmq.q_wiki_scan SET read_ct = v_row.read_ct, enqueued_at = v_row.enqueued_at,
      vt = v_row.vt, message = v_row.message, headers = COALESCE(v_row.headers, '{}'::jsonb)
      WHERE msg_id = v_new_id;
    IF v_row.queue_name = 'wiki_discovery' THEN DELETE FROM pgmq.q_wiki_discovery WHERE msg_id = v_row.msg_id;
    ELSE DELETE FROM pgmq.q_wiki_check WHERE msg_id = v_row.msg_id; END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.delay_media_queue_message(p_queue_name text, p_msg_id bigint, p_delay_seconds int DEFAULT 3600)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pgmq AS $$
DECLARE v_vt timestamptz := clock_timestamp() + (COALESCE(p_delay_seconds, 3600) || ' seconds')::interval;
BEGIN
  IF p_queue_name NOT IN ('wiki_extract', 'wiki_scan', 'wiki_check', 'wiki_discovery') THEN RAISE EXCEPTION 'Invalid queue name: %', p_queue_name; END IF;
  IF p_queue_name = 'wiki_extract' THEN UPDATE pgmq.q_wiki_extract SET vt = v_vt WHERE msg_id = p_msg_id;
  ELSIF p_queue_name='wiki_scan' THEN UPDATE pgmq.q_wiki_scan SET vt = v_vt WHERE msg_id = p_msg_id;
  ELSIF p_queue_name='wiki_check' THEN UPDATE pgmq.q_wiki_check SET vt=v_vt WHERE msg_id=p_msg_id;
  ELSE UPDATE pgmq.q_wiki_discovery SET vt=v_vt WHERE msg_id=p_msg_id; END IF;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_media_queue_message(p_queue_name text, p_msg_id bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pgmq AS $$
DECLARE v_message jsonb; v_read_ct integer; v_enqueued_at timestamptz; v_vt timestamptz; v_headers jsonb; v_inserted integer;
BEGIN
  IF p_queue_name NOT IN ('wiki_extract', 'wiki_scan', 'wiki_check', 'wiki_discovery') THEN RAISE EXCEPTION 'Invalid queue name: %', p_queue_name; END IF;
  IF p_queue_name = 'wiki_extract' THEN
    SELECT read_ct,enqueued_at,vt,message,COALESCE(headers,'{}'::jsonb) INTO v_read_ct,v_enqueued_at,v_vt,v_message,v_headers FROM pgmq.q_wiki_extract WHERE msg_id=p_msg_id FOR UPDATE;
  ELSIF p_queue_name='wiki_scan' THEN
    SELECT read_ct,enqueued_at,vt,message,COALESCE(headers,'{}'::jsonb) INTO v_read_ct,v_enqueued_at,v_vt,v_message,v_headers FROM pgmq.q_wiki_scan WHERE msg_id=p_msg_id FOR UPDATE;
  ELSIF p_queue_name='wiki_check' THEN
    SELECT read_ct,enqueued_at,vt,message,COALESCE(headers,'{}'::jsonb) INTO v_read_ct,v_enqueued_at,v_vt,v_message,v_headers FROM pgmq.q_wiki_check WHERE msg_id=p_msg_id FOR UPDATE;
  ELSE
    SELECT read_ct,enqueued_at,vt,message,COALESCE(headers,'{}'::jsonb) INTO v_read_ct,v_enqueued_at,v_vt,v_message,v_headers FROM pgmq.q_wiki_discovery WHERE msg_id=p_msg_id FOR UPDATE;
  END IF;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF p_queue_name = 'wiki_extract' THEN
    INSERT INTO pgmq.a_wiki_extract(msg_id,read_ct,enqueued_at,vt,message,headers) VALUES(p_msg_id,v_read_ct,v_enqueued_at,v_vt,v_message,v_headers) ON CONFLICT(msg_id) DO NOTHING;
  ELSIF p_queue_name='wiki_scan' THEN
    INSERT INTO pgmq.a_wiki_scan(msg_id,read_ct,enqueued_at,vt,message,headers) VALUES(p_msg_id,v_read_ct,v_enqueued_at,v_vt,v_message,v_headers) ON CONFLICT(msg_id) DO NOTHING;
  ELSIF p_queue_name='wiki_check' THEN
    INSERT INTO pgmq.a_wiki_check(msg_id,read_ct,enqueued_at,vt,message,headers) VALUES(p_msg_id,v_read_ct,v_enqueued_at,v_vt,v_message,v_headers) ON CONFLICT(msg_id) DO NOTHING;
  ELSE
    INSERT INTO pgmq.a_wiki_discovery(msg_id,read_ct,enqueued_at,vt,message,headers) VALUES(p_msg_id,v_read_ct,v_enqueued_at,v_vt,v_message,v_headers) ON CONFLICT(msg_id) DO NOTHING;
  END IF;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN RETURN FALSE; END IF;
  IF p_queue_name = 'wiki_extract' THEN DELETE FROM pgmq.q_wiki_extract WHERE msg_id=p_msg_id;
  ELSIF p_queue_name='wiki_scan' THEN DELETE FROM pgmq.q_wiki_scan WHERE msg_id=p_msg_id;
  ELSIF p_queue_name='wiki_check' THEN DELETE FROM pgmq.q_wiki_check WHERE msg_id=p_msg_id;
  ELSE DELETE FROM pgmq.q_wiki_discovery WHERE msg_id=p_msg_id; END IF;
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.archive_media_queue_message(text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_media_queue_message(text, bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.archive_media_queue_message_with_error(p_queue_name text,p_msg_id bigint,p_error text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pgmq AS $$
DECLARE v_updated integer;
BEGIN
  IF p_queue_name NOT IN ('wiki_extract','wiki_scan','wiki_check','wiki_discovery') THEN RAISE EXCEPTION 'Invalid queue name: %',p_queue_name; END IF;
  IF p_queue_name='wiki_extract' THEN UPDATE pgmq.q_wiki_extract SET message=jsonb_set(message,'{error_message}',to_jsonb(p_error)) WHERE msg_id=p_msg_id;
  ELSIF p_queue_name='wiki_scan' THEN UPDATE pgmq.q_wiki_scan SET message=jsonb_set(message,'{error_message}',to_jsonb(p_error)) WHERE msg_id=p_msg_id;
  ELSIF p_queue_name='wiki_check' THEN UPDATE pgmq.q_wiki_check SET message=jsonb_set(message,'{error_message}',to_jsonb(p_error)) WHERE msg_id=p_msg_id;
  ELSE UPDATE pgmq.q_wiki_discovery SET message=jsonb_set(message,'{error_message}',to_jsonb(p_error)) WHERE msg_id=p_msg_id; END IF;
  GET DIAGNOSTICS v_updated=ROW_COUNT;
  IF v_updated=0 THEN RETURN FALSE; END IF;
  RETURN public.archive_media_queue_message(p_queue_name,p_msg_id);
END;
$$;
REVOKE ALL ON FUNCTION public.archive_media_queue_message_with_error(text,bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.archive_media_queue_message_with_error(text,bigint,text) TO service_role;

CREATE FUNCTION public.archive_wiki_scan_with_outcome(p_msg_id bigint,p_archive_reason text,p_archive_details text,p_detected_regions jsonb,p_candidate_sections jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pgmq AS $$
DECLARE v_updated integer;
BEGIN
  IF p_archive_reason NOT IN ('extraction_enqueued','adult_content_excluded','no_candidate_sections','no_dubbing_evidence','ambiguous_region','unsupported_region','target_conflict') THEN
    RAISE EXCEPTION 'Invalid wiki_scan archive reason: %',p_archive_reason;
  END IF;
  IF jsonb_typeof(p_detected_regions)<>'array' OR jsonb_typeof(p_candidate_sections)<>'array' THEN
    RAISE EXCEPTION 'Wiki scan outcome regions and candidates must be JSON arrays';
  END IF;
  UPDATE pgmq.q_wiki_scan SET message=message||jsonb_build_object('archive_reason',p_archive_reason,'archive_details',p_archive_details,
    'detected_regions',p_detected_regions,'candidate_sections',p_candidate_sections) WHERE msg_id=p_msg_id;
  GET DIAGNOSTICS v_updated=ROW_COUNT;
  IF v_updated=0 THEN RETURN FALSE; END IF;
  RETURN public.archive_media_queue_message('wiki_scan',p_msg_id);
END;
$$;
REVOKE ALL ON FUNCTION public.archive_wiki_scan_with_outcome(bigint,text,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.archive_wiki_scan_with_outcome(bigint,text,text,jsonb,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.get_ready_media_queues()
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT COALESCE(array_agg(queues.queue_name ORDER BY queues.ordinal),ARRAY[]::text[])
  FROM (VALUES (1,'wiki_scan'::text,EXISTS(SELECT 1 FROM pgmq.q_wiki_scan WHERE vt<=statement_timestamp())),
    (2,'wiki_extract'::text,EXISTS(SELECT 1 FROM pgmq.q_wiki_extract WHERE vt<=statement_timestamp()))) queues(ordinal,queue_name,ready)
  WHERE queues.ready;
$$;
REVOKE ALL ON FUNCTION public.get_ready_media_queues() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_ready_media_queues() TO service_role;

-- The reprocessor reads a_wiki_check exactly as before. Update only its active
-- identity lookup so future reprocesses dedupe against the consolidated queue.
CREATE OR REPLACE FUNCTION public.reprocess_legacy_wiki_check_reviews()
RETURNS TABLE(tmdb_id bigint,archived_msg_id bigint,outcome text,queued_msg_id bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_target_id bigint; v_archive record; v_language text; v_season_number integer; v_episode_number integer; v_queue_msg_id bigint; v_outcome text; v_count integer;
BEGIN
  FOREACH v_target_id IN ARRAY ARRAY[1492640,284558,977942,1248832]::bigint[] LOOP
    v_count:=0;
    FOR v_archive IN SELECT a.msg_id,a.message FROM pgmq.a_wiki_check a WHERE a.message->>'review_needed'='true'
      AND (a.message->>'tmdb_id')::bigint=v_target_id ORDER BY a.msg_id FOR UPDATE LOOP
      v_count:=v_count+1;
      SELECT r.outcome,r.queued_msg_id INTO v_outcome,v_queue_msg_id FROM public.legacy_wiki_check_reprocesses r WHERE r.archived_msg_id=v_archive.msg_id;
      IF FOUND THEN v_outcome:='already_reprocessed';
      ELSE
        IF NULLIF(v_archive.message->>'media_type','') IS NULL THEN RAISE EXCEPTION 'Legacy wiki_check archive item % has no media_type',v_archive.msg_id; END IF;
        v_language:=COALESCE(NULLIF(btrim(v_archive.message->>'wikipedia_language'),''),NULLIF(btrim(v_archive.message->>'language'),''),'en');
        v_season_number:=CASE WHEN v_archive.message->>'season_number'~'^-?[0-9]+$' THEN (v_archive.message->>'season_number')::integer ELSE NULL END;
        v_episode_number:=CASE WHEN v_archive.message->>'episode_number'~'^-?[0-9]+$' THEN (v_archive.message->>'episode_number')::integer ELSE NULL END;
        PERFORM public.lock_media_queue_identity('wiki_scan',v_target_id,v_archive.message->>'media_type',v_language,NULL,v_season_number,v_episode_number);
        SELECT q.msg_id INTO v_queue_msg_id FROM pgmq.q_wiki_scan q WHERE (q.message->>'tmdb_id')::bigint=v_target_id
          AND q.message->>'media_type'=v_archive.message->>'media_type'
          AND COALESCE(q.message->>'wikipedia_language',q.message->>'language')=v_language
          AND q.message->>'dubbing_language' IS NULL
          AND COALESCE((q.message->>'season_number')::integer,-1)=COALESCE(v_season_number,-1)
          AND COALESCE((q.message->>'episode_number')::integer,-1)=COALESCE(v_episode_number,-1) ORDER BY q.msg_id LIMIT 1;
        IF v_queue_msg_id IS NOT NULL THEN v_outcome:='already_enqueued';
        ELSE
          v_queue_msg_id:=public.enqueue_media_fetch(p_tmdb_id=>v_target_id,p_media_type=>v_archive.message->>'media_type',
            p_season_number=>v_season_number,p_episode_number=>v_episode_number,p_wikipedia_language=>v_language,p_is_manual=>false,
            p_requested_by=>CASE WHEN v_archive.message->>'requested_by'~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN (v_archive.message->>'requested_by')::uuid ELSE NULL END);
          v_outcome:='requeued';
        END IF;
        INSERT INTO public.legacy_wiki_check_reprocesses(archived_msg_id,tmdb_id,outcome,queued_msg_id) VALUES(v_archive.msg_id,v_target_id,v_outcome,v_queue_msg_id);
      END IF;
      tmdb_id:=v_target_id; archived_msg_id:=v_archive.msg_id; outcome:=v_outcome; queued_msg_id:=v_queue_msg_id; RETURN NEXT;
    END LOOP;
    IF v_count=0 THEN tmdb_id:=v_target_id; archived_msg_id:=NULL; outcome:='not_found'; queued_msg_id:=NULL; RETURN NEXT; END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.reprocess_legacy_wiki_check_reviews() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reprocess_legacy_wiki_check_reviews() TO service_role;


CREATE OR REPLACE FUNCTION public.archive_media_queue_messages(p_queue_name text,p_msg_ids bigint[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pgmq AS $$
DECLARE v_msg_id bigint; v_count integer:=0;
BEGIN
  IF p_queue_name NOT IN ('wiki_extract','wiki_scan','wiki_check','wiki_discovery') THEN RAISE EXCEPTION 'Invalid queue name: %',p_queue_name; END IF;
  IF COALESCE(cardinality(p_msg_ids),0)>5 THEN RAISE EXCEPTION 'Cannot archive more than 5 queue messages at once'; END IF;
  FOREACH v_msg_id IN ARRAY COALESCE(p_msg_ids,ARRAY[]::bigint[]) LOOP
    IF public.archive_media_queue_message(p_queue_name,v_msg_id) THEN v_count:=v_count+1; END IF;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.archive_media_queue_messages(text,bigint[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.archive_media_queue_messages(text,bigint[]) TO service_role;

ALTER FUNCTION public.get_media_queue_items(text,text,integer,integer) RENAME TO get_media_queue_items_without_scan;
CREATE FUNCTION public.get_media_queue_items(
  p_queue_name text DEFAULT NULL,p_status text DEFAULT NULL,p_limit integer DEFAULT 100,p_offset integer DEFAULT 0
) RETURNS TABLE(
  id bigint,queue_name text,tmdb_id bigint,media_type text,language text,wikipedia_language text,dubbing_language text,
  season_number integer,episode_number integer,status text,error_message text,created_at timestamptz,read_ct integer,
  is_manual boolean,requested_by uuid,archive_reason text,archive_details text,detected_regions jsonb,candidate_sections jsonb
) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pgmq AS $$
DECLARE v_old_limit bigint;
BEGIN
  IF p_queue_name='wiki_scan' THEN
    RETURN QUERY WITH scan_items(id,queue_name,tmdb_id,media_type,language,wikipedia_language,dubbing_language,
      season_number,episode_number,status,error_message,created_at,read_ct,is_manual,requested_by,archive_reason,
      archive_details,detected_regions,candidate_sections) AS (
    SELECT q.msg_id,'wiki_scan'::text,(q.message->>'tmdb_id')::bigint,q.message->>'media_type',
      COALESCE(q.message->>'wikipedia_language',q.message->>'language'),COALESCE(q.message->>'wikipedia_language',q.message->>'language'),
      q.message->>'dubbing_language',(q.message->>'season_number')::int,(q.message->>'episode_number')::int,
      CASE WHEN q.vt>now() THEN 'processing' ELSE 'pending' END,q.message->>'error_message',q.enqueued_at,q.read_ct,
      COALESCE((q.message->>'is_manual')::boolean,false),nullif(q.message->>'requested_by','')::uuid,NULL::text,NULL::text,NULL::jsonb,NULL::jsonb
    FROM pgmq.q_wiki_scan q
    WHERE (p_status IS NULL OR lower(trim(p_status)) IN ('','all','active','pending','processing'))
      AND (lower(trim(COALESCE(p_status,''))) NOT IN ('pending') OR q.vt<=now())
      AND (lower(trim(COALESCE(p_status,''))) NOT IN ('processing') OR q.vt>now())
    UNION ALL
    SELECT a.msg_id,'wiki_scan'::text,(a.message->>'tmdb_id')::bigint,a.message->>'media_type',
      COALESCE(a.message->>'wikipedia_language',a.message->>'language'),COALESCE(a.message->>'wikipedia_language',a.message->>'language'),
      a.message->>'dubbing_language',(a.message->>'season_number')::int,(a.message->>'episode_number')::int,
      CASE WHEN NULLIF(a.message->>'error_message','') IS NOT NULL THEN 'failed' ELSE 'completed' END,
      a.message->>'error_message',a.enqueued_at,a.read_ct,COALESCE((a.message->>'is_manual')::boolean,false),
      nullif(a.message->>'requested_by','')::uuid,a.message->>'archive_reason',a.message->>'archive_details',
      a.message->'detected_regions',a.message->'candidate_sections'
    FROM pgmq.a_wiki_scan a
    WHERE (p_status IS NULL OR lower(trim(p_status)) IN ('','all','archived','completed','failed','error'))
      AND (lower(trim(COALESCE(p_status,''))) NOT IN ('failed','error') OR NULLIF(a.message->>'error_message','') IS NOT NULL)
      AND (lower(trim(COALESCE(p_status,''))) NOT IN ('completed') OR NULLIF(a.message->>'error_message','') IS NULL)
    ) SELECT scan_items.* FROM scan_items
    ORDER BY CASE WHEN lower(trim(COALESCE(p_status,''))) IN ('archived','completed','error','failed') THEN 0
      WHEN scan_items.status='pending' AND scan_items.is_manual THEN 1 WHEN scan_items.status='processing' THEN 2
      WHEN scan_items.status='pending' THEN 3 ELSE 4 END, scan_items.created_at DESC
    LIMIT p_limit OFFSET p_offset;
    RETURN;
  END IF;
  IF p_queue_name IS NOT NULL THEN
    RETURN QUERY SELECT * FROM public.get_media_queue_items_without_scan(p_queue_name,p_status,p_limit,p_offset);
    RETURN;
  END IF;
  SELECT p_limit::bigint+p_offset::bigint+count(*) INTO v_old_limit FROM pgmq.q_wiki_scan;
  SELECT v_old_limit+count(*) INTO v_old_limit FROM pgmq.a_wiki_scan;
  RETURN QUERY
  WITH items AS (
    SELECT * FROM public.get_media_queue_items_without_scan(NULL,p_status,LEAST(v_old_limit,2147483647)::integer,0)
    UNION ALL
    SELECT q.msg_id,'wiki_scan'::text,(q.message->>'tmdb_id')::bigint,q.message->>'media_type',
      COALESCE(q.message->>'wikipedia_language',q.message->>'language'),COALESCE(q.message->>'wikipedia_language',q.message->>'language'),
      q.message->>'dubbing_language',(q.message->>'season_number')::int,(q.message->>'episode_number')::int,
      CASE WHEN q.vt>now() THEN 'processing' ELSE 'pending' END,q.message->>'error_message',q.enqueued_at,q.read_ct,
      COALESCE((q.message->>'is_manual')::boolean,false),nullif(q.message->>'requested_by','')::uuid,NULL::text,NULL::text,NULL::jsonb,NULL::jsonb
    FROM pgmq.q_wiki_scan q
    WHERE (p_status IS NULL OR lower(trim(p_status)) IN ('','all','active','pending','processing'))
      AND (lower(trim(COALESCE(p_status,''))) NOT IN ('pending') OR q.vt<=now())
      AND (lower(trim(COALESCE(p_status,''))) NOT IN ('processing') OR q.vt>now())
    UNION ALL
    SELECT a.msg_id,'wiki_scan'::text,(a.message->>'tmdb_id')::bigint,a.message->>'media_type',
      COALESCE(a.message->>'wikipedia_language',a.message->>'language'),COALESCE(a.message->>'wikipedia_language',a.message->>'language'),
      a.message->>'dubbing_language',(a.message->>'season_number')::int,(a.message->>'episode_number')::int,
      CASE WHEN NULLIF(a.message->>'error_message','') IS NOT NULL THEN 'failed' ELSE 'completed' END,
      a.message->>'error_message',a.enqueued_at,a.read_ct,COALESCE((a.message->>'is_manual')::boolean,false),
      nullif(a.message->>'requested_by','')::uuid,a.message->>'archive_reason',a.message->>'archive_details',
      a.message->'detected_regions',a.message->'candidate_sections'
    FROM pgmq.a_wiki_scan a
    WHERE (p_status IS NULL OR lower(trim(p_status)) IN ('','all','archived','completed','failed','error'))
      AND (lower(trim(COALESCE(p_status,''))) NOT IN ('failed','error') OR NULLIF(a.message->>'error_message','') IS NOT NULL)
      AND (lower(trim(COALESCE(p_status,''))) NOT IN ('completed') OR NULLIF(a.message->>'error_message','') IS NULL)
  )
  SELECT i.* FROM items i
  WHERE p_queue_name IS NULL OR i.queue_name=p_queue_name
  ORDER BY CASE WHEN lower(trim(COALESCE(p_status,''))) IN ('archived','completed','error','failed') THEN 0
    WHEN i.status='pending' AND i.is_manual THEN 1 WHEN i.status='processing' THEN 2 WHEN i.status='pending' THEN 3 ELSE 4 END,
    i.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;
REVOKE ALL ON FUNCTION public.get_media_queue_items(text,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_media_queue_items(text,text,integer,integer) TO service_role;

ALTER FUNCTION public.get_media_queue_stats() RENAME TO get_media_queue_stats_without_scan;
CREATE FUNCTION public.get_media_queue_stats() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pgmq AS $$
DECLARE v_old jsonb; v_scan_pending bigint; v_scan_processing bigint; v_scan_completed bigint; v_scan_error bigint; v_totals jsonb;
BEGIN
  v_old:=public.get_media_queue_stats_without_scan();
  SELECT count(*) FILTER(WHERE vt<=now()),count(*) FILTER(WHERE vt>now()) INTO v_scan_pending,v_scan_processing FROM pgmq.q_wiki_scan;
  SELECT count(*) FILTER(WHERE NULLIF(message->>'error_message','') IS NULL),count(*) FILTER(WHERE NULLIF(message->>'error_message','') IS NOT NULL)
    INTO v_scan_completed,v_scan_error FROM pgmq.a_wiki_scan;
  v_totals:=v_old->'totals';
  RETURN v_old || jsonb_build_object(
    'wiki_scan',jsonb_build_object('pending',v_scan_pending,'processing',v_scan_processing,'completed',v_scan_completed,'error',v_scan_error,'total_active',v_scan_pending+v_scan_processing),
    'totals',jsonb_build_object(
      'pending',COALESCE((v_totals->>'pending')::bigint,0)+v_scan_pending,
      'processing',COALESCE((v_totals->>'processing')::bigint,0)+v_scan_processing,
      'completed',COALESCE((v_totals->>'completed')::bigint,0)+v_scan_completed,
      'error',COALESCE((v_totals->>'error')::bigint,0)+v_scan_error
    ));
END;
$$;
REVOKE ALL ON FUNCTION public.get_media_queue_stats() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_media_queue_stats() TO service_role;

ALTER FUNCTION public.delete_media_queue_item(bigint,text) RENAME TO delete_media_queue_item_without_scan;
CREATE FUNCTION public.delete_media_queue_item(p_id bigint,p_queue_name text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pgmq AS $$
DECLARE v_old boolean;
BEGIN
  IF p_queue_name='wiki_scan' THEN
    DELETE FROM pgmq.q_wiki_scan WHERE msg_id=p_id;
    DELETE FROM pgmq.a_wiki_scan WHERE msg_id=p_id;
    RETURN TRUE;
  END IF;
  v_old:=public.delete_media_queue_item_without_scan(p_id,p_queue_name);
  IF p_queue_name IS NULL THEN
    DELETE FROM pgmq.q_wiki_scan WHERE msg_id=p_id;
    DELETE FROM pgmq.a_wiki_scan WHERE msg_id=p_id;
  END IF;
  RETURN v_old;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_media_queue_item(bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.delete_media_queue_item(bigint,text) TO service_role;

NOTIFY pgrst,'reload schema';

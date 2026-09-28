-- Stage 1: protect new writes without guessing the market of legacy projects.
CREATE TABLE public.dubbing_languages (
  code text PRIMARY KEY CHECK (code ~ '^[a-z]{2,3}-[A-Z]{2}$')
);
INSERT INTO public.dubbing_languages(code) VALUES
('fr-FR'),('fr-CA'),('fr-BE'),('en-US'),('en-GB'),('ja-JP'),
('es-ES'),('es-MX'),('de-DE'),('it-IT'),('pt-BR'),('pt-PT');
ALTER TABLE public.dubbing_languages ENABLE ROW LEVEL SECURITY;
CREATE POLICY dubbing_languages_read ON public.dubbing_languages FOR SELECT
  TO anon, authenticated USING (true);
GRANT SELECT ON public.dubbing_languages TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.dubbing_languages TO service_role;

ALTER TABLE public.dubbing_projects ALTER COLUMN language DROP DEFAULT;
CREATE FUNCTION public.guard_dubbing_project_language() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  -- An unchanged legacy language must not block unrelated edits.
  IF TG_OP = 'UPDATE' AND NEW.language IS NOT DISTINCT FROM OLD.language
    AND NEW.content_id IS NOT DISTINCT FROM OLD.content_id
    AND NEW.content_type IS NOT DISTINCT FROM OLD.content_type THEN
    RETURN NEW;
  END IF;
  IF NEW.language IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.dubbing_languages WHERE code = NEW.language
  ) THEN
    RAISE EXCEPTION 'An approved regional dubbing language is required: %', NEW.language
      USING ERRCODE = '23514';
  END IF;
  -- Serialize creation until the final reviewed unique constraint is installed.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    NEW.content_type || ':' || NEW.content_id || ':' || NEW.language, 0));
  IF EXISTS (SELECT 1 FROM public.dubbing_projects p
    WHERE p.content_type = NEW.content_type AND p.content_id = NEW.content_id
      AND p.language = NEW.language AND p.id IS DISTINCT FROM NEW.id) THEN
    RAISE EXCEPTION 'Dubbing project already exists for this media and region'
      USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER dubbing_project_regional_language_guard
BEFORE INSERT OR UPDATE OF language, content_id, content_type ON public.dubbing_projects
FOR EACH ROW EXECUTE FUNCTION public.guard_dubbing_project_language();
REVOKE EXECUTE ON FUNCTION public.guard_dubbing_project_language() FROM PUBLIC;

-- Migration contract: call exactly once, after reviewed mappings have removed
-- every NULL, unregistered, and duplicate media+region project. This function
-- installs final constraints and removes its temporary guard, so it is not
-- idempotent and must not be called again in the same schema state.
CREATE FUNCTION public.finalize_dubbing_language_constraints() RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  LOCK TABLE public.dubbing_projects IN ACCESS EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM public.dubbing_projects p
    WHERE p.language IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.dubbing_languages l WHERE l.code=p.language)) THEN
    RAISE EXCEPTION 'Unresolved dubbing regions remain; review their source evidence first';
  END IF;
  IF EXISTS (SELECT 1 FROM public.dubbing_projects
    GROUP BY content_id,content_type,language HAVING count(*)>1) THEN
    RAISE EXCEPTION 'Unresolved dubbing project collisions remain';
  END IF;
  ALTER TABLE public.dubbing_projects ALTER COLUMN language SET NOT NULL;
  ALTER TABLE public.dubbing_projects ADD CONSTRAINT dubbing_projects_language_fkey
    FOREIGN KEY (language) REFERENCES public.dubbing_languages(code);
  ALTER TABLE public.dubbing_projects ADD CONSTRAINT dubbing_projects_media_region_key
    UNIQUE (content_id,content_type,language);
  DROP TRIGGER dubbing_project_regional_language_guard ON public.dubbing_projects;
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_dubbing_language_constraints() FROM PUBLIC, anon, authenticated, service_role;

-- Preserve the old source alias during mixed-version queue operation.
DO $$
DECLARE queue_name text;
BEGIN
  FOREACH queue_name IN ARRAY ARRAY['q_wiki_discovery','q_wiki_check','q_wiki_extract',
    'a_wiki_discovery','a_wiki_check','a_wiki_extract'] LOOP
    EXECUTE format('UPDATE pgmq.%I SET message=message || jsonb_build_object(''wikipedia_language'',message->>''language'')
      WHERE message ? ''language'' AND NOT message ? ''wikipedia_language''', queue_name);
  END LOOP;
END;
$$;

DROP FUNCTION public.enqueue_media_fetch(bigint,text,int,int,text,boolean);
DROP FUNCTION public.enqueue_media_extract(bigint,text,text,bigint,jsonb,int,int,boolean);
-- enqueue_media_fetch: block if dubbing project already exists for language
CREATE OR REPLACE FUNCTION public.enqueue_media_fetch(
  p_tmdb_id bigint,
  p_media_type text,
  p_season_number int default null,
  p_episode_number int default null,
  p_language text default null,
  p_is_manual boolean default false,
  p_wikipedia_language text default null,
  p_dubbing_language text default null
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_payload jsonb;
  v_msg_id bigint;
  v_target_queue text;
  v_lang text;
BEGIN
  v_lang := nullif(trim(COALESCE(p_wikipedia_language,p_language)), '');

  IF v_lang IS NOT NULL AND v_lang !~ '^[a-z][a-z0-9-]*$' THEN
    RAISE EXCEPTION 'Invalid Wikipedia source language';
  END IF;
  IF p_dubbing_language IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.dubbing_languages WHERE code=p_dubbing_language) THEN
    RAISE EXCEPTION 'Invalid regional dubbing language';
  END IF;
  IF v_lang IS NOT NULL THEN
    v_target_queue := 'wiki_check';
  ELSE
    v_target_queue := 'wiki_discovery';
  END IF;

  -- Skip if a dubbing project already has credits for this media+language
  -- When language is specified, block. Discovery (no language) is not blocked here
  -- because it only discovers which languages exist.
  IF p_dubbing_language IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.dubbing_projects dp
    WHERE dp.content_id = p_tmdb_id
      AND dp.content_type IN (p_media_type, CASE WHEN p_media_type IN ('season','episode') THEN 'tv' ELSE '' END)
      AND dp.language = p_dubbing_language
  ) THEN
    RAISE EXCEPTION 'Dubbing project already exists for % % [%]', p_media_type, p_tmdb_id, v_lang;
  END IF;

  v_payload := jsonb_build_object(
    'tmdb_id', p_tmdb_id,
    'media_type', p_media_type,
    'season_number', p_season_number,
    'episode_number', p_episode_number,
    'language', v_lang, -- deprecated source alias
    'wikipedia_language', v_lang,
    'dubbing_language', p_dubbing_language,
    'is_manual', COALESCE(p_is_manual, false),
    'priority', CASE WHEN COALESCE(p_is_manual, false) THEN 'high' ELSE 'normal' END,
    'requested_by', auth.uid()
  );

  IF v_target_queue = 'wiki_check' THEN
    IF EXISTS (
      SELECT 1 FROM pgmq.q_wiki_check
      WHERE (message->>'tmdb_id')::bigint = p_tmdb_id
        AND message->>'media_type' = p_media_type
        AND COALESCE(message->>'wikipedia_language',message->>'language') = v_lang
        AND (message->>'dubbing_language') IS NOT DISTINCT FROM p_dubbing_language
        AND COALESCE((message->>'season_number')::int, -1) = COALESCE(p_season_number, -1)
        AND COALESCE((message->>'episode_number')::int, -1) = COALESCE(p_episode_number, -1)
    ) THEN
      RAISE EXCEPTION 'Item is already in the check queue';
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM pgmq.q_wiki_discovery
      WHERE (message->>'tmdb_id')::bigint = p_tmdb_id
        AND message->>'media_type' = p_media_type
        AND COALESCE((message->>'season_number')::int, -1) = COALESCE(p_season_number, -1)
        AND COALESCE((message->>'episode_number')::int, -1) = COALESCE(p_episode_number, -1)
    ) THEN
      RAISE EXCEPTION 'Item is already in the discovery queue';
    END IF;
  END IF;

  IF v_target_queue = 'wiki_check' THEN
    SELECT pgmq.send('wiki_check', v_payload, '{}'::jsonb) INTO v_msg_id;
  ELSE
    SELECT pgmq.send('wiki_discovery', v_payload, '{}'::jsonb) INTO v_msg_id;
  END IF;

  RETURN v_msg_id;
END;
$$;

-- enqueue_media_extract: also block if dubbing project already exists
CREATE OR REPLACE FUNCTION public.enqueue_media_extract(
  p_tmdb_id bigint,
  p_media_type text,
  p_language text,
  p_page_id bigint,
  p_section_indexes jsonb,
  p_season_number int default null,
  p_episode_number int default null,
  p_is_manual boolean default false,
  p_wikipedia_language text default null,
  p_dubbing_language text default null
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_payload jsonb;
  v_msg_id bigint;
  v_lang text;
BEGIN
  v_lang := nullif(trim(COALESCE(p_wikipedia_language,p_language)), '');

  IF v_lang IS NULL OR v_lang !~ '^[a-z][a-z0-9-]*$' THEN
    RAISE EXCEPTION 'Invalid Wikipedia source language';
  END IF;
  IF p_dubbing_language IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.dubbing_languages WHERE code=p_dubbing_language) THEN
    RAISE EXCEPTION 'Invalid regional dubbing language';
  END IF;
  IF p_dubbing_language IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.dubbing_projects dp
    WHERE dp.content_id = p_tmdb_id
      AND dp.content_type IN (p_media_type, CASE WHEN p_media_type IN ('season','episode') THEN 'tv' ELSE '' END)
      AND dp.language = p_dubbing_language
  ) THEN
    RAISE EXCEPTION 'Dubbing project already exists for % % [%]', p_media_type, p_tmdb_id, v_lang;
  END IF;

  v_payload := jsonb_build_object(
    'tmdb_id', p_tmdb_id,
    'media_type', p_media_type,
    'language', v_lang, -- deprecated source alias
    'wikipedia_language', v_lang,
    'dubbing_language', p_dubbing_language,
    'page_id', p_page_id,
    'section_indexes', p_section_indexes,
    'season_number', p_season_number,
    'episode_number', p_episode_number,
    'is_manual', COALESCE(p_is_manual, false),
    'priority', CASE WHEN COALESCE(p_is_manual, false) THEN 'high' ELSE 'normal' END,
    'requested_by', auth.uid()
  );

  IF EXISTS (
    SELECT 1 FROM pgmq.q_wiki_extract
    WHERE (message->>'tmdb_id')::bigint = p_tmdb_id
      AND message->>'media_type' = p_media_type
      AND COALESCE(message->>'wikipedia_language',message->>'language') = v_lang
        AND (message->>'dubbing_language') IS NOT DISTINCT FROM p_dubbing_language
      AND COALESCE((message->>'season_number')::int, -1) = COALESCE(p_season_number, -1)
      AND COALESCE((message->>'episode_number')::int, -1) = COALESCE(p_episode_number, -1)
  ) THEN
    RAISE EXCEPTION 'Item is already in the extract queue';
  END IF;

  SELECT pgmq.send('wiki_extract', v_payload, '{}'::jsonb) INTO v_msg_id;
  RETURN v_msg_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enqueue_media_fetch(bigint, text, int, int, text, boolean, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_media_fetch(bigint, text, int, int, text, boolean, text, text)
  TO service_role;
REVOKE EXECUTE ON FUNCTION public.enqueue_media_extract(bigint, text, text, bigint, jsonb, int, int, boolean, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_media_extract(bigint, text, text, bigint, jsonb, int, int, boolean, text, text)
  TO service_role;

-- 1. Drop existing get_media_queue_items
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT p.oid::regprocedure::text AS func_signature
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_media_queue_items'
  ) LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
  END LOOP;
END $$;

-- 2. Enhanced get_media_queue_items
CREATE OR REPLACE FUNCTION public.get_media_queue_items(
  p_queue_name text default null,
  p_status text default null,
  p_limit int default 100,
  p_offset int default 0
)
RETURNS TABLE (
  id bigint,
  queue_name text,
  tmdb_id bigint,
  media_type text,
  language text,
  wikipedia_language text,
  dubbing_language text,
  season_number int,
  episode_number int,
  status text,
  error_message text,
  created_at timestamptz,
  read_ct int,
  is_manual boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_status_filter text := lower(trim(coalesce(p_status, '')));
  v_include_active boolean;
  v_include_archive boolean;
BEGIN
  -- Determine whether to query active tables, archive tables, or both
  IF v_status_filter IN ('archived', 'completed', 'error', 'failed') THEN
    v_include_active := FALSE;
    v_include_archive := TRUE;
  ELSIF v_status_filter IN ('active', 'pending', 'processing') THEN
    v_include_active := TRUE;
    v_include_archive := FALSE;
  ELSE
    v_include_active := TRUE;
    v_include_archive := TRUE;
  END IF;

  RETURN QUERY
  WITH all_items AS (
    -- Extract Queue (Active)
    SELECT
      q.msg_id AS id,
      'wiki_extract'::text AS queue_name,
      (q.message->>'tmdb_id')::bigint AS tmdb_id,
      q.message->>'media_type' AS media_type,
      COALESCE(q.message->>'wikipedia_language',q.message->>'language') AS language,
      COALESCE(q.message->>'wikipedia_language',q.message->>'language') AS wikipedia_language,
      q.message->>'dubbing_language' AS dubbing_language,
      (q.message->>'season_number')::int AS season_number,
      (q.message->>'episode_number')::int AS episode_number,
      CASE WHEN q.vt > now() THEN 'processing' ELSE 'pending' END AS status,
      q.message->>'error_message' AS error_message,
      q.enqueued_at AS created_at,
      q.read_ct,
      COALESCE((q.message->>'is_manual')::boolean, false) AS is_manual
    FROM pgmq.q_wiki_extract q
    WHERE v_include_active = TRUE
      AND (p_queue_name IS NULL OR p_queue_name = 'wiki_extract')
      AND (
        v_status_filter = '' OR v_status_filter = 'all' OR v_status_filter = 'active'
        OR (v_status_filter = 'pending' AND q.vt <= now())
        OR (v_status_filter = 'processing' AND q.vt > now())
      )

    UNION ALL

    -- Check Queue (Active)
    SELECT
      q.msg_id AS id,
      'wiki_check'::text AS queue_name,
      (q.message->>'tmdb_id')::bigint AS tmdb_id,
      q.message->>'media_type' AS media_type,
      COALESCE(q.message->>'wikipedia_language',q.message->>'language') AS language,
      COALESCE(q.message->>'wikipedia_language',q.message->>'language') AS wikipedia_language,
      q.message->>'dubbing_language' AS dubbing_language,
      (q.message->>'season_number')::int AS season_number,
      (q.message->>'episode_number')::int AS episode_number,
      CASE WHEN q.vt > now() THEN 'processing' ELSE 'pending' END AS status,
      q.message->>'error_message' AS error_message,
      q.enqueued_at AS created_at,
      q.read_ct,
      COALESCE((q.message->>'is_manual')::boolean, false) AS is_manual
    FROM pgmq.q_wiki_check q
    WHERE v_include_active = TRUE
      AND (p_queue_name IS NULL OR p_queue_name = 'wiki_check')
      AND (
        v_status_filter = '' OR v_status_filter = 'all' OR v_status_filter = 'active'
        OR (v_status_filter = 'pending' AND q.vt <= now())
        OR (v_status_filter = 'processing' AND q.vt > now())
      )

    UNION ALL

    -- Discovery Queue (Active)
    SELECT
      q.msg_id AS id,
      'wiki_discovery'::text AS queue_name,
      (q.message->>'tmdb_id')::bigint AS tmdb_id,
      q.message->>'media_type' AS media_type,
      COALESCE(q.message->>'wikipedia_language',q.message->>'language') AS language,
      COALESCE(q.message->>'wikipedia_language',q.message->>'language') AS wikipedia_language,
      q.message->>'dubbing_language' AS dubbing_language,
      (q.message->>'season_number')::int AS season_number,
      (q.message->>'episode_number')::int AS episode_number,
      CASE WHEN q.vt > now() THEN 'processing' ELSE 'pending' END AS status,
      q.message->>'error_message' AS error_message,
      q.enqueued_at AS created_at,
      q.read_ct,
      COALESCE((q.message->>'is_manual')::boolean, false) AS is_manual
    FROM pgmq.q_wiki_discovery q
    WHERE v_include_active = TRUE
      AND (p_queue_name IS NULL OR p_queue_name = 'wiki_discovery')
      AND (
        v_status_filter = '' OR v_status_filter = 'all' OR v_status_filter = 'active'
        OR (v_status_filter = 'pending' AND q.vt <= now())
        OR (v_status_filter = 'processing' AND q.vt > now())
      )

    UNION ALL

    -- Extract Archive
    SELECT
      a.msg_id AS id,
      'wiki_extract'::text AS queue_name,
      (a.message->>'tmdb_id')::bigint AS tmdb_id,
      a.message->>'media_type' AS media_type,
      COALESCE(a.message->>'wikipedia_language',a.message->>'language') AS language,
      COALESCE(a.message->>'wikipedia_language',a.message->>'language') AS wikipedia_language,
      a.message->>'dubbing_language' AS dubbing_language,
      (a.message->>'season_number')::int AS season_number,
      (a.message->>'episode_number')::int AS episode_number,
      CASE WHEN (a.message->>'error_message') IS NOT NULL AND (a.message->>'error_message') != '' THEN 'failed' ELSE 'completed' END AS status,
      a.message->>'error_message' AS error_message,
      a.enqueued_at AS created_at,
      a.read_ct,
      COALESCE((a.message->>'is_manual')::boolean, false) AS is_manual
    FROM pgmq.a_wiki_extract a
    WHERE v_include_archive = TRUE
      AND (p_queue_name IS NULL OR p_queue_name = 'wiki_extract')
      AND (
        v_status_filter = '' OR v_status_filter = 'all' OR v_status_filter = 'archived'
        OR (v_status_filter IN ('failed', 'error') AND (a.message->>'error_message') IS NOT NULL AND (a.message->>'error_message') != '')
        OR (v_status_filter = 'completed' AND ((a.message->>'error_message') IS NULL OR (a.message->>'error_message') = ''))
      )

    UNION ALL

    -- Check Archive
    SELECT
      a.msg_id AS id,
      'wiki_check'::text AS queue_name,
      (a.message->>'tmdb_id')::bigint AS tmdb_id,
      a.message->>'media_type' AS media_type,
      COALESCE(a.message->>'wikipedia_language',a.message->>'language') AS language,
      COALESCE(a.message->>'wikipedia_language',a.message->>'language') AS wikipedia_language,
      a.message->>'dubbing_language' AS dubbing_language,
      (a.message->>'season_number')::int AS season_number,
      (a.message->>'episode_number')::int AS episode_number,
      CASE WHEN (a.message->>'error_message') IS NOT NULL AND (a.message->>'error_message') != '' THEN 'failed' ELSE 'completed' END AS status,
      a.message->>'error_message' AS error_message,
      a.enqueued_at AS created_at,
      a.read_ct,
      COALESCE((a.message->>'is_manual')::boolean, false) AS is_manual
    FROM pgmq.a_wiki_check a
    WHERE v_include_archive = TRUE
      AND (p_queue_name IS NULL OR p_queue_name = 'wiki_check')
      AND (
        v_status_filter = '' OR v_status_filter = 'all' OR v_status_filter = 'archived'
        OR (v_status_filter IN ('failed', 'error') AND (a.message->>'error_message') IS NOT NULL AND (a.message->>'error_message') != '')
        OR (v_status_filter = 'completed' AND ((a.message->>'error_message') IS NULL OR (a.message->>'error_message') = ''))
      )

    UNION ALL

    -- Discovery Archive
    SELECT
      a.msg_id AS id,
      'wiki_discovery'::text AS queue_name,
      (a.message->>'tmdb_id')::bigint AS tmdb_id,
      a.message->>'media_type' AS media_type,
      COALESCE(a.message->>'wikipedia_language',a.message->>'language') AS language,
      COALESCE(a.message->>'wikipedia_language',a.message->>'language') AS wikipedia_language,
      a.message->>'dubbing_language' AS dubbing_language,
      (a.message->>'season_number')::int AS season_number,
      (a.message->>'episode_number')::int AS episode_number,
      CASE WHEN (a.message->>'error_message') IS NOT NULL AND (a.message->>'error_message') != '' THEN 'failed' ELSE 'completed' END AS status,
      a.message->>'error_message' AS error_message,
      a.enqueued_at AS created_at,
      a.read_ct,
      COALESCE((a.message->>'is_manual')::boolean, false) AS is_manual
    FROM pgmq.a_wiki_discovery a
    WHERE v_include_archive = TRUE
      AND (p_queue_name IS NULL OR p_queue_name = 'wiki_discovery')
      AND (
        v_status_filter = '' OR v_status_filter = 'all' OR v_status_filter = 'archived'
        OR (v_status_filter IN ('failed', 'error') AND (a.message->>'error_message') IS NOT NULL AND (a.message->>'error_message') != '')
        OR (v_status_filter = 'completed' AND ((a.message->>'error_message') IS NULL OR (a.message->>'error_message') = ''))
      )
  )
  SELECT
    all_items.id,
    all_items.queue_name,
    all_items.tmdb_id,
    all_items.media_type,
    all_items.language,
    all_items.wikipedia_language,
    all_items.dubbing_language,
    all_items.season_number,
    all_items.episode_number,
    all_items.status,
    all_items.error_message,
    all_items.created_at,
    all_items.read_ct,
    all_items.is_manual
  FROM all_items
  ORDER BY
    CASE
      -- When filtering specifically for archive, order purely by recency
      WHEN v_status_filter IN ('archived', 'completed', 'error', 'failed') THEN 0
      -- For active/all, prioritize manual pending, then processing, then pending, then archive
      WHEN all_items.status = 'pending' AND all_items.is_manual = TRUE THEN 1
      WHEN all_items.status = 'processing' THEN 2
      WHEN all_items.status = 'pending' THEN 3
      ELSE 4
    END ASC,
    all_items.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 3. Grant permissions
GRANT EXECUTE ON FUNCTION public.get_media_queue_items(text, text, int, int) TO authenticated, anon, service_role;

DROP FUNCTION public.get_media_queue_status(text,bigint,int,int,text);
CREATE OR REPLACE FUNCTION public.get_media_queue_status(
  p_media_type text,
  p_tmdb_id bigint,
  p_season_number int default null,
  p_episode_number int default null,
  p_language text default null,
  p_wikipedia_language text default null,
  p_dubbing_language text default null
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_status text;
BEGIN
  -- 1. Check wiki_extract
  SELECT
    CASE
      WHEN q.vt > now() THEN 'processing'
      ELSE 'pending'
    END INTO v_status
  FROM pgmq.q_wiki_extract q
  WHERE (q.message->>'tmdb_id')::bigint = p_tmdb_id
    AND q.message->>'media_type' = p_media_type
    AND (COALESCE(p_wikipedia_language,p_language) IS NULL OR COALESCE(q.message->>'wikipedia_language',q.message->>'language') = COALESCE(p_wikipedia_language,p_language))
    AND (p_dubbing_language IS NULL OR q.message->>'dubbing_language' = p_dubbing_language)
    AND COALESCE((q.message->>'season_number')::int, -1) = COALESCE(p_season_number, -1)
    AND COALESCE((q.message->>'episode_number')::int, -1) = COALESCE(p_episode_number, -1)
  ORDER BY q.msg_id DESC
  LIMIT 1;

  IF v_status IS NOT NULL THEN
    RETURN v_status;
  END IF;

  -- 2. Check wiki_check
  SELECT
    CASE
      WHEN q.vt > now() THEN 'processing'
      ELSE 'pending'
    END INTO v_status
  FROM pgmq.q_wiki_check q
  WHERE (q.message->>'tmdb_id')::bigint = p_tmdb_id
    AND q.message->>'media_type' = p_media_type
    AND (COALESCE(p_wikipedia_language,p_language) IS NULL OR COALESCE(q.message->>'wikipedia_language',q.message->>'language') = COALESCE(p_wikipedia_language,p_language))
    AND (p_dubbing_language IS NULL OR q.message->>'dubbing_language' = p_dubbing_language)
    AND COALESCE((q.message->>'season_number')::int, -1) = COALESCE(p_season_number, -1)
    AND COALESCE((q.message->>'episode_number')::int, -1) = COALESCE(p_episode_number, -1)
  ORDER BY q.msg_id DESC
  LIMIT 1;

  IF v_status IS NOT NULL THEN
    RETURN v_status;
  END IF;

  -- 3. Check wiki_discovery
  SELECT
    CASE
      WHEN q.vt > now() THEN 'processing'
      ELSE 'pending'
    END INTO v_status
  FROM pgmq.q_wiki_discovery q
  WHERE (q.message->>'tmdb_id')::bigint = p_tmdb_id
    AND q.message->>'media_type' = p_media_type
    AND COALESCE((q.message->>'season_number')::int, -1) = COALESCE(p_season_number, -1)
    AND COALESCE((q.message->>'episode_number')::int, -1) = COALESCE(p_episode_number, -1)
  ORDER BY q.msg_id DESC
  LIMIT 1;

  IF v_status IS NOT NULL THEN
    RETURN v_status;
  END IF;

  -- 4. Check archived extract
  SELECT
    CASE
      WHEN (a.message->>'error_message') IS NOT NULL AND (a.message->>'error_message') != '' THEN 'error'
      ELSE 'completed'
    END INTO v_status
  FROM pgmq.a_wiki_extract a
  WHERE (a.message->>'tmdb_id')::bigint = p_tmdb_id
    AND a.message->>'media_type' = p_media_type
    AND (COALESCE(p_wikipedia_language,p_language) IS NULL OR COALESCE(a.message->>'wikipedia_language',a.message->>'language') = COALESCE(p_wikipedia_language,p_language))
    AND (p_dubbing_language IS NULL OR a.message->>'dubbing_language' = p_dubbing_language)
    AND COALESCE((a.message->>'season_number')::int, -1) = COALESCE(p_season_number, -1)
    AND COALESCE((a.message->>'episode_number')::int, -1) = COALESCE(p_episode_number, -1)
  ORDER BY a.msg_id DESC
  LIMIT 1;

  IF v_status IS NOT NULL THEN
    RETURN v_status;
  END IF;

  -- 5. Check archived check
  SELECT
    CASE
      WHEN (a.message->>'error_message') IS NOT NULL AND (a.message->>'error_message') != '' THEN 'error'
      ELSE 'completed'
    END INTO v_status
  FROM pgmq.a_wiki_check a
  WHERE (a.message->>'tmdb_id')::bigint = p_tmdb_id
    AND a.message->>'media_type' = p_media_type
    AND (COALESCE(p_wikipedia_language,p_language) IS NULL OR COALESCE(a.message->>'wikipedia_language',a.message->>'language') = COALESCE(p_wikipedia_language,p_language))
    AND (p_dubbing_language IS NULL OR a.message->>'dubbing_language' = p_dubbing_language)
    AND COALESCE((a.message->>'season_number')::int, -1) = COALESCE(p_season_number, -1)
    AND COALESCE((a.message->>'episode_number')::int, -1) = COALESCE(p_episode_number, -1)
  ORDER BY a.msg_id DESC
  LIMIT 1;

  IF v_status IS NOT NULL THEN
    RETURN v_status;
  END IF;

  -- 6. Check archived discovery
  SELECT
    CASE
      WHEN (a.message->>'error_message') IS NOT NULL AND (a.message->>'error_message') != '' THEN 'error'
      ELSE 'completed'
    END INTO v_status
  FROM pgmq.a_wiki_discovery a
  WHERE (a.message->>'tmdb_id')::bigint = p_tmdb_id
    AND a.message->>'media_type' = p_media_type
    AND COALESCE((a.message->>'season_number')::int, -1) = COALESCE(p_season_number, -1)
    AND COALESCE((a.message->>'episode_number')::int, -1) = COALESCE(p_episode_number, -1)
  ORDER BY a.msg_id DESC
  LIMIT 1;

  RETURN COALESCE(v_status, 'none');
END;
$$;


GRANT EXECUTE ON FUNCTION public.get_media_queue_status(text,bigint,int,int,text,text,text) TO anon,authenticated,service_role;

-- Owner-only review tools. Full snapshots retain provenance and permit review/recovery.
CREATE TABLE public.dubbing_language_reviews (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  decision jsonb NOT NULL,
  source_snapshot jsonb NOT NULL,
  target_snapshot jsonb,
  applied_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dubbing_language_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dubbing_language_reviews FROM anon,authenticated,service_role;

CREATE FUNCTION public.dubbing_language_review_snapshot(p_project_id bigint)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'project',to_jsonb(p),
    'works',COALESCE((SELECT jsonb_agg(to_jsonb(w) ORDER BY w.id) FROM public.work w WHERE w.dubbing_project_id=p.id),'[]'::jsonb),
    'votes',COALESCE((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.id) FROM public.votes v JOIN public.work w ON w.id=v.work_id WHERE w.dubbing_project_id=p.id),'[]'::jsonb),
    'crew',COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM public.dubbing_project_crew c WHERE c.dubbing_project_id=p.id),'[]'::jsonb),
    'attachments',COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM public.project_attachments a WHERE a.dubbing_project_id=p.id),'[]'::jsonb),
    'audit_logs',COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM public.audit_logs a WHERE
      (a.entity_type IN ('dubbing_project','dubbing_projects') AND a.entity_id=p.id::text)
      OR (a.entity_type IN ('work','works') AND a.entity_id IN (SELECT w.id::text FROM public.work w WHERE w.dubbing_project_id=p.id))),'[]'::jsonb)
  ) FROM public.dubbing_projects p WHERE p.id=p_project_id;
$$;
REVOKE ALL ON FUNCTION public.dubbing_language_review_snapshot(bigint) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.apply_reviewed_dubbing_languages(p_decisions jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  d jsonb;
  src public.dubbing_projects%ROWTYPE;
  dst public.dubbing_projects%ROWTYPE;
  w public.work%ROWTYPE;
  existing_work public.work%ROWTYPE;
  v public.votes%ROWTYPE;
  existing_vote public.votes%ROWTYPE;
  source_snapshot jsonb;
  target_snapshot jsonb;
  choice text;
BEGIN
  IF jsonb_typeof(p_decisions) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Expected an approved decision array';
  END IF;
  LOCK TABLE public.dubbing_projects,public.work,public.votes,public.dubbing_project_crew,
    public.project_attachments,public.audit_logs IN SHARE ROW EXCLUSIVE MODE;
  FOR d IN SELECT value FROM jsonb_array_elements(p_decisions) LOOP
    IF COALESCE(d->>'approved_by','')='' OR COALESCE(d->>'evidence_quote','')=''
      OR COALESCE(d->>'evidence_url','') !~ '^https://' THEN
      RAISE EXCEPTION 'Explicit approval and source evidence are required';
    END IF;
    SELECT * INTO STRICT src FROM public.dubbing_projects WHERE id=(d->>'project_id')::bigint;
    IF NOT EXISTS (SELECT 1 FROM public.dubbing_languages WHERE code=d->>'target_language') THEN
      RAISE EXCEPTION 'Regional code is not in the approved registry';
    END IF;
    source_snapshot := public.dubbing_language_review_snapshot(src.id);
    IF md5(source_snapshot::text) IS DISTINCT FROM d->>'expected_snapshot_hash' THEN
      RAISE EXCEPTION 'Project % changed since review; regenerate its audit',src.id;
    END IF;
    target_snapshot := NULL;
    IF d->>'survivor_id' IS NOT NULL THEN
      SELECT * INTO STRICT dst FROM public.dubbing_projects WHERE id=(d->>'survivor_id')::bigint;
      IF src.id=dst.id OR src.content_id IS DISTINCT FROM dst.content_id
        OR src.content_type IS DISTINCT FROM dst.content_type
        OR dst.language IS DISTINCT FROM d->>'target_language' THEN
        RAISE EXCEPTION 'Merge must target an existing project for the same media and approved region';
      END IF;
      target_snapshot := public.dubbing_language_review_snapshot(dst.id);
      IF md5(target_snapshot::text) IS DISTINCT FROM d->>'expected_target_snapshot_hash' THEN
        RAISE EXCEPTION 'Survivor % changed since review; regenerate its audit',dst.id;
      END IF;
      -- Project-level conflicts must also be explicitly approved.
      IF src.studio_id IS NOT NULL AND src.studio_id IS DISTINCT FROM dst.studio_id
        AND COALESCE(d->>'keep_project_metadata','') NOT IN ('source','survivor') THEN
        RAISE EXCEPTION 'Studio conflict requires keep_project_metadata';
      END IF;
      IF src.status IS DISTINCT FROM dst.status
        AND COALESCE(d->>'keep_project_metadata','') NOT IN ('source','survivor') THEN
        RAISE EXCEPTION 'Project status conflict requires keep_project_metadata';
      END IF;
      IF d->>'keep_project_metadata'='source' THEN
        UPDATE public.dubbing_projects SET studio_id=src.studio_id,status=src.status WHERE id=dst.id;
      END IF;
      FOR w IN SELECT * FROM public.work WHERE dubbing_project_id=src.id ORDER BY id LOOP
        SELECT * INTO existing_work FROM public.work WHERE dubbing_project_id=dst.id
          AND actor_id IS NOT DISTINCT FROM w.actor_id
          AND character_id IS NOT DISTINCT FROM w.character_id
          AND voice_actor_id IS NOT DISTINCT FROM w.voice_actor_id ORDER BY id LIMIT 1;
        IF NOT FOUND THEN
          UPDATE public.work SET dubbing_project_id=dst.id WHERE id=w.id;
          CONTINUE;
        END IF;
        choice := NULL;
        IF (to_jsonb(w)-ARRAY['id','dubbing_project_id','created_at','updated_at','created_by','updated_by'])
          IS DISTINCT FROM (to_jsonb(existing_work)-ARRAY['id','dubbing_project_id','created_at','updated_at','created_by','updated_by']) THEN
          SELECT entry->>'keep' INTO choice FROM jsonb_array_elements(COALESCE(d->'work_decisions','[]'::jsonb)) entry
            WHERE (entry->>'source_work_id')::bigint=w.id AND (entry->>'survivor_work_id')::bigint=existing_work.id;
          IF COALESCE(choice,'') NOT IN ('source','survivor') THEN
            RAISE EXCEPTION 'Conflicting work % / % requires an explicit decision',w.id,existing_work.id;
          END IF;
          IF choice='source' THEN
            UPDATE public.work SET highlight=w.highlight,suggestions=w.suggestions,status=w.status,
              source_id=w.source_id,performance=w.performance,reviewed_status=w.reviewed_status,
              character_name=w.character_name,note=w.note,created_at=w.created_at,created_by=w.created_by,
              updated_at=w.updated_at,updated_by=w.updated_by WHERE id=existing_work.id;
          END IF;
        END IF;
        FOR v IN SELECT * FROM public.votes WHERE work_id=w.id ORDER BY id LOOP
          SELECT * INTO existing_vote FROM public.votes WHERE work_id=existing_work.id AND user_id IS NOT DISTINCT FROM v.user_id ORDER BY id LIMIT 1;
          IF NOT FOUND THEN
            UPDATE public.votes SET work_id=existing_work.id WHERE id=v.id;
          ELSE
            IF existing_vote.vote_type IS DISTINCT FROM v.vote_type THEN
              SELECT entry->>'keep' INTO choice FROM jsonb_array_elements(COALESCE(d->'vote_decisions','[]'::jsonb)) entry
                WHERE (entry->>'source_vote_id')::bigint=v.id AND (entry->>'survivor_vote_id')::bigint=existing_vote.id;
              IF COALESCE(choice,'') NOT IN ('source','survivor') THEN
                RAISE EXCEPTION 'Conflicting votes % / % require an explicit decision',v.id,existing_vote.id;
              END IF;
              IF choice='source' THEN
                UPDATE public.votes SET vote_type=v.vote_type,created_at=v.created_at WHERE id=existing_vote.id;
              END IF;
            END IF;
            DELETE FROM public.votes WHERE id=v.id;
          END IF;
        END LOOP;
        UPDATE public.audit_logs SET entity_id=existing_work.id::text WHERE entity_type IN ('work','works') AND entity_id=w.id::text;
        DELETE FROM public.work WHERE id=w.id;
      END LOOP;
      UPDATE public.dubbing_project_crew SET dubbing_project_id=dst.id WHERE dubbing_project_id=src.id;
      UPDATE public.project_attachments SET dubbing_project_id=dst.id WHERE dubbing_project_id=src.id;
      UPDATE public.audit_logs SET entity_id=dst.id::text WHERE entity_type IN ('dubbing_project','dubbing_projects') AND entity_id=src.id::text;
      DELETE FROM public.dubbing_projects WHERE id=src.id;
    ELSE
      UPDATE public.dubbing_projects SET language=d->>'target_language' WHERE id=src.id;
    END IF;
    INSERT INTO public.dubbing_language_reviews(decision,source_snapshot,target_snapshot)
      VALUES(d,source_snapshot,target_snapshot);
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_reviewed_dubbing_languages(jsonb) FROM PUBLIC,anon,authenticated,service_role;

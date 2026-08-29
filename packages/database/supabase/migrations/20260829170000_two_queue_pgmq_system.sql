-- Two-queue native pgmq system: wiki_lang (per-language leaf jobs) and wiki_nolang (discovery jobs)
-- 1. Ensure pgmq extension is installed
CREATE EXTENSION IF NOT EXISTS pgmq CASCADE;

-- 2. Create the two queues (idempotently)
DO $$
BEGIN
  BEGIN
    PERFORM pgmq.create('wiki_lang');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    PERFORM pgmq.create('wiki_nolang');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

-- 3. Clear all active and archived queue tables for a clean start
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'pgmq' AND table_name = 'q_wiki_lang') THEN
    DELETE FROM pgmq.q_wiki_lang WHERE true;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'pgmq' AND table_name = 'a_wiki_lang') THEN
    DELETE FROM pgmq.a_wiki_lang WHERE true;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'pgmq' AND table_name = 'q_wiki_nolang') THEN
    DELETE FROM pgmq.q_wiki_nolang WHERE true;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'pgmq' AND table_name = 'a_wiki_nolang') THEN
    DELETE FROM pgmq.a_wiki_nolang WHERE true;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'pgmq' AND table_name = 'q_media_queue') THEN
    DELETE FROM pgmq.q_media_queue WHERE true;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'pgmq' AND table_name = 'a_media_queue') THEN
    DELETE FROM pgmq.a_media_queue WHERE true;
  END IF;
END $$;

-- 4. Ensure headers column exists on all active and archive queue tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'pgmq' AND table_name = 'q_wiki_lang') AND
     NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'pgmq' AND table_name = 'q_wiki_lang' AND column_name = 'headers') THEN
    ALTER TABLE pgmq.q_wiki_lang ADD COLUMN headers jsonb DEFAULT '{}';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'pgmq' AND table_name = 'a_wiki_lang') AND
     NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'pgmq' AND table_name = 'a_wiki_lang' AND column_name = 'headers') THEN
    ALTER TABLE pgmq.a_wiki_lang ADD COLUMN headers jsonb DEFAULT '{}';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'pgmq' AND table_name = 'q_wiki_nolang') AND
     NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'pgmq' AND table_name = 'q_wiki_nolang' AND column_name = 'headers') THEN
    ALTER TABLE pgmq.q_wiki_nolang ADD COLUMN headers jsonb DEFAULT '{}';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'pgmq' AND table_name = 'a_wiki_nolang') AND
     NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'pgmq' AND table_name = 'a_wiki_nolang' AND column_name = 'headers') THEN
    ALTER TABLE pgmq.a_wiki_nolang ADD COLUMN headers jsonb DEFAULT '{}';
  END IF;
END $$;

-- 5. Helper to enqueue a fetch request into the appropriate queue (wiki_lang or wiki_nolang)
DROP FUNCTION IF EXISTS public.enqueue_media_fetch(int, text, int, int);
DROP FUNCTION IF EXISTS public.enqueue_media_fetch(int, text, int, int, text);

CREATE OR REPLACE FUNCTION public.enqueue_media_fetch(
  p_tmdb_id int,
  p_media_type text,
  p_season_number int DEFAULT null,
  p_episode_number int DEFAULT null,
  p_language text DEFAULT null
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_msg_id bigint;
  v_clean_lang text := nullif(trim(p_language), '');
BEGIN
  IF v_clean_lang IS NOT NULL THEN
    -- Check if already enqueued in active wiki_lang queue
    IF EXISTS (
      SELECT 1 
      FROM pgmq.q_wiki_lang 
      WHERE (message->>'tmdb_id')::int = p_tmdb_id 
        AND message->>'media_type' = p_media_type
        AND (
          (p_season_number IS NULL AND message->>'season_number' IS NULL)
          OR (message->>'season_number')::int = p_season_number
        )
        AND (
          (p_episode_number IS NULL AND message->>'episode_number' IS NULL)
          OR (message->>'episode_number')::int = p_episode_number
        )
        AND message->>'language' = v_clean_lang
    ) THEN
      RAISE EXCEPTION 'Request is already in the queue';
    END IF;

    v_msg_id := pgmq.send(
      'wiki_lang',
      jsonb_build_object(
        'tmdb_id', p_tmdb_id,
        'media_type', p_media_type,
        'season_number', p_season_number,
        'episode_number', p_episode_number,
        'language', v_clean_lang,
        'user_id', auth.uid()
      ),
      '{}'::jsonb
    );
  ELSE
    -- Check if already enqueued in active wiki_nolang queue
    IF EXISTS (
      SELECT 1 
      FROM pgmq.q_wiki_nolang 
      WHERE (message->>'tmdb_id')::int = p_tmdb_id 
        AND message->>'media_type' = p_media_type
        AND (
          (p_season_number IS NULL AND message->>'season_number' IS NULL)
          OR (message->>'season_number')::int = p_season_number
        )
        AND (
          (p_episode_number IS NULL AND message->>'episode_number' IS NULL)
          OR (message->>'episode_number')::int = p_episode_number
        )
    ) THEN
      RAISE EXCEPTION 'Request is already in the queue';
    END IF;

    v_msg_id := pgmq.send(
      'wiki_nolang',
      jsonb_build_object(
        'tmdb_id', p_tmdb_id,
        'media_type', p_media_type,
        'season_number', p_season_number,
        'episode_number', p_episode_number,
        'language', null,
        'user_id', auth.uid()
      ),
      '{}'::jsonb
    );
  END IF;
  
  RETURN v_msg_id;
END;
$$;

-- 6. Helper to pop a message from a specific queue (wiki_lang or wiki_nolang)
DROP FUNCTION IF EXISTS public.pop_media_queue_message(int);
DROP FUNCTION IF EXISTS public.pop_media_queue_message(text, int);

CREATE OR REPLACE FUNCTION public.pop_media_queue_message(
  p_queue_name text,
  p_vt_seconds int DEFAULT 30
)
RETURNS TABLE (
  msg_id bigint,
  read_ct int,
  enqueued_at timestamp with time zone,
  vt timestamp with time zone,
  message jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.msg_id,
    r.read_ct,
    r.enqueued_at,
    r.vt,
    r.message
  FROM pgmq.read(p_queue_name, p_vt_seconds, 1) r;
END;
$$;

-- Overload for pop_media_queue_message(p_vt_seconds) polling wiki_lang first, then wiki_nolang
CREATE OR REPLACE FUNCTION public.pop_media_queue_message(
  p_vt_seconds int DEFAULT 30
)
RETURNS TABLE (
  msg_id bigint,
  read_ct int,
  enqueued_at timestamp with time zone,
  vt timestamp with time zone,
  message jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_found boolean := false;
BEGIN
  -- Poll wiki_lang first
  RETURN QUERY
  SELECT 
    r.msg_id,
    r.read_ct,
    r.enqueued_at,
    r.vt,
    r.message
  FROM pgmq.read('wiki_lang', p_vt_seconds, 1) r;
  
  IF FOUND THEN
    RETURN;
  END IF;

  -- Fallback to wiki_nolang
  RETURN QUERY
  SELECT 
    r.msg_id,
    r.read_ct,
    r.enqueued_at,
    r.vt,
    r.message
  FROM pgmq.read('wiki_nolang', p_vt_seconds, 1) r;
END;
$$;

-- 7. Helper to archive message upon success with queue name
DROP FUNCTION IF EXISTS public.archive_media_queue_message(bigint);
DROP FUNCTION IF EXISTS public.archive_media_queue_message(text, bigint);

CREATE OR REPLACE FUNCTION public.archive_media_queue_message(
  p_queue_name text,
  p_msg_id bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_archived boolean;
BEGIN
  BEGIN
    v_archived := pgmq.archive(p_queue_name, p_msg_id);
  EXCEPTION WHEN OTHERS THEN
    -- Fallback manual archive if schema mismatch
    IF p_queue_name = 'wiki_lang' THEN
      WITH deleted AS (
        DELETE FROM pgmq.q_wiki_lang WHERE msg_id = p_msg_id RETURNING *
      )
      INSERT INTO pgmq.a_wiki_lang (msg_id, read_ct, enqueued_at, vt, message, headers)
      SELECT d.msg_id, d.read_ct, d.enqueued_at, d.vt, d.message, coalesce(d.headers, '{}'::jsonb)
      FROM deleted d;
    ELSIF p_queue_name = 'wiki_nolang' THEN
      WITH deleted AS (
        DELETE FROM pgmq.q_wiki_nolang WHERE msg_id = p_msg_id RETURNING *
      )
      INSERT INTO pgmq.a_wiki_nolang (msg_id, read_ct, enqueued_at, vt, message, headers)
      SELECT d.msg_id, d.read_ct, d.enqueued_at, d.vt, d.message, coalesce(d.headers, '{}'::jsonb)
      FROM deleted d;
    END IF;
    v_archived := true;
  END;

  RETURN coalesce(v_archived, true);
END;
$$;

-- Backward compatibility overload: archive_media_queue_message(p_msg_id)
CREATE OR REPLACE FUNCTION public.archive_media_queue_message(
  p_msg_id bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Try wiki_lang first
  IF EXISTS (SELECT 1 FROM pgmq.q_wiki_lang WHERE msg_id = p_msg_id) THEN
    RETURN public.archive_media_queue_message('wiki_lang', p_msg_id);
  -- Try wiki_nolang second
  ELSIF EXISTS (SELECT 1 FROM pgmq.q_wiki_nolang WHERE msg_id = p_msg_id) THEN
    RETURN public.archive_media_queue_message('wiki_nolang', p_msg_id);
  END IF;

  RETURN false;
END;
$$;

-- 8. Helper to archive message upon failure and save error log
DROP FUNCTION IF EXISTS public.archive_media_queue_message_with_error(bigint, text);
DROP FUNCTION IF EXISTS public.archive_media_queue_message_with_error(text, bigint, text);

CREATE OR REPLACE FUNCTION public.archive_media_queue_message_with_error(
  p_queue_name text,
  p_msg_id bigint,
  p_error text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.archive_media_queue_message(p_queue_name, p_msg_id);
  
  IF p_queue_name = 'wiki_lang' THEN
    UPDATE pgmq.a_wiki_lang 
    SET message = message || jsonb_build_object('error', p_error)
    WHERE msg_id = p_msg_id;
  ELSIF p_queue_name = 'wiki_nolang' THEN
    UPDATE pgmq.a_wiki_nolang 
    SET message = message || jsonb_build_object('error', p_error)
    WHERE msg_id = p_msg_id;
  END IF;

  RETURN true;
END;
$$;

-- Backward compatibility overload: archive_media_queue_message_with_error(p_msg_id, p_error)
CREATE OR REPLACE FUNCTION public.archive_media_queue_message_with_error(
  p_msg_id bigint,
  p_error text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pgmq.q_wiki_lang WHERE msg_id = p_msg_id) THEN
    RETURN public.archive_media_queue_message_with_error('wiki_lang', p_msg_id, p_error);
  ELSIF EXISTS (SELECT 1 FROM pgmq.q_wiki_nolang WHERE msg_id = p_msg_id) THEN
    RETURN public.archive_media_queue_message_with_error('wiki_nolang', p_msg_id, p_error);
  END IF;

  RETURN false;
END;
$$;

-- 9. Helper to get status of a media fetch request across queues
DROP FUNCTION IF EXISTS public.get_media_queue_status(int, text, int, int);
DROP FUNCTION IF EXISTS public.get_media_queue_status(int, text, int, int, text);

CREATE OR REPLACE FUNCTION public.get_media_queue_status(
  p_tmdb_id int,
  p_media_type text,
  p_season_number int DEFAULT null,
  p_episode_number int DEFAULT null,
  p_language text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clean_lang text := nullif(trim(p_language), '');
  v_status text;
  v_error text := null;
  v_record record;
BEGIN
  IF v_clean_lang IS NOT NULL THEN
    -- Check active wiki_lang
    SELECT * INTO v_record 
    FROM pgmq.q_wiki_lang 
    WHERE (message->>'tmdb_id')::int = p_tmdb_id 
      AND message->>'media_type' = p_media_type
      AND (
        (p_season_number IS NULL AND message->>'season_number' IS NULL)
        OR (message->>'season_number')::int = p_season_number
      )
      AND (
        (p_episode_number IS NULL AND message->>'episode_number' IS NULL)
        OR (message->>'episode_number')::int = p_episode_number
      )
      AND message->>'language' = v_clean_lang
    ORDER BY msg_id DESC
    LIMIT 1;

    IF FOUND THEN
      IF v_record.vt > now() THEN
        v_status := 'processing';
      ELSE
        v_status := 'pending';
      END IF;
    ELSE
      -- Check archived wiki_lang
      SELECT * INTO v_record 
      FROM pgmq.a_wiki_lang 
      WHERE (message->>'tmdb_id')::int = p_tmdb_id 
        AND message->>'media_type' = p_media_type
        AND (
          (p_season_number IS NULL AND message->>'season_number' IS NULL)
          OR (message->>'season_number')::int = p_season_number
        )
        AND (
          (p_episode_number IS NULL AND message->>'episode_number' IS NULL)
          OR (message->>'episode_number')::int = p_episode_number
        )
        AND message->>'language' = v_clean_lang
      ORDER BY msg_id DESC
      LIMIT 1;

      IF FOUND THEN
        IF v_record.message ? 'error' THEN
          v_status := 'failed';
          v_error := v_record.message->>'error';
        ELSE
          v_status := 'completed';
        END IF;
      END IF;
    END IF;
  ELSE
    -- Check active wiki_nolang first
    SELECT * INTO v_record 
    FROM pgmq.q_wiki_nolang 
    WHERE (message->>'tmdb_id')::int = p_tmdb_id 
      AND message->>'media_type' = p_media_type
      AND (
        (p_season_number IS NULL AND message->>'season_number' IS NULL)
        OR (message->>'season_number')::int = p_season_number
      )
      AND (
        (p_episode_number IS NULL AND message->>'episode_number' IS NULL)
        OR (message->>'episode_number')::int = p_episode_number
      )
    ORDER BY msg_id DESC
    LIMIT 1;

    IF FOUND THEN
      IF v_record.vt > now() THEN
        v_status := 'processing';
      ELSE
        v_status := 'pending';
      END IF;
    ELSE
      -- Check archived wiki_nolang
      SELECT * INTO v_record 
      FROM pgmq.a_wiki_nolang 
      WHERE (message->>'tmdb_id')::int = p_tmdb_id 
        AND message->>'media_type' = p_media_type
        AND (
          (p_season_number IS NULL AND message->>'season_number' IS NULL)
          OR (message->>'season_number')::int = p_season_number
        )
        AND (
          (p_episode_number IS NULL AND message->>'episode_number' IS NULL)
          OR (message->>'episode_number')::int = p_episode_number
        )
      ORDER BY msg_id DESC
      LIMIT 1;

      IF FOUND THEN
        IF v_record.message ? 'error' THEN
          v_status := 'failed';
          v_error := v_record.message->>'error';
        ELSE
          v_status := 'completed';
        END IF;
      END IF;
    END IF;
  END IF;

  IF v_status IS NULL THEN
    RETURN null;
  END IF;

  RETURN jsonb_build_object('status', v_status, 'error_message', v_error);
END;
$$;

-- 10. Helper to retrieve all active and archived queue items for the Admin UI across both queues
DROP FUNCTION IF EXISTS public.get_media_queue_items();

CREATE OR REPLACE FUNCTION public.get_media_queue_items()
RETURNS TABLE (
  id bigint,
  queue_name text,
  tmdb_id int,
  media_type text,
  season_number int,
  episode_number int,
  language text,
  status text,
  error_message text,
  user_id uuid,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  -- Active wiki_lang
  SELECT 
    msg_id AS id,
    'wiki_lang'::text AS queue_name,
    (message->>'tmdb_id')::int AS tmdb_id,
    message->>'media_type' AS media_type,
    (message->>'season_number')::int AS season_number,
    (message->>'episode_number')::int AS episode_number,
    message->>'language' AS language,
    CASE WHEN vt > now() THEN 'processing'::text ELSE 'pending'::text END AS status,
    null::text AS error_message,
    (message->>'user_id')::uuid AS user_id,
    enqueued_at AS created_at,
    vt AS updated_at
  FROM pgmq.q_wiki_lang

  UNION ALL

  -- Archived wiki_lang
  SELECT 
    msg_id AS id,
    'wiki_lang'::text AS queue_name,
    (message->>'tmdb_id')::int AS tmdb_id,
    message->>'media_type' AS media_type,
    (message->>'season_number')::int AS season_number,
    (message->>'episode_number')::int AS episode_number,
    message->>'language' AS language,
    CASE WHEN message ? 'error' THEN 'failed'::text ELSE 'completed'::text END AS status,
    message->>'error' AS error_message,
    (message->>'user_id')::uuid AS user_id,
    enqueued_at AS created_at,
    vt AS updated_at
  FROM pgmq.a_wiki_lang

  UNION ALL

  -- Active wiki_nolang
  SELECT 
    msg_id AS id,
    'wiki_nolang'::text AS queue_name,
    (message->>'tmdb_id')::int AS tmdb_id,
    message->>'media_type' AS media_type,
    (message->>'season_number')::int AS season_number,
    (message->>'episode_number')::int AS episode_number,
    null::text AS language,
    CASE WHEN vt > now() THEN 'processing'::text ELSE 'pending'::text END AS status,
    null::text AS error_message,
    (message->>'user_id')::uuid AS user_id,
    enqueued_at AS created_at,
    vt AS updated_at
  FROM pgmq.q_wiki_nolang

  UNION ALL

  -- Archived wiki_nolang
  SELECT 
    msg_id AS id,
    'wiki_nolang'::text AS queue_name,
    (message->>'tmdb_id')::int AS tmdb_id,
    message->>'media_type' AS media_type,
    (message->>'season_number')::int AS season_number,
    (message->>'episode_number')::int AS episode_number,
    null::text AS language,
    CASE WHEN message ? 'error' THEN 'failed'::text ELSE 'completed'::text END AS status,
    message->>'error' AS error_message,
    (message->>'user_id')::uuid AS user_id,
    enqueued_at AS created_at,
    vt AS updated_at
  FROM pgmq.a_wiki_nolang

  ORDER BY created_at DESC;
END;
$$;

-- 11. Helper to delete an active or archived queue item
DROP FUNCTION IF EXISTS public.delete_media_queue_item(bigint);
DROP FUNCTION IF EXISTS public.delete_media_queue_item(bigint, text);

CREATE OR REPLACE FUNCTION public.delete_media_queue_item(
  p_id bigint,
  p_queue_name text DEFAULT null
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_queue_name = 'wiki_lang' THEN
    PERFORM pgmq.delete('wiki_lang', p_id);
    DELETE FROM pgmq.a_wiki_lang WHERE msg_id = p_id;
  ELSIF p_queue_name = 'wiki_nolang' THEN
    PERFORM pgmq.delete('wiki_nolang', p_id);
    DELETE FROM pgmq.a_wiki_nolang WHERE msg_id = p_id;
  ELSE
    -- Try deleting from both
    PERFORM pgmq.delete('wiki_lang', p_id);
    DELETE FROM pgmq.a_wiki_lang WHERE msg_id = p_id;
    PERFORM pgmq.delete('wiki_nolang', p_id);
    DELETE FROM pgmq.a_wiki_nolang WHERE msg_id = p_id;
  END IF;

  RETURN true;
END;
$$;

-- 12. Helper to clear both queues (active and archived)
CREATE OR REPLACE FUNCTION public.clear_media_queue()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM pgmq.q_wiki_lang WHERE true;
  DELETE FROM pgmq.a_wiki_lang WHERE true;
  DELETE FROM pgmq.q_wiki_nolang WHERE true;
  DELETE FROM pgmq.a_wiki_nolang WHERE true;
  RETURN true;
END;
$$;

-- 13. Helper to get total visible (non-locked) message depth across both queues
CREATE OR REPLACE FUNCTION public.get_media_queue_depth()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT (
    (SELECT count(*) FROM pgmq.q_wiki_lang WHERE vt <= now()) +
    (SELECT count(*) FROM pgmq.q_wiki_nolang WHERE vt <= now())
  )::bigint;
$$;

-- 14. Helper to get locked message count across both queues
CREATE OR REPLACE FUNCTION public.get_media_queue_locked_count()
RETURNS int
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT (
    (SELECT count(*) FROM pgmq.q_wiki_lang WHERE vt > now()) +
    (SELECT count(*) FROM pgmq.q_wiki_nolang WHERE vt > now())
  )::int;
$$;

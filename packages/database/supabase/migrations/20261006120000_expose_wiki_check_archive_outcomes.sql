-- Expose automatic wiki_check archive outcomes in the standard admin history inspector.
-- The archived queue payload remains the source of truth; this adds no review action.
DROP FUNCTION IF EXISTS public.get_media_queue_items(text, text, integer, integer);

CREATE FUNCTION public.get_media_queue_items(p_queue_name text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
 RETURNS TABLE(id bigint, queue_name text, tmdb_id bigint, media_type text, language text, wikipedia_language text, dubbing_language text, season_number integer, episode_number integer, status text, error_message text, created_at timestamp with time zone, read_ct integer, is_manual boolean, requested_by uuid, archive_reason text, archive_details text, detected_regions jsonb, candidate_sections jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pgmq'
AS $function$
DECLARE
  v_status_filter text := lower(trim(coalesce(p_status, '')));
  v_include_active boolean;
  v_include_archive boolean;
BEGIN
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
      COALESCE((q.message->>'is_manual')::boolean, false) AS is_manual,
      nullif(q.message->>'requested_by', '')::uuid AS requested_by,
      NULL::text AS archive_reason,
      NULL::text AS archive_details,
      NULL::jsonb AS detected_regions,
      NULL::jsonb AS candidate_sections
    FROM pgmq.q_wiki_extract q
    WHERE v_include_active = TRUE
      AND (p_queue_name IS NULL OR p_queue_name = 'wiki_extract')
      AND (
        v_status_filter = '' OR v_status_filter = 'all' OR v_status_filter = 'active'
        OR (v_status_filter = 'pending' AND q.vt <= now())
        OR (v_status_filter = 'processing' AND q.vt > now())
      )

    UNION ALL

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
      COALESCE((q.message->>'is_manual')::boolean, false) AS is_manual,
      nullif(q.message->>'requested_by', '')::uuid AS requested_by,
      NULL::text AS archive_reason,
      NULL::text AS archive_details,
      NULL::jsonb AS detected_regions,
      NULL::jsonb AS candidate_sections
    FROM pgmq.q_wiki_check q
    WHERE v_include_active = TRUE
      AND (p_queue_name IS NULL OR p_queue_name = 'wiki_check')
      AND (
        v_status_filter = '' OR v_status_filter = 'all' OR v_status_filter = 'active'
        OR (v_status_filter = 'pending' AND q.vt <= now())
        OR (v_status_filter = 'processing' AND q.vt > now())
      )

    UNION ALL

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
      COALESCE((q.message->>'is_manual')::boolean, false) AS is_manual,
      nullif(q.message->>'requested_by', '')::uuid AS requested_by,
      NULL::text AS archive_reason,
      NULL::text AS archive_details,
      NULL::jsonb AS detected_regions,
      NULL::jsonb AS candidate_sections
    FROM pgmq.q_wiki_discovery q
    WHERE v_include_active = TRUE
      AND (p_queue_name IS NULL OR p_queue_name = 'wiki_discovery')
      AND (
        v_status_filter = '' OR v_status_filter = 'all' OR v_status_filter = 'active'
        OR (v_status_filter = 'pending' AND q.vt <= now())
        OR (v_status_filter = 'processing' AND q.vt > now())
      )

    UNION ALL

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
      COALESCE((a.message->>'is_manual')::boolean, false) AS is_manual,
      nullif(a.message->>'requested_by', '')::uuid AS requested_by,
      NULL::text AS archive_reason,
      NULL::text AS archive_details,
      NULL::jsonb AS detected_regions,
      NULL::jsonb AS candidate_sections
    FROM pgmq.a_wiki_extract a
    WHERE v_include_archive = TRUE
      AND (p_queue_name IS NULL OR p_queue_name = 'wiki_extract')
      AND (
        v_status_filter = '' OR v_status_filter = 'all' OR v_status_filter = 'archived'
        OR (v_status_filter IN ('failed', 'error') AND (a.message->>'error_message') IS NOT NULL AND (a.message->>'error_message') != '')
        OR (v_status_filter = 'completed' AND ((a.message->>'error_message') IS NULL OR (a.message->>'error_message') = ''))
      )

    UNION ALL

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
      COALESCE((a.message->>'is_manual')::boolean, false) AS is_manual,
      nullif(a.message->>'requested_by', '')::uuid AS requested_by,
      a.message->>'archive_reason' AS archive_reason,
      a.message->>'archive_details' AS archive_details,
      a.message->'detected_regions' AS detected_regions,
      a.message->'candidate_sections' AS candidate_sections
    FROM pgmq.a_wiki_check a
    WHERE v_include_archive = TRUE
      AND (p_queue_name IS NULL OR p_queue_name = 'wiki_check')
      AND (
        v_status_filter = '' OR v_status_filter = 'all' OR v_status_filter = 'archived'
        OR (v_status_filter IN ('failed', 'error') AND (a.message->>'error_message') IS NOT NULL AND (a.message->>'error_message') != '')
        OR (v_status_filter = 'completed' AND ((a.message->>'error_message') IS NULL OR (a.message->>'error_message') = ''))
      )

    UNION ALL

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
      COALESCE((a.message->>'is_manual')::boolean, false) AS is_manual,
      nullif(a.message->>'requested_by', '')::uuid AS requested_by,
      NULL::text AS archive_reason,
      NULL::text AS archive_details,
      NULL::jsonb AS detected_regions,
      NULL::jsonb AS candidate_sections
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
    all_items.is_manual,
    all_items.requested_by,
    all_items.archive_reason,
    all_items.archive_details,
    all_items.detected_regions,
    all_items.candidate_sections
  FROM all_items
  ORDER BY
    CASE
      WHEN v_status_filter IN ('archived', 'completed', 'error', 'failed') THEN 0
      WHEN all_items.status = 'pending' AND all_items.is_manual = TRUE THEN 1
      WHEN all_items.status = 'processing' THEN 2
      WHEN all_items.status = 'pending' THEN 3
      ELSE 4
    END ASC,
    all_items.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_media_queue_items(text, text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_media_queue_items(text, text, integer, integer)
  TO service_role;

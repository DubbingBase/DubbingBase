CREATE OR REPLACE FUNCTION public.archive_wiki_check_with_outcome(
  p_msg_id bigint,
  p_archive_reason text,
  p_archive_details text,
  p_detected_regions jsonb,
  p_candidate_sections jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF p_archive_reason NOT IN (
    'extraction_enqueued',
    'adult_content_excluded',
    'no_candidate_sections',
    'no_dubbing_evidence',
    'ambiguous_region',
    'unsupported_region',
    'target_conflict'
  ) THEN
    RAISE EXCEPTION 'Invalid wiki_check archive reason: %', p_archive_reason;
  END IF;

  IF jsonb_typeof(p_detected_regions) <> 'array'
    OR jsonb_typeof(p_candidate_sections) <> 'array' THEN
    RAISE EXCEPTION 'Wiki check outcome regions and candidates must be JSON arrays';
  END IF;

  UPDATE pgmq.q_wiki_check
  SET message = message || jsonb_build_object(
    'archive_reason', p_archive_reason,
    'archive_details', p_archive_details,
    'detected_regions', p_detected_regions,
    'candidate_sections', p_candidate_sections
  )
  WHERE msg_id = p_msg_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN FALSE;
  END IF;

  RETURN public.archive_media_queue_message('wiki_check', p_msg_id);
END;
$$;

REVOKE ALL ON FUNCTION public.archive_wiki_check_with_outcome(bigint, text, text, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_wiki_check_with_outcome(bigint, text, text, jsonb, jsonb)
  TO service_role;

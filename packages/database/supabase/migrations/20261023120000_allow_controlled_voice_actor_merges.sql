-- These admin-only RPCs consolidate assignments by deleting duplicate work
-- rows and, for profile merges, moving assignments to the surviving profile.
-- Run them as postgres so the voice actor work guard permits these established
-- atomic merge paths. Their service_role-only grants remain the API boundary.
ALTER FUNCTION public.merge_work_duplicates_atomic(bigint, bigint[], jsonb, uuid)
  OWNER TO postgres;
ALTER FUNCTION public.merge_work_duplicates_atomic(bigint, bigint[], jsonb, uuid)
  SECURITY DEFINER;
ALTER FUNCTION public.merge_work_duplicates_atomic(bigint, bigint[], jsonb, uuid)
  SET search_path = '';
REVOKE ALL ON FUNCTION public.merge_work_duplicates_atomic(bigint, bigint[], jsonb, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_work_duplicates_atomic(bigint, bigint[], jsonb, uuid)
  TO service_role;

ALTER FUNCTION public.merge_voice_actor_duplicates_atomic(integer, integer[], jsonb)
  OWNER TO postgres;
ALTER FUNCTION public.merge_voice_actor_duplicates_atomic(integer, integer[], jsonb)
  SECURITY DEFINER;
ALTER FUNCTION public.merge_voice_actor_duplicates_atomic(integer, integer[], jsonb)
  SET search_path = '';
REVOKE ALL ON FUNCTION public.merge_voice_actor_duplicates_atomic(integer, integer[], jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_voice_actor_duplicates_atomic(integer, integer[], jsonb)
  TO service_role;

NOTIFY pgrst, 'reload schema';

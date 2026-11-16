-- 20261023120000 made the admin work merge run as its postgres owner so the voice actor work
-- guard permits its established atomic delete path. 20261030162604 later redefined the
-- function with CREATE OR REPLACE ... SECURITY INVOKER, silently dropping that setting.
-- Restore it; the service_role-only grant stays the API boundary.
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

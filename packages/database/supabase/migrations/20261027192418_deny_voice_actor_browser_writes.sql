-- Profile changes must use controlled service operations that write audit
-- history. Reject legacy browser writes with a privilege error during rollout
-- rather than silently filtering an UPDATE through RLS.
DROP POLICY IF EXISTS "Allow admin write access to voice_actors" ON public.voice_actors;
REVOKE ALL ON TABLE public.voice_actors FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.voice_actors TO anon, authenticated;
REVOKE ALL ON SEQUENCE public.voice_actors_id_seq FROM PUBLIC, anon, authenticated;

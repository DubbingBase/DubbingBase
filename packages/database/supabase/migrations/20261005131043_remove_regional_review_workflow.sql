-- Remove the retired admin review workflow after its application callers are gone.
-- Archived PGMQ rows and their diagnostic metadata remain available for history.
DROP FUNCTION IF EXISTS public.get_regional_review_queue_items(integer, integer);
DROP FUNCTION IF EXISTS public.get_regional_review_queue_items(integer);
DROP FUNCTION IF EXISTS public.resume_wiki_check_for_regional_review(bigint, text);
DROP FUNCTION IF EXISTS public.archive_wiki_check_for_regional_review(bigint, text);

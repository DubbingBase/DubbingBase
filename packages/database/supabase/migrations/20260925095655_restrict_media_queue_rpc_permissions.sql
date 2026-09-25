REVOKE EXECUTE ON FUNCTION public.clear_media_queue()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_media_queue()
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.pop_media_queue_message(text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pop_media_queue_message(text, integer)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.archive_media_queue_message(text, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_media_queue_message(text, bigint)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.archive_media_queue_message_with_error(text, bigint, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_media_queue_message_with_error(text, bigint, text)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.delay_media_queue_message(text, bigint, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delay_media_queue_message(text, bigint, integer)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.delete_media_queue_item(bigint, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_media_queue_item(bigint, text)
  TO service_role;

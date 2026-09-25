CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;
SELECT plan(29);

SELECT ok(NOT has_function_privilege('anon', 'public.clear_media_queue()', 'EXECUTE'), 'anon cannot execute clear_media_queue');
SELECT ok(NOT has_function_privilege('authenticated', 'public.clear_media_queue()', 'EXECUTE'), 'authenticated cannot execute clear_media_queue');
SELECT ok(has_function_privilege('service_role', 'public.clear_media_queue()', 'EXECUTE'), 'service_role can execute clear_media_queue');

SELECT ok(NOT has_function_privilege('anon', 'public.pop_media_queue_message(text, integer)', 'EXECUTE'), 'anon cannot execute pop_media_queue_message');
SELECT ok(NOT has_function_privilege('authenticated', 'public.pop_media_queue_message(text, integer)', 'EXECUTE'), 'authenticated cannot execute pop_media_queue_message');
SELECT ok(has_function_privilege('service_role', 'public.pop_media_queue_message(text, integer)', 'EXECUTE'), 'service_role can execute pop_media_queue_message');

SELECT ok(NOT has_function_privilege('anon', 'public.archive_media_queue_message(text, bigint)', 'EXECUTE'), 'anon cannot execute archive_media_queue_message');
SELECT ok(NOT has_function_privilege('authenticated', 'public.archive_media_queue_message(text, bigint)', 'EXECUTE'), 'authenticated cannot execute archive_media_queue_message');
SELECT ok(has_function_privilege('service_role', 'public.archive_media_queue_message(text, bigint)', 'EXECUTE'), 'service_role can execute archive_media_queue_message');

SELECT ok(NOT has_function_privilege('anon', 'public.archive_media_queue_message_with_error(text, bigint, text)', 'EXECUTE'), 'anon cannot execute archive_media_queue_message_with_error');
SELECT ok(NOT has_function_privilege('authenticated', 'public.archive_media_queue_message_with_error(text, bigint, text)', 'EXECUTE'), 'authenticated cannot execute archive_media_queue_message_with_error');
SELECT ok(has_function_privilege('service_role', 'public.archive_media_queue_message_with_error(text, bigint, text)', 'EXECUTE'), 'service_role can execute archive_media_queue_message_with_error');

SELECT ok(NOT has_function_privilege('anon', 'public.delay_media_queue_message(text, bigint, integer)', 'EXECUTE'), 'anon cannot execute delay_media_queue_message');
SELECT ok(NOT has_function_privilege('authenticated', 'public.delay_media_queue_message(text, bigint, integer)', 'EXECUTE'), 'authenticated cannot execute delay_media_queue_message');
SELECT ok(has_function_privilege('service_role', 'public.delay_media_queue_message(text, bigint, integer)', 'EXECUTE'), 'service_role can execute delay_media_queue_message');

SELECT ok(NOT has_function_privilege('anon', 'public.delete_media_queue_item(bigint, text)', 'EXECUTE'), 'anon cannot execute delete_media_queue_item');
SELECT ok(NOT has_function_privilege('authenticated', 'public.delete_media_queue_item(bigint, text)', 'EXECUTE'), 'authenticated cannot execute delete_media_queue_item');
SELECT ok(has_function_privilege('service_role', 'public.delete_media_queue_item(bigint, text)', 'EXECUTE'), 'service_role can execute delete_media_queue_item');

SELECT ok(NOT has_function_privilege('anon', 'public.pop_media_queue_batch(text, integer, integer)', 'EXECUTE'), 'anon cannot execute pop_media_queue_batch');
SELECT ok(NOT has_function_privilege('authenticated', 'public.pop_media_queue_batch(text, integer, integer)', 'EXECUTE'), 'authenticated cannot execute pop_media_queue_batch');
SELECT ok(has_function_privilege('service_role', 'public.pop_media_queue_batch(text, integer, integer)', 'EXECUTE'), 'service_role can execute pop_media_queue_batch');

SELECT ok(NOT has_function_privilege('anon', 'public.archive_media_queue_messages(text, bigint[])', 'EXECUTE'), 'anon cannot execute archive_media_queue_messages');
SELECT ok(NOT has_function_privilege('authenticated', 'public.archive_media_queue_messages(text, bigint[])', 'EXECUTE'), 'authenticated cannot execute archive_media_queue_messages');
SELECT ok(has_function_privilege('service_role', 'public.archive_media_queue_messages(text, bigint[])', 'EXECUTE'), 'service_role can execute archive_media_queue_messages');

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","user_metadata":{"role":"admin"},"app_metadata":{"role":"user"}}',
  true
);
SELECT throws_ok(
  $$INSERT INTO public.dubbing_projects (content_id, content_type) VALUES (910001, 'security_test_user_metadata')$$,
  '42501',
  NULL,
  'user_metadata admin cannot grant database write access'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","user_metadata":{"role":"user"},"app_metadata":{"role":"admin"}}',
  true
);
SELECT lives_ok(
  $$INSERT INTO public.dubbing_projects (content_id, content_type) VALUES (910002, 'security_test_app_admin')$$,
  'admin from app_metadata retains database write access'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated","user_metadata":{"role":"user"},"app_metadata":{"role":"editor"}}',
  true
);
SELECT lives_ok(
  $$INSERT INTO public.dubbing_projects (content_id, content_type) VALUES (910003, 'security_test_app_editor')$$,
  'editor from app_metadata retains database write access'
);

RESET ROLE;

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE COALESCE(qual, '') || COALESCE(with_check, '') ILIKE '%user_metadata%'
  ),
  'active RLS policies do not authorize from user_metadata'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE (COALESCE(qual, '') || COALESCE(with_check, '')) ~* 'auth\.jwt\(\)\s*->>\s*''role'''
  ),
  'active RLS policies do not authorize from the top-level JWT role claim'
);

SELECT * FROM finish();
ROLLBACK;

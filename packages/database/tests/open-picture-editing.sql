-- Run only against an isolated local database after applying all migrations.
-- Profile pictures: anyone confirmed and unblocked may add a first picture; only trusted users and
-- admins may replace one; every change is audited and stale writers lose.
\set ON_ERROR_STOP on
BEGIN;

INSERT INTO auth.users (id, raw_app_meta_data) VALUES
  ('00000000-0000-0000-0000-0000000d0001', '{}'::JSONB),
  ('00000000-0000-0000-0000-0000000d0002', '{"trusted":true}'::JSONB),
  ('00000000-0000-0000-0000-0000000d0003', '{"blocked":true}'::JSONB);
UPDATE auth.users SET email_confirmed_at = now()
WHERE id IN ('00000000-0000-0000-0000-0000000d0001', '00000000-0000-0000-0000-0000000d0002',
             '00000000-0000-0000-0000-0000000d0003');
INSERT INTO public.voice_actors (id, firstname, lastname) VALUES (990100001, 'Picture', 'Rules');

SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_community UUID := '00000000-0000-0000-0000-0000000d0001';
  v_trusted UUID := '00000000-0000-0000-0000-0000000d0002';
  v_blocked UUID := '00000000-0000-0000-0000-0000000d0003';
  v_first TEXT := '990100001/11111111-1111-4111-8111-111111111111.png';
  v_second TEXT := '990100001/22222222-2222-4222-8222-222222222222.jpg';
  v_third TEXT := '990100001/33333333-3333-4333-8333-333333333333.webp';
  v_count BIGINT;
BEGIN
  -- Invalid paths: wrong actor, traversal, wrong extension.
  BEGIN
    PERFORM * FROM public.controlled_set_voice_actor_picture(
      v_community, 990100001, '990100002/11111111-1111-4111-8111-111111111111.png', NULL);
    RAISE EXCEPTION 'picture path of another actor was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM * FROM public.controlled_set_voice_actor_picture(
      v_community, 990100001, '990100001/../11111111-1111-4111-8111-111111111111.png', NULL);
    RAISE EXCEPTION 'path traversal was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM * FROM public.controlled_set_voice_actor_picture(
      v_community, 990100001, '990100001/11111111-1111-4111-8111-111111111111.svg', NULL);
    RAISE EXCEPTION 'svg path was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  -- Blocked accounts cannot add even a first picture.
  BEGIN
    PERFORM * FROM public.controlled_set_voice_actor_picture(v_blocked, 990100001, v_first, NULL);
    RAISE EXCEPTION 'blocked user set a picture';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- A community user may add the first picture, and the change is audited.
  PERFORM * FROM public.controlled_set_voice_actor_picture(v_community, 990100001, v_first, NULL);
  SELECT count(*) INTO v_count FROM public.audit_logs
  WHERE user_id = v_community AND entity_type = 'voice_actor' AND entity_id = '990100001'
    AND new_value ->> 'profile_picture' = v_first AND previous_value ->> 'profile_picture' IS NULL;
  IF v_count <> 1 THEN RAISE EXCEPTION 'first picture was not audited once'; END IF;

  -- Replacing needs trust; a community user is rejected and the picture is unchanged.
  BEGIN
    PERFORM * FROM public.controlled_set_voice_actor_picture(v_community, 990100001, v_second, v_first);
    RAISE EXCEPTION 'community user replaced a picture';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF (SELECT profile_picture FROM public.voice_actors WHERE id = 990100001) <> v_first THEN
    RAISE EXCEPTION 'rejected replacement changed the picture';
  END IF;

  -- A stale writer (wrong expected previous value) loses even when trusted.
  BEGIN
    PERFORM * FROM public.controlled_set_voice_actor_picture(v_trusted, 990100001, v_second, 'old/path.png');
    RAISE EXCEPTION 'stale picture write was accepted';
  EXCEPTION WHEN serialization_failure THEN NULL;
  END;

  -- A trusted user may replace; the audit keeps the previous path.
  PERFORM * FROM public.controlled_set_voice_actor_picture(v_trusted, 990100001, v_third, v_first);
  SELECT count(*) INTO v_count FROM public.audit_logs
  WHERE user_id = v_trusted AND entity_id = '990100001'
    AND previous_value ->> 'profile_picture' = v_first AND new_value ->> 'profile_picture' = v_third;
  IF v_count <> 1 THEN RAISE EXCEPTION 'replacement was not audited with the previous path'; END IF;
END;
$$;
RESET ROLE;

ROLLBACK;

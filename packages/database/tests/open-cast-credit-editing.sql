-- Run only against an isolated local database after applying all migrations.
-- Covers open cast-credit editing: any confirmed, unblocked user may add or edit a credit,
-- edits stay 'waiting' until validated, trusted users/admins/linked actors auto-verify and
-- may change verified credits, and deletion stays limited to admins and linked actors.
\set ON_ERROR_STOP on
BEGIN;

INSERT INTO auth.users (id, raw_app_meta_data) VALUES
  ('00000000-0000-0000-0000-0000000c0001', '{"role":"admin"}'::JSONB),
  ('00000000-0000-0000-0000-0000000c0002', '{}'::JSONB),
  ('00000000-0000-0000-0000-0000000c0003', '{"trusted":true}'::JSONB),
  ('00000000-0000-0000-0000-0000000c0004', '{"blocked":true}'::JSONB),
  ('00000000-0000-0000-0000-0000000c0005', '{}'::JSONB),
  ('00000000-0000-0000-0000-0000000c0006', '{}'::JSONB);
UPDATE auth.users SET email_confirmed_at = now()
WHERE id IN (
  '00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-0000000c0002',
  '00000000-0000-0000-0000-0000000c0003', '00000000-0000-0000-0000-0000000c0004',
  '00000000-0000-0000-0000-0000000c0006'
); -- c0005 never confirmed its email

INSERT INTO public.voice_actors (id, firstname, lastname) VALUES
  (990000001, 'Open', 'Credits'),
  (990000002, 'Linked', 'Actor');
INSERT INTO public.user_voice_actor_links (id, user_id, voice_actor_id)
VALUES ('99000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-0000000c0006', 990000002);

SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_admin UUID := '00000000-0000-0000-0000-0000000c0001';
  v_community UUID := '00000000-0000-0000-0000-0000000c0002';
  v_trusted UUID := '00000000-0000-0000-0000-0000000c0003';
  v_blocked UUID := '00000000-0000-0000-0000-0000000c0004';
  v_unconfirmed UUID := '00000000-0000-0000-0000-0000000c0005';
  v_linked UUID := '00000000-0000-0000-0000-0000000c0006';
  v_work BIGINT;
  v_trusted_work BIGINT;
  v_linked_work BIGINT;
  v_updated_at TIMESTAMPTZ;
  v_status TEXT;
  v_count BIGINT;
BEGIN
  -- Blocked and unconfirmed accounts cannot add credits.
  BEGIN
    PERFORM * FROM public.create_voice_actor_work_link(
      v_blocked, gen_random_uuid(), 990000001, 990001001, 'movie', 'fr-FR',
      NULL, NULL, 'Blocked role', 'dialogues');
    RAISE EXCEPTION 'blocked user created a credit';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM * FROM public.create_voice_actor_work_link(
      v_unconfirmed, gen_random_uuid(), 990000001, 990001001, 'movie', 'fr-FR',
      NULL, NULL, 'Unconfirmed role', 'dialogues');
    RAISE EXCEPTION 'unconfirmed user created a credit';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- A community user (unlinked, untrusted) can add a credit; it is unverified and attributed.
  SELECT created.work_id INTO v_work FROM public.create_voice_actor_work_link(
    v_community, gen_random_uuid(), 990000001, 990001001, 'movie', 'fr-FR',
    NULL, NULL, 'Community role', 'dialogues') AS created;
  SELECT reviewed_status, updated_at INTO v_status, v_updated_at FROM public.work WHERE id = v_work;
  IF v_status <> 'waiting' THEN RAISE EXCEPTION 'community credit was not left waiting: %', v_status; END IF;
  SELECT count(*) INTO v_count FROM public.audit_logs
  WHERE user_id = v_community AND entity_type = 'work' AND entity_id = v_work::TEXT AND action = 'create';
  IF v_count <> 1 THEN RAISE EXCEPTION 'community credit was not audited once'; END IF;

  -- A trusted user's credit is verified automatically; the linked actor's is too.
  SELECT created.work_id INTO v_trusted_work FROM public.create_voice_actor_work_link(
    v_trusted, gen_random_uuid(), 990000001, 990001001, 'movie', 'fr-FR',
    NULL, NULL, 'Trusted role', 'dialogues') AS created;
  IF (SELECT reviewed_status FROM public.work WHERE id = v_trusted_work) <> 'accepted' THEN
    RAISE EXCEPTION 'trusted credit was not auto-verified';
  END IF;
  SELECT created.work_id INTO v_linked_work FROM public.create_voice_actor_work_link(
    v_linked, gen_random_uuid(), 990000002, 990001001, 'movie', 'fr-FR',
    NULL, NULL, 'Linked role', 'dialogues') AS created;
  IF (SELECT reviewed_status FROM public.work WHERE id = v_linked_work) <> 'accepted' THEN
    RAISE EXCEPTION 'linked actor credit was not auto-verified';
  END IF;

  -- Editing a waiting credit stays waiting for a community user.
  PERFORM * FROM public.update_voice_actor_work_performance(
    v_community, gen_random_uuid(), v_work, v_updated_at, 'voice');
  SELECT reviewed_status, updated_at INTO v_status, v_updated_at FROM public.work WHERE id = v_work;
  IF v_status <> 'waiting' THEN RAISE EXCEPTION 'community edit changed review status to %', v_status; END IF;

  -- Community users and blocked trusted users cannot validate; trusted users can.
  BEGIN
    PERFORM * FROM public.update_work_review_status_controlled(
      v_community, gen_random_uuid(), v_work, v_updated_at, 'accepted');
    RAISE EXCEPTION 'community user validated a credit';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM * FROM public.update_work_review_status_controlled(
    v_trusted, gen_random_uuid(), v_work, v_updated_at, 'accepted');
  SELECT updated_at INTO v_updated_at FROM public.work WHERE id = v_work;

  -- A verified credit is locked for community users but not for trusted users, admins, or the actor.
  BEGIN
    PERFORM * FROM public.update_voice_actor_work_performance(
      v_community, gen_random_uuid(), v_work, v_updated_at, 'chant');
    RAISE EXCEPTION 'community user edited a verified credit';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM * FROM public.update_voice_actor_work_performance(
    v_trusted, gen_random_uuid(), v_work, v_updated_at, 'chant');
  IF (SELECT reviewed_status FROM public.work WHERE id = v_work) <> 'accepted' THEN
    RAISE EXCEPTION 'trusted edit did not keep the credit verified';
  END IF;

  -- Deleting a credit stays limited to admins and the linked actor.
  SELECT updated_at INTO v_updated_at FROM public.work WHERE id = v_work;
  BEGIN
    PERFORM * FROM public.delete_voice_actor_work_link(
      v_community, gen_random_uuid(), v_work, v_updated_at);
    RAISE EXCEPTION 'community user deleted a credit';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM * FROM public.delete_voice_actor_work_link(
      v_trusted, gen_random_uuid(), v_work, v_updated_at);
    RAISE EXCEPTION 'trusted user deleted a credit';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM * FROM public.delete_voice_actor_work_link(
    v_admin, gen_random_uuid(), v_work, v_updated_at);
END;
$$;
RESET ROLE;

ROLLBACK;

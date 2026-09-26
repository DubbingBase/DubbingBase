-- Run against an isolated local database after applying the regional migrations.
-- Every fixture and schema assertion is rolled back.
BEGIN;
SET LOCAL statement_timeout='30s';
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

DO $$
BEGIN
  IF has_function_privilege('anon',
    'public.enqueue_media_fetch(bigint,text,integer,integer,text,boolean,text,text)', 'EXECUTE')
    OR has_function_privilege('authenticated',
    'public.enqueue_media_fetch(bigint,text,integer,integer,text,boolean,text,text)', 'EXECUTE')
    OR has_function_privilege('anon',
    'public.enqueue_media_extract(bigint,text,text,bigint,jsonb,integer,integer,boolean,text,text)', 'EXECUTE')
    OR has_function_privilege('authenticated',
    'public.enqueue_media_extract(bigint,text,text,bigint,jsonb,integer,integer,boolean,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Queue mutation RPCs must not be executable by public API roles';
  END IF;
  IF NOT has_function_privilege('service_role',
    'public.enqueue_media_fetch(bigint,text,integer,integer,text,boolean,text,text)', 'EXECUTE')
    OR NOT has_function_privilege('service_role',
    'public.enqueue_media_extract(bigint,text,text,bigint,jsonb,integer,integer,boolean,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Service role must retain queue mutation RPC access';
  END IF;
END;
$$;

DO $$
DECLARE code text;
BEGIN
  FOREACH code IN ARRAY ARRAY['fr','de','simple','fr-Fr','zz-ZZ'] LOOP
    BEGIN
      INSERT INTO public.dubbing_projects(content_id,content_type,language) VALUES(-900000,'tv',code);
      RAISE EXCEPTION 'Invalid language % was accepted',code;
    EXCEPTION WHEN check_violation THEN NULL;
    END;
  END LOOP;
  BEGIN
    INSERT INTO public.dubbing_projects(content_id,content_type) VALUES(-900000,'tv');
    RAISE EXCEPTION 'Missing language was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END;
$$;

-- Simulate a pre-migration legacy row without modifying the staging guard.
SET LOCAL session_replication_role='replica';
INSERT INTO public.dubbing_projects(id,content_id,content_type,language,status) VALUES(-900001,-900010,'tv','fr','validated');
SET LOCAL session_replication_role='origin';
UPDATE public.dubbing_projects SET status='validated' WHERE id=-900001;
UPDATE public.dubbing_projects SET language=language WHERE id=-900001;
INSERT INTO public.dubbing_projects(id,content_id,content_type,language,status) VALUES(-900002,-900010,'tv','fr-FR','validated');
DO $$ BEGIN
  BEGIN
    INSERT INTO public.dubbing_projects(content_id,content_type,language) VALUES(-900010,'tv','fr-FR');
    RAISE EXCEPTION 'Duplicate regional project was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.finalize_dubbing_language_constraints();
    RAISE EXCEPTION 'Unresolved project was finalized';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Unresolved dubbing regions%' THEN RAISE; END IF;
  END;
END; $$;

INSERT INTO auth.users(id) VALUES('00000000-0000-0000-0000-000000900001'),('00000000-0000-0000-0000-000000900002');
INSERT INTO public.voice_actors(id,firstname,lastname) VALUES(-900001,'Test','One'),(-900002,'Test','Two'),(-900003,'Test','Three');
INSERT INTO public.work(id,dubbing_project_id,voice_actor_id,actor_id,status,reviewed_status) VALUES
(-900001,-900001,-900001,1,'validated','accepted'),
(-900002,-900002,-900001,1,'validated','accepted'),
(-900003,-900002,-900002,2,'validated','accepted'),
(-900004,-900001,-900003,3,'validated','accepted');
INSERT INTO public.votes(id,work_id,user_id,vote_type) OVERRIDING SYSTEM VALUE VALUES
(-900001,-900001,'00000000-0000-0000-0000-000000900001','up'),
(-900002,-900002,'00000000-0000-0000-0000-000000900001','up'),
(-900003,-900001,'00000000-0000-0000-0000-000000900002','up');
INSERT INTO public.jobs(id,name) OVERRIDING SYSTEM VALUE VALUES(-900001,'Test direction');
INSERT INTO public.dubbing_project_crew(id,dubbing_project_id,person_id,job_id) OVERRIDING SYSTEM VALUE VALUES(-900001,-900001,-900001,-900001);
INSERT INTO public.project_attachments(id,dubbing_project_id,file_path,file_name) OVERRIDING SYSTEM VALUE VALUES(-900001,-900001,'test/credits','credits');
INSERT INTO public.audit_logs(entity_type,entity_id,action,user_id) VALUES('work','-900001','created','00000000-0000-0000-0000-000000900001'),('votes','-900001','created','00000000-0000-0000-0000-000000900001'),('dubbing_projects','-900001','created','00000000-0000-0000-0000-000000900001');

DO $$
DECLARE decision jsonb;
BEGIN
  decision := jsonb_build_object('project_id',-900001,'target_language','fr-FR','survivor_id',-900002,
    'approved_by','local integration fixture','evidence_url','https://example.test/france-credits','evidence_quote','Explicit France fixture',
    'expected_snapshot_hash',md5(public.dubbing_language_review_snapshot(-900001)::text),
    'expected_target_snapshot_hash',md5(public.dubbing_language_review_snapshot(-900002)::text));
  BEGIN
    PERFORM public.apply_reviewed_dubbing_languages(jsonb_build_array(decision || '{"expected_snapshot_hash":"stale"}'::jsonb));
    RAISE EXCEPTION 'Stale review was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Project % changed since review%' THEN RAISE; END IF;
  END;
  -- Conflicting review state must be resolved explicitly, never overwritten.
  UPDATE public.work SET reviewed_status='waiting' WHERE id=-900001;
  decision := decision || jsonb_build_object('expected_snapshot_hash',md5(public.dubbing_language_review_snapshot(-900001)::text));
  BEGIN
    PERFORM public.apply_reviewed_dubbing_languages(jsonb_build_array(decision));
    RAISE EXCEPTION 'Work conflict was silently resolved';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Conflicting work%' THEN RAISE; END IF;
  END;
  UPDATE public.work SET reviewed_status='accepted' WHERE id=-900001;
  decision := decision || jsonb_build_object('expected_snapshot_hash',md5(public.dubbing_language_review_snapshot(-900001)::text));
  UPDATE public.votes SET vote_type='down' WHERE id=-900001;
  decision := decision || jsonb_build_object('expected_snapshot_hash',md5(public.dubbing_language_review_snapshot(-900001)::text));
  BEGIN
    PERFORM public.apply_reviewed_dubbing_languages(jsonb_build_array(decision));
    RAISE EXCEPTION 'Vote conflict was silently resolved';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Conflicting votes%' THEN RAISE; END IF;
  END;
  IF (SELECT work_id FROM public.votes WHERE id=-900003)<>-900001 THEN RAISE EXCEPTION 'Failed merge was not atomic'; END IF;
  UPDATE public.votes SET vote_type='up' WHERE id=-900001;
  decision := decision || jsonb_build_object('expected_snapshot_hash',md5(public.dubbing_language_review_snapshot(-900001)::text));
  PERFORM public.apply_reviewed_dubbing_languages(jsonb_build_array(decision));
  IF EXISTS(SELECT 1 FROM public.dubbing_projects WHERE id=-900001) THEN RAISE EXCEPTION 'Source project remains'; END IF;
  IF (SELECT count(*) FROM public.work WHERE dubbing_project_id=-900002)<>3 THEN RAISE EXCEPTION 'Cast union was not preserved'; END IF;
  IF (SELECT count(*) FROM public.votes WHERE work_id=-900002)<>2 THEN RAISE EXCEPTION 'Distinct votes were not preserved'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.dubbing_project_crew WHERE id=-900001 AND dubbing_project_id=-900002) THEN RAISE EXCEPTION 'Crew was lost'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.project_attachments WHERE id=-900001 AND dubbing_project_id=-900002) THEN RAISE EXCEPTION 'Attachment was lost'; END IF;
  IF EXISTS(SELECT 1 FROM public.audit_logs WHERE entity_type IN ('work','votes','dubbing_projects') AND entity_id='-900001') THEN RAISE EXCEPTION 'Audit references were not reparented'; END IF;
  IF (SELECT count(*) FROM public.dubbing_language_reviews)<>1 THEN RAISE EXCEPTION 'Recovery snapshots missing'; END IF;
END;
$$;

DO $$
DECLARE message_id bigint;
BEGIN
  message_id := public.enqueue_media_fetch(p_tmdb_id=>900099,p_media_type=>'tv',p_language=>'simple');
  IF NOT EXISTS(SELECT 1 FROM pgmq.q_wiki_check WHERE msg_id=message_id AND message->>'wikipedia_language'='simple' AND message->>'dubbing_language' IS NULL) THEN
    RAISE EXCEPTION 'Legacy source was not preserved separately';
  END IF;
  message_id := public.enqueue_media_fetch(p_tmdb_id=>900099,p_media_type=>'tv',p_wikipedia_language=>'simple',p_dubbing_language=>'en-US');
  IF NOT EXISTS(SELECT 1 FROM public.get_media_queue_items() WHERE id=message_id AND wikipedia_language='simple' AND dubbing_language='en-US') THEN
    RAISE EXCEPTION 'Queue reader lost the approved regional target';
  END IF;
  IF public.get_media_queue_status('tv',900099,p_wikipedia_language=>'simple',p_dubbing_language=>'en-US') NOT IN ('pending','processing') THEN RAISE EXCEPTION 'Queue status lost language separation'; END IF;
  IF public.get_media_queue_status('tv',900099,p_wikipedia_language=>'simple',p_dubbing_language=>'fr-FR') <> 'none' THEN RAISE EXCEPTION 'Queue status matched a different dubbing region'; END IF;
END;
$$;

SELECT public.finalize_dubbing_language_constraints();
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='dubbing_projects' AND column_name='language' AND is_nullable='YES') THEN
    RAISE EXCEPTION 'Final language constraint remains nullable';
  END IF;
  BEGIN
    INSERT INTO public.dubbing_projects(content_id,content_type,language) VALUES(-900010,'tv','fr-FR');
    RAISE EXCEPTION 'Final uniqueness was not enforced';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END; $$;
ROLLBACK;

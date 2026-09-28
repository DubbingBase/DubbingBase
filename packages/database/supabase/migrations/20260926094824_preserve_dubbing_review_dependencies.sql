-- Preserve dependency audit identifiers when reviewed votes are deduplicated.
CREATE OR REPLACE FUNCTION public.dubbing_language_review_snapshot(p_project_id bigint)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'project',to_jsonb(p),
    'works',COALESCE((SELECT jsonb_agg(to_jsonb(w) ORDER BY w.id) FROM public.work w WHERE w.dubbing_project_id=p.id),'[]'::jsonb),
    'votes',COALESCE((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.id) FROM public.votes v JOIN public.work w ON w.id=v.work_id WHERE w.dubbing_project_id=p.id),'[]'::jsonb),
    'crew',COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM public.dubbing_project_crew c WHERE c.dubbing_project_id=p.id),'[]'::jsonb),
    'attachments',COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM public.project_attachments a WHERE a.dubbing_project_id=p.id),'[]'::jsonb),
    'audit_logs',COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM public.audit_logs a WHERE
      (a.entity_type IN ('dubbing_project','dubbing_projects') AND a.entity_id=p.id::text)
      OR (a.entity_type IN ('work','works') AND a.entity_id IN (SELECT w.id::text FROM public.work w WHERE w.dubbing_project_id=p.id))
      OR (a.entity_type IN ('vote','votes') AND a.entity_id IN (SELECT v.id::text FROM public.votes v JOIN public.work w ON w.id=v.work_id WHERE w.dubbing_project_id=p.id))
      OR (a.entity_type IN ('dubbing_project_crew') AND a.entity_id IN (SELECT c.id::text FROM public.dubbing_project_crew c WHERE c.dubbing_project_id=p.id))
      OR (a.entity_type IN ('project_attachment','project_attachments') AND a.entity_id IN (SELECT t.id::text FROM public.project_attachments t WHERE t.dubbing_project_id=p.id))),'[]'::jsonb)
  ) FROM public.dubbing_projects p WHERE p.id=p_project_id;
$$;
REVOKE ALL ON FUNCTION public.dubbing_language_review_snapshot(bigint) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.apply_reviewed_dubbing_languages(p_decisions jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  d jsonb;
  src public.dubbing_projects%ROWTYPE;
  dst public.dubbing_projects%ROWTYPE;
  w public.work%ROWTYPE;
  existing_work public.work%ROWTYPE;
  v public.votes%ROWTYPE;
  existing_vote public.votes%ROWTYPE;
  source_snapshot jsonb;
  target_snapshot jsonb;
  choice text;
BEGIN
  IF jsonb_typeof(p_decisions) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Expected an approved decision array';
  END IF;
  LOCK TABLE public.dubbing_projects,public.work,public.votes,public.dubbing_project_crew,
    public.project_attachments,public.audit_logs IN SHARE ROW EXCLUSIVE MODE;
  FOR d IN SELECT value FROM jsonb_array_elements(p_decisions) LOOP
    IF COALESCE(d->>'approved_by','')='' OR COALESCE(d->>'evidence_quote','')=''
      OR COALESCE(d->>'evidence_url','') !~ '^https://' THEN
      RAISE EXCEPTION 'Explicit approval and source evidence are required';
    END IF;
    SELECT * INTO STRICT src FROM public.dubbing_projects WHERE id=(d->>'project_id')::bigint;
    IF NOT EXISTS (SELECT 1 FROM public.dubbing_languages WHERE code=d->>'target_language') THEN
      RAISE EXCEPTION 'Regional code is not in the approved registry';
    END IF;
    source_snapshot := public.dubbing_language_review_snapshot(src.id);
    IF md5(source_snapshot::text) IS DISTINCT FROM d->>'expected_snapshot_hash' THEN
      RAISE EXCEPTION 'Project % changed since review; regenerate its audit',src.id;
    END IF;
    target_snapshot := NULL;
    IF d->>'survivor_id' IS NOT NULL THEN
      SELECT * INTO STRICT dst FROM public.dubbing_projects WHERE id=(d->>'survivor_id')::bigint;
      IF src.id=dst.id OR src.content_id IS DISTINCT FROM dst.content_id
        OR src.content_type IS DISTINCT FROM dst.content_type
        OR dst.language IS DISTINCT FROM d->>'target_language' THEN
        RAISE EXCEPTION 'Merge must target an existing project for the same media and approved region';
      END IF;
      target_snapshot := public.dubbing_language_review_snapshot(dst.id);
      IF md5(target_snapshot::text) IS DISTINCT FROM d->>'expected_target_snapshot_hash' THEN
        RAISE EXCEPTION 'Survivor % changed since review; regenerate its audit',dst.id;
      END IF;
      -- Project-level conflicts must also be explicitly approved.
      IF src.studio_id IS NOT NULL AND src.studio_id IS DISTINCT FROM dst.studio_id
        AND COALESCE(d->>'keep_project_metadata','') NOT IN ('source','survivor') THEN
        RAISE EXCEPTION 'Studio conflict requires keep_project_metadata';
      END IF;
      IF src.status IS DISTINCT FROM dst.status
        AND COALESCE(d->>'keep_project_metadata','') NOT IN ('source','survivor') THEN
        RAISE EXCEPTION 'Project status conflict requires keep_project_metadata';
      END IF;
      IF d->>'keep_project_metadata'='source' THEN
        UPDATE public.dubbing_projects SET studio_id=src.studio_id,status=src.status WHERE id=dst.id;
      END IF;
      FOR w IN SELECT * FROM public.work WHERE dubbing_project_id=src.id ORDER BY id LOOP
        SELECT * INTO existing_work FROM public.work WHERE dubbing_project_id=dst.id
          AND actor_id IS NOT DISTINCT FROM w.actor_id
          AND character_id IS NOT DISTINCT FROM w.character_id
          AND voice_actor_id IS NOT DISTINCT FROM w.voice_actor_id ORDER BY id LIMIT 1;
        IF NOT FOUND THEN
          UPDATE public.work SET dubbing_project_id=dst.id WHERE id=w.id;
          CONTINUE;
        END IF;
        choice := NULL;
        IF (to_jsonb(w)-ARRAY['id','dubbing_project_id','created_at','updated_at','created_by','updated_by'])
          IS DISTINCT FROM (to_jsonb(existing_work)-ARRAY['id','dubbing_project_id','created_at','updated_at','created_by','updated_by']) THEN
          SELECT entry->>'keep' INTO choice FROM jsonb_array_elements(COALESCE(d->'work_decisions','[]'::jsonb)) entry
            WHERE (entry->>'source_work_id')::bigint=w.id AND (entry->>'survivor_work_id')::bigint=existing_work.id;
          IF COALESCE(choice,'') NOT IN ('source','survivor') THEN
            RAISE EXCEPTION 'Conflicting work % / % requires an explicit decision',w.id,existing_work.id;
          END IF;
          IF choice='source' THEN
            UPDATE public.work SET highlight=w.highlight,suggestions=w.suggestions,status=w.status,
              source_id=w.source_id,performance=w.performance,reviewed_status=w.reviewed_status,
              character_name=w.character_name,note=w.note,created_at=w.created_at,created_by=w.created_by,
              updated_at=w.updated_at,updated_by=w.updated_by WHERE id=existing_work.id;
          END IF;
        END IF;
        FOR v IN SELECT * FROM public.votes WHERE work_id=w.id ORDER BY id LOOP
          SELECT * INTO existing_vote FROM public.votes WHERE work_id=existing_work.id AND user_id IS NOT DISTINCT FROM v.user_id ORDER BY id LIMIT 1;
          IF NOT FOUND THEN
            UPDATE public.votes SET work_id=existing_work.id WHERE id=v.id;
          ELSE
            IF existing_vote.vote_type IS DISTINCT FROM v.vote_type THEN
              SELECT entry->>'keep' INTO choice FROM jsonb_array_elements(COALESCE(d->'vote_decisions','[]'::jsonb)) entry
                WHERE (entry->>'source_vote_id')::bigint=v.id AND (entry->>'survivor_vote_id')::bigint=existing_vote.id;
              IF COALESCE(choice,'') NOT IN ('source','survivor') THEN
                RAISE EXCEPTION 'Conflicting votes % / % require an explicit decision',v.id,existing_vote.id;
              END IF;
              IF choice='source' THEN
                UPDATE public.votes SET vote_type=v.vote_type,created_at=v.created_at WHERE id=existing_vote.id;
              END IF;
            END IF;
            UPDATE public.audit_logs SET entity_id=existing_vote.id::text
              WHERE entity_type IN ('vote','votes') AND entity_id=v.id::text;
            DELETE FROM public.votes WHERE id=v.id;
          END IF;
        END LOOP;
        UPDATE public.audit_logs SET entity_id=existing_work.id::text WHERE entity_type IN ('work','works') AND entity_id=w.id::text;
        DELETE FROM public.work WHERE id=w.id;
      END LOOP;
      UPDATE public.dubbing_project_crew SET dubbing_project_id=dst.id WHERE dubbing_project_id=src.id;
      UPDATE public.project_attachments SET dubbing_project_id=dst.id WHERE dubbing_project_id=src.id;
      UPDATE public.audit_logs SET entity_id=dst.id::text WHERE entity_type IN ('dubbing_project','dubbing_projects') AND entity_id=src.id::text;
      DELETE FROM public.dubbing_projects WHERE id=src.id;
    ELSE
      UPDATE public.dubbing_projects SET language=d->>'target_language' WHERE id=src.id;
    END IF;
    INSERT INTO public.dubbing_language_reviews(decision,source_snapshot,target_snapshot)
      VALUES(d,source_snapshot,target_snapshot);
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_reviewed_dubbing_languages(jsonb) FROM PUBLIC,anon,authenticated,service_role;

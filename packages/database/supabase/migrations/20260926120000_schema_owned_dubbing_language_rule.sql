-- This function is the database-owned definition of supported regional dubbing codes.
-- Update it and rebuild the column CHECK in a migration whenever the supported set changes.
CREATE OR REPLACE FUNCTION public.is_valid_dubbing_language(p_language text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT COALESCE(p_language = ANY (ARRAY[
    'fr-FR',
    'fr-CA',
    'fr-BE',
    'en-US',
    'en-GB',
    'ja-JP',
    'ko-KR',
    'es-ES',
    'es-MX',
    'de-DE',
    'it-IT',
    'pt-BR',
    'pt-PT',
    'sq-AL',
    'ar-EG',
    'ca-ES',
    'ceb-PH',
    'hr-HR',
    'cs-CZ',
    'da-DK',
    'nl-NL',
    'el-GR',
    'ha-NG',
    'he-IL',
    'hu-HU',
    'id-ID',
    'la-VA',
    'ms-MY',
    'no-NO',
    'pl-PL',
    'ro-RO',
    'ru-RU',
    'sco-GB',
    'sh-RS',
    'sk-SK',
    'sn-ZW',
    'an-ES',
    'sv-SE',
    'gsw-CH',
    'tl-PH',
    'tr-TR',
    'uk-UA',
    'vi-VN',
    'cy-GB',
    'fy-NL',
    'zh-CN',
    'yue-HK'
  ]::text[]), false);
$$;

CREATE OR REPLACE FUNCTION public.guard_dubbing_project_language() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  -- An unchanged legacy language must not block unrelated edits.
  IF TG_OP = 'UPDATE' AND NEW.language IS NOT DISTINCT FROM OLD.language
    AND NEW.content_id IS NOT DISTINCT FROM OLD.content_id
    AND NEW.content_type IS NOT DISTINCT FROM OLD.content_type THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_valid_dubbing_language(NEW.language) THEN
    RAISE EXCEPTION 'An approved regional dubbing language is required: %', NEW.language
      USING ERRCODE = '23514';
  END IF;
  -- Serialize creation until the final reviewed unique constraint is installed.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    NEW.content_type || ':' || NEW.content_id || ':' || NEW.language, 0));
  IF EXISTS (SELECT 1 FROM public.dubbing_projects p
    WHERE p.content_type = NEW.content_type AND p.content_id = NEW.content_id
      AND p.language = NEW.language AND p.id IS DISTINCT FROM NEW.id) THEN
    RAISE EXCEPTION 'Dubbing project already exists for this media and region'
      USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_dubbing_project_language() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.finalize_dubbing_language_constraints() RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  LOCK TABLE public.dubbing_projects IN ACCESS EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM public.dubbing_projects p
    WHERE p.language IS NULL OR NOT public.is_valid_dubbing_language(p.language)) THEN
    RAISE EXCEPTION 'Unresolved dubbing regions remain; review their source evidence first';
  END IF;
  IF EXISTS (SELECT 1 FROM public.dubbing_projects
    GROUP BY content_id,content_type,language HAVING count(*)>1) THEN
    RAISE EXCEPTION 'Unresolved dubbing project collisions remain';
  END IF;
  ALTER TABLE public.dubbing_projects ALTER COLUMN language SET NOT NULL;
  ALTER TABLE public.dubbing_projects DROP CONSTRAINT IF EXISTS dubbing_projects_language_fkey;
  ALTER TABLE public.dubbing_projects ADD CONSTRAINT dubbing_projects_language_check
    CHECK (public.is_valid_dubbing_language(language));
  ALTER TABLE public.dubbing_projects ADD CONSTRAINT dubbing_projects_media_region_key
    UNIQUE (content_id,content_type,language);
  DROP TRIGGER dubbing_project_regional_language_guard ON public.dubbing_projects;
  DROP TABLE public.dubbing_languages;
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_dubbing_language_constraints() FROM PUBLIC, anon, authenticated, service_role;

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
    IF NOT public.is_valid_dubbing_language(d->>'target_language') THEN
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

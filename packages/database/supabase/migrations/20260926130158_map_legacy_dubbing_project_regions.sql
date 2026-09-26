-- Apply the user-approved base-region rule to existing language-only projects.
-- CLDR likely subtags provide conventional defaults; this migration adopts them
-- as product policy at the user's direction, not as proof of each recording's market.
-- Wikimedia's special codes are normalized below: simple -> en, als -> gsw,
-- while sh is retained and regionalized as sh-RS.

INSERT INTO public.dubbing_languages(code) VALUES
  ('ar-EG'), ('an-ES'), ('ca-ES'), ('ceb-PH'), ('cs-CZ'), ('cy-GB'), ('ko-KR'),
  ('da-DK'), ('el-GR'), ('fy-NL'), ('gsw-CH'), ('ha-NG'), ('he-IL'),
  ('hr-HR'), ('hu-HU'), ('id-ID'), ('la-VA'), ('ms-MY'), ('nl-NL'),
  ('no-NO'), ('pl-PL'), ('ro-RO'), ('ru-RU'), ('sco-GB'), ('sh-RS'),
  ('sk-SK'), ('sn-ZW'), ('sv-SE'), ('tl-PH'), ('tr-TR'), ('uk-UA'),
  ('vi-VN'), ('zh-CN')
ON CONFLICT (code) DO NOTHING;

DO $$
DECLARE
  mapping record;
  project_id bigint;
  source_project public.dubbing_projects%ROWTYPE;
  target_project public.dubbing_projects%ROWTYPE;
  source_snapshot jsonb;
  target_snapshot jsonb;
  work_decisions jsonb;
  vote_decisions jsonb;
  decision jsonb;
  has_target boolean;
BEGIN
  FOR mapping IN
    SELECT * FROM (VALUES
      ('fr', 'fr-FR'), ('en', 'en-US'), ('es', 'es-ES'), ('pt', 'pt-BR'),
      ('de', 'de-DE'), ('ja', 'ja-JP'), ('it', 'it-IT'),
      ('pl', 'pl-PL'), ('zh', 'zh-CN'), ('uk', 'uk-UA'),
      ('ceb', 'ceb-PH'), ('ko', 'ko-KR'), ('nl', 'nl-NL'),
      ('sv', 'sv-SE'), ('cs', 'cs-CZ'), ('vi', 'vi-VN'),
      ('no', 'no-NO'), ('da', 'da-DK'), ('el', 'el-GR'),
      ('ro', 'ro-RO'), ('tr', 'tr-TR'), ('cy', 'cy-GB'),
      ('hu', 'hu-HU'), ('sh', 'sh-RS'), ('fy', 'fy-NL'),
      ('id', 'id-ID'), ('he', 'he-IL'), ('la', 'la-VA'),
      ('ru', 'ru-RU'), ('hr', 'hr-HR'), ('ha', 'ha-NG'),
      ('als', 'gsw-CH'), ('an', 'an-ES'), ('ca', 'ca-ES'),
      ('ar', 'ar-EG'), ('ms', 'ms-MY'), ('sn', 'sn-ZW'),
      ('tl', 'tl-PH'), ('sk', 'sk-SK'), ('sco', 'sco-GB'),
      ('simple', 'en-US')
    ) AS languages(legacy_code, regional_code)
  LOOP
    FOR project_id IN
      SELECT p.id
      FROM public.dubbing_projects p
      WHERE p.language = mapping.legacy_code
      ORDER BY p.content_type, p.content_id, p.id
    LOOP
      SELECT * INTO source_project
      FROM public.dubbing_projects
      WHERE id = project_id;
      IF NOT FOUND THEN
        CONTINUE;
      END IF;

      source_snapshot := public.dubbing_language_review_snapshot(source_project.id);
      SELECT * INTO target_project
      FROM public.dubbing_projects p
      WHERE p.content_type = source_project.content_type
        AND p.content_id = source_project.content_id
        AND p.language = mapping.regional_code
      AND p.id <> source_project.id
      ORDER BY p.id
      LIMIT 1;
      has_target := FOUND;

      decision := jsonb_build_object(
        'project_id', source_project.id,
        'target_language', mapping.regional_code,
        'approved_by', 'User-approved base-region rule, 2026-09-26',
        'evidence_url', CASE
          WHEN mapping.legacy_code IN ('als', 'sh', 'simple')
            THEN 'https://meta.wikimedia.org/wiki/Special_language_codes'
          ELSE 'https://unicode.org/cldr/charts/45/supplemental/likely_subtags.html'
        END,
        'evidence_quote', format(
          'User-directed rule: map legacy %s to its base regional code %s; keep the existing regional project when merging.',
          mapping.legacy_code, mapping.regional_code
        ),
        'expected_snapshot_hash', md5(source_snapshot::text),
        'work_decisions', '[]'::jsonb,
        'vote_decisions', '[]'::jsonb
      );

      IF has_target THEN
        target_snapshot := public.dubbing_language_review_snapshot(target_project.id);
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'source_work_id', source_work.id,
          'survivor_work_id', regional_work.id,
          'keep', 'survivor'
        )), '[]'::jsonb) INTO work_decisions
        FROM public.work source_work
        JOIN public.work regional_work
          ON regional_work.dubbing_project_id = target_project.id
          AND regional_work.actor_id IS NOT DISTINCT FROM source_work.actor_id
          AND regional_work.character_id IS NOT DISTINCT FROM source_work.character_id
          AND regional_work.voice_actor_id IS NOT DISTINCT FROM source_work.voice_actor_id
        WHERE source_work.dubbing_project_id = source_project.id;

        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'source_vote_id', source_vote.id,
          'survivor_vote_id', regional_vote.id,
          'keep', 'survivor'
        )), '[]'::jsonb) INTO vote_decisions
        FROM public.votes source_vote
        JOIN public.work source_work ON source_work.id = source_vote.work_id
        JOIN public.work regional_work
          ON regional_work.dubbing_project_id = target_project.id
          AND regional_work.actor_id IS NOT DISTINCT FROM source_work.actor_id
          AND regional_work.character_id IS NOT DISTINCT FROM source_work.character_id
          AND regional_work.voice_actor_id IS NOT DISTINCT FROM source_work.voice_actor_id
        JOIN public.votes regional_vote
          ON regional_vote.work_id = regional_work.id
          AND regional_vote.user_id IS NOT DISTINCT FROM source_vote.user_id
        WHERE source_work.dubbing_project_id = source_project.id;

        decision := decision || jsonb_build_object(
          'survivor_id', target_project.id,
          'expected_target_snapshot_hash', md5(target_snapshot::text),
          'keep_project_metadata', 'survivor',
          'work_decisions', work_decisions,
          'vote_decisions', vote_decisions
        );
      END IF;

      PERFORM public.apply_reviewed_dubbing_languages(jsonb_build_array(decision));
    END LOOP;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.dubbing_projects p
    WHERE p.language IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.dubbing_languages l WHERE l.code = p.language)
  ) THEN
    RAISE EXCEPTION 'Unmapped legacy dubbing languages remain; refusing to finalize';
  END IF;

  -- Installs NOT NULL, registry FK, and one project per media and region.
  PERFORM public.finalize_dubbing_language_constraints();
END;
$$;

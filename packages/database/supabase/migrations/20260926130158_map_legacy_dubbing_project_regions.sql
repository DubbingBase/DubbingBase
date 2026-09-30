-- Convert legacy project language identifiers to regional dubbing codes.
-- Historical mappings are product policy; they do not validate future codes.

-- This migration runs under deployment transaction control. The guard only
-- serialized ordinary writes while final uniqueness was not yet installed;
-- its per-row advisory locks are unnecessary for this controlled migration.
DROP TRIGGER dubbing_project_regional_language_guard
ON public.dubbing_projects;

CREATE TEMP TABLE legacy_dubbing_language_mapping (
  legacy_code text PRIMARY KEY,
  regional_code text NOT NULL
) ON COMMIT DROP;

INSERT INTO pg_temp.legacy_dubbing_language_mapping(legacy_code, regional_code) VALUES
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
  ('sq', 'sq-AL'), ('simple', 'en-US'), ('zh-yue', 'yue-HK');

-- The already-deployed project FK and merge RPC still require these targets.
-- This temporary population disappears when the registry is dropped below.
INSERT INTO public.dubbing_languages(code)
SELECT DISTINCT regional_code
FROM pg_temp.legacy_dubbing_language_mapping
ON CONFLICT (code) DO NOTHING;

-- Capture groups that would map to the same media+region. Prefer an existing
-- regional project, then prefer legacy en over simple for the en-US collision,
-- then use a stable language/id order for any other legacy-only collision.
CREATE TEMP TABLE legacy_dubbing_project_collisions ON COMMIT DROP AS
WITH candidates AS (
  SELECT
    p.id,
    p.content_id,
    p.content_type,
    p.language AS source_language,
    COALESCE(m.regional_code, p.language) AS regional_language
  FROM public.dubbing_projects p
  LEFT JOIN pg_temp.legacy_dubbing_language_mapping m
    ON m.legacy_code = p.language
  WHERE m.legacy_code IS NOT NULL
     OR p.language IN (
       SELECT regional_code FROM pg_temp.legacy_dubbing_language_mapping
     )
), ranked AS (
  SELECT
    candidates.*,
    count(*) OVER (
      PARTITION BY content_id, content_type, regional_language
    ) AS group_size,
    row_number() OVER (
      PARTITION BY content_id, content_type, regional_language
      ORDER BY
        CASE
          WHEN source_language = regional_language THEN 0
          WHEN source_language = 'en' AND regional_language = 'en-US' THEN 1
          ELSE 2
        END,
        source_language,
        id
    ) AS survivor_rank
  FROM candidates
)
SELECT
  content_id,
  content_type,
  regional_language,
  id AS survivor_project_id,
  source_language AS survivor_original_language
FROM ranked
WHERE group_size > 1
  AND survivor_rank = 1;

ALTER TABLE pg_temp.legacy_dubbing_project_collisions
  ADD PRIMARY KEY (content_id, content_type, regional_language);
ALTER TABLE pg_temp.legacy_dubbing_project_collisions
  ADD COLUMN survivor_original_snapshot jsonb;

-- A legacy survivor in an en+simple group is regionalized before merging.
-- Retain its pre-update state only for those actual collision groups.
UPDATE pg_temp.legacy_dubbing_project_collisions collision
SET survivor_original_snapshot =
  public.dubbing_language_review_snapshot(collision.survivor_project_id)
WHERE collision.survivor_original_language IS DISTINCT FROM collision.regional_language;

-- Simple renames are one set-based UPDATE. Collision members stay untouched
-- until their survivor has been selected and their dependencies can be merged.
UPDATE public.dubbing_projects p
SET language = mapping.regional_code
FROM pg_temp.legacy_dubbing_language_mapping mapping
WHERE p.language = mapping.legacy_code
  AND NOT EXISTS (
    SELECT 1
    FROM pg_temp.legacy_dubbing_project_collisions collision
    WHERE collision.content_id = p.content_id
      AND collision.content_type = p.content_type
      AND collision.regional_language = mapping.regional_code
  );

-- Regionalize selected legacy survivors in one update before invoking the
-- existing dependency-preserving merge RPC for collision sources.
UPDATE public.dubbing_projects p
SET language = collision.regional_language
FROM pg_temp.legacy_dubbing_project_collisions collision
WHERE p.id = collision.survivor_project_id
  AND p.language IS DISTINCT FROM collision.regional_language;

DO $$
DECLARE
  collision record;
  target_project public.dubbing_projects%ROWTYPE;
  source_project public.dubbing_projects%ROWTYPE;
  source_snapshot jsonb;
  target_snapshot jsonb;
  work_decisions jsonb;
  vote_decisions jsonb;
  decision jsonb;
BEGIN
  FOR collision IN
    SELECT *
    FROM pg_temp.legacy_dubbing_project_collisions
    ORDER BY content_type, content_id, regional_language
  LOOP
    SELECT * INTO STRICT target_project
    FROM public.dubbing_projects
    WHERE id = collision.survivor_project_id;

    FOR source_project IN
      SELECT p.*
      FROM public.dubbing_projects p
      LEFT JOIN pg_temp.legacy_dubbing_language_mapping mapping
        ON mapping.legacy_code = p.language
      WHERE p.content_id = collision.content_id
        AND p.content_type = collision.content_type
        AND p.id <> collision.survivor_project_id
        AND COALESCE(mapping.regional_code, p.language) = collision.regional_language
      ORDER BY p.language, p.id
    LOOP
      source_snapshot := public.dubbing_language_review_snapshot(source_project.id);
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

      decision := jsonb_build_object(
        'project_id', source_project.id,
        'target_language', collision.regional_language,
        'approved_by', 'User-approved base-region rule, 2026-09-26',
        'evidence_url', CASE
          WHEN source_project.language IN ('als', 'sh', 'simple', 'zh-yue')
            THEN 'https://meta.wikimedia.org/wiki/Special_language_codes'
          ELSE 'https://unicode.org/cldr/charts/45/supplemental/likely_subtags.html'
        END,
        'evidence_quote', format(
          'User-directed rule: map legacy %s to %s and preserve the selected collision survivor.',
          source_project.language, collision.regional_language
        ),
        'expected_snapshot_hash', md5(source_snapshot::text),
        'survivor_id', target_project.id,
        'expected_target_snapshot_hash', md5(target_snapshot::text),
        'keep_project_metadata', 'survivor',
        'work_decisions', work_decisions,
        'vote_decisions', vote_decisions
      );

      IF collision.survivor_original_language IS DISTINCT FROM collision.regional_language THEN
        decision := decision || jsonb_build_object(
          'survivor_original_language', collision.survivor_original_language,
          'survivor_original_snapshot', collision.survivor_original_snapshot
        );
      END IF;

      PERFORM public.apply_reviewed_dubbing_languages(jsonb_build_array(decision));
    END LOOP;
  END LOOP;

  LOCK TABLE public.dubbing_projects IN ACCESS EXCLUSIVE MODE;

  IF EXISTS (
    SELECT 1 FROM public.dubbing_projects p
    WHERE p.language IS NULL
       OR p.language !~ '^[a-z]{2,3}-[A-Z]{2}$'
  ) THEN
    RAISE EXCEPTION 'Unmapped legacy dubbing languages remain; refusing to finalize';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.dubbing_projects
    GROUP BY content_id, content_type, language HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unresolved dubbing project collisions remain; refusing to finalize';
  END IF;

  ALTER TABLE public.dubbing_projects ALTER COLUMN language SET NOT NULL;
  ALTER TABLE public.dubbing_projects DROP CONSTRAINT IF EXISTS dubbing_projects_language_fkey;
  ALTER TABLE public.dubbing_projects ADD CONSTRAINT dubbing_projects_language_check
    CHECK (language ~ '^[a-z]{2,3}-[A-Z]{2}$');
  ALTER TABLE public.dubbing_projects ADD CONSTRAINT dubbing_projects_media_region_key
    UNIQUE (content_id, content_type, language);

  DROP TABLE public.dubbing_languages;
  DROP FUNCTION public.apply_reviewed_dubbing_languages(jsonb);
  DROP FUNCTION public.dubbing_language_review_snapshot(bigint);
  DROP FUNCTION public.finalize_dubbing_language_constraints();
  DROP FUNCTION public.guard_dubbing_project_language();
END;
$$;

DROP TABLE pg_temp.legacy_dubbing_project_collisions;
DROP TABLE pg_temp.legacy_dubbing_language_mapping;

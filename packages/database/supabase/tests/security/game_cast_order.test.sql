CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;
SELECT plan(37);

-- Grants and RLS --------------------------------------------------------------------------------
SELECT ok(
  NOT has_function_privilege('anon', 'public.set_game_cast_order(uuid, bigint, uuid[], bigint, text)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.set_game_cast_order(uuid, bigint, uuid[], bigint, text)', 'EXECUTE')
    AND has_function_privilege('service_role', 'public.set_game_cast_order(uuid, bigint, uuid[], bigint, text)', 'EXECUTE'),
  'the cast order write is service-role only'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'private.write_game_cast_order(uuid, bigint, uuid[], bigint, text)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'private.place_game_cast_characters(uuid, bigint, jsonb, bigint)', 'EXECUTE'),
  'the order helpers are not callable by clients'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.game_cast_order_entries', 'INSERT')
    AND NOT has_table_privilege('authenticated', 'public.game_cast_order_entries', 'UPDATE')
    AND NOT has_table_privilege('service_role', 'public.game_cast_order_entries', 'DELETE')
    AND NOT has_table_privilege('authenticated', 'public.game_cast_orders', 'UPDATE')
    AND has_table_privilege('anon', 'public.game_cast_order_entries', 'SELECT')
    AND has_table_privilege('anon', 'public.game_cast_orders', 'SELECT'),
  'cast orders are public to read and never directly writable'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.game_cast_order_entries'::regclass)
    AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.game_cast_orders'::regclass),
  'row level security is on for both tables'
);

-- Fixtures: one game in two languages, another game, a movie, an admin, a contributor, a blocked admin.
INSERT INTO auth.users (id, raw_app_meta_data, raw_user_meta_data, email_confirmed_at) VALUES
  ('d1111111-1111-4111-8111-111111111111', '{"role":"admin"}', '{}', now()),
  ('d2222222-2222-4222-8222-222222222222', '{}', '{}', now()),
  ('d3333333-3333-4333-8333-333333333333', '{"role":"admin","blocked":"true"}', '{}', now());
INSERT INTO public.media (kind, content_id) VALUES ('video_game', 881001), ('video_game', 881009), ('movie', 881002);
INSERT INTO public.voice_actors (id, firstname, lastname) OVERRIDING SYSTEM VALUE VALUES
  (881101, 'Rank', 'One'), (881102, 'Rank', 'Two'), (881103, 'Rank', 'Three');
INSERT INTO public.dubbing_projects (id, media_id, language) OVERRIDING SYSTEM VALUE
SELECT 881201, id, 'fr-FR' FROM public.media WHERE kind = 'video_game' AND content_id = 881001;
INSERT INTO public.dubbing_projects (id, media_id, language) OVERRIDING SYSTEM VALUE
SELECT 881202, id, 'en-US' FROM public.media WHERE kind = 'video_game' AND content_id = 881001;
INSERT INTO public.dubbing_projects (id, media_id, language) OVERRIDING SYSTEM VALUE
SELECT 881203, id, 'fr-FR' FROM public.media WHERE kind = 'movie' AND content_id = 881002;
INSERT INTO public.game_characters (id, media_id, name, created_by, updated_by)
SELECT character.id::UUID, media.id, character.name,
  'd1111111-1111-4111-8111-111111111111', 'd1111111-1111-4111-8111-111111111111'
FROM public.media AS media,
  (VALUES ('e8810001-0000-4000-8000-000000000001', 'Peter Parker'),
          ('e8810001-0000-4000-8000-000000000002', 'Aunt May'),
          ('e8810001-0000-4000-8000-000000000003', 'Martin Li'),
          ('e8810001-0000-4000-8000-000000000004', 'Miles Morales')) AS character(id, name)
WHERE media.kind = 'video_game' AND media.content_id = 881001;
INSERT INTO public.game_characters (id, media_id, name, created_by, updated_by)
SELECT 'e8810009-0000-4000-8000-000000000001', id, 'Other game hero',
  'd1111111-1111-4111-8111-111111111111', 'd1111111-1111-4111-8111-111111111111'
FROM public.media WHERE kind = 'video_game' AND content_id = 881009;
INSERT INTO public.work (
  id, dubbing_project_id, voice_actor_id, character_name, game_character_id, actor_id, highlight, reviewed_status
) OVERRIDING SYSTEM VALUE VALUES
  (881301, 881201, 881101, 'Peter Parker', 'e8810001-0000-4000-8000-000000000001', NULL, TRUE, 'waiting'),
  (881302, 881202, 881101, 'Peter Parker', 'e8810001-0000-4000-8000-000000000001', NULL, FALSE, 'waiting'),
  (881303, 881201, 881102, 'Aunt May', 'e8810001-0000-4000-8000-000000000002', NULL, TRUE, 'accepted'),
  (881304, 881201, 881103, 'Martin Li', 'e8810001-0000-4000-8000-000000000003', NULL, FALSE, 'waiting'),
  -- Legacy credit: no game character, so it cannot be ranked.
  (881305, 881202, 881102, 'Mary Jane', NULL, 7001, FALSE, 'waiting'),
  (881306, 881203, 881101, 'Hero', NULL, 42, TRUE, 'waiting');

CREATE TEMP TABLE before_credits AS
SELECT pg_catalog.to_jsonb(work) AS row FROM public.work AS work WHERE work.id BETWEEN 881301 AND 881306;
GRANT SELECT ON before_credits TO service_role;

SET LOCAL ROLE service_role;

-- Whole-list writes -----------------------------------------------------------------------------
SELECT is(
  public.set_game_cast_order('d1111111-1111-4111-8111-111111111111', 881001,
    ARRAY['e8810001-0000-4000-8000-000000000002', 'e8810001-0000-4000-8000-000000000003']::UUID[],
    0, 'website') -> 'version',
  '1'::JSONB,
  'the first write of a game order creates version 1'
);
SELECT results_eq(
  $$SELECT character.name::TEXT, entry.position FROM public.game_cast_order_entries AS entry
    JOIN public.game_characters AS character ON character.id = entry.game_character_id
    ORDER BY entry.position$$,
  $$VALUES ('Aunt May'::TEXT, 1), ('Martin Li'::TEXT, 2)$$,
  'the order is stored at positions 1..n'
);
SELECT throws_ok(
  $$SELECT public.set_game_cast_order('d1111111-1111-4111-8111-111111111111', 881001,
    ARRAY['e8810001-0000-4000-8000-000000000003']::UUID[], 0, 'website')$$,
  'PT412', NULL,
  'a write based on an old version is refused'
);
SELECT is(
  public.set_game_cast_order('d1111111-1111-4111-8111-111111111111', 881001,
    ARRAY['e8810001-0000-4000-8000-000000000002', 'e8810001-0000-4000-8000-000000000003']::UUID[],
    0, 'website') -> 'version',
  '1'::JSONB,
  'writing the order it already has succeeds as a no-op, even from an old version'
);
SELECT is(
  (SELECT count(*) FROM public.audit_logs WHERE entity_type = 'game_cast_order'),
  1::BIGINT,
  'only the real change is audited'
);
SELECT throws_ok(
  $$SELECT public.set_game_cast_order('d1111111-1111-4111-8111-111111111111', 881001,
    ARRAY['e8810001-0000-4000-8000-000000000002', 'e8810001-0000-4000-8000-000000000002']::UUID[], 1, 'website')$$,
  '22023', NULL,
  'a character cannot appear twice'
);
SELECT throws_ok(
  $$SELECT public.set_game_cast_order('d1111111-1111-4111-8111-111111111111', 881001,
    ARRAY['e8810009-0000-4000-8000-000000000001']::UUID[], 1, 'website')$$,
  '23503', NULL,
  'a character of another game is refused'
);
SELECT throws_ok(
  $$SELECT public.set_game_cast_order('d1111111-1111-4111-8111-111111111111', 881002,
    ARRAY[]::UUID[], 0, 'website')$$,
  'P0002', NULL,
  'a movie has no cast order'
);
SELECT throws_ok(
  $$SELECT public.set_game_cast_order('d2222222-2222-4222-8222-222222222222', 881001,
    ARRAY[]::UUID[], 1, 'api')$$,
  '42501', NULL,
  'a contributor cannot order a cast'
);
SELECT throws_ok(
  $$SELECT public.set_game_cast_order('d3333333-3333-4333-8333-333333333333', 881001,
    ARRAY[]::UUID[], 1, 'api')$$,
  '42501', NULL,
  'a blocked admin cannot order a cast'
);

-- Credit placements -----------------------------------------------------------------------------
SELECT is(
  (SELECT pg_catalog.jsonb_agg(entry.value ->> 'name' ORDER BY (entry.value ->> 'position')::INT)
   FROM pg_catalog.jsonb_array_elements(
     public.api_mutate_credits('d1111111-1111-4111-8111-111111111111', 'update', pg_catalog.jsonb_build_array(
       pg_catalog.jsonb_build_object('work_id', 881301,
         'expected_updated_at', (SELECT updated_at FROM public.work WHERE id = 881301),
         'cast_rank', 1, 'cast_order_version', 1)
     )) -> 0 -> 'cast_order' -> 'characters') AS entry(value)),
  '["Peter Parker", "Aunt May", "Martin Li"]'::JSONB,
  'ranking a credit inserts its character and shifts the others'
);
SELECT is(
  (SELECT count(*) FROM public.audit_logs WHERE entity_type = 'work' AND entity_id = '881301'),
  0::BIGINT,
  'a rank-only change does not rewrite the credit'
);
SELECT throws_ok(
  $$SELECT public.api_mutate_credits('d1111111-1111-4111-8111-111111111111', 'update', pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('work_id', 881304,
      'expected_updated_at', (SELECT updated_at FROM public.work WHERE id = 881304),
      'cast_rank', 1, 'cast_order_version', 1)))$$,
  'PT412', NULL,
  'a placement based on an old order version is refused'
);
SELECT throws_ok(
  $$SELECT public.api_mutate_credits('d1111111-1111-4111-8111-111111111111', 'update', pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('work_id', 881304,
      'expected_updated_at', (SELECT updated_at FROM public.work WHERE id = 881304), 'cast_rank', 1)))$$,
  '22023', NULL,
  'a placement without the order version is refused'
);
SELECT throws_ok(
  $$SELECT public.api_mutate_credits('d1111111-1111-4111-8111-111111111111', 'update', pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('work_id', 881305,
      'expected_updated_at', (SELECT updated_at FROM public.work WHERE id = 881305),
      'cast_rank', 1, 'cast_order_version', 2)))$$,
  '22023', NULL,
  'a credit without a game character is never linked by guess'
);
SELECT is(
  (SELECT game_character_id FROM public.work WHERE id = 881305),
  NULL::UUID,
  'the unlinked credit stays unlinked'
);
SELECT throws_ok(
  $$SELECT public.api_mutate_credits('d1111111-1111-4111-8111-111111111111', 'update', pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('work_id', 881304,
      'expected_updated_at', (SELECT updated_at FROM public.work WHERE id = 881304),
      'cast_rank', 5, 'cast_order_version', 2)))$$,
  '22023', NULL,
  'a rank past the end of the order is refused, not moved'
);
SELECT throws_ok(
  $$SELECT public.api_mutate_credits('d1111111-1111-4111-8111-111111111111', 'sync', pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('work_id', 881303,
      'expected_updated_at', (SELECT updated_at FROM public.work WHERE id = 881303),
      'cast_rank', 1, 'cast_order_version', 2),
    pg_catalog.jsonb_build_object('work_id', 881304,
      'expected_updated_at', (SELECT updated_at FROM public.work WHERE id = 881304),
      'cast_rank', 1, 'cast_order_version', 2)))$$,
  '22023', NULL,
  'two characters can never share a rank'
);
SELECT throws_ok(
  $$SELECT public.api_mutate_credits('d1111111-1111-4111-8111-111111111111', 'sync', pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('work_id', 881301,
      'expected_updated_at', (SELECT updated_at FROM public.work WHERE id = 881301),
      'cast_rank', 1, 'cast_order_version', 2),
    pg_catalog.jsonb_build_object('work_id', 881302,
      'expected_updated_at', (SELECT updated_at FROM public.work WHERE id = 881302),
      'cast_rank', 2, 'cast_order_version', 2)))$$,
  '22023', NULL,
  'two credits of one character cannot ask for different ranks'
);
SELECT throws_ok(
  $$SELECT public.api_mutate_credits('d2222222-2222-4222-8222-222222222222', 'update', pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('work_id', 881304,
      'expected_updated_at', (SELECT updated_at FROM public.work WHERE id = 881304),
      'cast_rank', 1, 'cast_order_version', 2)))$$,
  '42501', NULL,
  'a contributor cannot rank through a credit either'
);

-- Several ranks in one request land exactly where asked, whatever their order in the request:
-- order is [Peter, May, Martin]; ask Martin 1, Peter 3 (Peter currently before Martin).
SELECT is(
  (SELECT pg_catalog.jsonb_agg(entry.value ->> 'name' ORDER BY (entry.value ->> 'position')::INT)
   FROM pg_catalog.jsonb_array_elements(
     public.api_mutate_credits('d1111111-1111-4111-8111-111111111111', 'sync', pg_catalog.jsonb_build_array(
       pg_catalog.jsonb_build_object('work_id', 881302,
         'expected_updated_at', (SELECT updated_at FROM public.work WHERE id = 881302),
         'cast_rank', 3, 'cast_order_version', 2),
       pg_catalog.jsonb_build_object('work_id', 881304,
         'expected_updated_at', (SELECT updated_at FROM public.work WHERE id = 881304),
         'cast_rank', 1, 'cast_order_version', 2),
       -- The same character through its other language, same rank: accepted.
       pg_catalog.jsonb_build_object('work_id', 881301,
         'expected_updated_at', (SELECT updated_at FROM public.work WHERE id = 881301),
         'cast_rank', 3, 'cast_order_version', 2)
     )) -> 0 -> 'cast_order' -> 'characters') AS entry(value)),
  '["Martin Li", "Aunt May", "Peter Parker"]'::JSONB,
  'every ranked character ends at its rank and the others keep their relative order'
);
SELECT is(
  (SELECT (r.value -> 'after' ->> 'cast_rank')::INT FROM pg_catalog.jsonb_array_elements(
     public.api_mutate_credits('d1111111-1111-4111-8111-111111111111', 'update', pg_catalog.jsonb_build_array(
       pg_catalog.jsonb_build_object('work_id', 881303,
         'expected_updated_at', (SELECT updated_at FROM public.work WHERE id = 881303), 'highlight', FALSE)
     ))) AS r(value)),
  2,
  'credits report the position of their character'
);
SELECT lives_ok(
  $$SELECT public.api_mutate_credits('d1111111-1111-4111-8111-111111111111', 'create', pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object(
      'voice_actor_id', 881103, 'content_id', 881001, 'content_type', 'video_game', 'language', 'en-US',
      'actor_person_id', NULL, 'game_character_id', 'e8810001-0000-4000-8000-000000000004',
      'character_name', 'Miles Morales', 'performance', 'dialogues', 'highlight', FALSE,
      'cast_rank', 4, 'cast_order_version', 3)))$$,
  'a credit created with a rank places its character at the end'
);
SELECT is(
  (SELECT version FROM public.game_cast_orders AS cast_order
   JOIN public.media AS media ON media.id = cast_order.media_id WHERE media.content_id = 881001),
  4::BIGINT,
  'each change of the order bumps its version once'
);
SELECT lives_ok(
  $$SELECT public.api_mutate_credits('d1111111-1111-4111-8111-111111111111', 'update', pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('work_id', 881304,
      'expected_updated_at', (SELECT updated_at FROM public.work WHERE id = 881304),
      'cast_rank', NULL, 'cast_order_version', 4)))$$,
  'a null rank takes the character out'
);
SELECT results_eq(
  $$SELECT character.name::TEXT, entry.position FROM public.game_cast_order_entries AS entry
    JOIN public.game_characters AS character ON character.id = entry.game_character_id
    JOIN public.media AS media ON media.id = entry.media_id
    WHERE media.content_id = 881001 ORDER BY entry.position$$,
  $$VALUES ('Aunt May'::TEXT, 1), ('Peter Parker'::TEXT, 2), ('Miles Morales'::TEXT, 3)$$,
  'the order closes the gap: positions stay 1..n'
);
SELECT throws_ok(
  $$SELECT public.api_mutate_credits('d1111111-1111-4111-8111-111111111111', 'update', pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('work_id', 881306,
      'expected_updated_at', (SELECT updated_at FROM public.work WHERE id = 881306),
      'cast_rank', 1, 'cast_order_version', 0)))$$,
  '22023', NULL,
  'a movie credit cannot be ranked'
);

-- Database guarantees, even for a direct write by the owner -------------------------------------
RESET ROLE;
SET CONSTRAINTS ALL IMMEDIATE;
SELECT throws_ok(
  $$UPDATE public.game_cast_order_entries SET position = 1 WHERE position = 2$$,
  '23505', NULL,
  'two characters cannot share a position'
);
SELECT throws_ok(
  $$DELETE FROM public.game_cast_order_entries WHERE position = 1$$,
  '23514', NULL,
  'the order cannot have gaps'
);
SELECT throws_ok(
  $$INSERT INTO public.game_cast_order_entries (game_character_id, media_id, position)
    SELECT 'e8810009-0000-4000-8000-000000000001', media_id, 4 FROM public.game_cast_orders LIMIT 1$$,
  '23503', NULL,
  'a character of another game cannot enter the order'
);
-- A character without credits, so only the order holds on to it.
INSERT INTO public.game_characters (id, media_id, name, created_by, updated_by)
SELECT 'e8810001-0000-4000-8000-000000000005', id, 'Uncredited',
  'd1111111-1111-4111-8111-111111111111', 'd1111111-1111-4111-8111-111111111111'
FROM public.media WHERE kind = 'video_game' AND content_id = 881001;
INSERT INTO public.game_cast_order_entries (game_character_id, media_id, position)
SELECT 'e8810001-0000-4000-8000-000000000005', id, 4
FROM public.media WHERE kind = 'video_game' AND content_id = 881001;
SELECT throws_ok(
  $$DELETE FROM public.game_characters WHERE id = 'e8810001-0000-4000-8000-000000000005'$$,
  '23503', NULL,
  'a ranked character cannot be deleted'
);
SET CONSTRAINTS ALL DEFERRED;

SELECT is(
  (SELECT count(*) FROM before_credits AS saved
   JOIN public.work AS work ON work.id = (saved.row ->> 'id')::BIGINT
   WHERE (pg_catalog.to_jsonb(work) - 'updated_at' - 'updated_by' - 'highlight')
       = (saved.row - 'updated_at' - 'updated_by' - 'highlight')),
  6::BIGINT,
  'ranking never changes a credit''s character, cast id or other fields'
);
SELECT is(
  (SELECT count(*) FROM public.game_cast_order_entries AS entry
   JOIN public.media AS media ON media.id = entry.media_id WHERE media.content_id = 881009),
  0::BIGINT,
  'other games are untouched'
);

SELECT * FROM finish();
ROLLBACK;

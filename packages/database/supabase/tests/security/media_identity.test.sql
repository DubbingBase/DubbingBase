CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;
SELECT plan(16);

SELECT ok(
  has_table_privilege('anon', 'public.media', 'SELECT')
    AND has_table_privilege('authenticated', 'public.media', 'SELECT'),
  'media is publicly readable'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.media', 'INSERT')
    AND NOT has_table_privilege('anon', 'public.media', 'UPDATE')
    AND NOT has_table_privilege('authenticated', 'public.media', 'INSERT')
    AND NOT has_table_privilege('authenticated', 'public.media', 'UPDATE')
    AND NOT has_table_privilege('authenticated', 'public.media', 'DELETE'),
  'clients cannot write media'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.media'::regclass),
  'media has row level security enabled'
);
SELECT ok(
  NOT has_function_privilege('anon', 'private.resolve_media(text, bigint)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'private.resolve_media(text, bigint)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'private.create_internal_media(text)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'private.create_internal_media(text)', 'EXECUTE'),
  'clients cannot execute the media creation helpers'
);

-- Provider-backed media: found or created once per (kind, content_id); movie and tv ids do not collide.
SELECT is(
  private.resolve_media('movie', 910550),
  private.resolve_media('movie', 910550),
  'resolving the same provider reference twice returns the same media'
);
SELECT isnt(
  private.resolve_media('movie', 910550),
  private.resolve_media('tv', 910550),
  'the same provider id under another kind is a different media'
);
SELECT lives_ok(
  $$SELECT private.resolve_media('video_game', 910551)$$,
  'a new provider reference creates its media'
);
SELECT is(
  (SELECT content_id FROM public.media WHERE kind = 'video_game' AND content_id = 910551),
  910551::BIGINT,
  'a provider-backed media stores its provider id as content_id'
);

-- DubbingBase-owned media: content_id is media.id and must exist before it can be resolved.
SELECT throws_ok(
  $$SELECT private.resolve_media('toy', 910552)$$,
  '23503',
  NULL,
  'an unknown toy cannot be resolved into existence'
);
SELECT lives_ok(
  $$SELECT private.create_internal_media('toy')$$,
  'a toy can be created internally'
);
SELECT is(
  (SELECT count(*) FROM public.media WHERE kind = 'toy' AND content_id <> id),
  0::BIGINT,
  'every toy has content_id equal to its media id'
);
SELECT throws_ok(
  $$SELECT private.create_internal_media('movie')$$,
  '22023',
  NULL,
  'only toy and advertisement media are created internally'
);
SELECT throws_ok(
  $$INSERT INTO public.media (kind, content_id) VALUES ('toy', 999999999)$$,
  '23514',
  NULL,
  'a toy content_id must equal its media id'
);
SELECT throws_ok(
  $$INSERT INTO public.media (kind, content_id) VALUES ('movie', 0)$$,
  '23514',
  NULL,
  'content_id must be positive'
);
SELECT throws_ok(
  $$INSERT INTO public.media (kind, content_id) VALUES ('album', 1)$$,
  '23514',
  NULL,
  'unknown media kinds are rejected'
);

-- A Wikidata id can belong to only one media.
INSERT INTO public.media (kind, content_id, wikidata_qid) VALUES ('movie', 910553, 'Q910553');
SELECT throws_ok(
  $$INSERT INTO public.media (kind, content_id, wikidata_qid) VALUES ('movie', 910554, 'Q910553')$$,
  '23505',
  NULL,
  'a Wikidata id cannot be attached to two media'
);

SELECT * FROM finish();
ROLLBACK;

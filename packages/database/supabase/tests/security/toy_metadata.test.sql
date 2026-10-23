CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;
SELECT plan(22);

SELECT is(
  (
    SELECT count(*)
    FROM (
      SELECT DISTINCT project.content_id
      FROM public.dubbing_projects AS project
      LEFT JOIN public.toy_metadata AS metadata
        ON metadata.content_id = project.content_id
      WHERE project.content_type = 'toy'
        AND project.content_id <> 0
        AND metadata.content_id IS NULL
    ) AS missing_metadata
  ),
  0::BIGINT,
  'every existing non-zero toy project has persisted metadata'
);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data
) VALUES
  (
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'authenticated',
    'authenticated',
    'toy-metadata-admin@example.test',
    '',
    '{"role":"admin"}'::JSONB,
    '{}'::JSONB
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
    'authenticated',
    'authenticated',
    'toy-metadata-user@example.test',
    '',
    '{"role":"user"}'::JSONB,
    '{}'::JSONB
  );

INSERT INTO public.dubbing_projects (content_id, content_type, language, status)
VALUES (910001, 'toy', 'fr-FR', 'validated');

SELECT ok(
  has_table_privilege('service_role', 'public.toy_metadata', 'SELECT'),
  'service role can read persisted toy metadata'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.toy_metadata', 'SELECT'),
  'anonymous role cannot read toy metadata directly'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.toy_metadata', 'SELECT'),
  'authenticated role cannot read toy metadata directly'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.controlled_save_toy_metadata(uuid, uuid, bigint, timestamp with time zone, jsonb)', 'EXECUTE'),
  'anonymous role cannot execute the controlled metadata save'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.controlled_save_toy_metadata(uuid, uuid, bigint, timestamp with time zone, jsonb)', 'EXECUTE'),
  'authenticated role cannot execute the controlled metadata save'
);
SELECT ok(
  has_function_privilege('service_role', 'public.controlled_save_toy_metadata(uuid, uuid, bigint, timestamp with time zone, jsonb)', 'EXECUTE'),
  'service role can execute the controlled metadata save'
);

SET LOCAL ROLE service_role;
SELECT lives_ok(
  $$SELECT public.controlled_save_toy_metadata(
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
    910001,
    NULL,
    '{"name":"Lunii Storyteller","manufacturer":"Lunii","product_line":"My Fabulous Storyteller","release_year":2022,"cover_url":"https://example.test/lunii.jpg","description":"First description"}'::JSONB
  )$$,
  'admin metadata creation succeeds through the controlled function'
);
SELECT is(
  public.controlled_save_toy_metadata(
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
    910001,
    NULL,
    '{"name":"Lunii Storyteller","manufacturer":"Lunii","product_line":"My Fabulous Storyteller","release_year":2022,"cover_url":"https://example.test/lunii.jpg","description":"First description"}'::JSONB
  ) ->> 'replayed',
  'true'::TEXT,
  'retries with the same request id replay the audited save'
);
SELECT is(
  (SELECT name FROM public.toy_metadata WHERE content_id = 910001),
  'Lunii Storyteller'::TEXT,
  'created toy name is persisted'
);
SELECT is(
  (SELECT ARRAY['name', 'manufacturer', 'product_line', 'release_year', 'cover_url', 'description']::TEXT[] <@ changed_fields FROM public.audit_logs WHERE entity_type = 'toy_metadata' AND entity_id = '910001'),
  TRUE,
  'metadata create audit records its editable fields'
);
SELECT lives_ok(
  $$SELECT public.controlled_save_toy_metadata(
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
    910001,
    (SELECT updated_at FROM public.toy_metadata WHERE content_id = 910001),
    '{"name":"Lunii Storyteller 2","manufacturer":"Lunii","product_line":"My Fabulous Storyteller","release_year":2022,"cover_url":"https://example.test/lunii.jpg","description":"Updated description"}'::JSONB
  )$$,
  'admin metadata update succeeds with the current version'
);
SELECT is(
  (SELECT description FROM public.toy_metadata WHERE content_id = 910001),
  'Updated description'::TEXT,
  'metadata update is persisted'
);
SELECT throws_ok(
  $$SELECT public.controlled_save_toy_metadata(
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd3',
    910001,
    (SELECT created_at FROM public.toy_metadata WHERE content_id = 910001),
    '{"name":"Stale name","manufacturer":null,"product_line":null,"release_year":null,"cover_url":null,"description":null}'::JSONB
  )$$,
  '55000',
  NULL,
  'stale metadata versions are rejected'
);
SELECT throws_ok(
  $$SELECT public.controlled_save_toy_metadata(
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd4',
    910001,
    (SELECT updated_at FROM public.toy_metadata WHERE content_id = 910001),
    '{"name":"Not allowed","manufacturer":null,"product_line":null,"release_year":null,"cover_url":null,"description":null}'::JSONB
  )$$,
  '42501',
  NULL,
  'non-admin metadata writes are rejected'
);
SELECT throws_ok(
  $$SELECT public.controlled_save_toy_metadata(
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd5',
    910001,
    (SELECT updated_at FROM public.toy_metadata WHERE content_id = 910001),
    '{"name":"Unsafe URL","manufacturer":null,"product_line":null,"release_year":null,"cover_url":"javascript:alert(1)","description":null}'::JSONB
  )$$,
  '22023',
  NULL,
  'unsafe cover URLs are rejected'
);
SELECT throws_ok(
  $$SELECT public.controlled_save_toy_metadata(
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd6',
    910002,
    NULL,
    '{"name":"Orphan","manufacturer":null,"product_line":null,"release_year":null,"cover_url":null,"description":null}'::JSONB
  )$$,
  '22023',
  NULL,
  'metadata cannot be created for a non-toy project id'
);
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT is(
  (SELECT count(*) FROM public.create_internal_dubbing_project_with_metadata(
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd7',
    'toy',
    'fr-FR',
    'Tonies Audio Player',
    'Tonies',
    'Tonies',
    'Audio stories for children',
    'Toniebox',
    2024,
    'https://example.test/tonies.jpg'
  )),
  1::BIGINT,
  'controlled internal toy creation returns a project result'
);
SELECT is(
  (SELECT name FROM public.toy_metadata WHERE content_id = -1),
  'Tonies Audio Player'::TEXT,
  'controlled internal toy creation persists its name'
);
SELECT is(
  (SELECT product_line FROM public.toy_metadata WHERE content_id = -1),
  'Toniebox'::TEXT,
  'controlled internal toy creation persists product line metadata'
);
SELECT ok(
  (SELECT created.replayed AND created.metadata_updated_at IS NOT NULL
   FROM public.create_internal_dubbing_project_with_metadata(
     'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
     'dddddddd-dddd-4ddd-8ddd-ddddddddddd7',
     'toy',
     'fr-FR',
     'Tonies Audio Player',
     'Tonies',
     'Tonies',
     'Audio stories for children',
     'Toniebox',
     2024,
     'https://example.test/tonies.jpg'
   ) AS created),
  'controlled internal toy creation replays its metadata timestamp'
);
SELECT is(
  (SELECT count(*) FROM public.create_internal_dubbing_project(
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd8',
    'advertisement',
    'fr-FR',
    'Legacy RPC Campaign',
    'Studio',
    NULL,
    NULL
  )),
  1::BIGINT,
  'previous internal media RPC signature remains callable'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;
SELECT plan(20);

SELECT ok(
  NOT has_function_privilege('public', 'public.api_create_dubbing_project(uuid, uuid, bigint, text, text)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.api_create_dubbing_project(uuid, uuid, bigint, text, text)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.api_create_dubbing_project(uuid, uuid, bigint, text, text)', 'EXECUTE')
    AND has_function_privilege('service_role', 'public.api_create_dubbing_project(uuid, uuid, bigint, text, text)', 'EXECUTE'),
  'project create RPC is service-role only'
);
SELECT ok(
  NOT has_function_privilege('public', 'public.api_update_dubbing_project(uuid, uuid, bigint, jsonb)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.api_update_dubbing_project(uuid, uuid, bigint, jsonb)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.api_update_dubbing_project(uuid, uuid, bigint, jsonb)', 'EXECUTE')
    AND has_function_privilege('service_role', 'public.api_update_dubbing_project(uuid, uuid, bigint, jsonb)', 'EXECUTE'),
  'project update RPC is service-role only'
);

INSERT INTO auth.users (id, raw_app_meta_data, raw_user_meta_data)
VALUES (
  'a1111111-1111-4111-8111-111111111111',
  '{"role":"admin"}'::JSONB,
  '{}'::JSONB
);
INSERT INTO public.studios (id, name) OVERRIDING SYSTEM VALUE
VALUES (991100, 'API project test studio');

SET LOCAL ROLE service_role;
SELECT lives_ok(
  $$SELECT * FROM public.api_create_dubbing_project(
    'a1111111-1111-4111-8111-111111111111',
    'a2222222-2222-4222-8222-222222222221',
    991101, 'movie', 'fr-FR'
  )$$,
  'API can create a provider-backed project without a provider lookup'
);
SELECT is(
  (SELECT count(*) FROM public.dubbing_projects AS project
   JOIN public.media AS media ON media.id = project.media_id
   WHERE media.kind = 'movie' AND media.content_id = 991101 AND project.language = 'fr-FR'),
  1::BIGINT,
  'the project creation persists one media and language project'
);
SELECT is(
  (SELECT (created.project_id = project.id AND created.language = project.language)::BOOLEAN
   FROM public.api_create_dubbing_project(
     'a1111111-1111-4111-8111-111111111111',
     'a2222222-2222-4222-8222-222222222221',
     991101, 'movie', 'fr-FR'
   ) AS created
   JOIN public.dubbing_projects AS project ON project.id = created.project_id),
  TRUE,
  'retrying the same request returns its project and language'
);
SELECT is(
  (SELECT replayed FROM public.api_create_dubbing_project(
    'a1111111-1111-4111-8111-111111111111',
    'a2222222-2222-4222-8222-222222222221',
    991101, 'movie', 'fr-FR'
  )),
  TRUE,
  'retrying the same create key is marked replayed'
);
SELECT is(
  (SELECT project_id FROM public.api_create_dubbing_project(
    'a1111111-1111-4111-8111-111111111111',
    'a2222222-2222-4222-8222-222222222222',
    991101, 'movie', 'fr-FR'
  )),
  (SELECT project.id FROM public.dubbing_projects AS project JOIN public.media AS media ON media.id = project.media_id WHERE media.kind = 'movie' AND media.content_id = 991101 AND project.language = 'fr-FR'),
  'a new request for an existing language returns its project'
);

SELECT is(
  public.api_update_dubbing_project(
    'a1111111-1111-4111-8111-111111111111',
    'a3333333-3333-4333-8333-333333333331',
    (SELECT project.id FROM public.dubbing_projects AS project JOIN public.media AS media ON media.id = project.media_id WHERE media.kind = 'movie' AND media.content_id = 991101 AND project.language = 'fr-FR'),
    '{"status":"pending"}'::JSONB
  ) ->> 'status',
  'pending'::TEXT,
  'status-only update changes the status'
);
SELECT is(
  public.api_update_dubbing_project(
    'a1111111-1111-4111-8111-111111111111',
    'a3333333-3333-4333-8333-333333333331',
    (SELECT project.id FROM public.dubbing_projects AS project JOIN public.media AS media ON media.id = project.media_id WHERE media.kind = 'movie' AND media.content_id = 991101 AND project.language = 'fr-FR'),
    '{"status":"pending"}'::JSONB
  ) ->> 'replayed',
  'true'::TEXT,
  'retrying a project update replays its audited result'
);
SELECT is(
  public.api_update_dubbing_project(
    'a1111111-1111-4111-8111-111111111111',
    'a3333333-3333-4333-8333-333333333332',
    (SELECT project.id FROM public.dubbing_projects AS project JOIN public.media AS media ON media.id = project.media_id WHERE media.kind = 'movie' AND media.content_id = 991101 AND project.language = 'fr-FR'),
    '{"studio_id":991100}'::JSONB
  ) ->> 'studio_id',
  '991100'::TEXT,
  'studio-only update changes the studio'
);
SELECT is(
  (SELECT project.status FROM public.dubbing_projects AS project JOIN public.media AS media ON media.id = project.media_id WHERE media.kind = 'movie' AND media.content_id = 991101 AND project.language = 'fr-FR'),
  'pending'::TEXT,
  'studio-only update preserves the status'
);
SELECT is(
  public.api_update_dubbing_project(
    'a1111111-1111-4111-8111-111111111111',
    'a3333333-3333-4333-8333-333333333333',
    (SELECT project.id FROM public.dubbing_projects AS project JOIN public.media AS media ON media.id = project.media_id WHERE media.kind = 'movie' AND media.content_id = 991101 AND project.language = 'fr-FR'),
    '{"status":"validated"}'::JSONB
  ) ->> 'status',
  'validated'::TEXT,
  'a later status update succeeds'
);
SELECT is(
  (SELECT project.studio_id FROM public.dubbing_projects AS project JOIN public.media AS media ON media.id = project.media_id WHERE media.kind = 'movie' AND media.content_id = 991101 AND project.language = 'fr-FR'),
  991100::BIGINT,
  'status-only update preserves the studio'
);
SELECT is(
  (SELECT audit.metadata ->> 'origin' FROM public.audit_logs AS audit
   WHERE audit.user_id = 'a1111111-1111-4111-8111-111111111111'
     AND audit.request_id = 'a3333333-3333-4333-8333-333333333331'),
  'api'::TEXT,
  'project updates are marked as API writes'
);
SELECT is(
  (SELECT audit.changed_fields FROM public.audit_logs AS audit
   WHERE audit.user_id = 'a1111111-1111-4111-8111-111111111111'
     AND audit.request_id = 'a3333333-3333-4333-8333-333333333331'),
  ARRAY['project']::TEXT[],
  'status update audits only the project snapshot'
);
SELECT is(
  public.api_update_dubbing_project(
    'a1111111-1111-4111-8111-111111111111',
    'a3333333-3333-4333-8333-333333333334',
    (SELECT project.id FROM public.dubbing_projects AS project JOIN public.media AS media ON media.id = project.media_id WHERE media.kind = 'movie' AND media.content_id = 991101 AND project.language = 'fr-FR'),
    '{"status":"validated"}'::JSONB
  ) ->> 'changed',
  'false'::TEXT,
  'a no-op update does not report a change'
);
SELECT is(
  (SELECT project.updated_at FROM public.dubbing_projects AS project JOIN public.media AS media ON media.id = project.media_id WHERE media.kind = 'movie' AND media.content_id = 991101 AND project.language = 'fr-FR'),
  (SELECT (audit.new_value -> 'project' ->> 'updated_at')::TIMESTAMP WITHOUT TIME ZONE FROM public.audit_logs AS audit WHERE audit.user_id = 'a1111111-1111-4111-8111-111111111111' AND audit.request_id = 'a3333333-3333-4333-8333-333333333333'),
  'a no-op does not bump updated_at'
);
SELECT throws_ok(
  $$SELECT public.api_update_dubbing_project(
    'a1111111-1111-4111-8111-111111111111',
    'a3333333-3333-4333-8333-333333333331',
    (SELECT project.id FROM public.dubbing_projects AS project JOIN public.media AS media ON media.id = project.media_id WHERE media.kind = 'movie' AND media.content_id = 991101 AND project.language = 'fr-FR'),
    '{"status":"pending"}'::JSONB
  )$$,
  '55000', NULL,
  'an old update key conflicts after a later project change'
);
SELECT throws_ok(
  $$SELECT public.api_update_dubbing_project(
    'a1111111-1111-4111-8111-111111111111',
    'a3333333-3333-4333-8333-333333333335',
    (SELECT project.id FROM public.dubbing_projects AS project JOIN public.media AS media ON media.id = project.media_id WHERE media.kind = 'movie' AND media.content_id = 991101 AND project.language = 'fr-FR'),
    '{"status":"unknown"}'::JSONB
  )$$,
  '22023', NULL,
  'unsupported project statuses are rejected'
);
SELECT throws_ok(
  $$SELECT public.api_update_dubbing_project(
    'a1111111-1111-4111-8111-111111111111',
    'a3333333-3333-4333-8333-333333333336',
    999999999, '{"status":"draft"}'::JSONB
  )$$,
  'P0002', NULL,
  'a missing project cannot be updated'
);

SELECT * FROM finish();
ROLLBACK;

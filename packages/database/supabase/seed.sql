-- Local development reference data only.
-- Production snapshots are stored under packages/database/.local and loaded
-- only by the explicit production reseed workflow.

INSERT INTO public.jobs (id, name) OVERRIDING SYSTEM VALUE
VALUES
  (1, 'Direction Artistique'),
  (2, 'Adaptation'),
  (3, 'Enregistrement'),
  (4, 'Montage'),
  (5, 'Mixage'),
  (6, 'Chargé de projet'),
  (7, 'Creative Supervision')
ON CONFLICT (id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('public.jobs', 'id'),
  COALESCE(MAX(id), 1),
  MAX(id) IS NOT NULL
)
FROM public.jobs;

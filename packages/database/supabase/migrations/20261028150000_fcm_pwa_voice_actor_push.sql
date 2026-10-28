ALTER TABLE public.user_profiles
  ADD COLUMN push_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE public.push_installations (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  installation_id UUID NOT NULL,
  fcm_token TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'fr', 'es', 'ja')),
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (user_id, installation_id),
  CONSTRAINT push_installations_fcm_token_key UNIQUE (fcm_token)
);

CREATE INDEX push_installations_enabled_user_idx
  ON public.push_installations (user_id)
  WHERE enabled;

ALTER TABLE public.push_installations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_installations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.push_installations TO service_role;

COMMENT ON TABLE public.push_installations IS
  'Mobile PWA FCM delivery addresses only. No notification content or delivery history is stored.';

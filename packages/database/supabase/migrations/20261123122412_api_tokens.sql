-- Personal API tokens for the public /api/v1 API.
--
-- Only the SHA-256 hash of a token is stored; the plaintext is shown once at creation. The
-- table is reachable only through the website's server routes (service role): RLS is enabled
-- and no grants or policies exist for anon/authenticated, so browsers can never read hashes.
create table public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  prefix text not null check (char_length(prefix) between 8 and 24),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  scopes text[] not null check (
    cardinality(scopes) > 0
    and scopes <@ array['voice-actors:read', 'voice-actors:write']::text[]
  ),
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index api_tokens_user_id_idx on public.api_tokens (user_id);

alter table public.api_tokens enable row level security;
revoke all on public.api_tokens from anon, authenticated;

comment on table public.api_tokens is
  'Hashed personal API tokens. Service-role only; never exposed to browsers.';

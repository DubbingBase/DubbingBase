-- Public API tokens may also read and write cast credits.
alter table public.api_tokens drop constraint api_tokens_scopes_check;
alter table public.api_tokens add constraint api_tokens_scopes_check check (
  cardinality(scopes) > 0
  and scopes <@ array['voice-actors:read', 'voice-actors:write', 'credits:read', 'credits:write']::text[]
);

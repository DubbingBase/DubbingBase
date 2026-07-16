-- Enable the unaccent extension
CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "public";

-- Create an RPC to robustly match voice actors
CREATE OR REPLACE FUNCTION public.match_voice_actor(p_firstname text, p_lastname text)
RETURNS SETOF public.voice_actors
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.voice_actors
  WHERE unaccent(lower(replace(firstname, '-', ' '))) = unaccent(lower(replace(p_firstname, '-', ' ')))
    AND unaccent(lower(replace(lastname, '-', ' '))) = unaccent(lower(replace(p_lastname, '-', ' ')));
END;
$$;

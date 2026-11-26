-- Variants of one character ("Ciri" / "Ciri (child)", "V (male)" / "V (female)") are voiced by different
-- actors and so need separate game_characters rows, yet they are the same IGDB character and Wikidata item.
-- The per-game unique indexes on those references only prevented duplicates and nothing relies on them:
-- the catalogue merge already handles several local rows linked to one IGDB character. Keep them as plain
-- lookup indexes.
DROP INDEX public.game_characters_igdb_reference_key;
DROP INDEX public.game_characters_wikidata_reference_key;

CREATE INDEX game_characters_igdb_reference_idx
  ON public.game_characters (media_id, igdb_character_id) WHERE igdb_character_id IS NOT NULL;
CREATE INDEX game_characters_wikidata_reference_idx
  ON public.game_characters (media_id, wikidata_qid) WHERE wikidata_qid IS NOT NULL;

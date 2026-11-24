---
"@app/website": minor
"@app/supabase": minor
---

Public API: token scopes are now `resource:read|create|update` for voice actors, credits and characters (a migration converts existing tokens: `credits:write` becomes `credits:create` + `credits:update`, `voice-actors:write` becomes `voice-actors:update`, `credits:read` also grants `characters:read`). New writes, all audited as made through the API: `POST /voice-actors` (409 `duplicate_candidate` on a name matching an existing actor unless a `tmdb_id`, `wikidata_id` or `date_of_birth` proves it is another person), `POST /games/{id}/characters` and `PATCH /games/{id}/characters/{characterId}` (register a character and link it to IGDB or Wikidata, stored as given). The characters listing now includes each character's IGDB and Wikidata links.

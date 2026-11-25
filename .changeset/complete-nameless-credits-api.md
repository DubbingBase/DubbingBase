---
"@app/website": minor
"@app/supabase": minor
---

Let the v1 API complete a credit in place: `PATCH /{type}/{id}/credits/{workId}` now also sets `character_name`, `actor_id` and `game_character_id`, keeping the credit's id, history and review state, and `POST …/credits/batch` refuses to add a credit next to a nameless one for the same voice actor.

A data migration names the nine nameless The Witcher 3 credits from their legacy IGDB character ids, linking them to registered game characters in place.

Remove the legacy `work.character_id`, `work.suggestions` and `work.source_id` columns. Game credits are identified by `game_character_id` and their name; the game cast editor now registers a provider (IGDB) character as a local game character when it is picked. `save_admin_credit_import` no longer takes `p_character_id`. The migration refuses to run if a row would lose information, and the previous website build errors on game pages until the new Worker is live, so deploy the migration and the Worker back to back.

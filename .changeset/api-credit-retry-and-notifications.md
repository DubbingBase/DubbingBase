---
"@app/website": patch
---

Credits batch: a retry that leaves out `game_character_id` no longer duplicates a credit already linked to a game character; it returns `unchanged` with `linked_game_character_id` (409 `ambiguous_credit` if several match). API admin notifications now list each new credit (actor, character, language) and the registered character, with a subject and tag.

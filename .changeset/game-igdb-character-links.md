---
"@app/website": patch
---

Serve IGDB backdrops as plain images so the game hero is no longer blurry, and add `scripts/backfill-igdb-game-characters.mjs`, which generates idempotent SQL to store IGDB characters as `game_characters` rows (linking curated same-name rows instead of duplicating them).

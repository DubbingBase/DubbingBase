---
"@app/website": patch
"@app/shared-logic": patch
---

Resolve character images through one shared, lazy `/api/character-images` endpoint (TVDB, then verified Wikimedia Commons) used by the actor, movie, show, episode and admin movie editor. Movie, show, season and episode API responses no longer embed TVDB character lists.

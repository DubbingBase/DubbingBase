---
"@app/website": patch
"@app/shared-logic": patch
---

Fix TVDB character lookups (the base movie/series records never contain characters; use the extended records) and resolve character images through one shared, lazy `/api/character-images` endpoint (TVDB, then verified Wikimedia Commons) used by the actor, voice-actor, movie, show, episode and admin movie editor. API responses no longer embed TVDB character lists.

---
"@app/website": patch
"@app/shared-logic": patch
---

Fix game search returning no results: bind CACHE_KV namespace so Twitch tokens persist across Worker isolates, stop caching IGDB error fallbacks for 1h in game detail endpoint, and add video_game to shared SearchResult media_type union

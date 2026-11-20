---
"@app/website": patch
---

Cache raw provider responses (TMDB, TVDB, OpenLibrary, Wikidata) in Cloudflare's edge cache instead of KV (no new KV writes), retry TMDB once on 429/5xx, and cap media fan-out at 6 concurrent requests to match Workers' outbound connection limit.

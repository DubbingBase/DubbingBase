---
"@app/website": patch
---

Reuse verified character-image misses for 24 hours, preserve retryable provider failures and no-store fallbacks, search TVDB movies with the correct production type, and reuse production-scoped Wikimedia candidates across role names. Skip TMDB metadata loading when cached TVDB images suffice.

Cache successful character images and production candidates for 30 days while retaining 24-hour verified misses and uncached provider failures.

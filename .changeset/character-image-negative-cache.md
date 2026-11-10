---
"@app/website": patch
---

Resolve TVDB characters only from explicit production mappings, reuse verified TVDB misses for 24 hours and successful TVDB portraits for 30 days, and skip metadata loading on cached image hits. Share Wikimedia work only within each API request, without reading or writing Wikimedia KV entries. Keep provider failures uncached and degraded responses no-store.

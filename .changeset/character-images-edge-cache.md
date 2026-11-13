---
"@app/website": patch
---

Cache character images longer at the edge, request them per production so the same card shares one cache entry across pages, persist Wikimedia lookups in KV, and stop merged/deleted Wikidata items from marking responses as degraded (uncacheable).

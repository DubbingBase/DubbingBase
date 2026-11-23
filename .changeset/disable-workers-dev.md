---
"@app/website": patch
---

Disable the `workers.dev` address and per-version preview URLs for the production Worker, so the site and the public API are only reachable through `dubbingbase.com`, where the zone's rate-limiting rule applies.

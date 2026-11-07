---
"@app/website": patch
"@app/shared-logic": patch
---

Allow anonymous actor and game detail pages to use the existing public SSR cache policy. Degraded game pages stay out of the shared cache.

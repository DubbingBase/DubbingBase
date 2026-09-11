---
"@app/website": patch
---

Fix Spanish false-positive dubbing detection and `[object Object]` extraction errors: bare `Reparto`/`Actores` headings no longer match as dubbing sections, and LLM fallback failures serialize structured errors instead of masking them.

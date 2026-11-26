---
"@app/website": patch
"@app/supabase": patch
---

Let several characters of one game share an IGDB character or Wikidata item, so variants such as "Ciri" and "Ciri (child)" can all be linked (no more 409 on `PATCH /characters/{id}`). Drops the per-game unique indexes on those references.

---
"@app/website": patch
"@app/shared-logic": patch
---

Replace `/api/character-images` with one stable, edge-cached `/api/character-portraits` request per production, matching role names in the browser so paging or filtering no longer calls the API. Remove the Wikimedia Commons fallback: it found no image in a 141-role sample, and Wikidata lists a character image for about 1% of films.

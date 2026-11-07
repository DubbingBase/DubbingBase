---
"@app/website": patch
---

Check Open Library and IGDB responses at runtime instead of annotating `res.json()` results with a type. Open Library fields are kept only when they have the expected type, and `IgdbClient.query` now takes a row guard (`isIgdbGame`, `isIgdbCharacter`, ...) and throws on an invalid response. `igdb.ts` and `openlibrary.ts` are removed from the type-aware lint legacy list.

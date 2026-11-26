---
"@app/website": patch
"@app/shared-logic": patch
---

Show a game cast card's own credit character name (then the local game character name) instead of the linked IGDB character's name, which is now only a fallback, so credits such as "Ciri (child)" or "Peter Parker" keep their names when they share or link to an IGDB character. The IGDB image fallback is unchanged.

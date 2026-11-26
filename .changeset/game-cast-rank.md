---
"@app/website": minor
"@app/supabase": minor
"@app/shared-logic": patch
---

Rank a game's cast with an explicit cast order: one ordered list per game, shared by every language. The database keeps it at positions 1..n (no ties, no gaps, checked at commit), versions every change and audits it. Characters not in the list are unranked; new IGDB or DubbingBase characters are never added implicitly.

- v1 API: `GET`/`PUT /games/{id}/cast-order` read and replace the list (`If-Match` required, 412 when it changed). `PATCH /credits/{workId}` and `POST /credits/sync` accept `cast_rank`: the credit's game character moves to that position and the others shift; ranks past the end, shared ranks and unlinked credits are refused. The sync dry run reports rank changes as updates and previews the whole order with its version, which `cast_order_version` pins for the real run. Credits return `cast_rank`, and a ranked credit's ETag includes it.
- Game pages list ranked characters first, then the others in the previous order (highlighted, voiced, alphabetical).
- The game project editor has a game cast order panel: drag and drop or move up/down, rank or unrank characters (an IGDB-only character is registered for the game when ranked), saved against the loaded version. Cast rows show their position.

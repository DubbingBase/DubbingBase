---
"@app/website": patch
"@app/mobile": patch
"@app/shared-logic": patch
---

Fix video game pages failing to load on DubbingBase:

- Corrected `fetchGameData` invocation in `game/[id].vue` by removing incorrect extra argument.
- Added `MediaSkeleton` loading state and not-found fallback to video game details page.
- Added high-resolution artworks and screenshots mapping in IGDB responses and types.
- Allowed `images.igdb.com` in Nuxt image domains.
- Fixed IGDB fetch URL in game edit page to `/api/game/:id`.
- Added video game resolution and routing support for voice actor works.

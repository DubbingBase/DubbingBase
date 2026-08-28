---
"@app/website": patch
---

Final pass optimization across auxiliary endpoints and pages:

- Added public SWR `Cache-Control` headers on `/api/search`, `/api/career-grid`, `/api/get-metadata`, and `/api/get-media-credits`.
- Added `getCachedData` payload cache resolution to `/contribute` page.

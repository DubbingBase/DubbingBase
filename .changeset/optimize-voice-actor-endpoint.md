---
"@app/website": patch
"@app/shared-logic": patch
"@app/mobile": patch
---

Optimize voice actor loading and remove work votes logic:

- Added deduplication of external TMDB/TVDB/IGDB media requests in `MediaService`.
- Implemented batched concurrency for external API calls to avoid socket exhaustion and rate limits.
- Pre-projected compact `enhancedWorks` array on the server, reducing API response and SSR payload size by ~99%.
- Added public SWR `Cache-Control` header for CDN and edge caching on `/api/voice-actor/[id]`.
- Replaced nested linear scans in `useVoiceActorData` with O(1) Map index lookups.
- Removed work votes queries, composable references, and UI watchers from the voice actor flows.

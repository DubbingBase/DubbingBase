---
"@app/website": patch
---

Optimize catalog listing pages and trending API endpoints:

- Added public SWR `Cache-Control` headers across `/api/trending/movies`, `/api/trending/shows`, `/api/trending/games`, `/api/trending/voice-actors`, and `/api/list-voice-actors`.
- Added `getCachedData` to `useAsyncData` across `/movies`, `/series`, `/voice-actors`, and `/studios` for instant navigation.
- Added progressive batch rendering and debounced search to `/voice-actors` and `/studios` using `useIntersectionObserver` and `refDebounced`.
- Added preconnect and dns-prefetch resource hints for `image.tmdb.org` on catalog pages.
- Added `decoding="async"` across catalog page images.

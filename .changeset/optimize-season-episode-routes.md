---
"@app/website": patch
---

Optimize season and episode details endpoints and pages:

- Removed legacy `getWorkVotes` queries from `/api/season` and `/api/episode`.
- Added public Edge SWR `Cache-Control` headers on `/api/season` and `/api/episode`.
- Added `getCachedData` to `useAsyncData` across season and episode pages for 0ms transitions.
- Added progressive batch rendering and debounced search to episode cast using `useIntersectionObserver` and `refDebounced`.
- Added preconnect and dns-prefetch resource hints for `image.tmdb.org` and `thetvdb.com`.
- Added `loading="lazy"` and `decoding="async"` across season/episode still and cast images.

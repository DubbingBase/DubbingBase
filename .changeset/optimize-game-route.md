---
"@app/website": patch
---

Optimize game details page and API endpoint:

- Removed work votes queries and user vote merging logic from `/api/game/[id]`.
- Added public SWR `Cache-Control` header (`public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800`) on `/api/game/[id]`.
- Implemented progressive batch rendering (`useIntersectionObserver`) and debounced search (`refDebounced`) for the game character/voice cast grid.
- Added `getCachedData` to `useAsyncData` for 0ms back-button route transitions without skeleton flicker.
- Added `preconnect` and `dns-prefetch` resource hints for `images.igdb.com` in `useHead`.
- Added `loading="lazy"` and `decoding="async"` attributes to game cover, artwork, and character/voice actor `NuxtImg` elements.

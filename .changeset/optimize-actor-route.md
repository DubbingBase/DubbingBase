---
"@app/website": patch
---

Optimize original actor details page and API endpoint:

- Deduplicated TMDB media details queries across dubbing works and introduced concurrency-limited batching (batch size 15) in `/api/actor/[id]`.
- Added public SWR `Cache-Control` header (`public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800`) on `/api/actor/[id]`.
- Implemented progressive batch rendering (`useIntersectionObserver`) and debounced search (`refDebounced`) for the filmography grid.
- Added `getCachedData` to `useAsyncData` for 0ms back-button route transitions without skeleton flicker.
- Added `preconnect` and `dns-prefetch` resource hints for `image.tmdb.org` in `useHead`.
- Added `loading="lazy"` and `decoding="async"` attributes to `NuxtImg` elements.

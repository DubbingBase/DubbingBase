---
"@app/website": patch
---

Optimize movie details page and API endpoint:

- Removed legacy `getWorkVotes` queries and user-vote merging logic from `/api/movie/[id]`.
- Added public SWR `Cache-Control` header (`public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800`) on `/api/movie/[id]`.
- Implemented progressive batch rendering (`useIntersectionObserver`) and debounced search (`refDebounced`) for the movie cast grid.
- Added `getCachedData` to `useAsyncData` for 0ms back-button route transitions.
- Added `preconnect` and `dns-prefetch` resource hints for `image.tmdb.org` and `thetvdb.com` in `useHead`.
- Added `loading="lazy"` and `decoding="async"` attributes to `NuxtImg` elements.

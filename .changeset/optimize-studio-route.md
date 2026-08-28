---
"@app/website": patch
---

Optimize dubbing studio details endpoint and profile page:

- Added public SWR `Cache-Control` header (`public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800`) on `/api/get-studio-details`.
- Deduplicated and batched TMDB media fetches (`BATCH_SIZE = 15`) in `/api/get-studio-details` to avoid duplicated external API calls and rate-limiting.
- Added `getCachedData` to `useAsyncData` on `/studio/:id` for 0ms transitions.
- Added search filtering (`refDebounced`) and progressive infinite scroll rendering (`useIntersectionObserver`) for dubbed projects and voice actor rosters.
- Added `preconnect` and `dns-prefetch` resource hints for `image.tmdb.org`.
- Added `loading="lazy"` and `decoding="async"` attributes to images.

---
"@app/website": patch
---

Phase 3 voice actor profile performance optimizations:

- Added `getCachedData` to `useAsyncData` on the voice actor page for instant 0ms back-and-forth route transitions with zero skeleton flicker.
- Added `preconnect` and `dns-prefetch` resource hints for `image.tmdb.org` in `useHead` link metadata.
- Added `loading="lazy"` and `decoding="async"` attributes to all `NuxtImg` poster and avatar elements.

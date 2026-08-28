---
"@app/website": patch
---

Optimize Home landing page and discovery/search endpoints:

- Added public SWR `Cache-Control` headers across `/api/home-stats`, `/api/top-contributors`, `/api/recent-voice-actors`, `/api/top-voice-actors`, and `/api/search-voice-actors`.
- Added `getCachedData` to `useAsyncData` on the home page (`/`) for 0ms transitions and instantaneous back-navigation.
- Added preconnect and dns-prefetch resource hints for `image.tmdb.org` and `images.igdb.com` on the home page.

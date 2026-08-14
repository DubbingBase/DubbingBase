---
"@app/website": patch
---

Improve navigation speed: enable Nuxt payload prefetching (`prefetchPreload`) so media data is fetched on link hover instead of on click. Edge functions for movie/show/game now return edge-cacheable responses (SWR), and `prepare_media` purges the cached media page after a refresh.

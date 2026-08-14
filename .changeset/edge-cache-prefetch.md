---
"@app/website": patch
---

Performance: enable Nuxt payload prefetching, add client-side SWR cache (instant cached media on navigation with background revalidation), edge-cache media edge-function responses (SWR), and purge the cache on media refresh. Also improve hero images with `fetchpriority="high"`/eager loading, reserved aspect space to avoid layout shift, and lazy-load below-the-fold images. Applied across all main detail views: movie, show, game, voice-actor, and actor.

---
"@app/website": patch
---

Performance: enable Nuxt payload prefetching, add client-side SWR cache (instant cached media on navigation with background revalidation) to all detail views (movie, show, game, voice-actor, actor, studio), edge-cache media edge-function responses (SWR), and purge the cache on every media-affecting mutation. Cache is now busted from: `prepare_media`, `prepare_game`, `cast-vote`, `save-dubbing-project`, `save-studio`, `delete_work_entry`, `update_voice_actor_link`, `link-voice-actor`, `delete-voice-actor-link`, and `update-review-status` (all resolve the correct media `Cache-Tag`). Also improve hero images with `fetchpriority="high"`/eager loading, reserved aspect space to avoid layout shift, and lazy-load below-the-fold images. All main detail views now share coherent SSR + SWR + image behavior.

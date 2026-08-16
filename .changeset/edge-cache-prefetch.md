---
"@app/website": patch
---

Performance: enable Nuxt payload prefetching, add client-side SWR cache (instant cached media on navigation with background revalidation) to all detail views (movie, show, game, voice-actor, actor, studio), edge-cache media edge-function responses (SWR), and purge the cache on every media-affecting mutation. Cache is now busted from: `prepare_media`, `prepare_game`, `cast-vote`, `save-dubbing-project`, `save-studio`, `delete_work_entry`, `update_voice_actor_link`, `link-voice-actor`, `delete-voice-actor-link`, and `update-review-status` (all resolve the correct media `Cache-Tag`). Also improve hero images with `fetchpriority="high"`/eager loading, reserved aspect space to avoid layout shift, and lazy-load below-the-fold images. All main detail views now share coherent SSR + SWR + image behavior.

Cache correctness fixes: the SSR HTML for media pages is now tagged with the same `Cache-Tag` (via a Nitro middleware) so tag-based purge busts both the HTML and the edge-function response in every environment; the Cloudflare purge call is now bounded by a 2s timeout so writes never block on a slow CDN; and the client SWR can be invalidated on mutation (delete helpers + a `media-cache:invalidate` event the studio-edit flow already uses), eliminating the brief stale-data flash after an edit.

The cache-tag middleware now covers `/voice-actor` and `/actor` pages too, derives the locale prefix from the live i18n config (so any new language is covered automatically, not just `/fr`), and the voice-actor/actor edge functions now emit `Cache-Control` + `Cache-Tag`. Profile-picture mutations (`upload_profile_picture`, `update-voice-actor`, `revert-task`) now purge the affected `voice-actor` page and, when linked, the `actor` page.

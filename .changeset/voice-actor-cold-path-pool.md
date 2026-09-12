---
"@app/website": patch
---

perf(server): unblock voice-actor cold path with pooled media fan-out

Replace serial 15-item batches with a concurrency-limited worker pool so one slow TMDB/TVDB straggler no longer stalls the whole batch, and overlap the backdrop person-credits and Wikipedia fallback fetches with the media fan-out instead of running them afterwards.

Drop the per-media TVDB character-image chain from the voice-actor fan-out: it cost up to 3 slow requests per media (Wikidata + TVDB search + TVDB fetch) and resolved 0 images across 130+ sampled works. Movie/show detail pages keep their own single lookup. No response-shape changes.

Fix KV cache fragmentation on the voice-actor endpoint: the cache key used the raw Accept-Language header, so every browser header variant triggered its own 100+ request recompute. Normalize to the primary language tag (same as TMDBClient), collapsing variants to one hot entry.

Drive TMDB language from the route locale (?lang=, allowlisted to en-US/fr-FR/es-ES/ja-JP) instead of the ambient browser header, so titles match the page language and keys collapse to 4 canonical entries. Header remains the fallback.

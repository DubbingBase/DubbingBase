---
"@app/website": patch
---

Cache the favicon, logo and content-hashed i18n assets instead of revalidating them on every load, link the footer About entry to its canonical trailing-slash URL to avoid a redirect, and bound the movie page structured-data cast list to keep server rendering work small.

Raise the Cloudflare edge cache lifetime for media pages (30 minutes to 6 hours) and detail JSON (5 minutes to 1 hour), with a day of stale-while-revalidate, so crawler sweeps hit the cache instead of re-rendering.

Cache season and episode pages at the edge like other media pages, give the prerendered About pages, offline page and web manifest short browser lifetimes, and sort character-image batch parameters so identical cards share one edge cache key.

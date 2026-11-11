---
"@app/website": patch
---

Cache the favicon, logo and content-hashed i18n assets instead of revalidating them on every load, link the footer About entry to its canonical trailing-slash URL to avoid a redirect, and bound the movie page structured-data cast list to keep server rendering work small.

Raise the Cloudflare edge cache lifetime for media pages (30 minutes to 6 hours) and detail JSON (5 minutes to 1 hour), with a day of stale-while-revalidate, so crawler sweeps hit the cache instead of re-rendering.

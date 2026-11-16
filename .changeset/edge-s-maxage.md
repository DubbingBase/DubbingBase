---
"@app/website": patch
---

Send `s-maxage` in `Cache-Control` for every public cache profile. The Worker's own Cloudflare cache is driven by `Cache-Control` and does not read `Cloudflare-CDN-Cache-Control`, so pages and API responses were only kept for the short browser `max-age` (60 seconds for pages, none for `detail-json`) instead of the intended edge lifetime. Browsers keep the short lifetime; shared caches now get the long one.

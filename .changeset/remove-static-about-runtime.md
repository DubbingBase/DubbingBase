---
"@app/website": patch
---

Remove the hydration-free About page pipeline (regex HTML stripping, light-theme variants, the `/api/about-preference` redirect route and the About-only header fallbacks). The About pages are still prerendered and cached, but now hydrate like the rest of the site.

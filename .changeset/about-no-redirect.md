---
"@app/website": patch
---

Serve the prerendered About pages at `/about` directly (asset `html_handling = "drop-trailing-slash"`) instead of an uncacheable 307 to `/about/`, and attach their cache headers to the slashless paths.

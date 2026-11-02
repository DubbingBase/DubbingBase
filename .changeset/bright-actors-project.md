---
"@app/website": patch
---

Cache the voice actor page's compact TMDB media projections and backdrop path with the existing stable-provider TTL. Build projections from only fields used by the page, skip unused TMDB external IDs and page-only Wikipedia discovery, and keep database work fresh on every request.

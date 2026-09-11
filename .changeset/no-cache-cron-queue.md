---
"@app/website": patch
---

Keep cron queue work cache-free: queue endpoints send no-store headers and the media queue pipeline reads fresh upstream data via FreshCache (writes still warm the shared cache for public pages).

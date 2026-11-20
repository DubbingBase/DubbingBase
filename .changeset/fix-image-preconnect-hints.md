---
"@app/website": patch
---

Fix preconnect hints: image origins are preconnected without `crossorigin` so `<img>` requests reuse the connection, unused `thetvdb.com` hints are removed, and pages that show Supabase-hosted images (voice actor portraits, studio logos) now preconnect to the Supabase origin.

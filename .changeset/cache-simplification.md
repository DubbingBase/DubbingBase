---
"@app/website": patch
---

Simplify website caching by using Cloudflare KV only for external metadata, reading mutable DubbingBase data from Supabase, and standardizing short public cache windows.

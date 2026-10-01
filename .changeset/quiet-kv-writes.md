---
"@app/website": patch
---

Use Nuxt payload data only during hydration, remove page SWR, and keep HTTP caching for complete provider-only responses. Keep mixed Supabase responses fresh on each request/navigation, and use KV selectively for stable external metadata and auth tokens with explicit persistent, read-only, or uncached policies. Volatile searches, trends, and Wikipedia responses bypass KV; stable character and podcast metadata use seven-day lifetimes.

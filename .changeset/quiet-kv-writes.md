---
"@app/website": patch
---

Use Nuxt payload data only during hydration and remove page/Nitro SWR. Default dynamic Worker responses to no-store, and opt successful provider-only responses into Workers caching only after validation. Require an explicit cache policy for every raw KV read-through; keep stable metadata and auth tokens persistent, read-only mappings non-writing, and volatile searches/trending/Wikipedia/queue data uncached. Supabase and mixed responses remain fresh on every request/navigation.

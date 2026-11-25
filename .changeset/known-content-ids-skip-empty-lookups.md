---
"@app/website": patch
"@app/supabase": patch
---

Stop querying Supabase for ids DubbingBase has no data for. Crawlers walk actor and media pages by provider id, and each unknown id used to cost a logged database request that returned nothing. A new service-role-only `get_known_content_ids()` RPC returns the ids that do have data; the website caches that snapshot in KV (2 minutes) and in isolate memory (30 seconds), and the actor and media page queries answer "no data" for unknown ids without calling Supabase. Any failure to load the snapshot falls back to the normal query, and routes that add a media or a cast credit invalidate it.

---
"@app/website": patch
"@app/supabase": patch
---

Dispatch each media queue once per minute, process discovery and check items in bounded batches of three, and acknowledge successful batch items with one RPC.

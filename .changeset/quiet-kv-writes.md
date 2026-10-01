---
"@app/website": patch
---

Define persistent, read-only, and uncached provider policies; stop persisting volatile searches, trends, and Wikipedia responses while retaining KV for auth tokens and stable metadata used by internal fanout. Keep public response caching only for provider-only output, make mixed Supabase responses fresh on every request, and extend the stable TVDB character metadata TTL to seven days.

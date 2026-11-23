---
"@app/website": patch
"@app/supabase": patch
---

Stop version-conflict database functions from hanging until the gateway times out: they now raise PostgREST's `PT409` instead of the retryable `40001`, and the website routes map `PT409` to the same conflict responses.

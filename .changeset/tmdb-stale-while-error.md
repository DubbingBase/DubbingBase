---
"@app/website": patch
---

Answer TMDB calls from the last good copy (7 days, Workers Cache API, no KV writes) when TMDB returns 429/5xx or times out after the retry, instead of failing the page.

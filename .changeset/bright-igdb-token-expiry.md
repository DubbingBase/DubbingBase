---
"@app/website": patch
---

Store IGDB token expiry with the cached token so KV hits use the provider-derived expiry and stale legacy entries are refreshed.

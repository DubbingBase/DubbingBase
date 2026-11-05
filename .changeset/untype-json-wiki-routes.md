---
"@app/website": patch
---

Replace untyped `response.json()` results in the Wikipedia voice actor extraction, voice actor page request, subscriber notification, and media queue routes with `unknown` values narrowed by explicit checks. Runtime behavior is unchanged.

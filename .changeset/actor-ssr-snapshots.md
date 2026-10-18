---
"@app/website": patch
---

Reduce actor-page SSR work by avoiding deep reactive proxies for request-local data while retaining normal browser reactivity.

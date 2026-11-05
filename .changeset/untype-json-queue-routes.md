---
"@app/website": patch
---

Type untrusted JSON responses from the trending-media, media-queue, and enqueue tasks as `unknown` so their values are narrowed by explicit checks before use, with no change to runtime behavior.

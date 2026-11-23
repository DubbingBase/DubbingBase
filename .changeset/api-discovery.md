---
"@app/website": patch
---

Make the public API discoverable: link the OpenAPI spec and docs from `llms.txt`, from `Link` headers on API responses (including 401s), and from a `/.well-known/api-catalog` document.

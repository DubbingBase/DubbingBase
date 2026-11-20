---
"@app/website": patch
---

Disable unused `@nuxt/fonts` providers so a CDN timeout from an unused font provider (for example Bunny) can no longer fail the website build.

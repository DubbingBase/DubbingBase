---
"@app/website": patch
---

Fix OG image generation 500 on Cloudflare Workers: use static imports for `satori`/`@resvg/resvg-wasm` (dynamic imports weren't bundled into the worker) and load the resvg WASM + Inter fonts from Nitro server assets (`server/assets/og-image/`) instead of fetching them from a CDN at runtime.

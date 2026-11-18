---
"@app/website": patch
---

Remove the dormant per-actor Open Graph image renderer (`/api/og-image`, satori, resvg, `@cf-wasm/*`, the Inter font files, `scripts/patch-wasm.mjs`, the `@app/og-image` package and the wasm rollup external) and the unused `inlineRouteRules` flag. Voice-actor pages keep the shared 512 px preview they already served while `ogImagesEnabled` was off. The Worker upload drops from about 8.0 MB to 4.9 MB (gzip 2.1 MB to 1.0 MB).

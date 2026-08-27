---
"@app/website": patch
---

Fix Cloudflare Workers Satori `WebAssembly.instantiate` error for OG image generation:

- Switched from standard `satori` to `@cf-wasm/satori/workerd` to use pre-compiled Yoga WebAssembly module instead of runtime `WebAssembly.instantiate()`.
- Updated `scripts/patch-wasm.mjs` to copy and patch both `yoga.wasm` and `resvg.wasm`.

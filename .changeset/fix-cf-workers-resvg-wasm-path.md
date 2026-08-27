---
"@app/website": patch
---

Fix Cloudflare Workers deployment failing to resolve `@cf-wasm/resvg` wasm asset:

- Added `scripts/patch-wasm.mjs` post-build script to copy `resvg.wasm` to `.output/server/resvg.wasm` and rewrite chunk import paths.
- Updated `build` script in `package.json` to automatically run `patch-wasm.mjs`.

---
"@app/website": patch
---

Fix voice actor OG image generation on dubbingbase.com:

- Updated `ogImageUrl` in `voice-actor/[id].vue` to point to `/api/og-image?type=voice-actor&id=...` instead of the legacy Supabase Edge Function URL.
- Fixed `@cf-wasm/resvg/workerd` Resvg initialization and import in `api/og-image/index.get.ts`.
- Safe chunked base64 conversion in `fetchImageAsDataUri` to prevent stack overflow RangeErrors on large avatar images.
- Included `voice_actor_name` in query selections for voice actors with stage names.
- Removed obsolete top-level `wasm.esmImport` from Nuxt config.

---
"@app/website": patch
---

Harden `nuxt.config.ts`: compile the E2E mock middleware only when `E2E_TEST=true` (matching the scheduled-task guard), fail production Nitro builds that lack Supabase credentials instead of shipping mock values, skip dev/test-only Nuxt modules in production, and report the real package version to PostHog. Also pin `nuxt` to `^4.6.4` instead of `latest`, align the PWA manifest colors with the dark theme background, ship a dedicated maskable icon instead of `any maskable`, and drop the Cloudflare KV namespace duplicated from `wrangler.toml`.

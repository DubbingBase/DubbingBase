---
"@app/website": minor
"@app/shared-logic": minor
---

Migrate all 66 Supabase Edge Functions to Nuxt Nitro server routes on Cloudflare Workers. Replace Upstash Redis with Cloudflare KV for edge caching. Add Cloudflare Hyperdrive for PostgreSQL connection pooling. Migrate frontend composables from supabase.functions.invoke to $fetch.

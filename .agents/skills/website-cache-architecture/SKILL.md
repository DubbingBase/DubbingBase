---
name: website-cache-architecture
description: Preserve DubbingBase website freshness, HTTP cache headers, and Cloudflare KV policy when changing data fetching or caching.
---

# Website cache architecture

Read this before changing website data freshness, dynamic response headers, or persistent provider caching.

## Freshness layers

- Nuxt `useAsyncData` may reuse `nuxtApp.payload.data[key]` only while `nuxtApp.isHydrating` is true. Do not read `nuxtApp.static.data` or configure page/Nitro stale-while-revalidate.
- Worker HTTP caching is enabled in `apps/website/wrangler.toml`. `server/plugins/cache-headers.ts` is the single owner of dynamic response caching (policy in `server/utils/cache/response-policy.ts`): it defaults every Nitro response to `no-store`; static `ASSETS` responses bypass Nitro.
- Anonymous renders of the pages allow-listed in `apps/website/server/utils/cache/public-pages.ts` are edge-cached for a few minutes by that same policy (profile `page`). Their SSR HTML must be identical for every visitor: render user-dependent UI only through `useClientUser()` (never `useSupabaseUser()` in templates), keep the theme out of server output, do not set or read cookies during SSR, and never redirect by `Accept-Language` (language comes from the URL; `LanguageBanner` only suggests). Requests with a Supabase auth cookie or `Authorization` header, non-200 responses, and unlisted routes stay `no-store`. Editors see changes on these pages after the TTL.
- Public HTTP caching is an explicit opt-in for complete provider-only responses. Set it only after upstream data is validated and the response is ready. Missing credentials, errors, fallbacks, authenticated responses, and Supabase or mixed responses stay `no-store`.

## Persistent provider values

- Cloudflare KV is the only persistent server-side value cache. Do not add Redis, in-memory value caches, other Nitro caches, or purge-after-write logic.
- Every raw `getOrFetch` call must use its discriminated policy: `persistent` requires an explicit `ttl`; `read-only` and `none` reject TTLs. There is no implicit TTL.
- `persistent` reads and writes KV, `read-only` reads without writing, and `none` bypasses KV. In-flight request coalescing does not make a response value cache.
- Stable metadata and mappings use the explicit `STABLE` lifetime. Provider auth tokens declare their lifetime at the call site.
- Do not persist searches, trending data, volatile Wikipedia content, or queue state.

Keep provider-only caching separate from Supabase or authenticated data paths, and preserve the default response when adding a page-specific projection.

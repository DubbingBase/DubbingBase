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
- Public HTTP caching is an explicit opt-in for complete provider-only responses. A response that mixes editable Supabase rows with provider data stays `no-store`, because editors would see stale data after a save until the edge TTL ends. `/api/actor/[id]` (`actor-page` projection, `detail-json`) is a known exception that accepts that staleness; do not copy it to editable surfaces such as `/api/voice-actor/[id]`. To cache the provider part of a mixed page, split it so the editable row is fetched fresh and the provider part is cached by key. Set it only after upstream data is validated and the response is ready. Missing credentials, errors, fallbacks, authenticated responses, and Supabase or mixed responses stay `no-store`.

## Choosing a layer for provider data

Pick the cheapest layer that fits the data, in this order:

1. **Cloudflare edge cache** (`edgeCache(ttl)` from `server/utils/cache/edge.ts`, spread into the provider `fetch` init) for raw, large, per-URL provider responses such as TMDB, TVDB, OpenLibrary and Wikidata GETs. It is free (no KV writes) but per data center, best-effort and cannot be purged by key. Only 2xx responses are kept for the TTL, a 404 briefly, 5xx never. Every provider GET with stable data uses it (TMDB, TVDB, OpenLibrary, Wikidata/Wikimedia, the iTunes podcast lookup); new provider clients must too. IGDB is the exception: its queries are POST, which Cloudflare does not cache, so game data stays in KV (one write per game). Never use it for searches, trending lists, volatile Wikipedia content, POST requests (IGDB), or anything carrying per-user data.
2. **KV** (`getOrFetch` / `set`, below) only for small derived results that are expensive to rebuild: mappings, projections, and values built from several upstream calls. **KV writes cost real money: write sparingly.** One write per logical page or mapping is the budget; never write once per item of a fan-out (per production, per cast member, per search). Commit `e7cd8744` removed per-request KV caching of raw TMDB responses as low-reuse; do not bring it back without measured edge-cache misses and an estimate of the extra writes.
3. **`Cache-Control` on our own responses** (below) for complete provider-only responses.

Layers fall through: a KV miss refetches from the provider, which usually hits the edge cache. During SSR `$fetch('/api/...')` is an in-process call and never touches the Cloudflare cache, so SSR depends on page-HTML caching and on layers 1 and 2.

Key design: cache at the unit that costs one write. The voice-actor page keeps one KV blob per voice actor (`voice-actor-page-media`); when its key changes (a work was added) the rebuild re-reads each production from the edge cache instead of writing per-production KV entries. Cache only complete values, so a partial failure is retried instead of pinned.

## Outbound provider requests

- Fan-out concurrency is at most 6: Workers keep about 6 outbound connections open, so more only queues, and each Worker invocation has a subrequest limit (50 free, 1000 paid; KV reads count).
- `TMDBClient.get` retries once on 429/5xx/timeout (delay capped at 1 s, `Retry-After` honored). Keep total retries under the 12 s `withMediaServiceTimeout`.
- In-flight coalescing is per isolate only; it does not stop a cross-isolate herd on a cold key.

## Persistent provider values

- Cloudflare KV is the only persistent server-side value cache. Do not add Redis, in-memory value caches, other Nitro caches, or purge-after-write logic.
- Every raw `getOrFetch` call must use its discriminated policy: `persistent` requires an explicit `ttl`; `read-only` and `none` reject TTLs. There is no implicit TTL.
- `persistent` reads and writes KV, `read-only` reads without writing, and `none` bypasses KV. In-flight request coalescing does not make a response value cache.
- Stable metadata and mappings use the explicit `STABLE` lifetime. Provider auth tokens declare their lifetime at the call site.
- Do not persist searches, trending data, volatile Wikipedia content, or queue state.

Keep provider-only caching separate from Supabase or authenticated data paths, and preserve the default response when adding a page-specific projection.

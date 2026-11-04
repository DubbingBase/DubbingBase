---
"@app/website": patch
---

Consolidate dynamic response cache headers into one Nitro plugin and policy (`server/plugins/cache-headers.ts`, `response-policy.ts`) replacing the cache-headers middleware and the dev, error and public-page plugins. Compile the E2E mock interceptor only for E2E runs so its 1,700 lines of fixtures no longer ship in the production Worker bundle, and run the Supabase auth middleware only for `/api/` requests so page views skip the per-request `auth.getUser()` round trip.

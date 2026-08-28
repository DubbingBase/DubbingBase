---
"@app/website": patch
---

Add reusable route performance utilities and architectural guidelines:

- Added `setPublicCacheHeaders(event, profile)` server utility in `server/utils/cache/http.ts`.
- Added `useProgressiveBatch` composable in `src/composables/useProgressiveBatch.ts`.
- Updated `.agents/AGENTS.md` with explicit route performance and caching architecture standards.

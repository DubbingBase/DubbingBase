---
"@app/website": patch
---

Fix show season/episode loading timeouts and enable Cloudflare KV cache binding

- Enable Cloudflare `CACHE_KV` namespace binding in `nuxt.config.ts` with two-tier (L1 in-memory + L2 Cloudflare KV) caching across Worker isolates
- Fix show season and episode endpoints hanging on slow external TVDB searches by retrieving parent show character pictures from cache
- Fix season 0 / specials validation in TMDB media service
- Fix episode image URLs, title formatting, and `$t` references in Vue SFC components
- Add error/not-found states for season and episode pages

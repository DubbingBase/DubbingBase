# Route Performance & Architecture Optimization Roadmap

This document tracks completed and upcoming route-level performance optimizations across the backend APIs and frontend pages.

---

## 🚀 Completed Routes

- [x] **`/voice-actor/:id` (Voice Actor Profile)**
  - Backend: Deduplicated TMDB queries, concurrency batching (`BATCH_SIZE = 15`), compact `enhancedWorks` payload (<80KB), removed work votes, public Edge SWR headers.
  - Frontend: VueUse `useIntersectionObserver` progressive DOM windowing, `refDebounced` search, `getCachedData` for 0ms transitions, TMDB preconnect hints, lazy/async image decoding.
- [x] **`/game/:id` (Video Game Details)**
  - Backend: Removed work votes query and user vote merging, public Edge SWR headers, `"LONG"` cache TTL.
  - Frontend: Progressive DOM batching (`useIntersectionObserver`), debounced search (`refDebounced`), `getCachedData`, IGDB preconnect hints, lazy/async image decoding.
- [x] **`/actor/:id` (Original Foreign Actor Profile)**
  - Backend: Deduplicated TMDB media requests across dubbing works, concurrency batching (`BATCH_SIZE = 15`), public Edge SWR headers.
  - Frontend: Progressive filmography rendering (`useIntersectionObserver`), debounced search (`refDebounced`), `getCachedData`, TMDB preconnect hints, lazy/async image decoding.

---

## 🎯 Next Priority Routes to Optimize

### 1. 🥇 `/show/:id` (TV Series Details with Seasons & Episodes) — **[NEXT UP]**

- **API:** [`apps/website/server/api/show/[id].get.ts`](apps/website/server/api/show/[id].get.ts)
- **Page:** [`apps/website/src/pages/show/[id].vue`](apps/website/src/pages/show/[id].vue)
- **Bottlenecks:**
  - Endpoint still runs legacy `getWorkVotes` queries and user-vote merging logic.
  - Missing public SWR `Cache-Control` header.
  - Long-running series (_The Simpsons, Friends, Game of Thrones, One Piece_) transfer large multi-season cast arrays and render hundreds of DOM nodes at once.
- **Action Items:**
  - [ ] Remove `getWorkVotes` imports and queries from `/api/show/[id].get.ts`.
  - [ ] Add public SWR `Cache-Control` header (`max-age=3600, s-maxage=86400, stale-while-revalidate=604800`).
  - [ ] Add `getCachedData` to `useAsyncData` for 0ms season/page navigation.
  - [ ] Implement `refDebounced` for the character/voice actor search input.
  - [ ] Add `useIntersectionObserver` progressive batch rendering for large series casts.
  - [ ] Add `preconnect` and `dns-prefetch` hints for `image.tmdb.org` and `thetvdb.com`.
  - [ ] Add `loading="lazy"` and `decoding="async"` across all `NuxtImg` elements.

---

### 2. 🥈 `/movie/:id` (Movie Details Page)

- **API:** [`apps/website/server/api/movie/[id].get.ts`](apps/website/server/api/movie/[id].get.ts)
- **Page:** [`apps/website/src/pages/movie/[id].vue`](apps/website/src/pages/movie/[id].vue)
- **Bottlenecks:**
  - Highest traffic page on DubbingBase.
  - Legacy `getWorkVotes` queries.
  - Missing public Edge SWR headers.
- **Action Items:**
  - [ ] Remove legacy `getWorkVotes` logic.
  - [ ] Add public SWR `Cache-Control` header.
  - [ ] Add `getCachedData` to `useAsyncData`.
  - [ ] Add progressive cast rendering and debounced search.
  - [ ] Add `preconnect` / `dns-prefetch` for `image.tmdb.org`.
  - [ ] Add `loading="lazy"` / `decoding="async"` to `NuxtImg`.

---

### 3. 🥉 `/studio/:id` (Dubbing Studio Profile)

- **API:** [`apps/website/server/api/get-studio-details.get.ts`](apps/website/server/api/get-studio-details.get.ts)
- **Page:** [`apps/website/src/pages/studio/[id].vue`](apps/website/src/pages/studio/[id].vue)
- **Bottlenecks:**
  - Dubbing studios with hundreds of projects.
  - Missing SWR caching headers.
  - Filmography list rendered at once.
- **Action Items:**
  - [ ] Deduplicate and batch TMDB queries for studio projects.
  - [ ] Add public Edge SWR headers.
  - [ ] Add progressive batch rendering and debounced search on studio page.

---

### 4. 📚 Catalog & Listing Pages (`/movies`, `/series`, `/games`, `/voice-actors`)

- **Action Items:**
  - [ ] Optimize trending API endpoints with SWR headers.
  - [ ] Add debounced search and virtualized/progressive infinite scrolls.

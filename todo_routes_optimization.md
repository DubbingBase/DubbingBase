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
- [x] **`/show/:id` (TV Series Details with Seasons & Episodes)**
  - Backend: Removed legacy `getWorkVotes` queries and user-vote merging logic, added public Edge SWR headers (`public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800`).
  - Frontend: Progressive DOM windowing (`useIntersectionObserver`, batch size 36), debounced search (`refDebounced`), `getCachedData` for 0ms transitions, `image.tmdb.org` & `thetvdb.com` preconnect hints, lazy/async image decoding.
- [x] **`/movie/:id` (Movie Details Page)**
  - Backend: Removed legacy `getWorkVotes` queries and user-vote merging logic, added public Edge SWR headers (`public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800`).
  - Frontend: Progressive cast rendering (`useIntersectionObserver`, batch size 36), debounced search (`refDebounced`), `getCachedData` for instant back-button hydration, preconnect hints for TMDB and TVDB, lazy/async image decoding.
- [x] **`/studio/:id` (Dubbing Studio Profile)**
  - Backend: Added public Edge SWR headers, deduplicated and concurrency-batched TMDB queries (`BATCH_SIZE = 15`) across studio dubbing projects.
  - Frontend: Added `getCachedData`, progressive batch rendering (`useIntersectionObserver`) with debounced search for dubbed projects and voice actors roster, preconnect hints.
- [x] **Catalog & Listing Pages (`/movies`, `/series`, `/voice-actors`, `/studios`)**
  - Backend: Added public SWR `Cache-Control` headers across `/api/trending/movies`, `/api/trending/shows`, `/api/trending/games`, `/api/trending/voice-actors`, and `/api/list-voice-actors`.
  - Frontend: Added `getCachedData` across all listing pages, debounced search (`refDebounced`) and progressive infinite scroll windowing (`useIntersectionObserver`) on `/voice-actors` and `/studios`, preconnect hints and `decoding="async"` across images.

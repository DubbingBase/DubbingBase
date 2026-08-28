---
"@app/website": patch
"@app/shared-logic": patch
---

Phase 2 frontend UI performance optimizations for voice actor profiles:

- Added infinite scroll and progressive rendering using VueUse `useIntersectionObserver` for both List and Grouped filmography views.
- Implemented debounced search input with VueUse `refDebounced`.
- Pre-computed `searchText` index for instant $O(1)$ substring matching during filtering.
- Added localized `loadMore` translation across English, French, Spanish, and Japanese locales.

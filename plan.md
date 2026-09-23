1. **Make Show → Season navigation non-blocking**

   - [x] Update `apps/website/src/pages/show/[id]/season/[seasonNumber].vue`.
   - [x] Ensure the route commits immediately and the season page can render its skeleton while data loads.
   - [x] Keep the existing `getCachedData` behavior for fast cached navigation.

2. **Remove duplicate season fetching**

   - [x] Stop calling `/api/season` again through `detail-collections` just to paginate episodes.
   - [x] Paginate `season.episodes` locally because `/api/season` already returns the complete episodes array.
   - [x] Preserve URL-backed `episodesPage`, page size 12, and `PaginatedResponsiveGrid`.

3. **Apply the same principle to show seasons**

   - [x] Evaluate `show-seasons` in `apps/website/src/pages/show/[id].vue`.
   - [x] Since `/api/show/:id` already returns `serie.seasons`, paginate that array locally instead of refetching the whole show through `detail-collections`.
   - [x] Remove `show-seasons` from `detail-collections` if no consumers remain.

4. **Fix Season → Episode navigation the same way**

   - [x] Update `apps/website/src/pages/show/[id]/season/[seasonNumber]/episode/[episodeNumber].vue`.
   - [x] Make the episode detail request non-blocking for route entry.
   - [x] The episode page must show loading/error UI instead of leaving the previous season page visible.

5. **Eliminate redundant cast-detail requests where possible**

   - [x] Review show/movie/episode `media-cast` usage.
   - [x] If the parent detail response already contains the full TMDB cast and dubbing-project works needed to build the displayed cards, paginate/filter locally using existing utilities such as `media-cast.ts`.
   - [x] Keep server-side detail collections only where they actually reduce transferred data or provide data not already loaded.

6. **Expose real fetch errors instead of converting them to `null`**

   - [x] Update `useSeasonData.ts` and `useEpisodeData.ts`.
   - [x] Let `$fetch` errors propagate to `useAsyncData` and add a finite request timeout.
   - [x] Render separate loading, not-found, and request-error states on the pages.

7. **Harden `/api/season` and `/api/episode` against indefinite waits**

   - [x] Keep TMDB’s existing timeout.
   - [x] Add bounded handling for other critical-path dependencies such as cache and Supabase calls.
   - [x] Return a controlled server error/504 on dependency timeout rather than leaving the request unresolved.

8. **Fix Season 0 / Specials validation**

   - [x] Replace uses of the positive-only `requiredId()` validator for season numbers with a dedicated non-negative season validator.
   - [x] Season `0` must be valid; IDs and episode numbers should remain strictly positive.
   - [x] Add regression coverage for `/show/:id/season/0`.

9. **Add realistic E2E coverage for the whole navigation chain**

   - [x] Extend mocks with show seasons, season details, episodes, and episode details.
   - [x] Test Show → Season → Episode, including preservation of `?dub=...`.
   - [x] Add a delayed `/api/season` test proving that the new season page mounts and shows its loader before the request finishes.

10. **Follow repository workflow while implementing**

- [x] Do not touch or test `apps/mobile`.
- [x] Add required patch changesets for every affected package, likely `@app/website` and `@app/shared-logic`.
- [x] Keep strict typing, targeted edits, existing cache headers, and `getCachedData`.
- [x] Run website-scoped formatting, build/typecheck, Vitest, and Playwright validation before finishing (typecheck reports four unrelated existing errors; Playwright reports one unrelated video game cast assertion failure).

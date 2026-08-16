---
"@app/website": minor
"@app/shared-logic": minor
---

Add TV seasons & episodes browsing to show pages: render a series' seasons (from TMDB) and lazily load a selected season's episode list — stills, air dates and overviews — via the existing `season` edge function. Introduces `fetchSeasonData` / `fetchEpisodeData` helpers in `@app/shared-logic` and `SeasonResponse` / `EpisodeResponse` / `Episode` types.

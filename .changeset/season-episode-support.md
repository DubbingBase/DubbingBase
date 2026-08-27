---
"@app/shared-logic": minor
"@app/locales": minor
"@app/website": minor
---

Add support for viewing single seasons and episodes for TV shows

- New composables: `useSeasonData` and `useEpisodeData` in shared-logic
- New pages: Season view (`/show/:id/season/:seasonNumber`) and Episode view (`/show/:id/season/:seasonNumber/episode/:episodeNumber`)
- Enhanced show page with Seasons section linking to individual seasons
- Added translations for seasons/episodes in all locales (en, fr, es, ja)
- Uses existing API endpoints (`/api/season`, `/api/episode`)

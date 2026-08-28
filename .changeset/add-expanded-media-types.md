---
"@app/shared-logic": minor
"@app/locales": minor
"@app/website": minor
"@app/mobile": minor
"@app/database": minor
---

Add full support for audiobooks, podcasts, advertisements, and connected toys

- Added database migrations for `audiobook`, `advertisement`, `podcast`, and `toy` content types
- Integrated OpenLibrary API for audiobook narrations, covers, and details
- Integrated Apple Podcasts / iTunes API for podcast fictions, episodes, and RSS feeds
- Added advertisement spot and connected toy metadata resolvers and video/device embeds
- Added web detail & edit pages (`/audiobook`, `/podcast`, `/advertisement`, `/toy`)
- Added mobile details views and routing for all new media types
- Integrated multi-search across all media families with unified scoring
- Added full translations in English, French, Spanish, and Japanese

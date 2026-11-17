---
"@app/website": patch
---

Fix IGDB game localization lookups failing on rows without a `name`: the guard now accepts such rows and skips them, so localized game names are no longer dropped for the whole response.

---
name: query-tvdb
description: Instructs agents on how to verify or debug TVDB (TheTVDB) metadata (like characters and character images) by querying the unified backend endpoints via `mise run curl-function`. Trigger when investigating missing characters, incorrect character profile pictures, or TVDB discrepancies.
---

# Querying TVDB Data

To verify or debug TVDB API data (such as characters, profile pictures, etc.), you should use the local edge functions rather than querying TVDB directly. The backend edge functions handle authentication and unify the data from multiple sources (TMDB, TVDB, DB). TVDB character data is automatically fetched and merged when you query a movie or show.

Use the `mise run curl-function` command from the root of the workspace.

## Examples

**Check characters for a Movie (using its TMDB ID)**:

```bash
mise run curl-function movie --body '{"id": 366672}' | jq '.characterProfilePictures'
```

**Check characters for a TV Show (using its TMDB ID)**:

```bash
mise run curl-function show --body '{"id": 1399}' | jq '.characterProfilePictures'
```

_Note_: External metadata is cached in Cloudflare KV through the Worker cache binding. For cache issues, inspect the route's cache key and its use of `useCache(event)`; DubbingBase data remains in Supabase.

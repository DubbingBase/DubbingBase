---
name: query-tmdb
description: Instructs agents on how to verify or debug TMDB (The Movie Database) metadata by querying the unified backend endpoints via `mise run curl-function`. Trigger when investigating missing TMDB images, wrong titles, or querying external metadata.
---

# Querying TMDB Data

To verify or debug TMDB API data (e.g., missing character images, wrong movie metadata), you should use the local edge functions rather than querying TMDB directly. The backend edge functions handle authentication and unify the data from multiple sources (TMDB, TVDB, DB), which means they reflect exactly what the frontend receives.

Use the `mise run curl-function` command from the root of the workspace.

## Examples

**Querying a Movie (by TMDB ID)**:

```bash
mise run curl-function movie --body '{"id": 366672}' | jq .
```

**Querying a TV Show (by TMDB ID)**:

```bash
mise run curl-function show --body '{"id": 1399}' | jq .
```

**Searching for Media**:

```bash
mise run curl-function search --body '{"query": "Paws of Fury"}' | jq .
```

---
"@app/website": minor
---

Extend the public API with cast credits: read a media entry's languages, characters and credits, list a voice actor's credits and search actors by name, add credits in batches (all-or-nothing, with `dry_run`), change or delete a credit, and create advertisements and toys. New `credits:read` and `credits:write` token scopes. Credit audit rows now record whether the change came from the website or the API, and API changes are reported to the admin channel like website contributions. The API never calls media providers, so credits can only be added to media already known to DubbingBase.

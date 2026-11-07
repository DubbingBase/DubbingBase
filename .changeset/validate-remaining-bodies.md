---
"@app/website": patch
---

Validate request bodies in `revert-task`, `request-voice-actor-page`, `get-user-voice-actor` and `notify-subscribers` instead of reading untyped `readBody(event)` values, so malformed input now returns a 400 (notify-subscribers no longer turns its own 400 into a 500). `manage-subscription` reads the embedded voice actor name without an implicit `any`. The five files are removed from the type-aware lint legacy list.

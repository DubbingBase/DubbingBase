---
"@app/website": patch
---

Validate request bodies instead of trusting `readBody(event)`, which returns `any`. The user admin routes (`delete_user`, `update_user_role`, `create-user-profile`, `update-user-profile`), the vote, report and subscription routes, and the media queue and voice actor extraction routes now narrow the body as `unknown` and return a 400 before any database or auth call when it is malformed. Valid requests behave as before. Remove the 17 files this cleans up from the type-aware lint legacy list.

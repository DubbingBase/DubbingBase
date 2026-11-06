---
"@app/website": patch
---

Validate request bodies instead of trusting `readBody(event)`, which returns `any`. The user admin routes (`delete_user`, `update_user_role`, `create-user-profile`, `update-user-profile`), the vote, report and subscription routes, and the media queue and voice actor extraction routes now narrow the body as `unknown` and return a 400 before the route's database or Supabase auth-admin call when it is malformed (request authentication still runs first, so an unauthorized caller gets a 401 or 403). Valid requests behave as before. The shared profile validators live in `server/utils/profile-validation.ts`. Remove the 17 files this cleans up from the type-aware lint legacy list.

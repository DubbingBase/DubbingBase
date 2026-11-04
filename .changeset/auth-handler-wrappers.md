---
"@app/website": patch
---

Replace the global Supabase auth middleware with `defineUserHandler`, `defineAdminHandler` and `resolveUser`. Routes now declare their authentication requirement and the user is resolved just before the handler runs, so page views and public API reads no longer pay for `auth.getUser()`. Add a convention test that guards against reading a pre-resolved `event.context.user`.

---
"@app/website": patch
---

Remove `any` from the login, register, series, and profile pages, the reports composable, and the PostHog plugin. Caught errors are read through the shared `readErrorMessage` helper (so Supabase error objects keep their messages), audit logs use the `audit_logs` database row type, the PostHog build-time `__VERSION__` constant is declared instead of suppressed with `@ts-ignore`, and the obsolete `@ts-ignore` above `fonts` in `nuxt.config.ts` is removed.

---
"@app/website": patch
---

Remove the mock Supabase URL and key fallbacks from `nuxt.config.ts` (Playwright and CI already pass their own values), derive the prerendered About routes from `APP_LOCALES`, and reuse the production flag for the Supabase cookie `secure` option.

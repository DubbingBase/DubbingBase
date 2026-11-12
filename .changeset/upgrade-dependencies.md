---
"@app/website": patch
"@app/shared-logic": patch
---

Update dependencies, including Nuxt, Vue 3.5.45, vue-router, @nuxtjs/i18n, @nuxt/image, Supabase, Wrangler, Playwright and the oxc tooling. vue-tsc stays at 3.3.11 because 3.3.12 and later report false template type errors.

Also move to @vueuse 15, @nuxt/fonts 1, @nuxtjs/robots 7, happy-dom 21, vitest 5, oxfmt 0.78 and Changesets 3, and apply the newer oxfmt formatting.

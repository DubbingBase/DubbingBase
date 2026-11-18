---
"@app/website": patch
---

Remove unused `nuxt.config.ts` settings: eight runtime config keys nothing reads (Gemini model/provider, OneSignal, Resend, admin email, plus their CI env vars and `.env.example` entries), the redundant Vue `resolve.dedupe` list, the `@vueuse/nuxt` module, and the forced client sourcemaps (167 files, 8.3 MB, were published with no consumer). Server sourcemaps stay for Worker profiling.

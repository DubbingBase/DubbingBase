---
"@app/website": patch
---

Fix server-rendered HTML validation errors reported by Nitro's html-validate (nested `<main>` on the home page, skipped heading levels in the footer, login, register and catalog pages, unlabeled search inputs, buttons without a type, and duplicated Lucide icon classes via a `lucide-vue-next` patch). Add an E2E spec that renders a broad set of routes, wait for the dev server to finish compiling before E2E tests start, and fail the E2E pipeline job when the server log contains html-validate errors.

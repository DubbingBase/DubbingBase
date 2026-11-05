---
"@app/website": patch
"@app/shared-logic": patch
---

Clear the remaining `any`, `as` assertion and unused-variable diagnostics repo-wide: `unknown` instead of `any` in the global `$fetch` and vue-i18n declarations, `instanceof`/`typeof` narrowing in the voice actor form and drag-scroll composable, and `asString` for the media credits query. Also make the route CPU profiling script's fonts patch tolerate the removed `@ts-ignore`.

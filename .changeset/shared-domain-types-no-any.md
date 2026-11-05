---
"@app/website": patch
"@app/shared-logic": patch
---

Replace `any` in the shared domain types with database-derived row types, and make the website re-export them from `@app/shared-logic`. Podcast and advertisement pages now read the `crew` and `studio_data` fields that the API actually returns.

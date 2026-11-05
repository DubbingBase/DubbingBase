---
"@app/shared-logic": patch
"@app/website": patch
---

Add `isRecord` and `readProperty` narrowing helpers to `@app/shared-logic` and replace the 22 identical local `isRecord` copies and 8 `readProperty`/`property` copies across the website server routes, utilities and pages. The two admin pages with their own `getErrorMessage` now use the shared `readErrorMessage`, so Supabase error messages are no longer dropped there.

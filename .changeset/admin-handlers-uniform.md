---
"@app/website": patch
---

Use `defineAdminHandler` for the remaining admin-only routes (`work-duplicates`, `save-toy-metadata`) so every admin route enforces the role the same way.

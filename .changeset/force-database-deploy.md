---
"@app/website": patch
---

Add a `force_database_deploy` manual pipeline input that applies pending production migrations from `main` without requiring a dummy change under `packages/database`.

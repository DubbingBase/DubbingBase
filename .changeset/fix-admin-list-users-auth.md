---
"@app/website": patch
---

Fix 401 Unauthorized on admin `/api/list_users` (and any future internal admin endpoints) by injecting the Supabase session token into internal `/api/*` fetch requests via a global `$fetch` wrapper

---
"@app/website": patch
"@app/supabase": patch
---

Use trusted `app_metadata.role` for authorization, protect queue actions with admin-only server routes, and restrict queue management RPCs to `service_role`.

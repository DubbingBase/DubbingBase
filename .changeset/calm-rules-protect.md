---
"@app/website": patch
"@app/supabase": patch
---

Use trusted `app_metadata.role` for authorization, require signed-in users for media enqueue requests, require the service-role key for media discovery, preserve archived queue items when enqueueing finds a duplicate, and restrict queue RPCs to `service_role`.

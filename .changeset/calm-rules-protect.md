---
"@app/website": patch
"@app/supabase": patch
---

Use trusted `app_metadata.role` for authorization, require a signed-in user for media enqueue requests, route browser enqueue actions through the Worker API, and restrict queue RPCs to `service_role`.

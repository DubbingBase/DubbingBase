---
"@app/supabase": patch
---

Exclude migration/config-owned Storage bucket definitions from production data dumps so local reseeds do not duplicate buckets already created by migrations. Storage objects remain synchronized separately.

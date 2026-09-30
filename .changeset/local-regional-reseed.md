---
"@app/supabase": patch
"@app/website": patch
---

Drop the temporary regional-language guard before mapping, bulk-rename non-colliding legacy projects, and run dependency-preserving merges only for actual collisions. Replace the temporary registry with a structural CHECK constraint, remove migration-only language helpers, use the normal full production dump and local reset, and keep Storage synchronization separate.

Describe regional dubbing-language validation structurally in website request errors.

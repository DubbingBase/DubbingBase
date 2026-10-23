---
"@app/supabase": patch
"@app/website": patch
---

Route dubbing-project editor saves through an atomic audited database operation with stale-write checks and idempotent retries. Refresh editor state without losing in-flight edits or restoring removed crew, and validate TV actors against aggregate credits.

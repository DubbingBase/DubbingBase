---
"@app/supabase": patch
"@app/website": patch
---

Route studio edits through an authenticated, allowlisted database operation with immutable atomic audit history.

Unsupported audit records are rejected by the rollback route. Saves omit unchanged storage paths, persist no-op retry receipts, and keep those receipts out of the public contribution feed.

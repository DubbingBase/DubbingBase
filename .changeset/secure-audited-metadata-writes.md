---
"@app/supabase": patch
"@app/website": patch
---

Restrict metadata creation to administrators and record job and voice actor inserts atomically with immutable audit history.

Route website voice actor creation through the controlled API and remove direct authenticated inserts so protected fields and current administrator status cannot be bypassed.

Give each metadata creation a fresh idempotency key and retain it across retries, including picture-upload retries. Rebuild rejected profile requests after validation errors. Require both names, show creation errors in editor dialogs, and accept safe social links with query strings while rejecting credential parameters.

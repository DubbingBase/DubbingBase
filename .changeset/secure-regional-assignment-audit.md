---
"@app/website": patch
"@app/supabase": patch
---

Require idempotent admin identity for regional voice-cast writes and record each project/work change in the immutable audit history within the same transaction.

Keep regional assignment saves working when the website is accessed over HTTP on a local network.

---
"@app/website": minor
"@app/supabase": minor
---

Open voice actor and studio editing to any signed-in user with a confirmed email. Voice actor `profile_picture` and `status` stay admin-only (the picture path fetches external URLs server-side). Admins can block a contributor through `app_metadata.blocked`, enforced inside the audited write RPCs, and can set `app_metadata.trusted` for upcoming auto-verified edits.

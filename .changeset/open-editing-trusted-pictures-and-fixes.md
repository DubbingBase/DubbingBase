---
"@app/website": minor
"@app/supabase": minor
---

Let trusted contributors and admins replace voice actor profile pictures; anyone confirmed and unblocked can still add a first picture. Picture changes now commit atomically through `controlled_set_voice_actor_picture` (live permission checks, compare-and-swap on the previous picture, audit row), the upload route requires a signed-in account and is rate limited per IP and per account, and replaced pictures are kept for non-admin replacements so they can be restored. Studio logo changes stay admin/editor only.

Restore two database settings that later merges silently dropped: `merge_work_duplicates_atomic` runs as `SECURITY DEFINER` again, and `apply_extracted_credits` is back to the safe version that preserves existing suggestions and reports `credits_added`/`credits_overlapped`/`credits_mismatched`.
